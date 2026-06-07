import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { LLMResponse, LLMOptions } from './types.js'

const DEFAULT_CACHE_DIR = 'llm-cache'
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface CacheEntry {
  key: string
  data: LLMResponse
  timestamp: number
  provider: string
  model: string
}

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function getCacheKey(auditResults: object, options: LLMOptions): string {
  const payload = JSON.stringify({
    failures: (auditResults as any).wcag?.failures ?? [],
    template: options.promptTemplate ?? 'default',
    model: options.model
  })
  return hash(payload)
}

export function readCache(key: string, options: LLMOptions): LLMResponse | null {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
  const cachePath = join(cacheDir, `${key}.json`)
  if (!existsSync(cachePath)) return null

  try {
    const entry: CacheEntry = JSON.parse(readFileSync(cachePath, 'utf-8'))
    const ttl = (options.cacheTtlDays ?? 7) * 24 * 60 * 60 * 1000
    if (Date.now() - entry.timestamp > ttl) return null
    return entry.data
  } catch {
    return null
  }
}

export function writeCache(key: string, data: LLMResponse, options: LLMOptions): void {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

  const entry: CacheEntry = {
    key,
    data,
    timestamp: Date.now(),
    provider: options.provider,
    model: options.model
  }

  writeFileSync(join(cacheDir, `${key}.json`), JSON.stringify(entry, null, 2), 'utf-8')
}

export function clearCache(cacheDir?: string): void {
  const dir = cacheDir ?? DEFAULT_CACHE_DIR
  if (existsSync(dir)) {
    const files = readdirSync(dir)
    for (const file of files) {
      rmSync(join(dir, file), { force: true })
    }
  }
}
