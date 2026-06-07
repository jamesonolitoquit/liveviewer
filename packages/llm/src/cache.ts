import type { LLMResponse, LLMOptions } from './types.js'

const DEFAULT_CACHE_DIR = 'llm-cache'

export interface CacheEntry {
  key: string
  data: LLMResponse
  timestamp: number
  provider: string
  model: string
}

// In-memory fallback cache for environments without fs (browser)
const memoryCache = new Map<string, CacheEntry>()

async function hash(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function getCacheKey(auditResults: object, options: LLMOptions): Promise<string> {
  const payload = JSON.stringify({
    failures: (auditResults as any).wcag?.failures ?? [],
    template: options.promptTemplate ?? 'default',
    model: options.model
  })
  return hash(payload)
}

function hasFs(): boolean {
  try {
    return !!require('node:fs')
  } catch {
    return false
  }
}

function hasCrypto(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

export function readCache(key: string, options: LLMOptions): LLMResponse | null {
  const ttl = (options.cacheTtlDays ?? 7) * 24 * 60 * 60 * 1000

  if (hasFs()) {
    try {
      const path = require('node:path')
      const fs = require('node:fs')
      const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
      const cachePath = path.join(cacheDir, `${key}.json`)
      if (!fs.existsSync(cachePath)) return memoryCache.get(key)?.data ?? null

      const entry: CacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      if (Date.now() - entry.timestamp > ttl) return null
      return entry.data
    } catch {
      return memoryCache.get(key)?.data ?? null
    }
  }

  // Browser fallback: check memory cache
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttl) {
    memoryCache.delete(key)
    return null
  }
  return entry.data
}

export function writeCache(key: string, data: LLMResponse, options: LLMOptions): void {
  const entry: CacheEntry = {
    key,
    data,
    timestamp: Date.now(),
    provider: options.provider,
    model: options.model
  }

  // Always store in memory cache
  memoryCache.set(key, entry)

  if (hasFs()) {
    try {
      const path = require('node:path')
      const fs = require('node:fs')
      const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
      fs.writeFileSync(path.join(cacheDir, `${key}.json`), JSON.stringify(entry, null, 2), 'utf-8')
    } catch {
      // File cache failed, memory cache still works
    }
  }
}

export function clearCache(cacheDir?: string): void {
  memoryCache.clear()

  if (hasFs()) {
    try {
      const path = require('node:path')
      const fs = require('node:fs')
      const dir = cacheDir ?? DEFAULT_CACHE_DIR
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          fs.rmSync(path.join(dir, file), { force: true })
        }
      }
    } catch {
      // ignore
    }
  }
}
