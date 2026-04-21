"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, StopCircle } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";

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
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const isActive = useTimerStore((s) => s.isActive);
  const mode = useTimerStore((s) => s.mode);
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const initialFocusTime = useTimerStore((s) => s.initialFocusTime);
  const pauseTimer = useTimerStore((s) => s.pause);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);
  const setActiveGroupId = useTimerStore((s) => s.setActiveGroupId);

  const [groupName, setGroupName] = useState("Group session");
  useEffect(() => {
    if (!activeGroupId) return;
    return onSnapshot(doc(db, "focusGroups", activeGroupId), (snap) => {
      const data = snap.data() as FocusGroupNameDoc | undefined;
      setGroupName(data?.name || "Group session");
    });
  }, [activeGroupId]);

  const elapsed = useMemo(() => {
    if (mode !== "focus") return isActive ? "Running" : "Paused";
    const elapsedSeconds = Math.max(0, initialFocusTime - timeLeft);
    if (!isActive && elapsedSeconds === 0) return "Paused";
    return fmtElapsedFromMs(elapsedSeconds * 1000);
  }, [initialFocusTime, isActive, mode, timeLeft]);

  if (!activeGroupId) return null;

  return (
    <div className="fixed right-5 bottom-24 z-[95] w-[250px] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl px-3 py-3">
        <div className="min-w-0 mb-2">
          <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Group session</p>
          <p className="text-xs font-black text-white truncate">
            <span className="text-[#E8821A]">{groupName}</span> • {elapsed}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              if (isActive) pauseTimer();
              else startTimer();
            }}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 border transition-all",
              isActive
                ? "bg-orange-500 text-white border-orange-400/40 hover:bg-orange-400"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
            )}
          >
            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isActive ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => {
              stopTimer();
              setActiveGroupId(null);
            }}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 border transition-all",
              "bg-red-500/10 text-red-300 border-red-500/40 hover:bg-red-500/20"
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
