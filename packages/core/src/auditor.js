const path = require('path');
const fs = require('fs');
const os = require('os');
const wcag = require('wcag-contrast');
const { checkHeadingHierarchy } = require('./heading');
const { runSecurityChecks } = require('./security');
const { runLegalChecks } = require('./legal');

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
    function parseRgb(rgbStr) {
      var m = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    }

    function parseLinearGradient(bgImage) {
      var m = bgImage.match(/linear-gradient\s*\(([^)]+)\)/i);
      if (!m) return null;
      var inner = m[1];
      var stops = [];
      var i = 0, parenDepth = 0, current = '';
      var chars = inner.split('');
      for (var ci = 0; ci < chars.length; ci++) {
        var ch = chars[ci];
        if (ch === '(') { parenDepth++; current += ch; }
        else if (ch === ')') { parenDepth--; current += ch; }
        else if (ch === ',' && parenDepth === 0) {
          stops.push(current.trim());
          current = '';
        } else { current += ch; }
      }
      if (current.trim()) stops.push(current.trim());
      if (stops.length === 0) return null;
      var first = stops[0].trim().toLowerCase();
      if (first === 'to bottom' || first === 'to top' || first === 'to left' || first === 'to right' ||
          first.indexOf('deg') !== -1 || first.indexOf('turn') !== -1 || first.indexOf('rad') !== -1 ||
          first === 'to bottom left' || first === 'to bottom right' || first === 'to top left' || first === 'to top right') {
        stops.shift();
      }
      if (stops.length === 0) return null;
      var rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (var si = 0; si < stops.length; si++) {
        var colorPart = stops[si].replace(/\s+\d+%$/, '').replace(/\s+\d+px$/, '').trim();
        var parsed = parseRgb(colorPart);
        if (!parsed) {
          var temp = document.createElement('div');
          temp.style.color = colorPart;
          document.body.appendChild(temp);
          var computed = getComputedStyle(temp).color;
          document.body.removeChild(temp);
          parsed = parseRgb(computed);
        }
        if (parsed) { rSum += parsed.r; gSum += parsed.g; bSum += parsed.b; count++; }
      }
      if (count === 0) return null;
      return 'rgb(' + Math.round(rSum / count) + ',' + Math.round(gSum / count) + ',' + Math.round(bSum / count) + ')';
    }

    function parseTextShadowValue(ts) {
      // Extract color from text-shadow shorthand using the browser's own parser
      var temp = document.createElement('div');
      temp.style.textShadow = ts;
      document.body.appendChild(temp);
      var computed = getComputedStyle(temp).textShadow;
      document.body.removeChild(temp);
      // computed textShadow is normalized: "rgb(r,g,b) offset-x offset-y blur-radius"
      var m = computed.match(/^(rgba?\([^)]+\))/);
      if (m) {
        var parsed = parseRgb(m[1]);
        if (parsed) return parsed;
      }
      return null;
    }

    function getEffectiveBackground(el, maxDepth) {
      let bg = null;
      let current = el;
      for (let i = 0; i < maxDepth && current; i++) {
        const style = getComputedStyle(current);
        const bgColor = style.backgroundColor;
        const bgImage = style.backgroundImage;
        if (bgImage !== 'none') {
          // Try to parse gradient
          const gradColor = parseLinearGradient(bgImage);
          if (gradColor) {
            bg = gradColor;
            break;
          }
          return 'skip';
        }
        if (bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          bg = bgColor;
          break;
        }
        current = current.parentElement;
      }
      if (!bg) {
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
        const normalized = htmlBg.replace(/\s/g, '');
        bg = (normalized === 'rgba(0,0,0,0)' || normalized === 'transparent') ? 'rgb(255,255,255)' : htmlBg;
      }
      return bg;
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

      // Skip if this element is an aria-labelledby target for a disabled element
      var elId = el.id;
      if (elId) {
        var refs = document.querySelectorAll('[aria-labelledby="' + elId.replace(/["\\]/g, '\\$&') + '"]');
        for (var ri = 0; ri < refs.length; ri++) {
          if (refs[ri].disabled || refs[ri].getAttribute('aria-disabled') === 'true') return;
        }
      }

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

      var directText = '';
      for (var cn = el.firstChild; cn; cn = cn.nextSibling) {
        if (cn.nodeType === 3) directText += cn.textContent;
      }
      const text = directText.trim();
      if (!text) return;

      // Skip single-char interactive elements (non-human-language exception, WCAG SC 1.4.3)
      if (text.length <= 1 && ['button', 'a', 'input', 'select', 'textarea'].includes(tag)) return;

      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
      const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
      const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : '';
      let bg = getEffectiveBackground(el, 10);

      // Handle text-shadow: use as fallback for bg images, or blend with solid background
      var ts = style.textShadow;
      var shadowFallback = (ts && ts !== 'none') ? parseTextShadowValue(ts) : null;

      if (bg === 'skip') {
        if (shadowFallback) {
          bg = 'rgb(' + shadowFallback.r + ',' + shadowFallback.g + ',' + shadowFallback.b + ')';
        } else if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
          bg = style.backgroundColor;
        } else {
          return;
        }
      } else if (shadowFallback) {
        bg = 'rgb(' + Math.round(shadowFallback.r * 0.5 + parseRgb(bg).r * 0.5) + ',' +
          Math.round(shadowFallback.g * 0.5 + parseRgb(bg).g * 0.5) + ',' +
          Math.round(shadowFallback.b * 0.5 + parseRgb(bg).b * 0.5) + ')';
      }

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
      // Handle <slot> elements: process assigned (slotted) nodes from light DOM
      var slots = root.querySelectorAll('slot');
      for (var si2 = 0; si2 < slots.length; si2++) {
        var assigned = slots[si2].assignedNodes();
        for (var ai = 0; ai < assigned.length; ai++) {
          if (assigned[ai].nodeType === 1) processElement(assigned[ai]);
        }
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
  return page.evaluate((fnSrc) => {
    var checkHeadingHierarchy = eval('(' + fnSrc + ')');
    var docWidth = document.body.scrollWidth;
    var viewWidth = window.innerWidth;
    var results = [];

    // Horizontal scroll check
    if (docWidth > viewWidth) {
      var selector = 'body';
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var rect = el.getBoundingClientRect();
        if (rect.right > viewWidth + 1 && rect.width > 10) {
          var tag = el.tagName.toLowerCase();
          var id = el.id ? '#' + el.id : '';
          var cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
          var clsStr = cls ? '.' + cls.trim().split(/\s+/).filter(Boolean).join('.') : '';
          selector = tag + id + clsStr;
          break;
        }
      }
      results.push({
        ruleId: 'horizontal-scroll',
        ruleName: 'No horizontal scroll at viewport width',
        category: 'spacing',
        selector: selector,
        description: 'Page overflows horizontally by ' + (docWidth - viewWidth) + 'px at ' + viewWidth + 'px viewport width',
        severity: 'high',
        value: (docWidth - viewWidth) + 'px overflow',
        expected: '0px overflow'
      });
    }

    // Heading hierarchy check (shared with SEO)
    results.push.apply(results, checkHeadingHierarchy('typography'));

    // Typography: font-size and line-height checks
    const BODY_TAGS = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'figcaption', 'label', 'span', 'a', 'button', 'div']);
    const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */, null, false);
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!el) continue;
      const tag = el.tagName.toLowerCase();
      if (!BODY_TAGS.has(tag)) continue;
      const text = walker.currentNode.textContent.trim();
      if (!text) continue;
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
  }, checkHeadingHierarchy.toString());
}

async function runSeoPageChecks(page) {
  return page.evaluate((fnSrc) => {
    var checkHeadingHierarchy = eval('(' + fnSrc + ')');
    var results = [];

    // 1. Title tag
    var titleEl = document.querySelector('title');
    var titleText = titleEl ? (titleEl.textContent || '').trim() : '';
    if (!titleEl || !titleText) {
      results.push({
        ruleId: 'missing-title',
        ruleName: 'Page must have a title tag',
        category: 'seo',
        selector: 'head',
        description: 'No <title> tag found on the page',
        severity: 'high',
        value: 'no title tag',
        expected: '<title> tag with 10\u201370 characters'
      });
    } else if (titleText.length < 10) {
      results.push({
        ruleId: 'missing-title',
        ruleName: 'Title tag is too short',
        category: 'seo',
        selector: 'title',
        description: 'Title is ' + titleText.length + ' characters; minimum recommended is 10',
        severity: 'medium',
        value: titleText.length + ' chars',
        expected: '\u2265 10 chars'
      });
    } else if (titleText.length > 70) {
      results.push({
        ruleId: 'missing-title',
        ruleName: 'Title tag is too long',
        category: 'seo',
        selector: 'title',
        description: 'Title is ' + titleText.length + ' characters; maximum recommended is 70',
        severity: 'medium',
        value: titleText.length + ' chars',
        expected: '\u2264 70 chars'
      });
    }

    // 2. Meta description
    var metaDesc = document.querySelector('meta[name="description"]');
    var descContent = metaDesc ? (metaDesc.getAttribute('content') || '').trim() : '';
    if (!metaDesc || !descContent) {
      results.push({
        ruleId: 'missing-meta-description',
        ruleName: 'Page must have a meta description',
        category: 'seo',
        selector: 'head',
        description: 'No meta description found on the page',
        severity: 'high',
        value: 'no meta description',
        expected: '<meta name="description"> with 50\u2013160 characters'
      });
    } else if (descContent.length < 50) {
      results.push({
        ruleId: 'missing-meta-description',
        ruleName: 'Meta description is too short',
        category: 'seo',
        selector: 'meta[name="description"]',
        description: 'Description is ' + descContent.length + ' characters; minimum recommended is 50',
        severity: 'medium',
        value: descContent.length + ' chars',
        expected: '\u2265 50 chars'
      });
    } else if (descContent.length > 160) {
      results.push({
        ruleId: 'missing-meta-description',
        ruleName: 'Meta description is too long',
        category: 'seo',
        selector: 'meta[name="description"]',
        description: 'Description is ' + descContent.length + ' characters; maximum recommended is 160',
        severity: 'medium',
        value: descContent.length + ' chars',
        expected: '\u2264 160 chars'
      });
    }

    // 3. Canonical link
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      results.push({
        ruleId: 'missing-canonical',
        ruleName: 'Page should have a canonical URL',
        category: 'seo',
        selector: 'head',
        description: 'No <link rel="canonical"> found on the page',
        severity: 'medium',
        value: 'no canonical tag',
        expected: '<link rel="canonical" href="...">'
      });
    }

    // 4. JSON-LD structured data
    var jsonld = document.querySelector('script[type="application/ld+json"]');
    if (!jsonld) {
      results.push({
        ruleId: 'missing-jsonld',
        ruleName: 'Page should have JSON-LD structured data',
        category: 'seo',
        selector: 'head',
        description: 'No <script type="application/ld+json"> found on the page',
        severity: 'low',
        value: 'no JSON-LD',
        expected: '<script type="application/ld+json">{...}</script>'
      });
    }

    // 5. Viewport meta
    var viewportMeta = document.querySelector('meta[name="viewport"]');
    var vpContent = viewportMeta ? (viewportMeta.getAttribute('content') || '') : '';
    if (!viewportMeta || vpContent.indexOf('width=device-width') === -1) {
      results.push({
        ruleId: 'missing-viewport',
        ruleName: 'Page must have a viewport meta tag',
        category: 'seo',
        selector: 'head',
        description: !viewportMeta
          ? 'No <meta name="viewport"> found on the page'
          : 'Viewport meta does not contain width=device-width',
        severity: 'high',
        value: !viewportMeta ? 'no viewport meta' : vpContent,
        expected: '<meta name="viewport" content="width=device-width, initial-scale=1">'
      });
    }

    // 6. Robots meta (informational)
    var robotsMeta = document.querySelector('meta[name="robots"]');
    var robotsContent = robotsMeta ? (robotsMeta.getAttribute('content') || '') : '';
    if (robotsContent.indexOf('noindex') !== -1 || robotsContent.indexOf('nofollow') !== -1) {
      results.push({
        ruleId: 'robots-blocked',
        ruleName: 'Robots meta blocks indexing',
        category: 'seo',
        selector: 'meta[name="robots"]',
        description: 'Robots meta contains blocking directives: "' + robotsContent + '"',
        severity: 'low',
        value: robotsContent,
        expected: 'index,follow (allow indexing)'
      });
    }

    // 7. Open Graph tags
    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    var ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogTitle || !ogDesc || !ogImage) {
      var missing = [];
      if (!ogTitle) missing.push('og:title');
      if (!ogDesc) missing.push('og:description');
      if (!ogImage) missing.push('og:image');
      results.push({
        ruleId: 'missing-open-graph',
        ruleName: 'Page should have Open Graph tags',
        category: 'seo',
        selector: 'head',
        description: 'Missing Open Graph tags: ' + missing.join(', '),
        severity: 'medium',
        value: 'missing: ' + missing.join(', '),
        expected: 'og:title, og:description, og:image'
      });
    }

    // 8. Twitter Card tags
    var twCard = document.querySelector('meta[name="twitter:card"]');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    var twDesc = document.querySelector('meta[name="twitter:description"]');
    if (!twCard || !twTitle || !twDesc) {
      var twMissing = [];
      if (!twCard) twMissing.push('twitter:card');
      if (!twTitle) twMissing.push('twitter:title');
      if (!twDesc) twMissing.push('twitter:description');
      results.push({
        ruleId: 'twitter-card-missing',
        ruleName: 'Page should have Twitter Card tags',
        category: 'seo',
        selector: 'head',
        description: 'Missing Twitter Card tags: ' + twMissing.join(', '),
        severity: 'medium',
        value: 'missing: ' + twMissing.join(', '),
        expected: 'twitter:card, twitter:title, twitter:description'
      });
    }

    // 9. Heading hierarchy (shared with design)
    results.push.apply(results, checkHeadingHierarchy('seo'));

    return results;
  }, checkHeadingHierarchy.toString());
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
    // Only flag when the page has a <nav> (repeated content block), no main landmark,
    // no skip link, and few additional landmarks. axe-core considers landmark navigation
    // a sufficient bypass mechanism, so pages with multiple landmarks aren't flagged even
    // without an explicit skip link.
    const hasMain = document.querySelector('[role="main"], #main, #content, #main-content, main');
    const hasNav = document.querySelector('nav, [role="navigation"]');
    if (!hasMain && hasNav) {
      const extraLandmarks = document.querySelectorAll(
        'header, aside, section, footer, article, ' +
        '[role="complementary"], [role="banner"], [role="contentinfo"]'
      ).length;
      if (extraLandmarks < 2) {
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
    }

    return results;
  });
}

async function waitForLayout(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => setTimeout(resolve, 200));
  }));
}

async function waitForStableDOM(page, stableTimeout = 3000) {
  await page.evaluate(async (timeout) => {
    await new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => { observer.disconnect(); resolve(); }, 300);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });
      timer = setTimeout(() => { observer.disconnect(); resolve(); }, timeout);
    });
  }, stableTimeout).catch(() => {});
}

async function audit(url, options = {}) {
  const {
    viewport = isVercel ? DEFAULT_VIEWPORT : { width: 1280, height: 800 },
    viewports,
    outputDir = defaultOutputDir,
    label = 'audit',
    wcag: doWcag = false,
    design: doDesign = false,
    seo: doSeo = false,
    security: doSecurity = false,
    legal: doLegal = false,
    performance: doPerformance = false,
    timeout = 30000,
    waitUntil = 'domcontentloaded',
    loadImages = true,
    blockFonts = false,
    blockMedia = true,
    disableJavaScript = false,
    navigationTimeout = 8000,
    waitStable = false
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

        const mainResponse = await page.goto(url, { waitUntil, timeout: navigationTimeout });
        const responseHeaders = mainResponse ? mainResponse.headers() : {};
        await page.waitForSelector('body', { timeout: 2000 }).catch(() => {});
        await page.waitForSelector('h1, main, [role="main"]', { timeout: 5000 }).catch(() => {});
        if (waitStable) await waitForStableDOM(page);

        const viewportResults = [];
        let lastElements = [];
        const pageLevelFailures = [];
        let seoFailures = [];
        for (let i = 0; i < vps.length; i++) {
          const vp = vps[i];
          if (i > 0) {
            await page.setViewportSize(vp);
            await waitForLayout(page);
          }
          if (doWcag || doDesign) {
            const result = await runWcagOnPage(page);
            if (doWcag) viewportResults.push({ viewport: vp, wcag: result });
            if (result._elements) {
              const seen = new Set((lastElements || []).map(e => e.selector));
              for (const el of result._elements) {
                if (!seen.has(el.selector)) {
                  seen.add(el.selector);
                  lastElements.push(el);
                }
              }
            }
          }
          if (doDesign) {
            const pageFails = await runDesignPageChecks(page);
            pageLevelFailures.push(...pageFails);
            const a11yFails = await runA11yPageChecks(page);
            pageLevelFailures.push(...a11yFails);
          }
          if (doSeo) {
            const result = await runSeoPageChecks(page);
            seoFailures.push(...result);
          }
        }

        let mergedWcag = null;
        if (doWcag && viewportResults.length > 0) {
          mergedWcag = mergeWcagResults(viewportResults);
        }

        let designResult = null;
        let seoResult = null;
        let securityResult = null;
        if (doSeo) {
          const seen = new Set();
          const unique = [];
          for (const f of seoFailures) {
            const key = f.selector + '|' + f.ruleId;
            if (!seen.has(key)) { seen.add(key); unique.push(f); }
          }
          const seoTotalChecks = 9;
          const seoFailCount = unique.length;
          seoResult = {
            failures: unique,
            totalChecks: seoTotalChecks,
            passCount: Math.max(0, seoTotalChecks - seoFailCount),
            failCount: seoFailCount,
            score: seoTotalChecks > 0
              ? Math.round(Math.max(0, seoTotalChecks - seoFailCount) / seoTotalChecks * 1000) / 10
              : 100
          };
        }
        if (doDesign) {
          // Deduplicate page-level failures across viewports
          const seen = new Set();
          const uniquePageFails = [];
          for (const f of pageLevelFailures) {
            const key = f.selector + '|' + f.ruleId;
            if (!seen.has(key)) {
              seen.add(key);
              uniquePageFails.push(f);
            }
          }
          const allFailures = [...uniquePageFails];
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
              const totalChecks = elementResult.totalChecks + uniquePageFails.length;
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
              const totalChecks = lastElements.length * 2 + uniquePageFails.length;
              const failCount = allFailures.length;
              designResult = {
                failures: allFailures,
                totalChecks,
                passCount: Math.max(0, totalChecks - failCount),
                failCount,
                score: totalChecks > 0
                  ? Math.round(Math.max(0, totalChecks - failCount) / totalChecks * 1000) / 10
                  : uniquePageFails.length > 0 ? 0 : 100
              };
            }
          } else if (uniquePageFails.length > 0) {
            designResult = {
              failures: uniquePageFails,
              totalChecks: uniquePageFails.length,
              passCount: 0,
              failCount: uniquePageFails.length,
              score: 0
            };
          }
        }

        if (doSecurity) {
          var securityFails = await runSecurityChecks(page, context, url, responseHeaders);
          var securityTotalChecks = 9;
          var securityFailCount = securityFails.length;
          securityResult = {
            failures: securityFails,
            totalChecks: securityTotalChecks,
            passCount: Math.max(0, securityTotalChecks - securityFailCount),
            failCount: securityFailCount,
            score: securityTotalChecks > 0
              ? Math.round(Math.max(0, securityTotalChecks - securityFailCount) / securityTotalChecks * 1000) / 10
              : 100
          };
        }

        var legalResult = null;
        if (doLegal) {
          try {
            var legalResultData = await runLegalChecks(page);
            var legalFails = legalResultData.failures;
            var legalTotal = legalResultData.totalChecks;
            var legalFailCount = legalFails.length;
            legalResult = {
              failures: legalFails,
              totalChecks: legalTotal,
              passCount: Math.max(0, legalTotal - legalFailCount),
              failCount: legalFailCount,
              score: legalTotal > 0
                ? Math.round(Math.max(0, legalTotal - legalFailCount) / legalTotal * 1000) / 10
                : 100
            };
          } catch (e) {
            legalResult = { failures: [], totalChecks: 0, passCount: 0, failCount: 0, score: 100 };
          }
        }

        const screenshotPromise = page.screenshot({ path: filepath, fullPage: false });
        await screenshotPromise;
        await context.close();

        var perfResult = null;
        if (doPerformance) {
          try {
            var { runPerformanceChecks } = require('./performance');
            perfResult = await runPerformanceChecks(url, chromePath);
          } catch (e) {
            perfResult = { error: e.message, score: null, lcp: null, cls: null, tbt: null, fcp: null, speedIndex: null, tti: null, grade: null, recommendations: [] };
          }
        }

        return { viewportResults, mergedWcag, designResult, seo: seoResult, security: securityResult, legal: legalResult, performance: perfResult };
      })();

      const { viewportResults, mergedWcag, designResult, seo: seoResult, security: securityResult, legal: legalResult, performance: perfResult } = await Promise.race([auditWork, hardTimeout]);
      return {
        filepath, filename, timestamp, url,
        viewport: vps[0],
        viewports: viewportResults,
        wcag: mergedWcag,
        design: designResult,
        seo: seoResult,
        security: securityResult,
        legal: legalResult,
        performance: perfResult,
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

module.exports = { audit, getChromium, isVercel, CHROMIUM_VERSION, runSeoPageChecks, runSecurityChecks, runPerformanceChecks: require('./performance').runPerformanceChecks };
