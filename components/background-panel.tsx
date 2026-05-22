"use client";

import { useEffect, useRef } from "react";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
const backgrounds = ["none"] as const;

export function BackgroundPanel() {
  const isOpen = useTimerStore((state) => state.isBgPanelOpen);
  const setIsOpen = useTimerStore((state) => state.setIsBgPanelOpen);
  const currentBg = useTimerStore((state) => state.backgroundImage);
  const setBg = useTimerStore((state) => state.setBackgroundImage);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-quick-action-trigger="true"]')) {
        return;
      }

      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute bottom-full mb-4 left-0 w-full transition-all duration-500 transform origin-bottom z-50",
        isOpen 
          ? "opacity-100 scale-100 pointer-events-auto" 
          : "opacity-0 scale-95 pointer-events-none translate-y-4"
      )}
    >
      <div className="bg-zinc-900/80 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Backgrounds</h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg}
              onClick={() => setBg(bg)}
              className={cn(
                "relative aspect-video rounded-lg overflow-hidden border-2 transition-all duration-300",
                currentBg === bg
                  ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  : "border-transparent hover:border-white/30"
              )}
            >
              <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">None</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
