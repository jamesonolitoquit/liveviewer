import { describe, test, expect } from 'vitest'
import { csvFromAudit, jsonFromAudit } from './export'

const mockData = {
  url: 'https://example.com',
  timestamp: Date.now(),
  viewport: { width: 1280, height: 800 },
  wcag: {
    totalElements: 50,
    failures: [
      {
        selector: 'body > h1',
        text: 'Welcome to the site',
        foreground: '#737373',
        background: '#ffffff',
        contrastRatio: 3.5,
        required: 4.5,
        fontSize: 32,
        isLarge: true
      },
      {
        selector: 'body > p',
        text: 'Some text here',
        foreground: '#a3a3a3',
        background: '#ffffff',
        contrastRatio: 2.1,
        required: 4.5,
        fontSize: 16,
        isLarge: false
      }
    ],
    passCount: 48,
    failCount: 2,
    score: 85
  }
}

describe('csvFromAudit', () => {
  test('includes header row', () => {
    const csv = csvFromAudit(mockData as any)
    expect(csv).toContain('Selector,Text,Foreground,Background')
  })

  test('includes all failures as rows', () => {
    const csv = csvFromAudit(mockData as any)
    const lines = csv.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(lines[1]).toContain('body > h1')
    expect(lines[2]).toContain('body > p')
  })

  test('includes summary row', () => {
    const csv = csvFromAudit(mockData as any)
    expect(csv).toContain('48,2,50,85')
  })

  test('handles empty failures array', () => {
    const noFailures = { ...mockData, wcag: { ...mockData.wcag, failures: [], failCount: 0, passCount: 50 } }
    const csv = csvFromAudit(noFailures as any)
    expect(csv).toContain('Selector,Text,Foreground')
    expect(csv).toContain('50,0,50,85')
  })

  test('escapes commas and quotes in text fields', () => {
    const withComma = {
      ...mockData,
      wcag: {
        ...mockData.wcag,
        failures: [{
          ...mockData.wcag.failures[0],
          text: 'Hello, "world" & more'
        }]
      }
    }
    const csv = csvFromAudit(withComma as any)
    expect(csv).toContain('"Hello, ""world"" & more"')
  })

  test('handles null wcag data', () => {
    const csv = csvFromAudit({ ...mockData, wcag: null } as any)
    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('Selector')
  })
})

describe('jsonFromAudit', () => {
  test('returns valid JSON string', () => {
    const json = jsonFromAudit(mockData as any)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  test('includes structured failure data', () => {
    const json = JSON.parse(jsonFromAudit(mockData as any))
    expect(json.url).toBe('https://example.com')
    expect(json.failures).toHaveLength(2)
    expect(json.failures[0].contrastRatio).toBe(3.5)
    expect(json.summary.score).toBe(85)
  })

  test('handles null wcag', () => {
    const json = JSON.parse(jsonFromAudit({ ...mockData, wcag: null } as any))
    expect(json.summary).toBeNull()
    expect(json.failures).toEqual([])
  })
})
