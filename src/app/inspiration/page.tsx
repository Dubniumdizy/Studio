"use client";

import { generateInspiration, InspirationOutput } from "@/ai/flows/inspiration-generator";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Lightbulb, Rocket, Landmark, Wrench } from "lucide-react";
import { useRef, useState, useTransition, useEffect } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { saveInspirationJsonToBank } from "@/lib/bank-export";

function mdToHtml(md: string): string {
  // Minimal markdown -> HTML (headings, bold, italics, lists)
  let html = md
    .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>');
  // Lists
  html = html.replace(/^(?:- |\* )(.*(?:\n(?:- |\* ).*)*)/gm, (m) => {
    const items = m.split(/\n/).map(l=>l.replace(/^(?:- |\* )/, '')).map(t=>`<li>${t}</li>`).join('')
    return `<ul>${items}</ul>`
  })
  // Bold and italics
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
             .replace(/\*(.+?)\*/g, '<em>$1</em>')
             .replace(/\n\n/g, '<br/><br/>')
  return html
}

async function elementToJpegDataUrl(el: HTMLElement, scale = 2): Promise<{dataUrl: string, width: number, height: number}> {
  const rect = el.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)
  const svg = `<?xml version="1.0" standalone="no"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:white;">${el.outerHTML}</div></foreignObject></svg>`
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  const img = new Image()
  const dataUrl: string = await new Promise((resolve) => {
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(width * scale))
      canvas.height = Math.max(1, Math.floor(height * scale))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const out = canvas.toDataURL('image/jpeg', 0.92)
      URL.revokeObjectURL(url)
      resolve(out)
    }
    img.src = url
  }) as string
  return { dataUrl, width: Math.floor(width*scale), height: Math.floor(height*scale) }
}

function jpegDataUrlToPdf(dataUrl: string, w: number, h: number): Blob {
  // Create simple 1-page PDF embedding the JPEG at 72dpi using /DCTDecode
  const header = '%PDF-1.4\n'
  const objects: string[] = []
  const add = (s:string)=>objects.push(s)
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  add(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`)
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj`)
  // Image object
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const len = bin.length
  // Assemble stream with binary via Latin-1
  let imgStream = ''
  for (let i=0;i<len;i++){ imgStream += String.fromCharCode(bin.charCodeAt(i)) }
  const imgObjHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${len} >>\nstream\n`
  const imgObjFooter = '\nendstream\nendobj'
  // Content to draw image full-page
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
  add(imgObjHeader)
  // placeholder; we'll join later with binary
  // Add content object
  add(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`)
  // Build PDF with manual offsets
  const allStrings: (string|ArrayBuffer)[] = []
  const rec = (s: string | ArrayBuffer) => { allStrings.push(s) }
  rec(objects[0]+'\n');
  rec(objects[1]+'\n');
  rec(objects[2]+'\n');
  rec(imgObjHeader);
  const imgArray = new Uint8Array(len)
  for (let i=0;i<len;i++) imgArray[i] = imgStream.charCodeAt(i)
  rec(imgArray as unknown as ArrayBuffer);
  rec(imgObjFooter+'\n');
  rec(objects[4]+'\n');
  // Build xref table
  let offset = header.length
  const xrefPos: number[] = []
  const body = allStrings.map((s)=>{
    const pos = offset
    const len = (typeof s === 'string') ? (s as string).length : (s as ArrayBuffer).byteLength
    offset += len
    xrefPos.push(pos)
    return s
  })
  const xrefStart = offset
  let xref = 'xref\n0 '+(xrefPos.length+1)+'\n0000000000 65535 f \n'
  xrefPos.forEach(pos=>{ xref += (pos.toString().padStart(10,'0'))+' 00000 n \n' })
  const trailer = `trailer\n<< /Size ${xrefPos.length+1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  const blobParts: (BlobPart)[] = [header, ...body, xref, '\n', trailer]
  return new Blob(blobParts, { type: 'application/pdf' })
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + (cur ? ' ' : '') + w).length > maxChars) {
      if (cur) lines.push(cur)
      if (w.length > maxChars) {
        // hard split long word
        for (let i=0;i<w.length;i+=maxChars) lines.push(w.slice(i, i+maxChars))
        cur = ''
      } else {
        cur = w
      }
    } else {
      cur = cur ? cur + ' ' + w : w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function mdToPlainLines(md: string): string[] {
  // Strip basic markdown and return plain lines, keeping bullets as '- '
  if (!md) return []
  let text = md
    .replace(/^>\s?/gm, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
  const lines: string[] = []
  text.split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*(?:- |\* )(.*)$/)
    if (m) {
      lines.push('- ' + m[1])
    } else if (l.trim() === '') {
      lines.push('')
    } else {
      lines.push(l.trim())
    }
  })
  return lines
}

function createTextPdfFromInspiration(data: InspirationOutput): Blob {
  const lines: string[] = []
  const pushBlank = () => lines.push('')
  lines.push('Inspiration')
  pushBlank()
  lines.push('The Big Picture:')
  mdToPlainLines(data.bigPicture).forEach(l => lines.push(...wrapText(l, 90)))
  pushBlank()
  lines.push('Real World Applications:')
  data.realWorldApplications.forEach(app => {
    mdToPlainLines(app).forEach(l => {
      const pref = l.startsWith('- ') ? l : ('- ' + l)
      wrapText(pref, 90).forEach(x => lines.push(x))
    })
  })
  pushBlank()
  lines.push('Fun Fact:')
  mdToPlainLines(data.funFact).forEach(l => lines.push(...wrapText(l, 90)))
  pushBlank()
  lines.push('Try It Yourself:')
  mdToPlainLines(data.diyProject).forEach(l => lines.push(...wrapText(l, 90)))

  // Multi-page PDF in Helvetica
  const header = '%PDF-1.4\n'
  const objects:string[] = []
  const add = (s:string)=>{ objects.push(s) }

  // Placeholders for Catalog (1), Pages (2)
  add('')
  add('')
  // Font object (3)
  add('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj')
  const fontId = 3

  const pageWidth = 612
  const pageHeight = 792
  const margin = 50
  const lineHeight = 16
  const startYOffset = pageHeight - margin - 36 // leave some top space
  const linesPerPage = Math.floor((startYOffset - margin) / lineHeight)

  const pageIds: number[] = []
  let i = 0
  while (i < lines.length) {
    const chunk = lines.slice(i, i + linesPerPage)
    i += chunk.length
    const contentLines: string[] = []
    contentLines.push('BT /F1 12 Tf 50 742 Td '+lineHeight+' TL')
    chunk.forEach((ln, idx) => {
      const safe = ln.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')
      if (idx===0) contentLines.push(`(${safe}) Tj`)
      else contentLines.push(`T* (${safe}) Tj`)
    })
    contentLines.push('ET')
    const stream = contentLines.join('\n')
    const contentId = objects.length + 1
    add(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`)

    const pageId = objects.length + 1
    add(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`)
    pageIds.push(pageId)
  }

  // Pages object
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>\nendobj`
  // Catalog object
  objects[0] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj'

  // Assemble with xref
  let offset = header.length
  const xrefPos:number[] = []
  const body = objects.map((o)=>{ const pos=offset; const s=o+'\n'; offset+=s.length; xrefPos.push(pos); return s }).join('')
  const xrefStart = offset
  let xref = 'xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'
  xrefPos.forEach(pos=>{ xref += (pos.toString().padStart(10,'0'))+' 00000 n \n' })
  const trailer = `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  const pdfStr = header + body + xref + '\n' + trailer
  return new Blob([pdfStr], { type: 'application/pdf' })
}

export default function InspirationPage() {
  const [isPending, startTransition] = useTransition();
  const [inspiration, setInspiration] = useState<InspirationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Load from BANK if a JSON inspiration file id is provided
  useEffect(() => {
    try {
      const id = searchParams?.get('bankFileId');
      if (!id) return;
      const raw = localStorage.getItem('bankData');
      const bank = raw ? JSON.parse(raw) : [];
      const findById = (items: any[], target: string): any | null => {
        for (const it of items) {
          if (it.id === target) return it;
          if (it.type === 'folder' && it.items) {
            const res = findById(it.items, target);
            if (res) return res;
          }
        }
        return null;
      };
      const item = findById(bank, id);
      if (!item || item.type !== 'file') return;
      let json: any = null;
      if (typeof item.content === 'string') {
        try { json = JSON.parse(item.content); } catch {}
      }
      if (!json && typeof item.url === 'string' && item.url) {
        // Attempt fetch if a URL exists
        fetch(item.url).then(r => r.text()).then(t => {
          try {
            const parsed = JSON.parse(t);
            if (parsed?.type === 'inspiration' && parsed?.data) {
              setInspiration(parsed.data as InspirationOutput);
            } else if (parsed?.bigPicture && parsed?.realWorldApplications) {
              setInspiration(parsed as InspirationOutput);
            }
          } catch {}
        }).catch(()=>{});
        return;
      }
      if (json) {
        if (json?.type === 'inspiration' && json?.data) {
          setInspiration(json.data as InspirationOutput);
        } else if (json?.bigPicture && json?.realWorldApplications) {
          setInspiration(json as InspirationOutput);
        }
      }
    } catch {}
  }, [searchParams]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const subject = formData.get("subject") as string;
    const courseMaterials = formData.get("courseMaterials") as string;

    if (!subject.trim() || !courseMaterials.trim()) {
      setError("Please provide both a subject and some course material context.");
      return;
    }
    setError(null);
    setInspiration(null);
    
    startTransition(async () => {
      const result = await generateInspiration({ subject, courseMaterials });
      if (result) {
        setInspiration(result);
      } else {
        setError("Could not generate inspiration. Please try again.");
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Inspiration Generator"
        description="Find new motivation by connecting your studies to the bigger picture."
      />

      {/* Show either the input form or the full-width answer, not both */}
      {!inspiration ? (
        <div className="max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Find Your Spark</CardTitle>
              <CardDescription>
                Enter your subject and some context from your course materials (e.g., topics, chapter names, key concepts).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" placeholder="e.g., Linear Algebra" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseMaterials">Course Materials Context</Label>
                  <Textarea 
                    id="courseMaterials"
                    name="courseMaterials"
                    placeholder="e.g., Vectors, matrices, eigenvalues, determinants, vector spaces..."
                    className="min-h-[150px]"
                  />
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="mr-2 h-4 w-4" /> Generate Inspiration</>
                  )}
                </Button>
                {error && <p className="text-destructive">{error}</p>}
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6" id="inspiration-answer-root">
          {isPending && (
            <Card className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Brewing some inspiration...</p>
            </Card>
          )}
          <Card id="inspiration-answer" className="prose prose-sm md:prose lg:prose-lg max-w-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-full bg-accent/50 text-accent-foreground/80"><Lightbulb className="h-6 w-6"/></div>
                The Big Picture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(inspiration.bigPicture) }} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-full bg-accent/50 text-accent-foreground/80"><Rocket className="h-6 w-6"/></div>
                Real World Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 list-disc list-outside pl-5 text-muted-foreground">
                {inspiration.realWorldApplications.map((app, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: mdToHtml(app) }} />
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-full bg-accent/50 text-accent-foreground/80"><Landmark className="h-6 w-6"/></div>
                Fun Fact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(inspiration.funFact) }} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-full bg-accent/50 text-accent-foreground/80"><Wrench className="h-6 w-6"/></div>
                Try It Yourself
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(inspiration.diyProject) }} />
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>setInspiration(null)}>Back to prompt</Button>
            <Button onClick={async()=>{
              if (!inspiration) return
              const f = await saveInspirationJsonToBank({
                bigPicture: inspiration.bigPicture ?? '',
                realWorldApplications: inspiration.realWorldApplications ?? [],
                funFact: inspiration.funFact ?? '',
                diyProject: inspiration.diyProject ?? ''
              })
              router.push(`/bank?open=${encodeURIComponent(f.id)}`)
            }}>Save as JSON to Bank</Button>
          </div>
        </div>
      )}
    </div>
  );
}
