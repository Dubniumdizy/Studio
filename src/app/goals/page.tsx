
"use client"

import React, { useState, useMemo, Fragment, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { runSchemaPreflight } from "@/lib/schemaPreflight";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, MoreVertical, Edit, Trash, Plus, FolderPlus, GanttChartSquare, CalendarClock, PartyPopper, X, Wand2, Hourglass, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { differenceInDays, format, parseISO, formatDistanceToNowStrict, isValid as isValidDate, subDays } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { mockSubjects as subjectConfigs } from "@/lib/subjects";
import { findAndMutateGoal, findAndRemoveGoal, flattenGoals, computeWeightedCompletion, mockGoalsData, type Subject, type Goal } from "@/lib/goals-data";
import { fetchSubjectsWithGoals, createSubject, updateSubject, deleteSubjectCascade as deleteSubjectDb, createGoal as createGoalDb, updateGoal as updateGoalDb, toggleGoal as toggleGoalDb, deleteGoal as deleteGoalDb, getOfflineOpsCount, syncPendingOps } from '@/lib/supabase-goals';
import { addOrUpdateGoalCalendarEvent, removeGoalCalendarEvent } from '@/lib/calendar-bridge';
import { Progress } from "@/components/ui/progress";

// Ensure unique IDs helper
function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of arr) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

type DeadlineGoal = Goal & { subjectName: string; subjectId: string };

// Simple UUID v4 pattern check
const isUuid = (s: string | undefined | null): boolean => {
  if (!s) return false
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)
}

// --- COMPONENTS ---

const UpcomingGoals = ({ goals, title, controls, showDelete, onDelete }: { goals: DeadlineGoal[]; title: string; controls?: React.ReactNode; showDelete?: boolean; onDelete?: (goalId: string, subjectId: string) => void }) => {
    const uniqueGoals = useMemo(() => dedupeById(goals), [goals]);
    return (
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>Filter and manage your deadlines.</CardDescription>
                </div>
              </div>
              {controls}
            </div>
        </CardHeader>
        <CardContent>
            {uniqueGoals.length > 0 ? (
                <div className="space-y-3">
                    {uniqueGoals.map(goal => (
                        <div key={goal.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                            <div className="relative">
                              <p className={cn("font-medium", goal.completed && "line-through decoration-green-500 decoration-2")}>{goal.text}</p>
                              <p className="text-xs text-muted-foreground">{goal.subjectName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {goal.dueDate && (
                                <p className="text-sm font-semibold text-primary">
                                  {formatDistanceToNowStrict(parseISO(goal.dueDate), { addSuffix: true })}
                                </p>
                              )}
                              {showDelete && (
                                <Button aria-label="Delete passed goal" variant="ghost" size="icon" onClick={() => onDelete && onDelete(goal.id, (goal as any).subjectId)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center p-4">No deadlines to show.</p>
            )}
        </CardContent>
    </Card>
    );
};

const ProgressChart = React.memo(({ subject, today }: { subject: Subject, today: Date | null }) => {
  const data = useMemo(() => {
    if (!today) return [];

    const topLevelGoals = subject.goals;
    // Weighted completion across nested sub-goals
    const weighted = computeWeightedCompletion(topLevelGoals);
    const actualProgress = Math.round(weighted * 100);

    let expectedProgress = 0;
    if (subject.startDate && subject.examDate) {
      const startDate = parseISO(subject.startDate);
      const examDate = parseISO(subject.examDate);
      const totalDuration = differenceInDays(examDate, startDate);
      const elapsedDuration = differenceInDays(today, startDate);
      if (totalDuration > 0 && elapsedDuration >= 0) {
        expectedProgress = Math.min(100, (elapsedDuration / totalDuration) * 100);
      }
    }
    
    return [{ 
      name: subject.name, 
      actual: Math.round(actualProgress), 
      expected: Math.round(expectedProgress) 
    }];
  }, [subject, today]);

  if (!today) return <div className="h-10 w-full animate-pulse bg-muted rounded-md" />;

  return (
    <div className="w-full md:w-1/3 h-16 flex items-center">
      <div className="flex-1 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barCategoryGap="20%">
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip 
              formatter={(value: number) => `${value}%`} 
              contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.5rem'
              }}
            />
            <Legend wrapperStyle={{fontSize: "0.7rem", paddingTop: '4px'}} iconSize={8} />
            <Bar dataKey="expected" name="Expected" fill="hsl(var(--muted-foreground))" radius={4} background={{ fill: 'hsl(var(--muted))', radius: 4 }} />
            <Bar dataKey="actual" name="Actual" fill="hsl(var(--primary))" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data[0] && data[0].actual >= 100 && (
        <div className="ml-2 text-primary popper-pop" aria-label="Completed!">
          <PartyPopper className="h-5 w-5" />
        </div>
      )}
    </div>
  );
});
ProgressChart.displayName = 'ProgressChart';


const GoalItem = React.memo(({ goal, onAction, level }: {
  goal: Goal;
  onAction: (action: string, goal: Goal) => void;
  level: number;
}) => (
  <Fragment>
    <div 
      className="group flex items-start gap-3 bg-background p-2 pr-1 rounded-md" 
      style={{ marginLeft: `${level * 24}px` }}
    >
      <Checkbox 
        id={goal.id} 
        checked={goal.completed} 
        onCheckedChange={() => onAction('toggle', goal)} 
        disabled={!isUuid(goal.id)}
        className="mt-1 flex-shrink-0"
      />
      <div className="flex-1 space-y-1.5 min-w-0 relative">
        <label htmlFor={goal.id} className={cn("font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", goal.completed && "line-through decoration-green-500 decoration-2") }>
          {goal.text}
        </label>
        {goal.dueDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Due: {format(parseISO(goal.dueDate), 'MMM d, yyyy')}</span>
            <span className="inline-flex items-center gap-1">
              <Hourglass className="h-3 w-3" />
              {formatDistanceToNowStrict(parseISO(goal.dueDate), { addSuffix: true })}
            </span>
          </div>
        )}
        {(goal.progressTotal ?? 0) > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Progress value={((goal.progressCurrent ?? 0) / goal.progressTotal!) * 100} className="h-2 w-24" />
            <span className="text-xs text-muted-foreground font-mono">
              {goal.progressCurrent ?? 0}/{goal.progressTotal}
            </span>
          </div>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onAction('edit', goal)}><Edit className="mr-2"/>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction('add_sub', goal)} disabled={!isUuid(goal.id)} title={!isUuid(goal.id) ? 'Save this goal first before adding sub-goals' : undefined}><Plus className="mr-2"/>Add Sub-goal</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction('suggest_breakdown', goal)} disabled={!isUuid(goal.id)} title={!isUuid(goal.id) ? 'Save this goal first before getting suggestions' : undefined}><Wand2 className="mr-2"/>Suggest breakdown</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction('delete', goal)} className="text-destructive"><Trash className="mr-2"/>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {goal.subGoals && goal.subGoals.length > 0 && (
      <GoalList goals={goal.subGoals} onAction={onAction} level={level + 1} />
    )}
  </Fragment>
));
GoalItem.displayName = 'GoalItem';

const GoalList = ({ goals, onAction, level = 0 }: { goals: Goal[], onAction: (action: string, goal: Goal) => void, level?: number }) => {
  const uniqueGoals = useMemo(() => dedupeById(goals), [goals]);
  return (
    <div className="space-y-2">
      {uniqueGoals.map(goal => (
        <GoalItem key={goal.id} goal={goal} onAction={onAction} level={level} />
      ))}
    </div>
  );
};

const SubjectGoals = React.memo(({ subject, onGoalAction, onOpenGoalDialog, onOpenSubjectDialog, onDeleteSubject, onApplyPrepPlan }: {
    subject: Subject;
    onGoalAction: (action: string, goal: Goal, subjectId: string) => void;
    onOpenGoalDialog: (subjectId: string) => void;
    onOpenSubjectDialog: (subject: Subject) => void;
    onDeleteSubject: (subjectId: string) => void;
    onApplyPrepPlan: (subjectId: string, exams: number, extraDays: number) => void;
}) => {
    const handleAction = useCallback((action: string, goal: Goal) => {
        onGoalAction(action, goal, subject.id);
    }, [onGoalAction, subject.id]);

    return (
        <div className="space-y-4 p-4 bg-muted/50">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold">Tasks</h4>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenSubjectDialog(subject)}><Edit className="mr-2 h-3 w-3" /> Edit Subject</Button>
                    <Button size="sm" onClick={() => onOpenGoalDialog(subject.id)} disabled={false /* keep enabled; creation guarded in handler */}><PlusCircle className="mr-2 h-4 w-4" /> New Goal</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onDeleteSubject(subject.id)} className="text-destructive"><Trash className="mr-2"/>Delete Subject</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Exam prep planner */}
            {subject.examDate ? (
              <div className="rounded-md border bg-background p-3">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">How many old exams will you attempt?</Label>
                    <Input type="number" min={0} defaultValue={3} id={`exams-${subject.id}`} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">How many extra buffer days?</Label>
                    <Input type="number" min={0} defaultValue={2} id={`buffer-${subject.id}`} />
                  </div>
                  <div className="flex-1 md:text-right">
                    {(() => {
                      const ex = (document.getElementById(`exams-${subject.id}`) as HTMLInputElement | null)?.value
                      const bf = (document.getElementById(`buffer-${subject.id}`) as HTMLInputElement | null)?.value
                      const exams = Number(ex ?? 3) || 0
                      const buffer = Number(bf ?? 2) || 0
                      const examDate = parseISO(subject.examDate as string)
                      const startPrep = subDays(examDate, exams + buffer)
                      const countdown = formatDistanceToNowStrict(startPrep, { addSuffix: true })
                      return (
                        <div className="text-xs text-muted-foreground">
                          Start exam prepping: <span className="font-medium">{format(startPrep, 'MMM d, yyyy')}</span> ({countdown})
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <div className="mt-2">
                  <Button size="sm" onClick={() => {
                    const exEl = document.getElementById(`exams-${subject.id}`) as HTMLInputElement | null
                    const bfEl = document.getElementById(`buffer-${subject.id}`) as HTMLInputElement | null
                    const exams = Number(exEl?.value || 0)
                    const buffer = Number(bfEl?.value || 0)
                    onApplyPrepPlan(subject.id, exams, buffer)
                  }}>Apply Plan (create/update "Start exam prepping" goal)</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                Set an exam date for this subject to plan exam prep backwards.
              </div>
            )}

            {subject.goals.length > 0 ? (
                <GoalList
                    goals={subject.goals}
                    onAction={handleAction}
                />
            ) : (
                <p className="text-center text-muted-foreground text-sm py-4">No goals for this subject yet. Add one to get started!</p>
            )}
        </div>
    );
});
SubjectGoals.displayName = 'SubjectGoals';


export default function GoalsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [useExample, setUseExample] = useState<boolean>(() => {
    try {
      const appVal = localStorage.getItem('app_use_example')
      const goalsVal = localStorage.getItem('goals_use_example')
      if (appVal === '1' || goalsVal === '1') return true
      return false
    } catch { return false }
  });
  
  const [dialogState, setDialogState] = useState<{ subjectId?: string, parentGoalId?: string, goal?: Goal }>({});
  const [subjectDialogState, setSubjectDialogState] = useState<{ subject?: Subject }>({});
  const [itemToDelete, setItemToDelete] = useState<{ type: 'subject' | 'goal', id: string, subjectId?: string } | null>(null);

  const { toast } = useToast();
  const [today, setToday] = useState<Date | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [pendingOps, setPendingOps] = useState<number>(0)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [syncing, setSyncing] = useState<boolean>(false)
  
  const updateSubjectsState = useCallback((newSubjects: Subject[]) => {
    setSubjects(newSubjects);
  }, []);

  // Helper: ensure we have an auth user id, otherwise redirect to login
  const ensureAuthOrRedirect = useCallback(async (): Promise<string | null> => {
    try {
      let uid = authUserId
      if (!uid) {
        const { supabase } = await import('@/lib/supabaseClient')
        const { data } = await supabase.auth.getSession()
        uid = data.session?.user?.id || null
        if (uid) setAuthUserId(uid)
      }
      if (!uid) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return null
      }
      return uid
    } catch {
      return null
    }
  }, [authUserId])

  useEffect(() => {
    // Online/offline watchers & pending ops
    try {
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
      setPendingOps(getOfflineOpsCount())
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      const handleStorage = (e: StorageEvent) => {
        if (!e.key || e.key === 'goals_offline_ops') setPendingOps(getOfflineOpsCount())
      }
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      window.addEventListener('storage', handleStorage)
      // cleanup
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        window.removeEventListener('storage', handleStorage)
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Load from Supabase on mount
    const run = async () => {
      setToday(new Date());

      // Schema preflight to surface missing columns early (non-blocking)
      runSchemaPreflight()
        .then(async (issues) => {
          if (issues.length > 0) {
            console.warn('Schema preflight issues:', issues)
            // Surface a visible notice so it's not missed
            try {
              const { toast } = await import('@/hooks/use-toast')
              toast({ title: 'Database schema missing fields', description: `${issues[0].resource}: ${issues[0].problem}. Check console for details.`, variant: 'destructive' as any })
            } catch {}
          }
        })
        .catch((e) => console.warn('Schema preflight failed:', e))

      // TODO: get real user id from your auth; for now, infer from supabase session
      const { data } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return
      }
      setAuthUserId(uid)
      if (!useExample) {
        const list = await fetchSubjectsWithGoals(uid)
        setSubjects(list)
        // update pending count after any attempted sync
        setPendingOps(getOfflineOpsCount())
      }
    }
    run()
  }, [useExample]);

  // Persist example toggle and swap data sets
  useEffect(() => {
    try {
      const v = useExample ? '1' : '0'
      localStorage.setItem('goals_use_example', v)
      localStorage.setItem('app_use_example', v)
    } catch {}
    if (useExample) {
      // Deep copy to avoid mutating template
      const copy: Subject[] = JSON.parse(JSON.stringify(mockGoalsData))
      setSubjects(copy)
    } else {
      // when turning off, ensure we have a session then reload real data
      (async () => {
        const uid = await ensureAuthOrRedirect()
        if (!uid) {
          // Revert back to example mode and inform user to sign in
          setUseExample(true)
          toast({ title: 'Sign in required', description: 'Please log in to view your real goals. Example data re-enabled.', variant: 'destructive' })
          return
        }
        try {
          const list = await fetchSubjectsWithGoals(uid)
          setSubjects(list)
        } catch (e) {
          console.warn('Failed to reload real data after toggling example off', e)
          setSubjects([])
        }
      })()
    }
  }, [useExample, ensureAuthOrRedirect])

  const [breakdownDialog, setBreakdownDialog] = useState<{ open: boolean; subjectId?: string; parent?: Goal }>(() => ({ open: false }));

  const handleGoalAction = useCallback(async (action: string, goal: Goal, subjectId: string) => {
    if (useExample) {
      toast({ title: 'Example data mode', description: 'Editing is disabled in example mode.', variant: 'destructive' })
      return
    }
    if (action === 'toggle') {
      if (!isUuid(goal.id)) {
        toast({ title: 'Please wait until the goal is saved', description: 'You can toggle completion once it has a real ID.', variant: 'destructive' })
        return
      }
      // persist toggle
      try {
        const uid = await ensureAuthOrRedirect()
        if (!uid) return
        await toggleGoalDb(goal.id, !goal.completed)
        setSubjects(currentSubjects => currentSubjects.map(s => {
          if (s.id !== subjectId) return s;
          const [newGoals] = findAndMutateGoal(s.goals, goal.id, g => ({...g, completed: !g.completed}));
          return {...s, goals: newGoals};
        }))
      } catch (e: any) {
        const msg = e?.message || 'Failed to toggle goal'
        toast({ title: 'Could not update goal', description: msg, variant: 'destructive' })
      }
    }

    if (action === 'edit') {
      setDialogState({ subjectId, goal });
      setIsGoalDialogOpen(true);
    } else if (action === 'add_sub') {
      if (!isUuid(goal.id)) {
        toast({ title: 'Please save the parent goal first', description: 'Wait a moment until the goal is saved, then add sub-goals.', variant: 'destructive' })
        return
      }
      setDialogState({ subjectId, parentGoalId: goal.id });
      setIsGoalDialogOpen(true);
    } else if (action === 'suggest_breakdown') {
      if (!isUuid(goal.id)) {
        toast({ title: 'Please save the goal first', description: 'Wait until the goal is saved, then try again.', variant: 'destructive' })
        return
      }
      setBreakdownDialog({ open: true, subjectId, parent: goal })
    } else if (action === 'delete') {
      setItemToDelete({ type: 'goal', id: goal.id, subjectId });
      setIsDeleteDialogOpen(true);
    }
  }, [useExample, toast]);

  const handleOpenGoalDialog = useCallback((subjectId: string) => {
    setDialogState({ subjectId });
    setIsGoalDialogOpen(true);
  }, []);
  
  const handleOpenSubjectDialog = useCallback((subject?: Subject) => {
    setSubjectDialogState({ subject });
    setIsSubjectDialogOpen(true);
  }, []);

const handleSaveGoal = useCallback(async (formData: { text: string; dueDate: string; reminderDays?: number; progressCurrent?: number, progressTotal?: number }, state: typeof dialogState) => {
    if (useExample) {
      toast({ title: 'Example data mode', description: 'Creating goals is disabled in example mode.', variant: 'destructive' })
      return
    }
    const { subjectId, parentGoalId, goal } = state;

    // Validate parent id is persisted (UUID) if creating a sub-goal
    if (parentGoalId && !isUuid(parentGoalId)) {
      toast({ title: 'Please save the parent goal first', description: 'Wait until the parent goal finishes saving, then add a sub-goal.', variant: 'destructive' })
      return
    }
    
    const userId = authUserId
    if (!userId) {
      toast({ title: 'Not signed in', description: 'Please log in to save goals.', variant: 'destructive' })
      return
    }

    // Build new data object
    const newGoalData = {
      text: formData.text,
      dueDate: formData.dueDate || undefined,
      reminderDays: formData.reminderDays ? Number(formData.reminderDays) : undefined,
      progressCurrent: formData.progressCurrent,
      progressTotal: formData.progressTotal,
    };

    if (goal) {
      // Editing: persist first
      await updateGoalDb(goal.id, {
        text: newGoalData.text,
        dueDate: newGoalData.dueDate ?? null,
        reminderDays: newGoalData.reminderDays ?? null,
        progressCurrent: newGoalData.progressCurrent ?? null,
        progressTotal: newGoalData.progressTotal ?? null,
      })
      // Calendar sync for edit (non-blocking)
      const prevDue = goal.dueDate
      const nextDue = newGoalData.dueDate
      if (nextDue) {
        addOrUpdateGoalCalendarEvent({ goalId: goal.id, title: newGoalData.text, dateISO: nextDue, durationMinutes: 60 }).catch(() => {})
      } else if (prevDue && !nextDue) {
        removeGoalCalendarEvent(goal.id).catch(() => {})
      }

      // Local state update
      setSubjects(current => current.map(s => {
        if (s.id !== subjectId) return s
        const [newGoals] = findAndMutateGoal(s.goals, goal.id, g => ({ ...g, ...newGoalData }))
        return { ...s, goals: newGoals }
      }))

      toast({ title: "Goal updated!" })
      setIsGoalDialogOpen(false)
    } else {
      // Optimistic creation: add temp goal immediately and close dialog
      const tempId = `temp-goal-${Date.now()}`
      const tempGoal: Goal = {
        id: tempId,
        text: newGoalData.text,
        completed: false,
        subGoals: [],
        dueDate: newGoalData.dueDate,
        progressCurrent: newGoalData.progressCurrent,
        progressTotal: newGoalData.progressTotal,
      }

      setSubjects(current => current.map(s => {
        if (s.id !== subjectId) return s
        if (parentGoalId) {
          const [newGoals] = findAndMutateGoal(s.goals, parentGoalId, g => ({ ...g, subGoals: dedupeById([...(g.subGoals || []), tempGoal]) }))
          return { ...s, goals: newGoals }
        }
        return { ...s, goals: dedupeById([...(s.goals || []), tempGoal]) }
      }))
      setIsGoalDialogOpen(false)

      try {
        const created = await createGoalDb(userId, {
          subjectId,
          parentGoalId,
          text: newGoalData.text,
          dueDate: newGoalData.dueDate,
          reminderDays: newGoalData.reminderDays,
          progressCurrent: newGoalData.progressCurrent,
          progressTotal: newGoalData.progressTotal,
        })

        // Replace temp with created
        setSubjects(current => current.map(s => {
          if (s.id !== subjectId) return s
          const replaceInTree = (goals: Goal[]): Goal[] => goals.map(g => {
            if (g.id === tempId) return { ...created, subGoals: [] }
            if ((g.subGoals || []).length) return { ...g, subGoals: replaceInTree(g.subGoals || []) }
            return g
          })
          if (parentGoalId) {
            const [newGoals] = findAndMutateGoal(s.goals, parentGoalId, g => ({ ...g, subGoals: replaceInTree(g.subGoals || []) }))
            return { ...s, goals: newGoals }
          }
          return { ...s, goals: replaceInTree(s.goals || []) }
        }))

        if (created.dueDate) {
          // Fire-and-forget calendar sync
          addOrUpdateGoalCalendarEvent({ goalId: created.id, title: created.text, dateISO: created.dueDate, durationMinutes: 60 }).catch(() => {})
        }
        toast({ title: 'Goal created!' })
      } catch (e: any) {
        // Revert optimistic temp goal on error
        setSubjects(current => current.map(s => {
          if (s.id !== subjectId) return s
          const removeFromTree = (goals: Goal[]): Goal[] => goals
            .filter(g => g.id !== tempId)
            .map(g => ((g.subGoals || []).length ? { ...g, subGoals: removeFromTree(g.subGoals || []) } : g))
          return { ...s, goals: removeFromTree(s.goals || []) }
        }))
        const msg = (e && (e.message || e.error_description || e.details)) ? (e.message || e.error_description || e.details) : (() => { try { return JSON.stringify(e) } catch { return String(e) } })()
        console.error('Create goal failed:', e, msg)
        toast({ title: 'Failed to create goal', description: msg || 'Please try again.', variant: 'destructive' })
      }
    }
  }, [toast, updateSubjectsState, authUserId]);
  
  const handleSaveSubject = useCallback(async (formData: { name: string; examDate: string; startDate: string; initialGoals?: string }, state: typeof subjectDialogState) => {
    try {
      if (useExample) {
        toast({ title: 'Example data mode', description: 'Creating subjects is disabled in example mode.', variant: 'destructive' })
        return
      }
      const userId = authUserId
      if (!userId) {
        toast({ title: 'Not signed in', description: 'Please log in to save subjects.', variant: 'destructive' })
        return
      }

      const clean = {
        name: formData.name,
        startDate: formData.startDate || null,
        examDate: formData.examDate || null,
      }

      const { subject } = state
      if (subject) {
        await updateSubject(subject.id, clean)
        setSubjects(curr => curr.map(s => s.id === subject.id ? { ...s, ...clean } : s))
        toast({ title: 'Subject updated!' })
      } else {
        // Optimistic insert: show immediately, then reconcile with server
        const tempId = `temp-${Date.now()}`
        const tempSubject: Subject = {
          id: tempId,
          name: clean.name,
          startDate: clean.startDate || undefined,
          examDate: clean.examDate || undefined,
          goals: []
        }
        setSubjects(curr => dedupeById([...curr, tempSubject]))
        setIsSubjectDialogOpen(false)

        try {
          const created = await createSubject(userId, clean)
          // If user picked a known subject template, seed default goals
          const template = mockGoalsData.find(s => s.name.toLowerCase() === (clean.name || '').toLowerCase())
          const initialList = (formData.initialGoals || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          if ((template && template.goals && template.goals.length) || initialList.length) {
            if (template && template.goals && template.goals.length) {
              await seedGoalsFromTemplate(userId, created.id, template.goals)
            }
            if (initialList.length) {
              for (const line of initialList) {
                await createGoalDb(userId, { subjectId: created.id, parentGoalId: null, text: line })
              }
            }
            // Reload to reflect full tree
            const refreshed = await fetchSubjectsWithGoals(userId)
            setSubjects(refreshed)
            toast({ title: 'Subject created with goals!' })
          } else {
            setSubjects(curr => curr.map(s => s.id === tempId ? { ...created, goals: s.goals } : s))
            toast({ title: 'Subject created!' })
          }
        } catch (e: any) {
          // Revert optimistic subject
          setSubjects(curr => curr.filter(s => s.id !== tempId))
          throw e
        }
      }
    } catch (err: any) {
      console.error('Save subject failed:', err)
      toast({ title: 'Failed to save subject', description: err?.message || 'Please try again.', variant: 'destructive' })
    }
  }, [toast, updateSubjectsState, authUserId]);

  // Seed helper: create a tree of goals for a subject based on a template
  const seedGoalsFromTemplate = useCallback(async (userId: string, subjectId: string, templateGoals: Goal[]) => {
    // recursive create preserving hierarchy
    const createTree = async (parentGoalId: string | null, goals: Goal[]) => {
      for (const g of goals) {
        const created = await createGoalDb(userId, {
          subjectId,
          parentGoalId,
          text: g.text,
          dueDate: g.dueDate,
          reminderDays: g.reminderDays,
          progressCurrent: g.progressCurrent,
          progressTotal: g.progressTotal,
        })
        if (g.subGoals && g.subGoals.length) {
          await createTree(created.id, g.subGoals)
        }
      }
    }
    await createTree(null, templateGoals)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return

    if (useExample) {
      toast({ title: 'Example data mode', description: 'Deleting is disabled in example mode.', variant: 'destructive' })
      setIsDeleteDialogOpen(false)
      setItemToDelete(null)
      return
    }

    if (itemToDelete.type === 'subject') {
      const subj = subjects.find(s => s.id === itemToDelete.id)
      const all = subj ? flattenGoals(subj.goals, subj.name, subj.id) : []
      try {
        await deleteSubjectDb(itemToDelete.id)
        // Remove calendar events in background
        Promise.allSettled(all.map(g => removeGoalCalendarEvent(g.id))).catch(() => {})
        setSubjects(curr => curr.filter(s => s.id !== itemToDelete.id))
        toast({ title: 'Subject deleted' })
      } catch (e: any) {
        console.error('Delete subject failed:', e)
        toast({ title: 'Failed to delete subject', description: e?.message || 'Please try again.', variant: 'destructive' })
      }
    } else {
      await deleteGoalDb(itemToDelete.id)
      await removeGoalCalendarEvent(itemToDelete.id)
      setSubjects(curr => curr.map(s => {
        if (s.id !== itemToDelete.subjectId) return s
        const [newGoals] = findAndRemoveGoal(s.goals, itemToDelete.id)
        return { ...s, goals: newGoals }
      }))
      toast({ title: 'Goal deleted' })
    }
    setIsDeleteDialogOpen(false)
    setItemToDelete(null)
  }, [itemToDelete, toast, updateSubjectsState]);
  
  const handleDeleteSubject = useCallback((subjectId: string) => {
    setItemToDelete({ type: 'subject', id: subjectId });
    setIsDeleteDialogOpen(true);
  }, []);

  const [deadlineFilter, setDeadlineFilter] = useState<'upcoming' | 'passed' | 'all'>('upcoming');

  const deadlines = useMemo(() => {
    const allGoals = subjects.flatMap(s => flattenGoals(s.goals, s.name, s.id));
    // Show both completed and incomplete deadlines; completed ones will be crossed out
    const unique = dedupeById(allGoals).filter(g => !!g.dueDate);
    const now = today ?? new Date();
    if (deadlineFilter === 'upcoming') {
      return unique
        .filter(g => parseISO(g.dueDate!).getTime() >= now.getTime())
        .sort((a, b) => parseISO(a.dueDate!).getTime() - parseISO(b.dueDate!).getTime());
    } else if (deadlineFilter === 'passed') {
      return unique
        .filter(g => parseISO(g.dueDate!).getTime() < now.getTime())
        .sort((a, b) => parseISO(b.dueDate!).getTime() - parseISO(a.dueDate!).getTime());
    }
    // all
    return unique.sort((a, b) => parseISO(a.dueDate!).getTime() - parseISO(b.dueDate!).getTime());
  }, [subjects, deadlineFilter, today]);

  const handleSyncNow = useCallback(async () => {
    if (syncing) return
    const uid = await ensureAuthOrRedirect()
    if (!uid) {
      toast({ title: 'Not signed in', description: 'Please log in to sync changes.', variant: 'destructive' })
      return
    }
    try {
      setSyncing(true)
      const remaining = await syncPendingOps(uid)
      // Reload subjects to reflect server state
      const list = await fetchSubjectsWithGoals(uid)
      setSubjects(list)
      setPendingOps(getOfflineOpsCount())
      if (remaining === 0) {
        toast({ title: 'All changes synced!' })
      } else {
        toast({ title: 'Partial sync', description: `${remaining} change(s) still pending. Will retry when online.` })
      }
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e?.message || 'Please try again later.', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }, [syncing, ensureAuthOrRedirect, toast])

  // Create or update a "Start exam prepping" goal based on X exams + Y extra days
  const applyExamPrepPlan = useCallback(async (subjectId: string, exams: number, extraDays: number) => {
    if (useExample) {
      toast({ title: 'Example data mode', description: 'Planning is disabled in example mode.', variant: 'destructive' })
      return
    }
    const subj = subjects.find(s => s.id === subjectId)
    if (!subj || !subj.examDate) {
      toast({ title: 'Exam date required', description: 'Please set an exam date for this subject first.', variant: 'destructive' })
      return
    }
    const examDate = parseISO(subj.examDate)
    const startPrep = subDays(examDate, Math.max(0, (Number(exams)||0) + (Number(extraDays)||0)))
    const startISO = format(startPrep, 'yyyy-MM-dd')
    const userId = await ensureAuthOrRedirect()
    if (!userId) return

    // Find existing prep goal by title
    const existing = flattenGoals(subj.goals, subj.name, subj.id).find(g => (g.text || '').toLowerCase() === 'start exam prepping')
    try {
      if (existing) {
        await updateGoalDb(existing.id, { text: 'Start exam prepping', dueDate: startISO, reminderDays: existing.reminderDays ?? null })
        setSubjects(curr => curr.map(s => {
          if (s.id !== subj.id) return s
          const [newGoals] = findAndMutateGoal(s.goals, existing.id, g => ({ ...g, dueDate: startISO }))
          return { ...s, goals: newGoals }
        }))
        addOrUpdateGoalCalendarEvent({ goalId: existing.id, title: 'Start exam prepping', dateISO: startISO, durationMinutes: 60 }).catch(() => {})
        toast({ title: 'Prep plan updated', description: `Start on ${format(startPrep, 'MMM d, yyyy')}` })
      } else {
        const created = await createGoalDb(userId, { subjectId: subj.id, text: 'Start exam prepping', dueDate: startISO })
        setSubjects(curr => curr.map(s => s.id === subj.id ? { ...s, goals: dedupeById([...(s.goals || []), { ...created, subGoals: [] } as any]) } : s))
        addOrUpdateGoalCalendarEvent({ goalId: created.id, title: created.text, dateISO: startISO, durationMinutes: 60 }).catch(() => {})
        toast({ title: 'Prep plan created', description: `Start on ${format(startPrep, 'MMM d, yyyy')}` })
      }
    } catch (e: any) {
      toast({ title: 'Failed to apply plan', description: e?.message || 'Please try again.', variant: 'destructive' })
    }
  }, [useExample, subjects, ensureAuthOrRedirect, toast])

  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {(pendingOps > 0 || !isOnline) && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-amber-900">
          <div className="text-sm">
            {!isOnline ? 'Offline' : 'Online'} • Pending changes: {pendingOps}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSyncNow} disabled={syncing || !isOnline}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <PageHeader 
          title="Goal Tracker"
          description="Set your long-term goals and break them down into achievable tasks."
        />
        <div className="flex items-center gap-2">
          <Button variant={useExample ? 'default' : 'outline'} onClick={() => setUseExample(v => !v)}>
            {useExample ? 'Remove Example Data' : 'Use Example Data'}
          </Button>
          <Button onClick={() => handleOpenSubjectDialog()} disabled={useExample}>
            <FolderPlus className="mr-2 h-4 w-4" /> New Subject Area
          </Button>
          {useExample && (
            <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">Example data mode</span>
          )}
        </div>
      </div>

      <UpcomingGoals 
        goals={deadlines as any}
        title="Deadlines"
        controls={(
          <div className="flex items-center gap-2">
            <Select value={deadlineFilter} onValueChange={(v) => setDeadlineFilter(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        showDelete={deadlineFilter === 'passed'}
        onDelete={async (goalId, subjectId) => {
          await deleteGoalDb(goalId)
          await removeGoalCalendarEvent(goalId)
          setSubjects(curr => curr.map(s => {
            if (s.id !== subjectId) return s
            const [newGoals] = findAndRemoveGoal(s.goals, goalId)
            return { ...s, goals: newGoals }
          }))
          toast({ title: 'Passed goal deleted' })
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Goal Progress by Subject</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" className="w-full">
            {dedupeById(subjects).map(subject => (
              <AccordionItem value={subject.id} key={subject.id}>
                <AccordionTrigger className="px-4 py-2 hover:bg-muted/50 hover:no-underline">
                  <div className="flex flex-col md:flex-row md:items-center justify-between w-full">
                    <div className="flex items-center gap-4 text-left">
                        <GanttChartSquare className="h-6 w-6 text-primary" />
                        <div>
                            <span className="text-lg font-semibold">{subject.name}</span>
                            {subject.examDate && <p className="text-sm text-muted-foreground">Exam on: {format(parseISO(subject.examDate), 'MMM d, yyyy')}</p>}
                        </div>
                    </div>
                    <ProgressChart subject={subject} today={today} />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                    <SubjectGoals
                        subject={subject}
                        onGoalAction={handleGoalAction}
                        onOpenGoalDialog={handleOpenGoalDialog}
                        onOpenSubjectDialog={handleOpenSubjectDialog}
                        onDeleteSubject={handleDeleteSubject}
                        onApplyPrepPlan={applyExamPrepPlan}
                    />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      
      {isGoalDialogOpen && <GoalEditorDialog isOpen={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen} onSave={handleSaveGoal} dialogState={dialogState} />}

      {isSubjectDialogOpen && <SubjectEditorDialog isOpen={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen} onSave={handleSaveSubject} dialogState={subjectDialogState} />}

      {breakdownDialog.open && breakdownDialog.parent && breakdownDialog.subjectId && (
        <SuggestBreakdownDialog
          isOpen={breakdownDialog.open}
          onOpenChange={(open) => setBreakdownDialog(prev => ({ ...prev, open }))}
          subjectId={breakdownDialog.subjectId}
          parentGoal={breakdownDialog.parent}
          onCreateSubgoals={async (tasks: string[]) => {
            if (useExample) { toast({ title: 'Example data mode', description: 'Editing is disabled in example mode.', variant: 'destructive' }); return }
            const uid = await ensureAuthOrRedirect(); if (!uid) return
            const subjectId = breakdownDialog.subjectId!
            const parent = breakdownDialog.parent!
            try {
              // Optimistic: append temp goals
              const temps = tasks.map((t, i) => ({ id: `temp-sub-${Date.now()}-${i}`, text: t, completed: false, subGoals: [] })) as Goal[]
              setSubjects(curr => curr.map(s => {
                if (s.id !== subjectId) return s
                const [newGoals] = findAndMutateGoal(s.goals, parent.id, g => ({ ...g, subGoals: dedupeById([...(g.subGoals || []), ...temps]) }))
                return { ...s, goals: newGoals }
              }))

              // Persist
              const created: Goal[] = []
              for (const t of tasks) {
                const row = await createGoalDb(uid, { subjectId, parentGoalId: parent.id, text: t })
                created.push({ ...row, subGoals: [] })
              }
              // Replace temps with real
              setSubjects(curr => curr.map(s => {
                if (s.id !== subjectId) return s
                const [newGoals] = findAndMutateGoal(s.goals, parent.id, g => ({ ...g, subGoals: (g.subGoals || []).filter(x => !(x.id || '').startsWith('temp-sub-')).concat(created as any) }))
                return { ...s, goals: newGoals }
              }))

              toast({ title: 'Sub-goals added!' })
              setBreakdownDialog({ open: false })
            } catch (e: any) {
              toast({ title: 'Failed to add sub-goals', description: e?.message || 'Please try again.', variant: 'destructive' })
            }
          }}
        />
      )}
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {itemToDelete?.type} and all its sub-items.
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

function GoalEditorDialog({ isOpen, onOpenChange, onSave, dialogState }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: { text: string; dueDate: string; reminderDays?: number; progressCurrent?: number, progressTotal?: number }, state: typeof dialogState) => void;
    dialogState: { goal?: Goal };
}) {
    const [text, setText] = useState(dialogState.goal?.text || "");
    const [dueDate, setDueDate] = useState(dialogState.goal?.dueDate || "");
    const [reminderDays, setReminderDays] = useState(dialogState.goal?.reminderDays);
    const [progressCurrent, setProgressCurrent] = useState(dialogState.goal?.progressCurrent);
    const [progressTotal, setProgressTotal] = useState(dialogState.goal?.progressTotal);
    const [isProgressTracking, setIsProgressTracking] = useState(dialogState.goal?.progressTotal !== undefined);


    const handleSubmit = () => {
        if (!text.trim()) return;
        onSave({ 
            text, 
            dueDate, 
            reminderDays: reminderDays ? Number(reminderDays) : undefined,
            progressCurrent: isProgressTracking ? Number(progressCurrent ?? 0) : undefined,
            progressTotal: isProgressTracking ? Number(progressTotal ?? undefined) : undefined,
        }, dialogState);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{dialogState.goal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="goal-text">Goal Description</Label>
                        <Textarea id="goal-text" value={text} onChange={e => setText(e.target.value)} placeholder="What do you want to achieve?" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="goal-due-date">Due Date (Optional)</Label>
                        <Input id="goal-due-date" type="date" value={dueDate ? format(parseISO(dueDate), 'yyyy-MM-dd') : ''} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="goal-reminder">Reminder (days before due)</Label>
                        <Input id="goal-reminder" type="number" value={reminderDays ?? ''} onChange={e => setReminderDays(e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g., 7" />
                        <p className="text-xs text-muted-foreground">
                            Triggers a warning in Analytics. Email notifications are a future feature.
                        </p>
                    </div>
                     <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="progress-toggle"
                                checked={isProgressTracking}
                                onCheckedChange={(checked) => setIsProgressTracking(!!checked)}
                            />
                            <Label htmlFor="progress-toggle" className="cursor-pointer font-medium">
                                Track Progress Quantitatively
                            </Label>
                        </div>
                        {isProgressTracking && (
                            <div className="pl-6 space-y-2 border-l ml-2 pt-2">
                                <p className="text-xs text-muted-foreground">
                                    For quantifiable goals like "Read X pages" or "Solve Y problems".
                                </p>
                                <div className="flex items-center gap-2">
                                    <Input id="goal-progress-current" type="number" value={progressCurrent ?? ''} onChange={e => setProgressCurrent(e.target.value ? Number(e.target.value) : undefined)} placeholder="Current" />
                                    <span className="text-muted-foreground">/</span>
                                    <Input id="goal-progress-total" type="number" value={progressTotal ?? ''} onChange={e => setProgressTotal(e.target.value ? Number(e.target.value) : undefined)} placeholder="Total" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SuggestBreakdownDialog({ isOpen, onOpenChange, subjectId, parentGoal, onCreateSubgoals }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    subjectId: string;
    parentGoal: Goal;
    onCreateSubgoals: (tasks: string[]) => void | Promise<void>;
  }) {
    const [description, setDescription] = useState(parentGoal.text || '');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [variant, setVariant] = useState(0);

    useEffect(() => {
      // Seeded RNG for stable but varied remixes per variant value
      const mulberry32 = (a: number) => {
        return function() {
          let t = (a += 0x6D2B79F5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };
      const rng = mulberry32(variant || 1);
      const shuffle = <T,>(arr: T[]): T[] => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      const pickN = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, Math.min(n, arr.length));

      const concise = (text: string): string[] => {
        const raw = (text || '').trim();
        if (!raw) return [];
        const t = raw.toLowerCase();
        // Extract up to 3 meaningful keywords to keep suggestions tied to the goal
        const stop = new Set(['the','a','an','for','to','of','and','on','in','with','by','from','your','my','our','at','as','about','into','over','under']);
        const words = raw
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .map(w => w.trim())
          .filter(w => w.length > 2 && !stop.has(w.toLowerCase()));
        const keywords = Array.from(new Set(words)).slice(0, 3);
        const tag = keywords.length ? ` (${keywords.join(', ')})` : '';

        const out: string[] = [];
        const push = (s: string) => { if (s.trim()) out.push(s.replace(/\s+/g,' ').trim()); };

        const has = (...ks: string[]) => ks.some(k => t.includes(k));

        // Three-phase study pipeline for everything: Basics -> Test -> Repeat
        const basicsPool = [
          `Skim syllabus/TOC to list topics${tag}`,
          `Preview lecture slides; capture key defs/formulas${tag}`,
          `Create one-page 'Basics' cheat sheet${tag}`,
          `Create flashcards deck in app${tag}`
        ];
        const testPool = [
          `Add 15–20 flashcards (defs + formulas)${tag}`,
          `Active recall: 1 flashcard session (10m)${tag}`,
          `Solve 5 practice questions; flag misses${tag}`,
          `Mini-quiz: 10-minute timed test${tag}`
        ];
        const repeatPool = [
          `Write 5-sentence summary from memory${tag}`,
          `Save difficult questions to Bank/Difficult folder${tag}`,
          `Schedule spaced repetition in calendar (24h, 72h, 1w)${tag}`,
          `Review error log; add new flashcards${tag}`
        ];

        if (has('exam','test','quiz','midterm','final')) {
          basicsPool.push(`List exam topics from syllabus${tag}`, `Collect allowed formulas/notes${tag}`);
          testPool.push(`Attempt 1 past-exam section (timed)${tag}`, `Check solutions; tag weak topics${tag}`);
        }
        if (has('read','reading','book','chapter','chapters','pages')) {
          basicsPool.push(`Split reading into sections; set targets${tag}`);
          testPool.push(`After each section: 5 recall Qs${tag}`);
        }

        // Pick 2 from each phase to keep it concise
        pickN(basicsPool, 2).forEach(push);
        pickN(testPool, 2).forEach(push);
        pickN(repeatPool, 2).forEach(push);
        return out;
      };
      const s = concise(parentGoal.text || description);
      setSuggestions(s);
      setSelected(Object.fromEntries(s.map(x => [x, true])));
    }, [parentGoal.text, description, variant]);

    const handleAdd = async () => {
      const tasks = suggestions.filter(s => selected[s]);
      if (tasks.length === 0) return;
      await Promise.resolve(onCreateSubgoals(tasks));
    };

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[720px]">
          <DialogHeader>
            <DialogTitle>AI suggestions to break down the task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Task</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              <p className="text-xs text-muted-foreground">Suggestions update automatically based on the task description.</p>
            </div>
            <div className="space-y-2">
              <Label>Suggested sub-goals</Label>
              <div className="space-y-2">
                {suggestions.map(s => (
                  <label key={s} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={!!selected[s]} onCheckedChange={(v) => setSelected(prev => ({ ...prev, [s]: !!v }))} />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setVariant(v => v + 1)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
              </Button>
            </div>
            <div className="flex gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleAdd}><Wand2 className="mr-2 h-4 w-4" /> Add selected as sub-goals</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

function SubjectEditorDialog({ isOpen, onOpenChange, onSave, dialogState }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: { name: string; startDate: string; examDate: string; initialGoals?: string }, state: typeof dialogState) => void;
    dialogState: { subject?: Subject };
}) {
    const [name, setName] = useState(dialogState.subject?.name || "");
    const [saving, setSaving] = useState(false);
    const [startDate, setStartDate] = useState(dialogState.subject?.startDate ? format(parseISO(dialogState.subject.startDate), 'yyyy-MM-dd') : "");
    const [examDate, setExamDate] = useState(dialogState.subject?.examDate ? format(parseISO(dialogState.subject.examDate), 'yyyy-MM-dd') : "");
    const [isCreatingNew, setIsCreatingNew] = useState(!dialogState.subject);
    const [initialGoals, setInitialGoals] = useState<string>("");

    const [nameError, setNameError] = useState<string | null>(null)
    const [startDateError, setStartDateError] = useState<string | null>(null)
    const [examDateError, setExamDateError] = useState<string | null>(null)

    const validateName = (v: string) => {
        if (!v.trim()) return 'Name is required'
        return null
    }
    const validateDate = (v: string) => {
        if (!v) return null
        const d = parseISO(v)
        return isValidDate(d) ? null : 'Invalid date'
    }

    useEffect(() => {
        setNameError(validateName(name))
        setStartDateError(validateDate(startDate))
        setExamDateError(validateDate(examDate))
    }, [name, startDate, examDate])
    
    const handleNameSelect = (value: string) => {
        if (value === '--create-new--') {
            setName('');
            setIsCreatingNew(true);
        } else {
            setName(value);
            setIsCreatingNew(false);
        }
    };

    const canSave = !validateName(name) && !validateDate(startDate) && !validateDate(examDate)

    const handleSubmit = async () => {
        if (!canSave || saving) return;
        try {
          setSaving(true);
          await Promise.resolve(onSave({ name, startDate, examDate, initialGoals }, dialogState));
        } finally {
          // If the dialog remains open for some reason, allow another attempt
          setTimeout(() => setSaving(false), 1500);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{dialogState.subject ? 'Edit Subject' : 'Create New Subject'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="subject-name">Subject Name</Label>
                        {dialogState.subject ? (
                             <>
                               <Input id="subject-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Mathematics" aria-invalid={!!nameError} />
                               {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
                             </>
                        ) : isCreatingNew ? (
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Input id="subject-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Personal Project" aria-invalid={!!nameError} />
                                  {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
                                </div>
                                <Button variant="outline" onClick={() => setIsCreatingNew(false)}>Select</Button>
                            </div>
                        ) : (
                             <Select onValueChange={handleNameSelect} defaultValue="">
                                <SelectTrigger id="subject-name">
                                    <SelectValue placeholder="Select a subject from your list..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjectConfigs.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                    <SelectSeparator />
                                    <SelectItem value="--create-new--">
                                        <span className="font-medium text-primary">Create a new subject...</span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="subject-start-date">Start Date (for progress tracking)</Label>
                        <Input id="subject-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} aria-invalid={!!startDateError} />
                        {startDateError && <p className="text-xs text-destructive mt-1">{startDateError}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="subject-exam-date">Exam date</Label>
                        <Input id="subject-exam-date" type="date" value={examDate} onChange={e => setExamDate(e.target.value)} aria-invalid={!!examDateError} />
                        {examDateError && <p className="text-xs text-destructive mt-1">{examDateError}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="subject-initial-goals">Initial goals (one per line, optional)</Label>
                        <Textarea id="subject-initial-goals" value={initialGoals} onChange={e => setInitialGoals(e.target.value)} placeholder="e.g.\nRead chapter 1\nSolve problem set 1\nBook study group room" />
                        <p className="text-xs text-muted-foreground">These goals will be created under this subject after saving.</p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
