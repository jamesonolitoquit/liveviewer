import { describe, test, expect } from 'vitest'
import { hexToRgb, rgbToHex, parseRgb, blendRgbaOverRgb, contrastRatio, scoreLabel } from './contrast.js'

describe('hexToRgb', () => {
  test('converts 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual([255, 0, 0])
    expect(hexToRgb('#00ff00')).toEqual([0, 255, 0])
    expect(hexToRgb('#0000ff')).toEqual([0, 0, 255])
  })

  test('converts 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual([255, 0, 0])
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0])
    expect(hexToRgb('#00f')).toEqual([0, 0, 255])
  })

  test('strips leading hash', () => {
    expect(hexToRgb('ffffff')).toEqual([255, 255, 255])
  })
})

describe('rgbToHex', () => {
  test('converts RGB to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
  })
})

describe('parseRgb', () => {
  test('parses rgb() strings', () => {
    expect(parseRgb('rgb(255, 0, 0)')).toEqual([255, 0, 0])
    expect(parseRgb('rgb(0, 255, 0)')).toEqual([0, 255, 0])
  })

  test('parses rgba() strings', () => {
    expect(parseRgb('rgba(255, 0, 0, 0.5)')).toEqual([255, 0, 0])
  })

  test('returns null for invalid', () => {
    expect(parseRgb('invalid')).toBeNull()
  })
})

describe('blendRgbaOverRgb', () => {
  test('returns opaque color when alpha >= 1', () => {
    expect(blendRgbaOverRgb('rgba(255, 0, 0, 1)', 'rgb(0, 0, 0)')).toBe('rgb(255,0,0)')
  })

  test('blends transparent over white', () => {
    const result = blendRgbaOverRgb('rgba(0, 0, 0, 0.5)', 'rgb(255, 255, 255)')
    expect(result).toBe('rgb(128,128,128)')
  })
})

describe('contrastRatio', () => {
  test('black on white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  test('white on white is 1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 0)
  })

  test('red on white', () => {
    const ratio = contrastRatio('#ff0000', '#ffffff')
    expect(ratio).toBeGreaterThan(3)
    expect(ratio).toBeLessThan(5)
  })
})

describe('scoreLabel', () => {
  test('AAA for >= 7', () => expect(scoreLabel(7)).toBe('AAA'))
  test('AA for >= 4.5', () => expect(scoreLabel(4.5)).toBe('AA'))
  test('AA Large for >= 3', () => expect(scoreLabel(3)).toBe('AA Large'))
  test('Fail for < 3', () => expect(scoreLabel(2.9)).toBe('Fail'))
})
