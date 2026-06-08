const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434'

export async function createOllamaClient(options: {
  model: string
  baseUrl?: string
}): Promise<{ complete<T>(prompt: string, system?: string): Promise<T> }> {
  const baseUrl = options.baseUrl ?? OLLAMA_DEFAULT_BASE_URL

  let Ollama: any
  try {
    Ollama = (await import('ollama')).default
  } catch {
    // fallback to raw HTTP
  }

  if (Ollama) {
    const client = new Ollama({ host: baseUrl })
    return {
      async complete<T>(prompt: string, system?: string): Promise<T> {
        const response = await client.generate({
          model: options.model,
          system: system || '',
          prompt,
          options: { temperature: 0.2 }
        })
        return parseJSONResponse<T>(response.response)
      }
    }
  }

  // Raw HTTP fallback
  return {
    async complete<T>(prompt: string, system?: string): Promise<T> {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          system: system || '',
          prompt,
          options: { temperature: 0.2 },
          stream: false
        })
      })
      if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      return parseJSONResponse<T>(data.response)
    }
  }
}

function parseJSONResponse<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0]) as T
    }
    throw new Error('Ollama response is not valid JSON')
  }
}
