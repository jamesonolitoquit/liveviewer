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
  provider: string
  model: string
}

const SYSTEM_PROMPT = `You are an accessibility expert analyzing WCAG contrast failures.
Respond ONLY with valid JSON matching this exact schema:
{
  "summary": "string - one sentence summary of all failures",
  "perFailure": [
    {
      "selector": "string - CSS selector",
      "ruleId": "color-contrast",
      "explanation": "string - why it fails",
      "suggestion": "string - how to fix with specific color values",
      "severity": "high|medium|low"
    }
  ]
}`

function buildPrompt(failures: Failure[]): string {
  const lines = failures.map(f =>
    `- ${f.selector}: "${f.text.slice(0, 60)}" — fg ${f.foreground} on bg ${f.background}, ratio ${f.contrastRatio}:1 (needs ${f.required}:1)`
  ).join('\n')

  return `Analyze these WCAG contrast failures and suggest specific fixes with exact color values:\n${lines}`
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<LlmResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<LlmResult> {
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${SYSTEM_PROMPT}\n\n${prompt}`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000
      }
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

async function callGroq(apiKey: string, model: string, prompt: string): Promise<LlmResult> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

export async function enrichWithLLM(
  failures: Failure[],
  provider: string,
  model: string,
  apiKey: string
): Promise<LlmResult> {
  const prompt = buildPrompt(failures.slice(0, 50))

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model, prompt)
    case 'anthropic':
      return callAnthropic(apiKey, model, prompt)
    case 'google':
      return callGoogle(apiKey, model, prompt)
    case 'groq':
      return callGroq(apiKey, model, prompt)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
