export const WCAG_ANALYSIS_SCHEMA = {
  name: 'analyze_wcag_failures',
  description: 'Analyze WCAG contrast failures and suggest fixes',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'One-sentence summary of all failures'
      },
      perFailure: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the failing element'
            },
            ruleId: {
              type: 'string',
              description: 'WCAG rule ID, e.g. color-contrast'
            },
            explanation: {
              type: 'string',
              description: 'Why this element fails contrast requirements'
            },
            suggestion: {
              type: 'string',
              description: 'Specific fix suggestion with exact color values'
            },
            severity: {
              type: 'string',
              enum: ['high', 'medium', 'low']
            }
          },
          required: ['selector', 'ruleId', 'explanation', 'suggestion', 'severity']
        }
      }
    },
    required: ['summary', 'perFailure']
  }
}

export async function createOpenAIClient(options: {
  model: string
  apiKey: string
  baseUrl?: string
}): Promise<{ complete<T>(prompt: string): Promise<T> }> {
  let OpenAI: any
  try {
    OpenAI = (await import('openai')).default
  } catch {
    throw new Error(
      'OpenAI package not installed. Run: npm install openai'
    )
  }

  const clientOptions: { apiKey: string; baseURL?: string } = { apiKey: options.apiKey };
  if (options.baseUrl) clientOptions.baseURL = options.baseUrl;
  const client = new OpenAI(clientOptions);

  return {
    async complete<T>(prompt: string): Promise<T> {
      const response = await client.chat.completions.create({
        model: options.model,
        messages: [{ role: 'user', content: prompt }],
        tools: [{
          type: 'function',
          function: WCAG_ANALYSIS_SCHEMA
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_wcag_failures' } },
        temperature: 0.2,
        max_tokens: 2000
      })

      const toolCall = response.choices[0]?.message?.tool_calls?.[0]
      if (!toolCall?.function?.arguments) {
        throw new Error('OpenAI did not return a structured response')
      }

      return JSON.parse(toolCall.function.arguments) as T
    }
  }
}
