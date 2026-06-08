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

  const totalChecks = elements.length
  const failCount = failures.length
  const passCount = totalChecks - failCount

  return {
    failures,
    totalChecks,
    passCount,
    failCount,
    score: totalChecks > 0
      ? Math.round((totalChecks - failCount) / totalChecks * 1000) / 10
      : 100
  }
}
