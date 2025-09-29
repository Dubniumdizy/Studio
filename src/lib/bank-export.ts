import { mockBankData, updateBankData, addFileToRoot, type FileOrFolder } from '@/lib/bank-data'
import { generateSimplePdf, htmlToText, generateJpegPdf, generateJpegMultiPagePdf, generateTextMultiPagePdf, generateAnalysisReportPdf } from '@/lib/pdf-utils'
import { captureElementToJpeg } from '@/lib/dom-capture'
import { supabase } from '@/lib/supabaseClient'

function readBankFromStorage(): FileOrFolder[] {
  if (typeof window === 'undefined') return [...mockBankData]
  try {
    const raw = localStorage.getItem('bankData')
    if (raw) return JSON.parse(raw)
  } catch {}
  return [...mockBankData]
}

function writeBankToStorage(files: FileOrFolder[]) {
  updateBankData(files)
  let saved = false
  try {
    localStorage.setItem('bankData', JSON.stringify(files))
    saved = true
  } catch {}
  if (!saved) {
    // Fallback: drop large inline contents to fit quota
    try {
      const shrink = (items: FileOrFolder[]): FileOrFolder[] => items.map(it => {
        const copy: FileOrFolder = { ...it }
        if (copy.items) copy.items = shrink(copy.items)
        if (typeof copy.content === 'string' && copy.content.startsWith('data:') && copy.content.length > 100_000) {
          delete (copy as any).content
        }
        if (typeof (copy as any).url === 'string' && (copy as any).url.startsWith('data:') && (copy as any).url.length > 100_000) {
          delete (copy as any).url
        }
        return copy
      })
      const minimized = shrink([...files])
      localStorage.setItem('bankData', JSON.stringify(minimized))
      saved = true
    } catch {}
  }
  try {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('bank-updates')
        bc.postMessage({ type: 'bankDataUpdated', payload: files })
        bc.close()
      }
      window.dispatchEvent(new CustomEvent('bankDataUpdated', { detail: files }))
    }
  } catch {}
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function hasSupabaseStorage(): boolean {
  try {
    // @ts-ignore
    return !!(supabase as any)?.storage?.from
  } catch { return false }
}

async function uploadPdfToSupabase(name: string, blob: Blob): Promise<string | undefined> {
  try {
    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user?.id
    if (!uid) return undefined
    if (!hasSupabaseStorage()) return undefined
    const fileName = `${uid}/${Date.now()}-${name.replace(/\s+/g, '_')}`
    // @ts-ignore
    const { error: upErr } = await (supabase as any).storage.from('bank').upload(fileName, blob, { upsert: true, contentType: 'application/pdf' })
    if (upErr) return undefined
    // @ts-ignore
    const { data: urlData } = (supabase as any).storage.from('bank').getPublicUrl(fileName)
    return urlData?.publicUrl
  } catch {
    return undefined
  }
}

export async function savePdfToBank(name: string, blob: Blob): Promise<FileOrFolder> {
  const id = `file-${Date.now()}`
  let dataUrl: string | undefined

  // If the PDF is large, prefer uploading to Supabase to avoid localStorage quota
  const approxSize = blob.size // use blob size directly to avoid expensive base64 conversion
  let url: string | undefined = undefined
  let content: string | undefined = undefined

  if (approxSize > 4_000_000) {
    // Try upload first
    url = await uploadPdfToSupabase(name, blob)
    // If upload failed, fallback to dataUrl (may be large; last resort)
    if (!url && typeof window !== 'undefined') {
      try { dataUrl = await blobToDataURL(blob); content = dataUrl } catch {}
    }
  } else {
    // small enough: keep as data URL (avoid duplicating in both content and url)
    if (typeof window !== 'undefined') {
      try { dataUrl = await blobToDataURL(blob); content = dataUrl } catch {}
    }
  }

  const newFile: FileOrFolder = {
    id,
    name,
    type: 'file',
    url,
    mime: 'application/pdf',
    content,
  }

  const bank = readBankFromStorage()
  const next = (function addUnderHome(items: FileOrFolder[]): FileOrFolder[] {
    const copy = JSON.parse(JSON.stringify(items)) as FileOrFolder[]
    const home = copy.find(i => i.id === 'home' && i.type === 'folder')
    if (home) {
      home.items = home.items ? [...home.items, newFile] : [newFile]
      return copy
    }
    return addFileToRoot(copy, newFile)
  })(bank)
  writeBankToStorage(next)
  return newFile
}

// Save plain text into BANK as a .txt file (and optionally upload to Supabase Storage if very large)
export async function saveTextToBank(name: string, text: string): Promise<FileOrFolder> {
  const id = `file-${Date.now()}`
  // Store small text directly in local BANK content; if it's huge, we can optionally upload later
  let url: string | undefined
  let content: string | undefined = text

  // If the text is extremely large, consider uploading as a text file to Supabase storage
  if (typeof text === 'string' && text.length > 1_000_000 && hasSupabaseStorage()) {
    try {
      const blob = new Blob([text], { type: 'text/plain' })
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user?.id || 'anonymous'
      // @ts-ignore
      const fileName = `${uid}/${Date.now()}-${name.replace(/\s+/g, '_')}`
      // @ts-ignore
      const { error: upErr } = await (supabase as any).storage.from('bank').upload(fileName, blob, { upsert: true, contentType: 'text/plain' })
      if (!upErr) {
        // @ts-ignore
        const { data: urlData } = (supabase as any).storage.from('bank').getPublicUrl(fileName)
        url = urlData?.publicUrl
        // avoid duplicating huge text in localStorage
        content = undefined
      }
    } catch {}
  }

  const newFile: FileOrFolder = {
    id,
    name,
    type: 'file',
    url,
    mime: 'text/plain',
    content,
  }

  const bank = readBankFromStorage()
  const next = (function addUnderHome(items: FileOrFolder[]): FileOrFolder[] {
    const copy = JSON.parse(JSON.stringify(items)) as FileOrFolder[]
    const home = copy.find(i => i.id === 'home' && i.type === 'folder')
    if (home) {
      home.items = home.items ? [...home.items, newFile] : [newFile]
      return copy
    }
    return addFileToRoot(copy, newFile)
  })(bank)
  writeBankToStorage(next)
  return newFile
}

// Format the structured analysis into a readable plain text document
export function formatAnalysisAsText(analysis: {
  commonThemes: string;
  keywords: string;
  questionTypes: string;
  hardQuestionTrends: string;
  keyConcepts: { name: string; type: string; occurrences: number }[];
  adviceForPassing: string;
  adviceForTopScore: string;
  questionTopicMap: { topic: string; questions: string[] }[];
}, title?: string): string {
  const lines: string[] = []
  const t = title || 'Exam Analysis'
  const sep = (s: string) => { lines.push(''); lines.push(s); lines.push('-'.repeat(Math.max(6, s.length))); }
  lines.push(t)
  lines.push('')
  sep('Common Themes')
  lines.push(analysis.commonThemes || '—')
  sep('Keywords')
  lines.push(analysis.keywords || '—')
  sep('Question Types')
  lines.push(analysis.questionTypes || '—')
  sep('Hard Question Trends')
  lines.push(analysis.hardQuestionTrends || '—')
  sep('Advice for Passing')
  lines.push(analysis.adviceForPassing || '—')
  sep('Advice for Top Score')
  lines.push(analysis.adviceForTopScore || '—')
  sep('Key Concepts (Concept | Type | Occurrences)')
  for (const kc of (analysis.keyConcepts || [])) {
    lines.push(`${kc.name} | ${kc.type} | ${kc.occurrences}`)
  }
  sep('Question Topic Map')
  for (const item of (analysis.questionTopicMap || [])) {
    // Use ASCII dash to avoid encoding issues in PDFs/text
    lines.push(`- ${item.topic}`)
    for (const q of (item.questions || [])) lines.push(`  - ${q}`)
  }
  lines.push('')
  return lines.join('\n')
}

// Insert the analysis into a Supabase table for persistence
export async function saveAnalysisToSupabaseTable(params: {
  title: string;
  analysis: any;
  text: string;
}): Promise<string | undefined> {
  try {
    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user?.id
    if (!uid) return undefined
    // Store into a dedicated table; ensure it exists in your database.
    const { data, error } = await (supabase as any).from('exam_analyses').insert({
      user_id: uid,
      title: params.title,
      analysis: params.analysis,
      text: params.text,
      created_at: new Date().toISOString(),
    }).select('id').single()
    if (error) return undefined
    return data?.id as string | undefined
  } catch {
    return undefined
  }
}

// High-level helper: save structured analysis as text to BANK and insert into Supabase table
export async function saveAnalysisTextToBankAndDb(analysis: {
  commonThemes: string;
  keywords: string;
  questionTypes: string;
  hardQuestionTrends: string;
  keyConcepts: { name: string; type: string; occurrences: number }[];
  adviceForPassing: string;
  adviceForTopScore: string;
  questionTopicMap: { topic: string; questions: string[] }[];
}, title?: string): Promise<{ file: FileOrFolder; dbId?: string }> {
  const t = title || `Exam Analysis - ${new Date().toLocaleDateString()}`
  const text = formatAnalysisAsText(analysis, t)
  const file = await saveTextToBank(`${t}.txt`, text)
  // Try to insert into Supabase table (non-fatal if it fails or user is offline)
  const dbId = await saveAnalysisToSupabaseTable({ title: t, analysis, text })
  return { file, dbId }
}

// Save a simple text-based PDF (no complex table drawing), matching the text representation
export async function saveAnalysisTextPdfToBank(analysis: {
  commonThemes: string;
  keywords: string;
  questionTypes: string;
  hardQuestionTrends: string;
  keyConcepts: { name: string; type: string; occurrences: number }[];
  adviceForPassing: string;
  adviceForTopScore: string;
  questionTopicMap: { topic: string; questions: string[] }[];
}, title?: string) {
  const t = title || `Exam Analysis - ${new Date().toLocaleDateString()}`
  const text = formatAnalysisAsText(analysis, t)
  const lines = text.split(/\r?\n/)
  const pdfBlob = generateTextMultiPagePdf(t, lines)
  return await savePdfToBank(`${t}.pdf`, pdfBlob)
}

// Save an element's innerText to BANK as a .txt (fallback for non-AI content)
export async function saveElementTextToBank(element: HTMLElement, title?: string) {
  const t = title || `Export - ${new Date().toLocaleDateString()}`
  const getText = () => {
    try { return (element as HTMLElement).innerText || '' } catch { return element.textContent || '' }
  }
  const text = getText()
  return await saveTextToBank(`${t}.txt`, text)
}

export async function saveExamAnalysisToBankAsPDF(params: { title?: string; html?: string; plainText?: string; elementId?: string }) {
  const title = params.title || `Exam Analysis - ${new Date().toLocaleDateString()}`
  // Prefer DOM capture if element exists (fidelity)
  if (params.elementId) {
    const el = document.getElementById(params.elementId)
    if (el) {
      return await saveElementAsPdfToBank(el, title)
    }
  }
  // Fallback: multipage text PDF to ensure all text fits
  const lines = params.plainText ? params.plainText.split(/\r?\n/) : htmlToText(params.html || '')
  const pdfBlob = generateTextMultiPagePdf(title, lines)
  return await savePdfToBank(`${title}.pdf`, pdfBlob)
}

export async function saveAnalysisPdfToBank(analysis: {
  commonThemes: string;
  keywords: string;
  questionTypes: string;
  hardQuestionTrends: string;
  keyConcepts: { name: string; type: string; occurrences: number }[];
  adviceForPassing: string;
  adviceForTopScore: string;
  questionTopicMap: { topic: string; questions: string[] }[];
}, title?: string) {
  const t = title || `Exam Analysis - ${new Date().toLocaleDateString()}`
  const pdfBlob = generateAnalysisReportPdf(analysis, { title: t })
  return await savePdfToBank(`${t}.pdf`, pdfBlob)
}

// Generic: save JSON object to BANK
export async function saveJsonToBank(name: string, obj: any): Promise<FileOrFolder> {
  const json = JSON.stringify(obj, null, 2)
  const id = `file-${Date.now()}`
  const newFile: FileOrFolder = {
    id,
    name,
    type: 'file',
    mime: 'application/json',
    content: json,
  }
  const bank = readBankFromStorage()
  const next = (function addUnderHome(items: FileOrFolder[]): FileOrFolder[] {
    const copy = JSON.parse(JSON.stringify(items)) as FileOrFolder[]
    const home = copy.find(i => i.id === 'home' && i.type === 'folder')
    if (home) {
      home.items = home.items ? [...home.items, newFile] : [newFile]
      return copy
    }
    return addFileToRoot(copy, newFile)
  })(bank)
  writeBankToStorage(next)
  return newFile
}

// Save structured exam analysis JSON to BANK. Name carries a hint so the Bank can route it.
export async function saveAnalysisJsonToBank(analysis: {
  commonThemes: string;
  keywords: string;
  questionTypes: string;
  hardQuestionTrends: string;
  keyConcepts: { name: string; type: string; occurrences: number }[];
  adviceForPassing: string;
  adviceForTopScore: string;
  questionTopicMap: { topic: string; questions: string[] }[];
}, title?: string) {
  const t = title || `Exam Analysis - ${new Date().toLocaleDateString()}`
  const payload = {
    type: 'exam-analysis',
    version: 1,
    title: t,
    createdAt: new Date().toISOString(),
    data: analysis,
  }
  // Use suffix to make routing easier from Bank
  return await saveJsonToBank(`${t}.analysis.json`, payload)
}

// Save structured book analysis JSON to BANK for Book Analyzer
export async function saveBookAnalysisJsonToBank(data: any, title?: string) {
  const t = title || `Book Analysis - ${new Date().toLocaleDateString()}`
  const payload = {
    type: 'book-analysis',
    version: 1,
    title: t,
    createdAt: new Date().toISOString(),
    data,
  }
  return await saveJsonToBank(`${t}.book.json`, payload)
}

// Save Inspiration output JSON to BANK. Name carries a hint so the Bank can route it back to Inspiration.
export async function saveInspirationJsonToBank(data: { bigPicture: string; realWorldApplications: string[]; funFact: string; diyProject: string }, title?: string) {
  const t = title || `Inspiration - ${new Date().toLocaleDateString()}`
  const payload = {
    type: 'inspiration',
    version: 1,
    title: t,
    createdAt: new Date().toISOString(),
    data,
  }
  return await saveJsonToBank(`${t}.inspiration.json`, payload)
}

// Save Resources recommendation JSON to BANK.
export async function saveResourcesJsonToBank(data: { recommendedResources: string[]; reasoning: string }, title?: string) {
  const t = title || `Resources - ${new Date().toLocaleDateString()}`
  const payload = {
    type: 'resources',
    version: 1,
    title: t,
    createdAt: new Date().toISOString(),
    data,
  }
  return await saveJsonToBank(`${t}.resources.json`, payload)
}

export async function saveElementAsPdfToBank(element: HTMLElement, title?: string) {
  const t = title || `Export - ${new Date().toLocaleDateString()}`

  // Allow larger files (we'll upload to Supabase) if the user is logged in
  let allowLarge = false
  try {
    const { data: sess } = await supabase.auth.getSession()
    // Only allow large if user is logged in AND Supabase storage is available
    allowLarge = !!sess.session?.user?.id && hasSupabaseStorage()
  } catch {}

  const attempts = [
    { scale: 2.0, quality: 0.95 },
    { scale: 1.6, quality: 0.9 },
    { scale: 1.3, quality: 0.85 },
    { scale: 1.1, quality: 0.8 },
    { scale: 1.0, quality: 0.75 },
  ]
  let lastError: any = null
  for (const a of attempts) {
    try {
      const { dataUrl, pixelWidth, pixelHeight } = await captureElementToJpeg(element, { scale: a.scale, background: '#ffffff', quality: a.quality })

      // Decide single-page vs multi-page based on rendered height
      const pageW = 595, pageH = 842, margin = 10, pxToPt = 72/96
      const imgWpt0 = pixelWidth * pxToPt
      const maxWpt = pageW - 2*margin
      const scaleToFit = Math.min(maxWpt / imgWpt0, 1)
      const maxHpt = pageH - 2*margin
      const displayedHpt = pixelHeight * pxToPt * scaleToFit

      let pdfBlob: Blob
      if (displayedHpt <= maxHpt) {
        pdfBlob = generateJpegPdf(dataUrl, pixelWidth, pixelHeight)
      } else {
        pdfBlob = await generateJpegMultiPagePdf(dataUrl, pixelWidth, pixelHeight, { margin, pageW, pageH, quality: a.quality })
      }

      // If not logged in, try to keep under ~4MB for localStorage persistence
      if (!allowLarge && pdfBlob.size > 4_000_000) {
        continue
      }
      return await savePdfToBank(`${t}.pdf`, pdfBlob)
    } catch (e) {
      lastError = e
    }
  }

  // Hard fallback: pure text multi-page PDF to guarantee success
  try {
    const getText = () => {
      try { return (element as HTMLElement).innerText || '' } catch { return element.textContent || '' }
    }
    const lines = htmlToText((element as HTMLElement).outerHTML || getText())
    const textPdf = generateTextMultiPagePdf(t, lines)
    return await savePdfToBank(`${t}.pdf`, textPdf)
  } catch {}

  // If the fallback also fails, throw last error
  throw lastError || new Error('Failed to render PDF')
}

