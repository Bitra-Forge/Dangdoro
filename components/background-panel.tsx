"use client";

import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import Image from "next/image";

const backgrounds = [
  "none",
  "BG25.png",
  "Bg21.png",
  "Bg7.png",
  "1.jpg",
  "2.jpg",
  "3.jpg",
  "4.jpg",
  "City_1.jpg",
  "Seoul_1.jpg",
  "Seoul_2.jpg",
];

export function BackgroundPanel() {
  const isOpen = useTimerStore((state) => state.isBgPanelOpen);
  const setIsOpen = useTimerStore((state) => state.setIsBgPanelOpen);
  const currentBg = useTimerStore((state) => state.backgroundImage);
  const setBg = useTimerStore((state) => state.setBackgroundImage);

  if (!isOpen) return null;

  return (
    <div
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
        
        <div className="grid grid-cols-4 gap-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {backgrounds.map((bg) => (
            <button
              key={bg}
              onClick={() => setBg(bg)}
              className={cn(
                "relative aspect-video rounded-lg overflow-hidden border-2 transition-all duration-300 group",
                currentBg === bg 
                  ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                  : "border-transparent hover:border-white/30"
              )}
            >
              {bg === "none" ? (
                <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">None</span>
                </div>
              ) : (
                <>
                  <Image
                    src={`/Backgrounds/${bg}`}
                    alt={bg}
                    fill
                    className={cn(
                      "object-cover transition-transform duration-500",
                      currentBg === bg ? "scale-110" : "group-hover:scale-110"
                    )}
                  />
                  <div className={cn(
                    "absolute inset-0 bg-black/20 transition-opacity",
                    currentBg === bg ? "opacity-0" : "opacity-40 group-hover:opacity-10"
                  )} />
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
