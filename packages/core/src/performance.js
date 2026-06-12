/**
 * Performance audit via Lighthouse.
 * Uses chrome-launcher to launch Chrome (local) or @sparticuz/chromium-min (Vercel).
 * Falls back to Playwright chromium if chrome-launcher is unavailable.
 */

var PERFORMANCE_TIMEOUT = 45000;
var lighthouseCache, chromeLauncherCache;

function errorObj(msg) {
  return { error: msg, score: null, grade: null, lcp: null, cls: null, tbt: null, fcp: null, speedIndex: null, tti: null, recommendations: [] };
}

function computeGrade(score) {
  return score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';
}

function msToSec(ms) {
  return ms != null ? Math.round(ms / 10) / 100 : null;
}

function roundTo(v, decimals) {
  var f = Math.pow(10, decimals);
  return v !== null ? Math.round(v * f) / f : null;
}

async function loadLighthouse() {
  if (!lighthouseCache) {
    lighthouseCache = (await import('lighthouse')).default;
  }
  return lighthouseCache;
}

async function loadChromeLauncher() {
  if (!chromeLauncherCache) {
    chromeLauncherCache = (await import('chrome-launcher'));
  }
  return chromeLauncherCache;
}

async function runPerformanceChecksViaPlaywright(url, chromePath, formFactor) {
  var playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    return errorObj('Failed to load Playwright for performance audit: ' + e.message);
  }

  var browser;
  try {
    var launchArgs = ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0'];
    browser = await playwright.chromium.launch({
      args: launchArgs,
      executablePath: chromePath || undefined,
      headless: true
    });

    var lighthouse = await loadLighthouse();
    var wsEndpoint = browser._connection.url();
    var port = parseInt(new URL(wsEndpoint).port, 10);

    if (!port || isNaN(port)) {
      await browser.close();
      return errorObj('Could not determine Chrome debugging port from Playwright browser');
    }

    var perfPromise = lighthouse(url, {
      port: port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      formFactor: formFactor || 'desktop',
      screenEmulation: { disabled: true },
      maxWaitForLoad: PERFORMANCE_TIMEOUT
    });

    var timeoutPromise = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Lighthouse timed out after ' + (PERFORMANCE_TIMEOUT / 1000) + 's')); }, PERFORMANCE_TIMEOUT + 5000);
    });

    var result = await Promise.race([perfPromise, timeoutPromise]);

    if (!result || !result.lhr) {
      return errorObj('Lighthouse returned no result');
    }

    return extractLighthouseResult(result.lhr);
  } catch (e) {
    return errorObj('Lighthouse audit failed via Playwright: ' + e.message);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

function extractLighthouseResult(lhr) {
  var audits = lhr.audits || {};
  var score = Math.round((lhr.categories.performance?.score || 0) * 100);
  var grade = computeGrade(score);

  var getMs = function(id) {
    var a = audits[id];
    if (!a || a.numericValue === undefined) return null;
    return a.numericValue;
  };

  var recommendations = [];
  for (var key in audits) {
    var a = audits[key];
    if (a.score !== null && a.score < 0.5 && a.title) {
      recommendations.push(a.title + (a.description ? ': ' + a.description.replace(/<[^>]*>/g, '').split('.')[0] : ''));
    }
  }
  recommendations = recommendations.slice(0, 10);

  return {
    error: null,
    score: score,
    grade: grade,
    lcp: msToSec(getMs('largest-contentful-paint')),
    cls: roundTo(getMs('cumulative-layout-shift'), 4),
    tbt: getMs('total-blocking-time') !== null ? Math.round(getMs('total-blocking-time')) : null,
    fcp: msToSec(getMs('first-contentful-paint')),
    speedIndex: msToSec(getMs('speed-index')),
    tti: msToSec(getMs('interactive')),
    recommendations: recommendations
  };
}

async function runPerformanceChecks(url, chromePath, formFactor) {
  var lighthouse, chromeLauncher;

  try {
    lighthouse = await loadLighthouse();
    chromeLauncher = await loadChromeLauncher();
  } catch (e) {
    var isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
    if (isVercel) {
      return runPerformanceChecksViaPlaywright(url, chromePath, formFactor);
    }
    return errorObj('Failed to load Lighthouse. Run: npm install lighthouse chrome-launcher (' + e.message + ')');
  }

  var launcherOpts = {
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  };
  if (chromePath) {
    launcherOpts.chromePath = chromePath;
    process.env.CHROME_PATH = chromePath;
  }

  var chrome;
  try {
    chrome = await chromeLauncher.launch(launcherOpts);
  } catch (e) {
    var isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
    if (isVercel) {
      return runPerformanceChecksViaPlaywright(url, chromePath, formFactor);
    }
    return errorObj('Failed to launch Chrome for performance audit: ' + e.message);
  }

  try {
    var perfPromise = lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      formFactor: formFactor || 'desktop',
      screenEmulation: { disabled: true },
      maxWaitForLoad: PERFORMANCE_TIMEOUT
    });

    var timeoutPromise = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Lighthouse timed out after ' + (PERFORMANCE_TIMEOUT / 1000) + 's')); }, PERFORMANCE_TIMEOUT + 5000);
    });

    var result = await Promise.race([perfPromise, timeoutPromise]);

    if (!result || !result.lhr) {
      return errorObj('Lighthouse returned no result');
    }

    return extractLighthouseResult(result.lhr);
  } catch (e) {
    var isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
    if (isVercel) {
      return errorObj('Performance audit unavailable on this environment. Use the CLI: npm install -g @liveviewer/cli (' + e.message + ')');
    }
    return errorObj('Lighthouse audit failed: ' + e.message);
  } finally {
    if (chrome) {
      try { await chrome.kill(); } catch (_) {}
    }
  }
}

module.exports = { runPerformanceChecks, computeGrade, errorObj, msToSec, roundTo };
