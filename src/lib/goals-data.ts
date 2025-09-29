
// --- TYPES ---
export type RecurrenceRule = {
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'yearly';
  byday?: ('SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA')[];
  until?: string; // ISO Date string
};

export type GoalFile = {
    id: string;
    name: string;
    url: string; // In a real app this would be a URL to the stored file
    type: string; // e.g. 'image/png', 'application/pdf'
};

export type Goal = {
  id: string;
  text: string;
  completed: boolean;
  subGoals: Goal[];
  notes?: string;
  dueDate?: string; // This is the START date for recurring events
  startTime?: string;
  endTime?: string;
  tags?: string[];
  files?: GoalFile[];
  recurrence?: RecurrenceRule;
  // Dates in 'yyyy-MM-dd' format for which this recurring event should not be generated.
  // Used when a single instance is deleted.
  recurrenceExceptions?: string[]; 
  // The original ID of the recurring event this one-off instance was derived from.
  // Used when a single instance is modified.
  recurrenceId?: string;
  // Optional reminder offset in days
  reminderDays?: number;
  // Optional manual progress controls (leave as-is if unused)
  progressCurrent?: number;
  progressTotal?: number;
};

export type Subject = {
  id: string;
  name: string;
  examDate?: string;
  startDate?: string;
  goals: Goal[];
};

// --- MOCK DATA (Simulates a database) ---
export let mockGoalsData: Subject[] = [
  {
    id: 'subj-1',
    name: 'Mathematics',
    examDate: '2024-09-15',
    startDate: '2024-07-01',
    goals: [
      { id: 'goal-1-1', text: 'Study: Differential Equations', completed: false, dueDate: '2024-08-05', startTime: '09:00', endTime: '10:30', tags: ['calculus', 'important'], subGoals: []},
      { id: 'goal-1-2', text: 'Meet with study group', completed: true, dueDate: '2024-08-05', startTime: '11:00', endTime: '12:30', tags: ['group-work'], subGoals: [] },
      { id: 'goal-1-3', text: 'Review Linear Algebra', completed: false, dueDate: '2024-08-07', startTime: '15:00', endTime: '16:00', tags: ['review'], subGoals: [] },
      { id: 'goal-1-4', text: 'Problem Set 4 Due', completed: false, dueDate: '2024-08-09', tags: ['assignment'], subGoals: [] },
      { id: 'goal-1-5', text: 'Quiz 3', completed: false, dueDate: '2024-08-14', startTime: '10:00', endTime: '11:00', tags: ['quiz', 'important'], subGoals: [] },
      { id: 'goal-1-6', text: 'Review for Midterm', completed: false, dueDate: '2024-08-19', tags: ['exam-prep'], subGoals: [] },
    ]
  },
  {
    id: 'subj-2',
    name: 'Physics',
    examDate: '2024-08-30',
    startDate: '2024-07-10',
    goals: [
       { id: 'goal-2-0', text: 'Lab Report Writing', completed: false, dueDate: '2024-08-05', startTime: '14:00', endTime: '16:00', tags: ['lab', 'writing'], subGoals: []},
       { id: 'goal-2-2', text: 'Kinematics practice', completed: false, dueDate: '2024-08-06', startTime: '13:00', endTime: '14:30', tags: ['practice'], subGoals: []},
       { id: 'goal-2-3', text: 'Weekly Lab Session', completed: false, dueDate: '2024-08-12', startTime: '13:00', endTime: '17:00', tags: ['lab', 'important'], subGoals: [], recurrence: { frequency: 'weekly', byday: ['MO'], until: '2024-09-30' } },
      { id: 'goal-2-1', text: 'Ace the Final Exam', completed: false, dueDate: '2024-08-30', tags: ['exam-prep', 'major-goal'], subGoals: [
        { id: 'goal-2-1-1', text: 'Review all lecture notes', completed: true, tags: ['review'], subGoals: [] },
        { id: 'goal-2-1-2', text: 'Solve all past exam papers', completed: false, dueDate: '2024-08-28', tags: ['practice', 'exam-prep'], subGoals: [] },
      ]},
    ]
  },
  {
    id: 'subj-general',
    name: 'General',
    goals: [
      { id: 'goal-g-1', text: 'Organize study space', completed: false, dueDate: '2024-08-08', startTime: '18:00', endTime: '19:00', tags: ['organization'], subGoals: [] },
    ]
  }
];

// --- HELPER FUNCTIONS ---
export function findAndMutateGoal(goals: Goal[], goalId: string, mutation: (goal: Goal) => Goal): [Goal[], boolean] {
  let hasMutated = false;
  const newGoals = goals.map(g => {
    if (g.id === goalId) {
      hasMutated = true;
      return mutation(g);
    }
    if (g.subGoals && g.subGoals.length > 0) {
      const [newSubGoals, subHasMutated] = findAndMutateGoal(g.subGoals, goalId, mutation);
      if (subHasMutated) {
        hasMutated = true;
        return { ...g, subGoals: newSubGoals };
      }
    }
    return g;
  });
  return [newGoals, hasMutated];
}

export function findAndRemoveGoal(goals: Goal[], goalId: string): [Goal[], boolean] {
  let wasRemoved = false;
  
  const remainingGoals = goals.filter(goal => {
    if (goal.id === goalId) {
      wasRemoved = true;
      return false;
    }
    return true;
  });

  if (wasRemoved) {
    return [remainingGoals, true];
  }
  
  const newGoals = goals.map(goal => {
    if (goal.subGoals && goal.subGoals.length > 0) {
      const [newSubGoals, removedInChildren] = findAndRemoveGoal(goal.subGoals, goalId);
      if (removedInChildren) {
        wasRemoved = true;
        return { ...goal, subGoals: newSubGoals };
      }
    }
    return goal;
  });

  return [newGoals, wasRemoved];
}

export const flattenGoals = (goals: Goal[], subjectName: string, subjectId: string): (Goal & { subjectName: string, subjectId: string })[] => {
    let allGoals: (Goal & { subjectName: string, subjectId: string })[] = [];
    for (const goal of goals) {
        allGoals.push({ ...goal, subjectName, subjectId });
        if (goal.subGoals && goal.subGoals.length > 0) {
            allGoals = allGoals.concat(flattenGoals(goal.subGoals, subjectName, subjectId));
        }
    }
    return allGoals;
};

export function addGoal(subjects: Subject[], subjectId: string, newGoal: Goal): Subject[] {
  return subjects.map(s => {
    if (s.id === subjectId) {
      return { ...s, goals: [...s.goals, newGoal] };
    }
    return s;
  });
}

// Compute weighted progress based on hierarchical sub-goals.
// Each subject has m top-level goals; each top-level goal weight = 1/m.
// If a goal has n sub-goals, each sub-goal inherits parentWeight/n, recursively.
// A node contributes its weight if marked completed; otherwise we recurse to its children.
export function computeWeightedCompletion(goals: Goal[]): number {
  if (!goals || goals.length === 0) return 0;
  const m = goals.length;
  let sum = 0;
  for (const g of goals) {
    sum += contribution(g, 1 / m);
  }
  return sum; // 0..1
}

function contribution(goal: Goal, weight: number): number {
  if (goal.completed) return weight;
  const children = goal.subGoals || [];
  if (children.length === 0) return 0;
  const n = children.length;
  let s = 0;
  for (const child of children) {
    s += contribution(child, weight / n);
  }
  return s;
}

// Remove passed deadlines (dueDate in the past) while preserving hierarchy.
// - If a node is passed and has no remaining children, it is removed.
// - If a node is passed but has children, its dueDate is cleared but the node is kept.
export function prunePassedDeadlines(goals: Goal[], now: Date): Goal[] {
  const result: Goal[] = [];
  for (const g of goals) {
    const childPruned = prunePassedDeadlines(g.subGoals || [], now);
    const isPassed = !!g.dueDate && new Date(g.dueDate).getTime() < now.getTime();
    if (isPassed && childPruned.length === 0) {
      // drop
      continue;
    }
    result.push({ ...g, subGoals: childPruned, ...(isPassed ? { dueDate: undefined } : {}) });
  }
  return result;
}
