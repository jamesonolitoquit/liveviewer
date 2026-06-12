import { describe, it, expect } from 'vitest'

const { toSarifLog, RULE_DEFS } = require('./sarif.js')

describe('toSarifLog', () => {
  const baseAudit = {
    url: 'https://example.com',
    timestamp: Date.now(),
    viewport: { width: 1280, height: 800 },
    wcag: null,
    design: null
  }

  it('produces valid SARIF 2.1.0 structure', () => {
    const result = toSarifLog(baseAudit)
    expect(result.$schema).toContain('sarif/v2.1.0')
    expect(result.version).toBe('2.1.0')
    expect(result.runs).toHaveLength(1)
    expect(result.runs[0].tool.driver.name).toBe('Liveviewer')
  })

  it('includes rules from RULE_DEFS in driver', () => {
    const result = toSarifLog(baseAudit)
    const rules = result.runs[0].tool.driver.rules
    const ruleIds = rules.map(r => r.id)
    expect(ruleIds).toContain('WCAG1411')
    expect(ruleIds).toContain('DESIGN-FONTSIZE')
    expect(ruleIds).toContain('DESIGN-LINEHEIGHT')
    expect(ruleIds).toContain('DESIGN-SCROLL')
    expect(ruleIds).toContain('DESIGN-HEADING')
    expect(ruleIds).toContain('A11Y-MISSING-ALT')
    expect(ruleIds).toContain('A11Y-EMPTY-INTERACTIVE')
    expect(ruleIds).toContain('A11Y-MISSING-LANG')
    expect(ruleIds).toContain('A11Y-MISSING-LABEL')
    expect(ruleIds).toContain('A11Y-SKIP-NAV')
  })

  it('maps heading-hierarchy failures to DESIGN-HEADING rule', () => {
    const audit = {
      ...baseAudit,
      design: {
        failures: [
          { ruleId: 'heading-hierarchy', ruleName: 'Heading hierarchy', selector: 'h2', description: 'Heading level skipped', severity: 'medium', value: 'h1 → h3', expected: 'no skipped levels' }
        ],
        totalChecks: 5,
        passCount: 4,
        failCount: 1,
        score: 80
      }
    }
    const result = toSarifLog(audit)
    expect(result.runs[0].results).toHaveLength(1)
    expect(result.runs[0].results[0].ruleId).toBe('DESIGN-HEADING')
    expect(result.runs[0].results[0].message.text).toContain('Heading level skipped')
  })

  it('outputs wcag contrast failures as results', () => {
    const audit = {
      ...baseAudit,
      wcag: {
        totalElements: 10,
        failures: [
          { selector: 'h1', text: 'Title', foreground: '#ffffff', background: '#eeeeee', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true },
          { selector: 'p', text: 'Body', foreground: '#cccccc', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 8,
        failCount: 2,
        score: 80
      }
    }
    const result = toSarifLog(audit)
    expect(result.runs[0].results).toHaveLength(2)
    expect(result.runs[0].results[0].ruleId).toBe('WCAG1411')
    expect(result.runs[0].results[0].level).toBe('error')
    expect(result.runs[0].results[0].message.text).toContain('h1')
    expect(result.runs[0].results[0].properties.contrastRatio).toBe(2.1)
    expect(result.runs[0].results[1].level).toBe('warning')
  })

  it('outputs design failures as results', () => {
    const audit = {
      ...baseAudit,
      design: {
        failures: [
          { ruleId: 'font-size-legible', ruleName: 'Font Size Legibility', selector: '.body', description: 'Text too small', severity: 'medium', value: '12px', expected: '≥ 16px' },
          { ruleId: 'horizontal-scroll', ruleName: 'Horizontal Scroll', selector: 'html', description: 'Page overflows', severity: 'medium', value: '124px overflow', expected: 'no overflow' }
        ],
        totalChecks: 10,
        passCount: 8,
        failCount: 2,
        score: 80
      }
    }
    const result = toSarifLog(audit)
    const results = result.runs[0].results
    expect(results).toHaveLength(2)
    expect(results[0].ruleId).toBe('DESIGN-FONTSIZE')
    expect(results[0].message.text).toContain('Text too small')
    expect(results[1].ruleId).toBe('DESIGN-SCROLL')
  })

  it('maps a11y failures to SARIF rule IDs', () => {
    const audit = {
      ...baseAudit,
      design: {
        failures: [
          { ruleId: 'missing-alt', ruleName: 'Missing alt text', selector: 'img.logo', description: 'Image missing alt attribute', severity: 'high', value: '', expected: 'descriptive alt text or role="presentation"' },
          { ruleId: 'empty-interactive', ruleName: 'Empty interactive element', selector: 'button.submit', description: 'Button has no text or aria-label', severity: 'high', value: '', expected: 'text content or aria-label' },
          { ruleId: 'missing-lang', ruleName: 'Missing lang attribute', selector: 'html', description: 'Page has no lang attribute', severity: 'high', value: '', expected: 'lang="en"' }
        ],
        totalChecks: 8,
        passCount: 5,
        failCount: 3,
        score: 37.5
      }
    }
    const result = toSarifLog(audit)
    const results = result.runs[0].results
    expect(results).toHaveLength(3)
    expect(results[0].ruleId).toBe('A11Y-MISSING-ALT')
    expect(results[0].level).toBe('error')
    expect(results[0].message.text).toContain('Image missing alt attribute')
    expect(results[1].ruleId).toBe('A11Y-EMPTY-INTERACTIVE')
    expect(results[2].ruleId).toBe('A11Y-MISSING-LANG')
  })

  it('maps missing-label and skip-navigation to SARIF rule IDs', () => {
    const audit = {
      ...baseAudit,
      design: {
        failures: [
          { ruleId: 'missing-label', ruleName: 'Form control missing label', selector: 'input#search', description: 'Input missing accessible label', severity: 'high', value: 'no label', expected: 'label element or aria-label' },
          { ruleId: 'skip-navigation', ruleName: 'No skip navigation', selector: 'body', description: 'No skip link or main landmark found', severity: 'high', value: 'no skip link', expected: 'skip link or role="main"' }
        ],
        totalChecks: 2,
        passCount: 0,
        failCount: 2,
        score: 0
      }
    }
    const result = toSarifLog(audit)
    const results = result.runs[0].results
    expect(results).toHaveLength(2)
    expect(results[0].ruleId).toBe('A11Y-MISSING-LABEL')
    expect(results[0].level).toBe('error')
    expect(results[0].message.text).toContain('Input missing accessible label')
    expect(results[1].ruleId).toBe('A11Y-SKIP-NAV')
    expect(results[1].message.text).toContain('No skip link or main landmark found')
  })

  it('merges wcag and design failures in results', () => {
    const audit = {
      ...baseAudit,
      wcag: {
        totalElements: 10,
        failures: [
          { selector: 'h1', text: 'Title', foreground: '#fff', background: '#000', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true }
        ],
        passCount: 9,
        failCount: 1,
        score: 90
      },
      design: {
        failures: [
          { ruleId: 'line-height-readable', ruleName: 'Line Height', selector: 'p', description: 'Line height too tight', severity: 'medium', value: '1.2', expected: '1.4 – 1.6' },
          { ruleId: 'missing-lang', ruleName: 'Missing lang attribute', selector: 'html', description: 'Page has no lang attribute', severity: 'high', value: '', expected: 'lang="en"' }
        ],
        totalChecks: 6,
        passCount: 4,
        failCount: 2,
        score: 67
      }
    }
    const result = toSarifLog(audit)
    expect(result.runs[0].results).toHaveLength(3)
    expect(result.runs[0].results[0].ruleId).toBe('WCAG1411')
    expect(result.runs[0].results[1].ruleId).toBe('DESIGN-LINEHEIGHT')
    expect(result.runs[0].results[2].ruleId).toBe('A11Y-MISSING-LANG')
  })

  it('includes url in location artifact', () => {
    const audit = {
      ...baseAudit,
      wcag: {
        totalElements: 1,
        failures: [
          { selector: '.btn', text: 'Click', foreground: '#fff', background: '#333', contrastRatio: 2.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 1,
        score: 0
      }
    }
    const result = toSarifLog(audit)
    const loc = result.runs[0].results[0].locations[0]
    expect(loc.physicalLocation.artifactLocation.uri).toBe('https://example.com')
    expect(loc.physicalLocation.region.snippet.text).toBe('.btn')
  })

  it('maps ai-generated-content to AI-GENERATED rule', () => {
    const audit = {
      ...baseAudit,
      ai: {
        failures: [{
          ruleId: 'ai-generated-content',
          ruleName: 'Content may be AI-generated',
          category: 'ai',
          selector: 'body',
          description: 'AI detection confidence: 85%. Signals: 4',
          severity: 'info',
          value: '85% confidence',
          expected: 'human-authored content expected (no AI signals)'
        }],
        confidence: 85,
        level: 'likely',
        signals: [{ type: 'ai-disclosure', detail: 'AI disclosure', weight: 0.3 }],
        totalChecks: 1,
        passCount: 0,
        failCount: 1,
        score: 0
      }
    }
    const result = toSarifLog(audit)
    const results = result.runs[0].results
    expect(results).toHaveLength(1)
    expect(results[0].ruleId).toBe('AI-GENERATED')
    expect(results[0].level).toBe('note')
    expect(results[0].message.text).toContain('AI detection confidence: 85%')
    expect(results[0].properties.confidence).toBe(85)
    expect(results[0].properties.level).toBe('likely')
    expect(results[0].properties.signalCount).toBe(1)
  })

  it('includes AI-GENERATED rule in driver rules', () => {
    const result = toSarifLog(baseAudit)
    const ruleIds = result.runs[0].tool.driver.rules.map(r => r.id)
    expect(ruleIds).toContain('AI-GENERATED')
    const aiRule = result.runs[0].tool.driver.rules.find(r => r.id === 'AI-GENERATED')
    expect(aiRule.properties.experimental).toBe(true)
    expect(aiRule.properties.category).toBe('ai')
  })

  it('skips AI results when ai is null or has no failures', () => {
    const result = toSarifLog(baseAudit)
    expect(result.runs[0].results).toEqual([])
  })

  it('returns empty results for no failures', () => {
    const result = toSarifLog(baseAudit)
    expect(result.runs[0].results).toEqual([])
  })
})
