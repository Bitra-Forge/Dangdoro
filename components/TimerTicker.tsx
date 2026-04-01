"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { savePomodoroSession } from "@/lib/db";
import { toast } from "sonner";

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
      // Tick every 100ms for responsiveness, though the store only updates seconds
      // Using a faster interval helps catch up with background throttling more quickly
      timer = setInterval(() => {
        tick();
      }, 200);
    }

    // Handle completion
    if (timeLeft === 0 && isActive) {
      if (mode === "focus" && user) {
        savePomodoroSession(user.uid, Math.floor(initialFocusTime / 60))
          .then(() => toast.success("Session saved! Keep it up!"))
          .catch(() => toast.error("Failed to save session."));
      }
      
      // Play sound notification
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.volume = 0.4;
      audio.play().catch(err => console.log("Audio blocked:", err));
      
      reset();
    }

    return () => clearInterval(timer);
  }, [isActive, tick, timeLeft, mode, user, initialFocusTime, reset]);

  return null; // This component doesn't render anything
}
