"use client";

import React, { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockFlashcardSystem, findAndMutateDecks } from "@/lib/flashcard-data";
import { findStaleCards, groupArchivedCardsByDeck, type ArchivedCard } from "@/lib/flashcard-archive";
import { Archive, ChevronLeft, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ArchivePage() {
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<ArchivedCard | null>(null);

  const staleCards = useMemo(() => {
    return findStaleCards(mockFlashcardSystem);
  }, [refreshKey]);

  const groupedCards = useMemo(() => {
    return groupArchivedCardsByDeck(staleCards);
  }, [staleCards]);

  const handleRestore = useCallback((archivedCard: ArchivedCard) => {
    // Reset the card's review data so it appears in the next session
    findAndMutateDecks(mockFlashcardSystem, archivedCard.deckId, (arr, index) => {
      const newArr = [...arr];
      const deckToUpdate = newArr[index] as any;
      if (deckToUpdate.type === 'deck') {
        const updatedCards = [...deckToUpdate.cards];
        updatedCards[archivedCard.cardIndex] = {
          ...updatedCards[archivedCard.cardIndex],
          lastReviewed: null,
          nextReview: null,
          difficulty: null,
        };
        deckToUpdate.cards = updatedCards;
      }
      return newArr;
    });

    toast({
      title: "Card restored",
      description: "The card has been moved back to the active deck.",
    });
    
    setRefreshKey(prev => prev + 1);
  }, [toast]);

  const handleOpenDeleteDialog = useCallback((archivedCard: ArchivedCard) => {
    setCardToDelete(archivedCard);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteCard = useCallback(() => {
    if (!cardToDelete) return;

    findAndMutateDecks(mockFlashcardSystem, cardToDelete.deckId, (arr, index) => {
      const newArr = [...arr];
      const deckToUpdate = newArr[index] as any;
      if (deckToUpdate.type === 'deck') {
        const updatedCards = [...deckToUpdate.cards];
        updatedCards.splice(cardToDelete.cardIndex, 1);
        deckToUpdate.cards = updatedCards;
      }
      return newArr;
    });

    toast({
      title: "Card deleted",
      description: "The card has been permanently removed.",
    });

    setIsDeleteDialogOpen(false);
    setCardToDelete(null);
    setRefreshKey(prev => prev + 1);
  }, [cardToDelete, toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Link href="/flashcards" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 inline-flex items-center gap-2")}>
            <ChevronLeft className="h-4 w-4" />
            All Decks
          </Link>
          <PageHeader 
            title="Is this still relevant?" 
            description="Cards that haven't been reviewed in a while. Restore them to continue studying, or remove them to keep your decks clean." 
          />
        </div>
      </div>

      {staleCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Archive className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No stale cards</p>
            <p className="text-sm text-muted-foreground">All your flashcards are up to date!</p>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {staleCards.length} {staleCards.length === 1 ? 'card' : 'cards'} haven't been reviewed in a while and may no longer be relevant.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {Object.entries(groupedCards).map(([deckId, cards]) => (
          <Card key={deckId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5" />
                {cards[0].deckName}
              </CardTitle>
              <CardDescription>
                {cards.length} {cards.length === 1 ? 'card' : 'cards'} from this deck
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {cards.map((archivedCard) => (
                    <div 
                      key={`${archivedCard.deckId}-${archivedCard.cardIndex}`} 
                      className="flex items-start gap-4 p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{archivedCard.card.front}</p>
                        <p className="text-sm text-muted-foreground mt-1">{archivedCard.card.back}</p>
                        {archivedCard.card.lastReviewed && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last reviewed: {new Date(archivedCard.card.lastReviewed).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(archivedCard)}
                          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDeleteDialog(archivedCard)}
                          className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The card will be permanently removed from the deck.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCard}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
