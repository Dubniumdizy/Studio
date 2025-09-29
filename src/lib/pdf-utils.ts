// Encode text for PDF content streams using WinAnsi (CP1252-like) single-byte encoding.
// This supports common Western European characters, including Swedish å Å ä Ä ö Ö.
function encodeWinAnsi(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  let j = 0
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code <= 0xFF) {
      out[j++] = code & 0xFF
    } else {
      // Replace unsupported characters with '?'
      out[j++] = 0x3F
    }
  }
  return out.subarray(0, j)
}

export function generateSimplePdf(title: string, bodyLines: string[]): Blob {
  // Minimal 1-page PDF with Helvetica text
  // Page size A4: 595 x 842 points
  const objects: string[] = []

  // Escape parentheses and backslashes in PDF text
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  // 1: Catalog
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
  // 2: Pages
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
  // 5: Font
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"

  // Build content stream
  const lines: string[] = []
  lines.push("BT")
  lines.push("/F1 12 Tf")
  lines.push("14 TL") // line leading
  // Title (bold effect simulated by larger font)
  lines.push("/F1 16 Tf")
  lines.push("50 810 Td")
  lines.push(`(${esc(title)}) Tj`)
  lines.push("/F1 12 Tf")
  // Body
  lines.push("T*") // next line from current point
  for (const ln of bodyLines) {
    lines.push(`(${esc(ln)}) Tj`)
    lines.push("T*")
  }
  lines.push("ET")
  const contentStream = lines.join("\n")
  const content = `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`

  // 3: Page
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"

  // Assemble with xref
  objects.push(obj1)
  objects.push(obj2)
  objects.push(obj3)
  objects.push(content)
  objects.push(obj5)

  // Calculate offsets
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  let cursor = pdf.length
  for (const obj of objects) {
    offsets.push(cursor)
    pdf += obj
    cursor = pdf.length
  }
  const xrefPos = cursor
  pdf += "xref\n"
  pdf += `0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`
  }
  pdf += "trailer\n"
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += "startxref\n"
  pdf += `${xrefPos}\n`
  pdf += "%%EOF\n"

  // Use WinAnsi encoding for the PDF bytes to support Swedish characters
  return new Blob([encodeWinAnsi(pdf)], { type: "application/pdf" })
}

export function htmlToText(html: string): string[] {
  // Very basic HTML -> text: strip tags and decode a few entities
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  const text = (tmp.textContent || tmp.innerText || "").replace(/\r\n|\r|\n/g, "\n")
  return text.split("\n").map((s) => s.trimEnd())
}

// Generate a single-page PDF embedding a JPEG image scaled to fit A4
// imageDataUrl must be a data URL with "image/jpeg"
export function generateJpegPdf(imageDataUrl: string, imgPxWidth: number, imgPxHeight: number, opts?: { margin?: number }): Blob {
  const margin = opts?.margin ?? 10 // points
  const pageW = 595, pageH = 842 // A4 in points

  // Convert dataURL to bytes
  const base64 = imageDataUrl.split(',')[1]
  const binStr = atob(base64)
  const imgBytes = new Uint8Array(binStr.length)
  for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i)

  // Assume source pixels are at 96 DPI. Convert to PDF points (72 per inch)
  const pxToPt = 72 / 96
  let imgWpt = imgPxWidth * pxToPt
  let imgHpt = imgPxHeight * pxToPt

  // Scale to fit within page minus margins
  const maxW = pageW - 2 * margin
  const maxH = pageH - 2 * margin
  const scale = Math.min(maxW / imgWpt, maxH / imgHpt, 1)
  imgWpt *= scale
  imgHpt *= scale

  // Content stream to draw image
  const x = margin
  const y = margin
  const contentStream = `q\n${imgWpt.toFixed(2)} 0 0 ${imgHpt.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`
  const contentBytes = new TextEncoder().encode(contentStream)

  // Assemble PDF objects as byte arrays for accurate offsets
  const objs: Uint8Array[] = []
  const enc = (s: string) => encodeWinAnsi(s)

  objs.push(enc("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"))
  objs.push(enc("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"))
  objs.push(enc(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`))
  objs.push(enc(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`))
  objs.push(contentBytes)
  objs.push(enc("endstream\nendobj\n"))
  objs.push(enc(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgPxWidth} /Height ${imgPxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`))
  objs.push(imgBytes)
  objs.push(enc("\nendstream\nendobj\n"))

  // Build full PDF
  let header = "%PDF-1.4\n"
  const parts: Uint8Array[] = []
  const objOffsets: number[] = []
  let len = 0
  const pushRaw = (b: Uint8Array) => { parts.push(b); len += b.length }
  const pushObj = (b: Uint8Array) => { objOffsets.push(len); parts.push(b); len += b.length }

  // Write header (not an object)
  pushRaw(enc(header))
  // Write objects
  for (const part of objs) pushObj(part)

  // Xref for objects only
  const xrefStart = len
  let xrefStr = "xref\n"
  xrefStr += `0 ${objs.length + 1}\n`
  xrefStr += "0000000000 65535 f \n"
  for (const off of objOffsets) xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`
  xrefStr += "trailer\n"
  xrefStr += `<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  pushRaw(enc(xrefStr))

  // Concatenate
  const total = parts.reduce((acc, b) => acc + b.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const b of parts) { out.set(b, pos); pos += b.length }
  return new Blob([out], { type: 'application/pdf' })
}

// Create a multi-page PDF from a tall JPEG by slicing it into page-height chunks
export async function generateJpegMultiPagePdf(imageDataUrl: string, imgPxWidth: number, imgPxHeight: number, opts?: { margin?: number; pageW?: number; pageH?: number; quality?: number }): Promise<Blob> {
  const margin = opts?.margin ?? 10
  const pageW = opts?.pageW ?? 595
  const pageH = opts?.pageH ?? 842
  const quality = opts?.quality ?? 0.9
  const pxToPt = 72 / 96

  // Compute scale-to-fit width within margins
  const maxWpt = pageW - 2 * margin
  const imgWpt0 = imgPxWidth * pxToPt
  const scaleToFit = Math.min(maxWpt / imgWpt0, 1)
  const maxHpt = pageH - 2 * margin
  const displayedTotalHpt = imgPxHeight * pxToPt * scaleToFit

  // If image fits on a single page, delegate to single page generator
  if (displayedTotalHpt <= maxHpt) {
    return generateJpegPdf(imageDataUrl, imgPxWidth, imgPxHeight, { margin })
  }

  // Load the image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = (e) => reject(e)
    im.src = imageDataUrl
  })

  // Compute slice height in pixels corresponding to one page of content
  const slicePxHeight = Math.max(1, Math.floor(maxHpt / (pxToPt * scaleToFit)))
  const numPages = Math.ceil(imgPxHeight / slicePxHeight)

  // Prepare PDF pieces
  const enc = (s: string) => encodeWinAnsi(s)
  const parts: Uint8Array[] = []
  const objOffsets: number[] = []
  const header = '%PDF-1.4\n'
  let len = 0
  const pushRaw = (b: Uint8Array) => { parts.push(b); len += b.length }
  const pushObj = (b: Uint8Array) => { objOffsets.push(len); parts.push(b); len += b.length }
  pushRaw(enc(header))

  // Object builder helpers
  const objs: Uint8Array[] = []
  const addObj = (s: string | Uint8Array) => { objs.push(typeof s === 'string' ? enc(s) : s) }

  // 1: Catalog, 2: Pages (placeholder now)
  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const pagesObjIndex = objs.length
  addObj('')

  let nextId = 3
  const pageIds: number[] = []

  for (let i = 0; i < numPages; i++) {
    const ySrc = i * slicePxHeight
    const hSrc = Math.min(slicePxHeight, imgPxHeight - ySrc)

    // Draw slice to a canvas
    const canvas = document.createElement('canvas')
    canvas.width = imgPxWidth
    canvas.height = hSrc
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, ySrc, imgPxWidth, hSrc, 0, 0, imgPxWidth, hSrc)
    const sliceDataUrl = canvas.toDataURL('image/jpeg', quality)

    const b64 = sliceDataUrl.split(',')[1]
    const binStr = atob(b64)
    const imgBytes = new Uint8Array(binStr.length)
    for (let j = 0; j < binStr.length; j++) imgBytes[j] = binStr.charCodeAt(j)

    const drawWpt = imgPxWidth * pxToPt * scaleToFit
    const drawHpt = hSrc * pxToPt * scaleToFit

    const imgObjId = nextId++
    addObj(`${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgPxWidth} /Height ${hSrc} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`)
    addObj(imgBytes)
    addObj(`\nendstream\nendobj\n`)

    const content = `q\n${drawWpt.toFixed(2)} 0 0 ${drawHpt.toFixed(2)} ${margin.toFixed(2)} ${margin.toFixed(2)} cm\n/Im${i} Do\nQ\n`
    const contentBytes = enc(content)
    const contentObjId = nextId++
    addObj(`${contentObjId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`)
    addObj(contentBytes)
    addObj(`endstream\nendobj\n`)

    const pageObjId = nextId++
    addObj(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${i} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`)

    pageIds.push(pageObjId)
  }

  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>\nendobj\n`
  objs[pagesObjIndex] = enc(pagesObj)

  for (const o of objs) pushObj(o as Uint8Array)

  const xrefStart = len
  let xrefStr = 'xref\n'
  xrefStr += `0 ${objs.length + 1}\n`
  xrefStr += '0000000000 65535 f \n'
  for (const off of objOffsets) xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`
  xrefStr += 'trailer\n'
  xrefStr += `<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  pushRaw(enc(xrefStr))

  const total = parts.reduce((acc, b) => acc + b.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const b of parts) { out.set(b, pos); pos += b.length }
return new Blob([out], { type: 'application/pdf' })
}

// Build a structured analysis report PDF from AnalyzeExamOutput with sections and tables.
// This uses basic PDF primitives (text and lines) to avoid any canvas/CORS issues.
export function generateAnalysisReportPdf(
  analysis: {
    commonThemes: string;
    keywords: string;
    questionTypes: string;
    hardQuestionTrends: string;
    keyConcepts: { name: string; type: string; occurrences: number }[];
    adviceForPassing: string;
    adviceForTopScore: string;
    questionTopicMap: { topic: string; questions: string[] }[];
  },
  opts?: { title?: string }
): Blob {
  const title = opts?.title ?? 'Exam Analysis Report'
  const pageW = 595, pageH = 842
  const marginLeft = 40, marginRight = 40, marginTop = 50, marginBottom = 50
  const fontSize = 12
  const lineHeight = 14
  // Table-specific typography to fit more text
  const tableFontSize = 11
  const tableLineHeight = 13
  const headerFontSize = 12

  const enc = (s: string) => encodeWinAnsi(s)
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  const parts: Uint8Array[] = []
  const objOffsets: number[] = []
  let len = 0
  const pushRaw = (b: Uint8Array) => { parts.push(b); len += b.length }
  const pushObj = (b: Uint8Array) => { objOffsets.push(len); parts.push(b); len += b.length }

  pushRaw(enc('%PDF-1.4\n'))

  const objs: Uint8Array[] = []
  const addObj = (s: string | Uint8Array) => objs.push(typeof s === 'string' ? enc(s) : s)

  // 1: Catalog, 2: Pages placeholder, 3: Font
  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const pagesIndex = objs.length
  addObj('')
  addObj('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  // Content helpers
  const startPage = () => {
    return {
      cmds: [] as string[],
      y: pageH - marginTop
    }
  }

  const moveTo = (cmds: string[], x: number, y: number) => cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} m`)
  const lineTo = (cmds: string[], x: number, y: number) => cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} l`)
  const stroke = (cmds: string[]) => cmds.push('S')
  const textAt = (cmds: string[], x: number, y: number, text: string, size = fontSize) => {
    cmds.push('BT')
    cmds.push(`/F1 ${size} Tf`)
    cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`)
    cmds.push(`(${esc(text)}) Tj`)
    cmds.push('ET')
  }

  const usableW = pageW - marginLeft - marginRight

  const pages: { contentObjId: number; pageObjId: number; content: string }[] = []
  let pg = startPage()

  // Title
  textAt(pg.cmds, marginLeft, pg.y, title, 16)
  pg.y -= lineHeight * 2

  const writeParagraphsInColumn = (
    startY: number,
    colX: number,
    colW: number,
    items: { label: string; body: string }[]
  ): number => {
    let y = startY
    const approxCharWidth = fontSize * 0.6
    const writeWrapped = (text: string) => {
      const words = text.split(/\s+/)
      let line = ''
      for (const w of words) {
        const test = (line ? line + ' ' : '') + w
        if (test.length * approxCharWidth > colW) {
          // If next line would go below margin, move to next page before drawing
          if (y - lineHeight < marginBottom) { flushPage(); y = pageH - marginTop }
          textAt(pg.cmds, colX, y, line)
          y -= lineHeight
          line = w
        } else {
          line = test
        }
      }
      if (line) {
        if (y - lineHeight < marginBottom) { flushPage(); y = pageH - marginTop }
        textAt(pg.cmds, colX, y, line)
        y -= lineHeight
      }
    }
    for (const it of items) {
      // Ensure there is space for the heading and at least one line; otherwise break
      if (y - (lineHeight * 2) < marginBottom) { flushPage(); y = pageH - marginTop }
      // label
      textAt(pg.cmds, colX, y, it.label, 14)
      // underline limited to column width
      const underlineY = y - 2
      moveTo(pg.cmds, colX, underlineY); lineTo(pg.cmds, colX + colW, underlineY); stroke(pg.cmds)
      y -= lineHeight
      // body
      writeWrapped(it.body || '—')
      y -= lineHeight * 0.5
      if (y < marginBottom) { flushPage(); y = pageH - marginTop }
    }
    return y
  }

  const flushPage = () => {
    const content = pg.cmds.join('\n')
    const contentObjId = nextId++
    const pageObjId = nextId++
    addObj(`${contentObjId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
    addObj(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`)
    pageIds.push(pageObjId)
    pg = startPage()
  }

  const pageIds: number[] = []
  let nextId = 4

  // Sections in two columns
  const colGutter = 16
  const colW = Math.floor((usableW - colGutter) / 2)
  const colLeftX = marginLeft
  const colRightX = marginLeft + colW + colGutter
  const colStartY = pg.y

  const leftItems = [
    { label: 'Common Themes', body: analysis.commonThemes || '—' },
    { label: 'Keywords', body: analysis.keywords || '—' },
    { label: 'Question Types', body: analysis.questionTypes || '—' },
  ]
  const rightItems = [
    { label: 'Hard Question Trends', body: analysis.hardQuestionTrends || '—' },
    { label: 'Advice for Passing', body: analysis.adviceForPassing || '—' },
    { label: 'Advice for Top Score', body: analysis.adviceForTopScore || '—' },
  ]

  const yLeft = writeParagraphsInColumn(colStartY, colLeftX, colW, leftItems)
  const yRight = writeParagraphsInColumn(colStartY, colRightX, colW, rightItems)

  pg.y = Math.min(yLeft, yRight) - lineHeight
  if (pg.y < marginBottom + 2 * lineHeight) { flushPage(); pg.y = pageH - marginTop }

  // Key Concepts table
  const tableHeader = ['Concept', 'Type', 'Occurrences']
  const colWidths = [Math.floor(usableW * 0.6), Math.floor(usableW * 0.25), Math.floor(usableW * 0.15)]
  const xCols = [marginLeft, marginLeft + colWidths[0], marginLeft + colWidths[0] + colWidths[1], marginLeft + usableW]

  const drawTableRow = (cells: string[], isHeader = false) => {
    const padX = 4
    if (isHeader) {
      const rowH = tableLineHeight + 4
      // Preflight page break
      if (pg.y - rowH < marginBottom + rowH) flushPage()
      const topY = pg.y
      const bottomY = topY - rowH
      // Header shading (light gray fill)
      pg.cmds.push('0.9 g')
      pg.cmds.push(`${marginLeft.toFixed(2)} ${bottomY.toFixed(2)} ${usableW.toFixed(2)} ${rowH.toFixed(2)} re`)
      pg.cmds.push('f')
      pg.cmds.push('0 g')
      // Borders
      moveTo(pg.cmds, marginLeft, topY); lineTo(pg.cmds, marginLeft + usableW, topY); stroke(pg.cmds)
      moveTo(pg.cmds, marginLeft, bottomY); lineTo(pg.cmds, marginLeft + usableW, bottomY); stroke(pg.cmds)
      for (const x of xCols) { moveTo(pg.cmds, x, topY); lineTo(pg.cmds, x, bottomY); stroke(pg.cmds) }
      // Header text
      const baseline = topY - (rowH - headerFontSize) + 1
      textAt(pg.cmds, xCols[0] + padX, baseline, cells[0] ?? '', headerFontSize)
      textAt(pg.cmds, xCols[1] + padX, baseline, cells[1] ?? '', headerFontSize)
      textAt(pg.cmds, xCols[2] + padX, baseline, (cells[2] ?? '').toString(), headerFontSize)
      pg.y = bottomY
      return
    }

    // Body row with soft wrapping in first two columns
    const approxCharWidth = tableFontSize * 0.62
    const wrapCol = (text: string, widthPt: number): string[] => {
      const maxChars = Math.max(8, Math.floor(widthPt / approxCharWidth))
      const out: string[] = []
      const words = (text || '').split(/\s+/).filter(Boolean)
      let line = ''
      for (const w of words) {
        const test = (line ? line + ' ' : '') + w
        if (test.length > maxChars) { if (line) out.push(line); line = w }
        else line = test
      }
      if (line) out.push(line)
      // hard wrap any oversize chunks
      const hardWrapped: string[] = []
      for (const l of out) {
        if (l.length <= maxChars) { hardWrapped.push(l); continue }
        let i = 0
        while (i < l.length) { hardWrapped.push(l.slice(i, i + maxChars)); i += maxChars }
      }
      return hardWrapped
    }

    const col0Lines = wrapCol(cells[0] ?? '', colWidths[0] - 2 * padX)
    const col1Lines = wrapCol(cells[1] ?? '', colWidths[1] - 2 * padX)
    const col2Lines = [(cells[2] ?? '').toString()]
    const linesPerRow = Math.max(col0Lines.length, col1Lines.length, col2Lines.length)
    const rowH = (tableLineHeight + 4) + (Math.max(0, linesPerRow - 1) * tableLineHeight)

    // Preflight page break
    if (pg.y - rowH < marginBottom + tableLineHeight * 2) flushPage()

    const topY = pg.y
    const bottomY = topY - rowH

    // Borders
    moveTo(pg.cmds, marginLeft, topY); lineTo(pg.cmds, marginLeft + usableW, topY); stroke(pg.cmds)
    moveTo(pg.cmds, marginLeft, bottomY); lineTo(pg.cmds, marginLeft + usableW, bottomY); stroke(pg.cmds)
    for (const x of xCols) { moveTo(pg.cmds, x, topY); lineTo(pg.cmds, x, bottomY); stroke(pg.cmds) }

    // Text rendering line-by-line
    let yText = topY - (tableLineHeight - tableFontSize) - 3
    for (let i = 0; i < linesPerRow; i++) {
      const t0 = col0Lines[i] ?? ''
      const t1 = col1Lines[i] ?? ''
      const t2 = col2Lines[i] ?? ''
      if (t0) textAt(pg.cmds, xCols[0] + padX, yText, t0, tableFontSize)
      if (t1) textAt(pg.cmds, xCols[1] + padX, yText, t1, tableFontSize)
      if (t2) textAt(pg.cmds, xCols[2] + padX, yText, t2, tableFontSize)
      yText -= tableLineHeight
    }

    pg.y = bottomY
    if (pg.y < marginBottom + tableLineHeight * 2) flushPage()
  }

  textAt(pg.cmds, marginLeft, pg.y, 'Key Concepts', 14)
  pg.y -= lineHeight
  drawTableRow(tableHeader, true)
  for (const kc of (analysis.keyConcepts || [])) {
    drawTableRow([kc.name, kc.type, String(kc.occurrences)])
  }
  pg.y -= lineHeight

  // Question Topic Map table (Topic | Questions)
  const qColsWidths = [Math.floor(usableW * 0.30), Math.floor(usableW * 0.70)]
  const qx = [marginLeft, marginLeft + qColsWidths[0], marginLeft + usableW]
  const drawQRow = (topic: string, questions: string[]) => {
    // Wrap questions to fit the right column. Split on commas, then hard-wrap long segments.
    const approxCharWidth = tableFontSize * 0.62
    const maxPerLine = Math.max(10, Math.floor(qColsWidths[1] / approxCharWidth))

    const wrapped: string[] = []
    const hardWrap = (s: string) => {
      let i = 0
      while (i < s.length) {
        wrapped.push(s.slice(i, i + maxPerLine))
        i += maxPerLine
      }
    }
    for (let entry of (questions || [])) {
      let s = (entry || '').trim()
      if (!s) continue
      if (s.length <= maxPerLine) wrapped.push(s)
      else hardWrap(s)
    }

    // Wrap topic as well to avoid overflow in left column
    const topicMaxChars = Math.max(8, Math.floor(qColsWidths[0] / approxCharWidth))
    const wrapText = (s: string, max: number) => {
      const out: string[] = []
      const words = (s || '').split(/\s+/).filter(Boolean)
      let line = ''
      for (const w of words) {
        const test = (line ? line + ' ' : '') + w
        if (test.length > max) { if (line) out.push(line); line = w } else line = test
      }
      if (line) out.push(line)
      const final: string[] = []
      for (const l of out) {
        if (l.length <= max) final.push(l)
        else { let i = 0; while (i < l.length) { final.push(l.slice(i, i + max)); i += max } }
      }
      return final
    }
    const topicLines = wrapText(topic, topicMaxChars)

    const linesPerRowQ = Math.max(wrapped.length, topicLines.length)
    const rowH = tableLineHeight + 4 + (Math.max(0, linesPerRowQ - 1) * tableLineHeight)
    // Preflight page break before drawing
    if (pg.y - rowH < marginBottom + tableLineHeight * 2) flushPage()

    const topY = pg.y
    moveTo(pg.cmds, marginLeft, topY); lineTo(pg.cmds, marginLeft + usableW, topY); stroke(pg.cmds)
    const bottomY = topY - rowH
    moveTo(pg.cmds, marginLeft, bottomY); lineTo(pg.cmds, marginLeft + usableW, bottomY); stroke(pg.cmds)
    for (const x of qx) { moveTo(pg.cmds, x, topY); lineTo(pg.cmds, x, bottomY); stroke(pg.cmds) }
    const padX = 4
    const baseline = topY - (tableLineHeight) + 10
    let yTextLeft = baseline
    let yTextRight = baseline
    for (let i=0;i<linesPerRowQ;i++) {
      const left = topicLines[i] ?? ''
      const right = wrapped[i] ?? ''
      if (left) textAt(pg.cmds, qx[0] + padX, yTextLeft, left, tableFontSize)
      if (right) textAt(pg.cmds, qx[1] + padX, yTextRight, right, tableFontSize)
      yTextLeft -= tableLineHeight
      yTextRight -= tableLineHeight
    }
    pg.y = bottomY
    if (pg.y < marginBottom + tableLineHeight * 2) flushPage()
  }

  textAt(pg.cmds, marginLeft, pg.y, 'Question Topic Map', 14)
  pg.y -= lineHeight
  // header (shaded)
  const headerTop = pg.y
  const headerH = tableLineHeight + 4
  const headerBottom = headerTop - headerH
  // Fill rectangle background
  pg.cmds.push('0.9 g')
  pg.cmds.push(`${marginLeft.toFixed(2)} ${headerBottom.toFixed(2)} ${usableW.toFixed(2)} ${headerH.toFixed(2)} re`)
  pg.cmds.push('f')
  pg.cmds.push('0 g')
  // Border lines
  moveTo(pg.cmds, marginLeft, headerTop); lineTo(pg.cmds, marginLeft + usableW, headerTop); stroke(pg.cmds)
  moveTo(pg.cmds, marginLeft, headerBottom); lineTo(pg.cmds, marginLeft + usableW, headerBottom); stroke(pg.cmds)
  for (const x of [marginLeft, qx[1], marginLeft + usableW]) { moveTo(pg.cmds, x, headerTop); lineTo(pg.cmds, x, headerBottom); stroke(pg.cmds) }
  const headerBaseline = headerTop - (headerH - headerFontSize) + 1
  textAt(pg.cmds, qx[0] + 4, headerBaseline, 'Topic', headerFontSize)
  textAt(pg.cmds, qx[1] + 4, headerBaseline, 'Found In Questions', headerFontSize)
  pg.y = headerBottom

  for (const item of (analysis.questionTopicMap || [])) {
    drawQRow(item.topic, (item.questions || []))
  }

  // Commit last page
  flushPage()

  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>\nendobj\n`
  objs[pagesIndex] = enc(pagesObj)

  // Write objects
  for (const o of objs) pushObj(o)

  const xrefStart = len
  let xrefStr = 'xref\n'
  xrefStr += `0 ${objs.length + 1}\n`
  xrefStr += '0000000000 65535 f \n'
  for (const off of objOffsets) xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`
  xrefStr += 'trailer\n'
  xrefStr += `<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  pushRaw(enc(xrefStr))

  const total = parts.reduce((acc, b) => acc + b.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const b of parts) { out.set(b, pos); pos += b.length }
  return new Blob([out], { type: 'application/pdf' })
}

// Generate a multipage text PDF (no images). Always succeeds and avoids canvas/CORS.
export function generateTextMultiPagePdf(
  title: string,
  bodyLines: string[],
  opts?: { marginTop?: number; marginLeft?: number; marginRight?: number; marginBottom?: number; pageW?: number; pageH?: number; fontSize?: number; lineHeight?: number }
): Blob {
  const pageW = opts?.pageW ?? 595
  const pageH = opts?.pageH ?? 842
  const marginTop = opts?.marginTop ?? 60
  const marginBottom = opts?.marginBottom ?? 50
  const marginLeft = opts?.marginLeft ?? 50
  const marginRight = opts?.marginRight ?? 50
  const fontSize = opts?.fontSize ?? 12
  const lineHeight = opts?.lineHeight ?? 14

  const enc = (s: string) => encodeWinAnsi(s)
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  const parts: Uint8Array[] = []
  const objOffsets: number[] = []
  let len = 0
  const pushRaw = (b: Uint8Array) => { parts.push(b); len += b.length }
  const pushObj = (b: Uint8Array) => { objOffsets.push(len); parts.push(b); len += b.length }

  const header = '%PDF-1.4\n'
  pushRaw(enc(header))

  const objs: Uint8Array[] = []
  const addObj = (s: string | Uint8Array) => objs.push(typeof s === 'string' ? enc(s) : s)

  // 1: Catalog, 2: Pages placeholder, 3: Font
  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const pagesIndex = objs.length
  addObj('')
  addObj('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  const usableWidth = pageW - marginLeft - marginRight
  // Roughly wrap lines to avoid overly long lines (best-effort)
  const maxCharsPerLine = Math.max(20, Math.floor(usableWidth / (fontSize * 0.6)))
  const wrapLine = (s: string): string[] => {
    if (s.length <= maxCharsPerLine) return [s]
    const out: string[] = []
    let i = 0
    while (i < s.length) {
      let j = Math.min(s.length, i + maxCharsPerLine)
      // try to break on space
      let k = s.lastIndexOf(' ', j)
      if (k < i + Math.floor(maxCharsPerLine * 0.5)) k = j
      out.push(s.slice(i, k))
      i = k + (k < s.length && s[k] === ' ' ? 1 : 0)
    }
    return out
  }

  const wrappedLines = bodyLines.flatMap(wrapLine)
  const titleLines = [`${title}`]

  const linesPerPage = Math.max(1, Math.floor((pageH - marginTop - marginBottom) / lineHeight) - 3) // reserve for title on first page
  let idx = 0
  const pageIds: number[] = []
  let nextId = 4

  const makePage = (content: string, contentObjId: number, pageObjId: number) => {
    addObj(`${contentObjId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
    addObj(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`)
    pageIds.push(pageObjId)
  }

  const makeContent = (lines: string[], includeTitle: boolean): string => {
    const cmds: string[] = []
    cmds.push('BT')
    cmds.push(`/F1 ${includeTitle ? 16 : fontSize} Tf`)
    // Title
    let y = pageH - marginTop
    if (includeTitle) {
      cmds.push(`${marginLeft} ${y} Td`)
      cmds.push(`(${esc(titleLines[0])}) Tj`)
      y -= (includeTitle ? 2*lineHeight : lineHeight)
      cmds.push(`/F1 ${fontSize} Tf`)
    }
    // Body
    cmds.push(`${marginLeft} ${y} Td`)
    cmds.push(`${lineHeight} TL`)
    for (const l of lines) {
      cmds.push(`(${esc(l)}) Tj`)
      cmds.push('T*')
    }
    cmds.push('ET')
    return cmds.join('\n')
  }

  let first = true
  while (idx < wrappedLines.length) {
    const take = Math.min(linesPerPage, wrappedLines.length - idx)
    const chunk = wrappedLines.slice(idx, idx + take)
    idx += take
    const content = makeContent(chunk, first)
    makePage(content, nextId++, nextId++)
    first = false
  }

  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageIds.length} >>\nendobj\n`
  objs[pagesIndex] = enc(pagesObj)

  // Write objects to parts, track offsets
  for (const o of objs) pushObj(o)

  const xrefStart = len
  let xrefStr = 'xref\n'
  xrefStr += `0 ${objs.length + 1}\n`
  xrefStr += '0000000000 65535 f \n'
  for (const off of objOffsets) xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`
  xrefStr += 'trailer\n'
  xrefStr += `<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  pushRaw(enc(xrefStr))

  const total = parts.reduce((acc, b) => acc + b.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const b of parts) { out.set(b, pos); pos += b.length }
  return new Blob([out], { type: 'application/pdf' })
}

