"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { savePomodoroSession } from "@/lib/db";
import { toast } from "sonner";
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
    tick,
    setMode,
    setInitialTime
  } = useTimerStore();

  const {
    user
  } = useAuth();

  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);

  const [isEditing, setIsEditing] = useState(false);

  // Local state for editing as strings to avoid cursor jumping and auto-padding issues
  const [editHours, setEditHours] = useState("");
  const [editMins, setEditMins] = useState("");
  const [editSecs, setEditSecs] = useState("");

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.settings) {
          const { focusTime, breakTime, longBreakTime } = data.settings;
          if (focusTime) setInitialTime("focus", focusTime * 60);
          if (breakTime) setInitialTime("break", breakTime * 60);
          if (longBreakTime) setInitialTime("long-break", longBreakTime * 60);
        }
      }
    });

    return () => unsub();
  }, [user, setInitialTime]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive) {
      timer = setInterval(() => {
        tick();
      }, 1000);
    }

    // Check for completion
    if (timeLeft === 0 && isActive) {
      if (mode === "focus" && user) {
        savePomodoroSession(user.uid, Math.floor(initialFocusTime / 60))
          .then(() => toast.success("Session saved! Keep it up!"))
          .catch(() => toast.error("Failed to save session."));
      }
      pause();
    }

    return () => clearInterval(timer);
  }, [isActive, tick, timeLeft, mode, user, initialFocusTime, pause]);

  // Sound Notification Effect
  useEffect(() => {
    if (timeLeft === 0 && !isActive) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.volume = 0.4;
      audio.play().catch(err => console.log("Audio blocked:", err));
    }
  }, [timeLeft, isActive]);

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
    pause(); // Automatically pause when entering edit mode
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
    if (type === "h") setEditHours(prev => {
      const val = Math.max(0, Math.min(99, (parseInt(prev) || 0) + delta));
      return val.toString().padStart(2, "0");
    });
    if (type === "m") setEditMins(prev => {
      const val = Math.max(0, Math.min(59, (parseInt(prev) || 0) + delta));
      return val.toString().padStart(2, "0");
    });
    if (type === "s") setEditSecs(prev => {
      const val = Math.max(0, Math.min(59, (parseInt(prev) || 0) + delta));
      return val.toString().padStart(2, "0");
    });
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in transition-all duration-1000 relative z-10">
      {/* Mode Switcher (The 3 Choices) */}
      <div className="flex p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative z-20 shadow-xl">
        {[
          { id: "focus", label: "Focus", color: "from-sky-400 to-blue-500" },
          { id: "break", label: "Break", color: "from-emerald-400 to-green-500" },
          { id: "long-break", label: "Extended", color: "from-purple-400 to-indigo-500" }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={cn(
              "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 cursor-pointer relative overflow-hidden",
              mode === m.id
                ? "text-black shadow-2xl"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            )}
          >
            {mode === m.id && (
              <div className={cn("absolute inset-0 bg-gradient-to-br -z-10 animate-in fade-in zoom-in duration-500", m.color)} />
            )}
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Timer Display */}
      <div className="relative group perspective-1000">
        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150 opacity-40 transition-opacity duration-1000" />

        <div className={cn(
          "bg-zinc-900/40 backdrop-blur-3xl border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] rounded-[3rem] p-12 md:p-16 flex flex-col items-center justify-center min-w-[280px] md:min-w-[480px] transition-all duration-700 relative overflow-hidden",
          isEditing && "ring-2 ring-white/20 bg-zinc-900/60"
        )}>
          {/* Dynamic Corner Accents */}
          <div className={cn(
            "absolute top-0 right-0 w-32 h-32 blur-[64px] transition-all duration-1000 opacity-20",
            mode === "focus" && "bg-sky-500",
            mode === "break" && "bg-emerald-500",
            mode === "long-break" && "bg-purple-500"
          )} />
          <div className={cn(
            "absolute bottom-0 left-0 w-32 h-32 blur-[64px] transition-all duration-1000 opacity-20",
            mode === "focus" && "bg-blue-600",
            mode === "break" && "bg-green-600",
            mode === "long-break" && "bg-indigo-600"
          )} />

          {isEditing ? (
            <div className="flex flex-col items-center gap-8">
              <div className="flex items-center gap-4 text-primary font-sans">
                {/* Hours */}
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("h", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                  <input
                    type="text"
                    value={editHours}
                    placeholder="00"
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setEditHours(val);
                    }}
                    className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 focus:border-primary/40 transition-all font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("h", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                </div>
                <span className="text-6xl md:text-8xl font-bold mb-8 opacity-20">:</span>
                {/* Minutes */}
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("m", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                  <input
                    type="text"
                    autoFocus
                    value={editMins}
                    placeholder="00"
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setEditMins(val);
                    }}
                    className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 focus:border-primary/40 transition-all font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("m", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                </div>
                <span className="text-6xl md:text-8xl font-bold mb-8 opacity-20">:</span>
                {/* Seconds */}
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("s", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                  <input
                    type="text"
                    value={editSecs}
                    placeholder="00"
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setEditSecs(val);
                    }}
                    className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 focus:border-primary/40 transition-all font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => adjustValue("s", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleEditSubmit} className="rounded-full px-8 py-6 h-auto text-lg font-bold">
                  <Check className="mr-2" /> Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-full px-8 py-6 h-auto text-lg font-bold">
                  <X className="mr-2" /> Cancel
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

              <div className="flex items-center gap-6 mt-10">
                <Button
                  onClick={isActive ? pause : start}
                  className={cn(
                    "h-16 px-10 rounded-full text-lg font-black uppercase tracking-widest transition-all duration-500 shadow-2xl relative overflow-hidden group/btn",
                    isActive ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-black hover:scale-105"
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
              </div>

              {/* Bottom Status Pill */}
              <div className="mt-16 px-6 py-2 rounded-full bg-primary/5 border border-primary/10">
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary/40">
                  {mode === "focus"
                    ? `${Math.floor(initialFocusTime / 60)} minutes of presence`
                    : `${Math.floor((mode === "break" ? initialBreakTime : initialLongBreakTime) / 60)} minute pause`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>


      {/* Removing Quote Section to restore old design */}
    </div>
  );
}
