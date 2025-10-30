
"use client";

import React, { useState, useRef, Fragment, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, Folder, HardDriveUpload, MoreHorizontal, Pencil, Copy, Trash2, FolderOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { mockBankData, updateBankData, findAndMutate, type FileOrFolder } from "@/lib/bank-data";
import { useRouter, useSearchParams } from 'next/navigation';

export default function BankPage() {
  const [files, setFiles] = useState<FileOrFolder[]>(mockBankData);
  const router = useRouter();
  const searchParams = useSearchParams();
const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ home: true });
  const [selectedFolderId, setSelectedFolderId] = useState<string>('home');
  const [selectedItem, setSelectedItem] = useState<FileOrFolder | null>(null);
// No preview pane; clicking a file opens it directly
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load from localStorage if available; fallback to mockBankData
    try {
      const raw = localStorage.getItem('bankData')
      if (raw) {
        const parsed = JSON.parse(raw)
        setFiles(parsed)
      } else {
        setFiles(mockBankData)
      }
    } catch {
      setFiles(mockBankData)
    }
  }, []);

  // Navigate/open a specific BANK item if ?open=<id> is present
  useEffect(() => {
    const openId = searchParams?.get('open');
    if (!openId || !files || files.length === 0) return;
    const path = findPath(files, openId) || [];
    if (path.length === 0) return;
    // Expand all ancestor folders and select the closest folder
    const openMap: Record<string, boolean> = {};
    path.forEach(p => { if (p.type === 'folder') openMap[p.id] = true });
    const lastFolder = [...path].reverse().find(n => n.type === 'folder');
    setOpenFolders(openMap);
    setSelectedFolderId(lastFolder?.id || 'home');
    // Scroll to the item and open if file
    setTimeout(() => {
      const safeId = String(openId).replace(/"/g, '\\"');
      const el = document.querySelector(`[data-bank-id="${safeId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const item = path[path.length - 1];
      if (item && item.type === 'file') {
        try {
          if (typeof item.content === 'string' && item.content.startsWith('data:')) {
            window.open(item.content, '_blank');
          } else if (item.url) {
            window.open(item.url, '_blank');
          } else if (item.content) {
            const blob = new Blob([item.content], { type: item.mime || 'text/plain' });
            const u = URL.createObjectURL(blob);
            window.open(u, '_blank');
          }
        } catch {}
      }
    }, 50);
  }, [files, searchParams]);

  // Auto-refresh when BANK data changes elsewhere (storage/broadcast/custom event)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bankData' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setFiles(parsed)
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage)

    const onCustom = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail
        if (detail) setFiles(detail)
      } catch {}
    }
    window.addEventListener('bankDataUpdated' as any, onCustom as any)

    let bc: BroadcastChannel | null = null
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('bank-updates')
        const onMsg = (msg: MessageEvent) => {
          const data = (msg as MessageEvent<any>).data
          if (data?.type === 'bankDataUpdated' && data?.payload) {
            setFiles(data.payload)
          }
        }
        bc.addEventListener('message', onMsg)
        // Clean up listener on unmount
        return () => {
          window.removeEventListener('storage', onStorage)
          window.removeEventListener('bankDataUpdated' as any, onCustom as any)
          try { bc?.close() } catch {}
        }
      }
    } catch {}

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('bankDataUpdated' as any, onCustom as any)
      try { bc?.close() } catch {}
    }
  }, [])

  const updateFiles = (newFiles: FileOrFolder[]) => {
    setFiles(newFiles);
    updateBankData(newFiles);
    try { localStorage.setItem('bankData', JSON.stringify(newFiles)) } catch {}
  }

  // Helpers to find nodes and paths (declare before using)
  const findPath = (items: FileOrFolder[], id: string, trail: FileOrFolder[] = []): FileOrFolder[] | null => {
    for (const item of items) {
      const newTrail = [...trail, item]
      if (item.id === id) return newTrail
      if (item.type === 'folder' && item.items) {
        const res = findPath(item.items, id, newTrail)
        if (res) return res
      }
    }
    return null
  }
  const getById = (items: FileOrFolder[], id: string): FileOrFolder | null => {
    const path = findPath(items, id)
    return path ? path[path.length - 1] : null
  }

  // Breadcrumb/path utilities (used for header and navigation)
  const selectedPath = findPath(files, selectedFolderId) || findPath(files, 'home') || []
  const breadcrumb = selectedPath.map(p => p.name).join(' / ')

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (uploadedFiles && uploadedFiles.length) {
      const readers = Array.from(uploadedFiles).map(file => new Promise<FileOrFolder>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            type: 'file',
            url: URL.createObjectURL(file),
            mime: file.type || undefined,
            content: typeof reader.result === 'string' ? reader.result : undefined // data URL for persistence
          })
        }
        reader.readAsDataURL(file)
      }))
      Promise.all(readers).then((newFileItems) => {
        const newFiles = findAndMutate(files, selectedFolderId, (arr, idx) => {
          const newArr = [...arr];
          const folder = newArr[idx];
          const items = folder.items ? [...folder.items] : [];
          newFileItems.forEach(f => items.push(f))
          newArr[idx] = { ...folder, items };
          return newArr;
        });
        updateFiles(newFiles);
        toast({ title: `${newFileItems.length} file(s) uploaded.` });
      })
    }
  };

  const handleAction = (action: 'rename' | 'duplicate' | 'delete' | 'move' | 'new_folder' | 'set_color', item: FileOrFolder) => {
    setSelectedItem(item);
    if (action === 'rename') {
      setNewName(item.name);
      setIsRenameDialogOpen(true);
    } else if (action === 'delete') {
      setIsDeleteDialogOpen(true);
    } else if (action === 'duplicate') {
      handleDuplicate(item.id);
    } else if (action === 'move') {
      setSelectedItem(item);
      setIsMoveDialogOpen(true);
    } else if (action === 'new_folder') {
      handleCreateFolder(item.id);
    } else if (action === 'set_color' && item.type === 'folder') {
      const palette = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f472b6','#94a3b8']
      const current = item.color || '#3b82f6'
      const input = prompt(`Folder color (hex). Suggestions: ${palette.join(', ')}\nCurrent: ${current}`, current)?.trim()
      if (!input) return
      const newFiles = findAndMutate(files, item.id, (arr, index) => {
        const newArr = [...arr]
        const it = { ...newArr[index], color: input }
        newArr[index] = it
        return newArr
      })
      updateFiles(newFiles)
    }
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    const newFiles = findAndMutate(files, selectedItem.id, (arr, index) => {
      const newArr = [...arr];
      newArr.splice(index, 1);
      return newArr;
    });
    updateFiles(newFiles);
    toast({ title: `Deleted "${selectedItem.name}"` });
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  const handleDuplicate = (itemId: string) => {
    const newFiles = findAndMutate(files, itemId, (arr, index) => {
      const newArr = [...arr];
      const original = arr[index];
      const copy = { ...JSON.parse(JSON.stringify(original)), id: `item-${Date.now()}`, name: `${original.name} (copy)` };
      newArr.splice(index + 1, 0, copy);
      return newArr;
    });
    updateFiles(newFiles);
    toast({ title: "Item duplicated." });
  };
  
  const handleRename = () => {
    if (!selectedItem || !newName.trim()) return;
    const newFiles = findAndMutate(files, selectedItem.id, (arr, index) => {
      const newArr = [...arr];
      newArr[index] = { ...newArr[index], name: newName.trim() };
      return newArr;
    });
    updateFiles(newFiles);
    toast({ title: "Item renamed." });
    setIsRenameDialogOpen(false);
    setSelectedItem(null);
  };

  const toggleFolder = (folderId: string) => {
    // Open the folder and all of its ancestors so contents are visible
    const path = findPath(files, folderId) || []
    const openMap: Record<string, boolean> = {}
    path.forEach(p => { if (p.type === 'folder') openMap[p.id] = true })
    setSelectedFolderId(folderId)
    setOpenFolders(openMap)
  };

  const handleCreateFolder = (parentId: string) => {
    const name = prompt('Folder name')?.trim()
    if (!name) return
    const newFolder: FileOrFolder = { id: `folder-${Date.now()}`, name, type: 'folder', items: [] }
    const newFiles = findAndMutate(files, parentId, (arr, idx) => {
      const newArr = [...arr]
      const folder = newArr[idx]
      const items = folder.items ? [...folder.items] : []
      items.push(newFolder)
      newArr[idx] = { ...folder, items }
      return newArr
    })
    updateFiles(newFiles)
    toast({ title: `Folder "${name}" created.` })
  }

  const renderFileTree = (items: FileOrFolder[], level = 0) => {
    return items.map(item => (
      <Fragment key={item.id}>
        <div 
          className="group flex items-center gap-3 p-2 rounded-md hover:bg-muted/80 transition-colors"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem`}}
          data-bank-id={item.id}
        >
          {item.type === 'folder' ? (
            openFolders[item.id] ? <FolderOpen className="h-5 w-5" style={{ color: item.color || 'var(--primary)' }} /> : <Folder className="h-5 w-5" style={{ color: item.color || 'var(--primary)' }} />
          ) : (
            <File className="h-5 w-5 text-muted-foreground" />
          )}
          <span 
            className="text-sm font-medium flex-1 cursor-pointer"
onClick={() => {
              if (item.type === 'folder') return toggleFolder(item.id);
              // For CSV files: download to user's computer (open/edit externally)
              const isCsv = (item.mime === 'text/csv') || /\.csv$/i.test(item.name)
              if (isCsv) {
                try {
                  let blob: Blob
                  if (typeof item.content === 'string' && item.content.startsWith('data:')) {
                    // Convert data URL to blob
                    const res = fetch(item.content).then(r=>r.blob())
                    res.then(b=>{
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(b)
                      a.download = item.name || 'file.csv'
                      document.body.appendChild(a); a.click(); a.remove();
                    })
                  } else {
                    blob = new Blob([item.content || ''], { type: 'text/csv;charset=utf-8' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = item.name || 'file.csv'
                    document.body.appendChild(a); a.click(); a.remove();
                  }
                } catch {
                  toast({ title: 'Download failed for CSV.' })
                }
                return
              }
              // Route exam analysis JSON directly into Analyzer
              const isJson = (item.mime === 'application/json') || /\.json$/i.test(item.name)
              const looksLikeAnalysis = /\.analysis\.json$/i.test(item.name)
              const looksLikeInspiration = /\.inspiration\.json$/i.test(item.name)
              const looksLikeResources = /\.resources\.json$/i.test(item.name)
              const looksLikeBook = /\.book\.json$/i.test(item.name)
              if (isJson && looksLikeAnalysis) {
                router.push(`/exam-analyzer?bankFileId=${encodeURIComponent(item.id)}`)
                return
              }
              if (isJson && looksLikeBook) {
                router.push(`/book-analyzer?bankFileId=${encodeURIComponent(item.id)}`)
                return
              }
              if (isJson && looksLikeInspiration) {
                router.push(`/inspiration?bankFileId=${encodeURIComponent(item.id)}`)
                return
              }
              if (isJson && looksLikeResources) {
                router.push(`/resources?bankFileId=${encodeURIComponent(item.id)}`)
                return
              }
              if (isJson && typeof item.content === 'string') {
                try {
                  const parsed = JSON.parse(item.content)
                  if (parsed?.type === 'book-analysis' || (parsed?.summary && parsed?.problemSolvingGuides)) {
                    router.push(`/book-analyzer?bankFileId=${encodeURIComponent(item.id)}`)
                    return
                  }
                  if (parsed?.type === 'inspiration' || (parsed?.bigPicture && parsed?.realWorldApplications)) {
                    router.push(`/inspiration?bankFileId=${encodeURIComponent(item.id)}`)
                    return
                  }
                  if (parsed?.type === 'resources' || (parsed?.recommendedResources && parsed?.reasoning)) {
                    router.push(`/resources?bankFileId=${encodeURIComponent(item.id)}`)
                    return
                  }
                } catch {}
              }
              // Handle PDF, DOC, DOCX files
              const isPdf = (item.mime === 'application/pdf') || /\.pdf$/i.test(item.name)
              const isDoc = /\.(doc|docx)$/i.test(item.name) || 
                            item.mime === 'application/msword' || 
                            item.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              
              if (isPdf || isDoc) {
                try {
                  if (typeof item.content === 'string' && item.content.startsWith('data:')) {
                    // Convert data URL to blob for proper PDF rendering
                    fetch(item.content)
                      .then(res => res.blob())
                      .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                      })
                      .catch(() => {
                        toast({ title: 'Failed to open file' });
                      });
                  } else if (item.url) {
                    window.open(item.url, '_blank')
                  } else {
                    toast({ title: `No preview available for ${item.name}`})
                  }
                } catch (err) {
                  toast({ title: 'Failed to open file', description: String(err) })
                }
                return
              }
              
              // Prefer persistent data URL if present
              if (typeof item.content === 'string' && item.content.startsWith('data:')) {
                window.open(item.content, '_blank')
              } else if (item.url) {
                window.open(item.url, '_blank');
              } else if (item.content) {
                // If content is text without data URL, build a blob
                const blob = new Blob([item.content], { type: item.mime || 'text/plain' });
                const u = URL.createObjectURL(blob);
                window.open(u, '_blank');
              } else {
                toast({ title: `No preview available for ${item.name}`});
              }
            }}
          >
            {item.name}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAction('rename', item)}><Pencil className="mr-2" /> Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('duplicate', item)}><Copy className="mr-2" /> Duplicate</DropdownMenuItem>
              {item.type === 'folder' && (
                <>
                  <DropdownMenuItem onClick={() => handleAction('new_folder', item)}><Folder className="mr-2" /> New Folder inside</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('set_color', item)}><Pencil className="mr-2" /> Set Color</DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => handleAction('move', item)}><Folder className="mr-2" /> Move</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('delete', item)} className="text-destructive"><Trash2 className="mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {item.type === 'folder' && openFolders[item.id] && item.items && (
          renderFileTree(item.items, level + 1)
        )}
      </Fragment>
    ));
  };
  
  return (
    <div>
      <PageHeader 
        title="Bank"
        description="Your personal library for all subjects. Upload, organize, and access your files."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>My Bank</CardTitle>
                <CardDescription>Your personal collection of files and folders.</CardDescription>
              </div>
              <Button variant="outline" onClick={handleUploadClick}>
                <HardDriveUpload className="mr-2 h-4 w-4"/> Upload
                <input 
                  type="file" 
                  ref={uploadInputRef} 
                  onChange={handleFileChange} 
                  multiple 
                  accept=".pdf,.doc,.docx,image/*,text/*,.json,.csv" 
                  className="hidden" 
                />
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Path:</span> {breadcrumb}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={()=>{ toggleFolder('home') }}>Back to Home</Button>
                <Button variant="ghost" size="sm" onClick={()=>{
                  if (selectedPath.length > 1) {
                    const parent = [...selectedPath].reverse().find((p, idx) => idx>0 && p.type==='folder')
                    const parentId = selectedPath[selectedPath.length - 2]?.id
                    if (parentId) toggleFolder(parentId)
                  }
                }}>Back one</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-2 gap-2">
            <div className="text-xs text-muted-foreground">Upload destination: {breadcrumb}</div>
            <Button variant="outline" onClick={() => handleCreateFolder(selectedFolderId)}>New Folder</Button>
          </div>
          <ScrollArea className="h-[60vh] p-2 border rounded-md">
            {files.length > 0 ? renderFileTree(files) : <p className="text-muted-foreground text-center p-8">Your bank is empty. Upload some files to get started.</p>}
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Move Dialog with folder browser */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedItem?.type} to...</DialogTitle>
          </DialogHeader>
          {(() => {
            const [browseId, setBrowseId] = (function(){
              // lightweight state shim using refs in closure is not available; use useState above? we keep simple by reusing moveTargetId as current browse id
              // if moveTargetId not set, default to selectedFolderId or 'home'
              // We'll just compute local vars and set on clicks via setMoveTargetId
              return [moveTargetId || 'home', (id: string)=>setMoveTargetId(id)] as [string, (id:string)=>void]
            })()
            const browsePath = findPath(files, browseId) || []
            const browseNode = getById(files, browseId)
            const children = (browseNode && browseNode.type==='folder' && browseNode.items) ? browseNode.items.filter(i=>i.type==='folder') : []
            const canGoUp = browsePath.length > 1
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="truncate">Destination: {browsePath.map(p=>p.name).join(' / ')}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!canGoUp} onClick={()=>{ if (canGoUp) { const pid = browsePath[browsePath.length-2].id; setMoveTargetId(pid) }}}>Up one</Button>
                    <Button size="sm" onClick={()=>setMoveTargetId(browseId)}>Select here</Button>
                  </div>
                </div>
                <div className="max-h-60 overflow-auto border rounded">
                  {children.length === 0 && <div className="p-3 text-sm text-muted-foreground">No subfolders</div>}
                  {children.map(f => (
                    <div key={f.id} className={cn('p-2 cursor-pointer hover:bg-muted flex items-center justify-between', (moveTargetId===f.id) && 'bg-muted')} onClick={()=>setMoveTargetId(f.id)}>
                      <div className="flex items-center gap-2"><Folder className="h-4 w-4" /> {f.name}</div>
                      <Button size="sm" variant="ghost" onClick={(e)=>{ e.stopPropagation(); setMoveTargetId(f.id); }}>Choose</Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={()=>{
              if (!selectedItem || !moveTargetId) return;
              // Disallow moving a folder into itself or its descendant
              const selPath = findPath(files, selectedItem.id) || []
              const destPath = findPath(files, moveTargetId) || []
              if (moveTargetId === selectedItem.id || destPath.find(n => n.id === selectedItem.id)) {
                toast({ title: 'Cannot move into itself or its descendant.' });
                return;
              }
              let removed: FileOrFolder | null = null;
              const withoutItem = findAndMutate(files, selectedItem.id, (arr, index) => {
                removed = arr[index];
                const newArr = [...arr];
                newArr.splice(index, 1);
                return newArr;
              });
              if (!removed) return;
              const inserted = findAndMutate(withoutItem, moveTargetId, (arr, idx) => {
                const newArr = [...arr];
                const folder = newArr[idx];
                const items = folder.items ? [...folder.items] : [];
                items.push(removed!);
                newArr[idx] = { ...folder, items };
                return newArr;
              });
              updateFiles(inserted);
              setIsMoveDialogOpen(false);
              setSelectedItem(null);
              setMoveTargetId(null);
              toast({ title: 'Item moved.' });
            }}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {selectedItem?.type}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="newName" className="sr-only">Name</Label>
            <Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* CSV Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <textarea className="w-full h-80 border rounded p-2 font-mono text-sm" value={editorText} onChange={(e)=>setEditorText(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={()=>{
              if (!editorItemId) return
              const newFiles = findAndMutate(files, editorItemId, (arr, idx) => {
                const newArr = [...arr]
                newArr[idx] = { ...newArr[idx], content: editorText, mime: 'text/csv' }
                return newArr
              })
              updateFiles(newFiles)
              toast({ title: 'CSV saved.' })
              setIsEditorOpen(false)
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "{selectedItem?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({variant: "destructive"}))}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
