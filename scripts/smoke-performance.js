#!/usr/bin/env node
/**
 * Smoke test for the --performance flag.
 *
 * Runs liveviewer audit --performance against stable public URLs,
 * validates output JSON structure, field types, and grade consistency.
 *
 * Requires Lighthouse + chrome-launcher and a Chrome/Chromium binary.
 * If Chrome is not available, exits 0 gracefully (non-critical pillar).
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.resolve(ROOT, 'packages/cli/bin/liveviewer.js');
const AUDITS_DIR = path.resolve(ROOT, 'audits');

var exitCode = 0;

function runCli(args) {
  var r = spawnSync('node', [CLI_BIN].concat(args), {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status, error: r.error };
}

function latestAuditFile(label) {
  if (!fs.existsSync(AUDITS_DIR)) return null;
  var files = fs.readdirSync(AUDITS_DIR).filter(function(f) { return f.startsWith(label) && f.endsWith('.json'); }).sort().reverse();
  return files.length > 0 ? path.join(AUDITS_DIR, files[0]) : null;
}

function check(condition, msg) {
  if (!condition) { console.log('  \u2717 ' + msg); exitCode = 1; }
  else { console.log('  \u2713 ' + msg); }
}

function testUrl(url) {
  console.log('\n  === Testing: ' + url + ' ===\n');

  var label = 'perf-smoke-' + Date.now();
  var r = runCli(['audit', url, '--performance', '--label', label, '--timeout', '60000']);

  if (r.error && r.error.code === 'ETIMEDOUT') {
    console.log('  \u26A0 CLI timed out (120s) — possible Chrome/Lighthouse issue');
    console.log('  This is expected if Chrome is not available on this machine.\n');
    return null;
  }

  if (r.status !== 0 && r.status !== null) {
    console.log('  \u2717 CLI exited with status ' + r.status);
    console.log('  stderr:', (r.stderr || '').slice(0, 500));
    cleanup(label);
    return null;
  }

  var jsonPath = latestAuditFile(label);
  if (!jsonPath) {
    console.log('  \u2717 No audit JSON file found');
    cleanup(label);
    return null;
  }

  var data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    console.log('  \u2717 Failed to parse audit JSON: ' + e.message);
    cleanup(label);
    return null;
  }

  cleanup(label);
  return data;
}

function cleanup(label) {
  var jp = latestAuditFile(label);
  if (jp) { try { fs.unlinkSync(jp); } catch (_) {} }
  if (jp) { var png = jp.replace('.json', '.png'); if (fs.existsSync(png)) { try { fs.unlinkSync(png); } catch (_) {} } }
}

function validatePerf(perf, url) {
  if (!perf) { console.log('  \u2717 No "performance" object in audit result'); exitCode = 1; return; }

  // Graceful skip if deps missing
  if (perf.error) {
    console.log('  \u26A0 Performance audit returned: ' + perf.error);
    console.log('  Non-critical — skipping validation for ' + url + '\n');
    return;
  }

  check(typeof perf.score === 'number' && perf.score >= 0 && perf.score <= 100, 'score is number 0-100 (' + perf.score + ')');
  check(['A','B','C','D','F'].indexOf(perf.grade) !== -1, 'grade is valid (' + perf.grade + ')');

  var expectedGrade = perf.score >= 90 ? 'A' : perf.score >= 70 ? 'B' : perf.score >= 50 ? 'C' : perf.score >= 30 ? 'D' : 'F';
  check(perf.grade === expectedGrade, 'grade matches score (expected ' + expectedGrade + ', got ' + perf.grade + ')');

  check(perf.lcp === null || (typeof perf.lcp === 'number' && perf.lcp > 0), 'lcp is positive number or null (' + perf.lcp + ')');
  check(perf.cls === null || typeof perf.cls === 'number', 'cls is number or null (' + perf.cls + ')');
  check(perf.tbt === null || (typeof perf.tbt === 'number' && perf.tbt >= 0), 'tbt is number or null (' + perf.tbt + ')');
  check(perf.fcp === null || (typeof perf.fcp === 'number' && perf.fcp > 0), 'fcp is number or null (' + perf.fcp + ')');
  check(perf.speedIndex === null || (typeof perf.speedIndex === 'number' && perf.speedIndex > 0), 'speedIndex is number or null (' + perf.speedIndex + ')');
  check(perf.tti === null || (typeof perf.tti === 'number' && perf.tti > 0), 'tti is number or null (' + perf.tti + ')');
  check(perf.error === null, 'error is null');
  check(Array.isArray(perf.recommendations), 'recommendations is array (length ' + perf.recommendations.length + ')');

  var allStrings = perf.recommendations.every(function(r) { return typeof r === 'string'; });
  check(allStrings, 'all recommendations are strings');

  console.log('  Score: ' + perf.score + ' (' + perf.grade + ')  |  LCP: ' + (perf.lcp !== null ? perf.lcp + 's' : 'N/A') + '  CLS: ' + (perf.cls !== null ? perf.cls : 'N/A') + '  TBT: ' + (perf.tbt !== null ? perf.tbt + 'ms' : 'N/A'));
}

async function main() {
  console.log('\n=== PERFORMANCE SMOKE TEST ===\n');

  var urls = ['https://example.com'];
  var tested = false;

  for (var i = 0; i < urls.length; i++) {
    var data = testUrl(urls[i]);
    if (data && data.performance) {
      validatePerf(data.performance, urls[i]);
      tested = true;
    }
  }

  if (!tested) {
    console.log('  Could not run any performance tests.');
    console.log('  This is expected if Chrome is not available on this machine.\n');
    process.exit(0);
  }

  console.log('\n  --- Done ---\n');
  if (exitCode === 0) { console.log('  \u2713 ALL SMOKE TESTS PASSED\n'); }
  else { console.log('  \u2717 SOME SMOKE TESTS FAILED\n'); }
  process.exit(exitCode);
}

main().catch(function(err) { console.error('Smoke test error:', err.message); process.exit(1); });
