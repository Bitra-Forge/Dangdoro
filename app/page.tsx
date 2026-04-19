"use client";

import { Space_Grotesk } from "next/font/google";
import { TimerCard } from "@/components/timer-card";
import { Clock, CheckCircle2 as CheckIcon, X as CloseIcon, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTimerStore } from "@/lib/store";
import { toggleTask } from "@/lib/db";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BackgroundTheme } from "@/components/background-theme";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});

export default function Home() {
  const backgroundImage = useTimerStore((state) => state.backgroundImage);
  const backgroundSolidColor = useTimerStore((state) => state.backgroundSolidColor);
  const noneBackgroundMode = useTimerStore((state) => state.noneBackgroundMode);
  const noneBackgroundGradient = useTimerStore((state) => state.noneBackgroundGradient);
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const activeTaskLabel = useTimerStore((state) => state.activeTaskLabel);
  const activeTaskNotes = useTimerStore((state) => state.activeTaskNotes);
  const activeTaskPriority = useTimerStore((state) => state.activeTaskPriority);
  const clearTask = useTimerStore((state) => state.clearTask);
  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const mode = useTimerStore((state) => state.mode);

  const [notesExpanded, setNotesExpanded] = useState(false);

  const handleComplete = async () => {
    if (activeTaskId) {
      await toggleTask(activeTaskId, true);
      toast.success("Task completed!");
      clearTask();
    }
  };

  const priorityStyles: Record<string, { border: string; glow: string; text: string; dot: string; label: string }> = {
    urgent: { label: "Urgent", border: "border-red-500/50", glow: "from-red-500/30 to-transparent", text: "text-red-400", dot: "bg-red-500" },
    high: { label: "High Priority", border: "border-orange-500/50", glow: "from-orange-500/30 to-transparent", text: "text-orange-400", dot: "bg-orange-500" },
    normal: { label: "Normal", border: "border-sky-500/50", glow: "from-sky-500/30 to-transparent", text: "text-sky-400", dot: "bg-sky-500" },
    natural: { label: "Natural", border: "border-emerald-500/50", glow: "from-emerald-500/30 to-transparent", text: "text-emerald-400", dot: "bg-emerald-500" },
  };

  const p = priorityStyles[activeTaskPriority ?? "natural"] ?? priorityStyles.natural;

  return (
    <BackgroundTheme showSettings={true} isHomePage={true}>
      <div className={`flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden ${spaceGrotesk.variable} font-sans`}
      style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none transition-all duration-1000">
        {backgroundImage === "none" && (
          <div
            className="absolute inset-0"
            style={
              noneBackgroundMode === "gradient"
                ? { backgroundImage: noneBackgroundGradient }
                : { backgroundColor: backgroundSolidColor }
            }
          />
        )}
        {backgroundImage !== "none" && (
          <>
            <Image
              key={backgroundImage}
              src={`/Backgrounds/${backgroundImage}`}
              alt="Background"
              fill
              sizes="100vw"
              priority
              className="object-cover opacity-100 transition-all duration-1000 animate-in fade-in fill-mode-forwards"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950/40" />
          </>
        )}
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">

        {/* Premium Active Task Card - Top Right */}
        {activeTaskLabel && (
          <div className="fixed top-24 right-10 z-40 animate-in slide-in-from-right-12 fade-in duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]">
            <div className="relative group/card animate-float">
              {/* Animated Pulse Glow */}
              <div className={cn(
                "absolute -inset-4 bg-gradient-to-r rounded-[2rem] blur-3xl opacity-10 group-hover/card:opacity-20 transition-all duration-1000 animate-pulse-slow pointer-events-none",
                p.glow
              )} />

              <div
                onClick={() => activeTaskNotes && setNotesExpanded(!notesExpanded)}
                className={cn(
                  "relative flex flex-col items-start px-6 py-5 bg-zinc-950/60 backdrop-blur-3xl border border-white/5 rounded-[2rem] shadow-[0_25px_50px_rgba(0,0,0,0.7)] min-w-[280px] max-w-[340px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/card:border-white/10 group-hover/card:bg-zinc-950/80",
                  activeTaskNotes ? "cursor-pointer" : "cursor-default"
                )}>
                {/* Header with Priority Label */}
                <div className="flex items-center justify-between w-full mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                      <div className={cn("w-2 h-2 rounded-full animate-ping absolute opacity-70", p.dot)} />
                      <div className={cn("w-2 h-2 rounded-full relative z-10", p.dot)} />
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.25em] font-sans", p.text)}>
                      {p.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={handleComplete}
                      title="Mark as complete"
                      className="group/btn p-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 rounded-xl transition-all duration-300 transform active:scale-90 shadow-lg shadow-emerald-500/0 hover:shadow-emerald-500/20"
                    >
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-400 group-hover/btn:text-black transition-colors" />
                    </button>
                    <button
                      onClick={clearTask}
                      title="Clear from timer"
                      className="group/btn p-2 bg-white/5 hover:bg-white border border-white/10 hover:border-white rounded-xl transition-all duration-300 transform active:scale-90"
                    >
                      <CloseIcon className="w-3.5 h-3.5 text-zinc-400 group-hover/btn:text-black transition-colors" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col w-full mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg md:text-xl font-bold text-zinc-100 tracking-tight leading-tight group-hover/card:text-white transition-colors duration-500">
                      {activeTaskLabel}
                    </h2>
                    {activeTaskNotes && (
                      <div className={cn("transition-transform duration-500", notesExpanded ? "rotate-180" : "")}>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                      </div>
                    )}
                  </div>

                  {activeTaskNotes && (
                    <div className={cn(
                      "overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      notesExpanded ? "max-h-60 opacity-100 mt-4" : "max-h-0 opacity-0"
                    )}>
                      <p className="text-[11px] font-medium leading-relaxed text-zinc-400 bg-white/5 rounded-2xl p-4 border border-white/5 whitespace-pre-wrap">
                        {activeTaskNotes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between w-full pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-500 tabular-nums uppercase tracking-wider">
                      {Math.round(initialFocusTime / 60)}m Session
                    </span>
                  </div>

                  <div className={cn(
                    "px-2.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest",
                    mode === "focus"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-sky-500/10 border-sky-500/20 text-sky-400"
                  )}>
                    {mode === "focus" ? "Focus" : "Rest"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-4xl flex items-center justify-center animate-in fade-in duration-700">
          <TimerCard />
        </div>
      </main>
      </div>
    </BackgroundTheme>
  );
}
