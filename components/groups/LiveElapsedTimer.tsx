"use client";

import { useState, useEffect } from "react";

export function LiveElapsedTimer({ startTime, isActive }: { startTime: any, isActive: boolean }) {
    const [elapsed, setElapsed] = useState("");

    useEffect(() => {
        if (!isActive || !startTime) {
            setElapsed("00:00:00");
            return;
        }

        const update = () => {
            let startMs = 0;
            if (typeof startTime.toMillis === "function") startMs = startTime.toMillis();
            else if (typeof startTime.seconds === "number") startMs = startTime.seconds * 1000;
            else if (typeof startTime === "number") startMs = startTime;
            else if (startTime instanceof Date) startMs = startTime.getTime();
            else startMs = Date.now(); // Fallback for optimistic updates

            const diff = Math.max(0, Date.now() - startMs);
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setElapsed(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
        };

        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [startTime, isActive]);

    return <>{elapsed}</>;
}
