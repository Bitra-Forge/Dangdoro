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

  isTransparent: boolean;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setMode: (mode: "focus" | "break" | "long-break") => void;
  setTime: (seconds: number) => void;
  setInitialTime: (mode: "focus" | "break" | "long-break", seconds: number) => void;
  setTransparent: (val: boolean) => void;
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
      isTransparent: false,

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
      setInitialTime: (mode, seconds) => {
        if (mode === "focus") set({ initialFocusTime: seconds });
        else if (mode === "break") set({ initialBreakTime: seconds });
        else if (mode === "long-break") set({ initialLongBreakTime: seconds });

        if (get().mode === mode) {
          set({ timeLeft: seconds, isActive: false, lastUpdate: null });
        }
      },
      setTransparent: (val) => set({ isTransparent: val })
    }),
    {
      name: "dangdoro-timer-storage",
    }
  )
);
