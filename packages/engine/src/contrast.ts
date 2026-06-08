function srgbToLinear(channel: number): number {
  if (channel <= 0.03928) return channel / 12.92
  return Math.pow((channel + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ]
  }
  const num = parseInt(h.slice(0, 6), 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

export function parseRgb(str: string): [number, number, number] | null {
  const m = str.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
}

export function blendRgbaOverRgb(rgbaStr: string, bgRgbStr: string): string {
  const m = rgbaStr.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/)
  if (!m) return rgbaStr
  const [r, g, b, a] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), parseFloat(m[4])]
  if (a >= 1) return `rgb(${r},${g},${b})`

  const bgMatch = bgRgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!bgMatch) return `rgb(${r},${g},${b})`
  const [bgR, bgG, bgB] = [parseInt(bgMatch[1]), parseInt(bgMatch[2]), parseInt(bgMatch[3])]

  return `rgb(${Math.round(a * r + (1 - a) * bgR)},${Math.round(a * g + (1 - a) * bgG)},${Math.round(a * b + (1 - a) * bgB)})`
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const [fr, fg, fb] = hexToRgb(fgHex)
  const [br, bg, bb] = hexToRgb(bgHex)
  const l1 = relativeLuminance(fr / 255, fg / 255, fb / 255)
  const l2 = relativeLuminance(br / 255, bg / 255, bb / 255)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function scoreLabel(ratio: number): string {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA Large'
  return 'Fail'
}
