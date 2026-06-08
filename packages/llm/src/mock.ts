import type { LLMResponse, FailureAnalysis } from './types.js'

export const MOCK_SUCCESS_RESPONSE: LLMResponse = {
  provider: 'mock',
  model: 'mock-v1',
  summary: '3 contrast failures on headings and buttons, 1 design issue',
  perFailure: [
    {
      selector: 'h1.hero-title',
      ruleId: 'color-contrast',
      explanation: 'White text on light blue background has ratio 2.1:1, needs 4.5:1',
      suggestion: 'Darken text to #1a1a2e or darken background to #003366',
      severity: 'high'
    }
  ],
  designFixes: [
    {
      selector: 'p.body-text',
      ruleId: 'font-size-legible',
      explanation: 'Body text is 12px, minimum 16px for legibility',
      suggestion: 'Increase font-size to 16px',
      severity: 'medium'
    }
  ],
  cached: false
}

export function createMockClient(scenario: 'success' | 'error' | 'empty' | 'malformed' = 'success'): {
  complete<T>(_prompt: string, _system?: string, _schema?: object): Promise<T>
} {
  return {
    async complete<T>(_prompt: string, _system?: string, _schema?: object): Promise<T> {
      switch (scenario) {
        case 'success':
          return MOCK_SUCCESS_RESPONSE as unknown as T
        case 'error':
          throw new Error('Mock LLM error')
        case 'empty':
          return { summary: '', perFailure: [] } as unknown as T
        case 'malformed':
          return { unexpected: 'shape' } as unknown as T
      }
    }
  }
}
