
"use client";

import { getStudyBuddyRecommendations, StudyBuddyOutput } from "@/ai/flows/study-buddy-recommendations";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, Sparkles, Target, Clock, Star, Download } from "lucide-react";
import { useState, useTransition, useEffect } from "react";

const loadingMessages = [
  "Analyzing your study goals and challenges...",
  "Consulting my knowledge base for tailored advice...",
  "Crafting personalized study techniques...",
  "Structuring your plan for physical, intellectual, and emotional well-being...",
  "Putting the finishing touches on your plan...",
];

export default function StudyBuddyPage() {
  const [isPending, startTransition] = useTransition();
  const [recommendations, setRecommendations] = useState<StudyBuddyOutput | null>(null);
  const { toast } = useToast();
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [progress, setProgress] = useState(0);

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
    const input = {
      studyTopic: formData.get("studyTopic") as string,
      studyGoals: formData.get("studyGoals") as string,
      currentIssue: formData.get("currentIssue") as string,
    };

    if (!input.studyTopic || !input.studyGoals) {
      toast({
        title: "Missing Information",
        description: "Please fill out topic and goals to get the best advice.",
        variant: "destructive",
      });
      return;
    }
    
    setRecommendations(null);
    startTransition(async () => {
      const result = await getStudyBuddyRecommendations(input);
      if (result) {
        setRecommendations(result);
      } else {
        toast({
          title: "Error",
          description: "Could not get recommendations. Please try again.",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleDownload = () => {
    if (!recommendations) return;

    const content = `AI Study Buddy Plan
===================

Study Techniques
----------------
${recommendations.studyTechniques}

Time Management Strategies
--------------------------
${recommendations.timeManagementStrategies}

Additional Advice
-----------------
${recommendations.additionalAdvice.replace(/\*\*(.*?)\*\*/g, '$1')}
    `;
    
    const blob = new Blob([content.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-plan.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (
    <div>
      <PageHeader
        title="AI Study Buddy"
        description="Get personalized advice and recommendations to supercharge your studies."
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
                  <Label htmlFor="studyTopic">Study Topic</Label>
                  <Input id="studyTopic" name="studyTopic" placeholder="e.g., Quantum Physics" required/>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="studyGoals">Study Goals</Label>
                  <Textarea id="studyGoals" name="studyGoals" placeholder="e.g., Pass my final exam, build a project" required/>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currentIssue">What's your current struggle?</Label>
                  <Textarea id="currentIssue" name="currentIssue" placeholder="e.g., I have ADHD and struggle with motivation, or I'm afraid of burning out..." />
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Getting Advice...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Get Study Plan</>
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
                <h3 className="mt-4 text-lg font-semibold">Ready for your personalized plan?</h3>
                <p className="text-muted-foreground text-sm">Fill out the form to get started!</p>
            </Card>
          )}
          {recommendations && (
            <Card>
              <CardHeader>
                <CardTitle>Here's Your Personalized Study Plan!</CardTitle>
                <CardDescription>Follow these suggestions to achieve your goals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><Target className="text-primary"/>Study Techniques</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{recommendations.studyTechniques}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><Clock className="text-primary"/>Time Management</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{recommendations.timeManagementStrategies}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><Star className="text-primary"/>Additional Advice</h4>
                   <div 
                     className="text-muted-foreground whitespace-pre-wrap"
                     dangerouslySetInnerHTML={{ __html: recommendations.additionalAdvice.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground/90">$1</strong>') }} 
                   />
                </div>
              </CardContent>
              <CardFooter>
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download as .txt
                  </Button>
              </CardFooter>
            </Card>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
