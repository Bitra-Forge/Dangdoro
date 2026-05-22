"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Play, Pause, RotateCcw, Check, X, ChevronUp, ChevronDown, Settings, Minus, Plus, Eye, EyeOff, Square, Volume2, Palette, ChevronRight, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBackgroundTheme } from "@/lib/use-background-theme";

export function TimerCard() {
  const BACKGROUND_COLORS = [
    { name: "Sage", value: "#757c4f" },
    { name: "Rose", value: "#9e5252" },
    { name: "Midnight", value: "#8b4b23" },
    { name: "Linen", value: "#572373" }, 
    { name: "Sky", value: "#4d7a92" },
    { name: "Slate", value: "#646baa" },
    { name: "Midnight", value: "#050403" },
  ] as const;

  const timeLeft = useTimerStore((s) => s.timeLeft);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const mode = useTimerStore((s) => s.mode);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const stop = useTimerStore((s) => s.stop);
  const reset = useTimerStore((s) => s.reset);
  const setMode = useTimerStore((s) => s.setMode);
  const setInitialTime = useTimerStore((s) => s.setInitialTime);
  const incrementTime = useTimerStore((s) => s.incrementTime);
  const activeTaskLabel = useTimerStore((s) => s.activeTaskLabel);
  const isNavFocusMode = useTimerStore((s) => s.isNavFocusMode);
  const setIsNavFocusMode = useTimerStore((s) => s.setIsNavFocusMode);
  const toggleNavFocusMode = useTimerStore((s) => s.toggleNavFocusMode);
  const setSessionEndSound = useTimerStore((s) => s.setSessionEndSound);
  const sessionEndSound = useTimerStore((s) => s.sessionEndSound);
  const backgroundSolidColor = useTimerStore((s) => s.backgroundSolidColor);
  const noneBackgroundMode = useTimerStore((s) => s.noneBackgroundMode);
  const setBackgroundSolidColor = useTimerStore((s) => s.setBackgroundSolidColor);
  const setNoneBackgroundMode = useTimerStore((s) => s.setNoneBackgroundMode);

  const { user } = useAuth();

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
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTimerHovered, setIsTimerHovered] = useState(false);
  const [showHoverControls, setShowHoverControls] = useState(false);
  const { showDots, updateShowDots } = useBackgroundTheme(true);

  const SESSION_SOUNDS = [
    { id: "universfield-new-notification-027-383749.mp3", label: "Minimal Tech" },
    { id: "universfield-soft-piano-logo-141290.mp3", label: "Zen Piano" },
    { id: "koiroylers-cutie-cat-355747.mp3", label: "Cyber Cat" }
  ];

  const handlePreviewSound = (soundId: string) => {
    if (playingSoundId === soundId) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingSoundId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio(`/SessionEndSounds/${soundId}`);
    audio.volume = 0.5;
    audioRef.current = audio;
    setPlayingSoundId(soundId);
    audio.play();
    audio.onended = () => { setPlayingSoundId(null); audioRef.current = null; };
  };

  const handleSelectSound = async (soundId: string) => {
    setSessionEndSound(soundId);
    if (user) {
      const { updateUserSettings } = await import("@/lib/db");
      await updateUserSettings(user.uid, { sessionEndSound: soundId });
    }
  };

  const handleSetAdjustment = async (value: number) => {
    setAdjustmentAmount(value);
    if (user) {
      const { updateUserSettings } = await import("@/lib/db");
      await updateUserSettings(user.uid, { adjustmentAmount: value });
    }
  };

  const clearHideControlsTimeout = () => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  };

  const handleTimerMouseEnter = () => {
    setIsTimerHovered(true);
    clearHideControlsTimeout();
    if (isActive) {
      setShowHoverControls(true);
    }
  };

  const handleTimerMouseLeave = () => {
    setIsTimerHovered(false);
    clearHideControlsTimeout();

    if (!isActive) {
      setShowHoverControls(false);
      return;
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowHoverControls(false);
      hideControlsTimeoutRef.current = null;
    }, 2000);
  };

  const handleStop = async () => {
    const { activeGroupId, mode, initialFocusTime, timeLeft } = useTimerStore.getState();
    stop();
    const elapsedSeconds = mode === "focus" ? Math.max(0, initialFocusTime - timeLeft) : 0;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (mode === "focus" && elapsedMinutes >= 1) {
      let currentUser = user;
      if (!currentUser) {
        const { signInGuest } = await import("@/lib/auth");
        currentUser = await signInGuest();
      }

      if (currentUser) {
        const { savePartialPomodoroSession } = await import("@/lib/db");
        await savePartialPomodoroSession(currentUser.uid, elapsedMinutes, activeGroupId);
      }
    }

    if (activeGroupId) useTimerStore.getState().setActiveGroupId(null);
    reset();
  };

  // Hydration guard: only render on client after storage is loaded
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) return;

    let unsub: () => void;
    try {
      unsub = onSnapshot(
        doc(db, "users", user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.settings) {
              const { focusTime, breakTime, longBreakTime, longBreakEvery, adjustmentAmount: adj } = data.settings;
              
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
                if (longBreakEvery) useTimerStore.getState().setLongBreakEvery(longBreakEvery);
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
  }, [activeTaskLabel, setInitialTime, setSessionEndSound, user?.uid]);

  useEffect(() => {
    if (!isActive) {
      clearHideControlsTimeout();
      setShowHoverControls(false);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      clearHideControlsTimeout();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (typeof document === "undefined") {
        return;
      }

      // Keep focus mode state aligned when user exits fullscreen with Esc.
      if (!document.fullscreenElement && isNavFocusMode) {
        setIsNavFocusMode(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isNavFocusMode, setIsNavFocusMode]);

  const handleFocusToggle = async () => {
    if (typeof document === "undefined") {
      toggleNavFocusMode();
      return;
    }

    try {
      if (isNavFocusMode) {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
        setIsNavFocusMode(false);
      } else {
        await document.documentElement.requestFullscreen();
        setIsNavFocusMode(true);
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen focus mode:", error);
      // Fall back to focus mode toggle if fullscreen is blocked by browser policy.
      toggleNavFocusMode();
    }
  };

  const shouldRevealHoverControls = isTimerHovered || showHoverControls;

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
    const nextSeconds = totalSeconds <= 0
      ? (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime)
      : totalSeconds;

    setInitialTime(mode, nextSeconds);
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

  const focusToggle = (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleFocusToggle}
        title={isNavFocusMode ? "Disable Focus Mode (show nav)" : "Enable Focus Mode (hide nav)"}
        className="h-14 w-14 rounded-2xl transition-all duration-300 shrink-0 cursor-pointer text-white border border-white/25 bg-white/10 hover:bg-white/20 backdrop-blur-md"
      >
        {isNavFocusMode ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
      </Button>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "group/timer flex flex-col items-center justify-center space-y-8 animate-in fade-in transition-all duration-1000 relative",
          isSettingsOpen ? "z-50" : "z-10"
        )}
      >
      {/* Backdrop to close settings (Lowest layer) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-0 h-screen w-screen"
          onClick={() => setIsSettingsOpen(false)}
        />
      )}

      <div
        onMouseEnter={handleTimerMouseEnter}
        onMouseLeave={handleTimerMouseLeave}
        className="flex flex-col items-center justify-center space-y-8"
      >

      {/* Mode Switcher */}
      <div className={cn(
        "-mt-20 flex items-center gap-2 relative z-10 w-fit p-1.5 rounded-2xl border border-white/20 bg-black/25 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-700",
        isActive && !isEditing ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        {([
          { id: "focus", label: "pomodoro" },
          { id: "break", label: "short break" },
          { id: "long-break", label: "long break" }
        ] as const).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as "focus" | "break" | "long-break")}
            className={cn(
              "min-w-[120px] md:min-w-[145px] px-5 py-3 text-[13px] font-black tracking-[0.02em] text-center transition-all duration-300 rounded-xl cursor-pointer border",
              mode === m.id
                ? m.id === "focus"
                  ? "bg-sky-300/20 text-sky-50 border-sky-200/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_rgba(125,211,252,0.14)]"
                  : m.id === "break"
                    ? "bg-emerald-300/20 text-emerald-50 border-emerald-200/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_rgba(110,231,183,0.14)]"
                    : "bg-fuchsia-300/20 text-fuchsia-50 border-fuchsia-200/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_rgba(240,171,252,0.14)]"
                : "bg-black/20 text-white/75 border-white/10 hover:bg-white/[0.14] hover:text-white hover:border-white/30"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Timer Display */}
      <div className="relative group perspective-1000 z-20">
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
                    className={cn(
                      "w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-all duration-200 transform text-white bg-transparent hover:bg-white/15 hover:border-white/40 hover:scale-105 active:scale-95 active:bg-white/25",
                      shouldRevealHoverControls ? "opacity-100" : "opacity-0"
                    )}
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
                    className={cn(
                      "w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-all duration-200 transform text-white bg-transparent hover:bg-white/15 hover:border-white/40 hover:scale-105 active:scale-95 active:bg-white/25",
                      shouldRevealHoverControls ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>


              {/* Progress Bar Section */}
              <div className="flex items-center gap-4 w-[320px] mt-2 mb-2 group/progress">
                <div className="flex-1 h-[3px] bg-white/5 rounded-full relative transition-all duration-1000">
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full transition-all duration-1000 ease-linear rounded-full",
                      !isActive && !shouldRevealHoverControls && "opacity-0",
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
                  !isActive && !shouldRevealHoverControls && "opacity-0"
                )}>
                  {Math.round(Math.min(100, Math.max(0, (1 - (timeLeft / (mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime))) * 100)))}%
                </span>
              </div>

              <div className={cn(
                "flex items-center justify-center gap-6 mt-10 transition-all duration-500 relative z-10",
                isActive && !shouldRevealHoverControls && "opacity-0"
              )}>
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
                      "h-14 min-w-[132px] rounded-[20px] px-7 font-bold transition-all duration-300 active:scale-95 cursor-pointer",
                      isActive
                        ? "bg-white/10 text-white border border-white/25 hover:bg-white/20"
                        : "bg-white/90 text-black border border-white/90 hover:bg-white"
                    )}
                    style={{ fontSize: "17px", fontFamily: "'Space Grotesk', sans-serif" }}
                    title={isActive ? "Pause" : isPaused ? "Resume" : "Start"}
                  >
                    {isActive ? "Pause" : isPaused ? "Resume" : "Start"}
                  </Button>

                  {isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStop}
                      className="h-14 w-14 rounded-2xl transition-all duration-300 text-red-500 border border-white/25 bg-white/10 hover:bg-white/20 active:scale-95 cursor-pointer flex items-center justify-center"
                      title="Stop"
                    >
                      <Square className="w-6 h-6 fill-current" />
                    </Button>
                  )}
                </div>

                {/* Right: Reset and Settings icons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={reset}
                    title="Reset timer"
                    className="h-14 w-14 rounded-2xl text-white border border-white/25 bg-white/10 hover:bg-white/20 transition-all duration-300 shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </Button>

                  <div className="relative flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                      title="Toggle settings"
                      className="h-14 w-14 rounded-2xl transition-all duration-300 cursor-pointer text-white border border-white/25 bg-white/10 hover:bg-white/20"
                    >
                      <Settings className={cn(
                        "w-6 h-6 transition-transform duration-300",
                        isSettingsOpen && "rotate-90"
                      )} />
                    </Button>

                    {/* Settings popup - appears upper-right with connector */}
                    {isSettingsOpen && (
                      <div className="absolute left-full ml-32 bottom-0 z-20 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="w-[280px] bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

                          {/* Step Size */}
                          <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2 mb-3">
                              <Minus className="w-3 h-3 text-white/30" />
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Step Size</span>
                              <Plus className="w-3 h-3 text-white/30" />
                            </div>
                            <div className="flex items-center gap-2">
                              {[1, 2, 5, 10].map((val) => (
                                <button
                                  key={val}
                                  onClick={() => handleSetAdjustment(val)}
                                  className={cn(
                                    "flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer",
                                    adjustmentAmount === val
                                      ? "bg-white text-black"
                                      : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white"
                                  )}
                                >
                                  {val}m
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* None Background Color */}
                          <div className="px-5 pt-4 pb-4 border-b border-white/[0.06]">
                            <button
                              onClick={() => updateShowDots(!showDots)}
                              className="w-full flex items-center justify-between py-1.5 transition-colors duration-200 cursor-pointer"
                            >
                              <span className="inline-flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                <Grid3X3 className="w-3 h-3 text-white/30" />
                                Dot Grid
                              </span>
                              <div className={cn(
                                "w-8 h-4 rounded-full transition-all relative",
                                showDots ? "bg-emerald-500" : "bg-zinc-700"
                              )}>
                                <div className={cn(
                                  "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                                  showDots ? "left-4" : "left-0.5"
                                )} />
                              </div>
                            </button>

                          </div>

                          {/* None Background Color */}
                          <div className="px-5 pt-4 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Palette className="w-3 h-3 text-white/30" />
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Background Colors</span>
                              </div>
                              <Link
                                href="/settings#background-theme"
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white/80 transition-all duration-200 hover:translate-x-0.5"
                              >
                                <span>More</span>
                                <ChevronRight className="h-3 w-3" />
                              </Link>
                            </div>
                            <div className="flex items-center gap-2">
                              {BACKGROUND_COLORS.map((color) => {
                                const isActiveColor = noneBackgroundMode === "solid" && backgroundSolidColor.toLowerCase() === color.value;
                                return (
                                  <button
                                    key={color.value}
                                    onClick={() => {
                                      setBackgroundSolidColor(color.value);
                                      setNoneBackgroundMode("solid");
                                    }}
                                    title={color.name}
                                    className={cn(
                                      "w-7 h-7 rounded-full border transition-all duration-200 flex items-center justify-center cursor-pointer",
                                      isActiveColor
                                        ? "border-white scale-110"
                                        : "border-white/15 hover:border-white/40"
                                    )}
                                    style={{ backgroundColor: color.value }}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* Session End Sound */}
                          <div className="px-5 pt-4 pb-5">
                            <div className="flex items-center gap-2 mb-3">
                              <Volume2 className="w-3 h-3 text-white/30" />
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Session Sound</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {SESSION_SOUNDS.map((sound) => (
                                <div key={sound.id} className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleSelectSound(sound.id)}
                                    className={cn(
                                      "flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer text-left",
                                      sessionEndSound === sound.id
                                        ? "bg-white/10 text-white border border-white/20"
                                        : "text-white/40 hover:bg-white/5 hover:text-white/70"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                                      sessionEndSound === sound.id ? "bg-white" : "bg-white/20"
                                    )} />
                                    {sound.label}
                                  </button>
                                  <button
                                    onClick={() => handlePreviewSound(sound.id)}
                                    className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0",
                                      playingSoundId === sound.id
                                        ? "bg-white text-black"
                                        : "text-white/30 hover:bg-white/5 hover:text-white/60"
                                    )}
                                  >
                                    {playingSoundId === sound.id
                                      ? <Pause className="w-3 h-3 fill-current" />
                                      : <Play className="w-3 h-3 fill-current ml-0.5" />
                                    }
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </>
          )}
        </div>
      </div>
      </div>

      </div>

      {typeof document !== "undefined" ? createPortal(focusToggle, document.body) : null}
    </>
  );
}
