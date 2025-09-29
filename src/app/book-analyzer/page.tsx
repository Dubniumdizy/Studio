"use client";

import { useEffect, useState, useTransition } from "react";
import { analyzeBook, type AnalyzeBookOutput } from "@/ai/flows/book-analyzer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveAnalyzerToBankButton } from "@/components/analyzer/SaveAnalyzerToBankButton";
import { FileUp, Loader2, Wand2, X, BookOpen } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function BookAnalyzerPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalyzeBookOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Load analysis from BANK if ?bankFileId=<id>
  useEffect(() => {
    try {
      const id = searchParams?.get('bankFileId');
      if (!id) return;
      const raw = localStorage.getItem('bankData');
      if (!raw) return;
      const bank = JSON.parse(raw);
      const findById = (items: any[]): any | null => {
        for (const it of items) {
          if (it.id === id) return it;
          if (it.type === 'folder' && it.items) {
            const r = findById(it.items);
            if (r) return r;
          }
        }
        return null;
      };
      const file = findById(bank);
      if (!file) return;
      const text = typeof file.content === 'string' ? file.content : '';
      if (!text) return;
      const parsed = JSON.parse(text);
      const a = parsed?.data || parsed;
      if (a && typeof a === 'object' && (a.summary || a.problemSolvingGuides)) {
        setAnalysis(a as AnalyzeBookOutput);
      }
    } catch (e) {
      console.warn('Failed to load book analysis from BANK JSON', e);
    }
  }, [searchParams]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeAt = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAnalysis(null);
    if (files.length === 0) {
      setError("Please upload 1–10 pages (PDF or images).");
      return;
    }

    startTransition(async () => {
      try {
        const readFiles = files.slice(0, 10).map((file) =>
          new Promise<{ name: string; dataUri: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ name: file.name, dataUri: reader.result as string });
            reader.onerror = (err) => reject(err);
          })
        );
        const pages = await Promise.all(readFiles);
        const result = await analyzeBook({ pages });
        setAnalysis(result);
      } catch (e) {
        console.error(e);
        setError("Failed to analyze the files. Please try again.");
      }
    });
  };

  return (
    <div>
      <PageHeader title="Book Analyzer" description="Upload a couple of textbook pages (a chapter max). Get a study-ready summary, definitions/theorems/proofs, problem-solving steps, figures/graphs ideas, and practice advice." />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5"/>Upload Pages</CardTitle>
          <CardDescription>PDF or images are supported. Keep it to a few pages for best results.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAnalyze} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bookFiles">Pages</Label>
              <div className="relative">
                <Input id="bookFiles" name="bookFiles" type="file" accept=".pdf,image/*" multiple onChange={handleFiles} className="pl-12" />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FileUp className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files</Label>
                <div className="space-y-2 rounded-md border p-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-1 bg-muted/50 rounded-md">
                      <span className="truncate pr-2">{file.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAt(idx)} title="Remove">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" disabled={isPending || files.length === 0} className="w-full">
              {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>) : (<><Wand2 className="mr-2 h-4 w-4" />Analyze {files.length > 0 ? files.length : ''} {files.length === 1 ? 'File' : 'Files'}</>)}
            </Button>
          </form>

          {error && (
            <div className="mt-4 text-destructive text-sm font-medium">{error}</div>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <div className="mt-8" id="book-analysis-output">
          <div className="flex justify-end mb-4">
            {/* Export the rendered content to BANK as a PDF snapshot */}
            <SaveAnalyzerToBankButton targetElementId="book-analysis-output" defaultTitle="Book Analysis" analysis={analysis} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground whitespace-pre-wrap">{analysis.summary}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Short Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground whitespace-pre-wrap">{analysis.shortExamples}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Definitions / Theorems / Proofs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.concepts.length === 0 && (
                  <div className="text-sm text-muted-foreground">No concepts extracted.</div>
                )}
                {analysis.concepts.map((c, i) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="text-sm font-semibold">{c.type}: {c.name}</div>
                    <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.statement}</div>
                    {c.proofOutline && (
                      <div className="text-xs mt-2">
                        <div className="font-medium">Proof outline</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">{c.proofOutline}</div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pictures and Graphs</CardTitle>
                <CardDescription>Diagrams that would help; includes optional tiny ASCII sketches.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.figures.length === 0 && (
                  <div className="text-sm text-muted-foreground">No figures suggested.</div>
                )}
                {analysis.figures.map((f, i) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{f.description}</div>
                    {f.ascii && (
                      <pre className="mt-2 text-xs bg-muted/50 p-2 rounded whitespace-pre">{f.ascii}</pre>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>How to Solve Problems</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                {analysis.problemSolvingGuides.length === 0 && (
                  <div className="text-sm text-muted-foreground">No guides extracted.</div>
                )}
                {analysis.problemSolvingGuides.map((g, i) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="text-sm font-semibold mb-2">{g.problemType}</div>
                    <ol className="list-decimal ml-5 space-y-1 text-sm">
                      {g.steps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ol>
                    {g.miniExample && (
                      <div className="text-xs mt-2 text-muted-foreground whitespace-pre-wrap">{g.miniExample}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Practice Advice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground whitespace-pre-wrap">{analysis.practiceAdvice}</div>
              </CardContent>
            </Card>

            {analysis.keyTerms && analysis.keyTerms.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Key Terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {analysis.keyTerms.map((t, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-muted">{t}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

