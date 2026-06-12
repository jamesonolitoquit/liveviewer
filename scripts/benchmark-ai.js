#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, '..', 'test', 'fixtures', 'ai');
const EXPECTED = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'test', 'expected-results', 'ai.json'), 'utf-8'));
const { runAiDetectionChecks } = require(path.resolve(__dirname, '..', 'packages', 'core', 'src', 'ai-detect.js'));

async function main() {
  const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.html')).sort();
  const browser = await chromium.launch({ headless: true });

  let tp = 0, tn = 0, fp = 0, fn = 0;
  const details = [];

  for (const file of files) {
    const fileUrl = 'file://' + FIXTURES_DIR.replace(/\\/g, '/') + '/' + file;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body');

    const result = await runAiDetectionChecks(page);
    await context.close();

    const expected = EXPECTED[file];
    if (!expected) {
      console.log(`  ${file.padEnd(35)} ✗ No expected results entry`);
      continue;
    }

    const actualFailCount = (result.failures || []).length;
    const actualLevel = result.level;
    const actualConfidence = result.confidence;
    const actualSignals = (result.signals || []).length;
    const expectedHasFailures = expected.failCount > 0;
    const actualHasFailures = actualFailCount > 0;

    const failMatch = expectedHasFailures === actualHasFailures;
    const confOk = Math.abs(actualConfidence - expected.confidence) <= 15;
    const levelOk = actualLevel === expected.level;
    const sigOk = actualSignals === expected.signals;
    const allOk = failMatch && confOk && levelOk && sigOk;

    if (expectedHasFailures && actualHasFailures) { tp++; }
    else if (!expectedHasFailures && !actualHasFailures) { tn++; }
    else if (!expectedHasFailures && actualHasFailures) { fp++; }
    else if (expectedHasFailures && !actualHasFailures) { fn++; }

    const issues = [];
    if (!failMatch) issues.push(`failCount: expected ${expected.failCount}, got ${actualFailCount}`);
    if (!confOk) issues.push(`confidence: expected ${expected.confidence}, got ${actualConfidence}`);
    if (!levelOk) issues.push(`level: expected ${expected.level}, got ${actualLevel}`);
    if (!sigOk) issues.push(`signals: expected ${expected.signals}, got ${actualSignals}`);

    const icon = allOk ? '\u2713' : '\u2717';
    const issueStr = issues.length > 0 ? ' — ' + issues.join('; ') : '';
    console.log(`  ${file.padEnd(35)} ${icon}  conf=${actualConfidence}% lvl=${actualLevel} sigs=${actualSignals} fail=${actualFailCount}${issueStr}`);

    details.push({ fixture: file, expected, actual: result, allOk });
  }

  await browser.close();

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * precision * recall / (precision + recall) || 0;

  console.log(`\n  Total:  TP=${tp} TN=${tn} FP=${fp} FN=${fn}`);
  console.log(`  Precision: ${(precision*100).toFixed(1)}%`);
  console.log(`  Recall:    ${(recall*100).toFixed(1)}%`);
  console.log(`  F1:        ${(f1*100).toFixed(1)}%`);

  if (fp === 0 && fn === 0) {
    console.log('\n  \u2713 ALL FIXTURES PASSED (100% accuracy)');
  } else {
    console.log('\n  \u2717 Some fixtures have mismatches');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
