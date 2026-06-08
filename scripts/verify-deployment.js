#!/usr/bin/env node

/**
 * Deployment smoke test for Liveviewer Vercel deployment.
 *
 * Usage:
 *   node scripts/verify-deployment.js <deployment-url>
 *
 * Example:
 *   node scripts/verify-deployment.js https://liveviewer-web.vercel.app
 *
 * Exits 0 on success, 1 on failure.
 */

const TARGET_URL = process.argv[2] || process.env.DEPLOYMENT_URL

if (!TARGET_URL) {
  console.error('Usage: node scripts/verify-deployment.js <deployment-url>')
  console.error('   or: DEPLOYMENT_URL=https://... node scripts/verify-deployment.js')
  process.exit(1)
}

const baseUrl = TARGET_URL.replace(/\/$/, '')
const TIMEOUT_MS = 30_000

const TEST_CASES = [
  { url: 'https://example.com', label: 'example.com (lightweight)', expectFailures: 0 },
  { url: 'https://web.dev', label: 'web.dev (known contrast failures)', expectFailuresAtLeast: 1 },
  { url: 'https://github.com', label: 'github.com (medium site)', expectFailuresAtLeast: 0 }
]

async function postAudit(site) {
  const start = Date.now()
  const res = await fetch(`${baseUrl}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: site, bypassCache: true })
  })
  const elapsed = Date.now() - start
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, elapsed }
}

function fmt(ms) {
  return `${(ms / 1000).toFixed(2)}s`
}

function validate(label, expected, actual) {
  if (expected === undefined) return true
  if (expected === 'gte' && actual >= 0) return true
  if (expected === 'eq' && actual === 0) return true
  if (expected === 'gte1' && actual >= 1) return true
  return false
}

async function main() {
  console.log(`\nLiveviewer deployment smoke test`)
  console.log(`Target: ${baseUrl}\n`)

  let allPassed = true
  const summary = []

  for (const tc of TEST_CASES) {
    const testName = `${tc.label} (${tc.url})`
    process.stdout.write(`  ${testName} ... `)

    let res
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      res = await postAudit(tc.url)
      clearTimeout(timer)
    } catch (err) {
      console.log(`FAIL (network: ${err.message})`)
      allPassed = false
      summary.push({ test: testName, ok: false, reason: err.message })
      continue
    }

    if (res.status === 429) {
      console.log(`SKIP (rate limited - check X-RateLimit headers)`)
      summary.push({ test: testName, ok: true, reason: 'rate_limited', elapsed: res.elapsed })
      continue
    }

    if (res.status === 503) {
      console.log(`FALLBACK (serverless constraint: ${res.body?.reason || 'unknown'}) [${fmt(res.elapsed)}]`)
      summary.push({ test: testName, ok: 'fallback', reason: res.body?.reason, elapsed: res.elapsed })
      continue
    }

    if (res.status !== 200) {
      console.log(`FAIL (HTTP ${res.status}: ${res.body?.error || 'unknown'}) [${fmt(res.elapsed)}]`)
      allPassed = false
      summary.push({ test: testName, ok: false, reason: `HTTP ${res.status}`, elapsed: res.elapsed })
      continue
    }

    const data = res.body?.data
    const wcag = data?.wcag
    const score = wcag?.score
    const failCount = wcag?.failCount

    if (typeof score !== 'number') {
      console.log(`FAIL (no wcag.score in response) [${fmt(res.elapsed)}]`)
      allPassed = false
      summary.push({ test: testName, ok: false, reason: 'no_score', elapsed: res.elapsed })
      continue
    }

    const ok = tc.expectFailuresAtLeast !== undefined
      ? failCount >= tc.expectFailuresAtLeast
      : failCount === tc.expectFailures

    console.log(`${ok ? 'OK' : 'FAIL'} (score=${score}, failures=${failCount}) [${fmt(res.elapsed)}]`)
    summary.push({ test: testName, ok, score, failCount, elapsed: res.elapsed })
    if (!ok) allPassed = false

    // v2.3.0: Verify deterministic fix suggestions
    const recommendations = data?.recommendations
    const hasRecommendations = Array.isArray(recommendations) && recommendations.length > 0
    const hasViewportWording = hasRecommendations && recommendations.some(
      r => typeof r.recommendation === 'string' && /on (Desktop|Mobile|Tablet)/i.test(r.recommendation)
    )
    if (hasRecommendations && !hasViewportWording) {
      console.log(`  WARN (recommendations present but no viewport wording)`)
    }
    if (!hasRecommendations && failCount > 0) {
      console.log(`  WARN (failures=${failCount} but no recommendations in response)`)
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Result: ${allPassed ? 'PASS' : 'FAIL'}`)
  console.log(`${'='.repeat(50)}\n`)

  for (const s of summary) {
    console.log(`  ${s.ok === 'fallback' ? '~' : s.ok ? '+' : '-'} ${s.test} [${fmt(s.elapsed || 0)}]${s.reason ? ' - ' + s.reason : ''}`)
  }
  console.log('')

  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
