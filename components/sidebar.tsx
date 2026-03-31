"use client";

import { Play, Plus, Zap, Leaf, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sidebarLinks = [
  { icon: Play, label: "Quick Start", href: "/" },
  { icon: Plus, label: "New Task", href: "/tasks/new" },
  { icon: Zap, label: "Daily Goal", href: "/goals" },
  { icon: Leaf, label: "Zen Mode", href: "/zen" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-full bg-sidebar border-r border-sidebar-border hidden md:flex flex-col p-8 transition-colors duration-500">
      <div className="mb-12">
        <h2 className="text-xl font-bold font-noto-serif tracking-tight">The Curator</h2>
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-60">Stay mindful.</span>
      </div>

      <nav className="flex-1 space-y-2">
        {sidebarLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group",
              pathname === link.href 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <link.icon className={cn(
                "w-5 h-5",
                pathname === link.href ? "fill-current" : "group-hover:text-primary transition-colors transition-all duration-300"
            )} />
            <span className="text-sm font-semibold tracking-tight">{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className="pt-8 mt-auto border-t border-sidebar-border/10">
         <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group",
              pathname === "/settings" 
                ? "bg-primary text-white" 
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
            <span className="text-sm font-semibold tracking-tight">Settings</span>
          </Link>
      </div>
    </div>
  );
}
