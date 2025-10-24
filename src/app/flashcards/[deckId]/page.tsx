"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ChevronLeft, RotateCcw, PartyPopper, Home, AlertTriangle, Loader2, CheckCircle2, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { findDeckInFileSystem, mockFlashcardSystem, findAndMutateDecks } from "@/lib/flashcard-data";
import { notFound, useRouter, useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Latex from "react-latex-next";
import 'katex/dist/katex.min.css';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSafeAsync } from "@/hooks/use-safe-async";

type SessionState = 'loading' | 'studying' | 'finished' | 'error';

export default function FlashcardReviewPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { toast } = useToast();
  
  const deck = useMemo(() => {
    try {
      return findDeckInFileSystem(mockFlashcardSystem, deckId);
    } catch (error) {
      console.error('Error finding deck:', error);
      return null;
    }
  }, [deckId]);
  
  const [reviewQueue, setReviewQueue] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [error, setError] = useState<string | null>(null);
  const hasSaved = useRef(false);

  const { loading: saveLoading, execute: executeSave } = useSafeAsync({
    onSuccess: () => {
      toast({
        title: "Progress saved!",
        description: "Your study session has been recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: "Your progress may not have been saved. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!deck) {
      setSessionState('error');
      setError('Deck not found');
      return;
    }

    if (deck.cards.length === 0) {
      setSessionState('error');
      setError('This deck has no cards to study');
      return;
    }

    try {
      const now = new Date();
      // Filter cards that are due for review (nextReview is null or in the past)
      const dueCardIndices = deck.cards
        .map((card, i) => ({ card, index: i }))
        .filter(({ card }) => !card.nextReview || new Date(card.nextReview) <= now)
        .map(({ index }) => index)
        .sort(() => Math.random() - 0.5);
      
      if (dueCardIndices.length === 0) {
        // Check if all cards have been reviewed (have nextReview date)
        const allCardsReviewed = deck.cards.every(card => card.nextReview !== null);
        
        if (allCardsReviewed) {
          // Find the next card due for review
          const nextReviewDate = deck.cards
            .filter(card => card.nextReview)
            .map(card => new Date(card.nextReview!))
            .sort((a, b) => a.getTime() - b.getTime())[0];
          
          setSessionState('error');
          setError(`all-done:${nextReviewDate?.toISOString() || ''}`);
        } else {
          setSessionState('error');
          setError('no-cards');
        }
        return;
      }
      
      setReviewQueue(dueCardIndices);
      setMasteredCount(0);
      setCurrentIndex(0);
      setSessionState('studying');
      setIsFlipped(false);
      setError(null);
    } catch (error) {
      setSessionState('error');
      setError('Failed to initialize study session');
    }
  }, [deck]);

  useEffect(() => {
    if (sessionState === 'finished' && deck && !hasSaved.current) {
      hasSaved.current = true;
      executeSave(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        findAndMutateDecks(mockFlashcardSystem, deckId, (arr, index) => {
          const newArr = [...arr];
          const deckToUpdate = newArr[index] as any;
          if (deckToUpdate.type === 'deck') {
            deckToUpdate.lastStudied = new Date().toISOString();
          }
          return newArr;
        });
        
        return true;
      });
    }
  }, [sessionState, deckId, deck, executeSave]);

  const handleRating = useCallback((rating: 'again' | 'good' | 'easy') => {
    if (!deck || reviewQueue.length === 0) return;

    try {
      const currentCardIndex = reviewQueue[currentIndex];
      const currentCard = deck.cards[currentCardIndex];

      if (reviewQueue.length === 1 && rating === 'again') {
        toast({ 
          title: "Try again!", 
          description: "Let's give this one another shot." 
        });
        setIsFlipped(false);
        return;
      }

      // Update card SRS data
      const now = new Date();
      const nextReviewDate = new Date(now);
      
      if (rating === 'good') {
        nextReviewDate.setDate(now.getDate() + deck.srsGoodInterval);
      } else if (rating === 'easy') {
        nextReviewDate.setDate(now.getDate() + deck.srsEasyInterval);
      }

      // Update the card in the deck's data
      if (rating !== 'again') {
        findAndMutateDecks(mockFlashcardSystem, deck.id, (arr, index) => {
          const newArr = [...arr];
          const deckToUpdate = newArr[index] as any;
          if (deckToUpdate.type === 'deck') {
            const updatedCards = [...deckToUpdate.cards];
            updatedCards[currentCardIndex] = {
              ...updatedCards[currentCardIndex],
              lastReviewed: now.toISOString(),
              nextReview: nextReviewDate.toISOString(),
              difficulty: rating,
            };
            deckToUpdate.cards = updatedCards;
          }
          return newArr;
        });
      }

      if (rating !== 'again') {
        setMasteredCount(prev => prev + 1);
      }
      
      if (reviewQueue.length === 1 && rating !== 'again') {
        setSessionState('finished');
        return;
      }

      if (rating === 'again') {
        setReviewQueue(prev => {
          const newQueue = [...prev];
          const [movedItem] = newQueue.splice(currentIndex, 1);
          newQueue.push(movedItem);
          return newQueue;
        });
      } else {
        setReviewQueue(prev => prev.filter((_, index) => index !== currentIndex));
      }

      setIsFlipped(false);
      
      if (currentIndex >= reviewQueue.length - 1 && rating !== 'again') {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Error handling rating:', error);
      toast({
        title: "Error",
        description: "Failed to process your rating. Please try again.",
        variant: "destructive",
      });
    }
  }, [deck, reviewQueue, currentIndex, toast]);

  const retrySession = useCallback(() => {
    if (!deck) return;
    
    try {
      hasSaved.current = false;
      const initialQueue = deck.cards.map((_, i) => i).sort(() => Math.random() - 0.5);
      setReviewQueue(initialQueue);
      setMasteredCount(0);
      setCurrentIndex(0);
      setSessionState('studying');
      setIsFlipped(false);
      setError(null);
    } catch (error) {
      setSessionState('error');
      setError('Failed to restart study session');
    }
  }, [deck]);

  if (sessionState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full max-w-2xl mx-auto py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin"/>
        <h2 className="mt-6 text-3xl font-bold font-headline">Loading Deck...</h2>
        <p className="text-muted-foreground mt-2">Preparing your study session.</p>
      </div>
    );
  }

  if (sessionState === 'error') {
    // Parse error message
    const isAllDone = error?.startsWith('all-done:');
    const isNoCards = error === 'no-cards';
    const nextReviewDateStr = isAllDone ? error?.split(':')[1] : null;
    const nextReviewDate = nextReviewDateStr ? new Date(nextReviewDateStr) : null;
    
    if (isAllDone && nextReviewDate) {
      const now = new Date();
      const hoursUntilNext = Math.round((nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      const daysUntilNext = Math.round(hoursUntilNext / 24);
      
      return (
        <div className="flex flex-col items-center justify-center text-center h-full max-w-2xl mx-auto py-10">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
          <h2 className="mt-6 text-3xl font-bold font-headline">All Caught Up!</h2>
          <p className="text-muted-foreground mt-2">
            You've completed all cards in this deck for now.
          </p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              Next review: {nextReviewDate.toLocaleDateString()} at {nextReviewDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {daysUntilNext > 0 
                ? `in ${daysUntilNext} ${daysUntilNext === 1 ? 'day' : 'days'}` 
                : hoursUntilNext > 0
                ? `in ${hoursUntilNext} ${hoursUntilNext === 1 ? 'hour' : 'hours'}`
                : 'very soon'}
            </p>
          </div>
          <div className="mt-8 flex gap-4">
            <Button onClick={() => router.push('/flashcards')}>
              <Home className="mr-2 h-4 w-4" />
              Back to Decks
            </Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center text-center h-full max-w-2xl mx-auto py-10">
        <AlertTriangle className="w-16 h-16 text-red-500" />
        <h2 className="mt-6 text-3xl font-bold font-headline">Oops!</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          {isNoCards ? 'This deck has no cards to study' : error || 'Something went wrong'}
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.push('/flashcards')}>
            <Home className="mr-2 h-4 w-4" />
            Back to Decks
          </Button>
        </div>
      </div>
    );
  }

  if (!deck) {
    notFound();
  }

  const totalInitialCards = deck.cards.length;
  const progress = totalInitialCards > 0 ? (masteredCount / totalInitialCards) * 100 : 0;
  const currentCardIndex = reviewQueue[currentIndex];
  const currentCard = currentCardIndex !== undefined ? deck.cards[currentCardIndex] : null;

  if (sessionState === 'finished') {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full max-w-2xl mx-auto py-10">
        <PartyPopper className="w-16 h-16 text-primary" />
        <h2 className="mt-6 text-3xl font-bold font-headline">Congratulations!</h2>
        <p className="mt-2 text-muted-foreground">
          You've completed the "{deck.name}" deck for this session.
        </p>
        {saveLoading && (
          <Alert className="mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Saving your progress...</AlertDescription>
          </Alert>
        )}
        <div className="mt-8 flex gap-4">
          <Button onClick={() => router.push('/flashcards')}>
            <Home className="mr-2" /> Back to Decks
          </Button>
          <Button variant="outline" onClick={retrySession}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Study Again
          </Button>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full max-w-2xl mx-auto py-10">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <h2 className="mt-6 text-3xl font-bold font-headline">No Cards Available</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          There are no cards available for review in this session.
        </p>
        <Button onClick={() => router.push('/flashcards')}>
          <Home className="mr-2 h-4 w-4" />
          Back to Decks
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0">
        <Link href="/flashcards" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 inline-flex items-center gap-2")}>
          <ChevronLeft className="h-4 w-4" />
          All Decks
        </Link>
        <PageHeader 
          title={deck.name}
          description={`Card ${masteredCount + 1} of ${totalInitialCards}. Remaining in this round: ${reviewQueue.length}.`}
        />
      </div>
      
      <div className="flex-1 flex flex-col gap-4 min-h-0 py-4">
        <div className="[perspective:1000px] flex-1 min-h-0">
          <Card 
            onClick={() => setIsFlipped(!isFlipped)} 
            className={cn(
              "w-full h-full rounded-xl transition-transform duration-700 [transform-style:preserve-3d] cursor-pointer",
              { "[transform:rotateY(180deg)]": isFlipped }
            )}
          >
            {/* Front of card */}
            <CardContent className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center text-center p-6">
              {currentCard.frontImage && (
                <div className="relative w-full h-48 mb-4">
                  <Image 
                    src={currentCard.frontImage} 
                    alt="Flashcard front image" 
                    layout="fill" 
                    objectFit="contain" 
                    className="rounded-md" 
                    data-ai-hint={currentCard.frontImageHint}
                    onError={(e) => {
                      console.error('Failed to load front image:', e);
                      // Hide the image container if image fails to load
                      const target = e.target as HTMLImageElement;
                      if (target.parentElement) {
                        target.parentElement.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}
              <div className="text-xl md:text-2xl font-semibold">
                <Latex>{currentCard.front}</Latex>
              </div>
            </CardContent>
            {/* Back of card */}
            <CardContent className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col items-center justify-center text-center p-6 bg-secondary">
              {currentCard.backImage && (
                <div className="relative w-full h-48 mb-4">
                  <Image 
                    src={currentCard.backImage} 
                    alt="Flashcard back image" 
                    layout="fill" 
                    objectFit="contain" 
                    className="rounded-md" 
                    data-ai-hint={currentCard.backImageHint}
                    onError={(e) => {
                      console.error('Failed to load back image:', e);
                      // Hide the image container if image fails to load
                      const target = e.target as HTMLImageElement;
                      if (target.parentElement) {
                        target.parentElement.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}
              <div className="text-xl md:text-2xl font-semibold text-secondary-foreground">
                <Latex>{currentCard.back}</Latex>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-shrink-0 space-y-4 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Session Progress</span>
            <span className="text-sm font-medium">{masteredCount} / {totalInitialCards} mastered</span>
          </div>
          <Progress value={progress} />

          {isFlipped ? (
            <div className="grid grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="bg-red-100 border-red-200 text-red-700 hover:bg-red-200 h-16 text-lg" 
                onClick={() => handleRating('again')}
              >
                Again
              </Button>
              <Button 
                variant="outline" 
                className="bg-yellow-100 border-yellow-200 text-yellow-700 hover:bg-yellow-200 h-16 text-lg" 
                onClick={() => handleRating('good')}
              >
                Good
              </Button>
              <Button 
                variant="outline" 
                className="bg-green-100 border-green-200 text-green-700 hover:bg-green-200 h-16 text-lg" 
                onClick={() => handleRating('easy')}
              >
                Easy
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button onClick={() => setIsFlipped(true)} className="w-1/2 h-16 text-lg">
                <RotateCcw className="mr-2 h-4 w-4" /> Flip Card
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
