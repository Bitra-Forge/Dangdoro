"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { flushFocusTime } from "@/lib/focus-accumulator";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";

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
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const sessionStartTime = useTimerStore((s) => s.sessionStartTime);

  const { user } = useAuth();

  // Timer tick effect
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [isActive, tick]);

  // Browser tab title effect
  const displaySeconds = Math.floor(timeLeft);
  useEffect(() => {
    document.title = isActive
      ? `${formatTime(displaySeconds)} - ${MODE_LABELS[mode]} | Dangdoro`
      : "Dangdoro";
  }, [displaySeconds, isActive, mode]);


  // Tab visibility change listener to flush pending focus time
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushFocusTime(user.uid, activeGroupId, false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, activeGroupId]);

  // Timer completion effect
  useEffect(() => {
    if (timeLeft !== 0 || !isActive) return;

    if (typeof window === "undefined") return;

    // Save focus session for authenticated users (both solo and group)
    if (mode === "focus" && user) {
      const durationMinutes = Math.floor(initialFocusTime / 60);
      flushFocusTime(user.uid, activeGroupId, true, durationMinutes, sessionStartTime)
        .then(() => toast.success(activeGroupId ? `Group focus session completed! Contribution recorded.` : `Session saved! Keep it up!`))
        .catch(() => toast.error("Failed to save session."));
    }

    // Play completion sound
    const audioUrl = `/SessionEndSounds/${sessionEndSound || "universfield-new-notification-027-383749.mp3"}`;
    const audio = new Audio(audioUrl);
    audio.volume = COMPLETION_AUDIO_VOLUME;
    audio.play().catch((err) => console.log("Audio blocked:", err));

    // Move to the next pomodoro phase (advanceSession handles auto-start logic for both solo and group)
    advanceSession();

    // If advanceSession didn't auto-start the next phase (user needs to manually resume), clear group context
    // This is handled by checking if timer is still active after advanceSession
    // The GroupSessionSync will handle ending the live session when timer becomes inactive
  }, [timeLeft, isActive, mode, user, initialFocusTime, sessionEndSound, advanceSession, activeGroupId, sessionStartTime]);

  return null;
}
