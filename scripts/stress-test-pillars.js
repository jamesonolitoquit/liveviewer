#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.resolve(ROOT, 'packages/cli/bin/liveviewer.js');
const AUDITS_DIR = path.resolve(ROOT, 'audits');
const BENCH_SCRIPTS = {
  'Design QA': 'scripts/benchmark-design.js',
  'Accessibility': 'scripts/benchmark-accessibility.js',
  'SEO': 'scripts/benchmark-seo.js',
  'Security': 'scripts/benchmark-security.js',
  'Legal': 'scripts/benchmark-legal.js',
  'Performance': 'scripts/benchmark-performance.js',
  'AI Detection': 'scripts/benchmark-ai.js',
  'Mobile': 'scripts/benchmark-mobile.js',
};
const TEST_URLS = [
  'https://example.com',
  'https://web.dev',
  'https://github.com',
  'https://stackoverflow.com',
  'https://wikipedia.org',
  'https://developer.mozilla.org',
  'https://www.whitehouse.gov',
];

const passFailures = [];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024,
    timeout: 300000, ...opts,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    error: result.error,
    signal: result.signal,
  };
}

function latestAuditFile(label) {
  if (!fs.existsSync(AUDITS_DIR)) return null;
  const files = fs.readdirSync(AUDITS_DIR)
    .filter(f => f.startsWith(label) && f.endsWith('.json'))
    .sort().reverse();
  if (files.length === 0) return null;
  return path.join(AUDITS_DIR, files[0]);
}

function slugify(url) {
  return url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
}

function expect(val, desc) {
  if (!val) passFailures.push(desc);
  return val;
}

function printBanner(text) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${text}`);
  console.log(`${'='.repeat(70)}`);
}

function checkScore(score, label) {
  if (typeof score !== 'number' || isNaN(score)) {
    passFailures.push(`${label}: score is NaN or missing`);
    return 'FAIL';
  }
  if (score < 0 || score > 100) {
    passFailures.push(`${label}: score ${score} out of range [0-100]`);
    return 'FAIL';
  }
  if (score === 0) {
    passFailures.push(`${label}: score is 0% — possible anomaly`);
    return 'WARN';
  }
  return 'PASS';
}

async function runBenchmarks() {
  printBanner('PHASE 1: Pillar Benchmarks');
  const results = {};

  for (const [name, script] of Object.entries(BENCH_SCRIPTS)) {
    process.stdout.write(`  Running ${name} benchmark...`);
    const start = Date.now();
    const result = run('node', [path.resolve(ROOT, script)], { timeout: 300000 });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const hasError = result.error || result.status !== 0;

    if (hasError) {
      console.log(` FAIL (${elapsed}s)`);
      passFailures.push(`${name} benchmark exited with ${result.status}`);
      results[name] = { pass: false, output: result.stdout + result.stderr };
    } else {
      console.log(` OK (${elapsed}s)`);
      results[name] = { pass: true, output: result.stdout + result.stderr };
    }
  }
  return results;
}

async function runRealWorldAudits() {
  printBanner('PHASE 2: Real-World URL Audits');
  const audits = [];

  for (const url of TEST_URLS) {
    const label = slugify(url);
    console.log(`\n  Auditing: ${url}`);

    // Cleanup old audit files
    if (fs.existsSync(AUDITS_DIR)) {
      const old = fs.readdirSync(AUDITS_DIR).filter(f => f.startsWith(label));
      for (const f of old) {
        try { fs.unlinkSync(path.join(AUDITS_DIR, f)); } catch (_) {}
      }
    } else {
      fs.mkdirSync(AUDITS_DIR, { recursive: true });
    }

    const start = Date.now();
    const result = run('node', [CLI_BIN, 'audit', url, '--all', '--timeout', '60000', '--label', label], { timeout: 120000 });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (result.error) {
      console.log(`  \u2717 CLI error (${elapsed}s): ${result.error.message}`);
      audits.push({ url, label, error: result.error.message, elapsed });
      continue;
    }

    if (result.status !== 0) {
      console.log(`  \u26A0 CLI exit ${result.status} (${elapsed}s)`);
    } else {
      console.log(`  \u2713 CLI exit 0 (${elapsed}s)`);
    }

    // Read audit JSON
    const jsonPath = latestAuditFile(label);
    if (!jsonPath) {
      console.log(`  \u2717 No audit JSON found`);
      audits.push({ url, label, error: 'no audit JSON', elapsed });
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (e) {
      console.log(`  \u2717 Parse error: ${e.message}`);
      audits.push({ url, label, error: 'parse error', elapsed });
      continue;
    }

    // Cleanup
    try { fs.unlinkSync(jsonPath); } catch (_) {}
    const pngPath = jsonPath.replace('.json', '.png');
    if (fs.existsSync(pngPath)) try { fs.unlinkSync(pngPath); } catch (_) {}

    // Extract pillar scores
    const scores = {};
    for (const pillar of ['wcag', 'design', 'seo', 'security', 'legal', 'performance', 'ai', 'mobile']) {
      const p = data[pillar];
      if (p && p.score !== undefined) {
        scores[pillar] = p.score;
      } else if (p && p.error) {
        scores[pillar] = `error: ${p.error}`;
      } else {
        scores[pillar] = null;
      }
    }

    audits.push({ url, label, scores, elapsed, error: data.error || null });

    // Display scores
    const scoreLine = Object.entries(scores)
      .map(([k, v]) => `${k}:${typeof v === 'number' ? v + '%' : v}`)
      .join('  ');
    console.log(`  Scores:     ${scoreLine}`);

    // Check for error response
    if (data.error) {
      console.log(`  \u2717 Audit error: ${data.error}`);
      passFailures.push(`URL ${url} returned audit error: ${data.error}`);
    }

    // Validate score ranges
    for (const [pillar, score] of Object.entries(scores)) {
      if (typeof score === 'number') {
        const labelStr = `${url} ${pillar}`;
        if (score === 0 && pillar !== 'legal' && pillar !== 'ai' && pillar !== 'mobile') {
          if (url !== 'https://example.com' || pillar !== 'security') {
            passFailures.push(`${labelStr}: score is 0%`);
            console.log(`    \u26A0 ${pillar}: 0% score flagged`);
          }
        }
        if (score < 0 || score > 100) {
          passFailures.push(`${labelStr}: score ${score} out of range`);
        }
      }
    }

    // Check WCAG: example.com should have near-perfect contrast
    if (url === 'https://example.com' && data.wcag && data.wcag.score !== undefined) {
      if (data.wcag.score < 90) {
        passFailures.push(`${url} WCAG score ${data.wcag.score}% — expected >90% for simple page`);
      }
      expect(data.wcag.totalElements > 0, `${url} WCAG: no elements found`);
    }
  }

  return audits;
}

function analyzeBenchmarks(benchResults) {
  printBanner('PHASE 3: Analysis');

  let allPass = true;
  for (const [name, result] of Object.entries(benchResults)) {
    const output = result.output;
    const hasFailures = output.includes('FAIL') || output.includes('failed') ||
      (output.includes('FP:') && output.includes('FN:') &&
       !output.includes('FP:0  FN:0'));
    const status = result.pass && !hasFailures ? '\u2713' : '\u2717';
    console.log(`  ${status} ${name}: ${result.pass ? 'exit 0' : 'exit non-zero'}`);
    if (hasFailures) {
      console.log(`      Check output above for FP/FN mismatches`);
      allPass = false;
    }
  }

  console.log(`\n  Benchmarks: ${allPass ? 'ALL PASS' : 'SOME FAILURES'}`);
  return allPass;
}

function printSummary(benchPass, audits) {
  printBanner('SUMMARY');

  const totalErrors = audits.filter(a => a.error).length;
  const successful = audits.filter(a => !a.error);
  const avgScores = {};
  let scoreCount = 0;

  for (const a of successful) {
    if (!a.scores) continue;
    scoreCount++;
    for (const [pillar, score] of Object.entries(a.scores)) {
      if (typeof score === 'number') {
        if (!avgScores[pillar]) avgScores[pillar] = { sum: 0, count: 0 };
        avgScores[pillar].sum += score;
        avgScores[pillar].count++;
      }
    }
  }

  console.log(`  Benchmarks:      ${benchPass ? '\u2713 PASS' : '\u2717 FAILED'}`);
  console.log(`  URLs tested:     ${audits.length}`);
  console.log(`  Successful:      ${successful.length}`);
  console.log(`  Audit errors:    ${totalErrors}`);

  if (scoreCount > 0) {
    console.log(`\n  Average pillar scores (${scoreCount} URLs):`);
    for (const [pillar, { sum, count }] of Object.entries(avgScores)) {
      const avg = (sum / count).toFixed(1);
      console.log(`    ${pillar.padEnd(15)} ${avg}%`);
    }
  }

  if (passFailures.length > 0) {
    console.log(`\n  \u2717 Anomalies (${passFailures.length}):`);
    for (const pf of passFailures) {
      console.log(`    - ${pf}`);
    }
  } else {
    console.log(`\n  \u2713 No anomalies detected`);
  }

  const verdict = benchPass && passFailures.length === 0 && totalErrors === 0;
  console.log(`\n  \u2500${'\u2500'.repeat(40)}`);
  console.log(`  VERDICT: ${verdict ? 'ALL PILLARS PASS STRESS TEST' : 'SOME ISSUES DETECTED'}`);
  console.log(`  ${'='.repeat(42)}`);
}

async function main() {
  // Ensure audits directory exists
  if (!fs.existsSync(AUDITS_DIR)) fs.mkdirSync(AUDITS_DIR, { recursive: true });

  // Phase 1: Benchmarks
  const benchResults = await runBenchmarks();
  const benchPass = analyzeBenchmarks(benchResults);

  // Phase 2: Real-world audits
  const audits = await runRealWorldAudits();

  // Phase 3: Summary
  printSummary(benchPass, audits);

  process.exit(passFailures.length > 0 || !benchPass ? 1 : 0);
}

main().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
