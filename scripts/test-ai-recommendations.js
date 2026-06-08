#!/usr/bin/env node

/**
 * AI Recommendation integration test for Liveviewer v2.0.
 *
 * Tests the CLI's --llm-enrich flag with a real (or mock) LLM provider.
 * Requires either:
 *   - OPENAI_API_KEY env var (for real OpenAI call), or
 *   - RUN_AI_TESTS=true + OPENAI_API_KEY (to force run)
 *
 * Usage:
 *   node scripts/test-ai-recommendations.js
 *
 * Set RUN_AI_TESTS=true to enable even without an API key (uses mock provider).
 *
 * Exits 0 on success, 1 on failure.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const cliPath = `node "${join(ROOT, 'packages/cli/bin/liveviewer.js')}"`

const hasApiKey = !!process.env.OPENAI_API_KEY
const forceRun = process.env.RUN_AI_TESTS === 'true'

let passed = 0
let failed = 0
let skipped = 0

function ok(label) {
  console.log(`  [+] ${label}`)
  passed++
}

function fail(label, detail) {
  console.log(`  [X] ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
}

function skip(label, reason) {
  console.log(`  [-] ${label} — ${reason}`)
  skipped++
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(60)}`)
}

function runCli(args, timeout = 60_000) {
  try {
    const out = execSync(`${cliPath} ${args}`, { cwd: ROOT, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { stdout: out.toString().trim(), stderr: '', code: 0 }
  } catch (e) {
    const stdout = e.stdout?.toString()?.trim() || ''
    const stderr = e.stderr?.toString()?.trim() || ''
    return { stdout, stderr, code: e.status ?? 1 }
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

async function main() {
  console.log(`Liveviewer v2.0 AI Recommendation Tests`)
  console.log(`Node: ${process.version}`)
  console.log(`API key: ${hasApiKey ? 'set' : 'not set'}`)
  console.log(`Force run: ${forceRun}`)

  if (!hasApiKey && !forceRun) {
    console.log('\n  Skipping all AI tests. Set OPENAI_API_KEY or RUN_AI_TESTS=true to run.')
    console.log('  (AI tests make real API calls and incur costs.)')
    process.exit(0)
  }

  // Check chromium availability
  const hasChrome = existsSync(join(ROOT, 'node_modules/playwright-core/.local-browsers')) ||
    process.env.PLAYWRIGHT_BROWSERS_PATH !== undefined
  if (!hasChrome) {
    console.log('\n  Chromium not found. Run `npx playwright install chromium` first.')
    process.exit(1)
  }

  section('1. CLI --llm-enrich with example.com (no failures)')
  {
    const provider = hasApiKey ? 'openai' : 'mock'
    const model = hasApiKey ? 'gpt-3.5-turbo' : 'mock-v1'
    const apiKeyArg = hasApiKey ? `--llm-api-key "${process.env.OPENAI_API_KEY}"` : ''

    const result = runCli(`audit https://example.com --wcag ${apiKeyArg} --llm-enrich --llm-provider ${provider} --llm-model ${model} --timeout 30000`, 90_000)
    if (result.code === 0) {
      const data = extractJson(result.stdout)
      if (data && data.llm) {
        ok('LLM enrichment returned')
        if (data.llm.perFailure) ok(`  perFailure: ${data.llm.perFailure.length} items`)
        if (data.llm.summary) ok(`  summary: "${data.llm.summary.slice(0, 60)}..."`)
      } else {
        fail('No llm field in output', 'expected data.llm')
      }
    } else {
      fail('CLI audit --llm-enrich', `exit ${result.code}: ${result.stderr.slice(0, 200)}`)
    }
  }

  section('2. CLI --llm-enrich --design (design-only)')
  {
    const provider = hasApiKey ? 'openai' : 'mock'
    const model = hasApiKey ? 'gpt-3.5-turbo' : 'mock-v1'
    const apiKeyArg = hasApiKey ? `--llm-api-key "${process.env.OPENAI_API_KEY}"` : ''

    const result = runCli(`audit https://example.com --wcag --design ${apiKeyArg} --llm-enrich --llm-provider ${provider} --llm-model ${model} --timeout 30000`, 90_000)
    if (result.code === 0) {
      const data = extractJson(result.stdout)
      if (data && data.llm) {
        ok('LLM enrichment with design flag returned')
        if (data.design) ok(`  design: ${data.design.score}% (${data.design.failures?.length || 0} issues)`)
        if (data.llm.perFailure) ok(`  perFailure: ${data.llm.perFailure.length} items`)
      } else {
        fail('No llm/design field in output')
      }
    } else {
      fail('CLI audit --llm-enrich --design', `exit ${result.code}: ${result.stderr.slice(0, 200)}`)
    }
  }

  section('3. Mock provider (no API key needed)')
  {
    const result = runCli('audit https://example.com --wcag --llm-enrich --llm-provider mock --llm-model mock-v1 --timeout 30000', 90_000)
    if (result.code === 0) {
      const data = extractJson(result.stdout)
      if (data && data.llm && data.llm.provider === 'mock') {
        ok('Mock provider works')
        if (data.llm.designFixes !== undefined) ok('  designFixes field present')
      } else {
        fail('Mock response invalid', JSON.stringify(data?.llm).slice(0, 200))
      }
    } else {
      fail('Mock provider', `exit ${result.code}: ${result.stderr.slice(0, 200)}`)
    }
  }

  section('4. --fail-on with AI enrichment')
  {
    const result = runCli('audit https://example.com --wcag --llm-enrich --llm-provider mock --llm-model mock-v1 --fail-on 0 --timeout 30000', 90_000)
    // example.com should have 0 failures, so --fail-on 0 should pass (exit 0)
    if (result.code === 0) {
      ok('--fail-on 0 passes when no failures')
    } else {
      fail('--fail-on 0', `expected exit 0, got ${result.code}`)
    }
  }

  section('Summary')
  console.log(`  Passed:   ${passed}`)
  console.log(`  Failed:   ${failed}`)
  console.log(`  Skipped:  ${skipped}`)
  console.log('')
  if (failed > 0) {
    console.log('  Some AI recommendation tests failed.')
    process.exit(1)
  }
  console.log('  All AI recommendation tests passed.')
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
