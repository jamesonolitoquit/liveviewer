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
  LLMClient
} from './types.js'

const DEFAULT_CHUNK_SIZE = 20
const DEFAULT_MAX_SUMMARY_ITEMS = 50

export type { LLMOptions, LLMResponse, LLMError, FailureAnalysis }

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

export function buildPrompt(
  failures: AuditFailure[],
  template: string = 'default'
): string {
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
        apiKey
      })
      return client as LLMClient
    }
    case 'ollama':
      return (await createOllamaClient({
        model: options.model
      })) as LLMClient
    case 'mock':
      return createMockClient('success') as LLMClient
    default:
      throw new Error(`Unsupported LLM provider: ${options.provider}. Use openai or ollama.`)
  }
}

function mergeChunkedResponses(responses: LLMResponse[]): LLMResponse {
  const allFailure = responses.flatMap(r => r.perFailure)
  return {
    provider: responses[0]?.provider ?? 'unknown',
    model: responses[0]?.model ?? 'unknown',
    summary: responses.map(r => r.summary).join(' '),
    perFailure: allFailure,
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

  if (!auditResults.wcag?.failures?.length) {
    return {
      provider: options.provider,
      model: options.model,
      summary: 'No WCAG failures to analyze.',
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

  const summarized = summarizeFailures(auditResults.wcag.failures)
  const chunks = chunkFailures(summarized)

  try {
    const client = await getLLMClient(options)
    const promptTemplate = options.promptTemplate ?? 'default'

    const responses = await Promise.all(
      chunks.map(chunk => {
        const prompt = buildPrompt(chunk, promptTemplate)
        return client.complete<LLMResponse>(prompt)
      })
    )

    const merged = mergeChunkedResponses(responses)
    writeCache(cacheKey, merged, options)
    return { ...merged, cached: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message, provider: options.provider, model: options.model }
  }
}

export { clearCache } from './cache.js'
export { createMockClient } from './mock.js'
export { createOpenAIClient } from './clients/openai.js'
export { createOllamaClient } from './clients/ollama.js'
