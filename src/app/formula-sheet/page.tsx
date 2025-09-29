"use client";

import { formulaSheetSuggestions, FormulaSheetSuggestionsOutput } from "@/ai/flows/formula-sheet-suggestions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Loader2, Wand2, FlaskConical, Link } from "lucide-react";
import { useState, useTransition } from "react";

export default function FormulaSheetPage() {
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<FormulaSheetSuggestionsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formula, setFormula] = useState("E = mc^2");

  const handleSubmit = () => {
    if (!formula.trim()) {
      setError("Please enter a formula to get suggestions.");
      return;
    }
    setError(null);
    setSuggestions(null);
    
    startTransition(async () => {
      const result = await formulaSheetSuggestions({ formula });
      if (result) {
        setSuggestions(result);
      } else {
        setError("Could not get suggestions. Please try again.");
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Formula Sheet"
        description="Create your formula sheets with LaTeX support and get AI-powered suggestions."
      />
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Your Formula Sheet</CardTitle>
              <CardDescription>
                Type your formulas, equations, and notes here. LaTeX is supported.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g., \int_a^b f(x) dx = F(b) - F(a)"
                className="min-h-[400px] font-mono text-base"
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="text-primary"/>
                AI Suggestions
              </CardTitle>
              <CardDescription>
                Click the button below to get suggestions for the formula in the editor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSubmit} disabled={isPending} className="w-full">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Get Suggestions
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          
          {error && <p className="text-destructive text-sm">{error}</p>}
          
          {suggestions && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="h-5 w-5"/>Simplifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                    {suggestions.simplificationSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Link className="h-5 w-5"/>Relevant Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                    {suggestions.relevantContent.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
