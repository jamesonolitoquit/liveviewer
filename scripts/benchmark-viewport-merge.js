/**
 * Benchmark: Viewport element merge + dynamic content capture
 *
 * Verifies that multi-viewport audits collect elements from ALL viewports
 * (not just the last one) and that dynamic content (setTimeout, React
 * hydration) is reliably captured when --wait-stable is used.
 *
 * Usage:
 *   node scripts/benchmark-viewport-merge.js
 *
 * Exit code: 0 = all checks pass, 1 = any check fails
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cliBin = path.resolve(root, 'packages/cli/bin/liveviewer.js');
const fixturesDir = path.resolve(root, 'test/fixtures/design');
const auditsDir = path.resolve(root, 'audits');

const FIXTURE = 'dynamic-overlay';
const RULES = ['font-size-legible', 'line-height-readable', 'heading-hierarchy', 'horizontal-scroll'];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    timeout: 30000, ...opts,
  });
  if (result.error && result.error.code === 'ETIMEDOUT') {
    console.warn(`  \u26A0 TIMEOUT after 30s`);
    return { stdout: '', status: null };
  }
  return { stdout: result.stdout || '', status: result.status };
}

function latestAuditFile(label) {
  if (!fs.existsSync(auditsDir)) return null;
  const files = fs.readdirSync(auditsDir)
    .filter(f => f.startsWith(label) && f.endsWith('.json'))
    .sort().reverse();
  if (files.length === 0) return null;
  return path.join(auditsDir, files[0]);
}

function fixtureUrl(id) {
  const p = path.join(fixturesDir, id + '.html');
  if (!fs.existsSync(p)) return null;
  const abs = path.resolve(p);
  if (process.platform === 'win32') {
    return 'file:///' + abs.replace(/\\/g, '/');
  }
  return 'file://' + abs;
}

function cleanup(label) {
  if (fs.existsSync(auditsDir)) {
    const old = fs.readdirSync(auditsDir).filter(f => f.startsWith(label));
    for (const f of old) {
      try { fs.unlinkSync(path.join(auditsDir, f)); } catch (_) {}
    }
  } else {
    fs.mkdirSync(auditsDir, { recursive: true });
  }
}

function parseAuditFile(label) {
  const f = latestAuditFile(label);
  if (!f) return null;
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    fs.unlinkSync(f);
    const png = f.replace('.json', '.png');
    if (fs.existsSync(png)) fs.unlinkSync(png);
    return data;
  } catch { return null; }
}

let passed = 0;
let failed = 0;

function ok(msg) { passed++; console.log(`  \u2713 ${msg}`); }
function fail(msg, detail) { failed++; console.error(`  \u2717 ${msg}: ${detail}`); }

async function main() {
  const url = fixtureUrl(FIXTURE);
  if (!url) {
    console.error(`Fixture not found: ${FIXTURE}`);
    process.exit(1);
  }

  console.log(`\n# Viewport Merge + Dynamic Content Benchmark`);
  console.log(`  Fixture: ${FIXTURE}\n`);

  // ── Test 1: Single viewport (default 1280x800) ──
  console.log('1. Single viewport audit');
  cleanup(FIXTURE + '-single');
  let { status } = run('node', [cliBin, 'audit', url, '--design', '--wcag', '--label', FIXTURE + '-single']);
  if (status !== 0) { fail('single viewport CLI', `exit code ${status}`); }
  else { ok('single viewport CLI completed'); }
  let single = parseAuditFile(FIXTURE + '-single');
  if (!single) { fail('single viewport result', 'no audit file'); }
  else {
    const designFails = (single.design?.failures || []).filter(f => RULES.includes(f.ruleId));
    const wcagFails = single.wcag?.failures || [];
    console.log(`     design failures: ${designFails.length}, WCAG failures: ${wcagFails.length}`);
    console.log(`     totalElements: ${single.wcag?.totalElements || 'N/A'}`);
    ok(`single viewport: ${designFails.length} design failures`);
  }

  // ── Test 2: Multi-viewport (1280x800 + 375x812) ──
  console.log('\n2. Multi-viewport audit (1280x800 + 375x812)');
  cleanup(FIXTURE + '-multi');
  ({ status } = run('node', [cliBin, 'audit', url, '--design', '--wcag', '--viewports', '1280x800,375x812', '--label', FIXTURE + '-multi']));
  if (status !== 0) { fail('multi-viewport CLI', `exit code ${status}`); }
  else { ok('multi-viewport CLI completed'); }
  let multi = parseAuditFile(FIXTURE + '-multi');
  if (!multi) { fail('multi-viewport result', 'no audit file'); }
  else {
    const designFails = (multi.design?.failures || []).filter(f => RULES.includes(f.ruleId));
    const wcagFails = multi.wcag?.failures || [];
    console.log(`     design failures: ${designFails.length}, WCAG failures: ${wcagFails.length}`);
    console.log(`     totalElements: ${multi.wcag?.totalElements || 'N/A'}`);
    ok(`multi-viewport: ${designFails.length} design failures`);
  }

  // ── Test 3: Multi-viewport elements >= single viewport elements ──
  console.log('\n3. Verify multi-viewport captures more elements than single');
  if (single && multi) {
    const singleEl = single.wcag?.totalElements || 0;
    const multiEl = multi.wcag?.totalElements || 0;
    console.log(`     single: ${singleEl} elements, multi: ${multiEl} elements`);
    if (multiEl >= singleEl) {
      ok(`multi-viewport has >= elements than single (${multiEl} >= ${singleEl})`);
    } else {
      fail('multi-viewport element count', `${multiEl} < ${singleEl} — elements lost!`);
    }
  } else {
    fail('element count comparison', 'missing data from one or both audits');
  }

  // ── Test 4: Dynamic content captured ──
  console.log('\n4. Verify dynamic overlay content is captured');
  if (multi) {
    const allDesignFails = (multi.design?.failures || []).filter(f => RULES.includes(f.ruleId));
    const hasOverlayText = allDesignFails.some(f =>
      f.selector && (f.selector.includes('overlay-text') || f.selector.includes('dynamic'))
    );
    const wcagElements = multi.wcag?.failures || [];
    const hasOverlayWcag = wcagElements.some(f =>
      f.selector && (f.selector.includes('overlay-text') || f.selector.includes('dynamic'))
    );
    if (hasOverlayText || hasOverlayWcag) {
      ok('dynamic overlay content captured in audit');
    } else {
      // Check if overlay text element is in totalElements at least
      // (it may pass contrast check if colors pass)
      const isInDesign = allDesignFails.some(f =>
        f.description && f.description.toLowerCase().includes('overlay')
      );
      if (isInDesign) {
        ok('dynamic overlay content captured (in design failure description)');
      } else {
        fail('dynamic overlay content', 'not found in design or WCAG failures — may have passed all checks');
      }
    }
  }

  // ── Test 5: Wait-stable captures dynamic content ──
  console.log('\n5. Verify --wait-stable captures dynamic content');
  cleanup(FIXTURE + '-stable');
  ({ status } = run('node', [cliBin, 'audit', url, '--design', '--wcag', '--wait-stable', '--label', FIXTURE + '-stable']));
  if (status !== 0) { fail('wait-stable CLI', `exit code ${status}`); }
  else { ok('wait-stable CLI completed'); }
  let stable = parseAuditFile(FIXTURE + '-stable');
  if (stable) {
    const stableDesignFails = (stable.design?.failures || []).filter(f => RULES.includes(f.ruleId));
    const hasOverlayStable = stableDesignFails.some(f =>
      f.selector && f.selector.includes('overlay-text')
    );
    if (hasOverlayStable) {
      ok('wait-stable: dynamic overlay captured in design failures');
    } else {
      // Overlay text may pass all checks; check WCAG side
      const stableWcag = stable.wcag?.failures || [];
      const hasOverlayWcagStable = stableWcag.some(f =>
        f.selector && f.selector.includes('overlay-text')
      );
      if (hasOverlayWcagStable) {
        ok('wait-stable: dynamic overlay captured in WCAG failures');
      } else {
        fail('wait-stable dynamic content', 'overlay text not found in any failure — timing issue?');
      }
    }
  }

  // ── Summary ──
  const total = passed + failed;
  console.log(`\n  ${passed}/${total} checks passed` + (failed > 0 ? `, ${failed} failed\n` : '\n'));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
