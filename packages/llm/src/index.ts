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
  LLMClient
} from './types.js'

const DEFAULT_CHUNK_SIZE = 20
const DEFAULT_MAX_SUMMARY_ITEMS = 50

export type { LLMOptions, LLMResponse, LLMError, FailureAnalysis, DesignFix }

export const SYSTEM_PROMPT = `You are an expert web designer and accessibility consultant. Your task is to analyze the accessibility and design quality issues listed below and provide actionable, concise, and specific fix recommendations.

For each failure, you must output a JSON object with the following structure:

{
  "summary": "A one-sentence executive summary of the most critical issues.",
  "perFailure": [
    {
      "selector": "CSS selector of the failing element (exact from the list)",
      "ruleId": "WCAG rule ID or 'contrast'",
      "explanation": "Why this fails (e.g., 'Text color #777 on white background has insufficient contrast')",
      "suggestion": "Specific fix (e.g., 'Change text color to #333' or 'Increase font size to 16px')",
      "severity": "high|medium|low"
    }
  ],
  "designFixes": [
    {
      "selector": "CSS selector of the element with design issue",
      "ruleId": "font-size-legible | line-height-readable | horizontal-scroll | ...",
      "explanation": "Why this design choice is problematic (e.g., 'Body text below 16px reduces readability')",
      "suggestion": "Specific fix (e.g., 'Increase font size to at least 16px' or 'Set line-height to 1.5')",
      "severity": "high|medium|low"
    }
  ]
}

Important rules:
- Return ONLY valid JSON. No extra text, no markdown formatting.
- If a failure is not applicable (e.g., no design issues), return an empty array for that field.
- Use the exact selectors provided. Do not modify them.
- Severity mapping:
  - high: critical for accessibility or usability (e.g., contrast < 3:1, font-size < 12px, line-height < 1.2, overlapping content).
  - medium: important but not blocking (e.g., contrast 3:1–4.5:1, font-size 12–16px, line-height 1.2–1.4 or 1.6–1.8).
  - low: minor improvements (e.g., small spacing issues, non-critical overlap).
- For horizontal scroll: suggest \`overflow-x: hidden\` or responsive width adjustments.
- For missing labels: suggest adding a <label> or aria-label.
- For skip navigation: suggest adding a skip link or role="main".

If the user provided additional context (e.g., site purpose, audience, brand guidelines), incorporate that context into your explanations and suggestions. For example, if the site is a dark-mode dashboard, you may suggest lighter text on dark backgrounds; if it's a mobile-first e-commerce site, prioritize touch targets and font legibility.`

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

function buildContextBlock(context?: string): string {
  if (!context || !context.trim()) return ''
  return `--- USER CONTEXT ---\n${context.trim()}\n---`
}

export function buildPrompt(
  failures: AuditFailure[],
  template: string = 'default',
  designFails?: DesignFailure[],
  context?: string
): string {
  const wcagSection = buildWcagSection(failures)
  const designSection = designFails && designFails.length > 0 ? buildDesignSection(designFails) : ''
  const contextBlock = buildContextBlock(context)

  const sections = [contextBlock, wcagSection, designSection].filter(Boolean)

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
  return {
    provider: responses[0]?.provider ?? 'unknown',
    model: responses[0]?.model ?? 'unknown',
    summary: responses.map(r => r.summary).join(' '),
    perFailure: allFailure,
    designFixes: allDesign.length > 0 ? allDesign : undefined,
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

  if (!wcagFails.length && !designFails.length) {
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

  // Build combined prompt with both WCAG and design failures
  const combinedPrompt = buildPrompt(summarized, promptTemplate, designFails.slice(0, 30), options.context)

  try {
    const client = await getLLMClient(options)

    const response = await client.complete<LLMResponse>(combinedPrompt, SYSTEM_PROMPT)

    // Apply designFixes from response if present
    const merged: LLMResponse = {
      provider: options.provider,
      model: options.model,
      summary: response.summary || '',
      perFailure: response.perFailure || [],
      designFixes: response.designFixes || (designFails.length > 0 ? [] : undefined),
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
