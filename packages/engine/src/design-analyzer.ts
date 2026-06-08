import type { ElementDatum } from './dom-analyzer'
import type { DesignFailure } from './rules/font-size'
import { checkFontSize } from './rules/font-size'
import { checkLineHeight } from './rules/line-height'

export interface DesignResult {
  failures: DesignFailure[]
  totalChecks: number
  passCount: number
  failCount: number
  score: number
}

export function analyzeDesign(elements: ElementDatum[]): DesignResult {
  const failures: DesignFailure[] = [
    ...checkFontSize(elements),
    ...checkLineHeight(elements)
  ]

  // TODO(v2.4): exclude hidden/skipped elements from count
  const totalChecks = elements.length * 2
  const failCount = failures.length
  const passCount = Math.max(0, totalChecks - failCount)

  return {
    failures,
    totalChecks,
    passCount,
    failCount,
    score: totalChecks > 0
      ? Math.round(Math.max(0, totalChecks - failCount) / totalChecks * 1000) / 10
      : 100
  }
}
