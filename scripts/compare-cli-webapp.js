#!/usr/bin/env node

/**
 * Parity test: compares CLI and web app deterministic outputs for the same URL.
 *
 * Usage:
 *   node scripts/compare-cli-webapp.js <url> [deployment-url]
 *
 * Examples:
 *   node scripts/compare-cli-webapp.js https://example.com
 *   node scripts/compare-cli-webapp.js https://web.dev https://liveviewer.vercel.app
 *
 * The script:
 *   1. Runs CLI with --wcag --design --mobile --timeout 30000
 *   2. Calls POST /api/audit on the web app with the same two viewports
 *   3. Deep-compares wcag and design objects (ignoring timestamps, filepaths)
 *
 * Exits 0 if deterministic outputs match, 1 otherwise.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TARGET_URL = process.argv[2]
const DEPLOYMENT_URL = (process.argv[3] || process.env.DEPLOYMENT_URL || 'http://localhost:3000').replace(/\/$/, '')

if (!TARGET_URL) {
  console.error('Usage: node scripts/compare-cli-webapp.js <url> [deployment-url]')
  console.error('   or: DEPLOYMENT_URL=... node scripts/compare-cli-webapp.js <url>')
  process.exit(1)
}

const VIEWPORTS = [{ width: 1280, height: 800 }, { width: 375, height: 812 }]

let passed = 0
let failed = 0

function ok(label) {
  console.log(`  [+] ${label}`)
  passed++
}

function fail(label, detail) {
  console.log(`  [X] ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(60)}`)
}

function stripNonDeterministic(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const clone = JSON.parse(JSON.stringify(obj))
  delete clone.timestamp
  delete clone.filepath
  if (clone.wcag && typeof clone.wcag === 'object') {
    delete clone.wcag.totalElements
  }
  if (clone.design && typeof clone.design === 'object') {
    delete clone.design.totalChecks
  }
  return clone
}

function deepEqual(a, b, path = '') {
  if (a === b) return true
  if (a == null || b == null) return [false, `${path}: one is null`]
  if (typeof a !== typeof b) return [false, `${path}: type mismatch (${typeof a} vs ${typeof b})`]
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [false, `${path}: array length (${a.length} vs ${b.length})`]
    for (let i = 0; i < a.length; i++) {
      const r = deepEqual(a[i], b[i], `${path}[${i}]`)
      if (!r[0]) return r
    }
    return [true]
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort()
    const keysB = Object.keys(b).sort()
    if (keysA.join(',') !== keysB.join(',')) return [false, `${path}: keys differ (${keysA.join(',')} vs ${keysB.join(',')})`]
    for (const k of keysA) {
      const r = deepEqual(a[k], b[k], `${path}.${k}`)
      if (!r[0]) return r
    }
    return [true]
  }
  return a === b ? [true] : [false, `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`]
}

function runCli() {
  const cliPath = `node "${join(ROOT, 'packages/cli/bin/liveviewer.js')}"`
  const cmd = `${cliPath} audit "${TARGET_URL}" --wcag --design --mobile --timeout 30000`
  try {
    const out = execSync(cmd, { cwd: ROOT, timeout: 120_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { stdout: out.toString().trim(), code: 0 }
  } catch (e) {
    const stdout = e.stdout?.toString()?.trim() || ''
    return { stdout, code: e.status ?? 1 }
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

async function callWebApp() {
  const maxRetries = 2
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${DEPLOYMENT_URL}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: TARGET_URL, viewports: VIEWPORTS, bypassCache: true, timeout: 8000 }),
        signal: AbortSignal.timeout(120_000)
      })
      if (res.status === 200) {
        const body = await res.json()
        if (body.success && body.data) return body.data
      }
      if (res.status === 429) {
        console.log('  (rate limited, waiting 10s...)')
        await new Promise(r => setTimeout(r, 10_000))
        continue
      }
      return null
    } catch (e) {
      if (attempt < maxRetries) {
        console.log(`  (web app call failed, retry ${attempt + 1}/${maxRetries}...)`)
        await new Promise(r => setTimeout(r, 5_000))
        continue
      }
      return null
    }
  }
  return null
}

async function main() {
  console.log(`Liveviewer CLI vs Web App Parity Test`)
  console.log(`URL: ${TARGET_URL}`)
  console.log(`Web app: ${DEPLOYMENT_URL}`)
  console.log(`Viewports: ${VIEWPORTS.map(v => `${v.width}x${v.height}`).join(', ')}`)

  // Check chromium
  const hasChrome = existsSync(join(ROOT, 'node_modules/playwright-core/.local-browsers')) ||
    process.env.PLAYWRIGHT_BROWSERS_PATH !== undefined
  if (!hasChrome) {
    console.error('\n  Chromium not found. Run `npx playwright install chromium` to test CLI parity.')
    process.exit(1)
  }

  section('1. CLI Audit')
  console.log('  Running CLI audit...')
  const cliResult = runCli()
  if (cliResult.code !== 0) {
    fail('CLI audit', `exit code ${cliResult.code}`)
    console.log('  STDERR:', cliResult.stdout.slice(-300))
    process.exit(1)
  }
  const cliData = extractJson(cliResult.stdout)
  if (!cliData) {
    fail('CLI audit', 'could not parse JSON from output')
    process.exit(1)
  }
  ok(`CLI completed (score: ${cliData.wcag?.score ?? 'N/A'}%, design: ${cliData.design?.score ?? 'N/A'}%)`)

  section('2. Web App API Audit')
  console.log('  Calling web app API...')
  const webData = await callWebApp()
  if (!webData) {
    fail('Web app API', 'could not get audit result')
    process.exit(1)
  }
  ok(`Web app completed (score: ${webData.wcag?.score ?? 'N/A'}%, design: ${webData.design?.score ?? 'N/A'}%)`)

  section('3. Comparison')

  // Strip non-deterministic fields
  const cliClean = stripNonDeterministic(cliData)
  const webClean = stripNonDeterministic(webData)

  // Compare wcag
  if (cliClean.wcag && webClean.wcag) {
    const [wcagOk, wcagDiff] = deepEqual(cliClean.wcag, webClean.wcag, 'wcag')
    if (wcagOk) ok('wcag: scores and failures match')
    else fail('wcag mismatch', wcagDiff)
  } else {
    if (cliClean.wcag === webClean.wcag) ok('wcag: both null/undefined')
    else fail('wcag: one is null', `CLI: ${JSON.stringify(cliClean.wcag)}, Web: ${JSON.stringify(webClean.wcag)}`)
  }

  // Compare design
  if (cliClean.design && webClean.design) {
    const [desOk, desDiff] = deepEqual(cliClean.design, webClean.design, 'design')
    if (desOk) ok('design: scores and failures match')
    else fail('design mismatch', desDiff)
  } else {
    if (cliClean.design === webClean.design) ok('design: both null/undefined')
    else fail('design: one is null', `CLI: ${JSON.stringify(cliClean.design)}, Web: ${JSON.stringify(webClean.design)}`)
  }

  // Summary
  section('Summary')
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log('')
  if (failed > 0) {
    console.log('  Deterministic outputs differ between CLI and web app.')
    process.exit(1)
  }
  console.log('  CLI and web app produce identical deterministic outputs.')
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
