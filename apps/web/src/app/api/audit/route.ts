import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { url, timeout = 30000, waitUntil = 'networkidle' } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Dynamic import of the auditor (CJS module)
    const { audit } = require('@liveviewer/core/src/auditor')

    console.log(`[audit] Running audit for ${url}`)

    const result = await audit(url, {
      viewport: { width: 1280, height: 800 },
      label: 'web-audit',
      wcag: true,
      timeout,
      waitUntil
    })

    // Strip file paths from result (not relevant in web context)
    const sanitized = {
      url: result.url,
      timestamp: result.timestamp,
      viewport: result.viewport,
      wcag: result.wcag
    }

    console.log(`[audit] Complete: ${sanitized.wcag?.score ?? 'N/A'}% pass rate`)

    return NextResponse.json({ success: true, data: sanitized })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[audit] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
