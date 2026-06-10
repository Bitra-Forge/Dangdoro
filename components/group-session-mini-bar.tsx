"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Pause, Play, StopCircle } from "lucide-react";
import { doc, onSnapshot, query, collection, where, limit } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";

interface FocusGroupNameDoc {
  name?: string;
}

function fmtElapsedFromMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function GroupSessionMiniBar() {
  const { user } = useAuth();
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const mode = useTimerStore((s) => s.mode);
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const initialFocusTime = useTimerStore((s) => s.initialFocusTime);
  const pauseTimer = useTimerStore((s) => s.pause);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);
  const setActiveGroupId = useTimerStore((s) => s.setActiveGroupId);

  const [groupName, setGroupName] = useState("Group session");
  const [hostId, setHostId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeGroupId) return;
    return onSnapshot(doc(db, "focusGroups", activeGroupId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGroupName(data.name || "Group session");
        setHostId(data.hostId || null);
      }
    });
  }, [activeGroupId]);

  const wasHostActiveRef = useRef(false);
  useEffect(() => {
    if (!activeGroupId || !hostId || !user || hostId === user.uid || !isActive) {
      wasHostActiveRef.current = false;
      return;
    }

    const q = query(
      collection(db, "liveSessions"),
      where("groupId", "==", activeGroupId),
      where("userId", "==", hostId),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      const hostIsActive = !snap.empty;
      if (hostIsActive) {
        wasHostActiveRef.current = true;
      } else if (wasHostActiveRef.current) {
        wasHostActiveRef.current = false;
        
        // Host ended the session
        const stopSession = async () => {
          const { mode, initialFocusTime, timeLeft, sessionStartTime } = useTimerStore.getState();
          stopTimer();
          const elapsedSeconds = mode === "focus" ? Math.max(0, initialFocusTime - timeLeft) : 0;
          const elapsedMinutes = Math.floor(elapsedSeconds / 60);

          if (mode === "focus" && elapsedMinutes >= 1) {
            try {
              const { accumulateFocusTime } = await import("@/lib/focus-accumulator");
              await accumulateFocusTime(user.uid, elapsedMinutes, activeGroupId, sessionStartTime);
            } catch (err) {
              console.error("Failed to save focus time on host session end:", err);
            }
          }
          setActiveGroupId(null);
          toast.info("The host has ended the focus session.");
        };
        stopSession();
      }
    });

    return unsub;
  }, [activeGroupId, hostId, user, isActive, stopTimer, setActiveGroupId]);

  const elapsed = useMemo(() => {
    if (mode !== "focus") return isActive ? "Running" : "Paused";
    const elapsedSeconds = Math.max(0, initialFocusTime - timeLeft);
    if (!isActive && elapsedSeconds === 0) return "Paused";
    return fmtElapsedFromMs(elapsedSeconds * 1000);
  }, [initialFocusTime, isActive, mode, timeLeft]);

  const isPausedState = !isActive && isPaused;

  if (!activeGroupId || (!isActive && !isPaused)) return null;

  return (
    <div className="fixed right-5 bottom-24 z-[95] w-[calc(100vw-2.5rem)] max-w-[260px] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl px-4 py-4">
        {/* Top Section: Centered */}
        <div className="flex flex-col items-center justify-center mb-4">
          <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-bold mb-1">Group Session</p>
          <p className="text-sm font-black text-white truncate flex items-center justify-center gap-2">
            <span>{groupName}</span> 
            <span className="text-zinc-600">•</span>
            <span className={cn(
              "font-bold font-terminal tracking-tight",
              isPausedState ? "text-amber-400" : "text-cyan-400"
            )}>{elapsed}</span>
          </p>
        </div>
        
        {/* Bottom Section: Buttons spread apart */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-3 border-t border-white/5">
          <button
            onClick={() => {
              if (isActive) pauseTimer();
              else startTimer();
            }}
            className={cn(
              "flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm",
              isActive
                ? "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white"
                : isPausedState
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                  : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
            )}
          >
            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isActive ? "Pause" : "Resume"}
          </button>
          
          <button
            onClick={async () => {
              const { mode, initialFocusTime, timeLeft, sessionStartTime } = useTimerStore.getState();
              stopTimer();
              const elapsedSeconds = mode === "focus" ? Math.max(0, initialFocusTime - timeLeft) : 0;
              const elapsedMinutes = Math.floor(elapsedSeconds / 60);

              if (mode === "focus" && elapsedMinutes >= 1 && user) {
                try {
                  const { accumulateFocusTime } = await import("@/lib/focus-accumulator");
                  if (hostId === user.uid) {
                    await accumulateFocusTime(user.uid, elapsedMinutes, activeGroupId, sessionStartTime);
                  } else {
                    // Accumulate focus time for non-hosts on manual stop
                    await accumulateFocusTime(user.uid, elapsedMinutes, activeGroupId, sessionStartTime);
                  }
                } catch (err) {
                  console.error("Failed to save focus time from mini bar:", err);
                }
              }
              setActiveGroupId(null);
            }}
            className={cn(
              "flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border transition-all",
              "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30"
            )}
          >
            <StopCircle className="w-3.5 h-3.5" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
