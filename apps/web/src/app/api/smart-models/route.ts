import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { backendUrl } = body

    if (!backendUrl) {
      return NextResponse.json({ error: 'Missing required field: backendUrl' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }

    const externalResponse = await fetch(`${backendUrl.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
    })

    const data = await externalResponse.json()
    return NextResponse.json(data, { status: externalResponse.status })
  } catch (error: any) {
    console.error('Smart models proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
