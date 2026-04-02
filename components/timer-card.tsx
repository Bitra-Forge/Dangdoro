"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Check, X, ChevronUp, ChevronDown, Settings, Minus, Plus } from "lucide-react";
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
    reset,
    setMode,
    setInitialTime,
    incrementTime
  } = useTimerStore();

  const { user } = useAuth();

  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);

  const [isEditing, setIsEditing] = useState(false);
  const [editHours, setEditHours] = useState("");
  const [editMins, setEditMins] = useState("");
  const [editSecs, setEditSecs] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState(1); // in minutes

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
              if (focusTime) setInitialTime("focus", focusTime * 60);
              if (breakTime) setInitialTime("break", breakTime * 60);
              if (longBreakTime) setInitialTime("long-break", longBreakTime * 60);
              if (adj) setAdjustmentAmount(adj);
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
            <div className="flex items-center gap-4 md:gap-8 group/display">
              <button
                onClick={() => incrementTime(-adjustmentAmount * 60)}
                className="opacity-0 group-hover/display:opacity-30 hover:!opacity-100 transition-all duration-300 transform hover:scale-110 active:scale-90 text-white"
              >
                <Minus className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2} />
              </button>

              <h1
                onClick={startEditing}
                title="Click to edit"
                className={cn(
                  "text-[6rem] md:text-[8rem] font-black leading-none select-none drop-shadow-2xl cursor-pointer",
                  "bg-gradient-to-br from-white via-white/90 to-white/60 bg-clip-text text-transparent",
                  "font-sans transition-all duration-700 mx-2"
                )}
              >
                {formatTime(timeLeft)}
              </h1>

              <button
                onClick={() => incrementTime(adjustmentAmount * 60)}
                className="opacity-0 group-hover/display:opacity-30 hover:!opacity-100 transition-all duration-300 transform hover:scale-110 active:scale-90 text-white"
              >
                <Plus className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2} />
              </button>
            </div>

              {/* Progress Bar */}
              {isActive && (
                <div className="flex items-center gap-4 w-[320px] mt-2 mb-2 group/progress">
                  <div className="flex-1 h-[2px] bg-white/5 rounded-full relative transition-all duration-1000">
                    <div
                      className={cn(
                        "absolute left-0 top-0 h-full transition-all duration-1000 ease-linear rounded-full",
                        mode === "focus" && "shadow-[0_0_10px_rgba(56,189,248,1),0_0_20px_rgba(56,189,248,0.6)] bg-sky-400",
                        mode === "break" && "shadow-[0_0_10px_rgba(52,211,153,1),0_0_20px_rgba(52,211,153,0.6)] bg-emerald-400",
                        mode === "long-break" && "shadow-[0_0_10px_rgba(192,132,252,1),0_0_20px_rgba(192,132,252,0.6)] bg-purple-400"
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(0, (1 - (timeLeft / (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime))) * 100))}%`
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-white tracking-widest uppercase tabular-nums">
                    {Math.round(Math.min(100, Math.max(0, (1 - (timeLeft / (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime))) * 100)))}%
                  </span>
                </div>
              )}

              <div className={cn(
                "flex items-center gap-4 mt-8 transition-all duration-500",
                isActive && "opacity-0 group-hover/timer:opacity-100"
              )}>
                <Button
                  onClick={isActive ? pause : start}
                  className={cn(
                    "h-14 px-12 rounded-full text-lg font-bold transition-all duration-300",
                    "bg-white text-black hover:bg-zinc-200"
                  )}
                >
                  <span className="relative z-10 flex items-center">
                    {isActive ? "pause" : "start"}
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={reset}
                  className="h-14 w-14 rounded-full text-white/60 hover:text-white hover:bg-white/5 transition-all duration-300"
                >
                  <RotateCcw className="w-6 h-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 rounded-full text-white/60 hover:text-white hover:bg-white/5 transition-all duration-300"
                  onClick={() => (window.location.href = "/settings")}
                >
                  <Settings className="w-6 h-6" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
