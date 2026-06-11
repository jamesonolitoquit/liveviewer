import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAxe } from './lib/axe-runner.js';
import {
  extractLiveviewerWcag, extractAxe, compareResults, computeMetrics, AXE_RULE_MAP
} from './lib/result-comparator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cliBin = path.resolve(root, 'packages/cli/bin/liveviewer.js');
const fixturesDir = path.resolve(root, 'test/fixtures/accessibility');
const auditsDir = path.resolve(root, 'audits');

const RUNNABLE_RULES = Object.entries(AXE_RULE_MAP)
  .filter(([, axeRules]) => axeRules.length > 0)
  .map(([lv]) => lv);

/**
 * Extract ALL Liveviewer failures (WCAG + a11y from design) into a unified format.
 */
function extractAllLvFailures(wcag, design) {
  const results = [];

  // WCAG color-contrast failures
  for (const f of (wcag?.failures || [])) {
    results.push({ ruleId: 'color-contrast', selector: f.selector });
  }

  // Design + a11y failures
  for (const f of (design?.failures || [])) {
    if (RUNNABLE_RULES.includes(f.ruleId)) {
      results.push({ ruleId: f.ruleId, selector: f.selector });
    }
  }

  return results;
}

function fixtureUrl(id) {
  const p = path.join(fixturesDir, id + '.html');
  if (!fs.existsSync(p)) return null;
  const abs = path.resolve(p);
  return process.platform === 'win32'
    ? 'file:///' + abs.replace(/\\/g, '/')
    : 'file://' + abs;
}

function runLiveviewer(url, label) {
  if (fs.existsSync(auditsDir)) {
    const old = fs.readdirSync(auditsDir).filter(f => f.startsWith(label));
    for (const f of old) {
      try { fs.unlinkSync(path.join(auditsDir, f)); } catch (_) {}
    }
  } else {
    fs.mkdirSync(auditsDir, { recursive: true });
  }

  spawnSync('node', [cliBin, 'audit', url, '--wcag', '--design', '--label', label], {
    cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000
  });

  if (!fs.existsSync(auditsDir)) return { wcag: null, design: null };

  const files = fs.readdirSync(auditsDir)
    .filter(f => f.startsWith(label) && f.endsWith('.json'))
    .sort().reverse();

  if (files.length === 0) return { wcag: null, design: null };

  try {
    const data = JSON.parse(fs.readFileSync(path.join(auditsDir, files[0]), 'utf-8'));
    const png = path.join(auditsDir, files[0].replace('.json', '.png'));
    if (fs.existsSync(png)) fs.unlinkSync(png);
    fs.unlinkSync(path.join(auditsDir, files[0]));
    return { wcag: data.wcag || null, design: data.design || null };
  } catch (e) {
    return { wcag: null, design: null };
  }
}

console.log('# Accessibility Benchmark');
console.log(`  Reference: axe-core (CDN v4.8.2)`);
console.log(`  Run: Liveviewer --wcag --design vs axe-core\n`);

const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.html')).sort();
if (fixtureFiles.length === 0) {
  console.error('No fixtures found in', fixturesDir);
  process.exit(1);
}

const byRule = {};
RUNNABLE_RULES.forEach(r => { byRule[r] = { tp: 0, fp: 0, fn: 0, cases: [] }; });

let totalLvTp = 0, totalLvFp = 0, totalLvFn = 0;

for (const file of fixtureFiles) {
  const id = file.replace('.html', '');
  const url = fixtureUrl(id);

  process.stdout.write(`  ${id.padEnd(28)} `);

  // Run axe-core
  const axeViolations = await runAxe(url);
  const axeHasError = axeViolations.some(v => v.ruleId === 'error');
  if (axeHasError) {
    const errMsg = axeViolations.find(v => v.ruleId === 'error')?.description || 'unknown';
    console.log(`\u26A0 axe error: ${errMsg}`);
    continue;
  }

  const axeRef = extractAxe(axeViolations);

  // Run Liveviewer
  const lv = runLiveviewer(url, id);
  const lvFails = extractAllLvFailures(lv.wcag, lv.design);

  // Compare all failures against axe
  const comp = compareResults(lvFails, axeRef);
  totalLvTp += comp.tp;
  totalLvFp += comp.fp;
  totalLvFn += comp.fn;

  // Per-rule breakdown
  for (const rule of RUNNABLE_RULES) {
    const act = lvFails.filter(f => f.ruleId === rule);
    const exp = axeRef.filter(f => f.ruleId === rule);
    const rc = compareResults(act, exp);
    byRule[rule].tp += rc.tp;
    byRule[rule].fp += rc.fp;
    byRule[rule].fn += rc.fn;
    byRule[rule].cases.push({ id, tp: rc.tp, fp: rc.fp, fn: rc.fn });
  }

  // Summary line
  const matchStr = `TP:${comp.tp} FP:${comp.fp} FN:${comp.fn}`;
  const totalIssues = axeRef.length;
  const lvDetected = lvFails.length;

  let status;
  if (comp.fp === 0 && comp.fn === 0) {
    status = '\u2713';
  } else if (comp.fp + comp.fn <= 2) {
    status = '~';
  } else {
    status = '\u2717';
  }

  console.log(`${status}  axe:${totalIssues} lv:${lvDetected} ${matchStr}`);

  // Print mismatches for investigation
  if (comp.fns.length > 0 || comp.fps.length > 0) {
    for (const fn of comp.fns.slice(0, 2)) {
      console.log(`           \u2717 missed: ${fn.ruleId} on ${fn.selector}`);
    }
    for (const fp of comp.fps.slice(0, 2)) {
      console.log(`           \u2717 fp: ${fp.ruleId} on ${fp.selector}`);
    }
  }
}

// Print per-rule summary
console.log('\n' + '='.repeat(60));
console.log('PER-RULE ACCURACY (vs axe-core)');
console.log('='.repeat(60));

const ruleOrder = [
  'color-contrast', 'missing-alt', 'empty-interactive',
  'missing-label', 'missing-lang', 'skip-navigation'
];

for (const rule of ruleOrder) {
  if (!byRule[rule]) continue;
  const { tp, fp, fn } = byRule[rule];
  if (tp === 0 && fp === 0 && fn === 0) {
    console.log(`  - ${rule.padEnd(24)} no test cases`);
    continue;
  }
  const met = computeMetrics(tp, fp, fn);
  const status = fp + fn === 0 ? '\u2713' : (fp + fn <= 2 ? '~' : '\u2717');
  console.log(`  ${status} ${rule.padEnd(24)} TP:${tp}  FP:${fp}  FN:${fn}  P:${met.precision}%  R:${met.recall}%  F1:${met.f1}%`);
}

// Overall summary
console.log('\n' + '='.repeat(60));
console.log('OVERALL');
console.log('='.repeat(60));
const overall = computeMetrics(totalLvTp, totalLvFp, totalLvFn);
console.log(`  TP: ${totalLvTp}  FP: ${totalLvFp}  FN: ${totalLvFn}`);
console.log(`  Precision: ${overall.precision}%  Recall: ${overall.recall}%  F1: ${overall.f1}%`);
console.log(`\n  Key:`);
console.log(`    \u2713  perfect match`);
console.log(`    ~  1-2 mismatches`);
console.log(`    \u2717  >2 mismatches`);
