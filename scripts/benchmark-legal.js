#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, '..', 'test', 'fixtures', 'legal');
const EXPECTED = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'test', 'expected-results', 'legal.json'), 'utf-8'));
const { runLegalChecks } = require(path.resolve(__dirname, '..', 'packages', 'core', 'src', 'legal.js'));

async function main() {
  const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.html'));
  const browser = await chromium.launch({ headless: true });

  let tp = 0, tn = 0, fp = 0, fn = 0;
  const ruleCounts = {};

  for (const file of files) {
    const fileUrl = 'file://' + FIXTURES_DIR.replace(/\\/g, '/') + '/' + file;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body');

    const results = await runLegalChecks(page);
    await context.close();

    const expectedFails = EXPECTED.testCases.find(tc => file.startsWith(tc.id))?.expectedFailures || [];
    const expectedRuleIds = expectedFails.map(e => e.ruleId);
    const actualRuleIds = results.map(r => r.ruleId);
    const allRuleIds = [...new Set([...expectedRuleIds, ...actualRuleIds])];

    for (const ruleId of allRuleIds) {
      if (!ruleCounts[ruleId]) ruleCounts[ruleId] = { tp: 0, tn: 0, fp: 0, fn: 0 };
      const expected = expectedRuleIds.includes(ruleId);
      const actual = actualRuleIds.includes(ruleId);

      if (expected && actual) { tp++; ruleCounts[ruleId].tp++; }
      else if (!expected && !actual) { tn++; ruleCounts[ruleId].tn++; }
      else if (!expected && actual) { fp++; ruleCounts[ruleId].fp++; }
      else if (expected && !actual) { fn++; ruleCounts[ruleId].fn++; }
    }
  }

  await browser.close();

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * precision * recall / (precision + recall) || 0;

  console.log('\n=== LEGAL & PRIVACY BENCHMARK RESULTS ===\n');

  const rulesOrder = Object.keys(ruleCounts).sort();
  for (const r of rulesOrder) {
    const c = ruleCounts[r];
    const p = c.tp / (c.tp + c.fp) || 0;
    const r2 = c.tp / (c.tp + c.fn) || 0;
    const f = 2 * p * r2 / (p + r2) || 0;
    console.log(`  ${r}: TP=${c.tp} TN=${c.tn} FP=${c.fp} FN=${c.fn} P=${(p*100).toFixed(1)}% R=${(r2*100).toFixed(1)}% F1=${(f*100).toFixed(1)}% ${(c.fp + c.fn) === 0 ? '\u2713' : '\u2717'}`);
  }

  console.log(`\n  Total: TP=${tp} TN=${tn} FP=${fp} FN=${fn}`);
  console.log(`  Precision: ${(precision*100).toFixed(1)}%`);
  console.log(`  Recall:    ${(recall*100).toFixed(1)}%`);
  console.log(`  F1:        ${(f1*100).toFixed(1)}%`);

  if (fp === 0 && fn === 0) {
    console.log('\n  \u2713 ALL RULES PASSED (100% precision and recall)');
  } else {
    console.log('\n  \u2717 Some rules need hardening');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
