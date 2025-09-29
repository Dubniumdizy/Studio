
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link> & {
  icon: React.ReactNode;
  tooltip: string;
};

export function NavLink({ href, icon, children, tooltip, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isActive = (pathname === "/" && href === "/dashboard") || (href !== "/" && pathname.startsWith(String(href)));

  return (
    <Link href={href} {...props}>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={{ children: tooltip, side: "right", align: "center" }}
        className={cn(isActive && "bg-sidebar-accent text-sidebar-accent-foreground")}
      >
        {icon}
        <span className={cn("truncate", state === "collapsed" && "hidden")}>{children}</span>
      </SidebarMenuButton>
    </Link>
  );
}
