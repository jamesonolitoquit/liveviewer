import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cliBin = path.resolve(root, 'packages/cli/bin/liveviewer.js');
const fixturesDir = path.resolve(root, 'test/fixtures/design');
const expectedFile = path.resolve(root, 'test/expected-results/design.json');
const auditsDir = path.resolve(root, 'audits');
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
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return path.join(auditsDir, files[0]);
}

function fixtureUrl(id) {
  const p = path.join(fixturesDir, id + '.html');
  if (!fs.existsSync(p)) return null;
  // Windows: file:///C:/path/to/file
  const abs = path.resolve(p);
  if (process.platform === 'win32') {
    return 'file:///' + abs.replace(/\\/g, '/');
  }
  return 'file://' + abs;
}

function classifyByRule(actualFails, expectedFails) {
  // Only consider design rule failures (exclude a11y rules like skip-navigation, missing-lang, etc.)
  actualFails = actualFails.filter(f => RULES.includes(f.ruleId));
  const actualKeys = new Set(actualFails.map(f => f.ruleId + '|' + f.selector));
  const expectedKeys = new Set(expectedFails.map(f => f.ruleId + '|' + f.selector));

  let tp = 0, fp = 0, fn = 0;
  for (const key of expectedKeys) {
    if (actualKeys.has(key)) tp++;
    else fn++;
  }
  for (const key of actualKeys) {
    if (!expectedKeys.has(key)) fp++;
  }
  return { tp, fp, fn };
}

const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
const testCases = expected.testCases.filter(tc => {
  const url = fixtureUrl(tc.id);
  if (!url) {
    console.warn(`Warning: No fixture file for ${tc.id}, skipping.`);
    return false;
  }
  return true;
});

console.log('# Design QA Benchmark');
console.log(`  Suite: ${expected.name}`);
console.log(`  Test cases: ${testCases.length}\n`);

const overall = { tp: 0, fp: 0, fn: 0 };
const byRule = {};
for (const r of RULES) byRule[r] = { tp: 0, fp: 0, fn: 0, cases: [] };

for (const tc of testCases) {
  const url = fixtureUrl(tc.id);

  // Clean up old audit files
  if (fs.existsSync(auditsDir)) {
    const old = fs.readdirSync(auditsDir).filter(f => f.startsWith(tc.id));
    for (const f of old) {
      try { fs.unlinkSync(path.join(auditsDir, f)); } catch (_) {}
    }
  } else {
    fs.mkdirSync(auditsDir, { recursive: true });
  }

  process.stdout.write(`  ${tc.id.padEnd(24)} ${tc.label.padEnd(50)} `);

  const { status } = run('node', [cliBin, 'audit', url, '--design', '--label', tc.id]);

  const auditFile = latestAuditFile(tc.id);
  let actualFails = [];
  let resultChar = '?';
  let detail = '';

  if (auditFile) {
    try {
      const data = JSON.parse(fs.readFileSync(auditFile, 'utf-8'));
      actualFails = data.design?.failures || [];
      fs.unlinkSync(auditFile);
      const png = auditFile.replace('.json', '.png');
      if (fs.existsSync(png)) fs.unlinkSync(png);
    } catch (e) {
      detail = `parse error: ${e.message}`;
    }
  } else {
    detail = 'no audit file';
  }

  const { tp, fp, fn } = classifyByRule(actualFails, tc.expectedFailures);
  const totalChecks = tc.expectedFailures.length + actualFails.length;
  const totalCorrect = tc.expectedFailures.filter(e =>
    actualFails.some(a => a.ruleId === e.ruleId && a.selector === e.selector)
  ).length;

  // Classify per-rule contributions (only design rules)
  const designFails = actualFails.filter(a => RULES.includes(a.ruleId));
  for (const r of RULES) {
    const exp = tc.expectedFailures.filter(e => e.ruleId === r).map(e => e.ruleId + '|' + e.selector);
    const act = designFails.filter(a => a.ruleId === r).map(a => a.ruleId + '|' + a.selector);
    const expSet = new Set(exp);
    const actSet = new Set(act);
    let rtp = 0, rfp = 0, rfn = 0;
    for (const k of expSet) { if (actSet.has(k)) rtp++; else rfn++; }
    for (const k of actSet) { if (!expSet.has(k)) rfp++; }
    byRule[r].tp += rtp;
    byRule[r].fp += rfp;
    byRule[r].fn += rfn;
    byRule[r].cases.push({ id: tc.id, tp: rtp, fp: rfp, fn: rfn });
  }

  overall.tp += tp;
  overall.fp += fp;
  overall.fn += fn;

  if (fp === 0 && fn === 0) {
    resultChar = '\u2713';
    detail = `all ${totalCorrect} expected matched (no misses)`;
  } else if (fp > 0 && fn === 0) {
    resultChar = '\u2713';
    detail = `${totalCorrect}/${tc.expectedFailures.length} expected matched, ${fp} FP(s)`;
  } else if (fp === 0 && fn > 0) {
    resultChar = '?';
    detail = `${totalCorrect}/${tc.expectedFailures.length} expected matched, ${fn} FN(s)`;
  } else {
    resultChar = '\u2717';
    detail = `${totalCorrect}/${tc.expectedFailures.length} expected matched, ${fp} FP(s), ${fn} FN(s)`;
  }

  console.log(`${resultChar}  ${detail}`);

  // Print actual failures for inspection (design rules only)
  const displayFails = actualFails.filter(f => RULES.includes(f.ruleId));
  if (displayFails.length > 0 || tc.expectedFailures.length > 0) {
    const maxShow = 4;
    let shown = 0;
    for (const f of displayFails) {
      if (shown >= maxShow) { console.log(`           ... and ${actualFails.length - maxShow} more`); break; }
      const exp = tc.expectedFailures.some(e => e.ruleId === f.ruleId && e.selector === f.selector);
      console.log(`           ${exp ? '\u2713' : '\u2717'} [${f.severity.toUpperCase()}] ${f.ruleId} on ${f.selector}: ${f.value}`);
      shown++;
    }
    if (displayFails.length === 0 && tc.expectedFailures.length > 0) {
      console.log(`           (no failures found, expected ${tc.expectedFailures.length})`);
    }
    console.log('');
  }
}

// Print per-rule summary
console.log('\n' + '='.repeat(60));
console.log('PER-RULE ACCURACY');
console.log('='.repeat(60));
for (const r of RULES) {
  const { tp, fp, fn } = byRule[r];
  const precision = tp + fp > 0 ? (tp / (tp + fp) * 100).toFixed(1) : '100.0';
  const recall = tp + fn > 0 ? (tp / (tp + fn) * 100).toFixed(1) : '100.0';
  const status = fp + fn === 0 ? '\u2713' : (fp + fn <= 2 ? '~' : '\u2717');
  console.log(`  ${status} ${r.padEnd(24)} TP:${tp}  FP:${fp}  FN:${fn}  Precision: ${precision}%  Recall: ${recall}%`);
}

// Print overall summary
const totalPrecision = overall.tp + overall.fp > 0 ? (overall.tp / (overall.tp + overall.fp) * 100).toFixed(1) : '100.0';
const totalRecall = overall.tp + overall.fn > 0 ? (overall.tp / (overall.tp + overall.fn) * 100).toFixed(1) : '100.0';
console.log('\n' + '='.repeat(60));
console.log('OVERALL');
console.log('='.repeat(60));
console.log(`  TP: ${overall.tp}  FP: ${overall.fp}  FN: ${overall.fn}`);
console.log(`  Precision: ${totalPrecision}%  Recall: ${totalRecall}%`);
console.log(`\n  Key:`);
console.log(`    \u2713  all expected failures matched`);
console.log(`    ~  1-2 mismatches (acceptable)`);
console.log(`    \u2717  >2 mismatches (needs investigation)`);
