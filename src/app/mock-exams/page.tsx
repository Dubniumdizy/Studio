'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AlertCircle, Upload, Clock, CheckCircle, Loader2, Home, Zap, Brain, ListChecks } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import { generateExamQuestions, type GenerateExamQuestionsOutput } from '@/ai/flows/generate-exam-questions';
import { MockExamService, type MockExamSession } from '@/lib/mock-exam-data';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import DatabaseService from '@/lib/database';
import { supabase } from '@/lib/supabaseClient';
import type { Subject } from '@/lib/supabase';

type PageView = 'home' | 'timer' | 'exams' | 'statistics';
type ExamState = 'upload' | 'reviewing' | 'taking' | 'completed';

const EXAMPLE_DATA: MockExamSession[] = [
  { id: '1', user_id: 'example', exam_title: 'Calculus I - Exam 1', number_of_questions: 10, time_taken_minutes: 45.5, grade: 'A', used_solution: false, created_at: '2025-10-13', updated_at: '2025-10-13' },
  { id: '2', user_id: 'example', exam_title: 'Calculus I - Exam 2', number_of_questions: 10, time_taken_minutes: 52.0, grade: 'B', used_solution: true, created_at: '2025-10-14', updated_at: '2025-10-14' },
  { id: '3', user_id: 'example', exam_title: 'Calculus I - Exam 3', number_of_questions: 10, time_taken_minutes: 38.5, grade: 'A', used_solution: false, created_at: '2025-10-15', updated_at: '2025-10-15' },
  { id: '4', user_id: 'example', exam_title: 'Calculus I - Exam 4', number_of_questions: 10, time_taken_minutes: 48.0, grade: 'C', used_solution: true, created_at: '2025-10-16', updated_at: '2025-10-16' },
];

export default function MockExamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pageView, setPageView] = useState<PageView>('home');
  const [examState, setExamState] = useState<ExamState>('upload');
  const [isPending, startTransition] = useTransition();
  
  // Timer state
  const [timerMode, setTimerMode] = useState<'countdown' | 'stopwatch'>('stopwatch');
  const [timerDuration, setTimerDuration] = useState('30');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [showTimerCompletion, setShowTimerCompletion] = useState(false);
  const [timerGrade, setTimerGrade] = useState<'F' | 'E' | 'D' | 'C' | 'B' | 'A' | ''>('');
  const [timerUsedSolution, setTimerUsedSolution] = useState(false);

  // Exam state
  const [examData, setExamData] = useState<GenerateExamQuestionsOutput | null>(null);
  const [sessions, setSessions] = useState<MockExamSession[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<'F' | 'E' | 'D' | 'C' | 'B' | 'A' | ''>('');
  const [usedSolution, setUsedSolution] = useState(false);
  const [showExamCompletion, setShowExamCompletion] = useState(false);
  const [useExampleData, setUseExampleData] = useState(false);
  const [examExportTitle, setExamExportTitle] = useState('exam-export');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>('');
  const [showSubjectSelect, setShowSubjectSelect] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  // Load user and subjects from Supabase
  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id ?? null;
        setUserId(uid);
        if (!uid) {
          setSubjects([]);
          return;
        }
        const rows = await DatabaseService.getSubjects(uid);
        setSubjects(rows);
        if (rows.length > 0 && !filterSubject) {
          setFilterSubject(rows[0].name);
        }
      } catch (e) {
        console.warn('Failed to load subjects', e);
      }
    })();
  }, []);

  // Load sessions
  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await MockExamService.getExamSessions();
        setSessions(data);
      } catch (e) {
        // Silently fail
      }
    });
  }, []);

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (timerMode === 'countdown' && prev <= 1) {
          setIsTimerRunning(false);
          setShowTimerCompletion(true);
          // Play bell sound
          playBell();
          return 0;
        }
        return timerMode === 'countdown' ? prev - 1 : prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerMode]);

  // Bell sound effect
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [bellPlaying, setBellPlaying] = useState(false);

  const playBell = () => {
    setBellPlaying(true);
    // Create an oscillator bell sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Create bell-like tone: multiple frequencies
    const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    frequencies.forEach((freq, idx) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
      osc.start(now + idx * 0.1);
      osc.stop(now + 2 + idx * 0.1);
    });
  };

  const stopBell = () => {
    setBellPlaying(false);
  };

  const handleExportExamJSON = async () => {
    if (!examData) return;
    try {
      const json = JSON.stringify(examData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      // Save to BANK folder on server (no local download)
      const formData = new FormData();
      formData.append('file', blob, `${examExportTitle}.json`);
      formData.append('exam_data', JSON.stringify(examData));
      
      await fetch('/api/exam-bank/save', {
        method: 'POST',
        body: formData,
      });
      
      toast({ title: 'Success', description: 'Exam saved to BANK' });
    } catch (error) {
      console.error('Error saving exam:', error);
      toast({ title: 'Error', description: 'Failed to save exam' });
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    if (timerMode === 'countdown' && (!timerDuration || parseInt(timerDuration) <= 0)) {
      toast({ title: 'Error', description: 'Please set a valid time limit.', variant: 'destructive' });
      return;
    }
    setShowSubjectSelect(true);
  };

  const handleConfirmSubject = () => {
    if (!selectedSubject) {
      toast({ title: 'Error', description: 'Please select a subject.', variant: 'destructive' });
      return;
    }
    // Set the subject name for saving later
    const subject = subjects.find(s => s.id === selectedSubject);
    if (subject) {
      setSelectedSubjectName(subject.name);
    }
    
    // Initialize timer
    if (timerMode === 'countdown') {
      const minutes = parseInt(timerDuration);
      if (isNaN(minutes) || minutes <= 0) {
        toast({ title: 'Error', description: 'Please set a valid time limit.', variant: 'destructive' });
        return;
      }
      setElapsedSeconds(minutes * 60);
    } else {
      setElapsedSeconds(0);
    }
    
    setShowSubjectSelect(false);
    setTimerStarted(true);
    setIsTimerRunning(true);
  };

  const handleTimerDone = () => {
    setIsTimerRunning(false);
    setShowTimerCompletion(true);
    playBell();
  };

  const handleSaveTimerSession = async () => {
    if (!timerGrade) {
      toast({ title: 'Error', description: 'Please select a grade.', variant: 'destructive' });
      return;
    }
    try {
      const session = await MockExamService.saveExamSession({
        exam_title: `${selectedSubjectName} - Study Session`,
        number_of_questions: 0,
        time_taken_minutes: elapsedSeconds / 60,
        grade: timerGrade,
        used_solution: timerUsedSolution,
      });
      setSessions([session, ...sessions]);
      const isLocal = String(session.id).startsWith('local-');
      toast({ title: isLocal ? 'Saved locally' : 'Success', description: isLocal ? 'Session saved offline (not signed in). It will still show in your stats.' : 'Session saved!' });
    } catch (e: any) {
      const msg = e?.message || 'Could not save session.';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setShowTimerCompletion(false);
      setTimerStarted(false);
      setElapsedSeconds(0);
      setSelectedSubject('');
      setSelectedSubjectName('');
      setTimerGrade('');
      setTimerUsedSolution(false);
      setPageView('statistics');
    }
  };

  // Exam handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleGenerateQuestions = () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: 'Please upload at least one exam PDF.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const exams = await Promise.all(
          uploadedFiles.map(async (file) => {
            return new Promise<{ name: string; dataUri: string }>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                resolve({ name: file.name, dataUri: ev.target?.result as string });
              };
              reader.readAsDataURL(file);
            });
          })
        );

        const result = await generateExamQuestions({ exams, numberOfQuestions: 10 });
        setExamData(result);
        setExamState('reviewing');
        setSelectedGrade('');
        setUsedSolution(false);
        setExamExportTitle(result.examTitle.replace(/\s+/g, '-').toLowerCase());
        toast({ title: 'Success', description: 'Exam generated!' });
      } catch (e: any) {
        toast({ title: 'Error', description: e.message || 'Failed to generate questions.', variant: 'destructive' });
      }
    });
  };

  const handleStartExam = () => {
    setExamState('taking');
  };

  const handleExamDone = () => {
    setShowExamCompletion(true);
  };

  const handleSaveExamSession = async () => {
    if (!selectedGrade) {
      toast({ title: 'Error', description: 'Please select a grade.', variant: 'destructive' });
      return;
    }
    if (!examData) return;

    try {
      const session = await MockExamService.saveExamSession({
        exam_title: examData.examTitle,
        number_of_questions: examData.questions.length,
        time_taken_minutes: elapsedSeconds / 60,
        grade: selectedGrade,
        used_solution: usedSolution,
      });

      setSessions([session, ...sessions]);
      const isLocal = String(session.id).startsWith('local-');
      toast({ title: isLocal ? 'Saved locally' : 'Success', description: isLocal ? 'Session saved offline (not signed in). It will still show in your stats.' : 'Exam session saved!' });
    } catch (e: any) {
      const msg = e?.message || 'Could not save exam session.';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setShowExamCompletion(false);
      setExamState('upload');
      setExamData(null);
      setUploadedFiles([]);
      setElapsedSeconds(0);
      setPageView('statistics');
    }
  };

  // Analytics data filtered by subject
  const displayData = (useExampleData ? EXAMPLE_DATA : sessions).filter(s => 
    !filterSubject || (s.exam_title || '').toLowerCase().includes(filterSubject.toLowerCase())
  );
  
  const timeData = displayData.map((s, i) => ({
    index: i + 1,
    time: parseFloat((s.time_taken_minutes || 0).toFixed(1)),
  }));

  // Grade over time: X-axis is time/session, Y-axis is grade (A-E)
  const gradeOverTimeData = displayData.map((s, i) => ({
    index: i + 1,
    [s.grade || 'N/A']: 1,
  }));
  
  // Create a mapping for grade values for Y-axis
  const gradeOrder: { [key: string]: number } = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
  const gradeValues = displayData.map((s, i) => ({
    index: i + 1,
    grade: gradeOrder[s.grade || 'N/A'] || 0,
    gradeLabel: s.grade || 'N/A',
  }));

  // Render content based on view
  let viewContent: React.ReactNode = null;

  // HOME VIEW
  if (pageView === 'home') {
    viewContent = (
      <div className="space-y-8">
        <PageHeader
          title="Study Tools"
          description="Choose a tool to enhance your studying: use a timer for focused sessions or generate practice exams."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {/* Timer Card */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setPageView('timer')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-blue-500" />
                Study Timer
              </CardTitle>
              <CardDescription>Focus sessions with goal tracking and performance logging</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Set a timer, study, and track your session performance including difficulty level and goal completion.
              </p>
              <Button className="w-full">Start Timer</Button>
            </CardContent>
          </Card>

          {/* Mock Exams Card */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setPageView('exams')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-yellow-500" />
                Mock Exams
              </CardTitle>
              <CardDescription>Generate AI-powered practice exams from your course materials</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload old exams or practice papers, and get AI-generated similar questions with solutions.
              </p>
              <Button className="w-full">Start Mock Exam</Button>
            </CardContent>
          </Card>

          {/* Statistics Card */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setPageView('statistics')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Statistics
              </CardTitle>
              <CardDescription>View your performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Track your grades and exam completion times over multiple sessions.
              </p>
              <Button className="w-full">View Stats</Button>
            </CardContent>
          </Card>

          {/* Overwhelmed Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" /> Feeling Overwhelmed?
              </CardTitle>
              <CardDescription>Options if the course feels too heavy right now</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Consider taking the course later (omtentaperiod or next year).</li>
                <li>Read the solution sheet first to memorize the most important ideas.</li>
                <li>Use the Study Buddy in this app to plan a minimal path.</li>
                <li>Hire a guide/tutor for focused help (e.g., Superproof).</li>
              </ul>
              <div className="pt-2">
                <Button variant="outline" onClick={() => setPageView('exams')} className="mr-2">Start Minimal Practice</Button>
                <Button variant="secondary" onClick={() => { window.location.href = '/study-buddy' }}>Open Study Buddy</Button>
              </div>
            </CardContent>
          </Card>

          {/* Exam Day Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-green-600" /> Exam Day Checklist
              </CardTitle>
              <CardDescription>Pack these and prep the day before</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>ID</li>
                <li>Pen and eraser</li>
                <li>Calculator (if allowed)</li>
                <li>Food and drinks</li>
                <li>Rest the day before (maybe do not study)</li>
              </ul>
            </CardContent>
          </Card>
        </div>

          {/* Analytics Preview */}
        {(sessions.length > 0 || useExampleData) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your Progress</h2>
              {sessions.length === 0 && (
                <Button variant="outline" size="sm" onClick={() => setUseExampleData(!useExampleData)}>
                  {useExampleData ? 'Hide' : 'Show'} Example Data
                </Button>
              )}
            </div>

            {timeData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Completion Time Over Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="index" />
                      <YAxis label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="time" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {gradeOverTimeData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Grade Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={gradeOverTimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="index" />
                      <YAxis />
                      <Tooltip />
                      <Line type="stepAfter" dataKey="grade" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  } else if (pageView === 'timer') {
    if (!timerStarted) {
      viewContent = (
        <div className="space-y-8">
          <Button variant="outline" onClick={() => setPageView('home')} className="mb-4">
            <Home className="mr-2 h-4 w-4" /> Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Study Timer Setup</CardTitle>
              <CardDescription>Configure your focused study session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Timer Mode</label>
                <div className="flex gap-2">
                  <Button
                    variant={timerMode === 'countdown' ? 'default' : 'outline'}
                    onClick={() => setTimerMode('countdown')}
                  >
                    Countdown
                  </Button>
                  <Button
                    variant={timerMode === 'stopwatch' ? 'default' : 'outline'}
                    onClick={() => setTimerMode('stopwatch')}
                  >
                    Stopwatch
                  </Button>
                </div>
              </div>

              {timerMode === 'countdown' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Time Limit (minutes)</label>
                  <input
                    type="number"
                    value={timerDuration}
                    onChange={(e) => setTimerDuration(e.target.value)}
                    min="1"
                    max="300"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              )}

              <Button onClick={handleStartTimer} className="w-full" size="lg">
                Start Study Session
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    } else {
      viewContent = (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="text-6xl font-mono font-bold">{formatTime(elapsedSeconds)}</div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setIsTimerRunning(!isTimerRunning)}>
                    {isTimerRunning ? 'Pause' : 'Resume'}
                  </Button>
                  <Button variant="destructive" onClick={handleTimerDone}>
                    Done
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900">📚 Stay focused. Use this time to study without distractions.</p>
            </CardContent>
          </Card>
        </div>
      );
    }
  } else if (pageView === 'exams') {
    // Upload state
    if (examState === 'upload') {
      viewContent = (
        <div className="space-y-8">
          <Button variant="outline" onClick={() => setPageView('home')} className="mb-4">
            <Home className="mr-2 h-4 w-4" /> Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Upload Exam
              </CardTitle>
              <CardDescription>Upload one or more old exam PDFs to generate similar questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileUpload}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary/90"
              />
              <div className="text-sm text-muted-foreground">
                {uploadedFiles.length > 0 && `${uploadedFiles.length} file(s) selected`}
              </div>
              <Button onClick={handleGenerateQuestions} disabled={isPending || uploadedFiles.length === 0}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Questions
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    } else if (examState === 'reviewing' && examData) {
      viewContent = (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => { setExamState('upload'); setExamData(null); setElapsedSeconds(0); }} className="mb-4">
            <Home className="mr-2 h-4 w-4" /> Back
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{examData.examTitle}</CardTitle>
                <Button size="sm" variant="outline" onClick={handleExportExamJSON}>
                  💾 Save JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {examData.questions.map((q, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-2">
                  <div className="font-semibold">Q{q.questionNumber}:</div>
                  <div className="text-sm prose prose-sm"><Latex>{q.question}</Latex></div>
                  <div
                    className="text-sm text-primary hover:underline cursor-pointer"
                    onClick={() => {
                      const el = document.getElementById(`exam-sol-${i}`);
                      if (el) el.classList.toggle('hidden');
                    }}
                  >
                    Click to see solution
                  </div>
                  <div id={`exam-sol-${i}`} className="hidden mt-2 p-3 bg-muted rounded text-sm border-l-2 border-primary whitespace-pre-wrap prose prose-sm">
                    <Latex>{q.solution}</Latex>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }
  } else if (pageView === 'statistics') {
    viewContent = (
      <div className="space-y-8">
        <Button variant="outline" onClick={() => setPageView('home')} className="mb-4">
          <Home className="mr-2 h-4 w-4" /> Back Home
        </Button>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <PageHeader
              title="Your Statistics"
              description="Track your performance across all exams and study sessions"
            />
            {sessions.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => setUseExampleData(!useExampleData)} className="mt-4">
                {useExampleData ? 'Hide' : 'Show'} Example Data
              </Button>
            )}
          </div>

          {subjects.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Filter by Subject:</label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {displayData.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">No sessions recorded yet. Complete some exams or timer sessions to see your statistics.</p>
              <Button onClick={() => setPageView('home')}>Go Back Home</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Time Taken Over Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Completion Time Over Sessions</CardTitle>
                <CardDescription>How long you spent on each session</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" label={{ value: 'Session #', position: 'bottom' }} />
                    <YAxis label={{ value: 'Time (minutes)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="time" stroke="#3b82f6" strokeWidth={2} name="Time (min)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Grade Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Grade Over Time</CardTitle>
                <CardDescription>Your grades progression across sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={gradeValues}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" label={{ value: 'Session #', position: 'bottom' }} />
                    <YAxis 
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      tickFormatter={(value) => {
                        const map: { [key: number]: string } = { 0: 'F', 1: 'E', 2: 'D', 3: 'C', 4: 'B', 5: 'A' };
                        return map[value] || '';
                      }}
                      label={{ value: 'Grade', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value) => {
                        const map: { [key: number]: string } = { 1: 'E', 2: 'D', 3: 'C', 4: 'B', 5: 'A' };
                        return map[value as number] || '';
                      }}
                    />
                    <Legend />
                    <Line type="stepAfter" dataKey="grade" stroke="#10b981" strokeWidth={2} name="Grade" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{sessions.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {sessions.reduce((acc, s) => acc + (s.time_taken_minutes || 0), 0).toFixed(1)} min
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Average Grade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {sessions.map(s => s.grade || 'N/A').join(', ')}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <div className="font-medium">{s.exam_title}</div>
                        <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{s.grade}</div>
                        <div className="text-xs text-muted-foreground">{s.time_taken_minutes?.toFixed(1)}m</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Return view content with all dialogs
  return (
    <>
      {viewContent}
      
      {/* Subject selection dialog */}
      {showSubjectSelect && (
        <Dialog open={showSubjectSelect} onOpenChange={setShowSubjectSelect}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Subject</DialogTitle>
              <DialogDescription>Which subject will you study?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubjectSelect(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSubject}>
                Start Studying
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Timer completion dialog */}
      {showTimerCompletion && (
        <Dialog open={showTimerCompletion} onOpenChange={setShowTimerCompletion}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Study Session Complete</DialogTitle>
              <DialogDescription>What grade did you achieve?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">What grade did you achieve?</label>
                <Select value={timerGrade} onValueChange={(v: any) => setTimerGrade(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty/grade" />
                  </SelectTrigger>
                  <SelectContent>
                <SelectItem value="F">F</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="timer-used-solution"
                  checked={timerUsedSolution}
                  onChange={(e) => setTimerUsedSolution(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="timer-used-solution" className="text-sm font-medium">
                  I needed to check solutions
                </label>
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Time studied:</strong> {formatTime(elapsedSeconds)}
              </div>
            </div>
            <DialogFooter>
              {bellPlaying && (
                <Button variant="destructive" onClick={stopBell}>
                  🔔 Stop Bell
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowTimerCompletion(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTimerSession}>
                <CheckCircle className="mr-2 h-4 w-4" /> Save Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Exam completion dialog */}
      {showExamCompletion && (
        <Dialog open={showExamCompletion} onOpenChange={setShowExamCompletion}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exam Complete</DialogTitle>
              <DialogDescription>How did you perform?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Grade Achieved</label>
                <Select value={selectedGrade} onValueChange={(v: any) => setSelectedGrade(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="F">F</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="A">A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="exam-used-solution"
                  checked={usedSolution}
                  onChange={(e) => setUsedSolution(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="exam-used-solution" className="text-sm font-medium">
                  I checked the solution during the exam
                </label>
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Time taken:</strong> {formatTime(elapsedSeconds)}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExamCompletion(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveExamSession}>
                <CheckCircle className="mr-2 h-4 w-4" /> Save Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
