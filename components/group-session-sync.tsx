"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store";
import { endLiveSession, startLiveSession, updateLiveSessionHeartbeat, updateLiveSessionStatus } from "@/lib/db";
import { trackSessionEvent } from "@/lib/session-telemetry";

export function GroupSessionSync() {
  const { user } = useAuth();
  const timerIsActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const pauseTimer = useTimerStore((s) => s.pause);
  const setActiveGroupId = useTimerStore((s) => s.setActiveGroupId);
  const setLiveSessionId = useTimerStore((s) => s.setLiveSessionId);
  const activeLiveSessionId = useTimerStore((s) => s.activeLiveSessionId);

  useEffect(() => {
    const syncLiveSession = async () => {
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

        if (timerIsActive && activeGroupId && !activeLiveSessionId) {
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
          await endLiveSession(activeLiveSessionId);
          setLiveSessionId(null);
        } else if (activeLiveSessionId && activeGroupId) {
          // Update status based on pause/focus state
          const newStatus = isPaused ? "paused" : "focusing";
          await updateLiveSessionStatus(activeLiveSessionId, newStatus);
        } else if (!activeGroupId && activeLiveSessionId) {
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
      endLiveSession(activeLiveSessionId);
    };

    window.addEventListener("beforeunload", handleCleanup);
    window.addEventListener("pagehide", handleCleanup);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleCleanup);
      window.removeEventListener("pagehide", handleCleanup);
    };
  }, [activeLiveSessionId]);

  return null;
}
