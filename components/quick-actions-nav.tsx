"use client";

import { Image as ImageIcon, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";

export function QuickActionsNav() {


  const isOpen = useTimerStore((state) => state.isBgPanelOpen);
  const setIsOpen = useTimerStore((state) => state.setIsBgPanelOpen);

  return (
    <div className="relative">
      {/* Main Nav Bar */}
      <nav className="flex items-center gap-2 p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-2 rounded-xl transition-all duration-300 group relative",
            isOpen ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
          )}
          title="Change Background"
        >
          <ImageIcon className={cn(
            "w-5 h-5 transition-transform duration-300",
            isOpen ? "scale-110" : "group-hover:scale-110"
          )} />
          {isOpen && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
          )}
        </button>

        <button
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all duration-300 group"
          title="Sound Settings (Coming Soon)"
        >
          <Volume2 className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
        </button>
      </nav>
    </div>
  );
}

