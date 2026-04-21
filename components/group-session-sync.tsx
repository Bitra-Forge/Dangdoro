"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store";
import { endLiveSession, startLiveSession, updateLiveSessionHeartbeat } from "@/lib/db";
import { trackSessionEvent } from "@/lib/session-telemetry";

export function GroupSessionSync() {
  const { user } = useAuth();
  const timerIsActive = useTimerStore((s) => s.isActive);
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const pauseTimer = useTimerStore((s) => s.pause);
  const setActiveGroupId = useTimerStore((s) => s.setActiveGroupId);
  const setLiveSessionId = useTimerStore((s) => s.setLiveSessionId);
  const activeLiveSessionId = useTimerStore((s) => s.activeLiveSessionId);

  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const syncLiveSession = async () => {
      try {
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
        } else if (!timerIsActive && activeLiveSessionId) {
          await endLiveSession(activeLiveSessionId);
          setLiveSessionId(null);
        } else if (timerIsActive && !activeGroupId && activeLiveSessionId) {
          await endLiveSession(activeLiveSessionId);
          setLiveSessionId(null);
        } else {
          return;
        }
      } catch {
        trackSessionEvent("group_session_sync_failed", {
          stage: "global_sync",
          userId: user.uid,
          activeGroupId,
          activeLiveSessionId,
        });
      }
    };

    syncLiveSession();
  }, [
    activeGroupId,
    activeLiveSessionId,
    pauseTimer,
    setActiveGroupId,
    setLiveSessionId,
    timerIsActive,
    user,
  ]);

  useEffect(() => {
    if (!timerIsActive || !activeLiveSessionId) {
      return;
    }

    // Keep live presence fresh so inactive tabs do not appear focusing forever.
    updateLiveSessionHeartbeat(activeLiveSessionId);
    const heartbeat = setInterval(() => {
      updateLiveSessionHeartbeat(activeLiveSessionId);
    }, 30000);

    return () => clearInterval(heartbeat);
  }, [activeLiveSessionId, timerIsActive]);

  return null;
}
