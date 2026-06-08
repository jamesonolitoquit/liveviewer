import { describe, it, expect } from 'vitest'

function normalizeColor(str) {
  if (!str) return null
  str = str.trim().toLowerCase()
  const hex6 = str.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/)
  if (hex6) return '#' + hex6[1]
  const rgb = str.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('')
  const rgba = str.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/)
  if (rgba) return '#' + [rgba[1], rgba[2], rgba[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('')
  return null
}

function checkBrandViolations(data, brandConfig) {
  const violations = { colors: [], fonts: [] }
  if (!data.styles) return violations

  const brandHexes = new Set(
    Object.values(brandConfig.colors || {}).map(c => normalizeColor(c)).filter(Boolean)
  )

  if (data.styles.colors) {
    for (const [raw, info] of Object.entries(data.styles.colors)) {
      const hex = normalizeColor(raw)
      if (hex && !brandHexes.has(hex)) {
        violations.colors.push({
          value: raw,
          normalized: hex,
          count: info.count,
          selectors: (info.selectors || []).slice(0, 5),
          recommendation: `Replace ${raw} with an approved brand color`
        })
      }
    }
  }

  if (data.styles.fontFamilies && brandConfig.fonts && brandConfig.fonts.families) {
    const allowed = brandConfig.fonts.families.map(f => f.toLowerCase())
    for (const [family, info] of Object.entries(data.styles.fontFamilies)) {
      const lower = family.toLowerCase()
      const ok = allowed.some(a => lower.includes(a))
      if (!ok) {
        violations.fonts.push({
          value: family,
          count: info.count,
          selectors: (info.selectors || []).slice(0, 5),
          recommendation: `Replace "${family}" with an approved font`
        })
      }
    }
  }

  return violations
}

describe('normalizeColor', () => {
  it('normalizes 6-digit hex with hash', () => {
    expect(normalizeColor('#ff0000')).toBe('#ff0000')
  })

  it('normalizes 6-digit hex without hash', () => {
    expect(normalizeColor('ff0000')).toBe('#ff0000')
  })

  it('strips alpha channel from hex', () => {
    expect(normalizeColor('#ff000080')).toBe('#ff0000')
  })

  it('normalizes rgb()', () => {
    expect(normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000')
  })

  it('normalizes rgba()', () => {
    expect(normalizeColor('rgba(0, 128, 255, 0.5)')).toBe('#0080ff')
  })

  it('handles case insensitivity', () => {
    expect(normalizeColor('#FF00FF')).toBe('#ff00ff')
  })

  it('returns null for invalid input', () => {
    expect(normalizeColor('')).toBe(null)
    expect(normalizeColor('transparent')).toBe(null)
    expect(normalizeColor(null)).toBe(null)
  })
})

describe('checkBrandViolations', () => {
  const brandConfig = {
    colors: { primary: '#ff0000', secondary: '#00ff00' },
    fonts: { families: ['Inter', 'Roboto'] }
  }

  it('returns empty violations when no data', () => {
    const result = checkBrandViolations({}, brandConfig)
    expect(result).toEqual({ colors: [], fonts: [] })
  })

  it('flags colors not in brand palette', () => {
    const data = {
      styles: {
        colors: {
          'rgb(0, 0, 255)': { count: 5, selectors: ['.blue'] },
          'rgb(255, 0, 0)': { count: 3, selectors: ['.red'] }
        }
      }
    }
    const result = checkBrandViolations(data, brandConfig)
    expect(result.colors).toHaveLength(1)
    expect(result.colors[0].normalized).toBe('#0000ff')
    expect(result.colors[0].count).toBe(5)
  })

  it('flags fonts not in brand list', () => {
    const data = {
      styles: {
        fontFamilies: {
          'Comic Sans': { count: 2, selectors: ['.bad'] },
          'Inter': { count: 10, selectors: ['.good'] }
        }
      }
    }
    const result = checkBrandViolations(data, brandConfig)
    expect(result.fonts).toHaveLength(1)
    expect(result.fonts[0].value).toBe('Comic Sans')
  })

  it('does not flag brand colors', () => {
    const data = {
      styles: {
        colors: {
          'rgb(255, 0, 0)': { count: 5, selectors: ['.brand'] }
        }
      }
    }
    const result = checkBrandViolations(data, brandConfig)
    expect(result.colors).toHaveLength(0)
  })
})
