"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabaseClient";

export function StudyTimerWidget() {
  const { user } = useAuth();
  const [latestGoal, setLatestGoal] = useState<string>("");

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('session_goals')
        .select('goal_text, created_at, subject_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const label = data.subject_name ? `${data.subject_name}: ${data.goal_text ?? ''}` : (data.goal_text ?? '');
        setLatestGoal(label);
      }
    }
    load();
  }, [user?.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="w-5 h-5" />
          Study Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center space-y-4 pt-4">
        <div className="text-center space-y-2">
          <div className="text-xs text-muted-foreground">Session Goal</div>
          <div className="text-sm font-medium min-h-5">
            {latestGoal || 'Set a session goal in Study Timer'}
          </div>
        </div>
        <Link href="/study-timer" passHref>
          <Button size="lg">Open Study Timer</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
