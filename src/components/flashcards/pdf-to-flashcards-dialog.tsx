"use client"

import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
} from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import {
  extractTextFromPDF,
  generateFlashcardsFromText,
  validatePDFFile,
  type ExtractedPDFData
} from '@/lib/pdf-text-extraction'
import type { Flashcard } from '@/lib/flashcard-data'

interface PDFToFlashcardsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCreateDeck: (deckData: {
    name: string
    description: string
    subject: string
    cards: Flashcard[]
  }) => Promise<void>
  createLoading: boolean
}

type Step = 'upload' | 'processing' | 'review' | 'creating'

export function PDFToFlashcardsDialog({
  isOpen,
  onOpenChange,
  onCreateDeck,
  createLoading
}: PDFToFlashcardsDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // PDF processing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedPDFData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Generated flashcards state
  const [generatedCards, setGeneratedCards] = useState<{ front: string; back: string }[]>([])
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  
  // Deck creation state
  const [deckName, setDeckName] = useState('')
  const [deckDescription, setDeckDescription] = useState('')
  const [deckSubject, setDeckSubject] = useState('')
  const [maxCards, setMaxCards] = useState(15)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const resetState = () => {
    setStep('upload')
    setProgress(0)
    setError(null)
    setSelectedFile(null)
    setExtractedData(null)
    setIsProcessing(false)
    setGeneratedCards([])
    setEditingCardIndex(null)
    setExpandedCards(new Set())
    setDeckName('')
    setDeckDescription('')
    setDeckSubject('')
    setMaxCards(15)
    setDifficulty('medium')
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validation = validatePDFFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Invalid file')
      return
    }

    setSelectedFile(file)
    setError(null)
    setDeckName(file.name.replace('.pdf', ''))
  }

  const handleProcessPDF = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError(null)
    setStep('processing')
    setProgress(10)

    try {
      // Extract text from PDF
      setProgress(30)
      const extracted = await extractTextFromPDF(selectedFile)
      setExtractedData(extracted)
      setProgress(50)

      if (!extracted.fullText.trim()) {
        throw new Error('No text content found in the PDF. The PDF might contain only images or be corrupted.')
      }

      // Generate flashcards from text
      setProgress(70)
      const cards = await generateFlashcardsFromText(extracted.fullText, {
        maxCards,
        subject: deckSubject || 'General',
        difficulty
      })
      
      setProgress(90)
      setGeneratedCards(cards)
      
      // Set default values if not set
      if (!deckName) setDeckName(extracted.title || selectedFile.name.replace('.pdf', ''))
      if (!deckDescription) {
        const preview = extracted.fullText.slice(0, 150).trim()
        setDeckDescription(`Flashcards generated from ${extracted.title || 'PDF'}: ${preview}...`)
      }
      
      setProgress(100)
      setStep('review')
      
      toast({
        title: "PDF Processed Successfully",
        description: `Generated ${cards.length} flashcards from ${extracted.totalPages} pages.`
      })
      
    } catch (err) {
      console.error('PDF processing error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process PDF')
      setStep('upload')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateDeck = async () => {
    if (!generatedCards.length || !deckName.trim()) return

    setStep('creating')

    try {
      const cards: Flashcard[] = generatedCards.map((card, index) => ({
        id: `card-${Date.now()}-${index}`,
        front: card.front,
        back: card.back
      }))

      await onCreateDeck({
        name: deckName.trim(),
        description: deckDescription.trim() || 'Generated from PDF',
        subject: deckSubject || 'General',
        cards
      })

      toast({
        title: "Deck Created Successfully",
        description: `Created "${deckName}" with ${cards.length} flashcards.`
      })

      onOpenChange(false)
      resetState()
    } catch (err) {
      console.error('Deck creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create deck')
      setStep('review')
    }
  }

  const updateCard = (index: number, front: string, back: string) => {
    setGeneratedCards(prev => prev.map((card, i) => 
      i === index ? { front, back } : card
    ))
    setEditingCardIndex(null)
  }

  const deleteCard = (index: number) => {
    setGeneratedCards(prev => prev.filter((_, i) => i !== index))
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      newSet.delete(index)
      return newSet
    })
  }

  const toggleCardExpansion = (index: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Upload PDF Document</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Upload a PDF file to automatically generate flashcards from its content
        </p>
        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            The system will extract text from your PDF and automatically generate relevant flashcards. 
            Works best with text-based PDFs (not scanned images).
          </AlertDescription>
        </Alert>
      </div>

      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
        <div className="text-center">
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="lg"
            className="mb-4"
          >
            <FileText className="mr-2 h-5 w-5" />
            Choose PDF File
          </Button>
          <p className="text-sm text-muted-foreground">
            Or drag and drop a PDF file here
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Maximum file size: 50MB
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {selectedFile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxCards">Max Cards</Label>
          <Select value={maxCards.toString()} onValueChange={(value) => setMaxCards(parseInt(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 cards</SelectItem>
              <SelectItem value="15">15 cards</SelectItem>
              <SelectItem value="20">20 cards</SelectItem>
              <SelectItem value="30">30 cards</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select value={difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="subject">Subject (optional)</Label>
        <Input
          id="subject"
          value={deckSubject}
          onChange={(e) => setDeckSubject(e.target.value)}
          placeholder="e.g., Biology, History, Mathematics"
        />
      </div>
    </div>
  )

  const renderProcessingStep = () => (
    <div className="space-y-6 text-center">
      <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
      <div>
        <h3 className="text-lg font-semibold mb-2">Processing PDF...</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Extracting text and generating flashcards
        </p>
        <Progress value={progress} className="w-full" />
        <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="deckName">Deck Name</Label>
          <Input
            id="deckName"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Enter deck name"
          />
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={deckSubject}
            onChange={(e) => setDeckSubject(e.target.value)}
            placeholder="e.g., Biology"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={deckDescription}
          onChange={(e) => setDeckDescription(e.target.value)}
          placeholder="Enter deck description"
          rows={2}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Generated Flashcards</h3>
        <Badge variant="secondary">{generatedCards.length} cards</Badge>
      </div>

      {extractedData && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Processed {extractedData.totalPages} pages from "{extractedData.title}"
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="h-80">
        <div className="space-y-3">
          {generatedCards.map((card, index) => (
            <Card key={index} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Card {index + 1}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCardExpansion(index)}
                    >
                      {expandedCards.has(index) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCardIndex(index)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCard(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {editingCardIndex === index ? (
                  <EditCardForm
                    front={card.front}
                    back={card.back}
                    onSave={(front, back) => updateCard(index, front, back)}
                    onCancel={() => setEditingCardIndex(null)}
                  />
                ) : (
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Question:</p>
                      <p className="text-sm">{card.front}</p>
                    </div>
                    {expandedCards.has(index) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Answer:</p>
                        <p className="text-sm">{card.back}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Flashcards from PDF</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'upload' && renderUploadStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'creating' && (
            <div className="text-center py-8">
              <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Creating deck...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {step === 'upload' && (
            <Button 
              onClick={handleProcessPDF} 
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Generate Flashcards'
              )}
            </Button>
          )}
          
          {step === 'review' && (
            <Button 
              onClick={handleCreateDeck}
              disabled={createLoading || !deckName.trim() || !generatedCards.length}
            >
              {createLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create Deck (${generatedCards.length} cards)`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EditCardFormProps {
  front: string
  back: string
  onSave: (front: string, back: string) => void
  onCancel: () => void
}

function EditCardForm({ front, back, onSave, onCancel }: EditCardFormProps) {
  const [editFront, setEditFront] = useState(front)
  const [editBack, setEditBack] = useState(back)

  const handleSave = () => {
    if (editFront.trim() && editBack.trim()) {
      onSave(editFront.trim(), editBack.trim())
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="editFront">Question</Label>
        <Textarea
          id="editFront"
          value={editFront}
          onChange={(e) => setEditFront(e.target.value)}
          rows={2}
        />
      </div>
      <div>
        <Label htmlFor="editBack">Answer</Label>
        <Textarea
          id="editBack"
          value={editBack}
          onChange={(e) => setEditBack(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}