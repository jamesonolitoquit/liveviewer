import { readCache, writeCache, getCacheKey, clearCache } from './cache.js'
import { createOpenAIClient } from './clients/openai.js'
import { createOllamaClient } from './clients/ollama.js'
import { createMockClient } from './mock.js'
import type {
  LLMOptions,
  LLMResponse,
  LLMError,
  AuditResults,
  AuditFailure,
  FailureAnalysis,
  DesignFailure,
  DesignFix,
  GeneralFix,
  LLMClient
} from './types.js'

const DEFAULT_CHUNK_SIZE = 20
const DEFAULT_MAX_SUMMARY_ITEMS = 50

export type { LLMOptions, LLMResponse, LLMError, FailureAnalysis, DesignFix, GeneralFix }

export const SYSTEM_PROMPT = `You are an expert web quality auditor. Analyze the accessibility, design, SEO, security, legal, and performance issues listed and provide actionable, concise fix recommendations.

Output a JSON object with this structure:

{
  "summary": "One-sentence executive summary of the most critical issues across all pillars.",
  "perFailure": [
    {
      "selector": "CSS selector of the failing element (exact from the list)",
      "ruleId": "contrast",
      "explanation": "Why this fails (e.g., 'Text color #777 on white background has insufficient contrast')",
      "suggestion": "Specific fix (e.g., 'Change text color to #333')",
      "severity": "high|medium|low"
    }
  ],
  "designFixes": [
    {
      "selector": "CSS selector (exact)",
      "ruleId": "font-size-legible | line-height-readable | horizontal-scroll | heading-hierarchy | missing-alt | empty-interactive | missing-lang | missing-label | skip-navigation | focus-indicator | positive-tabindex",
      "explanation": "Why problematic",
      "suggestion": "Specific CSS fix",
      "severity": "high|medium|low"
    }
  ],
  "perPillarFixes": {
    "seo": [
      {
        "pillar": "seo",
        "selector": "CSS selector (exact)",
        "ruleId": "missing-title | missing-meta-description | missing-canonical | missing-jsonld | missing-viewport | robots-blocked | missing-open-graph | twitter-card-missing",
        "explanation": "Why this issue matters for search visibility",
        "suggestion": "Specific fix instruction",
        "severity": "high|medium|low"
      }
    ],
    "security": [
      {
        "pillar": "security",
        "selector": "CSS selector (exact)",
        "ruleId": "missing-https | missing-hsts | missing-csp | missing-xfo | missing-xcto | missing-referrer-policy | missing-permissions-policy | mixed-content | missing-secure-cookies",
        "explanation": "Why this header matters for security",
        "suggestion": "Specific header value to set",
        "severity": "high|medium|low"
      }
    ],
    "legal": [
      {
        "pillar": "legal",
        "selector": "CSS selector (exact)",
        "ruleId": "cookie-consent | missing-privacy-policy | missing-imprint | missing-tos | missing-data-notice",
        "explanation": "Why this legal requirement matters",
        "suggestion": "Specific implementation advice",
        "severity": "high|medium|low"
      }
    ],
    "performance": [
      {
        "pillar": "performance",
        "selector": "page",
        "ruleId": "lcp | cls | tbt | fcp | speed-index | tti",
        "explanation": "Why this metric is below target",
        "suggestion": "Specific optimisation advice",
        "severity": "high|medium|low"
      }
    ]
  }
}

Important rules:
- Return ONLY valid JSON. No extra text, no markdown formatting.
- If a pillar has no issues, omit the key or use an empty array.
- Use the exact selectors provided. Do not modify them.
- Severity mapping:
  - high: critical (contrast < 3:1, font-size < 12px, line-height < 1.2, missing security headers, missing legal requirements).
  - medium: important but not blocking (contrast 3:1&#8211;4.5:1, font-size 12&#8211;16px, missing SEO tags).
  - low: minor improvements (e.g., JSON-LD, non-critical recommendations).`

export function summarizeFailures(
  failures: AuditFailure[],
  maxItems: number = DEFAULT_MAX_SUMMARY_ITEMS
): AuditFailure[] {
  const sorted = [...failures].sort((a, b) => a.contrastRatio - b.contrastRatio)
  return sorted.slice(0, maxItems)
}

export function chunkFailures<T>(items: T[], chunkSize: number = DEFAULT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function buildWcagSection(failures: AuditFailure[]): string {
  if (failures.length === 0) return ''
  const lines = failures.map(f =>
    `- ${f.selector}: "${f.text.slice(0, 60)}" – fg ${f.foreground} on bg ${f.background}, ratio ${f.contrastRatio}:1 (needs ${f.required}:1, ${f.isLarge ? 'large text' : 'normal text'})`
  ).join('\n')
  return '# Accessibility (WCAG Contrast)\n' + lines
}

function buildDesignSection(designFails: DesignFailure[]): string {
  if (designFails.length === 0) return ''
  const lines = designFails.map(d =>
    `- ${d.selector}: ${d.description} (value: ${d.value}, expected: ${d.expected})`
  ).join('\n')
  return '# Design Quality\n' + lines
}

function buildGenericSection(label: string, fails: DesignFailure[]): string {
  if (fails.length === 0) return ''
  const lines = fails.map(d =>
    `- ${d.selector}: ${d.description} (value: ${d.value}, expected: ${d.expected})`
  ).join('\n')
  return `# ${label}\n` + lines
}

function buildPerformanceSection(perf: AuditResults['performance']): string {
  if (!perf || !perf.grade) return ''
  const lines: string[] = [`- Grade: ${perf.grade}, Score: ${perf.score}`]
  if (perf.lcp != null) lines.push(`- LCP: ${perf.lcp}ms (target < 2500ms)`)
  if (perf.cls != null) lines.push(`- CLS: ${perf.cls} (target < 0.1)`)
  if (perf.tbt != null) lines.push(`- TBT: ${perf.tbt}ms (target < 200ms)`)
  if (perf.fcp != null) lines.push(`- FCP: ${perf.fcp}ms (target < 1800ms)`)
  if (perf.speedIndex != null) lines.push(`- Speed Index: ${perf.speedIndex}ms (target < 3400ms)`)
  return '# Performance\n' + lines.join('\n')
}

function buildContextBlock(context?: string): string {
  if (!context || !context.trim()) return ''
  return `--- USER CONTEXT ---\n${context.trim()}\n---`
}

export function buildPrompt(
  failures: AuditFailure[],
  template: string = 'default',
  designFails?: DesignFailure[],
  context?: string,
  seoFails?: DesignFailure[],
  securityFails?: DesignFailure[],
  legalFails?: DesignFailure[],
  perfResult?: AuditResults['performance']
): string {
  const wcagSection = buildWcagSection(failures)
  const designSection = designFails && designFails.length > 0 ? buildDesignSection(designFails) : ''
  const seoSection = buildGenericSection('SEO', seoFails || [])
  const securitySection = buildGenericSection('Security', securityFails || [])
  const legalSection = buildGenericSection('Legal & Privacy', legalFails || [])
  const perfSection = buildPerformanceSection(perfResult)
  const contextBlock = buildContextBlock(context)

  const sections = [contextBlock, wcagSection, designSection, seoSection, securitySection, legalSection, perfSection].filter(Boolean)

  if (template === 'simple') {
    const body = sections.join('\n\n')
    return `List these issues and their fixes briefly:\n\n${body}`
  }

  return sections.join('\n\n') || 'No issues to analyze.'
}

async function getLLMClient(options: LLMOptions): Promise<LLMClient> {
  switch (options.provider) {
    case 'openai': {
      const apiKey = options.apiKey
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not found. Set OPENAI_API_KEY env var or pass --llm-api-key'
        )
      }
      const client = await createOpenAIClient({
        model: options.model,
        apiKey,
        baseUrl: options.baseUrl
      })
      return client as LLMClient
    }
    case 'ollama':
      return (await createOllamaClient({
        model: options.model,
        baseUrl: options.baseUrl
      })) as LLMClient
    case 'mock':
      return createMockClient('success') as LLMClient
    default:
      throw new Error(`Unsupported LLM provider: ${options.provider}. Use openai or ollama.`)
  }
}

function mergeChunkedResponses(responses: LLMResponse[]): LLMResponse {
  const allFailure = responses.flatMap(r => r.perFailure)
  const allDesign = responses.flatMap(r => r.designFixes || [])
  const allPerPillar: LLMResponse['perPillarFixes'] = {}
  for (const r of responses) {
    if (r.perPillarFixes) {
      for (const key of ['seo', 'security', 'legal', 'performance'] as const) {
        const arr = r.perPillarFixes[key]
        if (arr && arr.length > 0) {
          allPerPillar[key] = [...(allPerPillar[key] || []), ...arr]
        }
      }
    }
  }
  return {
    provider: responses[0]?.provider ?? 'unknown',
    model: responses[0]?.model ?? 'unknown',
    summary: responses.map(r => r.summary).join(' '),
    perFailure: allFailure,
    designFixes: allDesign.length > 0 ? allDesign : undefined,
    perPillarFixes: Object.keys(allPerPillar).length > 0 ? allPerPillar : undefined,
    cached: false
  }
}

export async function enrichWithLLM(
  auditResults: AuditResults,
  options: LLMOptions
): Promise<LLMResponse | LLMError> {
  if (!options.llmEnrich) {
    return { provider: options.provider, model: options.model, summary: '', perFailure: [], cached: false }
  }

  const wcagFails = auditResults.wcag?.failures || []
  const designFails = auditResults.design?.failures || []
  const seoFails = (auditResults.seo as any)?.failures || []
  const securityFails = (auditResults.security as any)?.failures || []
  const legalFails = (auditResults.legal as any)?.failures || []
  const perfResult = auditResults.performance

  const hasAny = wcagFails.length > 0 || designFails.length > 0 ||
    seoFails.length > 0 || securityFails.length > 0 ||
    legalFails.length > 0 ||
    (perfResult && perfResult.grade && perfResult.grade !== 'A')

  if (!hasAny) {
    return {
      provider: options.provider,
      model: options.model,
      summary: 'No failures to analyze.',
      perFailure: [],
      cached: false
    }
  }

  if (options.clearCache) {
    clearCache(options.cacheDir)
  }

  const cacheKey = await getCacheKey(auditResults, options)
  const cached = readCache(cacheKey, options)
  if (cached) {
    return { ...cached, cached: true }
  }

  const summarized = summarizeFailures(wcagFails)
  const promptTemplate = options.promptTemplate ?? 'default'

  const combinedPrompt = buildPrompt(
    summarized, promptTemplate,
    designFails.slice(0, 30), options.context,
    seoFails.slice(0, 30), securityFails.slice(0, 20),
    legalFails.slice(0, 20), perfResult || undefined
  )

  try {
    const client = await getLLMClient(options)

    const response = await client.complete<LLMResponse>(combinedPrompt, SYSTEM_PROMPT)

    const merged: LLMResponse = {
      provider: options.provider,
      model: options.model,
      summary: response.summary || '',
      perFailure: response.perFailure || [],
      designFixes: response.designFixes || (designFails.length > 0 ? [] : undefined),
      perPillarFixes: response.perPillarFixes || undefined,
      cached: false
    }

    writeCache(cacheKey, merged, options)
    return merged
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message, provider: options.provider, model: options.model }
  }
}

export { clearCache } from './cache.js'
export { createMockClient } from './mock.js'
export { createOpenAIClient } from './clients/openai.js'
export { createOllamaClient } from './clients/ollama.js'
