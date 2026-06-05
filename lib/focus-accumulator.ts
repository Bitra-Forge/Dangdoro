import { savePartialPomodoroSession, savePomodoroSession } from "@/lib/db";

const STORAGE_KEY_PREFIX = "dangdoro_pending_focus_";
const LAST_WRITE_KEY_PREFIX = "dangdoro_last_write_";

export interface PendingFocus {
  minutes: number;
  groupId: string | null;
}

/**
 * Get the pending focus minutes from localStorage
 */
export function getPendingFocus(userId: string): PendingFocus {
  if (typeof window === "undefined") return { minutes: 0, groupId: null };
  try {
    const val = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed.minutes === "number") {
        return {
          minutes: parsed.minutes,
          groupId: parsed.groupId || null,
        };
      }
    }
  } catch (e) {
    console.error("Failed to parse pending focus:", e);
  }
  return { minutes: 0, groupId: null };
}

/**
 * Set the pending focus minutes in localStorage
 */
export function setPendingFocus(userId: string, data: PendingFocus | null) {
  if (typeof window === "undefined") return;
  try {
    if (!data || data.minutes <= 0) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(data));
    }
  } catch (e) {
    console.error("Failed to set pending focus:", e);
  }
}

/**
 * Get the timestamp of the last Firestore write
 */
export function getLastWriteTime(userId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const val = localStorage.getItem(`${LAST_WRITE_KEY_PREFIX}${userId}`);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Set the timestamp of the last Firestore write
 */
export function setLastWriteTime(userId: string, time: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LAST_WRITE_KEY_PREFIX}${userId}`, String(time));
  } catch (e) {}
}

/**
 * Accumulate focus time client-side and trigger write if 60 seconds have passed.
 */
export async function accumulateFocusTime(
  userId: string,
  durationMinutes: number,
  groupId: string | null = null
) {
  if (durationMinutes <= 0) return;

  const current = getPendingFocus(userId);
  let newMinutes = durationMinutes;

  if (current.groupId === groupId) {
    newMinutes += current.minutes;
  } else if (current.minutes > 0) {
    // If group ID changed, flush the old one first before starting a new one
    await flushFocusTime(userId, current.groupId, false);
  }

  setPendingFocus(userId, { minutes: newMinutes, groupId });

  // Check if 60 seconds have passed since the last write
  const lastWrite = getLastWriteTime(userId);
  if (Date.now() - lastWrite >= 60 * 1000) {
    await flushFocusTime(userId, groupId, false);
  }
}

/**
 * On app load, retry any pending focus time writes from a previous session.
 * Uses increment() internally so concurrent writes are safe.
 */
export async function retryPendingFocusTime(userId: string): Promise<boolean> {
  const pending = getPendingFocus(userId);
  if (pending.minutes <= 0) return false;

  if (process.env.NODE_ENV !== "production") {
    console.log(`Retrying pending focus time for ${userId}: ${pending.minutes}min`);
  }
  try {
    const success = await savePartialPomodoroSession(userId, pending.minutes, pending.groupId);
    if (success) {
      setPendingFocus(userId, null);
      setLastWriteTime(userId, Date.now());
      if (process.env.NODE_ENV !== "production") {
        console.log(`Successfully retried pending focus time for ${userId}`);
      }
      return true;
    }
  } catch (e) {
    console.error("Failed to retry pending focus time:", e);
  }
  return false;
}

/**
 * Flush pending focus time from localStorage to Firestore.
 */
export async function flushFocusTime(
  userId: string,
  groupId: string | null,
  isSessionEnd: boolean = false,
  sessionEndMinutes: number = 0
): Promise<boolean> {
  const current = getPendingFocus(userId);
  const totalMinutes = current.minutes + (isSessionEnd ? sessionEndMinutes : 0);

  if (totalMinutes <= 0) {
    // Even if accumulator is empty, if the session ended normally, record it
    if (isSessionEnd && sessionEndMinutes > 0) {
      try {
        const success = await savePomodoroSession(userId, sessionEndMinutes, groupId);
        if (success) {
          setLastWriteTime(userId, Date.now());
          return true;
        }
      } catch (e) {
        console.error("Failed to save normal session:", e);
      }
    }
    return false;
  }

  try {
    let success = false;
    if (isSessionEnd) {
      success = await savePomodoroSession(userId, totalMinutes, groupId);
    } else {
      success = await savePartialPomodoroSession(userId, totalMinutes, groupId);
    }

    if (success) {
      // Clear localStorage pending focus on success
      setPendingFocus(userId, null);
      setLastWriteTime(userId, Date.now());
      return true;
    }
  } catch (e) {
    console.error("Failed to flush focus time to Firestore:", e);
  }

  return false;
}
