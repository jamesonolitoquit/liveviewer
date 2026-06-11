import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { backendUrl, model, messages, temperature, max_tokens, response_format } = body

    if (!backendUrl || !model || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields: backendUrl, model, messages' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const payload: Record<string, any> = { model, messages }
    if (temperature !== undefined) payload.temperature = temperature
    if (max_tokens !== undefined) payload.max_tokens = max_tokens
    if (response_format !== undefined) payload.response_format = response_format

    const externalResponse = await fetch(`${backendUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    })

    const data = await externalResponse.json()
    return NextResponse.json(data, { status: externalResponse.status })
  } catch (error: any) {
    console.error('Smart proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
