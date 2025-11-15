"use client";

import { ChevronLeft, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function CommunityPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "absolute top-4 left-4 gap-2")}>
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>
      <div className="text-center space-y-4 max-w-md">
        <Users className="w-16 h-16 text-green-600 mx-auto" />
        <h1 className="text-4xl font-bold text-green-700">Coming Soon</h1>
        <p className="text-lg text-muted-foreground">
          The Community feature is currently under development. Soon you'll be able to connect with fellow students, share resources, and collaborate on your learning journey!
        </p>
      </div>
    </div>
  );
}
