"use client";

import { useState, useEffect } from "react";
import { toMillis } from "@/lib/groups";

export function LiveElapsedTimer({
    startTime,
    isActive,
    isPaused,
    pausedAt,
    lastHeartbeat
}: {
    startTime: any;
    isActive: boolean;
    isPaused?: boolean;
    pausedAt?: any;
    lastHeartbeat?: any;
}) {
    const [elapsed, setElapsed] = useState("");

    useEffect(() => {
        if (!isActive || !startTime) {
            setElapsed("00:00:00");
            return;
        }

        const update = () => {
            const startMs = toMillis(startTime);
            if (!startMs) return;

            let endMs = Date.now();
            if (isPaused) {
                endMs = toMillis(pausedAt) || toMillis(lastHeartbeat) || Date.now();
            }

            const diff = Math.max(0, endMs - startMs);
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setElapsed(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
        };

        update();
        if (isPaused) return;

        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [startTime, isActive, isPaused, pausedAt, lastHeartbeat]);

    return <>{elapsed}</>;
}
