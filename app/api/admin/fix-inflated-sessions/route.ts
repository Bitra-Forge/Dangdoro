import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/fix-inflated-sessions
 *
 * Detects two specific corruption patterns and removes the wrong session:
 *
 * Pattern A — "Double-count" (pending + sessionEnd = 2× real value):
 *   If session X has duration D and session Y (same group, within SHORT_WINDOW_MS)
 *   has duration D/2, then X is the inflated version of Y → delete X.
 *
 * Pattern B — "Retry re-write" (retryPendingFocusTime re-sent same amount):
 *   If two sessions have the SAME duration + groupId within RETRY_WINDOW_MS,
 *   keep the earliest, delete the later one (already handled by remove-duplicate-sessions
 *   for tight clusters but catches slower retries here).
 *
 * Body: { userId: string, dryRun?: boolean }
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const expectedToken = process.env.CRON_SECRET || "internal-cron-secret-key-12345";
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { userId, dryRun = false } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const SHORT_WINDOW_MS  =  30_000; // 30s  — double-count pair (written almost simultaneously)
  const RETRY_WINDOW_MS  = 900_000; // 15min — retry re-write (same amount written again later)

  try {
    const snap = await adminDb.collection("sessions").where("userId", "==", userId).get();
    const sessions = snap.docs
      .map(d => ({
        id: d.id,
        duration: d.data().duration ?? 0,
        groupId: d.data().groupId ?? null,
        completedAtMs: d.data().completedAt?.toMillis?.() ?? 0,
      }))
      .sort((a, b) => a.completedAtMs - b.completedAtMs);

    const toDelete = new Set<string>();
    const reasons: Array<{ id: string; reason: string; duration: number }> = [];

    // Pattern A: X.duration === 2 × Y.duration, same group, within SHORT_WINDOW_MS
    // (the larger one is the inflated double-count — delete it, keep the smaller half)
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i]; // earlier
        const b = sessions[j]; // later
        if (toDelete.has(a.id) || toDelete.has(b.id)) continue;
        if (a.groupId !== b.groupId) continue;

        const timeDiff = Math.abs(a.completedAtMs - b.completedAtMs);
        if (timeDiff > SHORT_WINDOW_MS) continue;

        // Check if one is exactly double the other
        if (b.duration === a.duration * 2 && a.duration > 0) {
          // a = correct half, b = inflated double → delete b
          toDelete.add(b.id);
          reasons.push({ id: b.id, reason: `Pattern A: duration ${b.duration} = 2×${a.duration} (paired with ${a.id})`, duration: b.duration });
        } else if (a.duration === b.duration * 2 && b.duration > 0) {
          // b = correct half, a = inflated double → delete a
          toDelete.add(a.id);
          reasons.push({ id: a.id, reason: `Pattern A: duration ${a.duration} = 2×${b.duration} (paired with ${b.id})`, duration: a.duration });
        }
      }
    }

    // Pattern B: exact same duration + groupId within RETRY_WINDOW_MS, keep earliest
    for (let i = 0; i < sessions.length; i++) {
      if (toDelete.has(sessions[i].id)) continue;
      for (let j = i + 1; j < sessions.length; j++) {
        if (toDelete.has(sessions[j].id)) continue;
        const a = sessions[i];
        const b = sessions[j];
        if (a.duration !== b.duration || a.groupId !== b.groupId) continue;
        const timeDiff = b.completedAtMs - a.completedAtMs;
        if (timeDiff <= RETRY_WINDOW_MS) {
          // a is earlier → keep a, delete b
          toDelete.add(b.id);
          reasons.push({ id: b.id, reason: `Pattern B: retry re-write of ${a.id} (${Math.round(timeDiff / 60000)}min later, same ${b.duration}min)`, duration: b.duration });
        }
      }
    }

    // Compute corrected totals
    const realSessions = sessions.filter(s => !toDelete.has(s.id));
    const realMinutes = realSessions.reduce((acc, s) => acc + (s.duration >= 1 ? s.duration : 0), 0);
    const realPomodoros = realSessions.filter(s => s.duration >= 1).length;

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const prevData = userSnap.data() || {};

    if (!dryRun && toDelete.size > 0) {
      const batch = adminDb.batch();
      for (const id of toDelete) {
        batch.delete(adminDb.collection("sessions").doc(id));
      }
      await batch.commit();
      await userRef.update({ totalMinutes: realMinutes, totalPomodoros: realPomodoros });
    }

    return NextResponse.json({
      dryRun,
      userId,
      scanned: sessions.length,
      corruptedFound: toDelete.size,
      corrections: reasons,
      keptCount: realSessions.length,
      before: { totalMinutes: prevData.totalMinutes ?? 0, totalPomodoros: prevData.totalPomodoros ?? 0 },
      after: { totalMinutes: realMinutes, totalPomodoros: realPomodoros },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
