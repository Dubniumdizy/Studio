"use client";

import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LeafIcon } from "@/components/icons/leaf-icon";
import { NavLink } from "./nav-link";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileSearch,
  Folder,
  FolderKanban,
  FunctionSquare,
  HelpCircle,
  Library,
  Package,
  Settings,
  Sparkles,
  Target,
  Timer,
  BookOpen,
  Users
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { state } = useSidebar();

  return (
    <div>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full justify-start text-sm font-semibold text-muted-foreground px-3 py-2 h-auto hover:bg-sidebar-accent/50",
          state === "collapsed" && "hidden"
          )}
      >
        {icon}
        <span className="ml-2 flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Button>
       <div className={cn(state === "collapsed" && "hidden")}>{isOpen && <div className="pl-4 py-1 space-y-1">{children}</div>}</div>
       <div className={cn("hidden", state === "collapsed" && "block mt-2 space-y-1")}>{children}</div>
    </div>
  );
};


export function AppSidebar() {
  const { toggleSidebar, state } = useSidebar();
  const [sidebarVisibility, setSidebarVisibility] = useState<Record<string, boolean>>({
    'dashboard': true,
    'calendar': true,
    'goals': true,
    'analytics': true,
    'subject-setup': true,
    'inspiration': true,
    'resources': true,
    'study-timer': true,
    'flashcards': true,
    'bank': true,
    'book-analyzer': true,
    'formula-sheet': true,
    'mock-exams': true,
    'exam-analyzer': true,
    'study-buddy': true,
    'community': true,
  });

  useEffect(() => {
    // Load visibility settings from localStorage
    try {
      const saved = localStorage.getItem('sidebarVisibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Auto-migrate: add community if it doesn't exist
        if (!('community' in parsed)) {
          parsed.community = true;
          localStorage.setItem('sidebarVisibility', JSON.stringify(parsed));
        }
        setSidebarVisibility(parsed);
      }
    } catch (error) {
      console.error('Failed to load sidebar visibility:', error);
    }

    // Listen for storage changes (when settings are updated)
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('sidebarVisibility');
        if (saved) {
          setSidebarVisibility(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to reload sidebar visibility:', error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event from same tab
    window.addEventListener('sidebarVisibilityUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarVisibilityUpdated', handleStorageChange);
    };
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {state === 'expanded' ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LeafIcon className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold font-headline text-foreground">
                Studyverse
              </h1>
            </div>
            <SidebarTrigger />
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
            >
              <LeafIcon className="w-6 h-6 text-primary" />
            </Button>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="p-2 space-y-1">
        {sidebarVisibility['dashboard'] && (
          <SidebarMenu>
              <SidebarMenuItem>
                  <NavLink href="/dashboard" icon={<BarChart3 />} tooltip="Dashboard">Dashboard</NavLink>
              </SidebarMenuItem>
          </SidebarMenu>
        )}

        {(sidebarVisibility['calendar'] || sidebarVisibility['goals'] || sidebarVisibility['analytics']) && (
          <CollapsibleSection title="Planning" icon={<Calendar size={16} />}>
              <SidebarMenu>
                  {sidebarVisibility['calendar'] && (
                    <SidebarMenuItem>
                        <NavLink href="/calendar" icon={<Calendar />} tooltip="Calendar">Calendar</NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['goals'] && (
                    <SidebarMenuItem>
                        <NavLink href="/goals" icon={<Target />} tooltip="Goals">Goals</NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['analytics'] && (
                    <SidebarMenuItem>
                        <NavLink href="/analytics" icon={<BarChart3 />} tooltip="Analytics">Analytics</NavLink>
                    </SidebarMenuItem>
                  )}
              </SidebarMenu>
          </CollapsibleSection>
        )}

        {(sidebarVisibility['subject-setup'] || sidebarVisibility['inspiration'] || sidebarVisibility['resources']) && (
          <CollapsibleSection title="Pre Study" icon={<Package size={16} />}>
              <SidebarMenu>
                  {sidebarVisibility['subject-setup'] && (
                    <SidebarMenuItem>
                      <NavLink href="/subject-setup" icon={<Library />} tooltip="Subject Setup">Subject Setup</NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['inspiration'] && (
                    <SidebarMenuItem>
                      <NavLink href="/inspiration" icon={<Sparkles />} tooltip="Inspiration">
                          Inspiration
                      </NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['resources'] && (
                    <SidebarMenuItem>
                      <NavLink href="/resources" icon={<Folder />} tooltip="Resources">
                          Resources
                      </NavLink>
                    </SidebarMenuItem>
                  )}
              </SidebarMenu>
          </CollapsibleSection>
        )}
        
        {(sidebarVisibility['study-timer'] || sidebarVisibility['flashcards'] || sidebarVisibility['bank'] || sidebarVisibility['book-analyzer']) && (
          <CollapsibleSection title="Deep Study" icon={<BrainCircuit size={16} />}>
              <SidebarMenu>
                  {sidebarVisibility['study-timer'] && (
                    <SidebarMenuItem>
                      <NavLink href="/study-timer" icon={<Timer />} tooltip="Study Timer">
                          Study Timer
                      </NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['flashcards'] && (
                    <SidebarMenuItem>
                      <NavLink href="/flashcards" icon={<Copy />} tooltip="Flashcards">
                          Flashcards
                      </NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['bank'] && (
                    <SidebarMenuItem>
                      <NavLink href="/bank" icon={<FolderKanban />} tooltip="Bank">
                          Bank
                      </NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['book-analyzer'] && (
                    <SidebarMenuItem>
                      <NavLink href="/book-analyzer" icon={<BookOpen />} tooltip="Book Analyzer">
                          Book Analyzer
                      </NavLink>
                    </SidebarMenuItem>
                  )}
              </SidebarMenu>
          </CollapsibleSection>
        )}
        
        {(sidebarVisibility['formula-sheet'] || sidebarVisibility['mock-exams'] || sidebarVisibility['exam-analyzer']) && (
          <CollapsibleSection title="Exam Prep" icon={<ClipboardList size={16} />}>
              <SidebarMenu>
                  {sidebarVisibility['formula-sheet'] && (
                    <SidebarMenuItem>
                        <NavLink href="/examprep/formula-sheet" icon={<FunctionSquare />} tooltip="Formula Sheet">Formula Sheet</NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['mock-exams'] && (
                    <SidebarMenuItem>
                        <NavLink href="/mock-exams" icon={<ClipboardCheck />} tooltip="Mock Exams">Mock Exams</NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['exam-analyzer'] && (
                    <SidebarMenuItem>
                        <NavLink href="/exam-analyzer" icon={<FileSearch />} tooltip="Exam Analyzer">Exam Analyzer</NavLink>
                    </SidebarMenuItem>
                  )}
              </SidebarMenu>
          </CollapsibleSection>
        )}

        {(sidebarVisibility['study-buddy'] || sidebarVisibility['community']) && (
          <CollapsibleSection title="Help" icon={<HelpCircle size={16} />}>
              <SidebarMenu>
                  {sidebarVisibility['study-buddy'] && (
                    <SidebarMenuItem>
                      <NavLink href="/study-buddy" icon={<Bot />} tooltip="Study Buddy">
                          Study Buddy
                      </NavLink>
                    </SidebarMenuItem>
                  )}
                  {sidebarVisibility['community'] && (
                    <SidebarMenuItem>
                      <NavLink href="/help/community" icon={<Users />} tooltip="Community">
                          Community
                      </NavLink>
                    </SidebarMenuItem>
                  )}
              </SidebarMenu>
          </CollapsibleSection>
        )}

      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <NavLink href="/settings" icon={<Settings />} tooltip="Settings">
              Settings
            </NavLink>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
