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

function blendOpacity(fgRgbStr, bgRgbStr, opacity) {
  if (opacity >= 1) return fgRgbStr;
  const m = fgRgbStr.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (!m) return fgRgbStr;
  const [r, g, b] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  let bgR, bgG, bgB;
  const bgMatch = bgRgbStr.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (bgMatch) {
    bgR = parseInt(bgMatch[1]); bgG = parseInt(bgMatch[2]); bgB = parseInt(bgMatch[3]);
  } else if (bgRgbStr.startsWith('#')) {
    const hex = bgRgbStr.slice(1);
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const val = parseInt(hex, 16);
      bgR = (val >> 16) & 255; bgG = (val >> 8) & 255; bgB = val & 255;
    } else { return fgRgbStr; }
  } else { return fgRgbStr; }
  const blend = (fg, bg) => Math.round(opacity * fg + (1 - opacity) * bg);
  return `rgb(${blend(r, bgR)},${blend(g, bgG)},${blend(b, bgB)})`;
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
      const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
      const normalized = htmlBg.replace(/\s/g, '');
      return (normalized === 'rgba(0,0,0,0)' || normalized === 'transparent') ? 'rgb(255,255,255)' : htmlBg;
    }

    const results = [];

    function processElement(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'style' || tag === 'script' || tag === 'noscript') return;
      const style = getComputedStyle(el);

      // Skip hidden elements
      if (style.display === 'none') return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      if (tag === 'svg') return;
      if (tag === 'text') return;

      // Skip disabled elements
      if (el.disabled) return;
      if (el.getAttribute('aria-disabled') === 'true') return;
      let dParent = el.parentElement;
      let hasDisabledAncestor = false;
      while (dParent) {
        if (dParent.tagName === 'FIELDSET' && dParent.disabled) { hasDisabledAncestor = true; break; }
        if (dParent.tagName === 'BODY') break;
        dParent = dParent.parentElement;
      }
      if (hasDisabledAncestor) return;

      // Skip off-screen positioned elements (outside viewport, not scrollable into view)
      const rect = el.getBoundingClientRect();
      if ((style.position === 'absolute' || style.position === 'fixed') &&
          (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth)) return;

      // Skip visually hidden elements (sr-only with zero dimensions)
      if (style.position === 'absolute' && style.overflow === 'hidden' && rect.width === 0 && rect.height === 0) return;

      // Recurse into open shadow DOM (before text/content check — host element may have empty textContent)
      if (el.shadowRoot && el.shadowRoot.mode === 'open') {
        traverseRoot(el.shadowRoot);
      }

      const text = el.textContent.trim();
      if (!text || el.children.length > 0) return;
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
      const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : '';
      const bg = getEffectiveBackground(el, 10);
      if (bg === 'skip') return;
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
        tagName: el.tagName.toLowerCase(),
        opacity: parseFloat(style.opacity)
      });
    }

    function traverseRoot(root) {
      let foundElements = false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
      while (walker.nextNode()) {
        processElement(walker.currentNode);
        foundElements = true;
      }
      // Handle direct text nodes in shadow root (no element wrapper)
      if (!foundElements && root.nodeType === 11) {
        const text = root.textContent.trim();
        if (text) {
          const host = root.host;
          const hostStyle = getComputedStyle(host);
          const bg = getEffectiveBackground(host, 10);
          if (bg !== 'skip') {
            const fontSize = parseFloat(hostStyle.fontSize);
            const fontWeight = parseInt(hostStyle.fontWeight);
            results.push({
              selector: host.tagName.toLowerCase() + (host.id ? '#' + host.id : '') + '::shadow',
              text: text.slice(0, 120),
              foreground: hostStyle.color,
              background: bg,
              fontSize,
              fontWeight,
              isLarge: fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700),
              fontFamily: hostStyle.fontFamily,
              lineHeight: parseFloat(hostStyle.lineHeight) || 0,
              tagName: host.tagName.toLowerCase(),
              opacity: parseFloat(hostStyle.opacity)
            });
          }
        }
      }
    }

    traverseRoot(document.body);
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
      if (typeof el.opacity === 'number' && el.opacity < 1) {
        fgColor = blendOpacity(fgColor, bgColor, el.opacity);
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

    // Typography: font-size and line-height checks
    const BODY_TAGS = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'figcaption', 'label', 'span', 'a', 'button', 'div']);
    const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */, null, false);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!el) continue;
      const tag = el.tagName.toLowerCase();
      if (!BODY_TAGS.has(tag)) continue;
      const text = el.textContent.trim();
      if (!text || el.children.length > 0) continue;
      const style = getComputedStyle(el);
      // Skip visually hidden elements (sr-only pattern)
      if (style.position === 'absolute') {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1 && rect.height <= 1) continue;
        if (style.overflow === 'hidden' && rect.width === 0 && rect.height === 0) continue;
      }
      const fontSize = parseFloat(style.fontSize);
      if (isNaN(fontSize) || fontSize === 0) continue;
      const fontWeight = parseInt(style.fontWeight);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
      const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : '';
      const sel = tag + (el.id ? '#' + el.id : '') + cls;

      if (fontSize < 16 && !isLarge) {
        results.push({
          ruleId: 'font-size-legible',
          ruleName: 'Body text minimum 16px',
          category: 'typography',
          selector: sel,
          description: 'Text "' + text.slice(0, 40) + '" has font-size ' + fontSize + 'px; minimum for legible body text is 16px',
          severity: fontSize < 12 ? 'high' : 'medium',
          value: fontSize + 'px',
          expected: '\u2265 16px'
        });
      }

      const lh = parseFloat(style.lineHeight);
      if (!isNaN(lh) && lh > 0) {
        const ratio = lh / fontSize;
        if (ratio < 1.4 || ratio > 1.6) {
          results.push({
            ruleId: 'line-height-readable',
            ruleName: 'Line height between 1.4 and 1.6',
            category: 'typography',
            selector: sel,
            description: '"' + text.slice(0, 40) + '" has line-height ' + ratio.toFixed(2) + ' (' + lh + 'px at ' + fontSize + 'px font)',
            severity: ratio < 1.2 || ratio > 2 ? 'high' : 'medium',
            value: ratio.toFixed(2),
            expected: '1.4\u20131.6'
          });
        }
      }
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
    // Only flag when there is navigational content (nav element) but no skip link and no main landmark.
    // This matches axe-core's bypass rule behavior: simple pages without navigation are not flagged.
    const hasMain = document.querySelector('[role="main"], #main, #content, #main-content, main');
    const hasNav = document.querySelector('nav, [role="navigation"]');
    if (!hasMain && hasNav) {
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
          description: 'No skip link or main landmark found on page with navigation',
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
    waitUntil = 'domcontentloaded',
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

  const MAX_AUDIT_RETRIES = 1;

  for (let attempt = 1; attempt <= MAX_AUDIT_RETRIES + 1; attempt++) {
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
        await page.waitForSelector('h1, main, [role="main"]', { timeout: 5000 }).catch(() => {});

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
          const seen = new Set();
          for (const f of allFailures) {
            seen.add(f.selector + '|' + f.ruleId);
          }
          if (lastElements.length > 0) {
            try {
              const engine = await import('@liveviewer/engine');
              const elementResult = engine.analyzeDesign(lastElements);
              for (const f of elementResult.failures) {
                const key = f.selector + '|' + f.ruleId;
                if (!seen.has(key)) {
                  seen.add(key);
                  allFailures.push(f);
                }
              }
              const totalChecks = elementResult.totalChecks + pageLevelFailures.length;
              const failCount = allFailures.length;
              designResult = {
                failures: allFailures,
                totalChecks,
                passCount: Math.max(0, totalChecks - failCount),
                failCount,
                score: totalChecks > 0
                  ? Math.round(Math.max(0, totalChecks - failCount) / totalChecks * 1000) / 10
                  : 0
              };
            } catch (_) {
              if (pageLevelFailures.length > 0) {
                designResult = {
                  failures: pageLevelFailures,
                  totalChecks: pageLevelFailures.length,
                  passCount: 0,
                  failCount: pageLevelFailures.length,
                  score: 0
                };
              }
            }
          } else if (pageLevelFailures.length > 0) {
            designResult = {
              failures: pageLevelFailures,
              totalChecks: pageLevelFailures.length,
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
      clearTimeout(timeoutHandle);
      if (timedOut) {
        try { fs.unlinkSync(filepath); } catch (_) {}
        throw new Error('Audit timeout: page too large or slow. Try the CLI: npm install -g @liveviewer/cli');
      }
      const isClosed = err.message?.includes?.('Target page, context or browser has been closed')
        || err.message?.includes?.('browser has been closed');
      if (isClosed && attempt <= MAX_AUDIT_RETRIES) {
        console.warn('Browser closed unexpectedly, retrying...');
        await browser?.close().catch(() => {});
        browser = await launcher.launch({
          args: getArgs(),
          executablePath: chromePath,
          headless: true
        });
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

module.exports = { audit, getChromium, isVercel, CHROMIUM_VERSION };
