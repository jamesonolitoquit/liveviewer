import type { LLMResponse, FailureAnalysis } from './types.js'

export const MOCK_SUCCESS_RESPONSE: LLMResponse = {
  provider: 'mock',
  model: 'mock-v1',
  summary: '3 contrast failures on headings and buttons, 1 design issue, 2 SEO issues, 1 missing security header',
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
  perPillarFixes: {
    seo: [
      {
        pillar: 'seo',
        selector: 'head',
        ruleId: 'missing-meta-description',
        explanation: 'Missing meta description reduces search result click-through rate',
        suggestion: 'Add <meta name="description"> with a concise page summary',
        severity: 'medium'
      }
    ],
    security: [
      {
        pillar: 'security',
        selector: 'head',
        ruleId: 'missing-hsts',
        explanation: 'Missing Strict-Transport-Security header allows downgrade attacks',
        suggestion: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
        severity: 'high'
      }
    ],
    legal: [
      {
        pillar: 'legal',
        selector: 'body',
        ruleId: 'cookie-consent',
        explanation: 'No cookie consent banner detected for GDPR compliance',
        suggestion: 'Add a cookie consent banner and cookie policy page',
        severity: 'high'
      }
    ],
    performance: [
      {
        pillar: 'performance',
        selector: 'page',
        ruleId: 'lcp',
        explanation: 'LCP of 3.2s exceeds 2.5s target',
        suggestion: 'Optimise hero image with compression and preload',
        severity: 'medium'
      }
    ]
  },
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
