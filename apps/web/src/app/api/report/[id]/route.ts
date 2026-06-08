import { NextRequest, NextResponse } from 'next/server'
import { getReport } from '@/lib/report-store'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getReport(id)
  if (!data) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data })
}
