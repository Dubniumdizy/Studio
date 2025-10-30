"use client";

import { Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { DemoModeToggle } from '@/components/demo-mode-toggle';

function PageLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Treat any nested login/signup (e.g., with trailing slash or query) as auth pages
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup');
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.replace('/login');
    }
  }, [user, loading, isAuthPage, router]);

  if (loading && !isAuthPage) {
    return <PageLoading />;
  }

  return (
    isAuthPage ? (
      <main className="h-full">{children}</main>
    ) : (
      <SidebarProvider>
        <div className="h-full bg-muted/40">
          <AppSidebar />
          <SidebarInset className="h-full overflow-y-auto p-4 md:p-8">{children}</SidebarInset>
        </div>
      </SidebarProvider>
    )
  );
}

export function AppRoot({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
      <Toaster />
      <DemoModeToggle />
    </AuthProvider>
  );
}

