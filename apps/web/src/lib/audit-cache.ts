interface CacheEntry {
  data: unknown
  expiry: number
}

const MAX_ENTRIES = 50
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000

const store = new Map<string, CacheEntry>()

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return
  const overflow = store.size - MAX_ENTRIES
  const keys = store.keys()
  for (let i = 0; i < overflow; i++) {
    const k = keys.next().value
    if (k === undefined) break
    store.delete(k)
  }
}

function viewportKey(vp: { width: number; height: number }): string {
  return `${vp.width}x${vp.height}`
}

export function cacheKey(url: string, viewports?: { width: number; height: number }[]): string {
  if (!viewports || viewports.length === 0) return url
  return url + '|' + viewports.map(viewportKey).sort().join(',')
}

export function getCachedAudit(url: string, viewports?: { width: number; height: number }[]): unknown | null {
  const key = cacheKey(url, viewports)
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    store.delete(key)
    return null
  }
  store.delete(key)
  store.set(key, entry)
  return entry.data
}

export function setCachedAudit(url: string, data: unknown, ttl = DEFAULT_TTL, viewports?: { width: number; height: number }[]) {
  const key = cacheKey(url, viewports)
  if (store.has(key)) {
    store.delete(key)
  }
  store.set(key, { data, expiry: Date.now() + ttl })
  evictIfNeeded()
}

export function clearAuditCache() {
  store.clear()
}

export function getCacheStats() {
  return {
    size: store.size,
    max: MAX_ENTRIES
  }
}
