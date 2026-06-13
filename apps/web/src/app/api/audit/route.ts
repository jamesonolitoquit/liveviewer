import { NextRequest, NextResponse } from 'next/server'
import { getCachedAudit, setCachedAudit } from '@/lib/audit-cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@liveviewer/core/src/auditor'
import { generateFixSuggestions } from '@liveviewer/core/src/recommender'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HARD_TIMEOUT_MS = 75000
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
      waitUntil,
      waitStable = false,
      bypassCache,
      pillars: rawPillars,
      context: bodyContext,
      progressKey
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

    const pillars = Array.isArray(rawPillars) ? rawPillars.filter((p: string) => ['wcag','design','seo','security','legal','performance'].includes(p)) : undefined

    const auditOptions: any = {
      viewport: { width: 1024, height: 768 },
      label: 'web-audit',
      wcag: !pillars || pillars.includes('wcag'),
      design: !pillars || pillars.includes('design'),
      seo: !pillars || pillars.includes('seo'),
      security: !pillars || pillars.includes('security'),
      legal: !pillars || pillars.includes('legal'),
      performance: !pillars || pillars.includes('performance'),
      timeout: HARD_TIMEOUT_MS,
      waitUntil,
      waitStable,
      blockMedia: true,
      navigationTimeout: 15000,
      pageSizeLimit: { htmlBytes: 10485760, domElements: 15000 },
      pillarTimeouts: { wcag: 8000, design: 8000, seo: 8000, security: 6000, legal: 6000, mobile: 6000, performance: 40000 },
      progressKey: progressKey || undefined
    }
    if (viewports) {
      auditOptions.viewports = viewports
    }

    const auditPromise = audit(url, auditOptions)

    const result: any = await withTimeout(auditPromise, HARD_TIMEOUT_MS, 'Audit hard timeout')

    const sanitized: any = {
      url: result.url,
      timestamp: result.timestamp,
      viewport: result.viewport
    }
    if (!pillars || pillars.includes('wcag')) {
      sanitized.wcag = result.wcag
    }
    if (result.viewports) {
      sanitized.viewports = result.viewports.map((r: any) => {
        const v: any = { viewport: r.viewport }
        if (!pillars || pillars.includes('wcag')) v.wcag = r.wcag
        return v
      })
    }
    if (result.design && (!pillars || pillars.includes('design'))) {
      sanitized.design = result.design
    }
    if (result.seo && (!pillars || pillars.includes('seo'))) {
      sanitized.seo = result.seo
    }
    if (result.security && (!pillars || pillars.includes('security'))) {
      sanitized.security = result.security
    }
    if (result.legal && (!pillars || pillars.includes('legal'))) {
      sanitized.legal = result.legal
    }
    if (result.performance && (!pillars || pillars.includes('performance'))) {
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

    const responseBody: any = { success: true, data: sanitized, cached: false }
    if (result.pillarErrors) {
      responseBody.pillarErrors = result.pillarErrors
    }
    return NextResponse.json(responseBody)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : ''
    const reason = isServerlessConstraint(err) ? 'serverless_constraint' : 'audit_failed'

    if (name === 'PageTooLargeError') {
      return NextResponse.json(
        {
          error: 'Page too large for server-side audit.',
          reason: 'page_too_large',
          recommendation: 'use_cli'
        },
        { status: 413 }
      )
    }

    if (reason === 'serverless_constraint') {
      return NextResponse.json(
        {
          error: 'Server-side audit unavailable. Try the CLI: npm install -g @liveviewer/cli',
          reason: 'serverless_constraint',
          recommendation: 'use_cli',
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
