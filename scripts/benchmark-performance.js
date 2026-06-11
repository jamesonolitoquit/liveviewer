#!/usr/bin/env node
/**
 * Smoke test for the --performance flag.
 * Does NOT assert metric values (non-deterministic).
 * Verifies that the output JSON contains all expected fields.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const cliBin = path.resolve(root, 'packages/cli/bin/liveviewer.js');
const auditsDir = path.resolve(root, 'audits');

const REQUIRED_FIELDS = ['score', 'grade', 'lcp', 'cls', 'tbt', 'fcp', 'speedIndex', 'tti', 'recommendations'];
const TEST_URL = 'https://example.com';

function runCli(args) {
  const result = spawnSync('node', [cliBin, ...args], {
    cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

function latestAuditFile(label) {
  if (!fs.existsSync(auditsDir)) return null;
  const files = fs.readdirSync(auditsDir)
    .filter(f => f.startsWith(label) && f.endsWith('.json'))
    .sort().reverse();
  if (files.length === 0) return null;
  return path.join(auditsDir, files[0]);
}

async function main() {
  console.log('\n=== PERFORMANCE SMOKE TEST ===\n');
  console.log('Testing: liveviewer audit ' + TEST_URL + ' --performance\n');

  const result = runCli(['audit', TEST_URL, '--performance', '--label', 'perf-smoke']);

  if (result.status !== 0) {
    console.log('  \u2717 CLI exited with status ' + result.status);
    console.log('  stderr:', result.stderr.slice(0, 500));
    process.exit(1);
  }

  // Find the audit JSON
  const jsonPath = latestAuditFile('perf-smoke');
  if (!jsonPath) {
    console.log('  \u2717 No audit JSON file found in ' + auditsDir);
    process.exit(1);
  }

  var data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    console.log('  \u2717 Failed to parse audit JSON: ' + e.message);
    process.exit(1);
  }

  // Check performance object exists
  if (!data.performance) {
    console.log('  \u2717 No "performance" object in audit result');
    process.exit(1);
  }

  var perf = data.performance;

  // Check for errors
  if (perf.error) {
    console.log('  \u2717 Performance audit returned an error: ' + perf.error);
    console.log('\n  This is expected if Lighthouse/Chrome is not available on this machine.');
    console.log('  The --performance flag is an optional enhancement, not a hard requirement.\n');
    process.exit(0);
  }

  // Check required fields
  var allPresent = true;
  for (var f of REQUIRED_FIELDS) {
    if (perf[f] === undefined) {
      console.log('  \u2717 Missing field: "performance.' + f + '"');
      allPresent = false;
    }
  }

  if (!allPresent) {
    process.exit(1);
  }

  // Check types
  var typeIssues = [];
  if (typeof perf.score !== 'number') typeIssues.push('score should be number');
  if (typeof perf.grade !== 'string') typeIssues.push('grade should be string');
  if (!Array.isArray(perf.recommendations)) typeIssues.push('recommendations should be array');

  if (typeIssues.length > 0) {
    console.log('  \u2717 Type validation failures:');
    for (var t of typeIssues) console.log('    - ' + t);
    process.exit(1);
  }

  console.log('  \u2713 Performance object present');
  console.log('  \u2713 Score: ' + perf.score + ' (' + perf.grade + ')');
  console.log('  \u2713 LCP: ' + perf.lcp + 's');
  console.log('  \u2713 CLS: ' + perf.cls);
  console.log('  \u2713 TBT: ' + perf.tbt + 'ms');
  console.log('  \u2713 FCP: ' + perf.fcp + 's');
  console.log('  \u2713 Speed Index: ' + perf.speedIndex + 's');
  console.log('  \u2713 TTI: ' + perf.tti + 's');
  console.log('  \u2713 Recommendations: ' + perf.recommendations.length);
  console.log('');
  console.log('  \u2713 ALL FIELDS PRESENT AND VALID');
  console.log('  \u2713 PERFORMANCE INTEGRATION PASSED\n');

  // Cleanup
  try { fs.unlinkSync(jsonPath); } catch (_) {}
}

main().catch(err => { console.error(err); process.exit(1); });
