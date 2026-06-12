export const PILLARS = [
  { key: 'wcag', label: 'WCAG', ideal: 100, idealLabel: '100%', description: 'WCAG contrast and ARIA compliance' },
  { key: 'design', label: 'Design', ideal: 100, idealLabel: '100%', description: 'Typography, heading hierarchy, horizontal scroll' },
  { key: 'seo', label: 'SEO', ideal: 100, idealLabel: '100%', description: 'Meta tags, canonical, JSON-LD, Open Graph, Twitter Cards' },
  { key: 'security', label: 'Security', ideal: 100, idealLabel: '100%', description: 'HTTP security headers (HSTS, CSP, etc.)' },
  { key: 'legal', label: 'Legal', ideal: 100, idealLabel: '100%', description: 'Cookie consent, privacy policy, imprint, terms of service' },
  { key: 'performance', label: 'Performance', ideal: 90, idealLabel: '\u226590 (Grade A)', description: 'Lighthouse score \u2014 depends on network, device, and page complexity. Scores can vary; aim for \u226590 for excellent performance.' },
] as const

export type PillarKey = (typeof PILLARS)[number]['key']
