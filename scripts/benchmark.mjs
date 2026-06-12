import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cliBin = path.resolve(root, 'packages/cli/bin/liveviewer.js');
const auditsDir = path.resolve(root, 'audits');
const expectedDir = path.resolve(root, 'test/expected-results');

/* ---------- helpers ---------- */

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    timeout: 60000, ...opts,
  });
  if (result.error && result.error.code === 'ETIMEDOUT') {
    console.warn(`  ⚠ TIMEOUT after 60s`);
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

function classify(wcag) {
  if (!wcag || typeof wcag.failCount === 'undefined') return 'inapplicable';
  if (wcag.totalElements === 0) return 'inapplicable';
  if (wcag.failCount > 0) return 'failed';
  return 'passed';
}

/* ---------- main ---------- */

const ruleFiles = fs.readdirSync(expectedDir).filter(f => f.endsWith('.json'));
let totalTP = 0, totalFP = 0, totalTN = 0, totalFN = 0;
const ruleResults = [];

for (const ruleFile of ruleFiles) {
  const expected = JSON.parse(fs.readFileSync(path.join(expectedDir, ruleFile), 'utf-8'));
  if (!expected.testCases || !Array.isArray(expected.testCases)) continue;
  console.log(`\n# ${ruleFile.replace('.json', '')} — ${expected.name}`);
  console.log(`  WCAG SC: ${expected.wcag}\n`);

  let tp = 0, fp = 0, tn = 0, fn = 0;
  const details = [];

  for (const tc of expected.testCases) {
    // Clean up old audit files for this label
    if (fs.existsSync(auditsDir)) {
      const old = fs.readdirSync(auditsDir).filter(f => f.startsWith(tc.id));
      for (const f of old) fs.unlinkSync(path.join(auditsDir, f));
    } else {
      fs.mkdirSync(auditsDir, { recursive: true });
    }

    process.stdout.write(`  ${tc.id.padEnd(18)} ${tc.label.padEnd(55)} `);

    // Run audit
    const { status } = run('node', [cliBin, 'audit', tc.url, '--wcag', '--label', tc.id, '--wait-until', 'domcontentloaded']);

    // Read result
    const auditFile = latestAuditFile(tc.id);
    let verdict = 'error';
    let score = null;
    let detail = '';

    if (auditFile) {
      try {
        const data = JSON.parse(fs.readFileSync(auditFile, 'utf-8'));
        verdict = classify(data.wcag);
        score = data.wcag?.score ?? null;
        detail = data.wcag ? `score=${score} fail=${data.wcag.failCount}` : '(no wcag data)';

        // Clean up
        fs.unlinkSync(auditFile);
        // Also remove the screenshot PNG
        const png = auditFile.replace('.json', '.png');
        if (fs.existsSync(png)) fs.unlinkSync(png);
      } catch (e) {
        detail = `parse error: ${e.message}`;
      }
    } else {
      detail = 'no audit file';
    }

    // Classify
    const exp = tc.expected;
    let resultChar;
    if (verdict === 'error') {
      resultChar = '⚠';
      fn++;
      detail = 'ERROR: ' + detail;
    } else if (exp === 'passed' && verdict === 'passed') {
      resultChar = '✓'; tn++;
    } else if (exp === 'failed' && verdict === 'failed') {
      resultChar = '✓'; tp++;
    } else if (exp === 'inapplicable' && verdict === 'inapplicable') {
      resultChar = '✓'; tn++;
    } else if (exp === 'passed' && verdict === 'failed') {
      resultChar = '✗'; fp++;
    } else if (exp === 'failed' && verdict === 'passed') {
      resultChar = '✗'; fn++;
    } else if (exp === 'inapplicable' && verdict === 'passed') {
      resultChar = '?'; fp++;
      detail += ' (expected inapplicable, got passed)';
    } else if (exp === 'inapplicable' && verdict === 'failed') {
      resultChar = '?'; fp++;
      detail += ' (expected inapplicable, got failed)';
    } else if (exp === 'passed' && verdict === 'inapplicable') {
      resultChar = '?'; fn++;
      detail += ' (expected passed, got inapplicable)';
    } else if (exp === 'failed' && verdict === 'inapplicable') {
      resultChar = '?'; fn++;
      detail += ' (expected failed, got inapplicable)';
    } else {
      resultChar = '?'; fn++;
    }

    process.stdout.write(`${resultChar}  LV:${verdict} exp:${exp} ${detail}\n`);
    details.push({ id: tc.id, label: tc.label, expected: exp, actual: verdict, score, match: resultChar !== '✗' && resultChar !== '?' });
  }

  // Summary for this rule
  console.log(`\n  Rule summary:`);
  console.log(`    TP: ${tp}  FP: ${fp}  TN: ${tn}  FN: ${fn}`);
  const precision = tp + fp > 0 ? (tp / (tp + fp) * 100).toFixed(1) : 'N/A';
  const recall = tp + fn > 0 ? (tp / (tp + fn) * 100).toFixed(1) : 'N/A';
  console.log(`    Precision: ${precision}%  Recall: ${recall}%`);
  totalTP += tp; totalFP += fp; totalTN += tn; totalFN += fn;
  ruleResults.push({ rule: ruleFile.replace('.json', ''), tp, fp, tn, fn, precision, recall });
}

console.log(`\n${'='.repeat(60)}`);
console.log(`OVERALL`);
console.log(`${'='.repeat(60)}`);
console.log(`  TP: ${totalTP}  FP: ${totalFP}  TN: ${totalTN}  FN: ${totalFN}`);
const totalPrecision = totalTP + totalFP > 0 ? (totalTP / (totalTP + totalFP) * 100).toFixed(1) : 'N/A';
const totalRecall = totalTP + totalFN > 0 ? (totalTP / (totalTP + totalFN) * 100).toFixed(1) : 'N/A';
console.log(`  Precision: ${totalPrecision}%  Recall: ${totalRecall}%`);
console.log();
console.log(`  Key:`);
console.log(`    ✓  match (TP/TN)`);
console.log(`    ✗  mismatch (FP/FN)`);
console.log(`    ?  edge case`);
console.log(`    ⚠  error (timeout/parse)`);
