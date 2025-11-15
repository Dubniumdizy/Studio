
"use client";

import { getStudyBuddyRecommendations, type StudyBuddyOutput } from "@/ai/flows/study-buddy-recommendations";
import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'
import { compressImageFileToDataUrl } from '@/lib/image-utils'
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, Sparkles, Paperclip, X, Save } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

const loadingMessages = [
  "Scanning your problem...",
  "Parsing math and notation...",
  "Exploring solution paths...",
  "Checking definitions and theorems...",
  "Verifying steps and result...",
];

export default function StudyBuddyPage() {
  const [isPending, startTransition] = useTransition();
  const [recommendations, setRecommendations] = useState<StudyBuddyOutput | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (isPending) {
      // --- Loading Message Cycling ---
      let messageIndex = 0;
      setLoadingMessage(loadingMessages[0]); // Reset to first message
      const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 2500); // Change message every 2.5 seconds

      // --- Progress Bar Simulation ---
      setProgress(0);
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) { // Don't let it hit 100% until done
            clearInterval(progressInterval);
            return prev;
          }
          // Slow down progress as it gets closer to the end
          const increment = prev > 80 ? 1 : prev > 50 ? 2 : 5;
          return prev + increment;
        });
      }, 400);

      return () => {
        clearInterval(messageInterval);
        clearInterval(progressInterval);
      };
    } else {
        setProgress(100);
    }
  }, [isPending]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = (formData.get("query") as string) || '';

    if (!query.trim() && uploadedFiles.length === 0) {
      toast({
        title: "Provide a question or file",
        description: "Type your question or attach files (images, PDFs, documents) with the problem.",
        variant: "destructive",
      });
      return;
    }
    
    setRecommendations(null);
    startTransition(async () => {
      let contextText = query;
      let imageDataUri: string | undefined;
      
      // Process uploaded files
      for (const file of uploadedFiles) {
        const fileType = file.type;
        
        // Handle images
        if (fileType.startsWith('image/')) {
          try {
            imageDataUri = await compressImageFileToDataUrl(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85, mime: 'image/jpeg' });
          } catch {
            try {
              imageDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
              });
            } catch {}
          }
        }
        // Handle PDFs
        else if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/extract-pdf-text', {
              method: 'POST',
              body: formData,
            });
            if (response.ok) {
              const data = await response.json();
              if (data.text) {
                contextText += `\n\n[Content from ${file.name}]:\n${data.text.slice(0, 10000)}`;
              }
            }
          } catch (e) {
            console.error('PDF extraction failed:', e);
          }
        }
        // Handle text files
        else if (fileType.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          try {
            const text = await file.text();
            contextText += `\n\n[Content from ${file.name}]:\n${text.slice(0, 10000)}`;
          } catch (e) {
            console.error('Text file reading failed:', e);
          }
        }
      }
      const attempt = async (tries: number): Promise<StudyBuddyOutput | null> => {
        try {
          return await getStudyBuddyRecommendations({ query: contextText, imageDataUri });
        } catch (e: any) {
          const msg = (e?.message || '').toString()
          if (tries > 0 && (/503|overloaded|Failed to fetch/i.test(msg))) {
            await new Promise(r => setTimeout(r, 800))
            return attempt(tries - 1)
          }
          return null
        }
      }
      const result = await attempt(2)
      if (result) {
        setRecommendations(result)
      } else {
        setRecommendations({ answer: 'The model is currently overloaded. Please retry shortly. Meanwhile, outline your approach: 1) Restate the problem. 2) Identify knowns/unknowns. 3) Choose a method (e.g., differentiate/integrate/row-reduce). 4) Execute carefully with units/assumptions. 5) Verify the result.' })
      }
    });
  };
  
  const handleSaveToBank = () => {
    if (!recommendations) return;
    
    try {
      // Create a JSON file with the answer
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `study-buddy-${timestamp}.json`;
      
      const dataToSave = {
        timestamp: new Date().toISOString(),
        answer: recommendations.answer,
        savedFrom: "Study Buddy"
      };
      
      // Get current bank data from localStorage
      const raw = localStorage.getItem('bankData');
      let bankData = raw ? JSON.parse(raw) : [];
      
      // Find the home folder
      const homeFolder = bankData.find((item: any) => item.id === 'home' && item.type === 'folder');
      
      if (homeFolder) {
        // Create the file object
        const newFile = {
          id: `file-${Date.now()}-${Math.random()}`,
          name: fileName,
          type: 'file',
          mime: 'application/json',
          content: JSON.stringify(dataToSave, null, 2)
        };
        
        // Add to home folder
        homeFolder.items = homeFolder.items || [];
        homeFolder.items.unshift(newFile);
        
        // Save back to localStorage
        localStorage.setItem('bankData', JSON.stringify(bankData));
        
        // Dispatch events to update Bank page if open
        window.dispatchEvent(new CustomEvent('bankDataUpdated', { detail: bankData }));
        try {
          const bc = new BroadcastChannel('bank-updates');
          bc.postMessage({ type: 'bankDataUpdated', payload: bankData });
          bc.close();
        } catch {}
        
        toast({
          title: "Saved to Bank",
          description: `Answer saved as ${fileName} in your Bank/Home folder`,
        });
      } else {
        toast({
          title: "Error",
          description: "Could not find Bank home folder",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to save to bank:', error);
      toast({
        title: "Error",
        description: "Failed to save answer to Bank",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Math/Study Buddy"
        description="Ask a question and attach files (images, PDFs, documents) to get step-by-step solutions and study help."
      />

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Tell me about your studies</CardTitle>
              <CardDescription>The more details you provide, the better my advice will be!</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="query">Your problem/question</Label>
                  <Textarea id="query" name="query" placeholder="Describe the problem. Use $...$ or $$...$$ for math. You can also attach files below (images, PDFs, text documents)." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attachments">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Attach files (images, PDFs, documents)
                    </div>
                  </Label>
                  <Input 
                    id="attachments" 
                    name="attachments" 
                    type="file" 
                    accept="image/*,.pdf,.txt,.md,application/pdf,text/plain" 
                    multiple
                    onChange={(e)=> {
                      const files = Array.from(e.target.files || []);
                      setUploadedFiles(prev => [...prev, ...files]);
                    }} 
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Paperclip className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Solving...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Solve</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-8">
          {isPending && (
            <Card className="flex flex-col items-center justify-center text-center h-96 p-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary"/>
                <p className="mt-4 text-lg font-semibold">Your study buddy is thinking...</p>
                <p className="mt-2 text-sm text-muted-foreground transition-opacity duration-500 h-10">{loadingMessage}</p> 
                 <div className="w-full max-w-sm mt-6">
                    <Progress value={progress} className="w-full" />
                </div>
            </Card>
          )}
          {!isPending && !recommendations && (
            <Card className="flex flex-col items-center justify-center h-96 bg-muted/30 border-dashed">
                <Bot className="h-16 w-16 text-muted-foreground"/>
                <h3 className="mt-4 text-lg font-semibold">Ready to solve a problem?</h3>
                <p className="text-muted-foreground text-sm">Describe it or attach files (images, PDFs, documents), then press Solve.</p>
            </Card>
          )}
          {recommendations && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Solution</CardTitle>
                    <CardDescription>Step-by-step answer with LaTeX and prerequisites.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveToBank}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save to Bank
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="text-muted-foreground whitespace-pre-wrap prose max-w-none">
                    <Latex>{recommendations.answer}</Latex>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
