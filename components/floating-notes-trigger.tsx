"use client";

import { ChevronUp, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesStore } from "@/lib/notes-store";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function FloatingNotesTrigger() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isNotesOpen = useNotesStore((state) => state.isNotesOpen);
  const setIsNotesOpen = useNotesStore((state) => state.setIsNotesOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dockRef.current) return;
      if (!dockRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isHomePage) return null;

  const tools = [
    {
      id: "notes",
      label: "Quick Notes",
      onClick: () => setIsNotesOpen(!isNotesOpen),
      icon: <Pencil className="w-4 h-4" />,
      active: isNotesOpen,
    },
  ];

  return (
    <div ref={dockRef} className="fixed left-5 bottom-24 z-[60] flex flex-col items-center gap-1.5">
      <div className="flex flex-col items-center gap-1.5 pointer-events-none">
        {tools.map((tool, index) => {
          const distance = (index + 1) * 44;
          return (
            <button
              key={tool.id}
              onClick={tool.onClick}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative border backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)] pointer-events-auto",
                tool.active
                  ? "bg-[#00BD7D] text-slate-950 border-[#00BD7D] shadow-[0_0_20px_rgba(0,189,125,0.4)]"
                  : "bg-slate-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-[#00BD7D]/40 hover:bg-slate-800",
                isExpanded
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-90 pointer-events-none"
              )}
              style={{
                transform: isExpanded
                  ? `translateY(-${distance}px)`
                  : "translateY(0px)",
                transitionDelay: isExpanded ? `${index * 55}ms` : "0ms",
              }}
              title={tool.label}
              aria-label={tool.label}
            >
              {tool.icon}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setIsExpanded((value) => !value)}
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative border backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
          isExpanded
            ? "bg-[#00BD7D] text-slate-950 border-[#00BD7D] shadow-[0_0_20px_rgba(0,189,125,0.4)]" 
            : "bg-slate-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-[#00BD7D]/40 hover:bg-slate-800"
        )}
        title="Toggle quick tools"
        aria-label="Toggle quick tools"
      >
        <ChevronUp
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isExpanded ? "rotate-180" : "group-hover:-translate-y-0.5"
          )}
        />

      </button>
    </div>
  );
}
