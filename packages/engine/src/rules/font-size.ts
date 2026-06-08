import type { ElementDatum } from '../dom-analyzer'

export interface DesignFailure {
  ruleId: string
  ruleName: string
  category: 'typography' | 'spacing' | 'interactivity' | 'media' | 'brand'
  selector: string
  description: string
  severity: 'high' | 'medium' | 'low'
  value: string
  expected: string
}

const BODY_TAGS = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'figcaption', 'label', 'span', 'a', 'button', 'div'])

export function checkFontSize(elements: ElementDatum[]): DesignFailure[] {
  const failures: DesignFailure[] = []

  for (const el of elements) {
    if (!BODY_TAGS.has(el.tagName)) continue
    if (el.fontSize < 16 && !el.isLarge) {
      failures.push({
        ruleId: 'font-size-legible',
        ruleName: 'Body text minimum 16px',
        category: 'typography',
        selector: el.selector,
        description: `Text "${el.text.slice(0, 40)}" has font-size ${el.fontSize}px; minimum for legible body text is 16px`,
        severity: el.fontSize < 12 ? 'high' : 'medium',
        value: `${el.fontSize}px`,
        expected: '≥ 16px'
      })
    }
  }

  return failures
}
