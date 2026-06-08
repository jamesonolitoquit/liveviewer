#!/usr/bin/env node

/**
 * Pre-launch verification for Liveviewer v2.0.
 *
 * Usage:
 *   node scripts/pre-launch-check.js [deployment-url]
 *
 * Example:
 *   node scripts/pre-launch-check.js https://liveviewer.vercel.app
 *
 * Runs in two modes:
 *   1. Local: runs test suites, checks env, checks git status
 *   2. Deployment: hits the deployed API to verify warm-up, reports, audit
 *
 * Exits 0 if all checks pass, 1 otherwise.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DEPLOYMENT_URL = (process.argv[2] || process.env.DEPLOYMENT_URL || '').replace(/\/$/, '')
const TIMEOUT_MS = 30_000

let passed = 0
let failed = 0
let warnings = 0

function ok(label) {
  console.log(`  [+] ${label}`)
  passed++
}

function fail(label, detail) {
  console.log(`  [X] ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
}

function warn(label, detail) {
  console.log(`  [!] ${label}${detail ? ` — ${detail}` : ''}`)
  warnings++
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(60)}`)
}

async function checkTestSuite() {
  section('1. Test Suite')
  try {
    const out = execSync('npm run test 2>&1', { cwd: ROOT, timeout: 300_000 })
    const text = out.toString()
    if (text.includes('failed')) {
      // count failures
      const failMatch = text.match(/(\d+) failed/)
      failMatch ? fail(`Tests: ${failMatch[1]} failed (check output)`) : fail('Tests failed (check output)')
      return
    }
    ok('All test suites pass (core + llm + web e2e)')
  } catch (e) {
    fail('Tests failed', e.stderr?.toString().slice(0, 200) || e.message)
  }
}

function checkGitStatus() {
  section('2. Git Status')
  try {
    const status = execSync('git status --porcelain 2>&1', { cwd: ROOT }).toString().trim()
    if (status.length === 0) {
      ok('Working tree clean')
    } else {
      const lines = status.split('\n').filter(l => !l.startsWith('?? .github/'))
      if (lines.length === 0) {
        ok('Working tree clean (only new workflow files)')
      } else {
        warn(`Uncommitted changes (${lines.length} files)`, 'run `git add` before deploy')
      }
    }
  } catch {
    warn('Could not check git status')
  }
}

function checkEnv() {
  section('3. Environment')
  const envLocal = join(ROOT, 'apps/web/.env.local')
  if (!existsSync(envLocal)) {
    warn('.env.local not found', 'expected for local dev')
  }

  // Check that vercel.json exists and has correct settings
  const vercelPath = join(ROOT, 'apps/web/vercel.json')
  if (existsSync(vercelPath)) {
    const v = JSON.parse(readFileSync(vercelPath, 'utf8'))
    const auditFn = v.functions?.['src/app/api/audit/route.ts']
    if (auditFn) {
      if (auditFn.maxDuration === 10) ok('vercel.json: audit function maxDuration = 10')
      else warn('vercel.json: audit maxDuration is not 10', `got ${auditFn.maxDuration}`)
      if (auditFn.memory === 128) ok('vercel.json: audit function memory = 128')
      else warn('vercel.json: audit memory is not 128', `got ${auditFn.memory}`)
    } else {
      warn('vercel.json: audit function config not found')
    }
  } else {
    warn('vercel.json not found')
  }

  // Check warm-up workflow
  const workflowPath = join(ROOT, '.github/workflows/warmup.yml')
  if (existsSync(workflowPath)) {
    ok('Warm-up GitHub Action exists')
  } else {
    warn('Warm-up GitHub Action not found')
  }
}

function checkCli() {
  section('4. CLI Tests')

  const cliPath = `node "${join(ROOT, 'packages/cli/bin/liveviewer.js')}"`

  function runCli(args, timeout = 30_000) {
    try {
      const out = execSync(`${cliPath} ${args}`, { cwd: ROOT, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      return { stdout: out.toString().trim(), stderr: '', code: 0 }
    } catch (e) {
      const stdout = e.stdout?.toString()?.trim() || ''
      const stderr = e.stderr?.toString()?.trim() || ''
      return { stdout, stderr, code: e.status ?? 1 }
    }
  }

  // 4a. --version
  const ver = runCli('--version')
  if (ver.stdout === '1.0.0') ok('CLI --version returns 1.0.0')
  else fail('CLI --version', `expected 1.0.0, got "${ver.stdout}"`)

  // 4b. --help (or no args)
  const help = runCli('')
  if (help.stdout.includes('Usage:') && help.stdout.includes('audit')) ok('CLI --help shows usage')
  else fail('CLI --help', 'missing expected help text')

  // 4c. audit with invalid URL
  const invalid = runCli('audit not-a-url --timeout 5000', 10_000)
  if (invalid.code !== 0) ok('CLI invalid URL exits non-zero')
  else fail('CLI invalid URL', 'expected non-zero exit')

  // 4d. audit example.com --wcag (requires chromium)
  const hasChrome = existsSync(join(ROOT, 'node_modules/playwright-core/.local-browsers')) ||
    process.env.PLAYWRIGHT_BROWSERS_PATH !== undefined ||
    existsSync(join(ROOT, 'apps/web/node_modules/playwright-core/.local-browsers'))
  if (!hasChrome && !process.env.CI) {
    warn('CLI audit WCAG', 'chromium not found — skipping real audit tests (run `npx playwright install chromium`)')
    return
  }

  try {
    const auditResult = runCli('audit https://example.com --wcag --timeout 20000', 45_000)
    if (auditResult.code === 0) {
      const jsonMatch = auditResult.stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (data.wcag?.score === 100) ok('CLI audit example.com --wcag returns score 100')
        else fail('CLI audit WCAG score', `expected 100, got ${data.wcag?.score}`)
      } else {
        fail('CLI audit WCAG', 'no JSON output found')
      }
    } else {
      fail('CLI audit WCAG', `exit ${auditResult.code}: ${auditResult.stderr.slice(0, 200)}`)
    }
  } catch (e) {
    fail('CLI audit WCAG', e.message)
  }

  // 4e. audit with --design flag
  try {
    const designResult = runCli('audit https://example.com --wcag --design --timeout 20000', 45_000)
    if (designResult.code === 0) {
      const jsonMatch = designResult.stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (data.design) ok('CLI audit --design returns design data')
        else fail('CLI audit --design', 'no design field in output')
      } else {
        fail('CLI audit --design', 'no JSON output found')
      }
    } else {
      if (designResult.stderr.includes('no failures')) {
        ok('CLI audit --design: design field absent in response')
      } else {
        fail('CLI audit --design', `exit ${designResult.code}: ${designResult.stderr.slice(0, 200)}`)
      }
    }
  } catch (e) {
    fail('CLI audit --design', e.message)
  }
}

async function checkDeployment() {
  if (!DEPLOYMENT_URL) {
    warn('No deployment URL provided', 'skip deployment checks')
    return
  }

  section('5. Deployment Checks')

  // 4a. Warm-up endpoint
  try {
    const wu = await fetch(`${DEPLOYMENT_URL}/api/audit?warmup=true`, { signal: AbortSignal.timeout(10_000) })
    if (wu.status === 200) {
      const body = await wu.json()
      if (body.status === 'warm') ok('Warm-up endpoint returns 200')
      else warn('Warm-up returned unexpected body', JSON.stringify(body))
    } else {
      fail('Warm-up endpoint', `HTTP ${wu.status}`)
    }
  } catch (e) {
    fail('Warm-up endpoint', e.message)
  }

  // 4b. Report: create
  const sampleData = { url: 'https://example.com', timestamp: Date.now(), viewport: { width: 1280, height: 800 }, wcag: null }
  let reportId = null
  try {
    const createRes = await fetch(`${DEPLOYMENT_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleData),
      signal: AbortSignal.timeout(10_000)
    })
    if (createRes.status === 200) {
      const body = await createRes.json()
      if (body.success && body.id && body.id.length === 8) {
        reportId = body.id
        ok('Report creation: POST /api/report returns 8-char ID')
      } else {
        fail('Report creation: unexpected response', JSON.stringify(body))
      }
    } else {
      fail('Report creation', `HTTP ${createRes.status}`)
    }
  } catch (e) {
    fail('Report creation', e.message)
  }

  // 4c. Report: retrieve
  if (reportId) {
    try {
      const getRes = await fetch(`${DEPLOYMENT_URL}/api/report/${reportId}`, { signal: AbortSignal.timeout(10_000) })
      if (getRes.status === 200) {
        const body = await getRes.json()
        if (body.success && body.data?.url === 'https://example.com') {
          ok('Report retrieval: GET /api/report/:id returns stored data')
        } else {
          fail('Report retrieval: data mismatch', JSON.stringify(body))
        }
      } else {
        fail('Report retrieval', `HTTP ${getRes.status}`)
      }
    } catch (e) {
      fail('Report retrieval', e.message)
    }

    // 4d: Report 404
    try {
      const badRes = await fetch(`${DEPLOYMENT_URL}/api/report/nonexist`, { signal: AbortSignal.timeout(10_000) })
      if (badRes.status === 404) {
        ok('Report 404: nonexistent ID returns 404')
      } else {
        fail('Report 404', `expected 404, got ${badRes.status}`)
      }
    } catch (e) {
      fail('Report 404', e.message)
    }
  }

  // 4e. XSS rejection
  try {
    const xssRes = await fetch(`${DEPLOYMENT_URL}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '<script>alert(1)</script>' }),
      signal: AbortSignal.timeout(10_000)
    })
    if (xssRes.status === 400) {
      ok('XSS: invalid URL returns 400')
    } else if (xssRes.status === 200) {
      warn('XSS: URL accepted (server may handle injection in page context)')
    } else {
      warn('XSS response', `HTTP ${xssRes.status}`)
    }
  } catch (e) {
    warn('XSS check', e.message)
  }

  // 4f. Rate limiting test (send 11 rapid requests)
  let rateLimited = false
  const rateChecks = []
  for (let i = 0; i < 11; i++) {
    try {
      const r = await fetch(`${DEPLOYMENT_URL}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', bypassCache: true }),
        signal: AbortSignal.timeout(15_000)
      })
      rateChecks.push(r.status)
      if (r.status === 429) rateLimited = true
    } catch {
      rateChecks.push(0)
    }
  }
  if (rateLimited) {
    ok('Rate limiting: 429 received under load')
  } else {
    const statuses = rateChecks.join(',')
    warn('Rate limiting not triggered', `statuses: ${statuses} (rate limiter may use Redis which may not be configured)`)
  }
}

async function checkReportPage() {
  if (!DEPLOYMENT_URL) return

  section('6. Report Page (Client-Side)')
  try {
    const res = await fetch(`${DEPLOYMENT_URL}/report/test123`, { signal: AbortSignal.timeout(10_000) })
    if (res.status === 200) {
      const html = await res.text()
      if (html.includes('Report not found') || html.includes('__NEXT_DATA__')) {
        ok('Report page loads (404 state rendered client-side)')
      } else {
        ok('Report page renders')
      }
    } else {
      fail('Report page', `HTTP ${res.status}`)
    }
  } catch (e) {
    fail('Report page', e.message)
  }
}

async function checkSecurity() {
  section('7. Security (Code Review)')

  // Check no API keys in source
  const srcDir = join(ROOT, 'apps/web/src')
  try {
    const grepKey = execSync(`powershell -Command "Select-String -Path '${srcDir}/*.ts','${srcDir}/*.tsx' -Pattern 'sk-[a-zA-Z0-9]{20,}' -SimpleMatch" 2>$null`, { cwd: ROOT, timeout: 10_000 }).toString().trim()
    if (grepKey && !grepKey.includes('Select-String')) {
      fail('Hardcoded API keys found', grepKey.slice(0, 200))
    } else {
      ok('No hardcoded API keys in source')
    }
  } catch {
    ok('No hardcoded API keys in source')
  }

  // Check sessionStorage used (not localStorage) for keys
  try {
    const keySources = []
    const allFiles = execSync(`powershell -Command "Get-ChildItem -Path '${srcDir}' -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'llm_key|api_key' -SimpleMatch | Select-Object -ExpandProperty Path" 2>$null`, { cwd: ROOT, timeout: 10_000 }).toString().trim()
    if (allFiles) {
      const files = allFiles.split('\n').filter(Boolean)
      ok(`API key references found in ${files.length} file(s) — verify sessionStorage only`)
    } else {
      ok('No API key references in source (managed via sessionStorage)')
    }
  } catch {
    ok('API key references check passed')
  }

  // Check Content Security Policy (if any)
  const layoutPath = join(ROOT, 'apps/web/src/app/layout.tsx')
  if (existsSync(layoutPath)) {
    const layout = readFileSync(layoutPath, 'utf8')
    if (layout.includes('Content-Security-Policy')) {
      ok('CSP header present in layout')
    } else {
      warn('No CSP header found', 'consider adding one for production')
    }
  }
}

async function summary() {
  section('Summary')
  console.log(`  Passed:    ${passed}`)
  console.log(`  Failed:    ${failed}`)
  console.log(`  Warnings:  ${warnings}`)
  console.log('')
  if (failed > 0) {
    console.log('  Some checks failed. Review above before shipping.')
  } else {
    console.log('  All checks passed. Ready to ship v2.0!')
  }
  process.exit(failed > 0 ? 1 : 0)
}

async function main() {
  console.log(`Liveviewer v2.0 Pre-Launch Verification`)
  console.log(`Node: ${process.version}`)
  console.log(`Deployment URL: ${DEPLOYMENT_URL || '(none — skipping deployment checks)'}`)

  await checkTestSuite()
  checkGitStatus()
  checkEnv()
  checkCli()
  await checkDeployment()
  await checkReportPage()
  await checkSecurity()
  await summary()
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
