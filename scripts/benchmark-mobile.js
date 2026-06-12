#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, '..', 'test', 'fixtures', 'mobile');
const FIXTURES = JSON.parse(fs.readFileSync(path.resolve(FIXTURES_DIR, 'fixtures.json'), 'utf-8'));
const { runMobileChecks } = require(path.resolve(__dirname, '..', 'packages', 'core', 'src', 'mobile.js'));

const DEFAULT_BODY = '<!DOCTYPE html><html><body>Mobile fixture</body></html>';

async function main() {
  const browser = await chromium.launch({ headless: true });

  let tp = 0, tn = 0, fp = 0, fn = 0;
  const ruleCounts = {};

  for (const fixture of FIXTURES) {
    const context = await browser.newContext({ viewport: fixture.viewport || { width: 375, height: 812 } });
    const page = await context.newPage();

    const body = fixture.body || DEFAULT_BODY;
    await page.setContent(body, { waitUntil: 'domcontentloaded' });

    const vp = fixture.viewport || { width: 375, height: 812 };
    var actualFailures = await runMobileChecks(page, vp);

    await context.close();

    const expectedRuleIds = Object.keys(fixture.expected).filter(k => fixture.expected[k] === 'fail');
    const actualRuleIds = actualFailures.map(r => r.ruleId);
    const allRuleIds = [...new Set([...expectedRuleIds, ...actualRuleIds])];

    var prefix = '  ' + fixture.id.padEnd(32);

    for (const ruleId of allRuleIds) {
      if (!ruleCounts[ruleId]) ruleCounts[ruleId] = { tp: 0, tn: 0, fp: 0, fn: 0, unique: {} };
      const expected = expectedRuleIds.includes(ruleId);
      const actual = actualRuleIds.includes(ruleId);

      if (expected && actual) { tp++; ruleCounts[ruleId].tp++; }
      else if (!expected && !actual) { tn++; ruleCounts[ruleId].tn++; }
      else if (!expected && actual) { fp++; ruleCounts[ruleId].fp++; ruleCounts[ruleId].unique[fixture.id] = 1; }
      else if (expected && !actual) { fn++; ruleCounts[ruleId].fn++; ruleCounts[ruleId].unique[fixture.id] = 1; }
    }

    var ok = fp === 0 && fn === 0;
    console.log(prefix + (ok ? '\u2713' : '\u2717'));
  }

  await browser.close();

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * precision * recall / (precision + recall) || 0;

  console.log('\n=== MOBILE BENCHMARK RESULTS ===\n');

  const rulesOrder = Object.keys(ruleCounts).sort();
  for (const r of rulesOrder) {
    const c = ruleCounts[r];
    const p = c.tp / (c.tp + c.fp) || 0;
    const r2 = c.tp / (c.tp + c.fn) || 0;
    const f = 2 * p * r2 / (p + r2) || 0;
    const mis = Object.keys(c.unique).length;
    console.log('  ' + r + ': TP=' + c.tp + ' TN=' + c.tn + ' FP=' + c.fp + ' FN=' + c.fn + ' P=' + (p*100).toFixed(1) + '% R=' + (r2*100).toFixed(1) + '% F1=' + (f*100).toFixed(1) + '% ' + (mis > 0 ? '\u2717' : '\u2713'));
  }

  console.log('\n  Total: TP=' + tp + ' TN=' + tn + ' FP=' + fp + ' FN=' + fn);
  console.log('  Precision: ' + (precision*100).toFixed(1) + '%');
  console.log('  Recall:    ' + (recall*100).toFixed(1) + '%');
  console.log('  F1:        ' + (f1*100).toFixed(1) + '%');

  if (fp === 0 && fn === 0) {
    console.log('\n  \u2713 ALL RULES PASSED (100% precision and recall)');
  } else {
    console.log('\n  \u2717 Some rules need hardening');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
