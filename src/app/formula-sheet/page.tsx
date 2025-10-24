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

import { useRouter } from "next/navigation";

export default function FormulaSheetPage() {
  const r = useRouter();
  useEffect(() => { try { r.replace('/examprep/formula-sheet') } catch {} }, []);
  const [latex, setLatex] = useState<string>("% Write LaTeX here. Example:\n% Inline: $E=mc^2$\n% Block: $$\\int_a^b f(x)\\,dx = F(b) - F(a)$$\n\\textbf{Notes:} This editor supports LaTeX math via KaTeX.");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("formulaSheet.latex");
      if (saved) setLatex(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("formulaSheet.latex", latex);
    } catch {}
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
    reader.onload = () => {
      const text = String(reader.result || "");
      setLatex(text);
    };
    reader.readAsText(file);
    // reset value so same file can be re-selected
    e.currentTarget.value = "";
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;
    const node = previewRef.current;
    // Make sure background is white for PDF snapshot
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
    <div className="p-6 text-sm text-muted-foreground">
      Redirecting to Exam Prep → Formula Sheet…
    </div>
  );
}
