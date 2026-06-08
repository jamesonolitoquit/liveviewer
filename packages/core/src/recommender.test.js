import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { recommend, generateFixSuggestions } = require('./recommender.js')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-rec-'))

function write(name, data) {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, JSON.stringify(data))
  return p
}

describe('recommend', () => {
  it('returns error when no wcag data', () => {
    const p = write('no-wcag.json', { url: 'https://example.com' })
    const result = recommend(p, null)
    expect(result.error).toContain('No WCAG data')
  })

  it('generates recommendations sorted by severity', () => {
    const auditPath = write('audit1.json', {
      url: 'https://example.com', timestamp: 0,
      wcag: {
        totalElements: 2,
        failures: [
          { selector: 'h1', text: 'A', foreground: '#ffffff', background: '#000000', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true },
          { selector: 'p', text: 'B', foreground: '#cccccc', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 2,
        score: 0
      }
    })

    const result = recommend(auditPath, null)
    expect(result.recommendations).toHaveLength(2)
    expect(result.recommendations[0].severity).toBe('high')
    expect(result.recommendations[0].selector).toBe('h1')
    expect(result.recommendations[1].severity).toBe('medium')
    expect(result.recommendations[1].selector).toBe('p')
  })

  it('identifies token issues from extract data', () => {
    const auditPath = write('audit2.json', {
      url: 'https://example.com', timestamp: 0,
      wcag: {
        totalElements: 1,
        failures: [
          { selector: 'p', text: 'Body', foreground: '#999999', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 1,
        score: 0
      }
    })
    const extractPath = write('extract2.json', {
      styles: {
        colors: {
          'rgb(153, 153, 153)': { count: 15, selectors: ['.d', '.e', '.f'] }
        }
      }
    })

    const result = recommend(auditPath, extractPath)
    expect(result.recommendations).toBeDefined()
    const token = result.recommendations.find(r => r.type === 'token')
    expect(token).toBeDefined()
    expect(token.totalUsage).toBe(15)
  })
})

describe('generateFixSuggestions', () => {
  it('returns empty array when no failures', () => {
    const result = generateFixSuggestions({ url: 'https://example.com', wcag: null, design: null })
    expect(result).toEqual([])
  })

  it('returns contrast suggestions for wcag failures', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: {
        totalElements: 2,
        failures: [
          { selector: 'h1', text: 'Heading', foreground: '#ffffff', background: '#eeeeee', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true },
          { selector: 'p', text: 'Body', foreground: '#cccccc', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 2,
        score: 0
      },
      design: null
    })

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('contrast')
    expect(result[0].severity).toBe('high')
    expect(result[0].selector).toBe('h1')
    expect(result[0].recommendation).toContain('Increase contrast')
    expect(result[1].severity).toBe('medium')
  })

  it('returns design suggestions for design failures', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: null,
      design: {
        failures: [
          { ruleId: 'font-size-legible', ruleName: 'Font Size Legibility', selector: '.body-text', description: 'Text too small', severity: 'medium', value: '12px', expected: '≥ 16px' },
          { ruleId: 'line-height-readable', ruleName: 'Line Height Readability', selector: 'p', description: 'Line height too tight', severity: 'medium', value: '1.2', expected: '1.4 – 1.6' },
          { ruleId: 'horizontal-scroll', ruleName: 'Horizontal Scroll', selector: 'html', description: 'Page overflows', severity: 'medium', value: '124px overflow', expected: 'no overflow' }
        ],
        totalChecks: 10,
        passCount: 7,
        failCount: 3,
        score: 70
      }
    })

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('font-size-legible')
    expect(result[0].recommendation).toContain('Increase font-size')
    expect(result[0].recommendation).toContain('.body-text')
    expect(result[1].type).toBe('line-height-readable')
    expect(result[1].recommendation).toContain('Adjust line-height')
    expect(result[2].type).toBe('horizontal-scroll')
    expect(result[2].recommendation).toContain('Prevent overflow')
  })

  it('sorts high severity before medium', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: {
        totalElements: 2,
        failures: [
          { selector: '.moderate', text: 'M', foreground: '#aaaaaa', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false },
          { selector: '.severe', text: 'S', foreground: '#ffffff', background: '#cccccc', contrastRatio: 2.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 2,
        score: 0
      },
      design: null
    })

    expect(result[0].selector).toBe('.severe')
    expect(result[1].selector).toBe('.moderate')
  })

  it('returns design severity: font-size < 12px = high', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: null,
      design: {
        failures: [
          { ruleId: 'font-size-legible', ruleName: 'Font Size Legibility', selector: '.tiny', description: 'Very small text', severity: 'medium', value: '10px', expected: '≥ 16px' }
        ],
        totalChecks: 1,
        passCount: 0,
        failCount: 1,
        score: 0
      }
    })

    expect(result[0].severity).toBe('high')
  })

  it('merges wcag and design suggestions sorted together', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: {
        totalElements: 1,
        failures: [
          { selector: 'h1', text: 'Head', foreground: '#999999', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 1,
        score: 0
      },
      design: {
        failures: [
          { ruleId: 'font-size-legible', ruleName: 'Font Size', selector: 'p', description: 'Small', severity: 'medium', value: '14px', expected: '≥ 16px' }
        ],
        totalChecks: 1,
        passCount: 0,
        failCount: 1,
        score: 0
      }
    })

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('contrast')
    expect(result[1].type).toBe('font-size-legible')
  })

  it('returns fix suggestions for heading-hierarchy', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: null,
      design: {
        failures: [
          { ruleId: 'heading-hierarchy', ruleName: 'Heading hierarchy', selector: 'h3', description: 'Heading level skipped (h1 → h3)', severity: 'medium', value: 'h1 → h3', expected: 'no skipped levels' }
        ],
        totalChecks: 3,
        passCount: 2,
        failCount: 1,
        score: 67
      }
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('heading-hierarchy')
    expect(result[0].recommendation).toContain('Fix heading hierarchy')
    expect(result[0].recommendation).toContain('h3')
  })

  it('returns fix suggestions for a11y rules', () => {
    const result = generateFixSuggestions({
      url: 'https://example.com',
      wcag: null,
      design: {
        failures: [
          { ruleId: 'missing-alt', ruleName: 'Missing alt text', selector: 'img.logo', description: 'Image missing alt attribute', severity: 'high', value: '', expected: 'descriptive alt text or role="presentation"' },
          { ruleId: 'empty-interactive', ruleName: 'Empty interactive element', selector: 'button.submit', description: 'Button has no text or aria-label', severity: 'high', value: '', expected: 'text content or aria-label' },
          { ruleId: 'missing-lang', ruleName: 'Missing lang attribute', selector: 'html', description: 'Page has no lang attribute', severity: 'high', value: '', expected: 'lang="en"' }
        ],
        totalChecks: 3,
        passCount: 0,
        failCount: 3,
        score: 0
      }
    })
    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('missing-alt')
    expect(result[0].recommendation).toContain('Add alt text')
    expect(result[0].recommendation).toContain('img.logo')
    expect(result[1].type).toBe('empty-interactive')
    expect(result[1].recommendation).toContain('Add accessible name')
    expect(result[1].recommendation).toContain('button.submit')
    expect(result[2].type).toBe('missing-lang')
    expect(result[2].recommendation).toContain('Add lang attribute')
  })
})
