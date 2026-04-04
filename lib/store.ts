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

  // Active task from task page
  activeTaskId: string | null;
  activeTaskLabel: string | null;
  activeTaskNotes: string | null;
  activeTaskPriority: string | null; // using string to avoid circular dependency
  loadTask: (id: string, label: string, durationSeconds: number, priority: string, notes: string) => void;
  clearTask: () => void;

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
  backgroundImage: string;
  setBackgroundImage: (image: string) => void;
  isBgPanelOpen: boolean;
  setIsBgPanelOpen: (open: boolean) => void;
  isSoundPanelOpen: boolean;
  setIsSoundPanelOpen: (open: boolean) => void;
  isNavFocusMode: boolean;
  setIsNavFocusMode: (enabled: boolean) => void;
  toggleNavFocusMode: () => void;
  activeSounds: Record<string, number>;
  toggleSound: (soundId: string) => void;
  setSoundVolume: (soundId: string, volume: number) => void;
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

      backgroundImage: "BG25.png", // Default background

      activeTaskId: null,
      activeTaskLabel: null,
      activeTaskNotes: null,
      activeTaskPriority: null,

      loadTask: (id, label, durationSeconds, priority, notes) => {
        set({
          mode: "focus",
          timeLeft: durationSeconds,
          focusTimeLeft: durationSeconds,
          initialFocusTime: durationSeconds,
          isActive: false,
          lastUpdate: null,
          activeTaskId: id,
          activeTaskLabel: label,
          activeTaskNotes: notes,
          activeTaskPriority: priority,
        });
      },
      clearTask: () => set({ activeTaskId: null, activeTaskLabel: null, activeTaskNotes: null, activeTaskPriority: null }),

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
        const { mode, timeLeft, isActive, initialFocusTime, initialBreakTime, initialLongBreakTime } = get();
        const newTime = Math.max(0, timeLeft + seconds);

        const updates: any = {
          timeLeft: newTime,
          ...(mode === "focus" ? { focusTimeLeft: newTime } :
            mode === "break" ? { breakTimeLeft: newTime } :
              { longBreakTimeLeft: newTime })
        };

        // If the timer is not active, we are setting a new session duration, so update initial.
        // If the timer is active and we are adding time, increase the initial total to maintain progress.
        if (!isActive) {
          if (mode === "focus") updates.initialFocusTime = newTime;
          else if (mode === "break") updates.initialBreakTime = newTime;
          else if (mode === "long-break") updates.initialLongBreakTime = newTime;
        } else if (seconds > 0) {
          if (mode === "focus") updates.initialFocusTime = initialFocusTime + seconds;
          else if (mode === "break") updates.initialBreakTime = initialBreakTime + seconds;
          else if (mode === "long-break") updates.initialLongBreakTime = initialLongBreakTime + seconds;
        }

        set(updates);
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
      setBackgroundImage: (image: string) => set({ backgroundImage: image }),
      isBgPanelOpen: false,
      setIsBgPanelOpen: (open: boolean) => set({ isBgPanelOpen: open, isSoundPanelOpen: open ? false : get().isSoundPanelOpen }),
      isSoundPanelOpen: false,
      setIsSoundPanelOpen: (open: boolean) => set({ isSoundPanelOpen: open, isBgPanelOpen: open ? false : get().isBgPanelOpen }),
      isNavFocusMode: false,
      setIsNavFocusMode: (enabled: boolean) => set({ isNavFocusMode: enabled }),
      toggleNavFocusMode: () => set((state) => ({ isNavFocusMode: !state.isNavFocusMode })),
      activeSounds: {},
      toggleSound: (soundId: string) => {
        const { activeSounds } = get();
        const newSounds = { ...activeSounds };
        if (newSounds[soundId] !== undefined) {
          delete newSounds[soundId];
        } else {
          newSounds[soundId] = 50; // Default volume for new active sound
        }
        set({ activeSounds: newSounds });
      },
      setSoundVolume: (soundId: string, volume: number) => {
        const { activeSounds } = get();
        if (activeSounds[soundId] !== undefined) {
          set({ activeSounds: { ...activeSounds, [soundId]: volume } });
        }
      },
    }),





    {
      name: "dangdoro-timer-storage",
    }
  )
);
