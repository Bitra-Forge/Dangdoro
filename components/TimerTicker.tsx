"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { savePomodoroSession } from "@/lib/db";
import { toast } from "sonner";

const modeLabels = {
  focus: "Focus",
  break: "Break",
  "long-break": "Long Break"
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

export function TimerTicker() {
  const {
    timeLeft,
    isActive,
    mode,
    tick,
    reset,
    initialFocusTime
  } = useTimerStore();

  const { user } = useAuth();

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isActive) {
      timer = setInterval(() => {
        tick();
      }, 200);
    }

    return () => clearInterval(timer);
  }, [isActive, tick]);

  // Update browser tab title with timer (runs globally across all pages)
  useEffect(() => {
    if (isActive) {
      document.title = `${formatTime(timeLeft)} - ${modeLabels[mode]} | Dangdoro`;
    } else {
      document.title = "Dangdoro";
    }
  }, [timeLeft, isActive, mode]);

  // Separate effect for completion logic
  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      if (mode === "focus" && user) {
        savePomodoroSession(user.uid, Math.floor(initialFocusTime / 60))
          .then(() => toast.success("Session saved! Keep it up!"))
          .catch(() => toast.error("Failed to save session."));
      }

      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.volume = 0.4;
      audio.play().catch(err => console.log("Audio blocked:", err));

      reset();
    }
  }, [timeLeft, isActive, mode, user, initialFocusTime, reset]);

  return null; // This component doesn't render anything
}
