import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/admin/audit-all-duplicates
 *
 * Scans ALL users in the database to detect and optionally fix duplicate/inflated sessions.
 *
 * Detects:
 *  1. Strict duplicates (same duration + groupId within 120s).
 *  2. Pattern A (Double-count: one session is exactly double another nearby session).
 *  3. Pattern B (Retry re-write: same duration + groupId written within 15 minutes).
 *
 * Query params:
 *   ?fix=true   — Deletes all duplicate sessions and updates user profile and group stats.
 *   ?dryRun=true — Run without writing changes (default).
 *
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const expectedToken = process.env.CRON_SECRET || "internal-cron-secret-key-12345";
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fix = searchParams.get("fix") === "true";
  const dryRun = !fix;

  const SHORT_WINDOW_MS = 120_000;  // 2 minutes for strict duplicates / double-counts
  const RETRY_WINDOW_MS = 900_000;  // 15 minutes for slow retry re-writes

  try {
    // 1. Fetch all users
    const usersSnap = await adminDb.collection("users").get();
    console.log(`⏳ [Global Audit] Scanning sessions for ${usersSnap.size} users...`);

    const results: Array<{
      uid: string;
      displayName: string;
      email: string;
      totalSessions: number;
      duplicatesFound: number;
      before: { totalMinutes: number; totalPomodoros: number };
      after: { totalMinutes: number; totalPomodoros: number };
      corrections: string[];
    }> = [];

    let totalDuplicatesRemoved = 0;

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Fetch all sessions for this user
      const sessionsSnap = await adminDb
        .collection("sessions")
        .where("userId", "==", userId)
        .get();

      if (sessionsSnap.empty) continue;

      const sessions = sessionsSnap.docs
        .map(d => ({
          id: d.id,
          duration: d.data().duration ?? 0,
          groupId: d.data().groupId ?? null,
          completedAtMs: d.data().completedAt?.toMillis?.() ?? 0,
        }))
        .sort((a, b) => a.completedAtMs - b.completedAtMs);

      const toDelete = new Set<string>();
      const corrections: string[] = [];

      // Loop through and evaluate duplicates
      for (let i = 0; i < sessions.length; i++) {
        const a = sessions[i];
        if (toDelete.has(a.id)) continue;

        for (let j = i + 1; j < sessions.length; j++) {
          const b = sessions[j];
          if (toDelete.has(b.id)) continue;

          // Check same group context
          if (a.groupId !== b.groupId) continue;

          const timeDiff = Math.abs(a.completedAtMs - b.completedAtMs);

          // Rule 1: Strict duplicates (same duration, same group, within 2 min)
          if (a.duration === b.duration && timeDiff <= SHORT_WINDOW_MS) {
            toDelete.add(b.id);
            corrections.push(`Strict Duplicate: ${b.duration}m at ${new Date(b.completedAtMs).toISOString()} (matched ${a.id})`);
            continue;
          }

          // Rule 2: Pattern A (Double-count: one is exactly 2x the other within 2 min)
          if (timeDiff <= SHORT_WINDOW_MS) {
            if (b.duration === a.duration * 2 && a.duration > 0) {
              toDelete.add(b.id);
              corrections.push(`Double-Count Inflated: ${b.duration}m (should be ${a.duration}m matching ${a.id})`);
              continue;
            } else if (a.duration === b.duration * 2 && b.duration > 0) {
              toDelete.add(a.id);
              corrections.push(`Double-Count Inflated: ${a.duration}m (should be ${b.duration}m matching ${b.id})`);
              continue;
            }
          }

          // Rule 3: Pattern B (Retry re-write: same duration, same group, within 15 min)
          if (a.duration === b.duration && timeDiff <= RETRY_WINDOW_MS) {
            toDelete.add(b.id);
            corrections.push(`Retry Re-write: ${b.duration}m (duplicate of ${a.id} within 15m)`);
            continue;
          }
        }
      }

      if (toDelete.size > 0) {
        totalDuplicatesRemoved += toDelete.size;

        // Calculate new stats
        const realSessions = sessions.filter(s => !toDelete.has(s.id));
        const realMinutes = realSessions.reduce((acc, s) => acc + (s.duration >= 1 ? s.duration : 0), 0);
        const realPomodoros = realSessions.filter(s => s.duration >= 1).length;

        const prevMinutes = userData.totalMinutes ?? 0;
        const prevPomodoros = userData.totalPomodoros ?? 0;

        results.push({
          uid: userId,
          displayName: userData.displayName || "Unknown",
          email: userData.email || "No Email",
          totalSessions: sessions.length,
          duplicatesFound: toDelete.size,
          before: { totalMinutes: prevMinutes, totalPomodoros: prevPomodoros },
          after: { totalMinutes: realMinutes, totalPomodoros: realPomodoros },
          corrections,
        });

        if (!dryRun) {
          // Perform deletions
          const batch = adminDb.batch();
          for (const id of toDelete) {
            batch.delete(adminDb.collection("sessions").doc(id));
          }
          await batch.commit();

          // Update user profile
          await adminDb.collection("users").doc(userId).update({
            totalMinutes: realMinutes,
            totalPomodoros: realPomodoros,
          });

          // Recalculate memberStats and group totals for every group this user is in
          const realMinutesByGroup: Record<string, number> = {};
          for (const s of realSessions) {
            if (!s.groupId) continue;
            realMinutesByGroup[s.groupId] = (realMinutesByGroup[s.groupId] ?? 0) + s.duration;
          }

          for (const groupId of Object.keys(realMinutesByGroup)) {
            const groupRef = adminDb.collection("focusGroups").doc(groupId);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) continue;

            const groupData = groupSnap.data()!;
            const memberStats = groupData.memberStats ?? {};
            const prevMemberMinutes = memberStats[userId]?.totalMinutes ?? 0;
            const newMemberMinutes = realMinutesByGroup[groupId] ?? 0;

            const prevGroupTotal = groupData.totalMinutes ?? 0;
            const newGroupTotal = Math.max(0, prevGroupTotal - prevMemberMinutes + newMemberMinutes);

            await groupRef.update({
              [`memberStats.${userId}.totalMinutes`]: newMemberMinutes,
              totalMinutes: newGroupTotal,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalUsersScanned: usersSnap.size,
      totalDuplicatesDetected: totalDuplicatesRemoved,
      affectedUsersCount: results.length,
      affectedUsers: results,
    });
  } catch (error: any) {
    console.error("❌ [Global Duplicates Audit] Failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
