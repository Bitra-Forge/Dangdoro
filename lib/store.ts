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

  // Baseline settings that we return to on RESET
  settingsFocusTime: number;
  settingsBreakTime: number;
  settingsLongBreakTime: number;
  settingsLongBreakEvery: number;
  settingsAutoStartBreak: boolean;
  settingsAutoStartFocus: boolean;

  // Session-specific initial times (used for progress denominator)
  initialFocusTime: number;
  initialBreakTime: number;
  initialLongBreakTime: number;

  lastUpdate: number | null;
  sessionStartTime: number | null;
  completedFocusSessions: number;

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
  stop: () => void;
  reset: () => void;
  tick: () => void;
  setMode: (mode: "focus" | "break" | "long-break") => void;
  advanceSession: () => void;
  setTime: (seconds: number) => void;
  incrementTime: (seconds: number) => void;
  setInitialTime: (mode: "focus" | "break" | "long-break", seconds: number) => void;
  setLongBreakEvery: (count: number) => void;
  setAutoStartBreak: (enabled: boolean) => void;
  setAutoStartFocus: (enabled: boolean) => void;
  resetToDefaults: () => void;
  backgroundImage: string;
  setBackgroundImage: (image: string) => void;
  sessionEndSound: string;
  setSessionEndSound: (sound: string) => void;
  isBgPanelOpen: boolean;
  setIsBgPanelOpen: (open: boolean) => void;
  isSoundPanelOpen: boolean;
  setIsSoundPanelOpen: (open: boolean) => void;
  isNavFocusMode: boolean;
  setIsNavFocusMode: (enabled: boolean) => void;
  toggleNavFocusMode: () => void;
  activeSounds: Record<string, number>;
  lastActiveSounds: Record<string, number> | null;
  toggleSound: (soundId: string) => void;
  setSoundVolume: (soundId: string, volume: number) => void;
  stopAllSounds: () => void;
  toggleAllSounds: () => void;
}

type TimerUpdate = Partial<Pick<
  TimerState,
  | "timeLeft"
  | "isActive"
  | "mode"
  | "focusTimeLeft"
  | "breakTimeLeft"
  | "longBreakTimeLeft"
  | "settingsFocusTime"
  | "settingsBreakTime"
  | "settingsLongBreakTime"
  | "settingsLongBreakEvery"
  | "settingsAutoStartBreak"
  | "settingsAutoStartFocus"
  | "initialFocusTime"
  | "initialBreakTime"
  | "initialLongBreakTime"
  | "lastUpdate"
  | "sessionStartTime"
  | "completedFocusSessions"
>>;




export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timeLeft: 25 * 60,
      isActive: false,
      mode: "focus",

      focusTimeLeft: 25 * 60,
      breakTimeLeft: 5 * 60,
      longBreakTimeLeft: 15 * 60,

      // Baseline settings (the "original" values to reset to)
      settingsFocusTime: 25 * 60,
      settingsBreakTime: 5 * 60,
      settingsLongBreakTime: 15 * 60,
      settingsLongBreakEvery: 4,
      settingsAutoStartBreak: false,
      settingsAutoStartFocus: false,

      // Session-specific denominator for progress
      initialFocusTime: 25 * 60,
      initialBreakTime: 5 * 60,
      initialLongBreakTime: 15 * 60,
      lastUpdate: null,
      sessionStartTime: null,
      completedFocusSessions: 0,

      backgroundImage: "BG25.png", // Default background
      sessionEndSound: "universfield-new-notification-027-383749.mp3",

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
          completedFocusSessions: 0,
          activeTaskId: id,
          activeTaskLabel: label,
          activeTaskNotes: notes,
          activeTaskPriority: priority,
          sessionStartTime: null,
        });
      },
      clearTask: () => set({ activeTaskId: null, activeTaskLabel: null, activeTaskNotes: null, activeTaskPriority: null }),

      start: () => {
        const { mode, settingsBreakTime } = get();

        set({
          isActive: true,
          lastUpdate: Date.now(),
          sessionStartTime: Date.now(),
          ...(mode === "focus" || mode === "long-break"
            ? { breakTimeLeft: settingsBreakTime, initialBreakTime: settingsBreakTime }
            : {}),
        });
      },
      pause: () => set({ isActive: false, lastUpdate: null }),
      stop: () => {
        const { mode, settingsFocusTime, settingsBreakTime, settingsLongBreakTime } = get();
        const baseline = mode === "focus" ? settingsFocusTime : mode === "break" ? settingsBreakTime : settingsLongBreakTime;

        set({
          isActive: false,
          lastUpdate: null,
          sessionStartTime: null,
          timeLeft: baseline,
          ...(mode === "focus" ? { focusTimeLeft: baseline, initialFocusTime: baseline } :
            mode === "break" ? { breakTimeLeft: baseline, initialBreakTime: baseline } :
              { longBreakTimeLeft: baseline, initialLongBreakTime: baseline }),
        });
      },
      reset: () => {
        const { mode, settingsFocusTime, settingsBreakTime, settingsLongBreakTime } = get();
        const baseline = mode === "focus" ? settingsFocusTime : mode === "break" ? settingsBreakTime : settingsLongBreakTime;

        set({
          isActive: false,
          lastUpdate: null,
          sessionStartTime: null,
          completedFocusSessions: 0,
          timeLeft: baseline,
          // Reset the progress baseline too
          ...(mode === "focus" ? { initialFocusTime: baseline, focusTimeLeft: baseline } :
            mode === "break" ? { initialBreakTime: baseline, breakTimeLeft: baseline } :
              { initialLongBreakTime: baseline, longBreakTimeLeft: baseline })
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
      advanceSession: () => {
        const { mode, completedFocusSessions, settingsFocusTime, settingsBreakTime, settingsLongBreakTime, settingsLongBreakEvery, settingsAutoStartBreak, settingsAutoStartFocus } = get();

        const nextMode =
          mode === "focus"
            ? ((completedFocusSessions + 1) % Math.max(1, settingsLongBreakEvery) === 0 ? "long-break" : "break")
            : "focus";

        const nextTimeLeft =
          nextMode === "focus"
            ? settingsFocusTime
            : nextMode === "break"
              ? settingsBreakTime
              : settingsLongBreakTime;

        const shouldAutoStart = nextMode === "break" || nextMode === "long-break"
          ? settingsAutoStartBreak
          : settingsAutoStartFocus;

        const updates: TimerUpdate = {
          mode: nextMode,
          timeLeft: nextTimeLeft,
          lastUpdate: Date.now(),
          isActive: shouldAutoStart,
          sessionStartTime: shouldAutoStart ? Date.now() : null,
          ...(nextMode === "focus" ? { initialFocusTime: nextTimeLeft, focusTimeLeft: nextTimeLeft } :
            nextMode === "break" ? { initialBreakTime: nextTimeLeft, breakTimeLeft: nextTimeLeft } :
              { initialLongBreakTime: nextTimeLeft, longBreakTimeLeft: nextTimeLeft })
        };

        // Reset the completed phase back to its configured duration so switching back
        // later never lands on 00:00.
        if (mode === "focus") {
          updates.focusTimeLeft = settingsFocusTime;
          updates.initialFocusTime = settingsFocusTime;
        } else if (mode === "break") {
          updates.breakTimeLeft = settingsBreakTime;
          updates.initialBreakTime = settingsBreakTime;
        } else if (mode === "long-break") {
          updates.longBreakTimeLeft = settingsLongBreakTime;
          updates.initialLongBreakTime = settingsLongBreakTime;
        }

        if (mode === "focus") {
          updates.completedFocusSessions = completedFocusSessions + 1;
        } else if (mode === "long-break") {
          updates.completedFocusSessions = 0;
        }

        set(updates);
      },
      setMode: (newMode) => {
        const {
          mode: oldMode,
          timeLeft,
          focusTimeLeft,
          breakTimeLeft,
          longBreakTimeLeft,
          settingsFocusTime,
          settingsBreakTime,
          settingsLongBreakTime,
        } = get();

        const resolveStoredTime = (storedTime: number, baseline: number) =>
          storedTime > 0 ? storedTime : baseline;

        // Save current progress to old mode
        const updates: TimerUpdate = {};
        const currentTimeForOldMode = timeLeft;
        if (oldMode === "focus") {
          updates.focusTimeLeft = currentTimeForOldMode;
          updates.initialFocusTime = currentTimeForOldMode;
        }
        if (oldMode === "break") {
          updates.breakTimeLeft = currentTimeForOldMode;
          updates.initialBreakTime = currentTimeForOldMode;
        }
        if (oldMode === "long-break") {
          updates.longBreakTimeLeft = currentTimeForOldMode;
          updates.initialLongBreakTime = currentTimeForOldMode;
        }

        // Load progress for new mode
        let nextTimeLeft = resolveStoredTime(focusTimeLeft, settingsFocusTime);
        if (newMode === "focus") nextTimeLeft = resolveStoredTime(updates.focusTimeLeft ?? focusTimeLeft, settingsFocusTime);
        if (newMode === "break") nextTimeLeft = resolveStoredTime(updates.breakTimeLeft ?? breakTimeLeft, settingsBreakTime);
        if (newMode === "long-break") nextTimeLeft = resolveStoredTime(updates.longBreakTimeLeft ?? longBreakTimeLeft, settingsLongBreakTime);

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

        const updates: TimerUpdate = {
          timeLeft: newTime,
          ...(mode === "focus" ? { focusTimeLeft: newTime } :
            mode === "break" ? { breakTimeLeft: newTime } :
              { longBreakTimeLeft: newTime })
        };

        // If timer is not active, this is pre-session setup — update initial to match new time.
        // If timer is active, adjust initial by the same delta (both + and -) so the
        // progress ratio (elapsed / total) stays correct regardless of direction.
        if (!isActive) {
          if (mode === "focus") updates.initialFocusTime = newTime;
          else if (mode === "break") updates.initialBreakTime = newTime;
          else if (mode === "long-break") updates.initialLongBreakTime = newTime;
        } else {
          // Clamp so initial never drops below 1 second (avoids divide-by-zero in progress)
          if (mode === "focus") updates.initialFocusTime = Math.max(1, initialFocusTime + seconds);
          else if (mode === "break") updates.initialBreakTime = Math.max(1, initialBreakTime + seconds);
          else if (mode === "long-break") updates.initialLongBreakTime = Math.max(1, initialLongBreakTime + seconds);
        }

        set(updates);
      },
      setInitialTime: (mode, seconds) => {
        const { mode: currentMode, isActive, settingsFocusTime, settingsBreakTime, settingsLongBreakTime } = get();

        const sanitizedSeconds = seconds <= 0
          ? (mode === "focus"
            ? settingsFocusTime
            : mode === "break"
              ? settingsBreakTime
              : settingsLongBreakTime)
          : seconds;

        const updates: TimerUpdate = {};
        if (mode === "focus") {
          updates.settingsFocusTime = sanitizedSeconds;
        } else if (mode === "break") {
          updates.settingsBreakTime = sanitizedSeconds;
        } else if (mode === "long-break") {
          updates.settingsLongBreakTime = sanitizedSeconds;
        }

        // Sync main timeLeft and progress baseline if not active
        if (!isActive) {
          if (mode === "focus") {
            updates.focusTimeLeft = sanitizedSeconds;
            updates.initialFocusTime = sanitizedSeconds;
          } else if (mode === "break") {
            updates.breakTimeLeft = sanitizedSeconds;
            updates.initialBreakTime = sanitizedSeconds;
          } else if (mode === "long-break") {
            updates.longBreakTimeLeft = sanitizedSeconds;
            updates.initialLongBreakTime = sanitizedSeconds;
          }

          if (currentMode === mode) {
            updates.timeLeft = sanitizedSeconds;
            updates.lastUpdate = null;
          }
        }

        set(updates);
      },
      setLongBreakEvery: (count) => set({ settingsLongBreakEvery: Math.max(1, Math.floor(count || 1)) }),
      setAutoStartBreak: (enabled: boolean) => set({ settingsAutoStartBreak: enabled }),
      setAutoStartFocus: (enabled: boolean) => set({ settingsAutoStartFocus: enabled }),
      resetToDefaults: () => {
        set({
          timeLeft: 25 * 60,
          isActive: false,
          mode: "focus",

          focusTimeLeft: 25 * 60,
          breakTimeLeft: 5 * 60,
          longBreakTimeLeft: 15 * 60,

          settingsFocusTime: 25 * 60,
          settingsBreakTime: 5 * 60,
          settingsLongBreakTime: 15 * 60,
          settingsLongBreakEvery: 4,
          settingsAutoStartBreak: false,
          settingsAutoStartFocus: false,

          initialFocusTime: 25 * 60,
          initialBreakTime: 5 * 60,
          initialLongBreakTime: 15 * 60,
          lastUpdate: null,
          sessionEndSound: "universfield-new-notification-027-383749.mp3",
          sessionStartTime: null,
          completedFocusSessions: 0,
        });
      },
      setBackgroundImage: (image: string) => set({ backgroundImage: image }),
      setSessionEndSound: (sound: string) => set({ sessionEndSound: sound }),
      isBgPanelOpen: false,
      setIsBgPanelOpen: (open: boolean) => set({ isBgPanelOpen: open, isSoundPanelOpen: open ? false : get().isSoundPanelOpen }),
      isSoundPanelOpen: false,
      setIsSoundPanelOpen: (open: boolean) => set({ isSoundPanelOpen: open, isBgPanelOpen: open ? false : get().isBgPanelOpen }),
      isNavFocusMode: false,
      setIsNavFocusMode: (enabled: boolean) => set({ isNavFocusMode: enabled }),
      toggleNavFocusMode: () => set((state) => ({ isNavFocusMode: !state.isNavFocusMode })),
      activeSounds: {},
      lastActiveSounds: null,
      toggleSound: (soundId: string) => {
        const { activeSounds } = get();
        const newSounds = { ...activeSounds };
        if (newSounds[soundId] !== undefined) {
          delete newSounds[soundId];
        } else {
          newSounds[soundId] = 50; // Default volume for new active sound
        }
        set({ activeSounds: newSounds, lastActiveSounds: null });
      },
      setSoundVolume: (soundId: string, volume: number) => {
        const { activeSounds } = get();
        if (activeSounds[soundId] !== undefined) {
          set({ activeSounds: { ...activeSounds, [soundId]: volume }, lastActiveSounds: null });
        }
      },
      stopAllSounds: () => set({ activeSounds: {}, lastActiveSounds: null }),
      toggleAllSounds: () => {
        const { activeSounds, lastActiveSounds } = get();
        const activeCount = Object.keys(activeSounds).length;
        
        if (activeCount > 0) {
          // Stop all and save
          set({ lastActiveSounds: activeSounds, activeSounds: {} });
        } else if (lastActiveSounds) {
          // Restore last sounds
          set({ activeSounds: lastActiveSounds, lastActiveSounds: null });
        }
      },
    }),
    {
      name: "dangdoro-timer-storage",
    }
  )
);
