"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store";
import { endLiveSession, startLiveSession, updateLiveSessionHeartbeat, updateLiveSessionStatus } from "@/lib/db";
import { accumulateFocusTime, flushFocusTime } from "@/lib/focus-accumulator";
import { trackSessionEvent } from "@/lib/session-telemetry";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function GroupSessionSync() {
  const { user } = useAuth();
  const timerIsActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const pauseTimer = useTimerStore((s) => s.pause);
  const setActiveGroupId = useTimerStore((s) => s.setActiveGroupId);
  const setLiveSessionId = useTimerStore((s) => s.setLiveSessionId);
  const activeLiveSessionId = useTimerStore((s) => s.activeLiveSessionId);

  const timeLeft = useTimerStore((s) => s.timeLeft);
  const initialFocusTime = useTimerStore((s) => s.initialFocusTime);
  const mode = useTimerStore((s) => s.mode);

  const pendingMinutesRef = useRef(0);
  const hostIdRef = useRef<string | null>(null);
  const prevGroupIdRef = useRef<string | null>(null);

  // Track whether the timer reached zero naturally.
  // When true, TimerTicker already called flushFocusTime(isSessionEnd=true),
  // so GroupSessionSync must NOT call saveFocusTime() — that would double-write.
  const completedNaturallyRef = useRef(false);

  // Track host ID of the active group
  const cachedHostGroupRef = useRef<string | null>(null);

  const [isHydrated, setIsHydrated] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  // 1. Wait for Zustand store to finish hydration from localStorage
  useEffect(() => {
    const unsub = useTimerStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (useTimerStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => unsub();
  }, []);

  // 2. Validate the persisted activeLiveSessionId on app load
  useEffect(() => {
    if (!isHydrated) return;

    const validatePersistedSession = async () => {
      const store = useTimerStore.getState();
      const sessionId = store.activeLiveSessionId;
      if (sessionId) {
        try {
          const docRef = doc(db, "liveSessions", sessionId);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists() || docSnap.data()?.status === "completed") {
            useTimerStore.setState({
              activeLiveSessionId: null,
              activeGroupId: null,
              isActive: false,
              isPaused: false,
              sessionStartTime: null,
            });
          }
        } catch (error) {
          // Fail-safe: clear the session state on Firestore query failure
          useTimerStore.setState({
            activeLiveSessionId: null,
            activeGroupId: null,
            isActive: false,
            isPaused: false,
            sessionStartTime: null,
          });
        }
      }
      setIsValidated(true);
    };

    validatePersistedSession();
  }, [isHydrated]);

  // Track host ID of the active group
  useEffect(() => {
    if (!isValidated || !activeGroupId) {
      hostIdRef.current = null;
      cachedHostGroupRef.current = null;
      return;
    }
    if (cachedHostGroupRef.current === activeGroupId) return;
    cachedHostGroupRef.current = activeGroupId;
    getDoc(doc(db, "focusGroups", activeGroupId)).then((snap) => {
      if (snap.exists()) {
        hostIdRef.current = snap.data().hostId || null;
      }
    }).catch((err) => console.error("Failed to get group hostId:", err));
  }, [activeGroupId, isValidated]);

  // Keep track of accumulated focus time and detect natural completion
  useEffect(() => {
    if (!isValidated) return;
    if (timeLeft === 0 && mode === "focus") {
      // Timer hit zero in a focus session.
      // IMPORTANT: React 18 batches stop() + setActiveGroupId(null) together, so
      // activeGroupId may already be null here even though we were in a group session.
      // Use prevGroupIdRef as a fallback to detect we were in a group.
      const wasInGroup = activeGroupId || prevGroupIdRef.current;
      if (wasInGroup) {
        // TimerTicker already called flushFocusTime(isSessionEnd=true) — don't write again.
        completedNaturallyRef.current = true;
        pendingMinutesRef.current = 0;
      }
      return;
    }
    if (timeLeft > 0) {
      // Timer is actively running — reset the natural-completion flag for next session end
      completedNaturallyRef.current = false;
    }
    if (mode === "focus" && activeGroupId && timeLeft < initialFocusTime && timeLeft > 0) {
      const elapsedSeconds = Math.max(0, initialFocusTime - timeLeft);
      pendingMinutesRef.current = Math.floor(elapsedSeconds / 60);
    }
  }, [timeLeft, initialFocusTime, mode, activeGroupId, isValidated]);

  /**
   * Save focus time for NON-HOST members only.
   * Hosts are handled by timer-card.tsx (stop-early) and TimerTicker (natural completion).
   * Should only be called on MANUAL stop (not natural completion — TimerTicker handles that).
   */
  const saveFocusTime = useCallback(async () => {
    // Never save here if the timer completed naturally — TimerTicker already wrote it
    if (completedNaturallyRef.current) {
      completedNaturallyRef.current = false;
      return;
    }

    const currentMode = useTimerStore.getState().mode;
    if (currentMode === "break" || currentMode === "long-break") {
      pendingMinutesRef.current = 0; // Clear pending minutes since it was a natural completion
      return;
    }

    const duration = pendingMinutesRef.current;
    const targetGroupId = activeGroupId || prevGroupIdRef.current;
    const isNonHost = hostIdRef.current !== null && user && hostIdRef.current !== user.uid;

    if (duration >= 1 && user && targetGroupId && isNonHost) {
      pendingMinutesRef.current = 0; // Clear immediately to prevent double-saving
      try {
        await accumulateFocusTime(user.uid, duration, targetGroupId);
      } catch (err) {
        console.error("Failed to save partial group session:", err);
      }
    }
  }, [activeGroupId, user]);

  useEffect(() => {
    if (!isValidated) return;
    const syncLiveSession = async () => {
      const prevGroupId = prevGroupIdRef.current;
      prevGroupIdRef.current = activeGroupId;

      try {
        if (!user || user.isAnonymous) {
          if (activeLiveSessionId) {
            try {
              await endLiveSession(activeLiveSessionId);
            } catch {
              // Stale session from a previous auth context — ignore
            }
            setLiveSessionId(null);
          }
          return;
        }

        // Handle group switching: if we have an active session but the active group ID changed
        if (activeLiveSessionId && activeGroupId && prevGroupId && prevGroupId !== activeGroupId) {
          await endLiveSession(activeLiveSessionId);
          setLiveSessionId(null);
          return;
        }

        if ((timerIsActive || isPaused) && activeGroupId && !activeLiveSessionId) {
          const sid = await startLiveSession(
            user.uid,
            activeGroupId,
            user.displayName || "Member",
            user.photoURL || ""
          );
          if (sid) {
            setLiveSessionId(sid);
          } else {
            toast.error("You already have an active session in another group.");
            setActiveGroupId(null);
            pauseTimer();
          }
        } else if (activeLiveSessionId && !timerIsActive && !isPaused) {
          // Timer stopped (either manually or naturally) — end live session
          // saveFocusTime() will skip if completedNaturallyRef is set
          await saveFocusTime();
          await endLiveSession(activeLiveSessionId);
          setLiveSessionId(null);
        } else if (activeLiveSessionId && activeGroupId) {
          // Update status based on pause/focus state
          const newStatus = isPaused ? "paused" : "focusing";
          let startedAtUpdate: Date | undefined = undefined;
          if (newStatus === "focusing") {
            const timeLeft = useTimerStore.getState().timeLeft;
            const initialFocusTime = useTimerStore.getState().initialFocusTime;
            const mode = useTimerStore.getState().mode;
            const elapsedSeconds = mode === "focus" ? Math.max(0, initialFocusTime - timeLeft) : 0;
            startedAtUpdate = new Date(Date.now() - elapsedSeconds * 1000);
          }
          await updateLiveSessionStatus(activeLiveSessionId, newStatus, startedAtUpdate);
        } else if (!activeGroupId && activeLiveSessionId) {
          await saveFocusTime();
          await endLiveSession(activeLiveSessionId);
          setLiveSessionId(null);
        } else {
          return;
        }
      } catch {
        trackSessionEvent("group_session_sync_failed", {
          stage: "global_sync",
          userId: user?.uid,
          activeGroupId,
          activeLiveSessionId,
        });
      }
    };

    syncLiveSession();
  }, [
    activeGroupId,
    activeLiveSessionId,
    isPaused,
    pauseTimer,
    setActiveGroupId,
    setLiveSessionId,
    timerIsActive,
    user,
    saveFocusTime,
    isValidated,
  ]);

  useEffect(() => {
    if (!isValidated || !activeLiveSessionId) {
      return;
    }

    // Keep live presence fresh so inactive tabs do not appear focusing forever.
    updateLiveSessionHeartbeat(activeLiveSessionId);
    const heartbeat = setInterval(() => {
      updateLiveSessionHeartbeat(activeLiveSessionId);
    }, 30000);

    // Clean up presence immediately on tab close or page hide
    const handleCleanup = () => {
      // Only flush if the session did NOT complete naturally (TimerTicker handled that)
      if (!completedNaturallyRef.current) {
        saveFocusTime();
        if (user) {
          flushFocusTime(user.uid, activeGroupId || prevGroupIdRef.current, false);
        }
      }

      // Use fetch with keepalive: true to guarantee the session end request reaches the server
      // even if the tab/browser is closed immediately.
      fetch("/api/session/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: activeLiveSessionId }),
        keepalive: true,
      }).catch((err) => console.error("Keepalive session end failed:", err));

      endLiveSession(activeLiveSessionId);
    };

    window.addEventListener("beforeunload", handleCleanup);
    window.addEventListener("pagehide", handleCleanup);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleCleanup);
      window.removeEventListener("pagehide", handleCleanup);
    };
  }, [activeLiveSessionId, saveFocusTime, isValidated]);

  return null;
}
