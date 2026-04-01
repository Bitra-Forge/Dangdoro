"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Check, X, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
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
    isTransparent,
    setTransparent
  } = useTimerStore();

  const { user } = useAuth();

  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);

  const [isEditing, setIsEditing] = useState(false);
  const [editHours, setEditHours] = useState("");
  const [editMins, setEditMins] = useState("");
  const [editSecs, setEditSecs] = useState("");

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
              const { focusTime, breakTime, longBreakTime } = data.settings;
              if (focusTime) setInitialTime("focus", focusTime * 60);
              if (breakTime) setInitialTime("break", breakTime * 60);
              if (longBreakTime) setInitialTime("long-break", longBreakTime * 60);
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
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in transition-all duration-1000 relative z-10">
      {/* Mode Switcher */}
      <div className="flex p-1.5 rounded-full bg-transparent relative z-20 w-full max-w-sm overflow-hidden group gap-1">
        <div 
          className={cn(
            "absolute top-1 bottom-1 transition-all duration-500 ease-in-out rounded-full z-0 border border-white/30 backdrop-blur-xl shadow-2xl",
            mode === "focus"      && "left-1 w-[calc(33.33%-6px)] bg-sky-500/20 shadow-sky-500/20",
            mode === "break"      && "left-[calc(33.33%+2px)] w-[calc(33.33%-6px)] bg-emerald-500/20 shadow-emerald-500/20",
            mode === "long-break" && "left-[calc(66.66%+2px)] w-[calc(33.33%-6px)] bg-purple-500/20 shadow-purple-500/20"
          )}
        />
        {[
          { id: "focus", label: "Focus" },
          { id: "break", label: "Break" },
          { id: "long-break", label: "Extended" }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={cn(
              "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 cursor-pointer relative z-10 rounded-full",
              "border border-white/20 hover:border-white/40",
              mode === m.id 
                ? cn(
                    "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] border-transparent",
                    m.id === "focus"      && "text-sky-100",
                    m.id === "break"      && "text-emerald-100",
                    m.id === "long-break" && "text-purple-100"
                  ) 
                : "text-white hover:text-white/80"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Timer Display */}
      <div className="relative group perspective-1000">
        <div className={cn(
          "absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150 transition-all duration-1000",
          isTransparent ? "opacity-0 invisible" : "opacity-40"
        )} />

        <div className={cn(
          "transition-all duration-700 relative overflow-hidden",
          isTransparent 
            ? "bg-transparent border-transparent shadow-none" 
            : "bg-zinc-900/40 backdrop-blur-3xl border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)]",
          "rounded-[3rem] p-12 md:p-16 flex flex-col items-center justify-center min-w-[280px] md:min-w-[480px]",
          isEditing && "ring-2 ring-white/20 bg-zinc-900/60"
        )}>
          {/* Dynamic Corner Accents */}
          <div className={cn(
            "absolute top-0 right-0 w-32 h-32 blur-[64px] transition-all duration-1000 shadow-2xl",
            isTransparent ? "opacity-0 invisible" : "opacity-20",
            mode === "focus" && "bg-sky-500",
            mode === "break" && "bg-emerald-500",
            mode === "long-break" && "bg-purple-500"
          )} />
          <div className={cn(
            "absolute bottom-0 left-0 w-32 h-32 blur-[64px] transition-all duration-1000 shadow-2xl",
            isTransparent ? "opacity-0 invisible" : "opacity-20",
            mode === "focus" && "bg-blue-600",
            mode === "break" && "bg-green-600",
            mode === "long-break" && "bg-indigo-600"
          )} />

          {isEditing ? (
            <div className="flex flex-col items-center gap-8">
              <div className="flex items-center gap-4 text-primary font-sans">
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("h", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                  <input
                    type="text"
                    value={editHours}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => setEditHours(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 transition-all font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("h", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                </div>
                <span className="text-6xl md:text-8xl font-bold mb-8 opacity-20">:</span>
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("m", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                  <input
                    type="text"
                    autoFocus
                    value={editMins}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => setEditMins(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 transition-all font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("m", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                </div>
                <span className="text-6xl md:text-8xl font-bold mb-8 opacity-20">:</span>
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("s", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                  <input
                    type="text"
                    value={editSecs}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => setEditSecs(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 transition-all font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("s", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
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
              <h1
                onClick={startEditing}
                title="Click to edit"
                className={cn(
                  "text-[8rem] md:text-[11rem] font-black tracking-tighter leading-none select-none drop-shadow-2xl cursor-pointer",
                  "bg-gradient-to-br from-white via-white/90 to-white/60 bg-clip-text text-transparent",
                  "font-sans transition-all duration-700 hover:scale-[1.02]",
                  mode === "focus" && "drop-shadow-[0_0_50px_rgba(56,189,248,0.3)]",
                  mode === "break" && "drop-shadow-[0_0_50px_rgba(34,197,94,0.3)]",
                  mode === "long-break" && "drop-shadow-[0_0_50px_rgba(168,85,247,0.3)]"
                )}
              >
                {formatTime(timeLeft)}
              </h1>

              {/* Progress Bar */}
              {isActive && (
                <div className="w-full max-w-xs h-1 bg-white/10 rounded-full mt-2 mb-2 overflow-hidden relative">
                  <div 
                    className={cn(
                      "absolute left-0 top-0 h-full transition-all duration-500 ease-out",
                      mode === "focus"      && "bg-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.5)]",
                      mode === "break"      && "bg-emerald-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]",
                      mode === "long-break" && "bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, 100 - (timeLeft / (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime)) * 100))}%` }}
                  />
                </div>
              )}

              <div className={cn(
                "flex items-center gap-6 mt-10 transition-all duration-700",
                isActive ? "opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 invisible group-hover:visible" : "opacity-100"
              )}>
                <Button
                  onClick={isActive ? pause : start}
                  className={cn(
                    "h-16 px-10 rounded-full text-lg font-black uppercase tracking-widest transition-all duration-500 shadow-2xl relative overflow-hidden group/btn",
                    isActive 
                      ? "bg-white/10 text-white hover:bg-white/20 border border-white/10" 
                      : "bg-white/5 text-white hover:bg-white/10 border border-white/20"
                  )}
                >
                  {!isActive && mode === "focus" && <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-blue-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />}
                  {!isActive && mode === "break" && <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-green-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />}
                  {!isActive && mode === "long-break" && <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />}

                  <span className="relative z-10 flex items-center">
                    {isActive ? <Pause className="mr-3 fill-current w-5 h-5" /> : <Play className="mr-3 fill-current w-5 h-5" />}
                    {isActive ? "Pause" : "Start"}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={reset}
                  className="h-16 w-16 rounded-full border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all duration-500 shadow-xl"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTransparent(!isTransparent)}
                  className={cn(
                    "h-16 w-16 rounded-full border border-white/10 transition-all duration-500 shadow-xl",
                    isTransparent ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                  )}
                  title={isTransparent ? "Show Background" : "Make Transparent"}
                >
                  {isTransparent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
