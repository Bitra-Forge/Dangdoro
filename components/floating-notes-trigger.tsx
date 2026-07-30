"use client";

import { CheckSquare, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStickyNotesStore } from "@/lib/sticky-notes-store";
import { useQuickTasksStore } from "@/lib/quick-tasks-store";
import { useTimerStore } from "@/lib/store";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/components/ui/tooltip";
import { useState, useRef, useEffect } from "react";

export function FloatingNotesTrigger() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const activeGroupId = useTimerStore((state) => state.activeGroupId);
  const isNotesOpen = useStickyNotesStore((state) => state.isNotesOpen);
  const setIsNotesOpen = useStickyNotesStore((state) => state.setIsNotesOpen);
  const isTasksOpen = useQuickTasksStore((state) => state.isTasksOpen);
  const setIsTasksOpen = useQuickTasksStore((state) => state.setIsTasksOpen);
  const notes = useStickyNotesStore((state) => state.notes);

  const [showNotePreview, setShowNotePreview] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Most recent panel note (not placed on page) for preview
  const panelNotes = notes.filter((n) => n.positionX < 0 || n.positionY < 0);
  const latestNote = panelNotes[0] ?? null;

  const NOTE_PREVIEW_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
    yellow: { bg: "#fef6e5", text: "#6d4508", accent: "#f59e0b" },
    green:  { bg: "#e0f7fa", text: "#0d4a34", accent: "#10b981" },
    blue:   { bg: "#e0f2fe", text: "#0c4a6e", accent: "#38bdf8" },
    pink:   { bg: "#fcebf3", text: "#700c3b", accent: "#ec4899" },
    purple: { bg: "#f3e8ff", text: "#581c87", accent: "#8b5cf6" },
  };

  const handleNotesMouseEnter = () => {
    if (!latestNote) return;
    previewTimer.current = setTimeout(() => setShowNotePreview(true), 300);
  };

  const handleNotesMouseLeave = () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setShowNotePreview(false);
  };

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  if (!isHomePage) return null;

  return (
    <div
      className={cn(
        "fixed left-5 z-[60] flex flex-col items-center gap-3 transition-all duration-300",
        activeGroupId ? "bottom-44 sm:bottom-24" : "bottom-24"
      )}
    >
      {/* Quick Tasks button */}
      <Tooltip content="Quick Tasks" side="right">
        <button
          onClick={() => {
            setIsTasksOpen(!isTasksOpen);
            setIsNotesOpen(false);
          }}
          data-quick-action-trigger="true"
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative border backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
            isTasksOpen
              ? "bg-[#1E6F99] text-sky-100 border-[#2F95C5] shadow-[0_0_18px_rgba(30,111,153,0.42)]"
              : "bg-slate-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-[#2F95C5]/45 hover:bg-slate-800"
          )}
        >
          <CheckSquare className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* Sticky Notes button */}
      <div
        className="relative"
        onMouseEnter={handleNotesMouseEnter}
        onMouseLeave={handleNotesMouseLeave}
      >
        <button
          onClick={() => {
            setIsNotesOpen(!isNotesOpen);
            setIsTasksOpen(false);
          }}
          data-quick-action-trigger="true"
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group relative border backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
            isNotesOpen
              ? "bg-[#1E6F99] text-sky-100 border-[#2F95C5] shadow-[0_0_18px_rgba(30,111,153,0.42)]"
              : "bg-slate-900/80 text-zinc-400 border-white/10 hover:text-white hover:border-[#2F95C5]/45 hover:bg-slate-800"
          )}
        >
          <Pin className="w-4 h-4" />
          {/* Note count badge */}
          {panelNotes.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black flex items-center justify-center shadow-md leading-none">
              {panelNotes.length}
            </span>
          )}
        </button>

        {/* Mini note preview on hover */}
        {showNotePreview && latestNote && (() => {
          const pc = NOTE_PREVIEW_COLORS[latestNote.color] ?? NOTE_PREVIEW_COLORS.yellow;
          return (
            <div
              className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-[160px] rounded-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.5)] pointer-events-none z-[70] flex border-none"
              style={{ background: pc.bg }}
            >
              {/* Left Accent Strip */}
              <div
                className="w-1.5 shrink-0"
                style={{ background: pc.accent }}
              />
              <div className="flex-1 py-2 px-3 min-w-0">
                <p
                  className="text-[11px] font-medium leading-snug line-clamp-3 font-serif"
                  style={{ color: pc.text }}
                >
                  {latestNote.content}
                </p>
                {panelNotes.length > 1 && (
                  <div
                    className="pt-1 text-[9px] font-bold uppercase tracking-widest opacity-50 font-serif"
                    style={{ color: pc.text }}
                  >
                    +{panelNotes.length - 1} more
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
