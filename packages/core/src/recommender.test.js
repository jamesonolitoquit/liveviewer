import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const { recommend } = require('./recommender.js')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-rec-'))

function write(name, data) {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, JSON.stringify(data))
  return p
}

describe('recommend', () => {
  it('returns error when no wcag data', () => {
    const p = write('no-wcag.json', { url: 'https://example.com' })
    const result = recommend(p, null)
    expect(result.error).toContain('No WCAG data')
  })

  it('generates recommendations sorted by severity', () => {
    const auditPath = write('audit1.json', {
      url: 'https://example.com', timestamp: 0,
      wcag: {
        totalElements: 2,
        failures: [
          { selector: 'h1', text: 'A', foreground: '#ffffff', background: '#000000', contrastRatio: 2.1, required: 4.5, fontSize: 24, isLarge: true },
          { selector: 'p', text: 'B', foreground: '#cccccc', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 2,
        score: 0
      }
    })

    const result = recommend(auditPath, null)
    expect(result.recommendations).toHaveLength(2)
    expect(result.recommendations[0].severity).toBe('high')
    expect(result.recommendations[0].selector).toBe('h1')
    expect(result.recommendations[1].severity).toBe('medium')
    expect(result.recommendations[1].selector).toBe('p')
  })

  it('identifies token issues from extract data', () => {
    const auditPath = write('audit2.json', {
      url: 'https://example.com', timestamp: 0,
      wcag: {
        totalElements: 1,
        failures: [
          { selector: 'p', text: 'Body', foreground: '#999999', background: '#ffffff', contrastRatio: 3.5, required: 4.5, fontSize: 16, isLarge: false }
        ],
        passCount: 0,
        failCount: 1,
        score: 0
      }
    })
    const extractPath = write('extract2.json', {
      styles: {
        colors: {
          'rgb(153, 153, 153)': { count: 15, selectors: ['.d', '.e', '.f'] }
        }
      }
    })

    const result = recommend(auditPath, extractPath)
    expect(result.recommendations).toBeDefined()
    const token = result.recommendations.find(r => r.type === 'token')
    expect(token).toBeDefined()
    expect(token.totalUsage).toBe(15)
  })
})
