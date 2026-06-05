"use client";

import { useEffect, useRef, useCallback } from "react";
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

  useEffect(() => {
    if (activeGroupId) {
      prevGroupIdRef.current = activeGroupId;
    }
  }, [activeGroupId]);

  // Track host ID of the active group
  const cachedHostGroupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeGroupId) {
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
  }, [activeGroupId]);

  // Keep track of accumulated focus time in minutes
  useEffect(() => {
    if (timeLeft === 0) {
      pendingMinutesRef.current = 0;
      return;
    }
    if (mode === "focus" && activeGroupId && timeLeft < initialFocusTime) {
      const elapsedSeconds = Math.max(0, initialFocusTime - timeLeft);
      pendingMinutesRef.current = Math.floor(elapsedSeconds / 60);
    }
  }, [timeLeft, initialFocusTime, mode, activeGroupId]);

  const saveFocusTime = useCallback(async () => {
    const duration = pendingMinutesRef.current;
    const targetGroupId = activeGroupId || prevGroupIdRef.current;
    const isNonHost = hostIdRef.current && user && hostIdRef.current !== user.uid;

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
          // Stopped or completed - end live session
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
  ]);

  useEffect(() => {
    if (!activeLiveSessionId) {
      return;
    }

    // Keep live presence fresh so inactive tabs do not appear focusing forever.
    updateLiveSessionHeartbeat(activeLiveSessionId);
    const heartbeat = setInterval(() => {
      updateLiveSessionHeartbeat(activeLiveSessionId);
    }, 30000);

    // Clean up presence immediately on tab close or page hide
    const handleCleanup = () => {
      saveFocusTime();
      if (user) {
        flushFocusTime(user.uid, activeGroupId || prevGroupIdRef.current, false);
      }
      endLiveSession(activeLiveSessionId);
    };

    window.addEventListener("beforeunload", handleCleanup);
    window.addEventListener("pagehide", handleCleanup);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleCleanup);
      window.removeEventListener("pagehide", handleCleanup);
    };
  }, [activeLiveSessionId, saveFocusTime]);

  return null;
}
