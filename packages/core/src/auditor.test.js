import { describe, it, expect } from 'vitest'

// Helper functions extracted from auditor.js (CJS)
function rgbToHex(rgb) {
  const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return rgb
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3])
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function blendRgbaOverRgb(rgbaStr, bgRgbStr) {
  const m = rgbaStr.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/)
  if (!m) return rgbaStr
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3])
  const a = parseFloat(m[4])
  if (a >= 1) return `rgb(${r},${g},${b})`

  let bgR, bgG, bgB
  const bgMatch = bgRgbStr.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (bgMatch) {
    bgR = parseInt(bgMatch[1]); bgG = parseInt(bgMatch[2]); bgB = parseInt(bgMatch[3])
  } else if (bgRgbStr.startsWith('#')) {
    const hex = bgRgbStr.slice(1).replace(/^#/, '')
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const val = parseInt(hex, 16)
      bgR = (val >> 16) & 255
      bgG = (val >> 8) & 255
      bgB = val & 255
    } else {
      return `rgb(${r},${g},${b})`
    }
  } else {
    return `rgb(${r},${g},${b})`
  }

  return `rgb(${Math.round(a * r + (1 - a) * bgR)},${Math.round(a * g + (1 - a) * bgG)},${Math.round(a * b + (1 - a) * bgB)})`
}

describe('rgbToHex', () => {
  it('converts rgb to hex', () => {
    expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000')
  })

  it('converts rgba to hex (ignores alpha)', () => {
    expect(rgbToHex('rgba(0, 128, 255, 0.5)')).toBe('#0080ff')
  })

  it('converts rgb with varying whitespace', () => {
    expect(rgbToHex('rgb(10, 20, 30)')).toBe('#0a141e')
  })

  it('returns input unchanged if no match', () => {
    expect(rgbToHex('#ff0000')).toBe('#ff0000')
    expect(rgbToHex('transparent')).toBe('transparent')
  })
})

describe('blendRgbaOverRgb', () => {
  it('returns rgb when alpha >= 1', () => {
    expect(blendRgbaOverRgb('rgba(255, 0, 0, 1)', 'rgb(0, 0, 0)')).toBe('rgb(255,0,0)')
  })

  it('blends transparent foreground over white background', () => {
    const result = blendRgbaOverRgb('rgba(0, 0, 0, 0.5)', 'rgb(255, 255, 255)')
    expect(result).toBe('rgb(128,128,128)')
  })

  it('blends red over blue', () => {
    const result = blendRgbaOverRgb('rgba(255, 0, 0, 0.5)', 'rgb(0, 0, 255)')
    expect(result).toBe('rgb(128,0,128)')
  })

  it('blends over hex background', () => {
    const result = blendRgbaOverRgb('rgba(0, 0, 0, 0.25)', '#ffffff')
    expect(result).toBe('rgb(191,191,191)')
  })

  it('returns input if rgba pattern does not match', () => {
    expect(blendRgbaOverRgb('rgb(255,0,0)', 'rgb(0,0,0)')).toBe('rgb(255,0,0)')
  })

  it('returns unblended rgb if background format is unknown', () => {
    expect(blendRgbaOverRgb('rgba(255, 0, 0, 0.5)', 'unknown')).toBe('rgb(255,0,0)')
  })
})
