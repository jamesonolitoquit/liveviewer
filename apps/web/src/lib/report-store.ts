const REPORT_TTL_SECONDS = 7 * 24 * 3600
const MAX_ENTRIES = 100

const fallbackStore = new Map<string, string>()

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const { Redis } = require('@upstash/redis')
    return new Redis({ url, token })
  } catch {
    return null
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export async function saveReport(data: unknown): Promise<string> {
  const id = generateId()
  const key = `report:${id}`
  const raw = JSON.stringify(data)

  const redis = getRedis()
  if (redis) {
    await redis.setex(key, REPORT_TTL_SECONDS, raw)
  } else {
    if (fallbackStore.size >= MAX_ENTRIES) {
      const firstKey = fallbackStore.keys().next().value
      if (firstKey !== undefined) fallbackStore.delete(firstKey)
    }
    fallbackStore.set(key, raw)
  }

  return id
}

export async function getReport(id: string): Promise<unknown | null> {
  const key = `report:${id}`

  const redis = getRedis()
  if (redis) {
    const raw = await redis.get(key)
    if (typeof raw !== 'string') return null
    try { return JSON.parse(raw) } catch { return null }
  }

  const raw = fallbackStore.get(key)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
