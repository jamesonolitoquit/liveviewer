const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function extract(url, options = {}) {
  const {
    viewport = { width: 1280, height: 800 },
    outputDir = 'extracts',
    headless = true,
    label = 'extract',
    styles: doStyles = false,
    timeout = 30000,
    waitUntil = 'networkidle'
  } = options;

  const absOutput = path.resolve(outputDir);
  fs.mkdirSync(absOutput, { recursive: true });
  const timestamp = Date.now();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.goto(url, { waitUntil, timeout });
  await page.waitForTimeout(1000);

  let result = { url, timestamp, viewport };

  if (doStyles) {
    result.styles = await page.evaluate(() => {
      const props = {
        colors: {},
        backgrounds: {},
        fontFamilies: {},
        fontSizes: {},
        fontWeights: {},
        borders: {},
        borderColors: {},
        paddings: {}
      };

      function addTo(map, value, selector) {
        if (!value) return;
        if (!map[value]) map[value] = { count: 0, selectors: new Set() };
        map[value].count++;
        map[value].selectors.add(selector);
      }

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null
      );

      while (walker.nextNode()) {
        const el = walker.currentNode;
        const style = getComputedStyle(el);
        const rawCls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
        const cls = rawCls ? '.' + rawCls.trim().split(/\s+/).filter(Boolean).join('.') : '';
        const id = el.id ? '#' + el.id : '';
        const sel = el.tagName.toLowerCase() + id + cls;

        addTo(props.colors, style.color, sel);
        addTo(props.backgrounds, style.backgroundColor, sel);
        addTo(props.fontFamilies, style.fontFamily, sel);
        addTo(props.fontSizes, style.fontSize, sel);
        addTo(props.fontWeights, style.fontWeight, sel);
        addTo(props.borders, style.border, sel);
        addTo(props.borderColors, style.borderColor, sel);
        addTo(props.paddings, style.padding, sel);
      }

      for (const key of Object.keys(props)) {
        for (const val of Object.keys(props[key])) {
          props[key][val].selectors = [...props[key][val].selectors];
        }
      }

      return props;
    });
  }

  await browser.close();

  const filename = `${label}-${timestamp}.json`;
  const filepath = path.join(absOutput, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return result;
}

function checkBrandViolations(data, brandConfig) {
  const violations = { colors: [], fonts: [] };
  if (!data.styles) return violations;

  const brandHexes = new Set(
    Object.values(brandConfig.colors || {}).map(c => normalizeColor(c)).filter(Boolean)
  );

  if (data.styles.colors) {
    for (const [raw, info] of Object.entries(data.styles.colors)) {
      const hex = normalizeColor(raw);
      if (hex && !brandHexes.has(hex)) {
        violations.colors.push({
          value: raw,
          normalized: hex,
          count: info.count,
          selectors: (info.selectors || []).slice(0, 5),
          recommendation: `Replace ${raw} with an approved brand color`
        });
      }
    }
  }

  if (data.styles.fontFamilies && brandConfig.fonts && brandConfig.fonts.families) {
    const allowed = brandConfig.fonts.families.map(f => f.toLowerCase());
    for (const [family, info] of Object.entries(data.styles.fontFamilies)) {
      const lower = family.toLowerCase();
      const ok = allowed.some(a => lower.includes(a));
      if (!ok) {
        violations.fonts.push({
          value: family,
          count: info.count,
          selectors: (info.selectors || []).slice(0, 5),
          recommendation: `Replace "${family}" with an approved font`
        });
      }
    }
  }

  return violations;
}

function normalizeColor(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  const hex6 = str.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (hex6) return '#' + hex6[1];
  const rgb = str.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
  const rgba = str.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/);
  if (rgba) return '#' + [rgba[1], rgba[2], rgba[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
  return null;
}

module.exports = { extract, checkBrandViolations, normalizeColor };
