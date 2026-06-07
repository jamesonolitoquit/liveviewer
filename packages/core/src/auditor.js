const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const wcag = require('wcag-contrast');

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

async function audit(url, options = {}) {
  const {
    viewport = { width: 1280, height: 800 },
    outputDir = 'audits',
    headless = true,
    label = 'audit',
    wcag: doWcag = false,
    timeout = 30000,
    waitUntil = 'networkidle'
  } = options;

  const absOutput = path.resolve(outputDir);
  fs.mkdirSync(absOutput, { recursive: true });
  const timestamp = Date.now();
  const filename = `${label}-${timestamp}.png`;
  const filepath = path.join(absOutput, filename);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.goto(url, { waitUntil, timeout });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: filepath, fullPage: true });

  let wcagResult = null;
  if (doWcag) {
      const skippedGradients = [];
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
          null,
          false
        );
        while (walker.nextNode()) {
          const el = walker.currentNode;
          const tag = el.tagName.toLowerCase();
          if (tag === 'style' || tag === 'script' || tag === 'noscript') continue;
          const text = el.textContent.trim();
          if (!text || el.children.length > 0) continue;
          const style = getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = parseInt(style.fontWeight);
          const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
          const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
          const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : '';
          const bg = getEffectiveBackground(el, 10);
          if (bg === 'skip') continue;
          results.push({
            selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls,
            text: text.slice(0, 120),
            foreground: style.color,
            background: bg,
            fontSize,
            fontWeight,
            isLarge
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

    wcagResult = {
      totalElements: elements.length,
      failures,
      passCount: elements.length - failures.length,
      failCount: failures.length,
      score: elements.length > 0
        ? Math.round((elements.length - failures.length) / elements.length * 1000) / 10
        : 100
    };
  }

  await browser.close();

  const result = { filepath, filename, timestamp, url, viewport, wcag: wcagResult };
  const metaPath = path.join(absOutput, `${label}-${timestamp}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(result, null, 2));
  return result;
}

module.exports = { audit };
