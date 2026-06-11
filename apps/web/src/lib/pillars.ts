export const PILLARS = [
  { key: 'wcag', label: 'WCAG' },
  { key: 'design', label: 'Design' },
  { key: 'seo', label: 'SEO' },
  { key: 'security', label: 'Security' },
  { key: 'legal', label: 'Legal' },
  { key: 'performance', label: 'Performance' },
] as const

export type PillarKey = (typeof PILLARS)[number]['key']
