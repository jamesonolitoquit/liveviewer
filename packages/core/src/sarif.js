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
  },
  'SEO-MISSING-TITLE': {
    id: 'SEO-MISSING-TITLE',
    name: 'missing-title',
    shortDescription: 'Page must have a descriptive title tag',
    fullDescription: 'The <title> tag should be between 10 and 70 characters and accurately describe the page content.',
    helpUri: '',
    defaultLevel: 'error',
    properties: { category: 'seo', tags: ['seo', 'title', 'meta'] }
  },
  'SEO-MISSING-DESC': {
    id: 'SEO-MISSING-DESC',
    name: 'missing-meta-description',
    shortDescription: 'Page must have a meta description',
    fullDescription: 'A meta description of 50\u2013160 characters helps search engines display relevant snippets.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'seo', tags: ['seo', 'meta', 'description'] }
  },
  'SEO-MISSING-CANONICAL': {
    id: 'SEO-MISSING-CANONICAL',
    name: 'missing-canonical',
    shortDescription: 'Page should have a canonical URL',
    fullDescription: 'A canonical URL helps prevent duplicate content issues by specifying the preferred version of a page.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'seo', tags: ['seo', 'canonical', 'url'] }
  },
  'SEO-MISSING-JSONLD': {
    id: 'SEO-MISSING-JSONLD',
    name: 'missing-jsonld',
    shortDescription: 'Page should have JSON-LD structured data',
    fullDescription: 'JSON-LD structured data helps search engines understand page content and enables rich snippets.',
    helpUri: '',
    defaultLevel: 'note',
    properties: { category: 'seo', tags: ['seo', 'structured-data', 'json-ld'] }
  },
  'SEO-MISSING-VIEWPORT': {
    id: 'SEO-MISSING-VIEWPORT',
    name: 'missing-viewport',
    shortDescription: 'Page must have a viewport meta tag',
    fullDescription: 'A viewport meta tag with width=device-width is required for proper mobile rendering.',
    helpUri: '',
    defaultLevel: 'error',
    properties: { category: 'seo', tags: ['seo', 'viewport', 'mobile'] }
  },
  'SEO-ROBOTS-BLOCKED': {
    id: 'SEO-ROBOTS-BLOCKED',
    name: 'robots-blocked',
    shortDescription: 'Robots meta blocks indexing',
    fullDescription: 'The robots meta tag should allow indexing unless the page is intentionally excluded.',
    helpUri: '',
    defaultLevel: 'note',
    properties: { category: 'seo', tags: ['seo', 'robots', 'indexing'] }
  },
  'SEO-MISSING-OG': {
    id: 'SEO-MISSING-OG',
    name: 'missing-open-graph',
    shortDescription: 'Page should have Open Graph tags',
    fullDescription: 'Open Graph tags (og:title, og:description, og:image) control how content appears on social platforms.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'seo', tags: ['seo', 'social', 'open-graph'] }
  },
  'SEO-TWITTER-MISSING': {
    id: 'SEO-TWITTER-MISSING',
    name: 'twitter-card-missing',
    shortDescription: 'Page should have Twitter Card tags',
    fullDescription: 'Twitter Card tags (twitter:card, twitter:title, twitter:description) control how content appears on X/Twitter.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'seo', tags: ['seo', 'social', 'twitter'] }
  },
  'SEC-HTTPS': {
    id: 'SEC-HTTPS',
    name: 'https-enforced',
    shortDescription: 'HTTPS should be enforced',
    fullDescription: 'The page should be served over HTTPS to protect data in transit.',
    helpUri: '',
    defaultLevel: 'error',
    properties: { category: 'security', tags: ['security', 'https', 'tls'] }
  },
  'SEC-HSTS': {
    id: 'SEC-HSTS',
    name: 'hsts',
    shortDescription: 'HTTP Strict-Transport-Security should be set',
    fullDescription: 'HSTS header tells browsers to only connect via HTTPS. Minimum max-age is 31536000 (1 year).',
    helpUri: '',
    defaultLevel: 'error',
    properties: { category: 'security', tags: ['security', 'hsts', 'https'] }
  },
  'SEC-CSP': {
    id: 'SEC-CSP',
    name: 'csp',
    shortDescription: 'Content-Security-Policy should be set',
    fullDescription: 'CSP helps prevent XSS attacks by controlling which resources can be loaded.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'security', tags: ['security', 'csp', 'xss'] }
  },
  'SEC-XFO': {
    id: 'SEC-XFO',
    name: 'x-frame-options',
    shortDescription: 'X-Frame-Options should be DENY or SAMEORIGIN',
    fullDescription: 'Prevents clickjacking by controlling whether the page can be embedded in frames.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'security', tags: ['security', 'clickjacking', 'headers'] }
  },
  'SEC-XCTO': {
    id: 'SEC-XCTO',
    name: 'x-content-type-options',
    shortDescription: 'X-Content-Type-Options should be nosniff',
    fullDescription: 'Prevents MIME type sniffing by instructing the browser to respect Content-Type headers.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'security', tags: ['security', 'mime', 'headers'] }
  },
  'SEC-REFERRER': {
    id: 'SEC-REFERRER',
    name: 'referrer-policy',
    shortDescription: 'Referrer-Policy should be set',
    fullDescription: 'Controls how much referrer information is sent with requests. Recommended: strict-origin-when-cross-origin.',
    helpUri: '',
    defaultLevel: 'note',
    properties: { category: 'security', tags: ['security', 'privacy', 'referrer'] }
  },
  'SEC-PERMISSIONS': {
    id: 'SEC-PERMISSIONS',
    name: 'permissions-policy',
    shortDescription: 'Permissions-Policy should be set',
    fullDescription: 'Controls which browser features (geolocation, microphone, etc.) the page is allowed to use.',
    helpUri: '',
    defaultLevel: 'note',
    properties: { category: 'security', tags: ['security', 'privacy', 'permissions'] }
  },
  'SEC-MIXED': {
    id: 'SEC-MIXED',
    name: 'mixed-content',
    shortDescription: 'No mixed content on HTTPS pages',
    fullDescription: 'HTTPS pages should not load HTTP resources, as this compromises security.',
    helpUri: '',
    defaultLevel: 'error',
    properties: { category: 'security', tags: ['security', 'mixed-content', 'https'] }
  },
  'SEC-COOKIES': {
    id: 'SEC-COOKIES',
    name: 'secure-cookies',
    shortDescription: 'Cookies should have Secure and HttpOnly flags',
    fullDescription: 'The Secure flag ensures cookies are only sent over HTTPS. HttpOnly prevents client-side script access.',
    helpUri: '',
    defaultLevel: 'error',
    properties: { category: 'security', tags: ['security', 'cookies', 'flags'] }
  },
  'PERF-LCP': {
    id: 'PERF-LCP',
    name: 'largest-contentful-paint',
    shortDescription: 'Largest Contentful Paint',
    fullDescription: 'LCP measures loading performance. Target: <2.5s.',
    helpUri: 'https://web.dev/lcp/',
    defaultLevel: 'note',
    properties: { category: 'performance', tags: ['performance', 'lcp', 'loading'] }
  },
  'PERF-CLS': {
    id: 'PERF-CLS',
    name: 'cumulative-layout-shift',
    shortDescription: 'Cumulative Layout Shift',
    fullDescription: 'CLS measures visual stability. Target: <0.1.',
    helpUri: 'https://web.dev/cls/',
    defaultLevel: 'note',
    properties: { category: 'performance', tags: ['performance', 'cls', 'stability'] }
  },
  'PERF-TBT': {
    id: 'PERF-TBT',
    name: 'total-blocking-time',
    shortDescription: 'Total Blocking Time',
    fullDescription: 'TBT measures interactivity readiness. Target: <200ms.',
    helpUri: 'https://web.dev/tbt/',
    defaultLevel: 'note',
    properties: { category: 'performance', tags: ['performance', 'tbt', 'interactivity'] }
  },
  'PERF-FCP': {
    id: 'PERF-FCP',
    name: 'first-contentful-paint',
    shortDescription: 'First Contentful Paint',
    fullDescription: 'FCP measures perceived load speed. Target: <1.8s.',
    helpUri: 'https://web.dev/fcp/',
    defaultLevel: 'note',
    properties: { category: 'performance', tags: ['performance', 'fcp', 'loading'] }
  },
  'PERF-SI': {
    id: 'PERF-SI',
    name: 'speed-index',
    shortDescription: 'Speed Index',
    fullDescription: 'Speed Index measures visual completeness during load. Target: <3.4s.',
    helpUri: 'https://web.dev/speed-index/',
    defaultLevel: 'note',
    properties: { category: 'performance', tags: ['performance', 'speed-index', 'loading'] }
  },
  'LEGAL-COOKIE': {
    id: 'LEGAL-COOKIE',
    name: 'cookie-consent',
    shortDescription: 'Cookie consent banner should be present',
    fullDescription: 'Websites targeting EU users should provide a cookie consent mechanism (banner, notice, or preference center).',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'legal', tags: ['legal', 'privacy', 'cookies', 'gdpr'] }
  },
  'LEGAL-PRIVACY': {
    id: 'LEGAL-PRIVACY',
    name: 'privacy-policy',
    shortDescription: 'Privacy policy link should be present',
    fullDescription: 'Websites should include a link to their privacy policy, typically in the footer or navigation.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'legal', tags: ['legal', 'privacy', 'policy'] }
  },
  'LEGAL-IMPRINT': {
    id: 'LEGAL-IMPRINT',
    name: 'imprint',
    shortDescription: 'Imprint / Impressum link should be present',
    fullDescription: 'German and many European websites require an imprint (Impressum) with legal contact information.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'legal', tags: ['legal', 'imprint', 'impressum'] }
  },
  'LEGAL-TOS': {
    id: 'LEGAL-TOS',
    name: 'terms-of-service',
    shortDescription: 'Terms of service link should be present',
    fullDescription: 'Websites should provide a link to their terms of service or terms and conditions.',
    helpUri: '',
    defaultLevel: 'warning',
    properties: { category: 'legal', tags: ['legal', 'terms', 'tos'] }
  },
  'LEGAL-DATA': {
    id: 'LEGAL-DATA',
    name: 'data-collection-notice',
    shortDescription: 'Data collection notice should be present',
    fullDescription: 'Websites should inform users about data collection practices, including what data is collected and how it is used.',
    helpUri: '',
    defaultLevel: 'note',
    properties: { category: 'legal', tags: ['legal', 'privacy', 'data-collection'] }
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
  if (failure.ruleId === 'cookie-consent') return 'LEGAL-COOKIE'
  if (failure.ruleId === 'privacy-policy') return 'LEGAL-PRIVACY'
  if (failure.ruleId === 'imprint') return 'LEGAL-IMPRINT'
  if (failure.ruleId === 'terms-of-service') return 'LEGAL-TOS'
  if (failure.ruleId === 'data-collection-notice') return 'LEGAL-DATA'
  if (failure.ruleId === 'missing-title') return 'SEO-MISSING-TITLE'
  if (failure.ruleId === 'missing-meta-description') return 'SEO-MISSING-DESC'
  if (failure.ruleId === 'missing-canonical') return 'SEO-MISSING-CANONICAL'
  if (failure.ruleId === 'missing-jsonld') return 'SEO-MISSING-JSONLD'
  if (failure.ruleId === 'missing-viewport') return 'SEO-MISSING-VIEWPORT'
  if (failure.ruleId === 'robots-blocked') return 'SEO-ROBOTS-BLOCKED'
  if (failure.ruleId === 'missing-open-graph') return 'SEO-MISSING-OG'
  if (failure.ruleId === 'twitter-card-missing') return 'SEO-TWITTER-MISSING'
  if (failure.ruleId === 'https-enforced') return 'SEC-HTTPS'
  if (failure.ruleId === 'hsts') return 'SEC-HSTS'
  if (failure.ruleId === 'csp') return 'SEC-CSP'
  if (failure.ruleId === 'x-frame-options') return 'SEC-XFO'
  if (failure.ruleId === 'x-content-type-options') return 'SEC-XCTO'
  if (failure.ruleId === 'referrer-policy') return 'SEC-REFERRER'
  if (failure.ruleId === 'permissions-policy') return 'SEC-PERMISSIONS'
  if (failure.ruleId === 'mixed-content') return 'SEC-MIXED'
  if (failure.ruleId === 'secure-cookies') return 'SEC-COOKIES'
  if (failure.ruleId === 'largest-contentful-paint') return 'PERF-LCP'
  if (failure.ruleId === 'cumulative-layout-shift') return 'PERF-CLS'
  if (failure.ruleId === 'total-blocking-time') return 'PERF-TBT'
  if (failure.ruleId === 'first-contentful-paint') return 'PERF-FCP'
  if (failure.ruleId === 'speed-index') return 'PERF-SI'
  return 'CUSTOM'
}

function levelFor(severity) {
  if (severity === 'high') return 'error'
  if (severity === 'medium') return 'warning'
  return 'note'
}

function toSarifResults(wcagFailures, designFailures, seoFailures, securityFailures, legalFailures, performanceResult) {
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

  for (const d of seoFailures) {
    const ruleId = ruleIdFor(d)
    results.push({
      ruleId,
      ruleIndex: Object.keys(RULE_DEFS).indexOf(ruleId),
      level: levelFor(d.severity),
      message: {
        text: d.description
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

  for (const d of securityFailures) {
    const ruleId = ruleIdFor(d)
    results.push({
      ruleId,
      ruleIndex: Object.keys(RULE_DEFS).indexOf(ruleId),
      level: levelFor(d.severity),
      message: {
        text: d.description
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

  for (const d of legalFailures) {
    const ruleId = ruleIdFor(d)
    results.push({
      ruleId,
      ruleIndex: Object.keys(RULE_DEFS).indexOf(ruleId),
      level: levelFor(d.severity),
      message: {
        text: d.description
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

  // Performance metrics as informational SARIF results
  if (performanceResult && performanceResult.score !== null) {
    var perfMetrics = [
      { ruleId: 'largest-contentful-paint', ruleSuffix: 'LCP', value: performanceResult.lcp, unit: 's' },
      { ruleId: 'cumulative-layout-shift', ruleSuffix: 'CLS', value: performanceResult.cls, unit: '' },
      { ruleId: 'total-blocking-time', ruleSuffix: 'TBT', value: performanceResult.tbt, unit: 'ms' },
      { ruleId: 'first-contentful-paint', ruleSuffix: 'FCP', value: performanceResult.fcp, unit: 's' },
      { ruleId: 'speed-index', ruleSuffix: 'SI', value: performanceResult.speedIndex, unit: 's' }
    ];
    for (var pi = 0; pi < perfMetrics.length; pi++) {
      var pm = perfMetrics[pi];
      if (pm.value === null) continue;
      var ruleId = ruleIdFor(pm);
      results.push({
        ruleId: ruleId,
        ruleIndex: Object.keys(RULE_DEFS).indexOf(ruleId),
        level: 'note',
        message: {
          text: pm.ruleSuffix + ': ' + pm.value + pm.unit + ' (Page: ' + (performanceResult.grade || 'N/A') + ', Score: ' + performanceResult.score + ')'
        },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: performanceResult.url || '' },
            region: { snippet: { text: 'page' } }
          }
        }],
        properties: {
          severity: 'info',
          value: pm.value,
          unit: pm.unit,
          performanceScore: performanceResult.score,
          grade: performanceResult.grade
        }
      });
    }
  }

  return results
}

function toSarifLog(auditResult) {
  const wcagFails = (auditResult.wcag && auditResult.wcag.failures) || []
  const designFails = (auditResult.design && auditResult.design.failures) || []
  const seoFails = (auditResult.seo && auditResult.seo.failures) || []
  const securityFails = (auditResult.security && auditResult.security.failures) || []
  const legalFails = (auditResult.legal && auditResult.legal.failures) || []
  const performanceResult = (auditResult.performance && !auditResult.performance.error) ? { ...auditResult.performance, url: auditResult.url } : null

  wcagFails.forEach(f => { f.url = auditResult.url })
  designFails.forEach(f => { f.url = auditResult.url })
  seoFails.forEach(f => { f.url = auditResult.url })
  securityFails.forEach(f => { f.url = auditResult.url })
  legalFails.forEach(f => { f.url = auditResult.url })

  const rules = Object.values(RULE_DEFS)
  const ruleIndices = {}
  rules.forEach((r, i) => { ruleIndices[r.id] = i })

  const results = toSarifResults(wcagFails, designFails, seoFails, securityFails, legalFails, performanceResult)

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
