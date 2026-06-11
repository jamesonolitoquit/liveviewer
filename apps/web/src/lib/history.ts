interface PillarScores {
  wcag?: number
  design?: number
  seo?: number
  security?: number
  legal?: number
  performance?: number
}

interface HistoryEntry {
  url: string
  timestamp: number
  score: number
  passCount: number
  failCount: number
  totalElements: number
  pillars: PillarScores
}

interface AuditData {
  url: string
  timestamp: number
  viewport: { width: number; height: number }
  wcag: { totalElements: number; failures: any[]; passCount: number; failCount: number; score: number } | null
  design?: { failures: any[]; totalChecks: number; passCount: number; failCount: number; score: number } | null
  seo?: { failures: any[]; totalChecks: number; passCount: number; failCount: number; score: number } | null
  security?: { failures: any[]; totalChecks: number; passCount: number; failCount: number; score: number } | null
  legal?: { failures: any[]; totalChecks: number; passCount: number; failCount: number; score: number } | null
  performance?: { error: string | null; score: number | null } | null
}

const RETENTION_DAYS = parseInt(process.env.NEXT_PUBLIC_HISTORY_RETENTION_DAYS || '30', 10)
const FALLBACK_STORE: Map<string, HistoryEntry[]> = new Map()
const LS_KEY = 'liveviewer_history'
const MAX_LS_ENTRIES = 50

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

function readLocalStorage(): Record<string, HistoryEntry[]> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeLocalStorage(data: Record<string, HistoryEntry[]>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded or unavailable
  }
}

function saveToLocalStorage(entry: HistoryEntry) {
  const key = getStorageKey(entry.url)
  const all = readLocalStorage()
  const existing = all[key] || []
  existing.push(entry)
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  all[key] = existing
    .filter(e => e.timestamp > cutoff)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_LS_ENTRIES)
  writeLocalStorage(all)
}

export function getLocalHistory(url: string, limit = 30): HistoryEntry[] {
  const key = getStorageKey(url)
  const all = readLocalStorage()
  const entries = all[key] || []
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  return entries
    .filter(e => e.timestamp > cutoff)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)
}

export async function saveAudit(data: AuditData): Promise<void> {
  if (!data.wcag) return

  const pillars: PillarScores = {}
  if (data.wcag) pillars.wcag = data.wcag.score
  if (data.design) pillars.design = data.design.score
  if (data.seo) pillars.seo = data.seo.score
  if (data.security) pillars.security = data.security.score
  if (data.legal) pillars.legal = data.legal.score
  if (data.performance && data.performance.score !== null && data.performance.error === null) {
    pillars.performance = data.performance.score
  }

  const scores = Object.values(pillars).filter((s): s is number => s !== undefined)
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : data.wcag.score

  const totalFail = (data.wcag.failCount || 0) +
    (data.design?.failCount || 0) +
    (data.seo?.failCount || 0) +
    (data.security?.failCount || 0) +
    (data.legal?.failCount || 0) +
    (data.performance?.error ? 1 : 0)

  const entry: HistoryEntry = {
    url: normalizeUrl(data.url),
    timestamp: data.timestamp,
    score: overallScore,
    passCount: data.wcag.passCount,
    failCount: totalFail,
    totalElements: data.wcag.totalElements,
    pillars
  }

  saveToLocalStorage(entry)

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

export function getAllHistory(limit = 10): HistoryEntry[] {
  const all = readLocalStorage()
  const entries: HistoryEntry[] = []
  for (const key in all) {
    for (const entry of all[key]) {
      entries.push(entry)
    }
  }
  return entries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}
