import { NextRequest } from 'next/server'

const RATE_LIMIT_PER_MINUTE = parseInt(process.env.AUDIT_RATE_LIMIT_PER_MINUTE || '10', 10)
const FALLBACK_WINDOW_MS = 60 * 1000
const FALLBACK_MAX_ENTRIES = 10_000

interface RateLimitEntry {
  count: number
  resetAt: number
}

const fallbackStore = new Map<string, RateLimitEntry>()

function evictIfNeeded() {
  if (fallbackStore.size <= FALLBACK_MAX_ENTRIES) return
  const now = Date.now()
  for (const [k, v] of fallbackStore.entries()) {
    if (v.resetAt < now) fallbackStore.delete(k)
  }
  if (fallbackStore.size > FALLBACK_MAX_ENTRIES) {
    const overflow = fallbackStore.size - FALLBACK_MAX_ENTRIES
    const keys = fallbackStore.keys()
    for (let i = 0; i < overflow; i++) {
      const k = keys.next().value
      if (k === undefined) break
      fallbackStore.delete(k)
    }
  }
}

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

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

function fallbackLimit(ip: string, limit: number, windowMs: number) {
  const now = Date.now()
  const entry = fallbackStore.get(ip)
  if (!entry || entry.resetAt < now) {
    fallbackStore.set(ip, { count: 1, resetAt: now + windowMs })
    evictIfNeeded()
    return { success: true, remaining: limit - 1, reset: now + windowMs }
  }
  entry.count += 1
  const remaining = Math.max(0, limit - entry.count)
  return { success: entry.count <= limit, remaining, reset: entry.resetAt }
}

export async function checkRateLimit(
  request: NextRequest,
  identifier?: string
): Promise<{ success: boolean; remaining: number; reset: number; limit: number; fallback: boolean }> {
  const ip = identifier || getClientIp(request)
  const limit = RATE_LIMIT_PER_MINUTE
  const redis = getRedis()

  if (redis) {
    try {
      const { Ratelimit } = require('@upstash/ratelimit')
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, '1 m'),
        analytics: false,
        prefix: 'liveviewer:ratelimit:audit'
      })
      const result = await limiter.limit(ip)
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
        limit,
        fallback: false
      }
    } catch {
      // fall through to in-memory
    }
  }

  const result = fallbackLimit(ip, limit, FALLBACK_WINDOW_MS)
  return { ...result, limit, fallback: true }
}

export function getRateLimitConfig() {
  return {
    perMinute: RATE_LIMIT_PER_MINUTE
  }
}
