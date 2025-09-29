import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription as DialogDesc } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent, GoalFile } from "../../types/calendar"; // Assuming CalendarEvent and GoalFile are defined or imported from a shared type file
import { format, parseISO } from "date-fns";
import { Trash2, Copy, File as FileIcon, Edit } from "lucide-react";

function EventDetailsDialog({ isOpen, onOpenChange, event, onEdit, onDelete, onDuplicate }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    event: CalendarEvent;
    onEdit: (event: CalendarEvent) => void;
    onDelete: (event: CalendarEvent) => void;
    onDuplicate: (event: CalendarEvent) => void;
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{event.text}</DialogTitle>
                    <DialogDesc>
                        {event.instanceDate && format(parseISO(event.instanceDate), 'EEEE, MMMM d, yyyy')}
                        {event.startTime && ` • ${event.startTime} - ${event.endTime}`}
                    </DialogDesc>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                    <div className="py-4 space-y-4">
                        {event.notes && (
                            <div className="space-y-2">
                                <h4 className="font-medium text-sm">Notes</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap p-2 bg-muted/70 rounded-md">{event.notes}</p>
                            </div>
                        )}
                        {event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {event.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                            </div>
                        )}
                        {event.files && event.files.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-medium text-sm">Attachments</h4>
                                {event.files.map(file => (
                                    <div key={file.id} className="flex items-center gap-2 text-sm p-1.5 bg-muted/70 rounded-md">
                                        <FileIcon className="h-4 w-4 flex-shrink-0" />
                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline">{file.name}</a>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!event.notes && !event.tags?.length && !event.files?.length && (
                            <p className="text-muted-foreground text-sm">No additional details for this event.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="justify-between pt-2 border-t">
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => onDelete(event)}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => onDuplicate(event)}>
                            <Copy className="h-4 w-4"/>
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                        <Button onClick={() => onEdit(event)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default EventDetailsDialog;