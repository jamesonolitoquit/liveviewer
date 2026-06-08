import { NextRequest, NextResponse } from 'next/server'
import { saveReport } from '@/lib/report-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const id = await saveReport(body)
    return NextResponse.json({ success: true, id })
  } catch {
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}
