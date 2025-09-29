"use client";

import { useState } from "react";
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
  BookOpen
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
        <SidebarMenu>
            <SidebarMenuItem>
                <NavLink href="/dashboard" icon={<BarChart3 />} tooltip="Dashboard">Dashboard</NavLink>
            </SidebarMenuItem>
        </SidebarMenu>

        <CollapsibleSection title="Planning" icon={<Calendar size={16} />}>
            <SidebarMenu>
                <SidebarMenuItem>
                    <NavLink href="/calendar" icon={<Calendar />} tooltip="Calendar">Calendar</NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <NavLink href="/goals" icon={<Target />} tooltip="Goals">Goals</NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <NavLink href="/analytics" icon={<BarChart3 />} tooltip="Analytics">Analytics</NavLink>
                </SidebarMenuItem>
            </SidebarMenu>
        </CollapsibleSection>

        <CollapsibleSection title="Pre Study" icon={<Package size={16} />}>
            <SidebarMenu>
                 <SidebarMenuItem>
                  <NavLink href="/subject-setup" icon={<Library />} tooltip="Subject Setup">Subject Setup</NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/inspiration" icon={<Sparkles />} tooltip="Inspiration">
                    Inspiration
                </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/exam-analyzer" icon={<FileSearch />} tooltip="Analyzer">
                    Analyzer
                </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/resources" icon={<Folder />} tooltip="Resources">
                    Resources
                </NavLink>
                </SidebarMenuItem>
            </SidebarMenu>
        </CollapsibleSection>
        
        <CollapsibleSection title="Deep Study" icon={<BrainCircuit size={16} />}>
            <SidebarMenu>
                <SidebarMenuItem>
                <NavLink href="/study-timer" icon={<Timer />} tooltip="Study Timer">
                    Study Timer
                </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/flashcards" icon={<Copy />} tooltip="Flashcards">
                    Flashcards
                </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/bank" icon={<FolderKanban />} tooltip="Bank">
                    Bank
                </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/formula-sheet" icon={<FunctionSquare />} tooltip="Formula Sheet">
                    Formula Sheet
                </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <NavLink href="/book-analyzer" icon={<BookOpen />} tooltip="Book Analyzer">
                    Book Analyzer
                </NavLink>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                <NavLink href="/question-bank" icon={<HelpCircle />} tooltip="Question Bank">
                    Question Bank
                </NavLink>
                </SidebarMenuItem>
            </SidebarMenu>
        </CollapsibleSection>
        
        <CollapsibleSection title="Exam Prep" icon={<ClipboardList size={16} />}>
            <SidebarMenu>
                <SidebarMenuItem>
                    <NavLink href="/mock-exams" icon={<ClipboardCheck />} tooltip="Mock Exams">Mock Exams</NavLink>
                </SidebarMenuItem>
            </SidebarMenu>
        </CollapsibleSection>

        <CollapsibleSection title="Help" icon={<Bot size={16} />}>
            <SidebarMenu>
                <SidebarMenuItem>
                <NavLink href="/study-buddy" icon={<Bot />} tooltip="Study Buddy">
                    Study Buddy
                </NavLink>
                </SidebarMenuItem>
            </SidebarMenu>
        </CollapsibleSection>

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
