'use client'

interface Failure {
  selector: string
  text: string
  foreground: string
  background: string
  contrastRatio: number
  required: number
  fontSize: number
  isLarge: boolean
}

interface DesignFailureCtx {
  ruleId: string
  ruleName: string
  selector: string
  description: string
  severity: string
  value: string
  expected: string
}

interface PerFailureResult {
  selector: string
  ruleId: string
  explanation: string
  suggestion: string
  severity: 'high' | 'medium' | 'low'
}

interface LlmResult {
  summary: string
  perFailure: PerFailureResult[]
  designFixes?: Array<{
    selector: string
    ruleId: string
    explanation: string
    suggestion: string
    severity: string
  }>
  provider: string
  model: string
}

const SYSTEM_PROMPT = `You are an expert web designer analyzing WCAG contrast failures and design quality issues.
Respond ONLY with valid JSON matching this exact schema:
{
  "summary": "string - one sentence summary of all issues",
  "perFailure": [
    {
      "selector": "string - CSS selector",
      "ruleId": "color-contrast",
      "explanation": "string - why it fails",
      "suggestion": "string - how to fix with specific color values",
      "severity": "high|medium|low"
    }
  ],
  "designFixes": [
    {
      "selector": "string - CSS selector",
      "ruleId": "string - e.g. font-size-legible, line-height-readable",
      "explanation": "string - why it fails and how to fix",
      "suggestion": "string - specific CSS fix",
      "severity": "high|medium|low"
    }
  ]
}`

function buildPrompt(failures: Failure[], designFailures?: DesignFailureCtx[], context?: string): string {
  const parts: string[] = []

  if (context && context.trim()) {
    parts.push(`--- USER CONTEXT ---\n${context.trim()}\n--- END USER CONTEXT ---`)
  }

  if (failures.length > 0) {
    const lines = failures.map(f =>
      `- ${f.selector}: "${f.text.slice(0, 60)}" — fg ${f.foreground} on bg ${f.background}, ratio ${f.contrastRatio}:1 (needs ${f.required}:1)`
    ).join('\n')
    parts.push('# Accessibility (WCAG Contrast)\n' + lines)
  }

  if (designFailures && designFailures.length > 0) {
    const lines = designFailures.map(d =>
      `- ${d.selector}: ${d.description} (value: ${d.value}, expected: ${d.expected})`
    ).join('\n')
    parts.push('# Design Quality\n' + lines)
  }

  return parts.join('\n\n') || 'No issues to analyze.'
}

function validateKey(apiKey: string, provider: string): void {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(`API key missing for ${provider}. Enter your key in the AI panel.`)
  }
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string | null,
  model: string,
  systemPrompt: string,
  prompt: string,
  maxTokens: number
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  return fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: maxTokens
    })
  })
}

function parseOpenAICompatibleResponse(res: Response, label: string): Promise<any> {
  if (!res.ok) {
    return res.text().then(err => { throw new Error(`${label} API error (${res.status}): ${err}`) })
  }
  return res.json().then(data => JSON.parse(data.choices[0].message.content))
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<LlmResult> {
  validateKey(apiKey, 'Anthropic')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error (${res.status}): ${err}`)
  }
  const data = await res.json()
  const content = data.content?.[0]?.text
  if (!content) throw new Error('Anthropic returned empty response')
  return JSON.parse(content)
}

async function callGoogle(apiKey: string, model: string, prompt: string): Promise<LlmResult> {
  validateKey(apiKey, 'Google')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 }
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google API error (${res.status}): ${err}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Google returned empty response')
  return JSON.parse(text)
}

const OLLAMA_DEFAULT_BASE = 'http://localhost:11434'

async function callOllama(baseUrl: string, model: string, prompt: string): Promise<LlmResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/generate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT,
      prompt,
      options: { temperature: 0.2 },
      stream: false
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ollama API error (${res.status}): ${err}`)
  }
  const data = await res.json()
  try {
    return JSON.parse(data.response)
  } catch {
    const match = data.response.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Ollama returned non-JSON response')
  }
}

export interface FixSuggestion {
  explanation: string
  cssFix: string
  priority: 'high' | 'medium' | 'low'
}

const FIX_PROMPT = `You are an accessibility expert. Given a single contrast failure, provide a specific CSS fix.
Respond ONLY with valid JSON matching this schema:
{
  "explanation": "string - one sentence explaining why it fails",
  "cssFix": "string - specific CSS rule to apply (e.g. "color: #333333")",
  "priority": "high|medium|low"
}`

function buildFixPrompt(failure: Failure): string {
  return `Contrast failure: "${failure.text}" (${failure.selector}). Foreground: ${failure.foreground}, Background: ${failure.background}, Ratio: ${failure.contrastRatio}:1, Required: ${failure.required}:1. Provide a CSS fix.`
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    'openai-compatible': 'OpenAI Compatible',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'ollama': 'Ollama'
  }
  return labels[provider] || provider
}

async function callProviderForFix(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string,
  baseUrl?: string
): Promise<FixSuggestion> {
  switch (provider) {
    case 'openai-compatible': {
      const url = baseUrl || 'https://api.openai.com/v1'
      if (apiKey) validateKey(apiKey, getProviderLabel(provider))
      const res = await callOpenAICompatible(url, apiKey || null, model, FIX_PROMPT, prompt, 500)
      return parseOpenAICompatibleResponse(res, getProviderLabel(provider))
    }
    case 'anthropic': {
      validateKey(apiKey, 'Anthropic')
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 500, system: FIX_PROMPT, messages: [{ role: 'user', content: prompt }] })
      })
      if (!res.ok) throw new Error(`Anthropic error (${res.status})`)
      const data = await res.json()
      return JSON.parse(data.content?.[0]?.text || '{}')
    }
    case 'google': {
      validateKey(apiKey, 'Google')
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${FIX_PROMPT}\n\n${prompt}` }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 500 } })
      })
      if (!res.ok) throw new Error(`Google error (${res.status})`)
      const data = await res.json()
      return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    }
    case 'ollama': {
      const url = baseUrl || OLLAMA_DEFAULT_BASE
      const res = await fetch(`${url.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, system: FIX_PROMPT, prompt, options: { temperature: 0.2 }, stream: false })
      })
      if (!res.ok) throw new Error(`Ollama error (${res.status})`)
      const data = await res.json()
      try { return JSON.parse(data.response) } catch {
        const match = data.response.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
        throw new Error('Ollama returned non-JSON response')
      }
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

export async function getFixSuggestion(
  failure: Failure,
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string
): Promise<FixSuggestion> {
  const prompt = buildFixPrompt(failure)
  const result = await callProviderForFix(provider, model, apiKey, prompt, baseUrl)
  if (!result.explanation || !result.cssFix) {
    throw new Error('Incomplete fix suggestion')
  }
  return result
}

export async function enrichWithLLM(
  failures: Failure[],
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string,
  designFailures?: DesignFailureCtx[],
  context?: string
): Promise<LlmResult> {
  const prompt = buildPrompt(failures.slice(0, 50), designFailures?.slice(0, 30), context)
  switch (provider) {
    case 'openai-compatible': {
      const url = baseUrl || 'https://api.openai.com/v1'
      if (apiKey) validateKey(apiKey, getProviderLabel(provider))
      const res = await callOpenAICompatible(url, apiKey || null, model, SYSTEM_PROMPT, prompt, 3000)
      return parseOpenAICompatibleResponse(res, getProviderLabel(provider))
    }
    case 'anthropic':
      return callAnthropic(apiKey, model, prompt)
    case 'google':
      return callGoogle(apiKey, model, prompt)
    case 'ollama':
      return callOllama(baseUrl || OLLAMA_DEFAULT_BASE, model, prompt)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
