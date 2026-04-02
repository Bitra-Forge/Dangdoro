"use client";

import { Space_Grotesk } from "next/font/google";
import { TimerCard } from "@/components/timer-card";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { LogIn, Zap, Clock, CheckCircle2 as CheckIcon, X as CloseIcon, Flame as FireIcon, ChevronDown, ChevronUp } from "lucide-react";
import { signInGuest } from "@/lib/auth";
import { toast } from "sonner";
import { useTimerStore } from "@/lib/store";
import { toggleTask } from "@/lib/db";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});

export default function Home() {
  const { user, loading } = useAuth();
  const backgroundImage = useTimerStore((state) => state.backgroundImage);
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const activeTaskLabel = useTimerStore((state) => state.activeTaskLabel);
  const activeTaskNotes = useTimerStore((state) => state.activeTaskNotes);
  const activeTaskPriority = useTimerStore((state) => state.activeTaskPriority);
  const clearTask = useTimerStore((state) => state.clearTask);
  const timeLeft = useTimerStore((state) => state.timeLeft);
  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const isActive = useTimerStore((state) => state.isActive);
  const mode = useTimerStore((state) => state.mode);

  const [notesExpanded, setNotesExpanded] = useState(false);

  const handleComplete = async () => {
    if (activeTaskId) {
      await toggleTask(activeTaskId, true);
      toast.success("Task completed!");
      clearTask();
    }
  };

  const priorityStyles: Record<string, { border: string; glow: string; text: string; dot: string; bg: string; label: string }> = {
    urgent: { label: "Urgent", border: "border-red-500/40", glow: "from-red-500/30 to-red-500/10", text: "text-red-400", dot: "bg-red-500", bg: "bg-red-500/5" },
    high: { label: "High Priority", border: "border-orange-500/40", glow: "from-orange-500/30 to-orange-500/10", text: "text-orange-400", dot: "bg-orange-500", bg: "bg-orange-500/5" },
    normal: { label: "Normal", border: "border-sky-500/40", glow: "from-sky-500/30 to-sky-500/10", text: "text-sky-400", dot: "bg-sky-500", bg: "bg-sky-500/5" },
    natural: { label: "Natural", border: "border-emerald-500/40", glow: "from-emerald-500/30 to-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500", bg: "bg-emerald-500/5" },
  };

  const p = priorityStyles[activeTaskPriority ?? "natural"] ?? priorityStyles.natural;
  const progress = initialFocusTime > 0 ? (timeLeft / initialFocusTime) * 100 : 0;

  return (
    <div className={`flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden ${spaceGrotesk.variable} font-sans`}
      style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none transition-all duration-1000">
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
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">

        {/* Premium Active Task Card - Top Right */}
        {activeTaskLabel && (
          <div className="fixed top-24 right-8 z-40 animate-in slide-in-from-right-12 fade-in duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]">
            <div className="relative group/card">
              {/* Animated Pulse Glow */}
              <div className={cn(
                "absolute -inset-2 bg-gradient-to-r rounded-[2rem] blur-2xl opacity-40 group-hover/card:opacity-70 transition-all duration-700 animate-pulse-slow pointer-events-none",
                p.glow
              )} />

              <div
                onClick={() => activeTaskNotes && setNotesExpanded(!notesExpanded)}
                className={cn(
                  "relative flex flex-col items-start px-6 py-5 bg-zinc-950/90 backdrop-blur-3xl border rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[280px] max-w-[320px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  p.border,
                  p.bg,
                  activeTaskNotes ? "cursor-pointer" : "cursor-default"
                )}>
                {/* Header with Priority Label */}
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-2 h-2 rounded-full animate-ping absolute", p.dot)} />
                    <div className={cn("w-2 h-2 rounded-full", p.dot)} />
                    <span className={cn("text-[10px] font-black uppercase tracking-[0.25em]", p.text)}>
                      {p.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={handleComplete}
                      title="Mark as complete"
                      className="group/btn p-2 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 rounded-xl transition-all duration-300 transform active:scale-90 shadow-lg shadow-emerald-500/0 hover:shadow-emerald-500/20"
                    >
                      <CheckIcon className="w-4 h-4 text-emerald-400 group-hover/btn:text-black transition-colors" />
                    </button>
                    <button
                      onClick={clearTask}
                      title="Clear from timer"
                      className="group/btn p-2 bg-white/5 hover:bg-white border border-white/10 hover:border-white rounded-xl transition-all duration-300 transform active:scale-90"
                    >
                      <CloseIcon className="w-4 h-4 text-zinc-400 group-hover/btn:text-black transition-colors" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col w-full">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base md:text-lg font-black text-white tracking-tight leading-snug">
                      {activeTaskLabel}
                    </h2>
                    {activeTaskNotes && (
                      <div className={cn("transition-transform duration-300", notesExpanded ? "rotate-180" : "")}>
                        <ChevronDown className="w-4 h-4 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {activeTaskNotes && (
                    <div className={cn(
                      "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      notesExpanded ? "max-h-60 opacity-100 mt-4" : "max-h-0 opacity-0"
                    )}>
                      <p className="text-[11px] font-medium leading-relaxed text-zinc-300 bg-white/5 rounded-2xl p-4 border border-white/5 whitespace-pre-wrap">
                        {activeTaskNotes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 opacity-60 mt-4">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="text-[11px] font-bold text-zinc-400 tabular-nums uppercase tracking-[0.15em]">
                    {Math.round(initialFocusTime / 60)} min / {mode === "focus" ? "Focused" : "Resting"}
                  </span>
                </div>

                {/* Functional Session Progress Bar */}
                <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden relative">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-linear",
                      mode === "focus" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                    )}
                    style={{ width: `${100 - progress}%` }}
                  />
                  {isActive && (
                    <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ backgroundSize: '200% 100%' }} />
                  )}
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
  );
}
