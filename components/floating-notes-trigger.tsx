"use client";

import { CheckSquare, ChevronUp, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesStore } from "@/lib/notes-store";
import { useQuickTasksStore } from "@/lib/quick-tasks-store";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function FloatingNotesTrigger() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isNotesOpen = useNotesStore((state) => state.isNotesOpen);
  const setIsNotesOpen = useNotesStore((state) => state.setIsNotesOpen);
  const isTasksOpen = useQuickTasksStore((state) => state.isTasksOpen);
  const setIsTasksOpen = useQuickTasksStore((state) => state.setIsTasksOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const isAnyPanelOpen = isTasksOpen || isNotesOpen;
  const isDockActive = isExpanded || isAnyPanelOpen;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dockRef.current) return;
      if (!dockRef.current.contains(event.target as Node) && !isAnyPanelOpen) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAnyPanelOpen]);

  if (!isHomePage) return null;

  const tools = [
    {
      id: "tasks",
      label: "Quick Tasks",
      onClick: () => {
        setIsTasksOpen(!isTasksOpen);
        setIsNotesOpen(false);
      },
      icon: <CheckSquare className="w-4 h-4" />,
      active: isTasksOpen,
    },
    {
      id: "notes",
      label: "Quick Notes",
      onClick: () => {
        setIsNotesOpen(!isNotesOpen);
        setIsTasksOpen(false);
      },
      icon: <Pencil className="w-4 h-4" />,
      active: isNotesOpen,
    },
  ];

  return (
    <div ref={dockRef} className="fixed left-5 bottom-24 z-[60] flex flex-col items-center">
      <div
        className={cn(
          "absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-300",
          isDockActive ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={tool.onClick}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative border backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
              tool.active
                ? "bg-[#1E6F99] text-sky-100 border-[#2F95C5] shadow-[0_0_18px_rgba(30,111,153,0.42)]"
                : "bg-slate-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-[#2F95C5]/45 hover:bg-slate-800"
            )}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          if (isAnyPanelOpen) return;
          setIsExpanded((value) => !value);
        }}
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative border backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
          isDockActive
            ? "bg-[#49B6E5] text-slate-950 border-[#49B6E5] shadow-[0_0_20px_rgba(73,182,229,0.4)]" 
            : "bg-slate-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-[#49B6E5]/40 hover:bg-slate-800"
        )}
        title="Toggle quick tools"
      >
        <ChevronUp
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isDockActive ? "rotate-180" : "group-hover:-translate-y-0.5"
          )}
        />
      </button>
    </div>
  );
}
