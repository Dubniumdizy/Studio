import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Missing PDF file' }, { status: 400 })
    }
    if (!/pdf$/i.test(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    // Use pdf-parse only (more reliable in Node); remove pdfjs-dist to avoid ESM/worker issues
    let text = ''
    try {
      const pdfParse = (await import('pdf-parse')).default as (input: Buffer) => Promise<{ text: string }>
      const buf = Buffer.from(data)
      const result = await pdfParse(buf)
      text = cleanupExtractedText((result?.text || ''))
    } catch (err: any) {
      return NextResponse.json({ error: `Failed to extract text from PDF`, detail: `${err?.message || err}` }, { status: 500 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'No text extracted from PDF (the file may be scanned or contain no selectable text).' }, { status: 422 })
    }

    const { deckName, cards } = extractFlashcardsHeuristically(text, file.name)

    return NextResponse.json({ deckName, cards })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to process PDF' }, { status: 500 })
  }
}

// Rebuild page text by grouping PDFJS items into lines using y-position buckets and sorting by x
function rebuildPageText(content: any) {
  type Item = { str: string; x: number; y: number }
  const items: Item[] = (content.items || []).map((it: any) => {
    const tr = it.transform || it.tm || [1,0,0,1,0,0]
    const x = typeof tr[4] === 'number' ? tr[4] : 0
    const y = typeof tr[5] === 'number' ? tr[5] : 0
    return { str: String(it.str || ''), x, y }
  }).filter(it => it.str && it.str.trim().length > 0)

  if (items.length === 0) return ''

  // Bucket items into lines: items with y within tolerance belong to the same line
  const yTol = 2 // pixels tolerance for line grouping
  const lines: { y: number; items: Item[] }[] = []
  for (const it of items) {
    let bucket = lines.find(l => Math.abs(l.y - it.y) <= yTol)
    if (!bucket) {
      bucket = { y: it.y, items: [] }
      lines.push(bucket)
    }
    bucket.items.push(it)
  }

  // Sort lines from top to bottom (PDF y increases upwards; pages vary, but sorting by descending y often yields top->bottom)
  lines.sort((a, b) => b.y - a.y)

  // Sort items within line left-to-right and join with spaces
  const joinedLines = lines.map(l => {
    l.items.sort((a, b) => a.x - b.x)
    // Insert spaces between items when there's a significant x-gap
    const parts: string[] = []
    for (let i = 0; i < l.items.length; i++) {
      const cur = l.items[i]
      const prev = l.items[i - 1]
      if (i > 0) {
        const gap = cur.x - prev.x
        if (gap > 2) parts.push(' ')
      }
      parts.push(cur.str)
    }
    return parts.join('')
  })

  return joinedLines.join('\n')
}

// Clean up common artifacts: dehyphenate across line breaks, collapse spaces
function cleanupExtractedText(s: string) {
  if (!s) return ''
  let text = s

  // Normalize line endings
  text = text.replace(/\r\n?/g, '\n')

  // Dehyphenate: lines ending with word- followed by lowercase start on next line
  text = text.replace(/([A-Za-z])-(\n)([a-z])/g, '$1$3')

  // Collapse excessive whitespace inside lines
  text = text.split('\n').map(line => line.replace(/\s{2,}/g, ' ').trim()).join('\n')

  // Remove empty lines duplicates
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

// Very simple heuristic extractor to produce basic Q/A pairs
function extractFlashcardsHeuristically(text: string, filename: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Group into sections by headings (lines that end with ':' or are Title Case and short)
  const sections: { heading: string; body: string[] }[] = []
  let current: { heading: string; body: string[] } | null = null

  const isLikelyHeading = (line: string) => {
    if (line.length <= 2) return false
    if (/[:：]$/.test(line)) return true
    if (line.length < 80 && /^(?:[A-Z][^.!?]{0,})$/.test(line)) return true
    return false
  }

  for (const line of lines) {
    if (isLikelyHeading(line)) {
      if (current) sections.push(current)
      current = { heading: line.replace(/[:：]$/,'').trim(), body: [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) sections.push(current)

  const cards: { front: string; back: string }[] = []

  if (sections.length > 0) {
    for (const s of sections) {
      const body = s.body.join(' ')
      const back = collapse(body, 600)
      if (!s.heading || !back) continue
      const front = s.heading.length > 150 ? s.heading.slice(0, 147) + '…' : s.heading
      cards.push({ front, back })
      if (cards.length >= 40) break
    }
  } else {
    // Fallback: sentence-based cards
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 30)
    for (const s of sentences.slice(0, 30)) {
      const front = s.split(/\s+/).slice(0, 10).join(' ') + '…'
      const back = s
      cards.push({ front, back })
    }
  }

  const base = filename.replace(/\.pdf$/i, '') || 'Imported Deck'
  const deckName = base.length > 60 ? base.slice(0,57) + '…' : base

  return { deckName, cards }
}

function collapse(s: string, limit: number) {
  return s.length > limit ? s.slice(0, limit - 1) + '…' : s
}
