"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { savePomodoroSession } from "@/lib/db";
import { toast } from "sonner";

// ============================================================================
// Constants
// ============================================================================

const MODE_LABELS: Record<string, string> = {
  focus: "Focus",
  break: "Break",
  "long-break": "Long Break",
};

const COMPLETION_AUDIO_VOLUME = 0.4;

// ============================================================================
// Utilities
// ============================================================================

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
};

// ============================================================================
// Component
// ============================================================================

/**
 * TimerTicker - Global timer component that runs in the layout.
 * 
 * Responsibilities:
 * 1. Tick the timer every 200ms when active
 * 2. Update browser tab title with current time
 * 3. Handle timer completion (save session, play sound, reset)
 * 
 * This component renders nothing - it only manages side effects.
 */
export function TimerTicker() {
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const isActive = useTimerStore((s) => s.isActive);
  const mode = useTimerStore((s) => s.mode);
  const tick = useTimerStore((s) => s.tick);
  const advanceSession = useTimerStore((s) => s.advanceSession);
  const initialFocusTime = useTimerStore((s) => s.initialFocusTime);
  const sessionEndSound = useTimerStore((s) => s.sessionEndSound);
  const settingsAutoStartBreak = useTimerStore((s) => s.settingsAutoStartBreak);
  const settingsAutoStartFocus = useTimerStore((s) => s.settingsAutoStartFocus);

  const activeGroupId = useTimerStore((s) => s.activeGroupId);

  const { user } = useAuth();

  // Timer tick effect
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [isActive, tick]);

  // Browser tab title effect
  useEffect(() => {
    document.title = isActive
      ? `${formatTime(timeLeft)} - ${MODE_LABELS[mode]} | Dangdoro`
      : "Dangdoro";
  }, [timeLeft, isActive, mode]);

  // Timer completion effect
  useEffect(() => {
    if (timeLeft !== 0 || !isActive) return;

    if (typeof window === "undefined") return;

    // Save focus session for authenticated users
    if (mode === "focus" && user) {
      const durationMinutes = Math.floor(initialFocusTime / 60);
      savePomodoroSession(user.uid, durationMinutes, activeGroupId)
        .then(() => toast.success(`Session saved! ${activeGroupId ? "Group contribution recorded." : "Keep it up!"}`))
        .catch(() => toast.error("Failed to save session."));
    }

    // Play completion sound
    const audioUrl = `/SessionEndSounds/${sessionEndSound}`;
    const audio = new Audio(audioUrl);
    audio.volume = COMPLETION_AUDIO_VOLUME;
    audio.play().catch((err) => console.log("Audio blocked:", err));

    // Move to the next pomodoro phase
    advanceSession();
  }, [timeLeft, isActive, mode, user, initialFocusTime, sessionEndSound, advanceSession, settingsAutoStartBreak, settingsAutoStartFocus]);

  return null;
}
