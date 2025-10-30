
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findDeckInFileSystem, type Flashcard, type Deck, mockFlashcardSystem, saveToLocalStorage } from "@/lib/flashcard-data";
import { flashcardService } from "@/lib/services/flashcards";
import { useAuth } from "@/hooks/use-auth";
import { PlusCircle, Save, Trash2, Pencil, Image as ImageIcon, FileText, ChevronLeft, Copy, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, useRouter, useParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription as DialogDesc,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Latex from "react-latex-next";
import 'katex/dist/katex.min.css';
import { ScrollArea } from "@/components/ui/scroll-area";


const LatexPreview = ({ content }: { content: string }) => {
  return (
    <Card className="mt-2 border-dashed bg-muted/50">
      <CardHeader className="flex-row items-center justify-between p-2 border-b">
        <p className="text-xs font-medium text-muted-foreground">Live Preview</p>
      </CardHeader>
      <CardContent className="p-4 min-h-[60px] flex items-center justify-center text-center">
        {content ? <Latex>{content}</Latex> : <p className="text-sm text-muted-foreground">...</p>}
      </CardContent>
    </Card>
  )
}

export default function EditFlashcardDeckPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { toast } = useToast();
  const { user } = useAuth();
  
  // We find the original deck once and use it to initialize state.
  const originalDeck = useMemo(() => findDeckInFileSystem(mockFlashcardSystem, deckId), [deckId]);
  
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<Flashcard | null>(null);
  
  useEffect(() => {
    if (originalDeck) {
      // Deep copy the deck to state to avoid direct mutation
      setDeck(JSON.parse(JSON.stringify(originalDeck)));
    }
  }, [originalDeck]);
  
  if (!originalDeck) {
    notFound();
  }
  
  if (!deck) {
    return <div>Loading deck...</div>; // Or a skeleton loader
  }

  const handleOpenCardDialog = (card: Flashcard | null) => {
    setEditingCard(card);
    setIsCardDialogOpen(true);
  };
  
  const handleSaveCard = (cardData: Omit<Flashcard, 'id'>) => {
    setDeck(prevDeck => {
      if (!prevDeck) return null;
      const newCards = [...prevDeck.cards];
      if (editingCard) {
        const index = newCards.findIndex(c => c.id === editingCard.id);
        if (index > -1) {
          newCards[index] = { ...newCards[index], ...cardData };
        }
      } else {
        newCards.push({ id: `card-${Date.now()}`, ...cardData });
      }
      return { ...prevDeck, cards: newCards };
    });
    toast({ title: editingCard ? "Card updated!" : "Card added!" });
    setIsCardDialogOpen(false);
    setEditingCard(null);
  };
  
  const handleOpenDeleteDialog = (card: Flashcard) => {
    setCardToDelete(card);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteCard = () => {
    if (!cardToDelete || !deck) return;
    setDeck({
      ...deck,
      cards: deck.cards.filter(c => c.id !== cardToDelete.id)
    });
    toast({ title: "Card deleted." });
    setIsDeleteDialogOpen(false);
    setCardToDelete(null);
  };

  const handleDuplicateCard = (cardId: string) => {
    if (!deck) return;
    const cardIndex = deck.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const originalCard = deck.cards[cardIndex];
    const newCard: Flashcard = {
      ...JSON.parse(JSON.stringify(originalCard)),
      id: `card-${Date.now()}`,
      front: `${originalCard.front} (copy)`,
    };

    const newCards = [...deck.cards];
    newCards.splice(cardIndex + 1, 0, newCard);
    setDeck({ ...deck, cards: newCards });

    toast({ title: "Card duplicated." });
  };

  const handleSaveChanges = () => {
    if (!deck) return;
    // In a real app, this would be an API call.
    // For this prototype, we find the deck in the mock data and replace it.
    const deckPath = findDeckInFileSystem(mockFlashcardSystem, deck.id, { getPath: true });
    if (deckPath) {
      let currentLevel: any = mockFlashcardSystem;
      for (let i = 0; i < deckPath.length - 1; i++) {
        currentLevel = currentLevel[deckPath[i]].items;
      }
      currentLevel[deckPath[deckPath.length - 1]] = deck;
    }
    
    // Save to localStorage
    saveToLocalStorage();
    
    toast({
      title: "Deck Saved!",
      description: `Your changes to "${deck.name}" have been saved.`,
    });
    router.push('/flashcards');
  }

  const setDeckName = (name: string) => setDeck(d => d ? {...d, name} : null);
  const setSrsGoodInterval = (interval: number) => setDeck(d => d ? {...d, srsGoodInterval: interval} : null);
  const setSrsEasyInterval = (interval: number) => setDeck(d => d ? {...d, srsEasyInterval: interval} : null);
  const setArchiveDays = (days: number) => setDeck(d => d ? {...d, archiveDays: days} : null);

  return (
    <div>
      <Link href="/flashcards" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 inline-flex items-center gap-2")}>
        <ChevronLeft className="h-4 w-4" />
        All Decks
      </Link>
      <PageHeader
        title="Edit Deck"
        description={`Manage the details and cards for "${deck.name}"`}
      />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Deck Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="space-y-2">
                <Label htmlFor="deckName">Deck Name</Label>
                <Input id="deckName" value={deck.name} onChange={(e) => setDeckName(e.target.value)} />
             </div>
             <div>
              <h3 className="text-sm font-medium mb-2">Spaced Repetition Settings</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="srsGood">"Good" interval (days)</Label>
                  <Input id="srsGood" type="number" min="1" value={deck.srsGoodInterval} onChange={(e) => setSrsGoodInterval(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="srsEasy">"Easy" interval (days)</Label>
                  <Input id="srsEasy" type="number" min="1" value={deck.srsEasyInterval} onChange={(e) => setSrsEasyInterval(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="archiveDays">Archive after (days)</Label>
                  <Input id="archiveDays" type="number" min="1" value={deck.archiveDays} onChange={(e) => setArchiveDays(Number(e.target.value))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Cards not reviewed for longer than the archive period will be moved to "Is this still relevant?"
              </p>
             </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Cards ({deck.cards.length})</CardTitle>
              <Button onClick={() => handleOpenCardDialog(null)}>
                <PlusCircle className="mr-2"/> Add Card
              </Button>
            </div>
            <CardDescription>Add, edit, or remove cards from this deck.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deck.cards.length > 0 ? deck.cards.map(card => (
                <div key={card.id} className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 text-muted-foreground">
                    {card.frontImage || card.backImage ? <ImageIcon/> : <FileText />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{card.front}</p>
                    <p className="text-sm text-muted-foreground truncate">{card.back}</p>
                  </div>
                  <div className="flex items-center gap-1">
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenCardDialog(card)}><Pencil className="h-4 w-4"/></Button>
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicateCard(card.id)}><Copy className="h-4 w-4"/></Button>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleOpenDeleteDialog(card)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center p-4">This deck has no cards yet. Add one to get started!</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => router.push('/flashcards')}>Cancel</Button>
          <Button onClick={handleSaveChanges}><Save className="mr-2"/> Save Changes</Button>
        </div>
      </div>
      
      {isCardDialogOpen && 
        <CardEditorDialog
          isOpen={isCardDialogOpen}
          onOpenChange={setIsCardDialogOpen}
          onSave={handleSaveCard}
          card={editingCard}
        />
      }

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this flashcard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} className={cn(buttonVariants({variant: "destructive"}))}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function CardEditorDialog({ isOpen, onOpenChange, onSave, card }: {
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  onSave: (cardData: Omit<Flashcard, 'id'>) => void,
  card: Flashcard | null,
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  useEffect(() => {
    setFront(card?.front || "");
    setBack(card?.back || "");
    setFrontImage(card?.frontImage || null);
    setBackImage(card?.backImage || null);
  }, [card]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (side === 'front') {
          setFrontImage(reader.result as string);
        } else {
          setBackImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const cardData = { 
        front, 
        back, 
        frontImage: frontImage || undefined, 
        backImage: backImage || undefined,
        frontImageHint: "custom image",
        backImageHint: "custom image",
    };
    onSave(cardData);
  };
  
  return (
     <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{card ? 'Edit Card' : 'Add New Card'}</DialogTitle>
            <DialogDesc>{'Use $...$ for inline math. E.g., $\\frac{a}{b}$'}</DialogDesc>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] p-1">
            <div className="grid gap-6 py-4 px-5">
              <div className="space-y-2">
                <Label htmlFor="front">Front</Label>
                <Textarea id="front" value={front} onChange={(e) => setFront(e.target.value)} placeholder={'Question or term. For LaTeX, use $...$ delimiters.'} />
                <LatexPreview content={front} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="front-image-upload">Front Image (Optional)</Label>
                <Input id="front-image-upload" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'front')} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                {frontImage && (
                  <div className="mt-4 relative w-full h-48 border rounded-md overflow-hidden">
                    <Image src={frontImage} alt="Front image preview" layout="fill" objectFit="contain" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="back">Back</Label>
                <Textarea id="back" value={back} onChange={(e) => setBack(e.target.value)} placeholder={'Answer or definition. For LaTeX, use $...$ delimiters.'} />
                <LatexPreview content={back} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="back-image-upload">Back Image (Optional)</Label>
                <Input id="back-image-upload" type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'back')} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                {backImage && (
                  <div className="mt-4 relative w-full h-48 border rounded-md overflow-hidden">
                    <Image src={backImage} alt="Back image preview" layout="fill" objectFit="contain" />
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pr-6 pb-4">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave}>Save Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
