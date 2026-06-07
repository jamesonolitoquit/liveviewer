const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function record(url, options = {}) {
  const {
    duration = 5000,
    viewport = { width: 1280, height: 800 },
    outputDir = 'recordings',
    headless = true,
    interactions = [],
    label = 'recording'
  } = options;

  const absOutput = path.resolve(outputDir);
  fs.mkdirSync(absOutput, { recursive: true });

  const timestamp = Date.now();
  const tag = `${label}-${timestamp}`;
  const videoDir = path.join(absOutput, `${tag}-video`);
  fs.mkdirSync(videoDir, { recursive: true });

  const injectPath = path.join(__dirname, '..', 'lib', 'inject-timing.js');

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videoDir, size: viewport }
  });
  const page = await context.newPage();

  await page.addInitScript({ path: injectPath });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  const video = page.video();

  for (const action of interactions) {
    await executeInteraction(page, action);
  }

  await page.waitForTimeout(duration);

  const timingData = await page.evaluate(() => {
    if (window.__liveviewer) {
      window.__liveviewer.stop();
      return {
        timing: window.__liveviewer.getTiming(),
        metrics: window.__liveviewer.getMetrics()
      };
    }
    return null;
  });

  await page.close();

  let videoPath = null;
  if (video) {
    videoPath = await video.path();
    const maxWait = 10000;
    const pollInterval = 200;
    for (let waited = 0; waited < maxWait; waited += pollInterval) {
      try {
        if (fs.existsSync(videoPath)) break;
      } catch (_) {}
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }

  await browser.close();

  const output = {
    tag,
    url,
    timestamp,
    duration,
    viewport,
    videoPath,
    timing: timingData ? timingData.timing : [],
    metrics: timingData ? timingData.metrics : null
  };

  const metaPath = path.join(absOutput, `${tag}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(output, null, 2));

  return output;
}

async function executeInteraction(page, action) {
  if (!action || !action.type) return;

  switch (action.type) {
    case 'click': {
      if (action.selector) {
        await page.click(action.selector);
      } else if (action.x !== undefined && action.y !== undefined) {
        await page.mouse.click(action.x, action.y);
      }
      break;
    }
    case 'hover': {
      if (action.selector) {
        await page.hover(action.selector);
      }
      break;
    }
    case 'type': {
      if (action.selector && action.text !== undefined) {
        await page.fill(action.selector, '');
        await page.type(action.selector, String(action.text), { delay: action.delay || 30 });
      }
      break;
    }
    case 'scroll': {
      if (action.y !== undefined) {
        await page.evaluate((y) => window.scrollTo(0, y), action.y);
      }
      break;
    }
    case 'wait': {
      await page.waitForTimeout(action.ms || 500);
      break;
    }
    case 'screenshot': {
      const out = action.name || `interaction-${Date.now()}`;
      await page.screenshot({ path: out.endsWith('.png') ? out : out + '.png' });
      break;
    }
    default:
      break;
  }
}

async function screenshot(url, options = {}) {
  const {
    viewport = { width: 1280, height: 800 },
    outputDir = 'screenshots',
    fullPage = true,
    headless = true,
    label = 'shot',
    selector = null
  } = options;

  const absOutput = path.resolve(outputDir);
  fs.mkdirSync(absOutput, { recursive: true });

  const timestamp = Date.now();
  const filename = `${label}-${timestamp}.png`;
  const filepath = path.join(absOutput, filename);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  if (selector) {
    const el = await page.$(selector);
    if (el) {
      await el.screenshot({ path: filepath });
    } else {
      await page.screenshot({ path: filepath, fullPage });
    }
  } else {
    await page.screenshot({ path: filepath, fullPage });
  }

  const metrics = await page.evaluate(() => {
    const lcp = performance.getEntriesByType('largest-contentful-paint');
    return {
      url: location.href,
      title: document.title,
      lcp: lcp.length > 0 ? lcp[0].renderTime || lcp[0].loadTime : null,
      imageCount: document.images.length,
      brokenImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).length,
      missingAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length
    };
  });

  await browser.close();

  const result = { filepath, filename, timestamp, url, viewport, metrics };
  const metaPath = path.join(absOutput, `${label}-${timestamp}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(result, null, 2));

  return result;
}

module.exports = { record, screenshot };
