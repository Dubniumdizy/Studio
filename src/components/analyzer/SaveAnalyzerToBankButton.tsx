"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { saveAnalysisJsonToBank, saveElementAsPdfToBank, saveBookAnalysisJsonToBank } from "@/lib/bank-export"
import { toast } from "@/hooks/use-toast"
import { Loader2, Check, X } from "lucide-react"

export function SaveAnalyzerToBankButton({
  targetElementId,
  defaultTitle,
  onSaved,
  analysis,
}: {
  targetElementId: string
  defaultTitle?: string
  onSaved?: (fileId: string) => void
  analysis?: any | null
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const withTimeout = async <T,>(p: Promise<T>, ms = 20000): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Save timed out')), ms)
      p.then(v => { clearTimeout(t); resolve(v) }).catch(e => { clearTimeout(t); reject(e) })
    })
  }

  const handleClick = async () => {
    if (state === 'saving') return
    const el = document.getElementById(targetElementId)
    const title = defaultTitle || 'Analyzer Export'
    setState('saving')
    try {
      if (analysis) {
        // Save AI output as JSON for easy viewing later
        console.debug('[Save] Using analysis-driven JSON export')
        // Decide type by shape
        if (analysis.summary && analysis.problemSolvingGuides) {
          // Book analyzer shape
          const file = await withTimeout(saveBookAnalysisJsonToBank(analysis, title))
          onSaved?.(file.id)
          setState('success')
          toast({ title: 'Saved', description: `${file.name || title} saved to BANK (JSON).` })
        } else {
          // Exam analyzer shape (normalize keys defensively)
          const normalized = {
            commonThemes: analysis.commonThemes ?? '',
            keywords: analysis.keywords ?? '',
            questionTypes: analysis.questionTypes ?? '',
            hardQuestionTrends: analysis.hardQuestionTrends ?? '',
            keyConcepts: (analysis.keyConcepts || []).map((k: any) => ({
              name: k.name ?? '',
              type: (k as any).type ?? 'Definition',
              occurrences: k.occurrences ?? 0,
            })),
            adviceForPassing: analysis.adviceForPassing ?? '',
            adviceForTopScore: analysis.adviceForTopScore ?? '',
            questionTopicMap: (analysis.questionTopicMap || []).map((it: any) => ({ topic: it.topic ?? '', questions: it.questions ?? [] })),
          }
          const file = await withTimeout(saveAnalysisJsonToBank(normalized, title))
          onSaved?.(file.id)
          setState('success')
          toast({ title: 'Saved', description: `${file.name || title} saved to BANK (JSON).` })
        }
      } else if (el) {
        console.debug('[Save] Using element PDF export')
        const file = await withTimeout(saveElementAsPdfToBank(el, title))
        onSaved?.(file.id)
        setState('success')
        toast({ title: 'Saved to BANK', description: `${file.name || title} saved under Home.` })
      } else {
        // Nothing to export
        throw new Error('Nothing to export')
      }
      // Reset back to idle after a short delay
      setTimeout(() => setState('idle'), 1500)
    } catch (e: any) {
      console.warn('Failed to save Analyzer export', e)
      setState('error')
      toast({ title: 'Save failed', description: e?.message || 'Could not save to BANK.', variant: 'destructive' })
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const renderIcon = () => {
    if (state === 'saving') return <Loader2 className="h-4 w-4 mr-2 animate-spin" />
    if (state === 'success') return <Check className="h-4 w-4 mr-2" />
    if (state === 'error') return <X className="h-4 w-4 mr-2" />
    return null
  }

  return (
    <Button size="sm" onClick={handleClick} variant={state === 'error' ? 'destructive' : 'default'} disabled={state === 'saving'}>
      {renderIcon()}
      {state === 'saving' ? 'Saving…' : state === 'success' ? 'Saved' : state === 'error' ? 'Retry Save' : (analysis ? 'Save to BANK (JSON)' : 'Save to BANK')}
    </Button>
  )
}

