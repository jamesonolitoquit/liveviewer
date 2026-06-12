const path = require('path');
const fs = require('fs');
const os = require('os');
const wcag = require('wcag-contrast');
const { checkHeadingHierarchy } = require('./heading');
const { runSecurityChecks } = require('./security');
const { runLegalChecks } = require('./legal');
const { runAiDetectionChecks } = require('./ai-detect');
const { runMobileChecks } = require('./mobile');

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;

class PageTooLargeError extends Error {
  constructor(reason, details) {
    super(reason);
    this.name = 'PageTooLargeError';
    this.details = details;
  }
}

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

    function parseGradient(bgImage) {
      var gradRe = /(?:repeating-)?(?:-webkit-)?(?:linear|radial)-gradient\s*\(/i;
      var start = bgImage.search(gradRe);
      if (start === -1) return null;
      var openParen = bgImage.indexOf('(', start);
      if (openParen === -1) return null;
      var depth = 0, inner = '';
      for (var ci = openParen + 1; ci < bgImage.length; ci++) {
        var ch = bgImage[ci];
        if (ch === '(') { depth++; inner += ch; }
        else if (ch === ')') {
          if (depth === 0) break;
          depth--; inner += ch;
        } else { inner += ch; }
      }
      if (inner.length === 0) return null;
      var stops = [];
      var parenDepth = 0, current = '';
      var chars = inner.split('');
      for (var ci2 = 0; ci2 < chars.length; ci2++) {
        var ch2 = chars[ci2];
        if (ch2 === '(') { parenDepth++; current += ch2; }
        else if (ch2 === ')') { parenDepth--; current += ch2; }
        else if (ch2 === ',' && parenDepth === 0) {
          stops.push(current.trim());
          current = '';
        } else { current += ch2; }
      }
      if (current.trim()) stops.push(current.trim());
      if (stops.length === 0) return null;
      var first = stops[0].trim().toLowerCase();
      var isRadial = bgImage.slice(start, openParen).toLowerCase().indexOf('radial') !== -1;
      if (!isRadial) {
        if (first === 'to bottom' || first === 'to top' || first === 'to left' || first === 'to right' ||
            first.indexOf('deg') !== -1 || first.indexOf('turn') !== -1 || first.indexOf('rad') !== -1 ||
            first === 'to bottom left' || first === 'to bottom right' || first === 'to top left' || first === 'to top right') {
          stops.shift();
        }
      } else {
        var radialKeywords = ['circle', 'ellipse', 'closest-side', 'farthest-side', 'closest-corner', 'farthest-corner', 'at'];
        var hasRadialToken = false;
        while (stops.length > 0) {
          var token = stops[0].trim().toLowerCase();
          if (radialKeywords.some(function(kw) { return token.indexOf(kw) !== -1; }) ||
              token.indexOf('px') !== -1 || token.indexOf('%') !== -1 || token.indexOf('deg') !== -1) {
            stops.shift();
            hasRadialToken = true;
          } else { break; }
        }
      }
      if (stops.length === 0) return null;
      var parsedStops = [];
      for (var si = 0; si < stops.length; si++) {
        var stop = stops[si];
        var posMatch = stop.match(/(\d+(?:\.\d+)?)(%)$/);
        var pos = posMatch ? parseFloat(posMatch[1]) / 100 : null;
        var colorPart = stop.replace(/\s+\d+(?:\.\d+)?%$/, '').replace(/\s+\d+px$/, '').trim();
        var parsed = parseRgb(colorPart);
        if (!parsed) {
          var temp = document.createElement('div');
          temp.style.color = colorPart;
          document.body.appendChild(temp);
          var computed = getComputedStyle(temp).color;
          document.body.removeChild(temp);
          parsed = parseRgb(computed);
        }
        if (parsed) parsedStops.push({ r: parsed.r, g: parsed.g, b: parsed.b, pos: pos });
      }
      if (parsedStops.length === 0) return null;
      if (parsedStops.length === 1) {
        var s = parsedStops[0];
        return 'rgb(' + s.r + ',' + s.g + ',' + s.b + ')';
      }
      for (var pi = 0; pi < parsedStops.length; pi++) {
        if (parsedStops[pi].pos === null) {
          if (pi === 0) parsedStops[pi].pos = 0;
          else if (pi === parsedStops.length - 1) parsedStops[pi].pos = 1;
          else {
            var prev = parsedStops[pi - 1].pos;
            var next = null;
            for (var ni = pi + 1; ni < parsedStops.length; ni++) {
              if (parsedStops[ni].pos !== null) { next = parsedStops[ni].pos; break; }
            }
            parsedStops[pi].pos = next !== null ? (prev + next) / 2 : prev;
          }
        }
      }
      var weightSum = 0, rSw = 0, gSw = 0, bSw = 0;
      for (var wi = 0; wi < parsedStops.length; wi++) {
        var cur = parsedStops[wi];
        var prevP = wi === 0 ? cur.pos : parsedStops[wi - 1].pos;
        var nextP = wi === parsedStops.length - 1 ? cur.pos : parsedStops[wi + 1].pos;
        var weight = (nextP - prevP) / 2;
        if (wi === 0) weight = parsedStops[1].pos - cur.pos;
        else if (wi === parsedStops.length - 1) weight = cur.pos - parsedStops[wi - 1].pos;
        rSw += cur.r * weight; gSw += cur.g * weight; bSw += cur.b * weight;
        weightSum += weight;
      }
      if (weightSum <= 0) {
        for (var ai = 0; ai < parsedStops.length; ai++) {
          rSw += parsedStops[ai].r; gSw += parsedStops[ai].g; bSw += parsedStops[ai].b;
        }
        weightSum = parsedStops.length;
      }
      return 'rgb(' + Math.round(rSw / weightSum) + ',' + Math.round(gSw / weightSum) + ',' + Math.round(bSw / weightSum) + ')';
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
          const gradColor = parseGradient(bgImage);
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
        if (dParent.getAttribute && dParent.getAttribute('aria-disabled') === 'true') { hasDisabledAncestor = true; break; }
        if (dParent.tagName === 'BODY') break;
        dParent = dParent.parentElement;
      }
      if (hasDisabledAncestor) return;

      // Skip if this element is a label associated with a disabled input
      if (el.tagName === 'LABEL' && el.getAttribute('for')) {
        var forEl = document.getElementById(el.getAttribute('for'));
        if (forEl && (forEl.disabled || forEl.getAttribute('aria-disabled') === 'true')) return;
      }

      // Skip if this element contains a nested disabled input (label wrapping input)
      if (el.tagName === 'LABEL') {
        var nestedInputs = el.querySelectorAll('input, select, textarea, button');
        var allDisabled = true;
        for (var ni = 0; ni < nestedInputs.length; ni++) {
          if (!nestedInputs[ni].disabled) { allDisabled = false; break; }
        }
        if (nestedInputs.length > 0 && allDisabled) return;
      }

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

async function runDesignPageChecks(page, designSkipSelectors) {
  return page.evaluate(({ fnSrc, skipSelectors }) => {
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

      // Check if this element matches any skip selectors
      var skipResult = false;
      if (skipSelectors && skipSelectors.length > 0) {
        for (var si = 0; si < skipSelectors.length; si++) {
          var ss = skipSelectors[si].trim();
          if (ss.charAt(0) === '.') {
            var clsArr = rawCls.trim().split(/\s+/);
            var target = ss.slice(1);
            for (var cj = 0; cj < clsArr.length; cj++) {
              if (clsArr[cj] === target) { skipResult = true; break; }
            }
          } else if (el.matches(ss)) {
            skipResult = true; break;
          }
        }
      }
      if (skipResult) continue;

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
  }, { fnSrc: checkHeadingHierarchy.toString(), skipSelectors: designSkipSelectors });
}

async function runSeoPageChecks(page) {
  return page.evaluate((fnSrc) => {
    var checkHeadingHierarchy = eval('(' + fnSrc + ')');
    var results = [];

    // 1. Title tag
    var allTitles = document.querySelectorAll('title');
    var titleEl = allTitles.length > 0 ? allTitles[0] : null;
    var titleCount = allTitles.length;
    if (!titleEl || !(titleEl.textContent || '').trim()) {
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
    } else {
      var titleText = titleEl.textContent.trim();
      if (titleText.length < 10) {
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
      if (titleCount > 1) {
        results.push({
          ruleId: 'duplicate-title',
          ruleName: 'Page should have exactly one title tag',
          category: 'seo',
          selector: 'head',
          description: 'Found ' + titleCount + ' <title> tags; expected exactly 1',
          severity: 'high',
          value: titleCount + ' title tags',
          expected: '1 title tag'
        });
      }
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
    } else {
      var canonHref = canonical.getAttribute('href') || '';
      if (canonHref.indexOf('://') === -1) {
        results.push({
          ruleId: 'canonical-invalid',
          ruleName: 'Canonical URL should be absolute',
          category: 'seo',
          selector: 'link[rel="canonical"]',
          description: 'Canonical URL "' + canonHref + '" is relative; expected absolute URL with scheme',
          severity: 'medium',
          value: canonHref,
          expected: 'absolute URL (https://...)'
        });
      }
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
    } else {
      try {
        var parsed = JSON.parse(jsonld.textContent);
        if (!parsed['@context'] || !parsed['@type']) {
          results.push({
            ruleId: 'invalid-jsonld',
            ruleName: 'JSON-LD should have @context and @type',
            category: 'seo',
            selector: 'script[type="application/ld+json"]',
            description: 'JSON-LD is valid JSON but missing @context or @type',
            severity: 'low',
            value: 'missing @context or @type',
            expected: '{"@context":"https://schema.org","@type":"...", ...}'
          });
        }
      } catch (e) {
        results.push({
          ruleId: 'invalid-jsonld',
          ruleName: 'JSON-LD should be valid JSON',
          category: 'seo',
          selector: 'script[type="application/ld+json"]',
          description: 'JSON-LD content is not valid JSON',
          severity: 'low',
          value: 'parse error: ' + e.message.slice(0, 60),
          expected: 'valid JSON with @context and @type'
        });
      }
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

    // 6. Robots meta
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

    // 8. Open Graph extras (url, type, site_name, locale)
    var ogUrl = document.querySelector('meta[property="og:url"]');
    var ogType = document.querySelector('meta[property="og:type"]');
    var ogSiteName = document.querySelector('meta[property="og:site_name"]');
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    var ogMissing = [];
    if (!ogUrl) ogMissing.push('og:url');
    if (!ogType) ogMissing.push('og:type');
    if (!ogSiteName) ogMissing.push('og:site_name');
    if (!ogLocale) ogMissing.push('og:locale');
    if (ogMissing.length >= 2) {
      results.push({
        ruleId: 'missing-og-extras',
        ruleName: 'Page should have additional Open Graph tags',
        category: 'seo',
        selector: 'head',
        description: 'Missing Open Graph tags: ' + ogMissing.join(', '),
        severity: 'low',
        value: 'missing: ' + ogMissing.join(', '),
        expected: 'og:url, og:type, og:site_name, og:locale'
      });
    }

    // 9. Twitter Card tags (support both name and property attributes)
    var twCard = document.querySelector('meta[name="twitter:card"], meta[property="twitter:card"]');
    var twTitle = document.querySelector('meta[name="twitter:title"], meta[property="twitter:title"]');
    var twDesc = document.querySelector('meta[name="twitter:description"], meta[property="twitter:description"]');
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

    // 10. Hreflang tags
    var hreflangLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    if (hreflangLinks.length === 0) {
      results.push({
        ruleId: 'missing-hreflang',
        ruleName: 'Page should have hreflang tags for language/region targeting',
        category: 'seo',
        selector: 'head',
        description: 'No <link rel="alternate" hreflang="..."> found on the page',
        severity: 'low',
        value: 'no hreflang tags',
        expected: '<link rel="alternate" hreflang="en" href="...">'
      });
    }

    // 11. Heading hierarchy (shared with design)
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

    // Empty interactive elements (buttons, links) including icon-only
    const interactiveEls = document.querySelectorAll('button, a[href], [role="button"]');
    for (const el of interactiveEls) {
      const text = (el.textContent || '').trim();
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledby = el.getAttribute('aria-labelledby');
      const hasAria = (ariaLabel && ariaLabel.trim()) || (ariaLabelledby && ariaLabelledby.trim());
      const hasImgAlt = el.querySelector('img[alt]:not([alt=""])');
      const hasTitle = el.getAttribute('title');
      const accessible = text || hasAria || hasTitle || hasImgAlt;
      if (!accessible) {
        const innerImgs = el.querySelectorAll('img, svg, i, span[class*="icon"]');
        const iconDesc = innerImgs.length > 0 ? ' (icon-only, no accessible label)' : '';
        const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
        results.push({
          ruleId: 'empty-interactive',
          ruleName: 'Interactive elements must have accessible name',
          category: 'interactivity',
          selector: tag,
          description: el.tagName.toLowerCase() + ' has no text content or aria-label' + iconDesc,
          severity: innerImgs.length > 0 ? 'medium' : 'high',
          value: 'no accessible name',
          expected: 'text content or aria-label'
        });
      }
    }

    // Tabindex > 0 anti-pattern
    var posTab = document.querySelectorAll('[tabindex]');
    for (var ti = 0; ti < posTab.length; ti++) {
      var val = parseInt(posTab[ti].getAttribute('tabindex'));
      if (val > 0) {
        var tag2 = posTab[ti].tagName.toLowerCase() + (posTab[ti].id ? '#' + posTab[ti].id : '');
        results.push({
          ruleId: 'positive-tabindex',
          ruleName: 'Avoid positive tabindex values',
          category: 'interactivity',
          selector: tag2,
          description: 'tabindex="' + val + '" on ' + posTab[ti].tagName.toLowerCase() + ' breaks natural focus order',
          severity: 'medium',
          value: 'tabindex="' + val + '"',
          expected: 'tabindex="0" or tabindex="-1"'
        });
      }
    }

    // Focus indicator check
    var focusable = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var noFocusVisible = [];
    for (var fi = 0; fi < focusable.length; fi++) {
      var fEl = focusable[fi];
      var fStyle = getComputedStyle(fEl);
      if (fStyle.outlineStyle === 'none' && fStyle.outlineWidth === '0px') {
        if (!fEl.getAttribute('data-focus-visible') && !fEl.classList.contains('focus-visible')) {
          var tag3 = fEl.tagName.toLowerCase() + (fEl.id ? '#' + fEl.id : '');
          if (noFocusVisible.indexOf(tag3) === -1) noFocusVisible.push(tag3);
        }
      }
    }
    if (noFocusVisible.length > 0) {
      results.push({
        ruleId: 'focus-indicator',
        ruleName: 'Interactive elements must have visible focus indicator',
        category: 'interactivity',
        selector: noFocusVisible.slice(0, 3).join(', '),
        description: noFocusVisible.length + ' interactive element(s) have outline:none without custom focus-visible class: ' + noFocusVisible.slice(0, 5).join(', '),
        severity: 'high',
        value: noFocusVisible.length + ' elements with outline:none',
        expected: ':focus-visible { outline: 2px solid ... } or custom focus class'
      });
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
    mobile: doMobile = false,
    detectai: doAi = false,
    designSkipSelectors = [],
    knownFalsePositives = [],
    timeout = 30000,
    waitUntil = 'domcontentloaded',
    loadImages = true,
    blockFonts = false,
    blockMedia = true,
    disableJavaScript = false,
    navigationTimeout = 8000,
    waitStable = false,
    pageSizeLimit = null
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

        if (pageSizeLimit) {
          if (pageSizeLimit.htmlBytes && responseHeaders['content-length']) {
            var contentLength = parseInt(responseHeaders['content-length'], 10);
            if (contentLength > pageSizeLimit.htmlBytes) {
              throw new PageTooLargeError('Page HTML exceeds size limit', { reason: 'content_length', limit: pageSizeLimit.htmlBytes, actual: contentLength });
            }
          }
          if (pageSizeLimit.domElements) {
            var domCount = await page.evaluate(function() { return document.querySelectorAll('*').length; });
            if (domCount > pageSizeLimit.domElements) {
              throw new PageTooLargeError('Page has too many DOM elements', { reason: 'dom_elements', limit: pageSizeLimit.domElements, actual: domCount });
            }
          }
        }

        const viewportResults = [];
        let lastElements = [];
        const pageLevelFailures = [];
        const mobileFailures = [];
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
            const pageFails = await runDesignPageChecks(page, designSkipSelectors);
            pageLevelFailures.push(...pageFails);
            const a11yFails = await runA11yPageChecks(page);
            pageLevelFailures.push(...a11yFails);
          }
          if (doMobile) {
            const mobileFails = await runMobileChecks(page, vp);
            mobileFailures.push(...mobileFails);
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
          const seoTotalChecks = 14;
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
          var securityTotalChecks = 13;
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
            var legalResultData = await runLegalChecks(page, context);
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

        var mobileResult = null;
        if (doMobile) {
          const seen = new Set();
          const unique = [];
          for (const f of mobileFailures) {
            const key = f.selector + '|' + f.ruleId;
            if (!seen.has(key)) { seen.add(key); unique.push(f); }
          }
          const mobileTotalChecks = 6;
          const mobileFailCount = unique.length;
          mobileResult = {
            failures: unique,
            totalChecks: mobileTotalChecks,
            passCount: Math.max(0, mobileTotalChecks - mobileFailCount),
            failCount: mobileFailCount,
            score: mobileTotalChecks > 0
              ? Math.round(Math.max(0, mobileTotalChecks - mobileFailCount) / mobileTotalChecks * 1000) / 10
              : 100
          };
        }

        var aiResult = null;
        if (doAi) {
          try {
            var aiResultData = await runAiDetectionChecks(page);
            aiResult = {
              failures: aiResultData.failures,
              confidence: aiResultData.confidence,
              level: aiResultData.level,
              signals: aiResultData.signals,
              totalChecks: aiResultData.totalChecks,
              failCount: aiResultData.failures.length,
              passCount: Math.max(0, aiResultData.totalChecks - aiResultData.failures.length),
              score: aiResultData.totalChecks > 0
                ? Math.round(Math.max(0, aiResultData.totalChecks - aiResultData.failures.length) / aiResultData.totalChecks * 1000) / 10
                : 100
            };
          } catch (e) {
            aiResult = { failures: [], confidence: 0, level: 'unlikely', signals: [], totalChecks: 1, failCount: 0, passCount: 1, score: 100 };
          }
        }

        const screenshotPromise = page.screenshot({ path: filepath, fullPage: false });
        await screenshotPromise;
        await context.close();

        var perfResult = null;
        if (doPerformance) {
          try {
            if (browser) {
              try { await browser.close(); } catch (_) {}
            }
            var { runPerformanceChecks } = require('./performance');
            var hasMobileVp = vps.some(function(v) { return v.width <= 768; });
            perfResult = await runPerformanceChecks(url, chromePath, hasMobileVp ? 'mobile' : 'desktop');
          } catch (e) {
            perfResult = { error: e.message, score: null, lcp: null, cls: null, tbt: null, fcp: null, speedIndex: null, tti: null, grade: null, recommendations: [] };
          }
        }

        return { viewportResults, mergedWcag, designResult, seo: seoResult, security: securityResult, legal: legalResult, mobile: mobileResult, performance: perfResult, ai: aiResult };
      })();

      const { viewportResults, mergedWcag, designResult, seo: seoResult, security: securityResult, legal: legalResult, mobile: mobileResult, performance: perfResult, ai: aiResult } = await Promise.race([auditWork, hardTimeout]);

      if (knownFalsePositives.length > 0) {
        function filterFailures(result) {
          if (!result || !result.failures) return result;
          var keep = [];
          for (var fi = 0; fi < result.failures.length; fi++) {
            var f = result.failures[fi];
            var match = false;
            for (var kfi = 0; kfi < knownFalsePositives.length; kfi++) {
              var kfp = knownFalsePositives[kfi];
              if (kfp.ruleId === f.ruleId) {
                if (!kfp.selector || f.selector.indexOf(kfp.selector) !== -1) {
                  match = true; break;
                }
              }
            }
            if (!match) keep.push(f);
          }
          result.failures = keep;
          result.failCount = keep.length;
          result.passCount = Math.max(0, result.totalChecks - keep.length);
          result.score = result.totalChecks > 0
            ? Math.round(Math.max(0, result.totalChecks - keep.length) / result.totalChecks * 1000) / 10
            : 100;
          return result;
        }
        filterFailures(designResult);
        filterFailures(seoResult);
        filterFailures(securityResult);
        filterFailures(legalResult);
        filterFailures(mobileResult);
        if (mergedWcag && mergedWcag.viewportMerged) {
          filterFailures(mergedWcag.viewportMerged);
        }
      }

      return {
        filepath, filename, timestamp, url,
        viewport: vps[0],
        viewports: viewportResults,
        wcag: mergedWcag,
        design: designResult,
        seo: seoResult,
        security: securityResult,
        legal: legalResult,
        mobile: mobileResult,
        performance: perfResult,
        ai: aiResult,
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

module.exports = { audit, getChromium, isVercel, CHROMIUM_VERSION, PageTooLargeError, runSeoPageChecks, runSecurityChecks, runPerformanceChecks: require('./performance').runPerformanceChecks };
