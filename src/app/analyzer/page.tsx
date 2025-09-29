"use client"

import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SaveAnalyzerToBankButton } from "@/components/analyzer/SaveAnalyzerToBankButton"

export default function AnalyzerPage() {
  const [notes, setNotes] = useState<string>(
    "Write or paste your analyzer output here...\n(This is a placeholder. Replace this with your actual Analyzer content.)"
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analyzer</h1>
        <SaveAnalyzerToBankButton targetElementId="analyzer-output" defaultTitle="Analyzer Export" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Output</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="analyzer-output" className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{notes}</pre>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => setNotes("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

