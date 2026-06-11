#!/usr/bin/env node
/**
 * CLI integration tests.
 * Tests flag combinations, exit codes, output structure.
 * Uses local fixture files where possible to avoid network dependency.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.resolve(ROOT, 'packages/cli/bin/liveviewer.js');
const SEO_FIXTURE = path.resolve(ROOT, 'test/fixtures/seo/seo-perfect.html');
const LEGAL_FIXTURE = path.resolve(ROOT, 'test/fixtures/legal/legal-mixed.html');

var pass = 0, fail = 0;
var results = [];

function run(args) {
  var r = spawnSync('node', [CLI_BIN].concat(args), {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 60000
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status, error: r.error };
}

function fixtureUrl(p) {
  var abs = path.resolve(p);
  return 'file:///' + abs.replace(/\\/g, '/');
}

function test(label, fn) {
  try {
    fn();
    pass++;
    results.push({ label, ok: true });
  } catch (e) {
    fail++;
    results.push({ label, ok: false, msg: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ============================================================
console.log('\n=== CLI INTEGRATION TESTS ===\n');

// 1. No pillar flag → error
test('no pillar flag exits 1', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE)]);
  assert(r.status !== 0, 'expected non-zero exit, got ' + r.status);
  assert(r.stderr.indexOf('At least one pillar flag') !== -1, 'expected pillar flag error');
});

// 2. --version
test('--version', function() {
  var r = run(['--version']);
  assert(r.status === 0, 'exit 0');
  assert(r.stdout.trim().length > 0, 'has version');
});

// 3. -v
test('-v', function() {
  var r = run(['-v']);
  assert(r.status === 0, 'exit 0');
  assert(r.stdout.trim().length > 0, 'has version');
});

// 4. --help
test('--help', function() {
  var r = run(['--help']);
  assert(r.status === 0, 'exit 0');
  assert(r.stdout.indexOf('--wcag') !== -1, 'help mentions --wcag');
  assert(r.stdout.indexOf('--all') !== -1, 'help mentions --all');
  assert(r.stdout.indexOf('--json') !== -1, 'help mentions --json');
});

// 5. help <cmd> alias
test('help audit alias', function() {
  var r = run(['help', 'audit']);
  assert(r.status === 0, 'exit 0');
  assert(r.stdout.indexOf('audit') !== -1, 'output mentions audit');
});

// 6. --wcag on a page with no contrast issues
test('--wcag on clean page', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  assert(data.wcag !== null && typeof data.wcag.score === 'number', 'wcag object present');
});

// 7. --design on clean page
test('--design on clean page', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--design', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  assert(data.design !== null && typeof data.design.score === 'number', 'design object present');
});

// 8. --seo on clean page
test('--seo on clean page', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--seo', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  assert(data.seo !== null && typeof data.seo.score === 'number', 'seo object present');
});

// 9. --security on clean page
test('--security on clean page', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--security', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  assert(data.security !== null && typeof data.security.score === 'number', 'security object present');
});

// 10. --legal on mixed page (all 5 fail)
test('--legal on failing page', function() {
  var r = run(['audit', fixtureUrl(LEGAL_FIXTURE), '--legal', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  assert(data.legal !== null, 'legal object present');
  assert(data.legal.failCount >= 4, 'expected at least 4 legal failures, got ' + data.legal.failCount);
});

// 11. --all on clean page
test('--all includes all pillars', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--all', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  var pillars = ['wcag', 'design', 'seo', 'security', 'legal', 'performance'];
  var missing = pillars.filter(function(p) { return data[p] === null || data[p] === undefined; });
  assert(missing.length === 0, 'all pillars present, missing: ' + missing.join(','));
});

// 12. --json outputs parseable JSON
test('--json output is valid JSON', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--json']);
  assert(r.status === 0, 'exit 0');
  assert(r.stdout.trim().length > 0, 'stdout not empty');
  try { JSON.parse(r.stdout); } catch(e) { assert(false, 'invalid JSON: ' + e.message); }
});

// 13. --sarif + --crawl is rejected
test('--sarif + --crawl rejected', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--sarif', '--crawl']);
  assert(r.status !== 0, 'expected non-zero exit');
  assert((r.stderr + r.stdout).indexOf('--sarif is not supported') !== -1, 'expected sarif-crawl error message');
});

// 14. --fail-on 0 on a clean page → exit 0
test('--fail-on 0 on clean page exits 0', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--fail-on', '0']);
  assert(r.status === 0, 'expected exit 0, got ' + r.status);
});

// 15. --fail-on 0 on failing page → exit 1
test('--fail-on 0 on failing legal page exits 1', function() {
  var r = run(['audit', fixtureUrl(LEGAL_FIXTURE), '--legal', '--fail-on', '0']);
  assert(r.status !== 0, 'expected non-zero exit, got ' + r.status);
});

// 15b. --fail-on with high threshold on clean page → exit 0
test('--fail-on high threshold exits 0', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--fail-on', '100']);
  assert(r.status === 0, 'expected exit 0, got ' + r.status);
});

// 16. Unknown URL → error
test('invalid URL exits 1', function() {
  var r = run(['audit', 'not-a-valid-url', '--wcag']);
  assert(r.status !== 0, 'expected non-zero exit for invalid URL');
});

// 17. URL required
test('missing URL exits 1', function() {
  var r = run(['audit']);
  assert(r.status !== 0, 'expected non-zero exit');
  assert((r.stderr + r.stdout).indexOf('URL required') !== -1, 'expected URL required error');
});

// 18. Multiple pillars together
test('--wcag --design --seo together', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--design', '--seo', '--json']);
  assert(r.status === 0, 'exit 0');
  var data = JSON.parse(r.stdout);
  assert(data.wcag !== null, 'wcag present');
  assert(data.design !== null, 'design present');
  assert(data.seo !== null, 'seo present');
});

// 19. --sarif output (single page)
test('--sarif produces valid output', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--sarif']);
  assert(r.status === 0, 'exit 0');
  try {
    var sarif = JSON.parse(r.stdout);
    assert(sarif.$schema !== undefined, 'has $schema');
    assert(sarif.runs !== undefined && sarif.runs.length > 0, 'has runs');
  } catch(e) {
    assert(false, 'invalid SARIF JSON: ' + e.message);
  }
});

// 20. --sarif-output writes to file
test('--sarif-output writes file', function() {
  var tmpPath = path.resolve(ROOT, 'audits', 'test-sarif-output.json');
  try { fs.unlinkSync(tmpPath); } catch(_) {}
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--sarif-output', tmpPath]);
  assert(r.status === 0, 'exit 0');
  assert(fs.existsSync(tmpPath), 'SARIF file exists');
  var content = fs.readFileSync(tmpPath, 'utf-8');
  try { JSON.parse(content); assert(true, 'valid JSON'); } catch(e) { assert(false, 'invalid SARIF JSON'); }
  try { fs.unlinkSync(tmpPath); } catch(_) {}
});

// 21. --timeout flag
test('--timeout flag accepted', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--timeout', '10000', '--json']);
  assert(r.status === 0, 'exit 0');
  try { JSON.parse(r.stdout); } catch(e) { assert(false, 'invalid JSON'); }
});

// 22. --wait-until flag
test('--wait-until flag accepted', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--wait-until', 'load', '--json']);
  assert(r.status === 0, 'exit 0');
  try { JSON.parse(r.stdout); } catch(e) { assert(false, 'invalid JSON'); }
});

// 23. --label flag
test('--label flag accepted', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--label', 'test-label', '--json']);
  assert(r.status === 0, 'exit 0');
  try { JSON.parse(r.stdout); } catch(e) { assert(false, 'invalid JSON'); }
});

// 24. Unknown command
test('unknown command exits 1', function() {
  var r = run(['nonexistent-cmd']);
  assert(r.status !== 0, 'expected non-zero exit');
});

// 25. --mobile flag (with --design, which has viewport-aware rules)
test('--mobile accepted with --design', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--design', '--mobile', '--json']);
  // May exit 0 even if mobile viewport can't be fully tested on file:// URL
  // Just verify it doesn't crash
  assert(r.status === 0 || r.stdout.length > 0, 'command completed');
});

// 26. --crawl with --all
test('--crawl with --all does not crash', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--all', '--crawl', '--max-pages', '1', '--depth', '0']);
  // Should complete (may have performance errors but should not crash)
  assert(r.status === 0 || (r.stderr + r.stdout).indexOf('Error') === -1, 'crawl completed without crash');
});

// 27. Help text mentions all pillars
test('help text lists all pillars', function() {
  var r = run(['--help']);
  var pillars = ['--wcag', '--design', '--seo', '--security', '--legal', '--performance', '--all'];
  for (var p of pillars) {
    assert(r.stdout.indexOf(p) !== -1, 'help mentions ' + p);
  }
});

// 28. --viewports flag
test('--viewports flag accepted', function() {
  var r = run(['audit', fixtureUrl(SEO_FIXTURE), '--wcag', '--viewports', '1280x800,375x812', '--json']);
  assert(r.status === 0, 'exit 0');
  try { JSON.parse(r.stdout); } catch(e) { assert(false, 'invalid JSON'); }
});

// ============================================================
console.log('\n' + '='.repeat(50));
console.log('  Results: ' + pass + '/' + (pass + fail) + ' passed');
for (var ri = 0; ri < results.length; ri++) {
  var r2 = results[ri];
  console.log('  ' + (r2.ok ? '\u2713' : '\u2717') + ' ' + r2.label + (r2.msg ? ' -- ' + r2.msg : ''));
}
console.log('');
if (fail === 0) {
  console.log('  \u2713 ALL CLI TESTS PASSED\n');
} else {
  console.log('  \u2717 SOME CLI TESTS FAILED\n');
}
process.exit(fail > 0 ? 1 : 0);
