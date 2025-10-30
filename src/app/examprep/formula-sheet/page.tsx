"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Latex from "react-latex-next";
import html2canvas from "html2canvas";
import "katex/dist/katex.min.css";
import { generateJpegMultiPagePdf } from "@/lib/pdf-utils";
import { Download, Upload, FileCode, ChevronLeft, Image as ImageIcon, Palette, X, Move, Crop } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop";

interface ImageElement {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export default function ExamPrepFormulaSheetPage() {
  const [latex, setLatex] = useState<string>(
    "\\section{My Formulas}\n\n" +
    "\\textbf{Important:} Quadratic formula\n" +
    "$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$\n\n" +
    "% This is a comment and won't show up\n\n" +
    "\\textit{Remember:} Always check the discriminant!\n\n" +
    "$\\int_a^bf(x)dx$"
  );
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [images, setImages] = useState<ImageElement[]>([]);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [draggingImage, setDraggingImage] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Calculate number of pages needed based on content
  const calculatePages = (text: string) => {
    const linesPerPage = 60; // Approximate lines per A4 page
    const lines = text.split('\n').length;
    return Math.max(1, Math.ceil(lines / linesPerPage));
  };
  
  const numPages = calculatePages(latex);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("formulaSheet.latex");
      if (saved) setLatex(saved);
      const savedImages = localStorage.getItem("formulaSheet.images");
      if (savedImages) setImages(JSON.parse(savedImages));
      const savedColor = localStorage.getItem("formulaSheet.color");
      if (savedColor) setCurrentColor(savedColor);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("formulaSheet.latex", latex); } catch {}
  }, [latex]);

  useEffect(() => {
    try { localStorage.setItem("formulaSheet.images", JSON.stringify(images)); } catch {}
  }, [images]);

  useEffect(() => {
    try { localStorage.setItem("formulaSheet.color", currentColor); } catch {}
  }, [currentColor]);

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
    if (!previewContainerRef.current) return;
    
    // Get all page elements
    const pageElements = previewContainerRef.current.querySelectorAll('.preview-page');
    console.log('Found page elements for PDF:', pageElements.length);
    if (pageElements.length === 0) return;

    // Wait for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Capture the first page (which has all the content)
    const firstPage = pageElements[0] as HTMLElement;
    console.log('Capturing first page...');
    
    const canvas = await html2canvas(firstPage, { 
      scale: 2, 
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      logging: true,
      onclone: (clonedDoc) => {
        // Ensure images are visible in clone
        const clonedImages = clonedDoc.querySelectorAll('img');
        clonedImages.forEach((img) => {
          img.style.display = 'block';
        });
      },
      ignoreElements: (element) => {
        return element.classList.contains('no-export');
      }
    });
    
    console.log('Canvas size:', canvas.width, 'x', canvas.height);
    
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      console.log('Data URL length:', dataUrl.length);
      console.log('Data URL starts with:', dataUrl.substring(0, 50));
      
      if (!dataUrl || dataUrl.length < 100) {
        console.error('Canvas data URL is too short or empty!');
        alert('Failed to capture page content. Please try again.');
        return;
      }
      
      const blob = await generateJpegMultiPagePdf(dataUrl, canvas.width, canvas.height, { margin: 24 });
      console.log('PDF blob size:', blob.size, 'bytes');
      
      if (blob.size < 1000) {
        console.error('PDF blob is too small!');
        alert('Generated PDF is invalid. Please try again.');
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "formula-sheet.pdf";
      a.click();
      URL.revokeObjectURL(url);
      console.log('PDF download triggered successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF: ' + (error as Error).message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(String(reader.result || ""));
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    e.currentTarget.value = "";
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleCropComplete = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
    const newImage: ImageElement = {
      id: Date.now().toString(),
      url: croppedImage,
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      pageIndex: 0,
    };
    console.log('Adding new image:', newImage);
    setImages([...images, newImage]);
    setCropDialogOpen(false);
    setImageToCrop(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleImageMouseDown = (e: React.MouseEvent, imageId: string, pageElement: HTMLElement) => {
    e.stopPropagation();
    const image = images.find(img => img.id === imageId);
    if (!image) return;
    const pageRect = pageElement.getBoundingClientRect();
    setDraggingImage(imageId);
    setDragOffset({
      x: e.clientX - pageRect.left - image.x,
      y: e.clientY - pageRect.top - image.y,
    });
  };

  const handleDeleteImage = (imageId: string) => {
    setImages(images.filter(img => img.id !== imageId));
  };

  const insertColorSyntax = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = latex.substring(start, end) || "text";
    const colorCommand = `\\textcolor{${currentColor}}{${selectedText}}`;
    const newLatex = latex.substring(0, start) + colorCommand + latex.substring(end);
    setLatex(newLatex);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, start + colorCommand.length);
      }
    }, 0);
  };

  // Handle resizing and image dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftWidth(Math.max(20, Math.min(80, newWidth)));
      }
      if (draggingImage && previewContainerRef.current) {
        // Find the page element for the dragged image
        const draggedImg = images.find(img => img.id === draggingImage);
        if (draggedImg) {
          const pageElements = previewContainerRef.current.querySelectorAll('.preview-page');
          const pageElement = pageElements[draggedImg.pageIndex] as HTMLElement;
          if (pageElement) {
            const pageRect = pageElement.getBoundingClientRect();
            const newX = e.clientX - pageRect.left - dragOffset.x;
            const newY = e.clientY - pageRect.top - dragOffset.y;
            setImages(prevImages =>
              prevImages.map(img =>
                img.id === draggingImage
                  ? { ...img, x: newX, y: newY }
                  : img
              )
            );
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggingImage(null);
    };

    if (isDragging || draggingImage) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, draggingImage, dragOffset, images]);

  // Process latex to handle comments, formatting, and preserve line breaks
  const processedLatex = latex
    .split('\n')
    .map((line) => {
      // Remove comments (everything after % on a line)
      const withoutComments = line.replace(/%.*$/, '');
      if (withoutComments.trim() === '') return ''; // Skip empty lines after comment removal
      
      let processed = withoutComments;
      
      // Handle basic LaTeX commands
      processed = processed.replace(/\\textbf\{([^}]+)\}/g, '**$1**'); // Bold
      processed = processed.replace(/\\textit\{([^}]+)\}/g, '*$1*'); // Italic
      processed = processed.replace(/\\section\*?\{([^}]+)\}/g, '\n## $1\n'); // Section
      processed = processed.replace(/\\subsection\*?\{([^}]+)\}/g, '\n### $1\n'); // Subsection
      processed = processed.replace(/\\underline\{([^}]+)\}/g, '__$1__'); // Underline
      processed = processed.replace(/\\emph\{([^}]+)\}/g, '*$1*'); // Emphasis
      // Keep color commands for parsing later
      // processed = processed (colors handled separately)
      
      return processed;
    })
    .filter(line => line !== '') // Remove empty lines
    .join('\n');

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top toolbar */}
      <div className="flex-shrink-0 border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Formula Sheet Editor</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".tex,text/plain"
              className="hidden"
              onChange={handleLoadTex}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <Palette className="h-4 w-4 mr-2" />
                Color
              </Button>
              {showColorPicker && (
                <div className="absolute top-full mt-2 z-50 bg-card border rounded-lg shadow-lg p-4">
                  <div className="flex flex-col gap-3">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-24 h-10 rounded cursor-pointer"
                    />
                    <div className="flex gap-2">
                      {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(color => (
                        <button
                          key={color}
                          className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color, borderColor: currentColor === color ? '#000' : 'transparent' }}
                          onClick={() => setCurrentColor(color)}
                        />
                      ))}
                    </div>
                    <Button size="sm" onClick={insertColorSyntax}>
                      Apply Color
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Add Image
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import .tex
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadTex}>
              <Download className="h-4 w-4 mr-2" />
              Download .tex
            </Button>
            <Button size="sm" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Split pane editor */}
      <div ref={containerRef} className="flex-1 flex min-h-0 relative">
        {/* Left: Editor */}
        <div className="flex flex-col border-r bg-muted/30" style={{ width: `${leftWidth}%` }}>
          <div className="flex-shrink-0 px-4 py-2 border-b bg-card">
            <p className="text-sm font-medium text-muted-foreground">LaTeX Source</p>
          </div>
          <div className="flex-1 overflow-y-auto py-8 px-12 bg-gray-100">
            {/* A4-sized editor pages */}
            <div className="max-w-4xl mx-auto space-y-8 pb-8">
              {Array.from({ length: numPages }).map((_, pageIndex) => (
                <div
                  key={pageIndex}
                  className="bg-white shadow-2xl border-2 border-gray-300 p-12 relative"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    margin: '0 auto',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {pageIndex === 0 ? (
                    <textarea
                      ref={textareaRef}
                      value={latex}
                      onChange={(e) => setLatex(e.target.value)}
                      className="w-full font-mono text-sm bg-transparent border-0 focus:outline-none focus:ring-0 resize-none"
                      style={{ minHeight: `${numPages * 273}mm` }}
                      placeholder="Type LaTeX here...\n\nUse $...$ for inline math\nUse $$...$$ for display math\n\nPress Enter for new lines"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="text-xs text-gray-400 absolute bottom-4 right-4">
                      Page {pageIndex + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Draggable divider */}
        <div
          className="w-1 bg-border hover:bg-primary cursor-col-resize flex-shrink-0 relative group"
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/20" />
        </div>

        {/* Right: Preview (multi-page) */}
        <div className="flex-1 flex flex-col bg-gray-100" style={{ width: `${100 - leftWidth}%` }}>
          <div className="flex-shrink-0 px-4 py-2 border-b bg-card">
            <p className="text-sm font-medium text-muted-foreground">Live Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto py-8 px-12" ref={previewContainerRef}>
            <div className="max-w-4xl mx-auto space-y-8 pb-8">
              {/* A4-sized pages with visible borders */}
              {Array.from({ length: numPages }).map((_, pageIndex) => {
                const pageElement = typeof document !== 'undefined' ? document.querySelector(`[data-page-index="${pageIndex}"]`) : null;
                return (
                <div
                  key={pageIndex}
                  data-page-index={pageIndex}
                  ref={pageIndex === 0 ? previewRef : null}
                  className="preview-page bg-white shadow-2xl border-2 border-gray-300 p-12 relative overflow-hidden"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    margin: '0 auto',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.15)',
                    position: 'relative',
                  }}
                >
                  {pageIndex === 0 && (
                    <div className="prose prose-sm max-w-none space-y-4" style={{ whiteSpace: 'pre-wrap' }}>
                      {processedLatex.split('\n').map((line, idx) => {
                        // Check if it's a heading
                        if (line.startsWith('## ')) {
                          const text = line.substring(3);
                          return <h2 key={idx} className="text-xl font-bold mt-6 mb-3"><Latex>{text}</Latex></h2>;
                        }
                        if (line.startsWith('### ')) {
                          const text = line.substring(4);
                          return <h3 key={idx} className="text-lg font-semibold mt-4 mb-2"><Latex>{text}</Latex></h3>;
                        }
                        
                        // Check for color commands
                        const colorMatch = line.match(/\\textcolor\{([^}]+)\}\{([^}]+)\}/);
                        if (colorMatch) {
                          const [, color, text] = colorMatch;
                          const before = line.substring(0, line.indexOf(colorMatch[0]));
                          const after = line.substring(line.indexOf(colorMatch[0]) + colorMatch[0].length);
                          return (
                            <div key={idx} className="leading-relaxed">
                              {before && <Latex>{before}</Latex>}
                              <span style={{ color }}><Latex>{text}</Latex></span>
                              {after && <Latex>{after}</Latex>}
                            </div>
                          );
                        }
                        
                        // Process markdown-style bold and italic
                        const parts = [];
                        let remaining = line;
                        let key = 0;
                        
                        // Split by ** for bold
                        const boldParts = remaining.split(/\*\*/);
                        boldParts.forEach((part, i) => {
                          if (i % 2 === 1) {
                            // Odd index = inside **
                            parts.push(<strong key={`${idx}-${key++}`}><Latex>{part}</Latex></strong>);
                          } else {
                            // Even index = outside **
                            // Now split by * for italic
                            const italicParts = part.split(/\*/);
                            italicParts.forEach((ipart, j) => {
                              if (j % 2 === 1) {
                                parts.push(<em key={`${idx}-${key++}`}><Latex>{ipart}</Latex></em>);
                              } else {
                                if (ipart) parts.push(<Latex key={`${idx}-${key++}`}>{ipart}</Latex>);
                              }
                            });
                          }
                        });
                        
                        return <div key={idx} className="leading-relaxed">{parts.length > 0 ? parts : <Latex>{line}</Latex>}</div>;
                      })}
                    </div>
                  )}
                  {/* Render images for this page */}
                  {images
                    .filter(img => img.pageIndex === pageIndex)
                    .map(img => {
                      console.log(`Rendering image ${img.id} at (${img.x}, ${img.y}) on page ${pageIndex}`);
                      return (
                      <div
                        key={img.id}
                        className="absolute group cursor-move"
                        style={{
                          left: `${img.x}px`,
                          top: `${img.y}px`,
                          width: `${img.width}px`,
                          height: `${img.height}px`,
                          position: 'absolute',
                        }}
                        onMouseDown={(e) => {
                          const pageEl = e.currentTarget.closest('.preview-page') as HTMLElement;
                          if (pageEl) handleImageMouseDown(e, img.id, pageEl);
                        }}
                      >
                        <img
                          src={img.url}
                          alt="formula sheet image"
                          className="w-full h-full object-cover rounded border-2 border-gray-300"
                          draggable={false}
                          style={{
                            pointerEvents: 'none',
                          }}
                        />
                        <button
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity no-export"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(img.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity no-export">
                          <Move className="h-3 w-3" />
                        </div>
                      </div>
                    );
                    })}
                  <div className="text-xs text-gray-400 absolute bottom-4 right-4 no-export">
                    Page {pageIndex + 1}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Image Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
          </DialogHeader>
          <div className="relative h-96 bg-gray-100">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Zoom:</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCropDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCropComplete}>
                <Crop className="h-4 w-4 mr-2" />
                Crop & Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
