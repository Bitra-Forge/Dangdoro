import { create } from "zustand";

interface TimerState {
  timeLeft: number; // in seconds
  isActive: boolean;
  mode: "focus" | "break" | "long-break";
  initialFocusTime: number;
  initialBreakTime: number;
  initialLongBreakTime: number;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setMode: (mode: "focus" | "break" | "long-break") => void;
  setTime: (seconds: number) => void;
  setInitialTime: (mode: "focus" | "break" | "long-break", seconds: number) => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  timeLeft: 25 * 60,
  isActive: false,
  mode: "focus",
  initialFocusTime: 25 * 60,
  initialBreakTime: 5 * 60,
  initialLongBreakTime: 15 * 60,

  start: () => set({ isActive: true }),
  pause: () => set({ isActive: false }),
  reset: () => {
    const { mode, initialFocusTime, initialBreakTime, initialLongBreakTime } = get();
    set({
      isActive: false,
      timeLeft: mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime,
    });
  },
  tick: () => {
    const { timeLeft, isActive } = get();
    if (!isActive) return;

    if (timeLeft > 0) {
      set({ timeLeft: timeLeft - 1 });
    } else {
      set({ isActive: false });
    }
  },
  setMode: (mode) => {
    const { initialFocusTime, initialBreakTime, initialLongBreakTime } = get();
    set({
      mode,
      isActive: false,
      timeLeft: mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime,
    });
  },
  setTime: (seconds) => set({ timeLeft: seconds }),
  setInitialTime: (mode, seconds) => {
    if (mode === "focus") set({ initialFocusTime: seconds });
    else if (mode === "break") set({ initialBreakTime: seconds });
    else if (mode === "long-break") set({ initialLongBreakTime: seconds });

    if (get().mode === mode) {
      set({ timeLeft: seconds, isActive: false });
    }
  }
}));
