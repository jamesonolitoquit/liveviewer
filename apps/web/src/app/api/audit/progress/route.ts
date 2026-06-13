import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ pillar: null }, { status: 400 })
  }
  const progress: Record<string, string> | undefined = (global as any).__auditProgress
  const pillar = progress?.[key] ?? null
  return NextResponse.json({ pillar })
}
