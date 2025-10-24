import { Deck, Flashcard, FileSystemItem, Folder } from './flashcard-data';

export type ArchivedCard = {
  card: Flashcard;
  deckId: string;
  deckName: string;
  cardIndex: number;
};

/**
 * Identifies cards that should be archived based on the deck's archiveDays setting
 */
export function findStaleCards(items: FileSystemItem[]): ArchivedCard[] {
  const staleCards: ArchivedCard[] = [];
  const now = new Date();

  function traverseItems(items: FileSystemItem[]) {
    for (const item of items) {
      if (item.type === 'folder') {
        traverseItems(item.items);
      } else if (item.type === 'deck') {
        const deck = item as Deck;
        deck.cards.forEach((card, index) => {
          if (card.lastReviewed) {
            const lastReviewedDate = new Date(card.lastReviewed);
            const daysSinceReview = Math.floor(
              (now.getTime() - lastReviewedDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            
            if (daysSinceReview > deck.archiveDays) {
              staleCards.push({
                card,
                deckId: deck.id,
                deckName: deck.name,
                cardIndex: index,
              });
            }
          }
        });
      }
    }
  }

  traverseItems(items);
  return staleCards;
}

/**
 * Groups archived cards by deck
 */
export function groupArchivedCardsByDeck(archivedCards: ArchivedCard[]): Record<string, ArchivedCard[]> {
  return archivedCards.reduce((acc, item) => {
    if (!acc[item.deckId]) {
      acc[item.deckId] = [];
    }
    acc[item.deckId].push(item);
    return acc;
  }, {} as Record<string, ArchivedCard[]>);
}
