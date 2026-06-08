import { NextRequest, NextResponse } from 'next/server'
import { getHistory } from '@/lib/history'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
  }

  try {
    const history = await getHistory(url)
    return NextResponse.json({ success: true, data: history })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
