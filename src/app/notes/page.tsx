import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";

export default function NotesPage() {
  return (
    <div>
      <PageHeader
        title="Notes"
        description="Your personal space for all your notes. Organize by subject and topic."
      />
      <Card>
        <CardHeader>
            <CardTitle>My Notes</CardTitle>
            <CardDescription>A simple but powerful note-taking experience for all your subjects.</CardDescription>
        </CardHeader>
        <CardContent>
            <Textarea placeholder="Start writing your notes here..." className="min-h-[500px]" />
            <div className="flex justify-end mt-4">
              <Button><Save className="mr-2 h-4 w-4" /> Save Note</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
