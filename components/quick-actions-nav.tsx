"use client";

import { CheckSquare, Pencil, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { useNotesStore } from "@/lib/notes-store";
import { useQuickTasksStore } from "@/lib/quick-tasks-store";

export function QuickActionsNav() {
  const isSoundOpen = useTimerStore((state) => state.isSoundPanelOpen);
  const setIsSoundOpen = useTimerStore((state) => state.setIsSoundPanelOpen);
  const isNotesOpen = useNotesStore((state) => state.isNotesOpen);
  const setIsNotesOpen = useNotesStore((state) => state.setIsNotesOpen);
  const isTasksOpen = useQuickTasksStore((state) => state.isTasksOpen);
  const setIsTasksOpen = useQuickTasksStore((state) => state.setIsTasksOpen);

  const closeAllPanels = () => {
    setIsTasksOpen(false);
    setIsNotesOpen(false);
    setIsSoundOpen(false);
  };

  return (
    <div className="relative">
      {/* Main Nav Bar */}
      <nav className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <button
          data-quick-action-trigger="true"
          onClick={() => {
            const willOpen = !isTasksOpen;
            closeAllPanels();
            setIsTasksOpen(willOpen);
          }}
          className={cn(
            "p-1.5 sm:p-2 rounded-xl transition-all duration-300 group relative",
            isTasksOpen ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
          )}
          title="Quick Tasks"
        >
          <CheckSquare className={cn(
            "w-5 h-5 transition-transform duration-300",
            isTasksOpen ? "scale-110" : "group-hover:scale-110"
          )} />
          {isTasksOpen && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
          )}
        </button>

        <button
          data-quick-action-trigger="true"
          onClick={() => {
            const willOpen = !isNotesOpen;
            closeAllPanels();
            setIsNotesOpen(willOpen);
          }}
          className={cn(
            "p-1.5 sm:p-2 rounded-xl transition-all duration-300 group relative",
            isNotesOpen ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
          )}
          title="Quick Notes"
        >
          <Pencil className={cn(
            "w-5 h-5 transition-transform duration-300",
            isNotesOpen ? "scale-110" : "group-hover:scale-110"
          )} />
          {isNotesOpen && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
          )}
        </button>

        <button
          data-quick-action-trigger="true"
          onClick={() => {
            const willOpen = !isSoundOpen;
            closeAllPanels();
            setIsSoundOpen(willOpen);
          }}
          className={cn(
            "p-1.5 sm:p-2 rounded-xl transition-all duration-300 group relative",
            isSoundOpen ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
          )}
          title="Ambient Sound"
        >
          <Volume2 className={cn(
            "w-5 h-5 transition-transform duration-300",
            isSoundOpen ? "scale-110" : "group-hover:scale-110"
          )} />
          {isSoundOpen && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
          )}
        </button>

      </nav>
    </div>
  );
}


