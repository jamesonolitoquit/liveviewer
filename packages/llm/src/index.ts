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

function buildWcagPrompt(failures: AuditFailure[], template: string): string {
  const failureLines = failures.map(f =>
    `- ${f.selector}: "${f.text.slice(0, 60)}" — foreground ${f.foreground} on background ${f.background}, ratio ${f.contrastRatio}:1 (needs ${f.required}:1, ${f.isLarge ? 'large text' : 'normal text'})`
  ).join('\n')

  const basePrompt = `You are an accessibility expert. Analyze these WCAG contrast failures and suggest specific fixes.

Failures:
${failureLines}

For each failure, provide:
1. A clear explanation of why it fails
2. A specific fix suggestion with exact color values (e.g., "change foreground to #333" or "darken background to #1a1a2e")
3. A severity rating (high if ratio < 3.0, medium if ratio < 4.5, low otherwise)`

  if (template === 'simple') {
    return `List these WCAG failures and their fixes briefly:\n${failureLines}`
  }

  return basePrompt
}

function buildDesignPrompt(designFails: DesignFailure[]): string {
  const lines = designFails.map(d =>
    `- ${d.selector}: ${d.description} (value: ${d.value}, expected: ${d.expected}, severity: ${d.severity})`
  ).join('\n')

  return `Analyze these design quality issues and suggest specific CSS fixes:

Issues:
${lines}

For each issue, provide:
1. A clear explanation of the design problem
2. A specific CSS fix suggestion with exact values
3. A severity rating (high, medium, or low)`
}

function buildCombinedPrompt(
  wcagFailures: AuditFailure[],
  designFails: DesignFailure[],
  template: string
): string {
  const parts: string[] = []

  if (wcagFailures.length > 0) {
    const lines = wcagFailures.map(f =>
      `- ${f.selector}: "${f.text.slice(0, 60)}" — foreground ${f.foreground} on background ${f.background}, ratio ${f.contrastRatio}:1 (needs ${f.required}:1, ${f.isLarge ? 'large text' : 'normal text'})`
    ).join('\n')
    parts.push('# Accessibility (WCAG Contrast)\n' + lines)
  }

  if (designFails.length > 0) {
    const lines = designFails.map(d =>
      `- ${d.selector}: ${d.description} (value: ${d.value}, expected: ${d.expected}, severity: ${d.severity})`
    ).join('\n')
    parts.push('# Design Quality\n' + lines)
  }

  const combined = parts.join('\n\n')

  if (template === 'simple') {
    return `List these issues and their fixes briefly:\n\n${combined}`
  }

  const prompt = `You are an expert web designer. Analyze these accessibility and design quality issues and suggest specific fixes.

${combined}

For each failure, provide:
1. A clear explanation of why it fails
2. A specific fix suggestion with exact values
3. A severity rating (high, medium, or low)`

  return prompt
}

export function buildPrompt(
  failures: AuditFailure[],
  template: string = 'default',
  designFails?: DesignFailure[]
): string {
  if (designFails && designFails.length > 0) {
    return buildCombinedPrompt(failures, designFails, template)
  }
  return buildWcagPrompt(failures, template)
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
  const combinedPrompt = buildPrompt(summarized, promptTemplate, designFails.slice(0, 30))

  try {
    const client = await getLLMClient(options)

    const response = await client.complete<LLMResponse>(combinedPrompt)

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
