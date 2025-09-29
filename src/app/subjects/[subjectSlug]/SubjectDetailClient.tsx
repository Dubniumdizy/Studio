"use client";

import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, FileSearch, Folder, Timer, Copy, FunctionSquare, HelpCircle, ClipboardCheck, Bot, Clock, Target, PlusCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DatabaseService from "@/lib/database";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import ConceptMindMap from "@/components/subjects/ConceptMindMap";

const subjectTools = [
  { title: "Inspiration", href: "/inspiration", icon: Sparkles },
  { title: "Analyzer", href: "/exam-analyzer", icon: FileSearch },
  { title: "Resources", href: "/resources", icon: Folder },
  { title: "Study Timer", href: "/study-timer", icon: Timer },
  { title: "Flashcards", href: "/flashcards", icon: Copy },
  { title: "Formula Sheet", href: "/formula-sheet", icon: FunctionSquare },
  { title: "Question Bank", href: "/question-bank", icon: HelpCircle },
  { title: "Mock Exams", href: "/mock-exams", icon: ClipboardCheck },
  { title: "Study Buddy", href: "/study-buddy", icon: Bot },
];

function clamp15(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(5, Math.round(v)));
}

type Props = { subjectSlug: string };

export default function SubjectDetailClient({ subjectSlug }: Props) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [vocab, setVocab] = React.useState<any[]>([]);
  const [resources, setResources] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [bankPickerOpen, setBankPickerOpen] = React.useState<boolean>(false);
  const [bankSelection, setBankSelection] = React.useState<Record<string, any>>({});
  const [subjectInfo, setSubjectInfo] = React.useState<{ name: string; description?: string; color?: string } | null>(null);
  const { toast } = useToast();

  const confData = React.useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    for (const v of vocab) {
      const c = clamp15(v.confidence ?? 1);
      counts[c] = (counts[c] || 0) + 1;
    }
    const palette = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#10b981"]; // red->amber->yellow->green->emerald
    return [1, 2, 3, 4, 5].map((n, i) => ({ name: `${n}`, value: counts[n], color: palette[i] }));
  }, [vocab]);

  const impData = React.useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
    for (const v of vocab) {
      const c = clamp15(v.importance ?? 1);
      counts[c] = (counts[c] || 0) + 1;
    }
    const palette = ["#94a3b8", "#60a5fa", "#38bdf8", "#22d3ee", "#14b8a6"]; // slate->blue->sky->cyan->teal
    return [1, 2, 3, 4, 5].map((n, i) => ({ name: `${n}`, value: counts[n], color: palette[i] }));
  }, [vocab]);

  const confTotal = React.useMemo(() => confData.reduce((sum, d) => sum + (d.value as number), 0), [confData]);
  const impTotal = React.useMemo(() => impData.reduce((sum, d) => sum + (d.value as number), 0), [impData]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id ?? null;
        if (!mounted) return;
        setUserId(uid);
        if (!uid) return; // Require login for persistence
        // Fetch subject metadata by slug
        try {
          const match = await DatabaseService.getSubjectBySlug(uid, subjectSlug)
          if (!mounted) return;
          if (match) setSubjectInfo({ name: match.name, description: (match as any).description, color: (match as any).color });
        } catch {}
        const rows = await DatabaseService.getSubjectVocab(uid, subjectSlug);
        if (!mounted) return;
        setVocab(rows);
        const links = await DatabaseService.getSubjectResources(uid, subjectSlug);
        if (!mounted) return;
        setResources(links);
      } catch (e: any) {
        console.warn(e);
        try {
          const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e));
          toast({ title: 'Failed to load subject data', description: raw });
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [subjectSlug]);

  const addRow = () => {
    const tempId = `local-${Date.now()}`;
    setVocab(prev => [
      ...prev,
      { id: tempId, concept: "", confidence: 1, importance: 1, __local: true },
    ]);
  };

  const updateRow = async (row: any, patch: Partial<any>) => {
    const next = { ...row, ...patch };
    // Clamp numeric fields immediately in state
    if (patch.confidence !== undefined) next.confidence = clamp15(patch.confidence);
    if (patch.importance !== undefined) next.importance = clamp15(patch.importance);
    setVocab(prev => prev.map(r => (r.id === row.id ? next : r)));

    if (!userId) return; // Not logged in; don't persist yet

    // For local rows, only persist once a non-empty concept exists
    if (next.__local) {
      const concept = (next.concept || "").trim();
      if (!concept) return;
      try {
        const saved = await DatabaseService.upsertSubjectVocab(userId, subjectSlug, {
          concept,
          confidence: clamp15(next.confidence),
          importance: clamp15(next.importance),
          notes: (next.notes || '').toString(),
        });
        if (saved) {
          setVocab(prev => prev.map(r => (r.id === row.id ? { ...saved } : r)));
        }
      } catch (e: any) {
        console.warn(e);
        try {
          const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e));
          toast({ title: 'Save failed', description: raw, variant: 'destructive' });
        } catch {}
      }
      return;
    }

    // Persist updates for existing rows
    try {
      await DatabaseService.upsertSubjectVocab(userId, subjectSlug, {
        id: next.id,
        concept: (next.concept || "").trim(),
        confidence: clamp15(next.confidence),
        importance: clamp15(next.importance),
        notes: (next.notes || '').toString(),
      });
    } catch (e: any) {
      console.warn(e);
      try {
        const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e));
        toast({ title: 'Save failed', description: raw, variant: 'destructive' });
      } catch {}
    }
  };

  const deleteRow = async (id: string) => {
    // Handle local row deletion without server call
    if (id.startsWith("local-")) {
      setVocab(prev => prev.filter(r => r.id !== id));
      return;
    }
    if (!userId) return;
    try {
      await DatabaseService.deleteSubjectVocab(userId, id);
      setVocab(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.warn(e);
    }
  };

  const openBankPicker = () => {
    setBankPickerOpen(true);
    setBankSelection({});
  };
  const confirmBankLinks = async () => {
    if (!userId) return;
    try {
      const items = Object.values(bankSelection) as any[];
      for (const it of items) {
        await DatabaseService.addSubjectResource(userId, subjectSlug, {
          name: it.name,
          bank_item_id: it.id,
          bank_type: it.type,
          bank_path: it.path || it.name,
          url: it.url || null,
        });
      }
      const links = await DatabaseService.getSubjectResources(userId, subjectSlug);
      setResources(links);
    } catch (e: any) {
      console.warn(e);
      try {
        const raw = e?.message || e?.error?.message || (typeof e === 'string' ? e : JSON.stringify(e));
        toast({ title: 'Link failed', description: raw, variant: 'destructive' });
      } catch {}
    } finally {
      setBankPickerOpen(false);
    }
  };

  const unlinkResource = async (id: string) => {
    if (!userId) return;
    try {
      await DatabaseService.deleteSubjectResource(userId, id);
      setResources(prev => prev.filter((r: any) => r.id !== id));
    } catch (e) {
      console.warn(e);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const loggedOut = !userId;

  return (
    <div>
      <div className="flex justify-between items-start">
        <PageHeader title={subjectInfo?.name || subjectSlug} description={subjectInfo?.description || ''} />
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Widget
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Knowledge & Confidence (Supabase) */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Knowledge Map</CardTitle>
            <CardDescription>
              Track how confident and how important each concept is (1–5).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loggedOut && (
              <div className="mb-3 text-sm text-muted-foreground">
                Please sign in to add and save your knowledge map entries.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Confidence</CardTitle>
                  <CardDescription>Distribution of concepts by confidence</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative" style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={confData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          labelLine={false}
                          label={({ name, percent, value }) => (value ? `${name} ${(percent * 100).toFixed(0)}%` : "")}
                        >
                          {confData.map((entry, index) => (
                            <Cell key={`conf-${index}`} fill={entry.color as string} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any, props: any) => [`${v}`, `Confidence ${props?.name}`]} />
                        <Legend verticalAlign="bottom" />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-semibold">{confTotal}</div>
                        <div className="text-xs text-muted-foreground">concepts</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Importance</CardTitle>
                  <CardDescription>Distribution of concepts by importance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative" style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={impData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          labelLine={false}
                          label={({ name, percent, value }) => (value ? `${name} ${(percent * 100).toFixed(0)}%` : "")}
                        >
                          {impData.map((entry, index) => (
                            <Cell key={`imp-${index}`} fill={entry.color as string} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any, props: any) => [`${v}`, `Importance ${props?.name}`]} />
                        <Legend verticalAlign="bottom" />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-semibold">{impTotal}</div>
                        <div className="text-xs text-muted-foreground">concepts</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 w-1/2">Concepts</th>
                    <th className="text-left p-2 w-28">Confidence (1–5)</th>
                    <th className="text-left p-2 w-28">Importance (1–5)</th>
                    <th className="text-left p-2 w-56">Example / Notes</th>
                    <th className="p-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {vocab.map((row: any) => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent outline-none border rounded px-2 py-1"
                          value={row.concept || ""}
                          onChange={(e) => updateRow(row, { concept: e.target.value })}
                          disabled={loggedOut}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={5}
                          className="w-16 bg-transparent border rounded px-2 py-1"
                          value={row.confidence ?? 1}
                          onChange={(e) => updateRow(row, { confidence: Number(e.target.value) })}
                          disabled={loggedOut}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          max={5}
                          className="w-16 bg-transparent border rounded px-2 py-1"
                          value={row.importance ?? 1}
                          onChange={(e) => updateRow(row, { importance: Number(e.target.value) })}
                          disabled={loggedOut}
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          className="w-full bg-transparent border rounded px-2 py-1 text-xs"
                          placeholder="Short example or note (shows under bubble)"
                          rows={2}
                          value={row.notes || ''}
                          onChange={(e) => updateRow(row, { notes: e.target.value })}
                          disabled={loggedOut}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => deleteRow(row.id)} disabled={loggedOut}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 border-t flex justify-between">
                <Button size="sm" variant="outline" onClick={addRow} disabled={loggedOut}>
                  Add Row
                </Button>
                <div className="text-xs text-muted-foreground">Tip: 1 = low, 5 = high</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Concept Mind Map */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Concept Mind Map</CardTitle>
            <CardDescription>Auto-connects concepts by word similarity. Color shows {""}
              <b>confidence</b> or <b>importance</b>. Adjust controls inside the card.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConceptMindMap vocab={vocab as any} subjectName={subjectInfo?.name || subjectSlug} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Subject Tools</CardTitle>
            <CardDescription>Quick access to all tools for {subjectInfo?.name || subjectSlug}.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {subjectTools.map((tool) => (
              <Button key={tool.title} variant="outline" className="h-24 flex-col gap-2 text-center" asChild>
                <Link href={tool.href}>
                  <tool.icon className="w-8 h-8 text-primary" />
                  <span
                    style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    className="leading-tight text-sm"
                  >
                    {tool.title}
                  </span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Linked BANK Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">Linked BANK Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <div className="text-sm text-muted-foreground">Link files or folders from your BANK to this subject.</div>
              <Button size="sm" variant="outline" onClick={openBankPicker} disabled={loggedOut}>
                Link from BANK
              </Button>
            </div>
            <div className="space-y-2">
              {resources.length === 0 && <div className="text-sm text-muted-foreground">No linked items yet.</div>}
              {resources.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                  <div className="truncate">
                    <span className="font-medium mr-2">{r.name}</span>
                    <span className="text-muted-foreground">{r.bank_path || ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/bank?open=${encodeURIComponent(r.bank_item_id || '')}`}>
                      <Button size="sm" variant="ghost">Open</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => unlinkResource(r.id)} disabled={loggedOut}>Unlink</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines (placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5" />Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-md bg-muted/50">
              <div>
                <p className="font-medium">Problem Set 3 Due</p>
                <p className="text-sm text-muted-foreground">in 3 days</p>
              </div>
              <Link href="/calendar" className="text-sm text-primary hover:underline">
                View
              </Link>
            </div>
            <div className="flex justify-between items-center p-3 rounded-md bg-muted/50">
              <div>
                <p className="font-medium">Midterm Exam</p>
                <p className="text-sm text-muted-foreground">in 10 days</p>
              </div>
              <Link href="/calendar" className="text-sm text-primary hover:underline">
                View
              </Link>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="w-5 h-5" />Current Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold">Master Differential Equations</h3>
            <p className="text-sm text-muted-foreground mt-1">2 of 4 tasks completed</p>
            <Button variant="link" className="p-0 h-auto mt-2" asChild>
              <Link href="/goals">View all goals</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* BANK picker overlay */}
      {bankPickerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-background rounded-md shadow-xl w-full max-w-2xl p-4 space-y-3">
            <div className="text-lg font-semibold">Link items from BANK</div>
            <div className="max-h-80 overflow-auto border rounded p-2">
              {(() => {
                try {
                  const raw = localStorage.getItem("bankData");
                  if (!raw) return <div className="text-sm text-muted-foreground">Your bank is empty.</div>;
                  const bank = JSON.parse(raw);
                  const tree: any[] = [];
                  const walk = (items: any[], path: string[] = []) => {
                    for (const it of items) {
                      const p = [...path, it.name];
                      tree.push({ ...it, path: p.join(" / ") });
                      if (it.type === "folder" && it.items) walk(it.items, p);
                    }
                  };
                  walk(bank);
                  return (
                    <div className="space-y-1">
                      {tree.map((it: any) => (
                        <label key={it.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={!!bankSelection[it.id]}
                            onChange={(e) => {
                              setBankSelection((prev) => {
                                const next = { ...prev } as any;
                                if (e.target.checked) next[it.id] = it;
                                else delete next[it.id];
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm truncate">{it.path}</span>
                        </label>
                      ))}
                    </div>
                  );
                } catch {
                  return <div className="text-sm text-muted-foreground">Unable to read BANK.</div>;
                }
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBankPickerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmBankLinks}>Link Selected</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
