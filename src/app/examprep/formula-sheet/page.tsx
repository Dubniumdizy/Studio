"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Latex from "react-latex-next";
import html2canvas from "html2canvas";
import "katex/dist/katex.min.css";
import { generateJpegMultiPagePdf } from "@/lib/pdf-utils";
import { Download, Upload, FileText, Eye } from "lucide-react";

export default function ExamPrepFormulaSheetPage() {
  const [latex, setLatex] = useState<string>("% Write LaTeX here. Example:\n% Inline: $E=mc^2$\n% Block: $$\\int_a^b f(x)\\,dx = F(b) - F(a)$$\n% Tip: Keep it minimal for quick scanning during exams.");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("formulaSheet.latex");
      if (saved) setLatex(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("formulaSheet.latex", latex); } catch {}
  }, [latex]);

  const handleDownloadTex = () => {
    const blob = new Blob([latex], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formula-sheet.tex";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadTex = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLatex(String(reader.result || ""));
    reader.readAsText(file);
    e.currentTarget.value = "";
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;
    const node = previewRef.current;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const blob = await generateJpegMultiPagePdf(dataUrl, canvas.width, canvas.height, { margin: 24 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formula-sheet.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Exam Prep • Formula Sheet"
        description="Recommended: make two minimal sheets — one for hard-to-memorize formulas/facts, and one for your common mistakes (pitfalls, sign errors, typical traps). Keep them short and readable."
      />

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>Source (.tex)</CardTitle>
            <CardDescription>Type LaTeX here. Inline math with $...$, display math with $$...$$.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder={"e.g., \\int_a^b f(x)\\,dx = F(b) - F(a)"}
              className="min-h[500px] font-mono text-base"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".tex,text/plain"
                className="hidden"
                onChange={handleLoadTex}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Load .tex
              </Button>
              <Button variant="outline" onClick={handleDownloadTex}>
                <Download className="h-4 w-4" /> Save .tex
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5"/>Preview</CardTitle>
            <CardDescription>Auto-updates as you type. Export as PDF when ready.</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={previewRef} className="min-h-[500px] rounded-md border bg-white p-6 text-base text-foreground">
              <div className="prose max-w-none">
                <Latex>{latex}</Latex>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleDownloadPdf} className="gap-2">
                <Download className="h-4 w-4" /> Save as PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
