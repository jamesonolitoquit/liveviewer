const path = require('path');
const fs = require('fs');
const os = require('os');
const wcag = require('wcag-contrast');

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;

const CHROMIUM_VERSION = '149.0.0';
const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL ||
  `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_VERSION}/chromium-v${CHROMIUM_VERSION}-pack.x64.tar`;

const defaultOutputDir = isVercel
  ? path.join(os.tmpdir(), 'audits')
  : 'audits';

const DEFAULT_VIEWPORT = { width: 1024, height: 768 };

const SERVERLESS_LAUNCH_ARGS = [
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-font-subpixel-positioning',
  '--disable-logging',
  '--no-zygote',
  '--single-process',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor,Translate',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--metrics-recording-only',
  '--js-flags=--max-old-space-size=96'
];

async function getChromium() {
  if (isVercel) {
    const chromiumMin = (await import('@sparticuz/chromium-min')).default;
    const playwrightCore = await import('playwright-core');
    const executablePath = await chromiumMin.executablePath(CHROMIUM_PACK_URL);
    return {
      launcher: playwrightCore.chromium,
      getArgs: () => [...chromiumMin.args, ...SERVERLESS_LAUNCH_ARGS],
      executablePath,
      tempDir: null
    };
  }
  const playwright = require('playwright');
  return {
    launcher: playwright.chromium,
    getArgs: () => ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'],
    executablePath: undefined,
    tempDir: null
  };
}

function rgbToHex(rgb) {
  const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function blendRgbaOverRgb(rgbaStr, bgRgbStr) {
  const m = rgbaStr.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
  if (!m) return rgbaStr;
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  const a = parseFloat(m[4]);
  if (a >= 1) return `rgb(${r},${g},${b})`;

  let bgR, bgG, bgB;
  const bgMatch = bgRgbStr.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (bgMatch) {
    bgR = parseInt(bgMatch[1]); bgG = parseInt(bgMatch[2]); bgB = parseInt(bgMatch[3]);
  } else if (bgRgbStr.startsWith('#')) {
    const hex = bgRgbStr.slice(1).replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const val = parseInt(hex, 16);
      bgR = (val >> 16) & 255;
      bgG = (val >> 8) & 255;
      bgB = val & 255;
    } else {
      return `rgb(${r},${g},${b})`;
    }
  } else {
    return `rgb(${r},${g},${b})`;
  }

  return `rgb(${Math.round(a * r + (1 - a) * bgR)},${Math.round(a * g + (1 - a) * bgG)},${Math.round(a * b + (1 - a) * bgB)})`;
}

async function applyServerlessOptimizations(context, page, options) {
  const { loadImages = false, blockFonts = true, blockMedia = true, disableJavaScript = false } = options;

  const blockedTypes = new Set();
  if (!loadImages) blockedTypes.add('image');
  if (blockFonts) blockedTypes.add('font');
  if (blockMedia) {
    blockedTypes.add('media');
    blockedTypes.add('imageset');
  }

  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (blockedTypes.has(type)) {
      return route.abort();
    }
    return route.continue();
  });

  if (disableJavaScript) {
    await context.setExtraHTTPHeaders({});
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'javaEnabled', () => () => false);
    });
  }

  await page.setDefaultNavigationTimeout(options.navigationTimeout || 8000);
}

async function runWcagOnPage(page) {
  const elements = await page.evaluate(() => {
    function getEffectiveBackground(el, maxDepth) {
      let current = el;
      for (let i = 0; i < maxDepth && current; i++) {
        const style = getComputedStyle(current);
        const bg = style.backgroundColor;
        const bgImage = style.backgroundImage;
        if (bgImage !== 'none') return 'skip';
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        current = current.parentElement;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    }

    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const tag = el.tagName.toLowerCase();
      if (tag === 'style' || tag === 'script' || tag === 'noscript') continue;
      const style = getComputedStyle(el);
      // Skip visually hidden elements (sr-only pattern)
      if (style.position === 'absolute') {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1 && rect.height <= 1) continue;
        if (style.overflow === 'hidden' && rect.width === 0 && rect.height === 0) continue;
      }
      const text = el.textContent.trim();
      if (!text || el.children.length > 0) continue;
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
      const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : '';
      const bg = getEffectiveBackground(el, 10);
      if (bg === 'skip') continue;
      const lh = parseFloat(style.lineHeight);
      results.push({
        selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls,
        text: text.slice(0, 120),
        foreground: style.color,
        background: bg,
        fontSize,
        fontWeight,
        isLarge,
        fontFamily: style.fontFamily,
        lineHeight: isNaN(lh) ? 0 : lh,
        tagName: el.tagName.toLowerCase()
      });
    }
    return results;
  });

  const failures = [];
  for (const el of elements) {
    try {
      let fgColor = el.foreground;
      const bgColor = el.background;
      if (fgColor.includes('rgba')) {
        fgColor = blendRgbaOverRgb(fgColor, bgColor);
      }
      const fg = rgbToHex(fgColor);
      const bg = rgbToHex(bgColor);
      if (!fg.startsWith('#') || !bg.startsWith('#')) continue;
      const ratio = wcag.hex(fg, bg);
      const required = el.isLarge ? 3.0 : 4.5;
      if (ratio < required) {
        failures.push({
          selector: el.selector,
          text: el.text,
          foreground: fg,
          background: bg,
          contrastRatio: Math.round(ratio * 100) / 100,
          required,
          fontSize: el.fontSize,
          isLarge: el.isLarge
        });
      }
    } catch (_) {}
  }

  return {
    totalElements: elements.length,
    failures,
    passCount: elements.length - failures.length,
    failCount: failures.length,
    score: elements.length > 0
      ? Math.round((elements.length - failures.length) / elements.length * 1000) / 10
      : 100,
    _elements: elements
  };
}

function mergeWcagResults(results) {
  const seen = new Map();
  for (const r of results) {
    for (const f of r.wcag.failures) {
      const key = f.selector + '|' + f.foreground + '|' + f.background;
      if (!seen.has(key)) {
        seen.set(key, { ...f, viewports: [r.viewport] });
      } else {
        seen.get(key).viewports.push(r.viewport);
      }
    }
  }

  const mergedFailures = Array.from(seen.values());
  const totalElements = results.reduce((s, r) => s + r.wcag.totalElements, 0);
  const totalFailures = mergedFailures.length;
  const totalPass = totalElements - results.reduce((s, r) => s + r.wcag.failures.length, 0) + totalFailures;

  return {
    totalElements,
    failures: mergedFailures,
    passCount: totalPass,
    failCount: totalFailures,
    score: totalElements > 0
      ? Math.round((totalElements - totalFailures) / totalElements * 1000) / 10
      : 100
  };
}

async function runDesignPageChecks(page) {
  return page.evaluate(() => {
    const docWidth = document.body.scrollWidth;
    const viewWidth = window.innerWidth;
    const results = [];

    // Horizontal scroll check
    if (docWidth > viewWidth) {
      let selector = 'body';
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewWidth + 1 && rect.width > 10) {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? '#' + el.id : '';
          const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
          const clsStr = cls ? '.' + cls.trim().split(/\s+/).filter(Boolean).join('.') : '';
          selector = tag + id + clsStr;
          break;
        }
      }
      results.push({
        ruleId: 'horizontal-scroll',
        ruleName: 'No horizontal scroll at viewport width',
        category: 'spacing',
        selector,
        description: 'Page overflows horizontally by ' + (docWidth - viewWidth) + 'px at ' + viewWidth + 'px viewport width',
        severity: 'high',
        value: (docWidth - viewWidth) + 'px overflow',
        expected: '0px overflow'
      });
    }

    // Heading hierarchy check
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let prevLevel = 0;
    let h1Count = 0;
    for (const h of headings) {
      const level = parseInt(h.tagName[1]);
      if (level === 1) h1Count++;
      if (prevLevel > 0 && level > prevLevel + 1) {
        const tag = h.tagName.toLowerCase();
        const id = h.id ? '#' + h.id : '';
        const cls = typeof h.className === 'string' ? h.className : (h.getAttribute('class') || '');
        const clsStr = cls ? '.' + cls.trim().split(/\s+/).filter(Boolean).join('.') : '';
        results.push({
          ruleId: 'heading-hierarchy',
          ruleName: 'Heading hierarchy not skipped',
          category: 'typography',
          selector: tag + id + clsStr,
          description: 'Heading level skipped from h' + prevLevel + ' to h' + level + ' (' + (h.textContent || '').trim().slice(0, 40) + ')',
          severity: 'medium',
          value: 'h' + prevLevel + ' → h' + level,
          expected: 'no skipped levels'
        });
      }
      prevLevel = level;
    }
    if (h1Count === 0) {
      results.push({
        ruleId: 'heading-hierarchy',
        ruleName: 'Page should have one h1',
        category: 'typography',
        selector: 'body',
        description: 'No h1 element found on the page',
        severity: 'high',
        value: '0 h1 elements',
        expected: '1 h1 element'
      });
    } else if (h1Count > 1) {
      results.push({
        ruleId: 'heading-hierarchy',
        ruleName: 'Page should have exactly one h1',
        category: 'typography',
        selector: 'body',
        description: 'Multiple h1 elements found (' + h1Count + ')',
        severity: 'medium',
        value: h1Count + ' h1 elements',
        expected: '1 h1 element'
      });
    }

    return results;
  });
}

async function runA11yPageChecks(page) {
  return page.evaluate(() => {
    const results = [];

    // Missing alt text on images
    const imgs = document.querySelectorAll('img:not([role="presentation"])');
    for (const img of imgs) {
      const alt = img.getAttribute('alt');
      if (alt === null) {
        const tag = 'img' + (img.id ? '#' + img.id : '');
        results.push({
          ruleId: 'missing-alt',
          ruleName: 'Images require alt text',
          category: 'media',
          selector: tag,
          description: 'Image is missing alt attribute',
          severity: 'high',
          value: 'no alt attribute',
          expected: 'alt="..."'
        });
      } else if (alt.trim() === '') {
        const tag = 'img' + (img.id ? '#' + img.id : '');
        results.push({
          ruleId: 'missing-alt',
          ruleName: 'Images require alt text',
          category: 'media',
          selector: tag,
          description: 'Image has empty alt text',
          severity: 'medium',
          value: 'alt=""',
          expected: 'descriptive alt text or role="presentation"'
        });
      }
    }

    // Empty interactive elements (buttons, links)
    const buttons = document.querySelectorAll('button, a[href]');
    for (const el of buttons) {
      const text = (el.textContent || '').trim();
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledby = el.getAttribute('aria-labelledby');
      const hasAria = (ariaLabel && ariaLabel.trim()) || (ariaLabelledby && ariaLabelledby.trim());
      if (!text && !hasAria) {
        const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
        results.push({
          ruleId: 'empty-interactive',
          ruleName: 'Interactive elements must have accessible name',
          category: 'interactivity',
          selector: tag,
          description: el.tagName.toLowerCase() + ' has no text content or aria-label',
          severity: 'high',
          value: 'no accessible name',
          expected: 'text content or aria-label'
        });
      }
    }

    // Missing lang attribute on html
    const html = document.documentElement;
    const lang = html.getAttribute('lang');
    if (!lang || lang.trim() === '') {
      results.push({
        ruleId: 'missing-lang',
        ruleName: 'Page must have lang attribute',
        category: 'interactivity',
        selector: 'html',
        description: 'html element is missing lang attribute',
        severity: 'high',
        value: 'lang="' + (lang || '') + '"',
        expected: 'lang="en" or appropriate language code'
      });
    }

    // Form labels: check inputs, textareas, selects have accessible labels
    const formControls = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"]), textarea, select');
    for (const el of formControls) {
      const id = el.id;
      let hasLabel = false;
      if (id && document.querySelector('label[for="' + id.replace(/["\\]/g, '\\$&') + '"]')) hasLabel = true;
      if (el.getAttribute('aria-label') && el.getAttribute('aria-label').trim()) hasLabel = true;
      if (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))) hasLabel = true;
      if (el.getAttribute('title') && el.getAttribute('title').trim()) hasLabel = true;
      if (el.closest('label')) hasLabel = true;
      if (!hasLabel) {
        const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
        const type = el.type ? 'type="' + el.type + '" ' : '';
        results.push({
          ruleId: 'missing-label',
          ruleName: 'Form controls must have associated label',
          category: 'interactivity',
          selector: tag,
          description: el.tagName.toLowerCase() + ' ' + (el.id ? '#' + el.id : '(no id)') + ' missing accessible label',
          severity: 'high',
          value: 'no label',
          expected: 'label element, aria-label, aria-labelledby, or title'
        });
      }
    }

    // Skip navigation / main landmark check
    const hasMain = document.querySelector('[role="main"], #main, #content, #main-content, main');
    if (!hasMain) {
      let hasSkipLink = false;
      const links = document.querySelectorAll('a[href^="#"]');
      for (const link of links) {
        const text = (link.textContent || '').toLowerCase();
        if (text.includes('skip') || text.includes('main') || text.includes('content') || text.includes('navigation')) {
          hasSkipLink = true;
          break;
        }
      }
      if (!hasSkipLink) {
        results.push({
          ruleId: 'skip-navigation',
          ruleName: 'Page should have skip navigation or main landmark',
          category: 'interactivity',
          selector: 'body',
          description: 'No skip link or main landmark found',
          severity: 'high',
          value: 'no skip link or role="main"',
          expected: 'a skip link with href="#main" or role="main" on content area'
        });
      }
    }

    return results;
  });
}

async function waitForLayout(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => setTimeout(resolve, 200));
  }));
}

async function audit(url, options = {}) {
  const {
    viewport = isVercel ? DEFAULT_VIEWPORT : { width: 1280, height: 800 },
    viewports,
    outputDir = defaultOutputDir,
    label = 'audit',
    wcag: doWcag = false,
    design: doDesign = false,
    timeout = 30000,
    waitUntil = isVercel ? 'domcontentloaded' : 'networkidle',
    loadImages = false,
    blockFonts = true,
    blockMedia = true,
    disableJavaScript = false,
    navigationTimeout = 8000
  } = options;

  const vps = viewports && viewports.length > 0
    ? [...viewports].sort((a, b) => b.width - a.width)
    : [viewport];

  const absOutput = path.resolve(outputDir);
  fs.mkdirSync(absOutput, { recursive: true });
  const timestamp = Date.now();
  const filename = `${label}-${timestamp}.png`;
  const filepath = path.join(absOutput, filename);

  const { launcher, getArgs, executablePath: chromePath, tempDir: chromeTempDir } = await getChromium();

  let browser;
  let lastLaunchErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      browser = await launcher.launch({
        args: getArgs(),
        executablePath: chromePath,
        headless: true
      });
      break;
    } catch (err) {
      lastLaunchErr = err;
      if (err?.message?.includes?.('ETXTBSY') || err?.message?.includes?.('EBUSY')) {
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      throw err;
    }
  }
  if (!browser) throw lastLaunchErr;
  let timedOut = false;
  let timeoutHandle;
  const hardTimeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      reject(new Error('Audit exceeded hard timeout'));
    }, timeout);
  });

  try {
    const auditWork = (async () => {
      const context = await browser.newContext({ viewport: vps[0] });
      const page = await context.newPage();

      if (isVercel) {
        await applyServerlessOptimizations(context, page, {
          loadImages,
          blockFonts,
          blockMedia,
          disableJavaScript,
          navigationTimeout
        });
      }

      await page.goto(url, { waitUntil, timeout: navigationTimeout });
      await page.waitForSelector('body', { timeout: 2000 }).catch(() => {});

      const viewportResults = [];
      let lastElements = [];
      const pageLevelFailures = [];
      for (let i = 0; i < vps.length; i++) {
        const vp = vps[i];
        if (i > 0) {
          await page.setViewportSize(vp);
          await waitForLayout(page);
        }
        if (doWcag || doDesign) {
          const result = await runWcagOnPage(page);
          if (doWcag) viewportResults.push({ viewport: vp, wcag: result });
          if (result._elements) lastElements = result._elements;
        }
        if (doDesign) {
          const pageFails = await runDesignPageChecks(page);
          pageLevelFailures.push(...pageFails);
          const a11yFails = await runA11yPageChecks(page);
          pageLevelFailures.push(...a11yFails);
        }
      }

      let mergedWcag = null;
      if (doWcag && viewportResults.length > 0) {
        mergedWcag = mergeWcagResults(viewportResults);
      }

      let designResult = null;
      if (doDesign) {
        const allFailures = [...pageLevelFailures];
        if (lastElements.length > 0) {
          try {
            const engine = await import('@liveviewer/engine');
            const elementResult = engine.analyzeDesign(lastElements);
            allFailures.push(...elementResult.failures);
            designResult = {
              failures: allFailures,
              totalChecks: elementResult.totalChecks + (pageLevelFailures.length > 0 ? 1 : 0),
              passCount: elementResult.passCount,
              failCount: allFailures.length,
              score: Math.round((elementResult.totalChecks - elementResult.failures.length + (pageLevelFailures.length > 0 ? 0 : 1)) / (elementResult.totalChecks + 1) * 1000) / 10
            };
          } catch (_) {}
        } else if (pageLevelFailures.length > 0) {
          designResult = {
            failures: pageLevelFailures,
            totalChecks: 1,
            passCount: 0,
            failCount: pageLevelFailures.length,
            score: 0
          };
        }
      }

      const screenshotPromise = page.screenshot({ path: filepath, fullPage: false });
      await screenshotPromise;
      await context.close();
      return { viewportResults, mergedWcag, designResult };
    })();

    const { viewportResults, mergedWcag, designResult } = await Promise.race([auditWork, hardTimeout]);
    return {
      filepath, filename, timestamp, url,
      viewport: vps[0],
      viewports: viewportResults,
      wcag: mergedWcag,
      design: designResult,
      timedOut: false
    };
  } catch (err) {
    if (timedOut) {
      try { fs.unlinkSync(filepath); } catch (_) {}
      throw new Error('Audit timeout: page too large or slow. Try the browser extension for this URL.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
    await browser?.close().catch(() => {});
    if (chromeTempDir) {
      fs.rmSync(chromeTempDir, { recursive: true, force: true });
    }
  }
}

module.exports = { audit, isVercel, CHROMIUM_VERSION };
