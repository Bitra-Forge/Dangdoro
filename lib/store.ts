import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TimerState {
  timeLeft: number; // in seconds
  isActive: boolean;
  mode: "focus" | "break" | "long-break";
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
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timeLeft: 25 * 60,
      isActive: false,
      mode: "focus",
      initialFocusTime: 25 * 60,
      initialBreakTime: 5 * 60,
      initialLongBreakTime: 15 * 60,
      lastUpdate: null,

      start: () => set({ isActive: true, lastUpdate: Date.now() }),
      pause: () => set({ isActive: false, lastUpdate: null }),
      reset: () => {
        const { mode, initialFocusTime, initialBreakTime, initialLongBreakTime } = get();
        set({
          isActive: false,
          lastUpdate: null,
          timeLeft: mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime,
        });
      },
      tick: () => {
        const { timeLeft, isActive, lastUpdate } = get();
        if (!isActive || !lastUpdate) return;

        const now = Date.now();
        const drift = now - lastUpdate;

        // Only update if at least 1 second has passed
        if (drift >= 1000) {
          const secondsToSubtract = Math.floor(drift / 1000);
          set({
            timeLeft: Math.max(0, timeLeft - secondsToSubtract),
            lastUpdate: lastUpdate + (secondsToSubtract * 1000) // Keep the fractional drift
          });
        }
      },
      setMode: (mode) => {
        const { initialFocusTime, initialBreakTime, initialLongBreakTime } = get();
        set({
          mode,
          lastUpdate: null, // Reset tracking on mode change
          timeLeft: mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime,
          isActive: false // Stop on mode change
        });
      },
      setTime: (seconds) => set({ timeLeft: seconds }),
      incrementTime: (seconds) => set((state) => ({ timeLeft: Math.max(0, state.timeLeft + seconds) })),
      setInitialTime: (mode, seconds) => {
        const { initialFocusTime, initialBreakTime, initialLongBreakTime, mode: currentMode, isActive } = get();

        // Update the initial time for the specified mode
        if (mode === "focus") {
          if (initialFocusTime === seconds) return; // No change
          set({ initialFocusTime: seconds });
        } else if (mode === "break") {
          if (initialBreakTime === seconds) return; // No change
          set({ initialBreakTime: seconds });
        } else if (mode === "long-break") {
          if (initialLongBreakTime === seconds) return; // No change
          set({ initialLongBreakTime: seconds });
        }

        // Only update current timeLeft if we are in that mode AND the timer is NOT running
        // This prevents the timer from resetting when navigating back to the home page
        if (currentMode === mode && !isActive) {
          set({ timeLeft: seconds, lastUpdate: null });
        }
      },
    }),
    {
      name: "dangdoro-timer-storage",
    }
  )
);
