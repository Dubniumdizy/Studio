

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  frontImage?: string;
  frontImageHint?: string;
  backImage?: string;
  backImageHint?: string;
};

export type Deck = {
  id: string;
  type: 'deck';
  name: string;
  description: string;
  subject: string;
  cards: Flashcard[];
  srsGoodInterval: number;
  srsEasyInterval: number;
  lastStudied: string | null;
};

export type Folder = {
  id: string;
  type: 'folder';
  name: string;
  items: FileSystemItem[];
};

export type FileSystemItem = Folder | Deck;

export let mockFlashcardSystem: FileSystemItem[] = [
  {
    id: 'folder-1',
    type: 'folder',
    name: 'Science',
    items: [
      {
        id: 'deck-1',
        type: 'deck',
        name: 'Biology Basics',
        description: 'Fundamentals of cell biology and genetics.',
        subject: 'Biology',
        cards: [
          { 
            id: 'card-1-1', 
            front: "What is the powerhouse of the cell?", 
            back: "The Mitochondria.", 
            frontImage: "https://placehold.co/400x200.png", 
            frontImageHint: "biology cell" 
          },
          { id: 'card-1-2', front: "What is DNA?", back: "Deoxyribonucleic acid, a self-replicating material present in nearly all living organisms as the main constituent of chromosomes." },
          { id: 'card-1-3', front: "What is photosynthesis?", back: "The process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll pigment." },
        ],
        srsGoodInterval: 1,
        srsEasyInterval: 4,
        lastStudied: '2024-07-28T10:00:00.000Z',
      },
      {
        id: 'deck-2',
        type: 'deck',
        name: 'Calculus I Formulas',
        description: 'Key formulas and theorems for introductory calculus.',
        subject: 'Mathematics',
        cards: [
          { id: 'card-2-1', front: "What is the Power Rule for differentiation? $$\\frac{d}{dx}(x^n)$$", back: "$$nx^{n-1}$$" },
          { id: 'card-2-2', front: "What is the formula for the area of a circle?", back: "$$A = \\pi r^2$$" },
          { id: 'card-2-3', front: "What is the Fundamental Theorem of Calculus?", back: "If f is continuous on [a, b], then $\\int_a^b f(x) dx = F(b) - F(a)$, where F is any antiderivative of f." },
          { id: 'card-2-4', front: "What is the derivative of $\\sin(x)$?", back: "$\\cos(x)$" },
        ],
        srsGoodInterval: 1,
        srsEasyInterval: 4,
        lastStudied: null,
      },
    ]
  },
  {
    id: 'deck-3',
    type: 'deck',
    name: 'World Capitals',
    description: 'A deck to learn the capitals of countries around the world.',
    subject: 'Geography',
    cards: [
      { id: 'card-3-1', front: "What is the capital of Japan?", back: "Tokyo" },
      { id: 'card-3-2', front: "What is the capital of Canada?", back: "Ottawa" },
      { id: 'card-3-3', front: "What is the capital of Australia?", back: "Canberra" },
      { id: 'card-3-4', front: "What is the capital of Brazil?", back: "Brasília" },
      { id: 'card-3-5', front: "What is the capital of Nigeria?", back: "Abuja" },
    ],
    srsGoodInterval: 2,
    srsEasyInterval: 5,
    lastStudied: '2024-07-20T10:00:00.000Z',
  },
];


// Traversal and mutation utilities

export function findItemInFileSystem(items: FileSystemItem[], itemId: string): FileSystemItem | null {
  for (const item of items) {
    if (item.id === itemId) {
      return item;
    }
    if (item.type === 'folder') {
      const found = findItemInFileSystem(item.items, itemId);
      if (found) return found;
    }
  }
  return null;
}

export function findDeckInFileSystem(items: FileSystemItem[], deckId: string, options: { getPath: true }): number[] | null;
export function findDeckInFileSystem(items: FileSystemItem[], deckId: string): Deck | null;
export function findDeckInFileSystem(items: FileSystemItem[], deckId: string, options?: { getPath: boolean }): Deck | number[] | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type === 'deck' && item.id === deckId) {
      return options?.getPath ? [i] : item;
    }
    if (item.type === 'folder') {
      const foundPath = findDeckInFileSystem(item.items, deckId, { getPath: true });
      if (foundPath) {
        if (options?.getPath) {
          return [i, ...foundPath];
        }
        // If we need the deck itself, we need to traverse down
        let current: any = item;
        for (const index of foundPath) {
          current = current.items[index];
        }
        return current as Deck;
      }
    }
  }
  return null;
}


export function findAndMutateDecks(items: FileSystemItem[], itemId: string, operation: (arr: FileSystemItem[], index: number) => FileSystemItem[]): FileSystemItem[] {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === itemId) {
      return operation(items, i);
    }
    if (items[i].type === 'folder' && (items[i] as Folder).items) {
      const folder = items[i] as Folder;
      const newSubItems = findAndMutateDecks(folder.items, itemId, operation);
      if (newSubItems !== folder.items) {
        const newItems = [...items];
        newItems[i] = { ...folder, items: newSubItems };
        return newItems;
      }
    }
  }
  return items;
}

export function addItemToFolder(items: FileSystemItem[], parentId: string | null, newItem: FileSystemItem): FileSystemItem[] {
  // If parentId is null, add to the root level.
  if (parentId === null) {
    return [...items, newItem];
  }

  // Otherwise, recursively search for the parent folder.
  return items.map(item => {
    if (item.id === parentId && item.type === 'folder') {
      // Found the parent folder, add the new item to its 'items' array.
      return {
        ...item,
        items: [...item.items, newItem],
      };
    }
    if (item.type === 'folder') {
      // This is a folder, but not the parent. Recurse into its children.
      return {
        ...item,
        items: addItemToFolder(item.items, parentId, newItem),
      };
    }
    // This is a deck, return it as is.
    return item;
  });
}
