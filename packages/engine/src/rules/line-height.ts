import type { ElementDatum } from '../dom-analyzer'
import type { DesignFailure } from './font-size.js'

const BODY_TAGS = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'figcaption', 'label', 'span', 'a', 'button', 'div'])

export function checkLineHeight(elements: ElementDatum[]): DesignFailure[] {
  const failures: DesignFailure[] = []

  for (const el of elements) {
    if (!BODY_TAGS.has(el.tagName)) continue
    if (el.lineHeight === 0) continue
    const ratio = el.lineHeight / el.fontSize
    if (ratio < 1.4 || ratio > 1.6) {
      failures.push({
        ruleId: 'line-height-readable',
        ruleName: 'Line height between 1.4 and 1.6',
        category: 'typography',
        selector: el.selector,
        description: `"${el.text.slice(0, 40)}" has line-height ${ratio.toFixed(2)} (${el.lineHeight}px at ${el.fontSize}px font)`,
        severity: ratio < 1.2 || ratio > 2 ? 'high' : 'medium',
        value: ratio.toFixed(2),
        expected: '1.4–1.6'
      })
    }
  }

  return failures
}
