interface HistoryEntry {
  url: string
  timestamp: number
  score: number
  passCount: number
  failCount: number
  totalElements: number
}

interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: { totalElements: number; failures: any[]; passCount: number; failCount: number; score: number } | null
}

const RETENTION_DAYS = parseInt(process.env.NEXT_PUBLIC_HISTORY_RETENTION_DAYS || '30', 10)
const FALLBACK_STORE: Map<string, HistoryEntry[]> = new Map()

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const { Redis } = require('@upstash/redis')
  return new Redis({ url, token })
}

function getStorageKey(url: string): string {
  try {
    const u = new URL(url)
    return `audit:${u.hostname}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return `audit:${url}`
  }
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return u.origin + u.pathname.replace(/\/$/, '')
  } catch {
    return raw
  }
}

export async function saveAudit(data: AuditData): Promise<void> {
  if (!data.wcag) return

  const entry: HistoryEntry = {
    url: normalizeUrl(data.url),
    timestamp: data.timestamp,
    score: data.wcag.score,
    passCount: data.wcag.passCount,
    failCount: data.wcag.failCount,
    totalElements: data.wcag.totalElements
  }

  const key = getStorageKey(data.url)
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

  const redis = getRedis()
  if (redis) {
    const [existingRaw] = await redis.multi()
      .zrangebyscore(key, cutoff, '+inf', { withScores: true })
      .exec()

    if (existingRaw?.[0]) {
      const existing: HistoryEntry[] = existingRaw[0]
      existing.push(entry)

      await redis.multi()
        .del(key)
        .zadd(key, ...existing.map((e: HistoryEntry) => ({ score: e.timestamp, member: JSON.stringify(e) })))
        .expire(key, RETENTION_DAYS * 86400)
        .exec()
    } else {
      await redis.zadd(key, { score: entry.timestamp, member: JSON.stringify(entry) })
      await redis.expire(key, RETENTION_DAYS * 86400)
    }
  } else {
    const existing = FALLBACK_STORE.get(key) || []
    existing.push(entry)
    const filtered = existing.filter(e => e.timestamp > cutoff)
    FALLBACK_STORE.set(key, filtered)
  }
}

export async function getHistory(url: string, limit = 30): Promise<HistoryEntry[]> {
  const key = getStorageKey(url)
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

  const redis = getRedis()
  if (redis) {
    const result = await redis.zrangebyscore(key, cutoff, '+inf', { withScores: true })
    if (!result?.[0]) return []

    const entries: HistoryEntry[] = result[0]
      .map((e: string) => {
        try { return JSON.parse(e) as HistoryEntry } catch { return null }
      })
      .filter(Boolean)
      .sort((a: HistoryEntry, b: HistoryEntry) => a.timestamp - b.timestamp)
      .slice(-limit)

    return entries as HistoryEntry[]
  }

  const entries = (FALLBACK_STORE.get(key) || [])
    .filter(e => e.timestamp > cutoff)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)

  return entries
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
