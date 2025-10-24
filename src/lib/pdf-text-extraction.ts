// PDF text extraction using FileReader and basic PDF parsing
// This approach avoids webpack conflicts while still extracting real text

export interface PDFTextContent {
  pageNumber: number
  text: string
}

export interface ExtractedPDFData {
  title?: string
  totalPages: number
  pages: PDFTextContent[]
  fullText: string
}

/**
 * Extract text content from a PDF file using basic PDF parsing
 */
export async function extractTextFromPDF(file: File): Promise<ExtractedPDFData> {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing is only available in the browser')
  }

  try {
    // Read the PDF file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Extract text using basic PDF parsing
    const extractedText = await extractTextFromPDFBuffer(uint8Array)
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No readable text found in the PDF. The PDF might contain only images or be password protected.')
    }
    
    // Split into pages (basic heuristic)
    const pages: PDFTextContent[] = [
      {
        pageNumber: 1,
        text: extractedText
      }
    ]
    
    // Extract title from first line or filename
    const firstLine = extractedText.split('\n')[0]?.trim()
    const title = (firstLine && firstLine.length < 100 && firstLine.length > 3) 
      ? firstLine 
      : file.name.replace('.pdf', '')
    
    return {
      title,
      totalPages: 1,
      pages,
      fullText: extractedText
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract text from PDF buffer using basic PDF parsing
 */
async function extractTextFromPDFBuffer(buffer: Uint8Array): Promise<string> {
  try {
    // Try multiple decoding approaches
    const decodingAttempts = [
      () => new TextDecoder('utf-8').decode(buffer),
      () => new TextDecoder('latin1').decode(buffer),
      () => new TextDecoder('ascii').decode(buffer),
      () => new TextDecoder('utf-16').decode(buffer)
    ]
    
    let bestResult = ''
    let bestScore = 0
    
    for (const decoder of decodingAttempts) {
      try {
        const pdfString = decoder()
        const result = extractTextFromPDFString(pdfString)
        const score = calculateTextQuality(result)
        
        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }
      } catch (error) {
        // Continue with next decoder
        continue
      }
    }
    
    // Validate the result quality
    if (bestScore < 0.1 || bestResult.length < 10) {
      throw new Error('Unable to extract readable text from this PDF. The PDF may be image-based, compressed, or encrypted.')
    }
    
    return bestResult
  } catch (error) {
    console.error('Error parsing PDF buffer:', error)
    throw error
  }
}

function extractTextFromPDFString(pdfString: string): string {
  const textContent: string[] = []
  
  // Method 1: Look for uncompressed text objects
  const textObjectRegex = new RegExp('BT[\\s\\S]*?ET', 'g')
  let textObjectMatch
  
  while ((textObjectMatch = textObjectRegex.exec(pdfString)) !== null) {
    const textObject = textObjectMatch[0]
    
    // Extract text from various PDF text operators
    const patterns = [
      new RegExp('\\(([^)]{3,})\\)\\s*Tj', 'g'),
      new RegExp('\\(([^)]{3,})\\)\\s*TJ', 'g'),
      new RegExp('\\[([^\\]]+)\\]\\s*TJ', 'g')
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(textObject)) !== null) {
        const text = match[1]
        if (text) {
          const decoded = decodePDFText(text)
          if (isReadableText(decoded)) {
            textContent.push(decoded)
          }
        }
      }
    }
  }
  
  // Method 2: Look for direct text patterns
  if (textContent.length === 0) {
    const directTextRegex = new RegExp('\\(([A-Za-z][A-Za-z0-9\\s.,!?;:()-]{5,})\\)', 'g')
    let directMatch
    
    while ((directMatch = directTextRegex.exec(pdfString)) !== null) {
      const text = directMatch[1]
      if (isReadableText(text)) {
        textContent.push(text)
      }
    }
  }
  
  // Method 3: Look for readable text anywhere in the PDF
  if (textContent.length === 0) {
    const readableTextRegex = new RegExp('[A-Z][a-z]+(?:\\s+[A-Za-z]+){2,}', 'g')
    let readableMatch
    
    while ((readableMatch = readableTextRegex.exec(pdfString)) !== null) {
      const text = readableMatch[0]
      if (text.length > 10 && text.length < 200) {
        textContent.push(text)
      }
    }
  }
  
  // Clean and join the extracted text
  const fullText = textContent
    .filter(text => text && text.length > 2)
    .map(text => text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  return fullText
}

function isReadableText(text: string): boolean {
  if (!text || text.length < 3) return false
  
  // Check for reasonable character distribution
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length
  const totalCount = text.length
  const alphaRatio = alphaCount / totalCount
  
  // Should be at least 50% alphabetic characters
  return alphaRatio > 0.5 && alphaCount > 5
}

function calculateTextQuality(text: string): number {
  if (!text) return 0
  
  let score = 0
  
  // Length bonus (but not too long to avoid binary data)
  if (text.length > 50 && text.length < 10000) {
    score += 0.3
  }
  
  // Alphabetic character ratio
  const alphaCount = (text.match(/[a-zA-Z]/g) || []).length
  const alphaRatio = alphaCount / text.length
  score += alphaRatio * 0.4
  
  // Word count (spaces indicate word separation)
  const wordCount = (text.match(/\s+/g) || []).length
  if (wordCount > 5) {
    score += 0.2
  }
  
  // Common English patterns
  const commonWords = /\b(the|and|of|to|a|in|is|it|you|that|he|was|for|on|are|as|with)\b/gi
  const commonMatches = (text.match(commonWords) || []).length
  if (commonMatches > 0) {
    score += 0.1
  }
  
  return score
}

/**
 * Decode basic PDF text encoding
 */
function decodePDFText(encodedText: string): string {
  try {
    // Handle basic PDF text encoding with simple string replacements
    let decoded = encodedText
    
    // Basic escape sequences
    decoded = decoded.split('\\n').join('\n')
    decoded = decoded.split('\\r').join('\r')
    decoded = decoded.split('\\t').join('\t')
    decoded = decoded.split('\\f').join('\f')
    decoded = decoded.split('\\b').join('\b')
    decoded = decoded.split('\\(').join('(')
    decoded = decoded.split('\\)').join(')')
    decoded = decoded.split('\\\\').join('\\')
    
    return decoded
  } catch (error) {
    return encodedText // Return original if decoding fails
  }
}


/**
 * Generate flashcards from extracted PDF text using AI
 */
export async function generateFlashcardsFromText(text: string, options?: {
  maxCards?: number
  subject?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}): Promise<{ front: string; back: string }[]> {
  const { maxCards = 20, subject = 'General', difficulty = 'medium' } = options || {}
  
  if (!text || text.trim().length < 20) {
    throw new Error('Not enough text content to generate flashcards. Please upload a PDF with more readable text.')
  }
  
  const flashcards: { front: string; back: string }[] = []
  
  // Clean and normalize the text
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:()-]/g, '')
    .trim()
  
  if (cleanText.length < 50) {
    throw new Error('The extracted text is too short or contains mostly unreadable characters. Please try a different PDF.')
  }
  
  // Split text into sentences and paragraphs for analysis
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 15)
  const words = cleanText.split(/\s+/).filter(w => w.length > 2)
  
  if (sentences.length < 3) {
    throw new Error('Unable to identify enough sentences in the text to create meaningful flashcards.')
  }
  
  // Generate definition-style cards from key terms
  const keyTerms = extractKeyTerms(cleanText)
  for (const term of keyTerms.slice(0, Math.min(keyTerms.length, Math.floor(maxCards * 0.6)))) {
    const definition = findDefinition(cleanText, term.term)
    if (definition && definition.length > 10) {
      flashcards.push({
        front: `What is ${term.term}?`,
        back: definition
      })
    }
  }
  
  // Generate question-answer pairs from sentences
  const sentenceCards = generateSentenceBasedCards(sentences, Math.floor(maxCards * 0.4))
  flashcards.push(...sentenceCards)
  
  // Generate fill-in-the-blank cards if we need more
  if (flashcards.length < maxCards / 2) {
    const fillInCards = generateFillInTheBlankCards(sentences, maxCards - flashcards.length)
    flashcards.push(...fillInCards)
  }
  
  if (flashcards.length === 0) {
    throw new Error('Unable to generate flashcards from this content. The text may be too technical or fragmented.')
  }
  
  return flashcards.slice(0, maxCards)
}

interface KeyTerm {
  term: string
  frequency: number
  context: string
}

/**
 * Extract key terms from text (simple implementation)
 */
function extractKeyTerms(text: string): KeyTerm[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
  
  const frequency: Record<string, number> = {}
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1
  })
  
  // Find terms that appear multiple times but not too commonly
  const terms = Object.entries(frequency)
    .filter(([word, freq]) => freq >= 2 && freq <= 10)
    .map(([word, freq]) => ({
      term: word.charAt(0).toUpperCase() + word.slice(1),
      frequency: freq,
      context: ''
    }))
    .sort((a, b) => b.frequency - a.frequency)
  
  return terms.slice(0, 15)
}

/**
 * Find definition or description for a term in the text
 */
function findDefinition(text: string, term: string): string | null {
  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  
  // Look for patterns like "X is...", "X refers to...", "X means..."
  const patterns = [
    new RegExp(`${lowerTerm}\\s+is\\s+([^.!?]{10,200})[.!?]`, 'i'),
    new RegExp(`${lowerTerm}\\s+refers\\s+to\\s+([^.!?]{10,200})[.!?]`, 'i'),
    new RegExp(`${lowerTerm}\\s+means\\s+([^.!?]{10,200})[.!?]`, 'i'),
    new RegExp(`${lowerTerm}[:\\-\\s]+([^.!?]{10,200})[.!?]`, 'i')
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Fallback: find sentence containing the term
  const sentences = text.split(/[.!?]+/)
  const sentence = sentences.find(s => 
    s.toLowerCase().includes(lowerTerm) && 
    s.trim().length > 20 && 
    s.trim().length < 300
  )
  
  return sentence ? sentence.trim() : null
}

/**
 * Generate question-answer pairs from sentences
 */
function generateSentenceBasedCards(sentences: string[], maxCards: number): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = []
  
  for (const sentence of sentences.slice(0, maxCards * 2)) {
    const cleanSentence = sentence.trim()
    if (cleanSentence.length < 20 || cleanSentence.length > 200) continue
    
    // Try to create a question from the sentence
    const question = createQuestionFromStatement(cleanSentence)
    if (question && question !== cleanSentence) {
      cards.push({
        front: question,
        back: cleanSentence
      })
      
      if (cards.length >= maxCards) break
    }
  }
  
  return cards
}

/**
 * Generate fill-in-the-blank cards from sentences
 */
function generateFillInTheBlankCards(sentences: string[], maxCards: number): { front: string; back: string }[] {
  const cards: { front: string; back: string }[] = []
  
  for (const sentence of sentences.slice(0, maxCards * 2)) {
    const cleanSentence = sentence.trim()
    if (cleanSentence.length < 30 || cleanSentence.length > 150) continue
    
    const words = cleanSentence.split(' ')
    if (words.length < 6) continue
    
    // Find important words to blank out (longer words, not common words)
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !/^(the|and|that|this|with|from|they|have|been|were|said|what|when|where|will|would|could|should)$/i.test(word)
    )
    
    if (importantWords.length > 0) {
      const wordToBlank = importantWords[Math.floor(Math.random() * importantWords.length)]
      const blankedSentence = cleanSentence.replace(new RegExp(`\\b${wordToBlank}\\b`, 'i'), '______')
      
      if (blankedSentence !== cleanSentence) {
        cards.push({
          front: `Fill in the blank: ${blankedSentence}`,
          back: wordToBlank
        })
        
        if (cards.length >= maxCards) break
      }
    }
  }
  
  return cards
}

/**
 * Convert a statement into a question
 */
function createQuestionFromStatement(statement: string): string | null {
  if (statement.length < 10) return null
  
  // Simple heuristics to create questions
  if (statement.toLowerCase().includes('because') || statement.toLowerCase().includes('due to')) {
    return `Why ${statement.split(/because|due to/i)[0].trim().toLowerCase()}?`
  }
  
  if (statement.toLowerCase().includes('when')) {
    return `When does ${statement.toLowerCase().replace('when', '').trim()}?`
  }
  
  if (statement.toLowerCase().includes('where')) {
    return `Where ${statement.toLowerCase().replace('where', '').trim()}?`
  }
  
  // Default: create "What is..." question
  const firstFewWords = statement.split(' ').slice(0, 5).join(' ')
  return `What is the main point about: "${firstFewWords}..."?`
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected' }
  }
  
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'File must be a PDF' }
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    return { valid: false, error: 'PDF file size must be less than 50MB' }
  }
  
  return { valid: true }
}