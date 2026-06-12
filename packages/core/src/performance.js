/**
 * Performance audit via Lighthouse.
 * Dynamically loaded only when --performance is used.
 * Reuses Playwright's Chromium binary to avoid duplicate downloads,
 * but launches a separate Chrome instance (Lighthouse needs a debugging port).
 */

var PERFORMANCE_TIMEOUT = 45000;

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

async function runPerformanceChecks(url, chromePath, formFactor) {
  var lighthouse, chromeLauncher;

  try {
    lighthouse = (await import('lighthouse')).default;
    chromeLauncher = (await import('chrome-launcher'));
  } catch (e) {
    return errorObj('Failed to load Lighthouse. Run: npm install lighthouse chrome-launcher');
  }

  var launcherOpts = {
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  };
  if (chromePath) {
    launcherOpts.chromePath = chromePath;
  }

  var chrome;
  try {
    chrome = await chromeLauncher.launch(launcherOpts);
  } catch (e) {
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

    var lhr = result.lhr;
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
  } catch (e) {
    return errorObj('Lighthouse audit failed: ' + e.message);
  } finally {
    if (chrome) {
      try { await chrome.kill(); } catch (_) {}
    }
  }
}

module.exports = { runPerformanceChecks, computeGrade, errorObj, msToSec, roundTo };
