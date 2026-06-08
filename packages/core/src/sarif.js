const pkg = require('../package.json')

const RULE_DEFS = {
  'WCAG1411': {
    id: 'WCAG1411',
    name: 'color-contrast',
    shortDescription: 'WCAG 1.4.1.1: Color contrast below required ratio',
    fullDescription: 'Text or images of text must have a contrast ratio of at least 4.5:1 (3:1 for large text) against their background.',
    helpUri: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum',
    defaultLevel: 'error',
    properties: { category: 'accessibility', tags: ['wcag', 'contrast'] }
  },
  'DESIGN-FONTSIZE': {
    id: 'DESIGN-FONTSIZE',
    name: 'font-size-legible',
    shortDescription: 'Body text smaller than 16px',
    fullDescription: 'Body text should be at least 16px for legibility on standard screens.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'design', tags: ['typography', 'font-size'] }
  },
  'DESIGN-LINEHEIGHT': {
    id: 'DESIGN-LINEHEIGHT',
    name: 'line-height-readable',
    shortDescription: 'Line height outside readable range (1.4–1.6)',
    fullDescription: 'Line height should be between 1.4 and 1.6 for comfortable reading.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'design', tags: ['typography', 'line-height'] }
  },
  'DESIGN-SCROLL': {
    id: 'DESIGN-SCROLL',
    name: 'horizontal-scroll',
    shortDescription: 'Horizontal scroll detected',
    fullDescription: 'Content overflows the viewport, causing horizontal scrolling.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'design', tags: ['layout', 'scroll'] }
  },
  'DESIGN-HEADING': {
    id: 'DESIGN-HEADING',
    name: 'heading-hierarchy',
    shortDescription: 'Heading hierarchy violation',
    fullDescription: 'Heading levels should not skip (e.g. h1 → h3 without h2) and exactly one h1 should exist.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'design', tags: ['typography', 'heading', 'hierarchy'] }
  },
  'A11Y-MISSING-ALT': {
    id: 'A11Y-MISSING-ALT',
    name: 'missing-alt',
    shortDescription: 'Images require alt text',
    fullDescription: 'All images must have an alt attribute with descriptive text or role="presentation" for decorative images.',
    helpUri: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content',
    defaultLevel: 'error',
    properties: { category: 'accessibility', tags: ['wcag', 'images', 'alt-text'] }
  },
  'A11Y-EMPTY-INTERACTIVE': {
    id: 'A11Y-EMPTY-INTERACTIVE',
    name: 'empty-interactive',
    shortDescription: 'Interactive elements must have an accessible name',
    fullDescription: 'Buttons and links must have text content or an aria-label attribute.',
    helpUri: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value',
    defaultLevel: 'error',
    properties: { category: 'accessibility', tags: ['wcag', 'interactive', 'name'] }
  },
  'A11Y-MISSING-LANG': {
    id: 'A11Y-MISSING-LANG',
    name: 'missing-lang',
    shortDescription: 'Page must have a lang attribute',
    fullDescription: 'The html element must have a lang attribute that specifies the language of the page.',
    helpUri: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page',
    defaultLevel: 'error',
    properties: { category: 'accessibility', tags: ['wcag', 'language'] }
  },
  'A11Y-MISSING-LABEL': {
    id: 'A11Y-MISSING-LABEL',
    name: 'missing-label',
    shortDescription: 'Form controls must have associated labels',
    fullDescription: 'Inputs, textareas, and selects must have a label element, aria-label, aria-labelledby, or title attribute.',
    helpUri: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions',
    defaultLevel: 'error',
    properties: { category: 'accessibility', tags: ['wcag', 'forms', 'labels'] }
  },
  'A11Y-SKIP-NAV': {
    id: 'A11Y-SKIP-NAV',
    name: 'skip-navigation',
    shortDescription: 'Page should have skip navigation or main landmark',
    fullDescription: 'A skip link or role="main" landmark helps keyboard users bypass repetitive navigation.',
    helpUri: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks',
    defaultLevel: 'error',
    properties: { category: 'accessibility', tags: ['wcag', 'navigation', 'keyboard'] }
  }
}

function ruleIdFor(failure) {
  if (failure.type === 'contrast' || failure.ruleId === 'color-contrast') return 'WCAG1411'
  if (failure.ruleId === 'font-size-legible') return 'DESIGN-FONTSIZE'
  if (failure.ruleId === 'line-height-readable') return 'DESIGN-LINEHEIGHT'
  if (failure.ruleId === 'horizontal-scroll') return 'DESIGN-SCROLL'
  if (failure.ruleId === 'heading-hierarchy') return 'DESIGN-HEADING'
  if (failure.ruleId === 'missing-alt') return 'A11Y-MISSING-ALT'
  if (failure.ruleId === 'empty-interactive') return 'A11Y-EMPTY-INTERACTIVE'
  if (failure.ruleId === 'missing-lang') return 'A11Y-MISSING-LANG'
  if (failure.ruleId === 'missing-label') return 'A11Y-MISSING-LABEL'
  if (failure.ruleId === 'skip-navigation') return 'A11Y-SKIP-NAV'
  return 'CUSTOM'
}

function levelFor(severity) {
  if (severity === 'high') return 'error'
  if (severity === 'medium') return 'warning'
  return 'note'
}

function toSarifResults(wcagFailures, designFailures) {
  const results = []

  for (const f of wcagFailures) {
    const ruleId = 'WCAG1411'
    results.push({
      ruleId,
      ruleIndex: 0,
      level: levelFor(f.contrastRatio < 3 ? 'high' : 'medium'),
      message: {
        text: `Increase contrast on "${f.selector}": foreground ${f.foreground} on background ${f.background}, ratio ${f.contrastRatio}:1 (needs ≥ ${f.required}:1)`
      },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: f.url || '' },
          region: {
            snippet: { text: f.selector }
          }
        }
      }],
      properties: {
        severity: f.contrastRatio < 3 ? 'high' : 'medium',
        contrastRatio: f.contrastRatio,
        requiredRatio: f.required,
        foreground: f.foreground,
        background: f.background,
        fontSize: f.fontSize,
        isLarge: f.isLarge
      }
    })
  }

  for (const d of designFailures) {
    const ruleId = ruleIdFor(d)
    results.push({
      ruleId,
      ruleIndex: Object.keys(RULE_DEFS).indexOf(ruleId),
      level: levelFor(d.severity),
      message: {
        text: `${d.description}: ${d.value}, expected ${d.expected}`
      },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: d.url || '' },
          region: {
            snippet: { text: d.selector }
          }
        }
      }],
      properties: {
        severity: d.severity,
        ruleName: d.ruleName,
        value: d.value,
        expected: d.expected
      }
    })
  }

  return results
}

function toSarifLog(auditResult) {
  const wcagFails = (auditResult.wcag && auditResult.wcag.failures) || []
  const designFails = (auditResult.design && auditResult.design.failures) || []

  wcagFails.forEach(f => { f.url = auditResult.url })
  designFails.forEach(f => { f.url = auditResult.url })

  const rules = Object.values(RULE_DEFS)
  const ruleIndices = {}
  rules.forEach((r, i) => { ruleIndices[r.id] = i })

  const results = toSarifResults(wcagFails, designFails)

  return {
    $schema: 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Liveviewer',
            version: pkg.version,
            informationUri: 'https://github.com/jamesonolitoquit/liveviewer',
            rules: rules.map(r => ({
              id: r.id,
              name: r.name,
              shortDescription: { text: r.shortDescription },
              fullDescription: { text: r.fullDescription },
              helpUri: r.helpUri,
              defaultConfiguration: { level: r.defaultLevel },
              properties: r.properties
            }))
          }
        },
        results,
        invocations: [{
          startTime: new Date(auditResult.timestamp).toISOString(),
          endTime: new Date().toISOString(),
          executionSuccessful: true
        }]
      }
    ]
  }
}

module.exports = { toSarifLog, RULE_DEFS }
