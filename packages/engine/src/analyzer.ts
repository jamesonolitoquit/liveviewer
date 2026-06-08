import { parseRgb, blendRgbaOverRgb, rgbToHex, contrastRatio } from './contrast.js'
import type { ElementDatum, Failure, WcagResult } from './dom-analyzer.js'

export function analyzeElements(elements: ElementDatum[]): WcagResult {
  const failures: Failure[] = []

  for (const el of elements) {
    try {
      let fgColor = el.foreground
      const bgColor = el.background
      if (fgColor.includes('rgba')) {
        fgColor = blendRgbaOverRgb(fgColor, bgColor)
      }
      const fgParsed = parseRgb(fgColor)
      const bgParsed = parseRgb(bgColor)
      if (!fgParsed || !bgParsed) continue
      const fg = rgbToHex(...fgParsed)
      const bg = rgbToHex(...bgParsed)
      const ratio = contrastRatio(fg, bg)
      const required = el.isLarge ? 3.0 : 4.5
      if (ratio < required) {
        failures.push({
          selector: el.selector,
          text: el.text,
          foreground: fg,
          background: bg,
          contrastRatio: Math.round(ratio * 100) / 100,
          required,
          fontSize: el.fontSize,
          isLarge: el.isLarge
        })
      }
    } catch {
      // skip malformed colors
    }
  }

  return {
    totalElements: elements.length,
    failures,
    passCount: elements.length - failures.length,
    failCount: failures.length,
    score: elements.length > 0
      ? Math.round((elements.length - failures.length) / elements.length * 1000) / 10
      : 100
  }
}
