
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
import { Bot, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition, useEffect } from "react";

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
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [progress, setProgress] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);

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

    if (!query.trim() && !imageFile) {
      toast({
        title: "Provide a question or image",
        description: "Type your question or attach an image with the problem.",
        variant: "destructive",
      });
      return;
    }
    
    setRecommendations(null);
    startTransition(async () => {
      let imageDataUri: string | undefined
      if (imageFile) {
        try {
          imageDataUri = await compressImageFileToDataUrl(imageFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.85, mime: 'image/jpeg' })
        } catch {
          try {
            imageDataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = (e) => reject(e)
              reader.readAsDataURL(imageFile!)
            })
          } catch {}
        }
      }
      const attempt = async (tries: number): Promise<StudyBuddyOutput | null> => {
        try {
          return await getStudyBuddyRecommendations({ query, imageDataUri });
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
  


  return (
    <div>
      <PageHeader
        title="Math/Study Buddy"
        description="Ask a question and/or attach an image of the problem to get a step-by-step LaTeX solution."
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
                  <Textarea id="query" name="query" placeholder="Describe the problem. Use $...$ or $$...$$ for math. You can also attach an image below." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="questionImage">Optional: attach an image (problem/notes)</Label>
                  <Input id="questionImage" name="questionImage" type="file" accept="image/*" onChange={(e)=> setImageFile(e.target.files?.[0] || null)} />
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
                <p className="text-muted-foreground text-sm">Describe it or attach an image, then press Solve.</p>
            </Card>
          )}
          {recommendations && (
            <Card>
              <CardHeader>
                <CardTitle>Solution</CardTitle>
                <CardDescription>Step-by-step answer with LaTeX and prerequisites.</CardDescription>
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
