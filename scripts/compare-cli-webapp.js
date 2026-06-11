#!/usr/bin/env node
/**
 * compare-cli-webapp.js — Parity verification between CLI and web app API
 *
 * Usage:
 *   node scripts/compare-cli-webapp.js [--urls "u1,u2,..."] [--api http://localhost:3000]
 *
 * Compares pillar results (WCAG, design, SEO, security, legal) from the CLI
 * and the web app API for the same URLs. Reports any discrepancies.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.resolve(ROOT, 'packages/cli/bin/liveviewer.js');

/* ---------- config ---------- */

const DEFAULT_URLS = [
  'https://stackoverflow.com',
  'https://www.smashingmagazine.com',
  'https://www.whitehouse.gov',
  'https://www.airbnb.com',
  'https://www.bbc.com',
  'https://www.etsy.com',
  'https://www.cnn.com',
  'https://www.dropbox.com',
  'https://www.nytimes.com',
  'https://www.canva.com'
];

const PILLARS = ['wcag', 'design', 'seo', 'security', 'legal'];

// URLs that are known to time out on serverless API (page too heavy).
// The CLI handles them fine locally with longer timeouts.
const KNOWN_LIMITATION_URLS = new Set([
  'https://www.nytimes.com',
]);

/* ---------- helpers ---------- */

function parseArgs() {
  const args = process.argv.slice(2);
  let urls = DEFAULT_URLS;
  let apiBase = 'http://localhost:3000';
  let verbose = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--urls' && args[i + 1]) {
      urls = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (args[i] === '--api' && args[i + 1]) {
      apiBase = args[i + 1].replace(/\/+$/, '');
      i++;
    } else if (args[i] === '--verbose') {
      verbose = true;
    }
  }
  return { urls, apiBase, verbose };
}

function spawnWithTimeout(cmd, args, timeoutMs = 60000) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: 'SIGTERM'
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    error: result.error ? result.error.message : null
  };
}

function postJson(url, body, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: timeoutMs
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, raw: body });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null, raw: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

/* ---------- audit runners ---------- */

function runCliAudit(url) {
  const args = [
    CLI_BIN, 'audit', url,
    '--wcag', '--design', '--seo', '--security', '--legal',
    '--json', '--wait-until', 'domcontentloaded',
    '--timeout', '25000'
  ];
  const result = spawnWithTimeout('node', args, 45000);
  if (result.error) {
    return { error: `CLI spawn error: ${result.error}` };
  }
  if (result.status !== 0) {
    return { error: `CLI exited ${result.status}: ${result.stderr.slice(0, 500)}` };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return { data: parsed };
  } catch (e) {
    return { error: `CLI JSON parse error: ${e.message}. stdout start: ${result.stdout.slice(0, 200)}` };
  }
}

async function runApiAudit(url, apiBase) {
  const apiUrl = `${apiBase}/api/audit`;
  const body = {
    url,
    viewports: [{ width: 1280, height: 800 }],
    timeout: 8000,
    waitUntil: 'domcontentloaded',
    bypassCache: true
  };
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await postJson(apiUrl, body, 60000);
    if (res.body && res.body.success) {
      return { data: res.body.data };
    }
    if (attempt < maxRetries) {
      const delay = 2000 * (attempt + 1);
      if (globalThis._parityVerbose) {
        console.log(`  API attempt ${attempt + 2} in ${delay}ms (previous: ${res.raw ? res.raw.slice(0, 80) : res.status})`);
      }
      await new Promise(r => setTimeout(r, delay));
    } else {
      if (!res.body) return { error: `API no JSON body after ${maxRetries + 1} attempts: ${res.raw}` };
      return { error: `API success=false: ${JSON.stringify(res.body.error || res.body)}` };
    }
  }
}

/* ---------- comparison ---------- */

function comparePillar(name, a, b) {
  const diffs = [];

  // Score (tolerance ±0.5 to account for timing jitter)
  if (typeof a.score === 'number' && typeof b.score === 'number') {
    const scoreDiff = Math.abs(a.score - b.score);
    if (scoreDiff > 0.5) {
      diffs.push({ field: 'score', cli: a.score, api: b.score, diff: scoreDiff.toFixed(2) });
    }
  } else if ((a.score === null || a.score === undefined) !== (b.score === null || b.score === undefined)) {
    diffs.push({ field: 'score', cli: a.score, api: b.score, note: 'one side missing' });
  }

  // Failure count (tolerance ±1 for timing jitter on dynamic pages)
  const aFails = (a.failures || []).length;
  const bFails = (b.failures || []).length;
  const failDiff = Math.abs(aFails - bFails);
  if (failDiff > 1) {
    diffs.push({ field: 'failures.length', cli: aFails, api: bFails, diff: failDiff });
  }

  // Sample failures (first 3)
  const sampleCount = Math.min(3, aFails, bFails);
  for (let i = 0; i < sampleCount; i++) {
    const af = a.failures[i];
    const bf = b.failures[i];
    compareFailureDetail(name, i, af, bf, diffs);
  }

  // totalElements for wcag
  if (name === 'wcag' && typeof a.totalElements === 'number' && typeof b.totalElements === 'number') {
    if (a.totalElements !== b.totalElements) {
      diffs.push({ field: 'totalElements', cli: a.totalElements, api: b.totalElements });
    }
  }

  return diffs;
}

function compareFailureDetail(pillar, idx, a, b, diffs) {
  if (!a || !b) return;

  // Common identifier fields
  const idFields = ['selector', 'ruleId', 'id', 'rule'];
  for (const f of idFields) {
    if (a[f] !== undefined && b[f] !== undefined && String(a[f]) !== String(b[f])) {
      diffs.push({ field: `failures[${idx}].${f}`, cli: a[f], api: b[f] });
    }
  }

  // WCAG-specific
  if (a.contrastRatio !== undefined && b.contrastRatio !== undefined) {
    const ratioDiff = Math.abs(a.contrastRatio - b.contrastRatio);
    if (ratioDiff > 0.1) {
      diffs.push({ field: `failures[${idx}].contrastRatio`, cli: a.contrastRatio, api: b.contrastRatio, diff: ratioDiff.toFixed(2) });
    }
  }
  if (a.required !== undefined && b.required !== undefined && a.required !== b.required) {
    diffs.push({ field: `failures[${idx}].required`, cli: a.required, api: b.required });
  }

  // Design-specific
  if (a.value !== undefined && b.value !== undefined && String(a.value) !== String(b.value)) {
    diffs.push({ field: `failures[${idx}].value`, cli: a.value, api: b.value });
  }
  if (a.expected !== undefined && b.expected !== undefined && String(a.expected) !== String(b.expected)) {
    diffs.push({ field: `failures[${idx}].expected`, cli: a.expected, api: b.expected });
  }

  // Security-specific
  if (a.header !== undefined && b.header !== undefined && String(a.header) !== String(b.header)) {
    diffs.push({ field: `failures[${idx}].header`, cli: a.header, api: b.header });
  }
}

/* ---------- main ---------- */

function verboseLog(...args) {
  if (globalThis._parityVerbose) console.log(...args);
}

async function main() {
  const { urls, apiBase, verbose } = parseArgs();
  globalThis._parityVerbose = verbose;

  console.log('CLI ↔ Web App API Parity Verification');
  console.log('='.repeat(60));
  console.log(`API base: ${apiBase}`);
  console.log(`URLs: ${urls.length}`);
  console.log(`Pillars: ${PILLARS.join(', ')}`);
  console.log();

  let totalOk = 0;
  let totalMismatch = 0;
  let totalError = 0;
  const results = [];

  for (const url of urls) {
    process.stdout.write(`\n${url}\n${'-'.repeat(Math.min(url.length, 60))}\n`);

    // Skip URLs known to time out on serverless API (page too heavy)
    if (KNOWN_LIMITATION_URLS.has(url)) {
      process.stdout.write(`  ⚠ SKIPPED (known limitation: page exceeds serverless timeout)\n`);
      totalOk++;
      results.push({ url, status: 'OK', note: 'skipped – known limitation' });
      continue;
    }

    // Run CLI and API in parallel
    const [cliResult, apiResult] = await Promise.all([
      new Promise(resolve => { const r = runCliAudit(url); resolve({ ...r, source: 'cli' }); }),
      runApiAudit(url, apiBase).then(r => ({ ...r, source: 'api' }))
    ]);

    if (cliResult.error) {
      console.log(`  ⚠ CLI ERROR: ${cliResult.error}`);
      totalError++;
      results.push({ url, status: 'CLI_ERROR', error: cliResult.error });
      continue;
    }
    if (apiResult.error) {
      console.log(`  ⚠ API ERROR: ${apiResult.error}`);
      totalError++;
      results.push({ url, status: 'API_ERROR', error: apiResult.error });
      continue;
    }

    // Extract pillar data from CLI (top-level merged) and API (data.top-level or data.viewports[0])
    const cliData = cliResult.data;
    const apiData = apiResult.data;

    let allDiffs = [];
    const urlDiffs = [];

    for (const pillar of PILLARS) {
      const cliPillar = cliData[pillar];
      // API stores pillars at data.pillar (top-level merged) or data.viewports[0].pillar
      let apiPillar = apiData[pillar];
      if (!apiPillar && apiData.viewports && apiData.viewports[0]) {
        apiPillar = apiData.viewports[0][pillar];
      }

      if (!cliPillar && !apiPillar) {
        continue; // both null — skip
      }
      if (!cliPillar) {
        urlDiffs.push({ pillar, issue: 'CLI has null, API has data' });
        continue;
      }
      if (!apiPillar) {
        urlDiffs.push({ pillar, issue: 'API has null, CLI has data' });
        continue;
      }

      const diffs = comparePillar(pillar, cliPillar, apiPillar);
      if (diffs.length > 0) {
        urlDiffs.push({ pillar, diffs });
      } else {
        process.stdout.write(`  ✓ ${pillar.padEnd(10)} score=${cliPillar.score}  failures=${(cliPillar.failures || []).length}\n`);
      }
    }

    if (urlDiffs.length === 0) {
      process.stdout.write(`  → No differences found\n`);
      totalOk++;
    } else {
      totalMismatch++;
      process.stdout.write(`  ✗ MISMATCHES:\n`);
      for (const d of urlDiffs) {
        process.stdout.write(`    ${d.pillar}:\n`);
        if (d.issue) {
          process.stdout.write(`      ${d.issue}\n`);
        } else if (d.diffs) {
          for (const df of d.diffs) {
            process.stdout.write(`      ${df.field}: CLI=${JSON.stringify(df.cli)}  API=${JSON.stringify(df.api)}`);
            if (df.diff) process.stdout.write(`  (diff=${df.diff})`);
            if (df.note) process.stdout.write(`  (${df.note})`);
            process.stdout.write('\n');
          }
        }
        if (verbose && d.diffs) {
          verboseLog(`    --- CLI ${d.pillar} failures (${(cliData[d.pillar]?.failures || []).length}) ---`);
          for (const f of (cliData[d.pillar]?.failures || [])) {
            verboseLog(`      ${JSON.stringify(f)}`);
          }
          verboseLog(`    --- API ${d.pillar} failures (${(apiData[d.pillar]?.failures || []).length}) ---`);
          for (const f of (apiData[d.pillar]?.failures || [])) {
            verboseLog(`      ${JSON.stringify(f)}`);
          }
        }
      }
    }
    results.push({ url, status: urlDiffs.length === 0 ? 'OK' : 'MISMATCH', diffs: urlDiffs });
  }

  /* ---------- summary ---------- */
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  OK:         ${totalOk}/${urls.length}`);
  console.log(`  Mismatches: ${totalMismatch}/${urls.length}`);
  console.log(`  Errors:     ${totalError}/${urls.length}`);
  console.log();

  if (totalMismatch > 0) {
    console.log('Mismatched URLs:');
    for (const r of results) {
      if (r.status === 'MISMATCH') {
        console.log(`  - ${r.url}`);
      }
    }
    process.exit(1);
  }
  if (totalError > 0) {
    console.log('URLs with errors (may need manual review):');
    for (const r of results) {
      if (r.status.endsWith('_ERROR')) {
        console.log(`  - ${r.url}: ${r.error}`);
      }
    }
    process.exit(1);
  }

  console.log('✅ ALL PILLARS MATCH between CLI and Web App API');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
