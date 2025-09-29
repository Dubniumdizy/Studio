
"use client";

import { recommendResources, RecommendResourcesOutput } from "@/ai/flows/resource-recommendation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Wand2, BookOpen, PlusSquare } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useRouter } from 'next/navigation';
import { saveResourcesJsonToBank } from "@/lib/bank-export";

function AIRecommender() {
  const [isPending, startTransition] = useTransition();
  const [recommendations, setRecommendations] = useState<RecommendResourcesOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Load from BANK if a JSON resources file id is provided
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
        fetch(item.url).then(r => r.text()).then(t => {
          try {
            const parsed = JSON.parse(t);
            if (parsed?.type === 'resources' && parsed?.data) {
              setRecommendations(parsed.data as RecommendResourcesOutput);
            } else if (parsed?.recommendedResources && parsed?.reasoning) {
              setRecommendations(parsed as RecommendResourcesOutput);
            }
          } catch {}
        }).catch(()=>{});
        return;
      }
      if (json) {
        if (json?.type === 'resources' && json?.data) {
          setRecommendations(json.data as RecommendResourcesOutput);
        } else if (json?.recommendedResources && json?.reasoning) {
          setRecommendations(json as RecommendResourcesOutput);
        }
      }
    } catch {}
  }, [searchParams]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const subjectMaterial = formData.get("subjectMaterial") as string;
    if (!subjectMaterial.trim()) {
      setError("Please enter a topic to get recommendations.");
      return;
    }
    setError(null);
    setRecommendations(null);

    startTransition(async () => {
      try {
        const result = await recommendResources({ subjectMaterial });
        if (result) setRecommendations(result);
        else setError("Could not get recommendations.");
      } catch (e) {
        setError("Failed to get recommendations. The AI might be having trouble finding suitable resources.");
        console.error(e);
      }
    });
  }
  
  const handleAddToBank = (resource: string) => {
    // This is a mock implementation. In a real app, this would
    // add the resource to the user's Bank data.
    toast({
      title: "Added to Bank (mock)",
      description: `Resource "${resource}" was saved.`
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input name="subjectMaterial" placeholder="Enter a topic, e.g., 'Quantum Mechanics'" />
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {recommendations && (
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>{recommendations.reasoning}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.recommendedResources.map((res, i) => (
               <div key={i} className="flex items-center gap-2 p-2 pr-1 bg-muted/50 rounded-lg group">
                <div className="flex-shrink-0">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <p className="flex-1 text-sm font-medium text-foreground truncate">{res}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => handleAddToBank(res)}>
                  <PlusSquare className="h-5 w-5" />
                </Button>
               </div>
            ))}
            <div className="pt-2">
              <Button onClick={async()=>{
                if (!recommendations) return
                const f = await saveResourcesJsonToBank({
                  recommendedResources: recommendations.recommendedResources ?? [],
                  reasoning: recommendations.reasoning ?? ''
                })
                router.push(`/bank?open=${encodeURIComponent(f.id)}`)
              }}>Save as JSON to Bank</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ResourcesPage() {
  return (
    <div>
      <PageHeader 
        title="AI Recommended Resources"
        description="Find external resources like articles, videos, and tutorials tailored to your study topic."
      />
      
      <Card>
         <CardHeader>
            <CardTitle>AI Resource Finder</CardTitle>
            <CardDescription>Enter a topic to get AI-powered recommendations.</CardDescription>
         </CardHeader>
         <CardContent>
            <AIRecommender />
         </CardContent>
      </Card>
    </div>
  )
}
