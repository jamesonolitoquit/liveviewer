/**
 * Liveviewer CLI ↔ Web App Parity Test
 *
 * Verifies that CLI and web app produce identical design QA results
 * for the same URL and viewports.
 *
 * Usage:
 *   node scripts/parity-test.mjs <url> [webAppBaseUrl]
 *
 * Examples:
 *   node scripts/parity-test.mjs https://jao-liveviewer.vercel.app
 *   node scripts/parity-test.mjs https://example.com http://localhost:3000
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'liveviewer.js');

const TARGET_URL = process.argv[2];
const WEB_APP_BASE = process.argv[3] || 'https://jao-liveviewer.vercel.app';

if (!TARGET_URL) {
  console.error('Usage: node scripts/parity-test.mjs <url> [webAppBaseUrl]');
  process.exit(1);
}

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 }
];
const VIEWPORT_STR = VIEWPORTS.map(v => `${v.width}x${v.height}`).join(',');

let passed = 0;
let failed = 0;

function ok(label) { passed++; console.log(`  ✓ ${label}`); }
function fail(label, detail) { failed++; console.error(`  ✗ ${label}: ${detail}`); }

function normalizeSelector(sel) {
  return sel.replace(/\s+/g, ' ').trim().toLowerCase();
}

function fingerprint(failure) {
  return `${failure.ruleId}|${normalizeSelector(failure.selector)}|${failure.value}|${failure.expected}`;
}

function fingerprintSet(failures) {
  return new Set((failures || []).map(fingerprint));
}

function collectFailures(auditResult) {
  const design = auditResult.design;
  if (!design || !Array.isArray(design.failures)) return [];
  return design.failures.map(f => ({
    ruleId: f.ruleId,
    selector: f.selector,
    value: f.value,
    expected: f.expected,
    severity: f.severity
  }));
}

// --- CLI audit (run via temp inline script) ---
async function runCliAudit() {
  const tmpScript = path.join(REPO_ROOT, 'scripts', '.tmp-parity-cli.cjs');
  const fs = await import('fs');

  const auditorPath = path.join(REPO_ROOT, 'packages', 'core', 'src', 'auditor.js');

  // Write a temporary CJS script that imports the auditor, calls audit, and prints JSON
  const code = `
const { audit } = require('${auditorPath.replace(/\\/g, '\\\\')}');
(async () => {
  try {
    const result = await audit('${TARGET_URL.replace(/'/g, "\\'")}', {
      design: true,
      wcag: false,
      viewports: ${JSON.stringify(VIEWPORTS)},
      timeout: 30000
    });
    // Remove screenshot path and other machine-specific fields
    const clean = {
      design: result.design
    };
    process.stdout.write(JSON.stringify(clean));
  } catch (err) {
    process.stderr.write('CLI_ERROR:' + err.message);
    process.exit(1);
  }
})();
`;

  fs.writeFileSync(tmpScript, code, 'utf-8');

  const child = spawnSync('node', [tmpScript], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024
  });

  // Clean up
  try { fs.unlinkSync(tmpScript); } catch (_) {}

  if (child.error) {
    throw new Error(`CLI spawn error: ${child.error.message}`);
  }
  if (child.stderr && child.stderr.includes('CLI_ERROR:')) {
    throw new Error(`CLI audit error: ${child.stderr.replace('CLI_ERROR:', '').trim()}`);
  }
  if (child.status !== 0) {
    throw new Error(`CLI exited with code ${child.status}: ${child.stderr.slice(0, 200)}`);
  }

  try {
    return JSON.parse(child.stdout);
  } catch (e) {
    throw new Error(`Failed to parse CLI output: ${e.message}\nstdout: ${child.stdout.slice(0, 200)}`);
  }
}

// --- Web app API audit ---
async function runWebAudit() {
  const body = JSON.stringify({
    url: TARGET_URL,
    wcag: false,
    design: true,
    viewports: VIEWPORTS
  });

  const res = await fetch(`${WEB_APP_BASE}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Web app returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!json.success) {
    throw new Error(`Web app audit failed: ${json.error || text.slice(0, 200)}`);
  }
  return json.data;
}

// ---- Main ----
async function main() {
  console.log(`\nParity test: ${TARGET_URL}`);
  console.log(`  CLI:  node ${path.relative(REPO_ROOT, CLI)} audit ... --design --viewports ${VIEWPORT_STR}`);
  console.log(`  Web:  ${WEB_APP_BASE}/api/audit\n`);

  // Run CLI
  let cliResult;
  try {
    console.log('Running CLI audit...');
    cliResult = await runCliAudit();
    ok('CLI audit completed');
  } catch (err) {
    fail('CLI audit', err.message);
    console.error('\nCLI result unavailable — skipping comparison');
    printSummary();
    process.exit(1);
  }

  // Run web app
  let webResult;
  try {
    console.log('Running web app audit...');
    webResult = await runWebAudit();
    ok('Web app audit completed');
  } catch (err) {
    fail('Web app audit', err.message);
    console.error('\nWeb app result unavailable — skipping comparison');
    printSummary();
    process.exit(1);
  }

  // Extract failures
  const cliFailures = collectFailures(cliResult);
  const webFailures = collectFailures(webResult);

  // Compare counts
  const cliCount = cliFailures.length;
  const webCount = webFailures.length;

  if (cliCount === webCount) {
    ok(`Failure count: ${cliCount} (CLI) === ${webCount} (Web)`);
  } else {
    fail('Failure count mismatch', `${cliCount} (CLI) !== ${webCount} (Web)`);
  }

  // Compare fingerprints
  const cliFps = fingerprintSet(cliFailures);
  const webFps = fingerprintSet(webFailures);

  const onlyCli = [...cliFps].filter(f => !webFps.has(f));
  const onlyWeb = [...webFps].filter(f => !cliFps.has(f));

  if (onlyCli.length === 0 && onlyWeb.length === 0) {
    ok('Failure fingerprints match exactly');
  } else {
    if (onlyCli.length > 0) {
      fail('Failures only in CLI', onlyCli.join('\n            '));
    }
    if (onlyWeb.length > 0) {
      fail('Failures only in Web', onlyWeb.join('\n            '));
    }
  }

  // Spot-check selectors if counts match
  if (cliFailures.length > 0 && cliCount === webCount) {
    const sortedCli = [...cliFailures].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.selector.localeCompare(b.selector));
    const sortedWeb = [...webFailures].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.selector.localeCompare(b.selector));

    for (let i = 0; i < Math.min(sortedCli.length, sortedWeb.length); i++) {
      const a = sortedCli[i];
      const b = sortedWeb[i];
      const key = `${a.ruleId}|${normalizeSelector(a.selector)}`;
      if (normalizeSelector(a.selector) !== normalizeSelector(b.selector) || a.value !== b.value || a.expected !== b.expected) {
        fail(`Mismatch at index ${i}: ${key}`, `CLI: ${a.value} → ${a.expected}, Web: ${b.value} → ${b.expected}`);
      }
    }
    ok('All failure details match across CLI and web app');
  }

  printSummary();
}

function printSummary() {
  const total = passed + failed;
  console.log(`\n  ${passed}/${total} checks passed` + (failed > 0 ? `, ${failed} failed` : ''));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
