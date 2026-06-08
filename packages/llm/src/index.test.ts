import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  summarizeFailures,
  chunkFailures,
  buildPrompt,
  enrichWithLLM,
  clearCache,
  createMockClient,
} from './index.js'
import type { AuditFailure, AuditResults, LLMOptions, LLMResponse } from './types.js'

function makeFailure(overrides: Partial<AuditFailure> = {}): AuditFailure {
  return {
    selector: 'h1',
    text: 'Hello World',
    foreground: '#ffffff',
    background: '#eeeeee',
    contrastRatio: 2.5,
    required: 4.5,
    fontSize: 24,
    isLarge: true,
    ...overrides,
  }
}

function makeResults(failures: AuditFailure[]): AuditResults {
  return {
    url: 'https://example.com',
    timestamp: Date.now(),
    wcag: {
      totalElements: 100,
      failures,
      passCount: 100 - failures.length,
      failCount: failures.length,
      score: failures.length > 0 ? 90 : 100,
    },
  }
}

describe('summarizeFailures', () => {
  it('sorts failures by contrast ratio ascending', () => {
    const failures = [
      makeFailure({ contrastRatio: 4.0 }),
      makeFailure({ contrastRatio: 2.0 }),
      makeFailure({ contrastRatio: 3.0 }),
    ]
    const sorted = summarizeFailures(failures)
    expect(sorted.map(f => f.contrastRatio)).toEqual([2.0, 3.0, 4.0])
  })

  it('limits to max items', () => {
    const failures = Array.from({ length: 100 }, (_, i) =>
      makeFailure({ contrastRatio: i + 1 })
    )
    const limited = summarizeFailures(failures, 10)
    expect(limited).toHaveLength(10)
    expect(limited[0].contrastRatio).toBe(1)
  })

  it('returns empty array for empty input', () => {
    expect(summarizeFailures([])).toEqual([])
  })
})

describe('chunkFailures', () => {
  it('splits into chunks of specified size', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const chunks = chunkFailures(items, 10)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(10)
    expect(chunks[1]).toHaveLength(10)
    expect(chunks[2]).toHaveLength(5)
  })

  it('uses default chunk size of 20', () => {
    const items = Array.from({ length: 45 }, (_, i) => i)
    const chunks = chunkFailures(items)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(20)
    expect(chunks[1]).toHaveLength(20)
    expect(chunks[2]).toHaveLength(5)
  })

  it('returns single chunk for small array', () => {
    const items = [1, 2, 3]
    expect(chunkFailures(items, 10)).toEqual([[1, 2, 3]])
  })

  it('returns empty array for empty input', () => {
    expect(chunkFailures([])).toEqual([])
  })
})

describe('buildPrompt', () => {
  it('includes failure details in prompt', () => {
    const failures = [makeFailure({ selector: 'h1.title', text: 'Welcome', foreground: '#fff', background: '#000', contrastRatio: 2.1, required: 4.5 })]
    const prompt = buildPrompt(failures, 'default')
    expect(prompt).toContain('h1.title')
    expect(prompt).toContain('"Welcome"')
    expect(prompt).toContain('#fff')
    expect(prompt).toContain('2.1:1')
    expect(prompt).toContain('4.5:1')
  })

  it('uses default template when not specified', () => {
    const failures = [makeFailure()]
    expect(buildPrompt(failures)).toContain('# Accessibility (WCAG Contrast)')
  })

  it('generates simple template', () => {
    const failures = [makeFailure()]
    const prompt = buildPrompt(failures, 'simple')
    expect(prompt).toContain('List these issues')
  })

  it('truncates long text to 60 chars', () => {
    const failures = [makeFailure({ text: 'A'.repeat(200) })]
    const prompt = buildPrompt(failures)
    expect(prompt).toContain('A'.repeat(60))
    expect(prompt).not.toContain('A'.repeat(61))
  })

  it('includes context block when context is provided', () => {
    const failures = [makeFailure()]
    const prompt = buildPrompt(failures, 'default', undefined, 'Dark mode SaaS dashboard for engineers')
    expect(prompt).toContain('USER CONTEXT')
    expect(prompt).toContain('Dark mode SaaS dashboard for engineers')
    expect(prompt).toContain('---\n\n# Accessibility')
  })

  it('includes context before failure details in combined prompt', () => {
    const failures = [makeFailure()]
    const designFails = [{ ruleId: 'font-size-legible', ruleName: 'Font Size', selector: 'p', description: 'Small text', severity: 'medium', value: '12px', expected: '>= 16px' }]
    const prompt = buildPrompt(failures, 'default', designFails, 'E-commerce product page')
    const ctxIdx = prompt.indexOf('E-commerce product page')
    const wcagIdx = prompt.indexOf('Accessibility (WCAG Contrast)')
    expect(ctxIdx).toBeGreaterThan(-1)
    expect(wcagIdx).toBeGreaterThan(ctxIdx)
  })
})

describe('createMockClient', () => {
  it('returns success response by default', async () => {
    const client = createMockClient('success')
    const result = await client.complete('prompt')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('perFailure')
    expect(result).toHaveProperty('provider', 'mock')
  })

  it('throws on error scenario', async () => {
    const client = createMockClient('error')
    await expect(client.complete('prompt')).rejects.toThrow('Mock LLM error')
  })

  it('returns empty on empty scenario', async () => {
    const client = createMockClient('empty')
    const result = await client.complete<any>('prompt')
    expect(result.summary).toBe('')
    expect(result.perFailure).toEqual([])
  })

  it('returns unexpected shape on malformed scenario', async () => {
    const client = createMockClient('malformed')
    const result = await client.complete<any>('prompt')
    expect(result).toEqual({ unexpected: 'shape' })
  })
})

describe('enrichWithLLM', () => {
  const baseOptions: LLMOptions = {
    llmEnrich: true,
    provider: 'mock',
    model: 'mock-v1',
  }

  beforeEach(() => {
    clearCache()
  })

  it('returns empty result when llmEnrich is false', async () => {
    const results = makeResults([makeFailure()])
    const result = await enrichWithLLM(results, { ...baseOptions, llmEnrich: false })
    expect(result).toHaveProperty('summary', '')
    expect(result).toHaveProperty('perFailure', [])
  })

  it('returns early when no failures', async () => {
    const results = makeResults([])
    const result = await enrichWithLLM(results, baseOptions)
    expect(result).toHaveProperty('summary', 'No failures to analyze.')
    expect(result).toHaveProperty('perFailure', [])
  })

  it('returns designFixes when design failures present', async () => {
    const results: AuditResults = {
      url: 'https://example.com',
      timestamp: Date.now(),
      wcag: null,
      design: {
        failures: [{
          ruleId: 'font-size-legible',
          ruleName: 'Body text minimum 16px',
          selector: 'p.small',
          description: 'Text has font-size 12px',
          severity: 'high',
          value: '12px',
          expected: '>= 16px'
        }],
        totalChecks: 10,
        passCount: 9,
        failCount: 1,
        score: 90,
      }
    }
    const result = await enrichWithLLM(results, baseOptions) as LLMResponse
    expect(result.perFailure).toBeDefined()
    expect(result.designFixes).toBeDefined()
    expect(result.designFixes!.length).toBeGreaterThanOrEqual(0)
  })

  it('returns LLM enrichment with mock client', async () => {
    const failures = [makeFailure({ contrastRatio: 2.1 })]
    const results = makeResults(failures)
    const result = await enrichWithLLM(results, baseOptions)
    expect(result).toHaveProperty('provider', 'mock')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('perFailure')
  })

  it('caches results and returns cached flag', async () => {
    const failures = [makeFailure()]
    const results = makeResults(failures)

    const first = await enrichWithLLM(results, baseOptions)
    expect(first).toHaveProperty('cached', false)

    const second = await enrichWithLLM(results, baseOptions)
    expect(second).toHaveProperty('cached', true)
  })

  it('uses different cache keys for different context values', async () => {
    const failures = [makeFailure()]
    const results = makeResults(failures)

    const first = await enrichWithLLM(results, { ...baseOptions, context: 'Dashboard' })
    expect(first).toHaveProperty('cached', false)

    const second = await enrichWithLLM(results, { ...baseOptions, context: 'Blog' })
    expect(second).toHaveProperty('cached', false)

    const third = await enrichWithLLM(results, { ...baseOptions, context: 'Dashboard' })
    expect(third).toHaveProperty('cached', true)
  })

  it('clears cache when clearCache option is set', async () => {
    const failures = [makeFailure()]
    const results = makeResults(failures)

    await enrichWithLLM(results, baseOptions)
    const afterClear = await enrichWithLLM(results, { ...baseOptions, clearCache: true })
    expect(afterClear).toHaveProperty('cached', false)
  })

  it('returns error object on provider failure', async () => {
    const failures = [makeFailure()]
    const results = makeResults(failures)
    const result = await enrichWithLLM(results, { ...baseOptions, provider: 'unknown-provider' as any })
    expect(result).toHaveProperty('error')
    expect(result).not.toHaveProperty('perFailure')
  })

  it('chunks large failure lists and merges responses', async () => {
    const failures = Array.from({ length: 45 }, (_, i) =>
      makeFailure({ selector: `el-${i}`, contrastRatio: 2.0 + (i % 3) })
    )
    const results = makeResults(failures)
    const result = await enrichWithLLM(results, baseOptions)
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('perFailure')
  })
})
