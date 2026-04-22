"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { updateLastActive } from "@/lib/db";

/**
 * Silent component that updates the user's lastActive timestamp in Firestore
 * every 4 minutes while they are active on the site.
 */
export function Heartbeat() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!user?.uid) return;

    const performHeartbeat = async () => {
      const now = Date.now();
      // Update at most once every 2 minutes (120,000ms)
      // We use a 10-minute threshold elsewhere to determine "Online" status
      if (now - lastUpdateRef.current > 2 * 60 * 1000) {
        lastUpdateRef.current = now;
        await updateLastActive(user.uid);
      }
    };

    performHeartbeat();

    const intervalId = setInterval(performHeartbeat, 60 * 1000); // Check every minute
    
    // Immediate update when focusing back on the window
    window.addEventListener("focus", performHeartbeat);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", performHeartbeat);
    };
  }, [user?.uid]);

  return null;
}
