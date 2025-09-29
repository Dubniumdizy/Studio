"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { saveExamAnalysisToBankAsPDF } from "@/lib/bank-export"

export function SaveExamAnalysisButton({
  getTitle,
  getHtml,
  getText,
  onSaved,
}: {
  getTitle?: () => string
  getHtml?: () => string
  getText?: () => string
  onSaved?: (fileId: string) => void
}) {
  const handleClick = async () => {
    const title = getTitle ? getTitle() : `Exam Analysis - ${new Date().toLocaleDateString()}`
    const html = getHtml ? getHtml() : undefined
    const plainText = getText ? getText() : undefined
    const file = await saveExamAnalysisToBankAsPDF({ title, html, plainText })
    if (onSaved) onSaved(file.id)
  }

  return (
    <Button size="sm" onClick={handleClick}>
      Save to BANK (PDF)
    </Button>
  )
}

