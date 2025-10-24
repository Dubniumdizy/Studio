"use client";

import React, { useState, useRef, Fragment, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockFlashcardSystem, addItemToFolder, findAndMutateDecks, type FileSystemItem, type Deck, type Folder, findItemInFileSystem } from "@/lib/flashcard-data";
import { findStaleCards } from "@/lib/flashcard-archive";
import { Folder as FolderIcon, MoreHorizontal, Pencil, Copy, Trash2, FolderOpen, PlusCircle, Brain, BookCopy, FolderPlus, Move, FolderKanban, Loader2, AlertTriangle, FileText, Archive, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSafeAsync } from "@/hooks/use-safe-async";
import { validateForm, deckSchema, folderSchema } from "@/lib/validation";
import { PDFToFlashcardsDialog } from "@/components/flashcards/pdf-to-flashcards-dialog";

export default function FlashcardsPage() {
  const [items, setItems] = useState<FileSystemItem[]>(mockFlashcardSystem);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ 'folder-1': true });
  const staleCardsCount = useMemo(() => findStaleCards(items).length, [items]);
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isPDFDialogOpen, setIsPDFDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Global SRS settings
  const [globalSrsGoodInterval, setGlobalSrsGoodInterval] = useState(1);
  const [globalSrsEasyInterval, setGlobalSrsEasyInterval] = useState(4);
  const [globalArchiveDays, setGlobalArchiveDays] = useState(90);
  
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  const [itemToMove, setItemToMove] = useState<FileSystemItem | null>(null);

  const [newName, setNewName] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createType, setCreateType] = useState<'folder' | 'deck'>('folder');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();

  // Safe async operations
  const { loading: deleteLoading, execute: executeDelete } = useSafeAsync({
    onSuccess: () => {
      toast({ title: `Deleted "${selectedItem?.name}"` });
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error) => {
      toast({ 
        title: "Delete failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const { loading: duplicateLoading, execute: executeDuplicate } = useSafeAsync({
    onSuccess: () => {
      toast({ title: "Item duplicated." });
    },
    onError: (error) => {
      toast({ 
        title: "Duplicate failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const { loading: renameLoading, execute: executeRename } = useSafeAsync({
    onSuccess: () => {
      toast({ title: "Item renamed." });
      setIsRenameDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error) => {
      toast({ 
        title: "Rename failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const { loading: createLoading, execute: executeCreate } = useSafeAsync({
    onSuccess: () => {
      toast({ title: `${createType === 'folder' ? 'Folder' : 'Deck'} created.` });
      setIsCreateDialogOpen(false);
      setNewName('');
    },
    onError: (error) => {
      toast({ 
        title: "Create failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const { loading: moveLoading, execute: executeMove } = useSafeAsync({
    onSuccess: () => {
      toast({ title: `Moved "${itemToMove?.name}"` });
      setIsMoveDialogOpen(false);
      setItemToMove(null);
    },
    onError: (error) => {
      toast({ 
        title: "Move failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleAction = useCallback((action: 'rename' | 'duplicate' | 'delete' | 'move', item: FileSystemItem) => {
    setSelectedItem(item);
    setValidationErrors({});
    
    if (action === 'rename') {
      setNewName(item.name);
      setIsRenameDialogOpen(true);
    } else if (action === 'delete') {
      setIsDeleteDialogOpen(true);
    } else if (action === 'duplicate') {
      handleDuplicate(item.id);
    } else if (action === 'move') {
      setItemToMove(item);
      setIsMoveDialogOpen(true);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedItem) return;
    
    await executeDelete(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newItems = findAndMutateDecks(items, selectedItem.id, (arr, index) => {
        const newArr = [...arr];
        newArr.splice(index, 1);
        return newArr;
      });

      // Update shared mock data
      mockFlashcardSystem.length = 0;
      mockFlashcardSystem.push(...newItems);
      setItems(newItems);
      
      return newItems;
    });
  }, [selectedItem, items, executeDelete]);

  const handleDuplicate = useCallback(async (itemId: string) => {
    await executeDuplicate(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newItems = findAndMutateDecks(items, itemId, (arr, index) => {
        const newArr = [...arr];
        const original = arr[index];
        const copy = { ...JSON.parse(JSON.stringify(original)), id: `${original.type}-${Date.now()}`, name: `${original.name} (copy)` };
        newArr.splice(index + 1, 0, copy);
        return newArr;
      });

      // Update shared mock data
      mockFlashcardSystem.length = 0;
      mockFlashcardSystem.push(...newItems);
      setItems(newItems);

      return newItems;
    });
  }, [items, executeDuplicate]);
  
  const handleRename = useCallback(async () => {
    if (!selectedItem || !newName.trim()) return;
    
    // Validate input
    const schema = selectedItem.type === 'folder' ? folderSchema : deckSchema;
    const validation = validateForm(schema, { name: newName.trim() });
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors || {});
      return;
    }
    
    await executeRename(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newItems = findAndMutateDecks(items, selectedItem.id, (arr, index) => {
        const newArr = [...arr];
        newArr[index] = { ...newArr[index], name: newName.trim() };
        return newArr;
      });

      // Update shared mock data
      mockFlashcardSystem.length = 0;
      mockFlashcardSystem.push(...newItems);
      setItems(newItems);

      return newItems;
    });
  }, [selectedItem, newName, items, executeRename]);

  const handleOpenCreateDialog = useCallback((parentId: string | null, type: 'folder' | 'deck') => {
    setNewName('');
    setCreateParentId(parentId);
    setCreateType(type);
    setValidationErrors({});
    setIsCreateDialogOpen(true);
  }, []);

  const handleCreateItem = useCallback(async () => {
    if (!newName.trim()) return;
    
    // Validate input
    const schema = createType === 'folder' ? folderSchema : deckSchema;
    const validation = validateForm(schema, { name: newName.trim() });
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors || {});
      return;
    }
    
    await executeCreate(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newItem: FileSystemItem = createType === 'folder'
        ? { id: `folder-${Date.now()}`, name: newName.trim(), type: 'folder', items: [] }
        : { 
            id: `deck-${Date.now()}`, 
            type: 'deck',
            name: newName.trim(), 
            description: "A new collection of flashcards.",
            subject: "Uncategorized",
            cards: [],
            srsGoodInterval: 1,
            srsEasyInterval: 4,
            archiveDays: 90,
            lastStudied: null,
          };

      const newItems = addItemToFolder(JSON.parse(JSON.stringify(items)), createParentId, newItem);
      
      // Update shared mock data
      mockFlashcardSystem.length = 0;
      mockFlashcardSystem.push(...newItems);
      setItems(newItems);
      
      return newItems;
    });
  }, [newName, createType, createParentId, items, executeCreate]);

  const handleCreateDeckFromPDF = useCallback(async (deckData: {
    name: string
    description: string
    subject: string
    cards: { id: string; front: string; back: string }[]
  }) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      type: 'deck',
      name: deckData.name,
      description: deckData.description,
      subject: deckData.subject,
      cards: deckData.cards.map(card => ({
        ...card,
        lastReviewed: null,
        nextReview: null,
        difficulty: null,
      })),
      srsGoodInterval: 1,
      srsEasyInterval: 4,
      archiveDays: 90,
      lastStudied: null,
    }
    
    const newItems = addItemToFolder(JSON.parse(JSON.stringify(items)), null, newDeck)
    
    // Update shared mock data
    mockFlashcardSystem.length = 0
    mockFlashcardSystem.push(...newItems)
    setItems(newItems)
  }, [items])

  const handleConfirmMove = useCallback(async (destinationFolderId: string | null) => {
    if (!itemToMove) return;

    await executeMove(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find and clone the item to move
      const foundItem = findItemInFileSystem(items, itemToMove.id);
      if (!foundItem) {
        throw new Error('Item not found');
      }
      const itemClone = JSON.parse(JSON.stringify(foundItem));

      // 1. Remove the original item
      const itemsAfterRemoval = findAndMutateDecks(items, itemToMove.id, (arr, index) => {
          const newArr = [...arr];
          newArr.splice(index, 1);
          return newArr;
      });

      // 2. Add the clone to the new destination
      const newItems = addItemToFolder(itemsAfterRemoval, destinationFolderId, itemClone);

      // Update shared mock data
      mockFlashcardSystem.length = 0;
      mockFlashcardSystem.push(...newItems);
      setItems(newItems);

      return newItems;
    });
  }, [itemToMove, items, executeMove]);

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const renderFileSystem = useCallback((items: FileSystemItem[], level = 0) => {
    return items.map(item => (
      <Fragment key={item.id}>
        <div 
          className={cn(
            "flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors",
            level > 0 && "ml-4"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {item.type === 'folder' ? (
              <button
                onClick={() => toggleFolder(item.id)}
                className="flex items-center gap-2 text-left flex-1 min-w-0 hover:bg-muted/30 rounded p-1 transition-colors"
              >
                <FolderIcon className="w-4 h-4 text-blue-500" />
                <span className="font-medium truncate">{item.name}</span>
                <FolderOpen className={cn("w-3 h-3 transition-transform", openFolders[item.id] ? "rotate-90" : "")} />
              </button>
            ) : (
              <Link 
                href={`/flashcards/${item.id}`}
                className="flex items-center gap-2 text-left flex-1 min-w-0 hover:bg-muted/30 rounded p-1 transition-colors"
              >
                <BookCopy className="w-4 h-4 text-green-500" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  {item.type === 'deck' && (
                    <div className="text-xs text-muted-foreground">
                      {item.cards.length} cards
                      {item.lastStudied && ` • Last studied ${formatDistanceToNow(new Date(item.lastStudied))} ago`}
                    </div>
                  )}
                </div>
              </Link>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleAction('rename', item)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('duplicate', item)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('move', item)}>
                <Move className="mr-2 h-4 w-4" />
                Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleAction('delete', item)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {item.type === 'folder' && openFolders[item.id] && (
          <div className="mt-1">
            {renderFileSystem(item.items, level + 1)}
          </div>
        )}
      </Fragment>
    ));
  }, [openFolders, toggleFolder, handleAction]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <PageHeader 
          title="Flashcards" 
          description="Organize your study materials into decks and folders. Create, review, and master your knowledge." 
        />
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsSettingsOpen(true)}
            variant="outline"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Link href="/flashcards/archive">
            <Button 
              variant="outline"
              className={cn(
                staleCardsCount > 0 && "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              )}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
              {staleCardsCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-200 text-orange-800">
                  {staleCardsCount}
                </span>
              )}
            </Button>
          </Link>
          <Button onClick={() => handleOpenCreateDialog(null, 'folder')}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
          <Button onClick={() => handleOpenCreateDialog(null, 'deck')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Deck
          </Button>
          <Button 
            onClick={() => setIsPDFDialogOpen(true)}
            variant="outline"
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <FileText className="mr-2 h-4 w-4" />
            PDF to Flashcards
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Your Study Collection
          </CardTitle>
          <CardDescription>
            Click on folders to expand them, or click on decks to start studying.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-1">
              {renderFileSystem(items)}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {selectedItem?.type}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (validationErrors.name) {
                    setValidationErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.name;
                      return newErrors;
                    });
                  }
                }}
                placeholder={`Enter new ${selectedItem?.type} name`}
              />
              {validationErrors.name && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleRename} 
              disabled={renameLoading || !newName.trim()}
            >
              {renameLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedItem?.type}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
              {selectedItem?.type === 'folder' && ' All items inside will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New {createType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">{createType === 'folder' ? 'Folder' : 'Deck'} Name</Label>
              <Input
                id="create-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (validationErrors.name) {
                    setValidationErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.name;
                      return newErrors;
                    });
                  }
                }}
                placeholder={`Enter ${createType} name`}
              />
              {validationErrors.name && (
                <p className="text-sm text-red-500 mt-1">{validationErrors.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleCreateItem} 
              disabled={createLoading || !newName.trim()}
            >
              {createLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <MoveItemDialog 
        isOpen={isMoveDialogOpen} 
        onOpenChange={setIsMoveDialogOpen} 
        itemToMove={itemToMove} 
        allItems={items} 
        onConfirmMove={handleConfirmMove}
        loading={moveLoading}
      />

      {/* PDF to Flashcards Dialog */}
      <PDFToFlashcardsDialog
        isOpen={isPDFDialogOpen}
        onOpenChange={setIsPDFDialogOpen}
        onCreateDeck={handleCreateDeckFromPDF}
        createLoading={createLoading}
      />

      {/* Global Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spaced Repetition Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                These settings will apply to all flashcard decks.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="global-srs-good">"Good" interval (days)</Label>
                <Input 
                  id="global-srs-good" 
                  type="number" 
                  min="1" 
                  value={globalSrsGoodInterval} 
                  onChange={(e) => setGlobalSrsGoodInterval(Number(e.target.value))} 
                />
                <p className="text-xs text-muted-foreground">
                  Cards marked as "Good" will reappear after this many days.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-srs-easy">"Easy" interval (days)</Label>
                <Input 
                  id="global-srs-easy" 
                  type="number" 
                  min="1" 
                  value={globalSrsEasyInterval} 
                  onChange={(e) => setGlobalSrsEasyInterval(Number(e.target.value))} 
                />
                <p className="text-xs text-muted-foreground">
                  Cards marked as "Easy" will reappear after this many days.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-archive-days">Archive after (days)</Label>
                <Input 
                  id="global-archive-days" 
                  type="number" 
                  min="1" 
                  value={globalArchiveDays} 
                  onChange={(e) => setGlobalArchiveDays(Number(e.target.value))} 
                />
                <p className="text-xs text-muted-foreground">
                  Cards not reviewed for this many days will be moved to the archive.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => {
              // Apply settings to all decks
              const updateAllDecks = (items: FileSystemItem[]): FileSystemItem[] => {
                return items.map(item => {
                  if (item.type === 'folder') {
                    return { ...item, items: updateAllDecks(item.items) };
                  } else if (item.type === 'deck') {
                    return {
                      ...item,
                      srsGoodInterval: globalSrsGoodInterval,
                      srsEasyInterval: globalSrsEasyInterval,
                      archiveDays: globalArchiveDays,
                    };
                  }
                  return item;
                });
              };
              
              const updatedItems = updateAllDecks(items);
              mockFlashcardSystem.length = 0;
              mockFlashcardSystem.push(...updatedItems);
              setItems(updatedItems);
              
              toast({
                title: "Settings saved!",
                description: "Spaced repetition settings applied to all decks.",
              });
              setIsSettingsOpen(false);
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoveItemDialog({ isOpen, onOpenChange, itemToMove, allItems, onConfirmMove, loading }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    itemToMove: FileSystemItem | null;
    allItems: FileSystemItem[];
    onConfirmMove: (destinationId: string | null) => void;
    loading: boolean;
}) {
    const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

    const renderFolders = (items: FileSystemItem[], level = 0): JSX.Element[] => {
        return items
            .filter(item => item.type === 'folder')
            .map(item => [
                <div key={item.id} className="flex items-center space-x-2 py-1">
                    <RadioGroupItem value={item.id} id={item.id} />
                    <Label htmlFor={item.id} className="flex items-center gap-2">
                        <FolderIcon className="w-4 h-4" />
                        {item.name}
                    </Label>
                </div>,
                ...renderFolders(item.items, level + 1)
            ]).flat();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Move "{itemToMove?.name}"</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <RadioGroup value={selectedDestination || ''} onValueChange={setSelectedDestination}>
                        <div className="flex items-center space-x-2 py-1">
                            <RadioGroupItem value="" id="root" />
                            <Label htmlFor="root">Root level</Label>
                        </div>
                        {renderFolders(allItems)}
                    </RadioGroup>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button 
                        onClick={() => onConfirmMove(selectedDestination || null)}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Moving...
                            </>
                        ) : (
                            'Move'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    