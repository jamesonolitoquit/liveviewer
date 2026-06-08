export async function createOpenAIClient(options: {
  model: string
  apiKey: string
  baseUrl?: string
}): Promise<{ complete<T>(prompt: string, system?: string): Promise<T> }> {
  const baseUrl = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')

  return {
    async complete<T>(prompt: string, system?: string): Promise<T> {
      const messages: { role: string; content: string }[] = []
      if (system) messages.push({ role: 'system', content: system })
      messages.push({ role: 'user', content: prompt })

      const body: Record<string, any> = {
        model: options.model,
        messages,
        temperature: 0.2,
        max_tokens: 4096
      }

      if (options.model?.includes('deepseek')) {
        body.thinking = { type: 'disabled' }
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const err = await res.text()
        let msg = `Error from provider (${res.status})`
        try {
          const parsed = JSON.parse(err)
          if (parsed.error?.message) msg = parsed.error.message
        } catch { }
        throw new Error(msg)
      }

      const data = await res.json()
      const msg = data.choices?.[0]?.message
      let content = msg?.content || msg?.reasoning_content

      if (!content) {
        throw new Error('LLM returned empty response')
      }

      // Try to extract JSON object from response (handles text-wrapped JSON)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T
      }

      return JSON.parse(content) as T
    }
  }
}
