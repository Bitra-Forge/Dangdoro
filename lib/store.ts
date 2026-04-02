import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TimerState {
  timeLeft: number; // Current mode's tracking time
  isActive: boolean;
  mode: "focus" | "break" | "long-break";

  // Per-mode progress persistence
  focusTimeLeft: number;
  breakTimeLeft: number;
  longBreakTimeLeft: number;

  // Initial settings
  initialFocusTime: number;
  initialBreakTime: number;
  initialLongBreakTime: number;

  lastUpdate: number | null;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setMode: (mode: "focus" | "break" | "long-break") => void;
  setTime: (seconds: number) => void;
  incrementTime: (seconds: number) => void;
  setInitialTime: (mode: "focus" | "break" | "long-break", seconds: number) => void;
  resetToDefaults: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timeLeft: 25 * 60,
      isActive: false,
      mode: "focus",

      focusTimeLeft: 25 * 60,
      breakTimeLeft: 5 * 60,
      longBreakTimeLeft: 15 * 60,

      initialFocusTime: 25 * 60,
      initialBreakTime: 5 * 60,
      initialLongBreakTime: 15 * 60,
      lastUpdate: null,

      start: () => set({ isActive: true, lastUpdate: Date.now() }),
      pause: () => set({ isActive: false, lastUpdate: null }),
      reset: () => {
        const { mode, initialFocusTime, initialBreakTime, initialLongBreakTime } = get();
        const initial = mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime;

        set({
          isActive: false,
          lastUpdate: null,
          timeLeft: initial,
          // Sync the per-mode progress on reset too
          ...(mode === "focus" ? { focusTimeLeft: initial } :
            mode === "break" ? { breakTimeLeft: initial } :
              { longBreakTimeLeft: initial })
        });
      },
      tick: () => {
        const { timeLeft, isActive, lastUpdate, mode } = get();
        if (!isActive || !lastUpdate) return;

        const now = Date.now();
        const drift = now - lastUpdate;

        if (drift >= 1000) {
          const secondsToSubtract = Math.floor(drift / 1000);
          const newTime = Math.max(0, timeLeft - secondsToSubtract);

          set({
            timeLeft: newTime,
            lastUpdate: lastUpdate + (secondsToSubtract * 1000),
            // Update the underlying mode-specific time
            ...(mode === "focus" ? { focusTimeLeft: newTime } :
              mode === "break" ? { breakTimeLeft: newTime } :
                { longBreakTimeLeft: newTime })
          });
        }
      },
      setMode: (newMode) => {
        const { mode: oldMode, timeLeft, focusTimeLeft, breakTimeLeft, longBreakTimeLeft } = get();

        // Save current progress to old mode
        const updates: any = {};
        if (oldMode === "focus") updates.focusTimeLeft = timeLeft;
        if (oldMode === "break") updates.breakTimeLeft = timeLeft;
        if (oldMode === "long-break") updates.longBreakTimeLeft = timeLeft;

        // Load progress for new mode
        let nextTimeLeft = updates.focusTimeLeft || focusTimeLeft; // Fallback if just updated
        if (newMode === "focus") nextTimeLeft = (updates.focusTimeLeft !== undefined ? updates.focusTimeLeft : focusTimeLeft);
        if (newMode === "break") nextTimeLeft = (updates.breakTimeLeft !== undefined ? updates.breakTimeLeft : breakTimeLeft);
        if (newMode === "long-break") nextTimeLeft = (updates.longBreakTimeLeft !== undefined ? updates.longBreakTimeLeft : longBreakTimeLeft);

        set({
          ...updates,
          mode: newMode,
          timeLeft: nextTimeLeft,
          lastUpdate: null,
          isActive: false
        });
      },
      setTime: (seconds) => {
        const { mode } = get();
        set({
          timeLeft: seconds,
          ...(mode === "focus" ? { focusTimeLeft: seconds } :
            mode === "break" ? { breakTimeLeft: seconds } :
              { longBreakTimeLeft: seconds })
        });
      },
      incrementTime: (seconds) => {
        const { mode, timeLeft } = get();
        const newTime = Math.max(0, timeLeft + seconds);
        set({
          timeLeft: newTime,
          ...(mode === "focus" ? { focusTimeLeft: newTime } :
            mode === "break" ? { breakTimeLeft: newTime } :
              { longBreakTimeLeft: newTime })
        });
      },
      setInitialTime: (mode, seconds) => {
        const { mode: currentMode, isActive, initialFocusTime, initialBreakTime, initialLongBreakTime, focusTimeLeft, breakTimeLeft, longBreakTimeLeft } = get();

        const updates: any = {};
        if (mode === "focus") {
          updates.initialFocusTime = seconds;
          // Only update current progress if it was at the old initial (reset state)
          if (focusTimeLeft === initialFocusTime) updates.focusTimeLeft = seconds;
        } else if (mode === "break") {
          updates.initialBreakTime = seconds;
          if (breakTimeLeft === initialBreakTime) updates.breakTimeLeft = seconds;
        } else if (mode === "long-break") {
          updates.initialLongBreakTime = seconds;
          if (longBreakTimeLeft === initialLongBreakTime) updates.longBreakTimeLeft = seconds;
        }

        // Sync main timeLeft if we are currently in this mode and not active
        if (currentMode === mode && !isActive) {
          updates.timeLeft = seconds;
          updates.lastUpdate = null;
        }

        set(updates);
      },
      resetToDefaults: () => {
        set({
          timeLeft: 25 * 60,
          isActive: false,
          mode: "focus",

          focusTimeLeft: 25 * 60,
          breakTimeLeft: 5 * 60,
          longBreakTimeLeft: 15 * 60,

          initialFocusTime: 25 * 60,
          initialBreakTime: 5 * 60,
          initialLongBreakTime: 15 * 60,
          lastUpdate: null,
        });
      },
    }),

    {
      name: "dangdoro-timer-storage",
    }
  )
);
