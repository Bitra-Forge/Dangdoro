import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/remove-duplicate-sessions
 *
 * Finds and deletes duplicate sessions for a user — defined as sessions
 * with the same duration + groupId that were written within WINDOW_MS of each other.
 * Keeps only the FIRST one written (lowest completedAt), deletes the rest.
 *
 * Then recalculates and patches the user's totalMinutes and totalPomodoros.
 *
 * Body: { userId: string, windowMs?: number (default 120000), dryRun?: boolean }
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const expectedToken = process.env.CRON_SECRET || "internal-cron-secret-key-12345";
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { userId, windowMs = 120_000, dryRun = false } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // 1. Fetch all sessions for user (no orderBy to avoid composite index requirement)
    const snap = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .get();

    const sessions = snap.docs.map(doc => ({
      id: doc.id,
      duration: doc.data().duration ?? 0,
      groupId: doc.data().groupId ?? null,
      completedAtMs: doc.data().completedAt?.toMillis?.() ?? 0,
    }))
    // Sort asc by completedAt in memory — keep the earliest occurrence of each duplicate cluster
    .sort((a, b) => a.completedAtMs - b.completedAtMs);

    // 2. Find duplicates — same duration+groupId within windowMs, keep first occurrence
    const keep = new Set<string>();
    const toDelete: string[] = [];

    for (let i = 0; i < sessions.length; i++) {
      if (toDelete.includes(sessions[i].id)) continue; // already marked as duplicate
      keep.add(sessions[i].id);
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        if (
          a.duration === b.duration &&
          a.groupId === b.groupId &&
          Math.abs(a.completedAtMs - b.completedAtMs) <= windowMs
        ) {
          toDelete.push(b.id);
        }
      }
    }

    // 3. Delete duplicates
    if (!dryRun && toDelete.length > 0) {
      const batch = adminDb.batch();
      for (const id of toDelete) {
        batch.delete(adminDb.collection("sessions").doc(id));
      }
      await batch.commit();
    }

    // 4. Recompute totals from the sessions we're keeping
    const keptSessions = sessions.filter(s => keep.has(s.id) && !toDelete.includes(s.id));
    // Wait — if dryRun, no deletions happened, so recalculate from 'keep' set
    const realSessions = sessions.filter(s => !toDelete.includes(s.id));
    const realMinutes = realSessions.reduce((acc, s) => acc + (s.duration >= 1 ? s.duration : 0), 0);
    const realPomodoros = realSessions.filter(s => s.duration >= 1).length;

    // 5. Patch the user doc
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const prevData = userSnap.data() || {};

    if (!dryRun) {
      await userRef.update({
        totalMinutes: realMinutes,
        totalPomodoros: realPomodoros,
      });
    }

    return NextResponse.json({
      dryRun,
      userId,
      totalSessionsScanned: sessions.length,
      duplicatesFound: toDelete.length,
      duplicateIds: toDelete,
      keptSessionCount: realSessions.length,
      before: { totalMinutes: prevData.totalMinutes ?? 0, totalPomodoros: prevData.totalPomodoros ?? 0 },
      after: { totalMinutes: realMinutes, totalPomodoros: realPomodoros },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
