"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, RotateCcw, Check, X, ChevronUp, ChevronDown, Settings, Minus, Plus, Eye, EyeOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function TimerCard() {
  const {
    timeLeft,
    isActive,
    mode,
    start,
    pause,
    stop,
    reset,
    setMode,
    setInitialTime,
    incrementTime,
    activeTaskLabel,
    clearTask,
    isNavFocusMode,
    toggleNavFocusMode,
    setSessionEndSound,
    sessionStartTime,
  } = useTimerStore();

  const { user } = useAuth();
  const router = useRouter();

  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);

  const [isEditing, setIsEditing] = useState(false);
  const [editHours, setEditHours] = useState("");
  const [editMins, setEditMins] = useState("");
  const [editSecs, setEditSecs] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState(1); // in minutes
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleStop = async () => {
    const startTime = sessionStartTime;
    stop();

    if (!startTime) {
      return;
    }

    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = Math.round(elapsedMs / 60000);

    if (mode === "focus" && elapsedMinutes >= 1) {
      let currentUser = user;
      if (!currentUser) {
        const { signInGuest } = await import("@/lib/auth");
        currentUser = await signInGuest();
      }

      if (currentUser) {
        const { savePartialPomodoroSession } = await import("@/lib/db");
        await savePartialPomodoroSession(currentUser.uid, elapsedMinutes);
      }
    }

    reset();
  };

  // Hydration guard: only render on client after storage is loaded
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    let unsub: () => void;
    try {
      unsub = onSnapshot(
        doc(db, "users", user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.settings) {
              const { focusTime, breakTime, longBreakTime, adjustmentAmount: adj } = data.settings;
              
              // Get current state to check if timer is in progress
              const state = useTimerStore.getState();
              const isTimerInProgress = state.isActive || 
                state.timeLeft !== state.initialFocusTime ||
                state.focusTimeLeft !== state.initialFocusTime ||
                state.breakTimeLeft !== state.initialBreakTime ||
                state.longBreakTimeLeft !== state.initialLongBreakTime;
              
              // Only update settings if no active task AND timer hasn't started
              if (!activeTaskLabel && !isTimerInProgress) {
                if (focusTime) setInitialTime("focus", focusTime * 60);
                if (breakTime) setInitialTime("break", breakTime * 60);
                if (longBreakTime) setInitialTime("long-break", longBreakTime * 60);
              }
              if (adj) setAdjustmentAmount(adj);
              if (data.settings.sessionEndSound) {
                setSessionEndSound(data.settings.sessionEndSound);
              }
            }
          }
        },
        (error) => {
          console.error("TimerCard Firestore error:", error);
        }
      );
    } catch (err) {
      console.error("Failed to setup TimerCard listener:", err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, setInitialTime]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startEditing = () => {
    pause();
    const hrs = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);
    const secs = timeLeft % 60;
    setEditHours(hrs.toString().padStart(2, "0"));
    setEditMins(mins.toString().padStart(2, "0"));
    setEditSecs(secs.toString().padStart(2, "0"));
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    const h = parseInt(editHours) || 0;
    const m = parseInt(editMins) || 0;
    const s = parseInt(editSecs) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;

    if (totalSeconds >= 0) {
      setInitialTime(mode, totalSeconds);
    }
    setIsEditing(false);
  };

  const adjustValue = (type: "h" | "m" | "s", delta: number) => {
    const fn = (prev: string, d: number, max: number) => {
      const val = Math.max(0, Math.min(max, (parseInt(prev) || 0) + d));
      return val.toString().padStart(2, "0");
    };
    if (type === "h") setEditHours(p => fn(p, delta, 99));
    if (type === "m") setEditMins(p => fn(p, delta, 59));
    if (type === "s") setEditSecs(p => fn(p, delta, 59));
  };

  // Prevent flicker by not rendering until hydration is complete
  if (!hasHydrated) {
    return (
      <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in transition-all duration-1000 relative z-10 opacity-0">
        {/* Placeholder to reserve space and prevent layout shift */}
        <div className="h-[200px]" />
      </div>
    );
  }

  return (
    <div className="group/timer flex flex-col items-center justify-center space-y-8 animate-in fade-in transition-all duration-1000 relative z-10">
      {/* Mode Switcher */}
      <div className={cn(
        "flex items-center gap-4 relative z-20 w-fit transition-all duration-700",
        isActive && !isEditing ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {[
          { id: "focus", label: "pomodoro" },
          { id: "break", label: "short break" },
          { id: "long-break", label: "long break" }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={cn(
              "px-8 py-3 text-sm font-bold transition-all duration-300 rounded-full cursor-pointer border",
              mode === m.id
                ? "bg-white text-black border-transparent"
                : "bg-white/5 text-white border-white/20 hover:border-white/40"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Timer Display */}
      <div className="relative group perspective-1000">
        <div className={cn(
          "transition-all duration-700 relative",
          "bg-transparent border-transparent shadow-none",
          "flex flex-col items-center justify-center w-full"
        )}>
          {isEditing ? (
            <div className="flex flex-col items-center gap-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-4 text-white">
                <div className="flex flex-col items-center gap-2 group/field">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("h", 1)} className="hover:bg-white/5 opacity-0 group-hover/field:opacity-50 transition-opacity"><ChevronUp className="w-4 h-4" /></Button>
                  <input
                    type="text"
                    value={editHours}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => setEditHours(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="text-5xl md:text-7xl font-bold bg-transparent w-16 md:w-24 text-center outline-none border-b-2 border-white/10 focus:border-white transition-all"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("h", -1)} className="hover:bg-white/5 opacity-0 group-hover/field:opacity-50 transition-opacity"><ChevronDown className="w-4 h-4" /></Button>
                </div>
                <span className="text-5xl md:text-7xl font-bold mb-8 opacity-20">:</span>
                <div className="flex flex-col items-center gap-2 group/field">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("m", 1)} className="hover:bg-white/5 opacity-0 group-hover/field:opacity-50 transition-opacity"><ChevronUp className="w-4 h-4" /></Button>
                  <input
                    type="text"
                    autoFocus
                    value={editMins}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => setEditMins(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="text-5xl md:text-7xl font-bold bg-transparent w-16 md:w-24 text-center outline-none border-b-2 border-white/10 focus:border-white transition-all"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("m", -1)} className="hover:bg-white/5 opacity-0 group-hover/field:opacity-50 transition-opacity"><ChevronDown className="w-4 h-4" /></Button>
                </div>
                <span className="text-5xl md:text-7xl font-bold mb-8 opacity-20">:</span>
                <div className="flex flex-col items-center gap-2 group/field">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("s", 1)} className="hover:bg-white/5 opacity-0 group-hover/field:opacity-50 transition-opacity"><ChevronUp className="w-4 h-4" /></Button>
                  <input
                    type="text"
                    value={editSecs}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => setEditSecs(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="text-5xl md:text-7xl font-bold bg-transparent w-16 md:w-24 text-center outline-none border-b-2 border-white/10 focus:border-white transition-all"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("s", -1)} className="hover:bg-white/5 opacity-0 group-hover/field:opacity-50 transition-opacity"><ChevronDown className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleEditSubmit} className="rounded-full px-12 h-14 font-black uppercase tracking-widest bg-white text-black hover:scale-105 transition-all">
                  <Check className="mr-2 w-5 h-5" /> Save
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-full px-12 h-14 font-black uppercase tracking-widest border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all">
                  <X className="mr-2 w-5 h-5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4 md:gap-8 h-[160px] md:h-[200px]">
                {/* Fixed position Step Buttons around the center */}
                <div className="w-8 flex justify-center shrink-0">
                  <button
                    onClick={() => incrementTime(-adjustmentAmount * 60)}
                    className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-all duration-300 transform active:scale-95 text-white opacity-0 group-hover/timer:opacity-100 bg-transparent"
                  >
                    <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>

                <div className="w-fit flex justify-center items-center">
                  <h1
                    onClick={startEditing}
                    title="Click to edit"
                    className={cn(
                      "text-[5rem] md:text-[8rem] font-black leading-none select-none drop-shadow-2xl cursor-pointer tabular-nums",
                      "bg-gradient-to-br from-white via-white/90 to-white/60 bg-clip-text text-transparent",
                      "font-sans transition-all duration-700"
                    )}
                  >
                    {formatTime(timeLeft)}
                  </h1>
                </div>

                <div className="w-8 flex justify-center shrink-0">
                  <button
                    onClick={() => incrementTime(adjustmentAmount * 60)}
                    className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-all duration-300 transform active:scale-95 text-white opacity-0 group-hover/timer:opacity-100 bg-transparent"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>


              {/* Progress Bar Section */}
              <div className="flex items-center gap-4 w-[320px] mt-2 mb-2 group/progress">
                <div className="flex-1 h-[2px] bg-white/5 rounded-full relative transition-all duration-1000">
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full transition-all duration-1000 ease-linear rounded-full",
                      !isActive && "opacity-0 group-hover/timer:opacity-100",
                      mode === "focus" && "shadow-[0_0_10px_rgba(56,189,248,1),0_0_20px_rgba(56,189,248,0.6)] bg-sky-400",
                      mode === "break" && "shadow-[0_0_10px_rgba(52,211,153,1),0_0_20px_rgba(52,211,153,0.6)] bg-emerald-400",
                      mode === "long-break" && "shadow-[0_0_10px_rgba(192,132,252,1),0_0_20px_rgba(192,132,252,0.6)] bg-purple-400"
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, (1 - (timeLeft / (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime))) * 100))}%`
                    }}
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-black text-white tracking-widest uppercase tabular-nums transition-opacity duration-300",
                  !isActive && "opacity-0 group-hover/timer:opacity-100"
                )}>
                  {Math.round(Math.min(100, Math.max(0, (1 - (timeLeft / (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime))) * 100)))}%
                </span>
              </div>

              <div className={cn(
                "flex items-center justify-center gap-4 mt-10 transition-all duration-500",
                isActive && "opacity-0 group-hover/timer:opacity-100"
              )}>
                {/* Spacer to balance the layout */}
                <div className="w-16 shrink-0" />

                {/* Center: Start / Stop */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={async () => {
                      if (isActive) {
                        pause();
                      } else {
                        let currentUser = user;
                        if (!currentUser) {
                          const { signInGuest } = await import("@/lib/auth");
                          currentUser = await signInGuest();
                        }

                        if (currentUser && currentUser.isAnonymous) {
                          const { syncUserProfile } = await import("@/lib/db");
                          syncUserProfile(currentUser);
                        }
                        start();
                      }
                    }}
                    className={cn(
                      "h-16 px-16 rounded-2xl text-lg font-bold transition-all duration-300 shadow-xl cursor-pointer",
                      isActive
                        ? "bg-white/10 text-white border-2 border-white/20 active:scale-100"
                        : "bg-white text-black active:scale-100"
                    )}
                  >
                    <span className="relative z-10 flex items-center gap-2.5">
                      {isActive ? (
                        <>
                          <Pause className="w-5 h-5" />
                          pause
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          start
                        </>
                      )}
                    </span>
                  </Button>

                  {isActive && (
                    <Button
                      onClick={handleStop}
                      className="h-16 px-8 rounded-2xl text-lg font-bold transition-all duration-300 bg-red-500/90 text-white border-2 border-red-400/50 active:scale-100 shadow-xl shadow-red-500/25 cursor-pointer"
                    >
                      <Square className="w-5 h-5 mr-2 fill-current" />
                      stop
                    </Button>
                  )}
                </div>

                {/* Right: Settings Toggle + Sliding Panel */}
                <div className="relative flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    title="Toggle settings"
                    className={cn(
                      "h-16 w-16 rounded-2xl transition-all duration-300 cursor-pointer",
                      isSettingsOpen
                        ? "text-white bg-white/15"
                        : "text-white/50"
                    )}
                  >
                    <Settings className={cn(
                      "w-6 h-6 transition-transform duration-300",
                      isSettingsOpen && "rotate-90"
                    )} />
                  </Button>

                  {/* Sliding Panel to the Right */}
                  <div className={cn(
                    "absolute left-full ml-3 overflow-hidden transition-all duration-500 ease-out",
                    isSettingsOpen ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0"
                  )}>
                    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-2xl px-3 py-2 border border-white/10 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={reset}
                        title="Reset timer"
                        className="h-11 w-11 rounded-xl text-white/60 transition-all duration-300 shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </Button>

                      <div className="w-px h-6 bg-white/10" />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleNavFocusMode}
                        title={isNavFocusMode ? "Disable Focus Mode (show nav)" : "Enable Focus Mode (hide nav)"}
                        className={cn(
                          "h-11 w-11 rounded-xl transition-all duration-300 shrink-0 cursor-pointer",
                          isNavFocusMode
                            ? "text-white bg-white/10"
                            : "text-white/50"
                        )}
                      >
                        {isNavFocusMode ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div >
  );
}
