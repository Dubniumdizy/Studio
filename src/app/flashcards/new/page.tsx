
"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DeprecatedNewDeckPage() {
  const router = useRouter();

  return (
    <div>
      <Link href="/flashcards" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 inline-flex items-center gap-2")}>
        <ChevronLeft className="h-4 w-4" />
        All Decks
      </Link>
      <PageHeader
        title="Create New Deck"
        description="This page is no longer in use."
      />
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Creation has moved!</CardTitle>
          <CardDescription>You can now create new decks directly from the main Flashcards page.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={() => router.push('/flashcards')}>Go to Flashcards</Button>
        </CardContent>
      </Card>
    </div>
  );
}
