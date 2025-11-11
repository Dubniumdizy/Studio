"use client";

import type { AnalyzeExamOutput } from "@/ai/flows/exam-analyzer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileUp, Wand2, Key, ListTree, BrainCircuit, X, TrendingUp, BookKey, Medal, Trophy, Map, BarChart3, LineChart as LineIcon, Database } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { Card as UiCard } from "@/components/ui/card";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { SaveAnalyzerToBankButton } from "@/components/analyzer/SaveAnalyzerToBankButton";
import { extractTextFromPDF } from "@/lib/pdf-text-extraction";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'

type CsvRow = {
  date: string
  started_at: string
  ended_at: string
  user_id: string
  subject: string
  subject_id: string
  duration_minutes: number
  duration_seconds: number
  energy_before: number
  goal: string
  exam_soon: string
  reached_goal: string
  happiness: number
  energy_after: number
  breaks: string
  hardness: number
  next_plan: string
  forest_trees: number
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length <= 1) return []
  const headers = lines[0].split(',').map(h=>h.trim())
  const rows: CsvRow[] = []
  for (let i=1;i<lines.length;i++){
    const line = lines[i]
    if (!line) continue
    // Simple CSV parser handling quotes
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (let j=0;j<line.length;j++){
      const ch = line[j]
      if (inQ){
        if (ch === '"'){
          if (j+1 < line.length && line[j+1] === '"'){ cur += '"'; j++ } else { inQ = false }
        } else cur += ch
      } else {
        if (ch === '"') { inQ = true }
        else if (ch === ','){ cells.push(cur); cur = '' }
        else cur += ch
      }
    }
    cells.push(cur)
    const rec: any = {}
    headers.forEach((h, idx)=> rec[h] = (cells[idx] ?? '').trim())
    const toNum = (v: any) => (v === '' || v == null) ? NaN : Number(v)
    rows.push({
      date: rec['date'] || rec['Date'] || '',
      started_at: rec['started_at'] || rec['timestamp_start'] || '',
      ended_at: rec['ended_at'] || rec['timestamp_end'] || '',
      user_id: rec['user_id'] || '',
      subject: (rec['subject'] || '').toString(),
      subject_id: rec['subject_id'] || '',
      duration_minutes: toNum(rec['duration_minutes']) || Math.round((toNum(rec['duration_seconds'])||0)/60),
      duration_seconds: toNum(rec['duration_seconds']) || Math.round((toNum(rec['duration_minutes'])||0)*60),
      energy_before: toNum(rec['energy_before']) || NaN,
      goal: rec['goal'] || '',
      exam_soon: rec['exam_soon'] || '',
      reached_goal: rec['reached_goal'] || rec['reachedGoal'] || '',
      happiness: toNum(rec['happiness']) || NaN,
      energy_after: toNum(rec['energy_after']) || NaN,
      breaks: rec['breaks'] || '',
      hardness: toNum(rec['hardness']) || NaN,
      next_plan: rec['next_plan'] || '',
      forest_trees: toNum(rec['forest_trees']) || 0,
    })
  }
  return rows
}

function mean(vals: number[]) { const arr = vals.filter(v=>Number.isFinite(v)); return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 }
function sum(vals: number[]) { return vals.reduce((a,b)=>a+(Number.isFinite(b)?b:0),0) }
function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length)
  const xs = x.slice(0,n).filter(Number.isFinite)
  const ys = y.slice(0,n).filter((_,i)=>Number.isFinite(x[i]) && Number.isFinite(y[i]))
  const mX = mean(xs)
  const mY = mean(ys)
  const num = xs.reduce((acc, v, i)=> acc + (v - mX) * (y[i] - mY), 0)
  const den = Math.sqrt(xs.reduce((a,v)=>a+(v-mX)**2,0) * ys.reduce((a,v)=>a+(v-mY)**2,0))
  return den ? num/den : 0
}

export default function ExamAnalyzerPage() {
  const [isPending, startTransition] = useTransition();
  const [analysisResult, setAnalysisResult] = useState<AnalyzeExamOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const searchParams = useSearchParams();

  // Study CSV analyzer state
  const [csvText, setCsvText] = useState<string>('')
  const [breakFilter, setBreakFilter] = useState<string>('drink water')

  // Try to auto-load CSV from Bank (Home/study_sessions.csv)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bankData')
      if (!raw) return
      const bank = JSON.parse(raw)
      const home = bank.find((i:any)=>i.id==='home' && i.type==='folder')
      const file = home?.items?.find((it:any)=>it.type==='file' && it.name==='study_sessions.csv')
      if (file?.content) setCsvText(file.content as string)
    } catch {}
  }, [])

  const rows = useMemo(()=> csvText ? parseCSV(csvText) : [], [csvText])

  // Load analysis from BANK if ?bankFileId=<id>
  useEffect(() => {
    try {
      const id = searchParams?.get('bankFileId')
      if (!id) return
      const raw = localStorage.getItem('bankData')
      if (!raw) return
      const bank = JSON.parse(raw)
      const findById = (items: any[]): any | null => {
        for (const it of items) {
          if (it.id === id) return it
          if (it.type === 'folder' && it.items) { const r = findById(it.items); if (r) return r }
        }
        return null
      }
      const file = findById(bank)
      if (!file) return
      const text = typeof file.content === 'string' && file.content.startsWith('data:')
        ? ''
        : (typeof file.content === 'string' ? file.content : '')
      if (!text) return
      const parsed = JSON.parse(text)
      const a = parsed?.data || parsed
      if (a && typeof a === 'object' && a.commonThemes && a.keyConcepts && a.questionTopicMap) {
        setAnalysisResult(a as any)
      }
    } catch (e) {
      console.warn('Failed to load analysis from BANK JSON', e)
    }
  }, [searchParams])
  const rowsThisWeek = useMemo(()=>{
    const now = new Date()
    const day = now.getDay()||7
    const monday = new Date(now); monday.setDate(now.getDate() - (day-1)); monday.setHours(0,0,0,0)
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6); sunday.setHours(23,59,59,999)
    return rows.filter(r=>{ const d = new Date(r.started_at||r.date); return !isNaN(d.getTime()) && d>=monday && d<=sunday })
  }, [rows])

  const energyByHour = useMemo(()=>{
    const buckets: {hour:number; avgEnergy:number; minutes:number}[] = Array.from({length:24}, (_,h)=>({hour:h, avgEnergy:0, minutes:0}))
    const sums = Array(24).fill(0), counts = Array(24).fill(0)
    rows.forEach(r=>{
      const d = new Date(r.started_at||r.date); if (isNaN(d.getTime())) return
      const h = d.getHours()
      if (Number.isFinite(r.energy_before)) { sums[h]+=r.energy_before; counts[h]++ }
      buckets[h].minutes += Number.isFinite(r.duration_minutes)? r.duration_minutes: 0
    })
    buckets.forEach((b, h)=> b.avgEnergy = counts[h] ? sums[h]/counts[h] : 0)
    return buckets
  }, [rows])

  const energyByWeekday = useMemo(()=>{
    const sums = Array(7).fill(0), counts = Array(7).fill(0)
    rows.forEach(r=>{ const d = new Date(r.started_at||r.date); if (isNaN(d.getTime())) return; const wd = d.getDay(); if (Number.isFinite(r.energy_before)){ sums[wd]+=r.energy_before; counts[wd]++ } })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day: name, avgEnergy: counts[idx]? sums[idx]/counts[idx]:0 }))
  }, [rows])

  const meanEnergyForBreak = useMemo(()=>{
    if (!breakFilter.trim()) return 0
    const m = mean(rows.filter(r=> (r.breaks||'').toLowerCase().includes(breakFilter.toLowerCase())).map(r=> r.energy_after))
    return m
  }, [rows, breakFilter])

  const difficultyOverTimePerSubject = useMemo(()=>{
    const map: Record<string, {date: string, hardness: number}[]> = {}
    rows.forEach(r=>{ if (!r.subject) return; const d = new Date(r.started_at||r.date); if (isNaN(d.getTime())) return; const key = r.subject; (map[key]=map[key]||[]).push({date: d.toISOString().slice(0,10), hardness: r.hardness}) })
    const dates = Array.from(new Set(Object.values(map).flat().map(e=>e.date))).sort()
    const series = dates.map(date=>{
      const record:any = { date }
      Object.entries(map).forEach(([sub, arr])=>{ const same = arr.filter(x=>x.date===date).map(x=>x.hardness); record[sub] = mean(same) })
      return record
    })
    return { dates, series, subjects: Object.keys(map) }
  }, [rows])

  const happinessByWeekday = useMemo(()=>{
    const sums = Array(7).fill(0), counts = Array(7).fill(0)
    rows.forEach(r=>{ const d = new Date(r.ended_at||r.date); if (isNaN(d.getTime())) return; const wd = d.getDay(); if (Number.isFinite(r.happiness)){ sums[wd]+=r.happiness; counts[wd]++ } })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day: name, happiness: counts[idx]? sums[idx]/counts[idx]:0 }))
  }, [rows])

  const hoursAndBreaksByWeekday = useMemo(()=>{
    const mins = Array(7).fill(0), breaks = Array(7).fill(0)
    rows.forEach(r=>{ const d = new Date(r.started_at||r.date); if (isNaN(d.getTime())) return; const wd = d.getDay(); mins[wd]+= (Number.isFinite(r.duration_minutes)? r.duration_minutes: 0); const cnt = (r.breaks||'').split(/;|,|\|/).filter(s=>s.trim()).length; breaks[wd]+=cnt })
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name,idx)=>({ day: name, hours: +(mins[idx]/60).toFixed(2), breaks: breaks[idx] }))
  }, [rows])

  const goalRateOverTime = useMemo(()=>{
    const byDate: Record<string, {yes:number,no:number}> = {}
    rows.forEach(r=>{ const d = (r.ended_at||r.date||'').slice(0,10); if(!d) return; const rg = (r.reached_goal||'').toLowerCase().startsWith('y')
      byDate[d] = byDate[d] || {yes:0,no:0}; byDate[d][rg?'yes':'no']++ })
    return Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,val])=>({ date, rate: val.yes/(val.yes+val.no||1) }))
  }, [rows])

  const corr = useMemo(()=>{
    const h = rows.map(r=>r.happiness)
    const p = rows.map(r=> (r.breaks||'').split(/;|,|\|/).filter(s=>s.trim()).length)
    const t = rows.map(r=> r.duration_minutes)
    const g = rows.map(r=> (r.reached_goal||'').toLowerCase().startsWith('y') ? 1 : 0)
    return {
      happiness_vs_breaks: pearson(h,p),
      happiness_vs_time: pearson(h,t),
      happiness_vs_goal: pearson(h,g),
      breaks_vs_time: pearson(p,t),
      time_vs_goal: pearson(t,g),
    }
  }, [rows])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };
  
  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  const extractPdfText = async (file: File): Promise<string | null> => {
    try {
      // Use pdfjs-dist for proper browser-based PDF text extraction
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set up worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      const cleanedText = fullText.trim();
      
      // Filter out PDF metadata/structure keywords
      const hasRealContent = cleanedText.length > 100 && 
        !cleanedText.toLowerCase().includes('endstream') &&
        !cleanedText.toLowerCase().includes('endobj');
      
      if (hasRealContent) {
        return cleanedText;
      }
      
      console.warn('PDF extraction returned metadata instead of content');
      return null;
    } catch (error) {
      console.error('PDF extraction failed:', error);
      return null;
    }
  };

  const analyzeExamViaAPI = async (exams: any[]): Promise<AnalyzeExamOutput> => {
    const response = await fetch('/api/ai/flows/exam-analyzer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exams })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `API error: ${response.status}`);
    }
    
    return response.json();
  };

  const buildLocalAnalysis = (texts: string[], names: string[]): AnalyzeExamOutput => {
    const all = (texts || []).join('\n').toLowerCase();
    const tokens = all.split(/[^a-zA-Z0-9_]+/).filter(t=>t.length>=3);
    const freq: Record<string, number> = {};
    tokens.forEach(t=>{ freq[t]=(freq[t]||0)+1 });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k])=>k);
    const commonThemes = top.slice(0,8).join(', ');
    const keywords = top.join(', ');
    const keyConcepts = top.slice(0,10).map(k=>({ name: k, type: 'Definition' as const, occurrences: freq[k]||1 }));
    return {
      commonThemes: commonThemes || 'No text extracted. Try OCR/exporting text from PDF.',
      keywords: keywords || (names || []).join(', '),
      questionTypes: 'Mixed (estimated).',
      hardQuestionTrends: 'Likely multi-step, conceptual, or proof-heavy near the end.',
      keyConcepts,
      adviceForPassing: 'Focus on the most frequent terms above and practice representative exercises for each.',
      adviceForTopScore: 'Go beyond frequent terms: prove, connect, and generalize the key concepts; practice multi-part problems.',
      questionTopicMap: (top.slice(0,6)).map(t=>({ topic: t, questions: names.map((n,i)=>`${n}, Q${i+1}`) })),
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (files.length === 0) {
      setError("Please select at least one PDF file to analyze.");
      return;
    }
    
    setError(null);
    setAnalysisResult(null);

    startTransition(async () => {
      try {
        // Build exams payload; try to include extracted text when possible
        const localTexts: string[] = [];
        const localNames: string[] = [];
        const exams = await Promise.all(files.map(async (file) => {
          const reader = new FileReader();
          const dataUri: string = await new Promise((resolve, reject) => {
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(e);
          });
          let text = await extractPdfText(file);
          // Prefer sending text; cap to avoid oversized payloads, fall back to dataUri only if no text
          const MAX_TEXT = 60000;
          if (text && text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
          localNames.push(file.name);
          if (text && text.length > 0) {
            localTexts.push(text);
            return { name: file.name, text } as any;
          }
          localTexts.push('');
          return { name: file.name, dataUri } as any;
        }));
        setExtractedTexts(localTexts);
        setFileNames(localNames);

        const result = await analyzeExamViaAPI(exams);
        if (result && (result.commonThemes || '').trim()) {
          setAnalysisResult(result);
        } else {
          // Local fallback analysis
          const fallback = buildLocalAnalysis(localTexts, localNames);
          setAnalysisResult(fallback);
        }
      } catch (e) {
        // Server action failed (offline/too large). Fallback to local keyword-based analysis
        console.error('Exam analysis error:', e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        setError(`AI analysis failed: ${errorMsg}. Using local fallback.`);
        const fallback = buildLocalAnalysis(extractedTexts, fileNames);
        setAnalysisResult(fallback);
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Exam Analyzer"
        description="Upload PDFs to extract patterns, plus see Study CSV stats."
      />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Upload Exam PDFs</CardTitle>
          <CardDescription>
            Select one or more exams. The AI will analyze them together to find patterns and key concepts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="examPdf">Exam Files</Label>
              <div className="relative">
                 <Input 
                   id="examPdf" 
                   name="examPdf" 
                   type="file" 
                   accept=".pdf" 
                   onChange={handleFileChange} 
                   className="pl-12"
                   multiple
                  />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FileUp className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files:</Label>
                <div className="space-y-2 rounded-md border p-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-1 bg-muted/50 rounded-md">
                      <span className="truncate pr-2">{file.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <Button type="submit" disabled={isPending || files.length === 0} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                 <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Analyze {files.length > 0 ? files.length : ''} {files.length === 1 ? 'Exam' : 'Exams'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {error && <Card className="mt-6 border-destructive"><CardContent className="p-4 text-destructive font-medium">{error}</CardContent></Card>}

      {analysisResult && (
        <div className="mt-8" id="analyzer-output">
          <div className="flex justify-end mb-4">
            <SaveAnalyzerToBankButton targetElementId="analyzer-output" defaultTitle="Analyzer Export" analysis={analysisResult} />
          </div>
          <h2 className="text-2xl font-bold text-center mb-6 font-headline">Exam Analysis</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><BrainCircuit className="h-6 w-6"/></div>
                <CardTitle>Common Themes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysisResult.commonThemes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><Key className="h-6 w-6"/></div>
                <CardTitle>Keywords</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysisResult.keywords}</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><ListTree className="h-6 w-6"/></div>
                <CardTitle>Question Types</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysisResult.questionTypes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><TrendingUp className="h-6 w-6"/></div>
                <CardTitle>Hard Question Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysisResult.hardQuestionTrends}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><Medal className="h-6 w-6"/></div>
                <CardTitle>Advice for Passing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.adviceForPassing}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><Trophy className="h-6 w-6"/></div>
                <CardTitle>Advice for a Top Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.adviceForTopScore}</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                 <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><BookKey className="h-6 w-6"/></div>
                <CardTitle>Key Concepts</CardTitle>
              </CardHeader>
              <CardContent>
                 <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Concept</TableHead>
                      <TableHead className="w-1/4">Type</TableHead>
                      <TableHead className="w-1/4 text-right">Occurrences</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisResult.keyConcepts.map((concept, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium whitespace-pre-wrap break-words break-all align-top">{concept.name}</TableCell>
                        <TableCell className="whitespace-pre-wrap break-words break-all align-top">{concept.type}</TableCell>
                        <TableCell className="text-right align-top">{concept.occurrences}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
             <Card className="md:col-span-2">
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                 <div className="p-3 rounded-full bg-accent/50 text-accent-foreground/80"><Map className="h-6 w-6"/></div>
                <CardTitle>Question Topic Map</CardTitle>
              </CardHeader>
              <CardContent>
                 <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Topic</TableHead>
                      <TableHead className="w-2/3">Found In Questions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisResult.questionTopicMap.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium whitespace-pre-wrap break-words break-all align-top">{item.topic}</TableCell>
                        <TableCell className="whitespace-pre-wrap break-words break-all align-top">
                          <ul className="space-y-1">
                            {item.questions.map((q, i) => <li key={i} className="break-words break-all">{q}</li>)}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

    </div>
  );
}
