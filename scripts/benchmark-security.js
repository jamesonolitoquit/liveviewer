#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = path.resolve(__dirname, '..', 'test', 'fixtures', 'security');
const serverModule = require(path.resolve(FIXTURES_DIR, 'server.js'));
const { runSecurityChecks } = require(path.resolve(__dirname, '..', 'packages', 'core', 'src', 'security.js'));

const FIXTURES = serverModule.FIXTURES;
const DEFAULT_BODY = '<!DOCTYPE html><html><body>Security fixture</body></html>';

async function main() {
  const { port, close: closeServer } = await serverModule.createServer();
  const browser = await chromium.launch({ headless: true });

  let tp = 0, tn = 0, fp = 0, fn = 0;
  const ruleCounts = {};

  for (const fixture of FIXTURES) {
    const isHttps = (fixture.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
    const protocol = 'http';
    const fixtureUrl = protocol + '://localhost:' + port + '/fixture/' + fixture.id;

    const context = await browser.newContext();
    const page = await context.newPage();

    // For "HTTPS" fixtures, intercept with route handler to apply headers
    var routeHeaders = {};
    if (isHttps) {
      await context.route('**/fixture/' + fixture.id, async route => {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/html', ...fixture.headers },
          body: fixture.body || DEFAULT_BODY
        });
      });
    }

    // Navigate
    var responseHeaders = {};
    try {
      var response = await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      responseHeaders = response ? response.headers() : {};
    } catch (e) {
      responseHeaders = fixture.headers;
    }

    // If fixture uses route handler (isHttps), use fixture headers as response headers
    if (isHttps) {
      responseHeaders = fixture.headers;
    }

    // Run all security checks
    var actualFailures = await runSecurityChecks(page, context, fixtureUrl, responseHeaders);

    await context.close();

    // Compare to expected
    const expectedRuleIds = Object.keys(fixture.expected).filter(k => fixture.expected[k] === 'fail');
    const actualRuleIds = actualFailures.map(r => r.ruleId);
    const allRuleIds = [...new Set([...expectedRuleIds, ...actualRuleIds])];

    for (const ruleId of allRuleIds) {
      if (!ruleCounts[ruleId]) ruleCounts[ruleId] = { tp: 0, tn: 0, fp: 0, fn: 0, unique: {} };
      const expected = expectedRuleIds.includes(ruleId);
      const actual = actualRuleIds.includes(ruleId);

      if (expected && actual) { tp++; ruleCounts[ruleId].tp++; }
      else if (!expected && !actual) { tn++; ruleCounts[ruleId].tn++; }
      else if (!expected && actual) { fp++; ruleCounts[ruleId].fp++; ruleCounts[ruleId].unique[fixture.id] = 1; }
      else if (expected && !actual) { fn++; ruleCounts[ruleId].fn++; ruleCounts[ruleId].unique[fixture.id] = 1; }
    }
  }

  await browser.close();
  closeServer();

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * precision * recall / (precision + recall) || 0;

  console.log('\n=== SECURITY BENCHMARK RESULTS ===\n');

  const rulesOrder = Object.keys(ruleCounts).sort();
  for (const r of rulesOrder) {
    const c = ruleCounts[r];
    const p = c.tp / (c.tp + c.fp) || 0;
    const r2 = c.tp / (c.tp + c.fn) || 0;
    const f = 2 * p * r2 / (p + r2) || 0;
    const mis = Object.keys(c.unique).length;
    console.log(`  ${r}: TP=${c.tp} TN=${c.tn} FP=${c.fp} FN=${c.fn} P=${(p*100).toFixed(1)}% R=${(r2*100).toFixed(1)}% F1=${(f*100).toFixed(1)}% ${mis > 0 ? '\u2717' : '\u2713'}`);
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
