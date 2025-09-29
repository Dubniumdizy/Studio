import { NextRequest, NextResponse } from 'next/server'

// Simple image proxy to bypass CORS for client-side DOM capture.
// Security considerations:
// - Only allows http(s) destinations
// - Only forwards image/* content types
// - Caps response size to a reasonable limit

const MAX_BYTES = 15 * 1024 * 1024 // 15MB

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('url')
    if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    let target: URL
    try {
      target = new URL(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only http(s) URLs are allowed' }, { status: 400 })
    }

    const resp = await fetch(target, { cache: 'no-store' })
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream error: ${resp.status}` }, { status: 502 })
    }

    const ct = resp.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) {
      return NextResponse.json({ error: 'Upstream is not an image' }, { status: 415 })
    }

    const lenHeader = resp.headers.get('content-length')
    if (lenHeader) {
      const len = Number(lenHeader)
      if (!Number.isNaN(len) && len > MAX_BYTES) {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 })
      }
    }

    // Stream the body through without buffering entire content if possible
    const body = resp.body ?? (await resp.arrayBuffer())

    return new NextResponse(body as any, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
        // Allow use as <img src> or CSS background without CORS issues on the client
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 })
  }
}

