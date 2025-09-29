"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
    DialogDescription as DialogDesc,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Copy, File as FileIcon, Book } from "lucide-react";
import { format, addDays } from "date-fns";
import { CalendarEvent, RecurrenceRule, GoalFile } from "@/types/calendar";
import type { Goal } from "@/lib/goals-data";
import { mockGoalsData, flattenGoals } from "@/lib/goals-data"; // Assuming this is still needed here for recurrence editing
import { mockBankData, addFileToRoot, updateBankData } from "@/lib/bank-data"; // Assuming this is still needed here for saving notes

export interface EventEditorDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Partial<Goal>, event?: CalendarEvent) => void;
    dialogState: { event?: CalendarEvent, defaultDate?: Date, defaultTime?: string };
    allTags: string[];
    onDeleteRequest: (event: CalendarEvent) => void;
    onDuplicateRequest: (event: CalendarEvent) => void;
}

export function EventEditorDialog({
    isOpen,
    onOpenChange,
    onSave,
    dialogState,
    allTags,
    onDeleteRequest,
    onDuplicateRequest,
}: EventEditorDialogProps) {
    const { toast } = useToast();
    const { event, defaultDate, defaultTime } = dialogState;

    const [text, setText] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("");
    const [tags, setTags] = useState("");
    const [files, setFiles] = useState<GoalFile[]>([]);
    const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
    const [weeklyDays, setWeeklyDays] = useState<Set<RecurrenceRule["byday"][0]>>(new Set());
    const [notes, setNotes] = useState("");

    useEffect(() => {
        const goalDateStr =
            event?.instanceDate ||
            (defaultDate ? format(defaultDate, "yyyy-MM-dd") : "");

        setText(event?.text || "");
        setDueDate(goalDateStr);
        setStartTime(event?.startTime || defaultTime || "09:00");
        setEndTime(event?.endTime || "");
        setTags(event?.tags?.join(", ") || "");
        setFiles(event?.files || []);
        setNotes(event?.notes || "");

        // Find the master recurring goal if editing an instance
        const masterRecurrence = event?.recurrenceId
            ? mockGoalsData
                  .flatMap((s) => flattenGoals(s.goals, s.name, s.id))
                  .find((g: any) => g.id === event.recurrenceId)?.recurrence
            : event?.recurrence;
        setRecurrence(masterRecurrence || null);
        setWeeklyDays(new Set(masterRecurrence?.byday || []));
    }, [dialogState, event, defaultDate, defaultTime]);

    useEffect(() => {
        if (!endTime && startTime) {
            const [h, m] = startTime.split(":").map(Number);
            const startDateObj = new Date();
            startDateObj.setHours(h, m);
            const endDate = addDays(startDateObj, h + 1 >= 24 ? 1 : 0);
            endDate.setHours((h + 1) % 24, m);
            setEndTime(format(endDate, "HH:mm"));
        }
    }, [startTime, endTime]);

    const handleDayToggle = (day: RecurrenceRule["byday"][0]) => {
        setWeeklyDays((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(day)) newSet.delete(day);
            else newSet.add(day);
            return newSet;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = e.target.files;
        if (!uploadedFiles) return;

        const newFiles: GoalFile[] = Array.from(uploadedFiles).map((file) => ({
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            type: file.type,
            url: URL.createObjectURL(file),
        }));
        setFiles((prev) => [...prev, ...newFiles]);
    };

    const removeFile = (fileId: string) =>
        setFiles((prev) => prev.filter((f) => f.id !== fileId));

    const handleSubmit = () => {
        if (
            recurrence &&
            (recurrence.frequency === "weekly" ||
                recurrence.frequency === "bi-weekly") &&
            weeklyDays.size === 0
        ) {
            toast({
                title: "Please select at least one day for weekly recurrence.",
                variant: "destructive",
            });
            return;
        }

        const tagsArray = tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        const recurrenceRule = recurrence
            ? {
                  ...recurrence,
                  byday:
                      recurrence.frequency === "weekly" ||
                      recurrence.frequency === "bi-weekly"
                          ? Array.from(weeklyDays)
                          : undefined,
              }
            : undefined;

        onSave(
            {
                text,
                dueDate,
                startTime,
                endTime,
                tags: tagsArray,
                files,
                recurrence: recurrenceRule,
                notes,
            },
            dialogState.event
        );
    };

    const handleSaveToBank = () => {
        if (!notes.trim()) {
            toast({
                title: "Notes are empty",
                description: "Please write some notes before saving to the bank.",
                variant: "destructive",
            });
            return;
        }
        const fileName = `${event?.text || "New Event"} Notes.txt`;
        const newFile = {
            id: `file-${Date.now()}`,
            type: "file" as const,
            name: fileName,
            content: notes,
        };
        updateBankData(addFileToRoot(mockBankData, newFile));
        toast({
            title: "Note saved to Bank!",
            description: `Created "${fileName}" in your Bank.`,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {dialogState.event ? "Edit Event" : "Create New Event"}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="event-text">Event Name</Label>
                            <Input
                                id="event-text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="e.g., Study Session"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event-tags">
                                Tags (comma-separated)
                            </Label>
                            <Input
                                id="event-tags"
                                list="tags-list"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="e.g., reading, important, practice"
                            />
                            <datalist id="tags-list">
                                {allTags.map((tag) => (
                                    <option key={tag} value={tag} />
                                ))}
                            </datalist>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="event-due-date">Date</Label>
                                <Input
                                    id="event-due-date"
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label htmlFor="event-start-time">
                                        Start Time
                                    </Label>
                                    <Input
                                        id="event-start-time"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) =>
                                            setStartTime(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="event-end-time">
                                        End Time
                                    </Label>
                                    <Input
                                        id="event-end-time"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) =>
                                            setEndTime(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="recurrence-toggle"
                                    className="font-medium"
                                >
                                    Repeat Event
                                </Label>
                                <Switch
                                    id="recurrence-toggle"
                                    checked={!!recurrence}
                                    onCheckedChange={(checked) =>
                                        setRecurrence(
                                            checked
                                                ? { frequency: "weekly" }
                                                : null
                                        )
                                    }
                                />
                            </div>
                            {recurrence && (
                                <div className="pl-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="recurrence-freq">
                                                Frequency
                                            </Label>
                                            <Select
                                                value={recurrence.frequency}
                                                onValueChange={(
                                                    val: RecurrenceRule["frequency"]
                                                ) =>
                                                    setRecurrence({
                                                        ...recurrence,
                                                        frequency: val,
                                                    })
                                                }
                                            >
                                                <SelectTrigger id="recurrence-freq">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="daily">
                                                        Daily
                                                    </SelectItem>
                                                    <SelectItem value="weekly">
                                                        Weekly
                                                    </SelectItem>
                                                    <SelectItem value="bi-weekly">
                                                        Bi-weekly
                                                    </SelectItem>
                                                    <SelectItem value="monthly">
                                                        Monthly
                                                    </SelectItem>
                                                    <SelectItem value="yearly">
                                                        Yearly
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="recurrence-until">
                                                Until
                                            </Label>
                                            <Input
                                                id="recurrence-until"
                                                type="date"
                                                value={recurrence.until || ""}
                                                onChange={(e) =>
                                                    setRecurrence({
                                                        ...recurrence,
                                                        until: e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                    {(recurrence.frequency === "weekly" ||
                                        recurrence.frequency ===
                                            "bi-weekly") && (
                                        <div className="space-y-2">
                                            <Label>On Days</Label>
                                            <div className="flex justify-between gap-1">
              {([
                "SU",
                "MO",
                "TU",
                "WE",
                "TH",
                "FR",
                "SA",
              ] as const).map((day) => (
                <div
                  key={day}
                                                        className="flex flex-col items-center gap-1"
                                                    >
                                                        <Checkbox
                                                            id={`day-${day}`}
                                                            checked={weeklyDays.has(
                                                                day
                                                            )}
                                                            onCheckedChange={() =>
                                                                handleDayToggle(
                                                                    day
                                                                )
                                                            }
                                                        />
                                                        <Label
                                                            htmlFor={`day-${day}`}
                                                            className="text-xs"
                                                        >
                                                            {day}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            <Label htmlFor="event-files" className="font-medium">
                                Attachments
                            </Label>
                            <Input
                                id="event-files"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                            />
                            {files.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    {files.map((file) => (
                                        <div
                                            key={file.id}
                                            className="flex items-center gap-2 text-sm p-1.5 bg-muted/70 rounded-md"
                                        >
                                            <FileIcon className="h-4 w-4 flex-shrink-0" />
                                            <span className="flex-1 truncate">
                                                {file.name}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() =>
                                                    removeFile(file.id)
                                                }
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            <Label htmlFor="event-notes" className="font-medium">
                                Event Notes
                            </Label>
                            <Textarea
                                id="event-notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add any detailed notes for this event here..."
                                className="min-h-[120px]"
                            />
                            <div className="flex justify-end">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleSaveToBank}
                                >
                                    <Book className="mr-2 h-4 w-4" /> Save Notes
                                    to Bank
                                </Button>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="justify-between pt-4 border-t">
                    <div className="flex gap-2">
                        {dialogState.event && (
                            <>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        if (dialogState.event)
                                            onDeleteRequest(dialogState.event);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        if (dialogState.event)
                                            onDuplicateRequest(
                                                dialogState.event
                                            );
                                    }}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSubmit}>Save Event</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}