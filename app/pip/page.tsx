"use client";

import { useEffect, useState } from "react";
import { useTimerStore } from "@/lib/store";
import Image from "next/image";
import { Play, Pause, RotateCcw } from "lucide-react";

const modeLabels = {
  focus: "Focus",
  break: "Break",
  "long-break": "Long Break",
};

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function PiPPage() {
  const [hasHydrated, setHasHydrated] = useState(false);

  const timeLeft = useTimerStore((state) => state.timeLeft);
  const isActive = useTimerStore((state) => state.isActive);
  const mode = useTimerStore((state) => state.mode);
  const backgroundImage = useTimerStore((state) => state.backgroundImage);
  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);
  const start = useTimerStore((state) => state.start);
  const pause = useTimerStore((state) => state.pause);
  const reset = useTimerStore((state) => state.reset);
  const setMode = useTimerStore((state) => state.setMode);

  // Hydration guard
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Update window title with timer
  useEffect(() => {
    if (isActive) {
      document.title = `${formatTime(timeLeft)} - ${modeLabels[mode]}`;
    } else {
      document.title = `Dangdoro Timer`;
    }
  }, [timeLeft, isActive, mode]);

  const initialTime = mode === "focus" 
    ? initialFocusTime 
    : mode === "break" 
      ? initialBreakTime 
      : initialLongBreakTime;

  const progress = (timeLeft / initialTime) * 100;

  const modeButtonClass = (m: typeof mode) => {
    const isCurrentMode = mode === m;
    const baseClasses = "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200";
    
    if (m === "focus") {
      return `${baseClasses} ${isCurrentMode ? "bg-emerald-500 text-black" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`;
    } else if (m === "break") {
      return `${baseClasses} ${isCurrentMode ? "bg-sky-500 text-black" : "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"}`;
    } else {
      return `${baseClasses} ${isCurrentMode ? "bg-violet-500 text-black" : "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"}`;
    }
  };

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden flex flex-col">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={`/Backgrounds/${backgroundImage}`}
          alt="Background"
          fill
          sizes="100vw"
          priority
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 via-zinc-950/40 to-zinc-950/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {/* Mode indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-3 h-3 rounded-full animate-pulse ${
            mode === "focus" ? "bg-emerald-500" : 
            mode === "break" ? "bg-sky-500" : "bg-violet-500"
          }`} />
          <span className={`text-sm font-bold uppercase tracking-widest ${
            mode === "focus" ? "text-emerald-400" : 
            mode === "break" ? "text-sky-400" : "text-violet-400"
          }`}>
            {modeLabels[mode]}
          </span>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <span className="text-6xl font-bold text-white tabular-nums tracking-tight drop-shadow-lg">
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Progress Ring / Bar */}
        <div className="w-full max-w-[200px] h-2 bg-zinc-800/50 rounded-full mb-8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              mode === "focus" ? "bg-emerald-500" : 
              mode === "break" ? "bg-sky-500" : "bg-violet-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={reset}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5 text-zinc-400" />
          </button>
          
          <button
            onClick={() => (isActive ? pause() : start())}
            className={`p-5 rounded-2xl border transition-all duration-200 transform active:scale-95 ${
              isActive
                ? "bg-white/10 border-white/20 hover:bg-white/20"
                : mode === "focus"
                  ? "bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30"
                  : mode === "break"
                    ? "bg-sky-500/20 border-sky-500/30 hover:bg-sky-500/30"
                    : "bg-violet-500/20 border-violet-500/30 hover:bg-violet-500/30"
            }`}
          >
            {isActive ? (
              <Pause className="w-7 h-7 text-white" />
            ) : (
              <Play className={`w-7 h-7 ${
                mode === "focus" ? "text-emerald-400" : 
                mode === "break" ? "text-sky-400" : "text-violet-400"
              }`} />
            )}
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("focus")}
            className={modeButtonClass("focus")}
          >
            Focus
          </button>
          <button
            onClick={() => setMode("break")}
            className={modeButtonClass("break")}
          >
            Break
          </button>
          <button
            onClick={() => setMode("long-break")}
            className={modeButtonClass("long-break")}
          >
            Long
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 p-4 text-center">
        <span className="text-xs text-zinc-600">Dangdoro Timer</span>
      </div>
    </div>
  );
}
