import { NextRequest, NextResponse } from 'next/server'
import { getCachedAudit, setCachedAudit } from '@/lib/audit-cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@liveviewer/core/src/auditor'
import { generateFixSuggestions } from '@liveviewer/core/src/recommender'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HARD_TIMEOUT_MS = 45000
const LAUNCH_TIMEOUT_MS = 10000

const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return u.origin + u.pathname.replace(/\/$/, '')
  } catch {
    return raw
  }
}

function isServerlessConstraint(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  return (
    msg.includes("Executable doesn't exist") ||
    msg.includes("browser was not found") ||
    msg.includes("Failed to launch") ||
    msg.includes("Chromium revision") ||
    msg.includes("out of memory") ||
    msg.includes("FUNCTION_INVOCATION_TIMEOUT") ||
    msg.includes("Page is too large") ||
    name === 'TimeoutError' ||
    msg.includes('Timeout') ||
    msg.includes('timeout') ||
    msg.includes('Audit timeout')
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms)
    )
  ])
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('warmup') === 'true') {
    return NextResponse.json({ status: 'warm', timestamp: Date.now() }, { status: 200 })
  }
  return NextResponse.json({ error: 'Use POST for audit' }, { status: 405 })
}

export async function POST(request: NextRequest) {
  const overallTimer = setTimeout(() => {}, HARD_TIMEOUT_MS)
  try {
    const body = await request.json().catch(() => ({}))
    const {
      url,
      viewports: rawViewports,
      timeout = 8000,
      waitUntil = 'load',
      waitStable = false,
      bypassCache,
      loadImages = false,
      context: bodyContext
    } = body

    let viewports: { width: number; height: number }[] | undefined
    if (rawViewports && Array.isArray(rawViewports) && rawViewports.length > 0) {
      viewports = rawViewports
        .filter((v: any) => v && typeof v.width === 'number' && typeof v.height === 'number')
        .sort((a: any, b: any) => b.width - a.width)
    }
    if (isVercel && viewports && viewports.length > 2) {
      viewports = viewports.slice(0, 2)
    }

    const rateLimit = await checkRateLimit(request)
    if (!rateLimit.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          reason: 'rate_limited',
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(rateLimit.reset / 1000))
          }
        }
      )
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    if (url.length > 2000) {
      return NextResponse.json({ error: 'URL too long' }, { status: 400 })
    }

    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const cacheKey = normalizeUrl(url)

    if (!bypassCache) {
      const cached = getCachedAudit(cacheKey, viewports)
      if (cached) {
        return NextResponse.json({ success: true, data: cached, cached: true })
      }
    }

    const auditOptions: any = {
      viewport: { width: 1024, height: 768 },
      label: 'web-audit',
      wcag: true,
      design: true,
      seo: true,
      security: true,
      legal: true,
      performance: true,
      timeout: Math.min(timeout, 7000),
      waitUntil,
      waitStable,
      loadImages,
      blockFonts: true,
      blockMedia: true,
      navigationTimeout: 7000
    }
    if (viewports) {
      auditOptions.viewports = viewports
    }

    const auditPromise = audit(url, auditOptions)

    const result: any = await withTimeout(auditPromise, HARD_TIMEOUT_MS, 'Audit hard timeout')

    const sanitized: any = {
      url: result.url,
      timestamp: result.timestamp,
      viewport: result.viewport,
      wcag: result.wcag
    }
    if (result.viewports) {
      sanitized.viewports = result.viewports.map((r: any) => ({
        viewport: r.viewport,
        wcag: r.wcag
      }))
    }
    if (result.design) {
      sanitized.design = result.design
    }
    if (result.seo) {
      sanitized.seo = result.seo
    }
    if (result.security) {
      sanitized.security = result.security
    }
    if (result.legal) {
      sanitized.legal = result.legal
    }
    if (result.performance) {
      sanitized.performance = result.performance
    }
    if (viewports && viewports.length >= 2) {
      sanitized.multiViewport = true
    }

    const fixSuggestions = generateFixSuggestions(result)
    if (fixSuggestions.length > 0) {
      sanitized.recommendations = fixSuggestions
    }

    setCachedAudit(cacheKey, sanitized, undefined, viewports)

    return NextResponse.json({ success: true, data: sanitized, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const reason = isServerlessConstraint(err) ? 'serverless_constraint' : 'audit_failed'

    if (reason === 'serverless_constraint') {
      return NextResponse.json(
        {
          error: 'Server-side audit unavailable. Try the CLI: npm install -g @liveviewer/cli',
          reason: 'serverless_constraint',
          fallback: true
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: message,
        reason: 'audit_failed',
        fallback: true,
        message: 'Page may be too large or slow. Try the CLI: npm install -g @liveviewer/cli'
      },
      { status: 500 }
    )
  } finally {
    clearTimeout(overallTimer)
  }
}
