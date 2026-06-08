import { describe, test, expect, vi } from 'vitest'
import { getCachedAudit, setCachedAudit, clearAuditCache } from './audit-cache'

describe('audit-cache', () => {
  test('returns null for uncached URL', () => {
    expect(getCachedAudit('https://example.com')).toBeNull()
  })

  test('returns cached data for a previously set URL', () => {
    const data = { score: 85 }
    setCachedAudit('https://example.com', data)
    expect(getCachedAudit('https://example.com')).toEqual(data)
  })

  test('returns null after expiry', () => {
    vi.useFakeTimers()
    setCachedAudit('https://example.com', { score: 85 }, 1000)

    vi.advanceTimersByTime(999)
    expect(getCachedAudit('https://example.com')).not.toBeNull()

    vi.advanceTimersByTime(2)
    expect(getCachedAudit('https://example.com')).toBeNull()

    vi.useRealTimers()
  })

  test('different URLs have separate cache entries', () => {
    clearAuditCache()
    setCachedAudit('https://a.com', { score: 90 })
    setCachedAudit('https://b.com', { score: 80 })

    expect(getCachedAudit('https://a.com')).toEqual({ score: 90 })
    expect(getCachedAudit('https://b.com')).toEqual({ score: 80 })
  })

  test('clearAuditCache removes all entries', () => {
    setCachedAudit('https://example.com', { score: 85 })
    clearAuditCache()
    expect(getCachedAudit('https://example.com')).toBeNull()
  })

  test('set then get with same key returns data', () => {
    const data = { score: 85 }
    setCachedAudit('https://example.com/page/', data)
    expect(getCachedAudit('https://example.com/page/')).toEqual(data)
  })
})
