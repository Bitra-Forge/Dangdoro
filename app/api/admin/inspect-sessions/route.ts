import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/admin/inspect-sessions?userId=xxx&limit=200
 *
 * Returns all sessions for a user, sorted by completedAt desc.
 * Flags sessions that look like duplicates (same duration within 2 minutes of another).
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
  const userId = searchParams.get("userId");
  const limitCount = parseInt(searchParams.get("limit") || "200", 10);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const snap = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .orderBy("completedAt", "desc")
      .limit(limitCount)
      .get();

    const sessions = snap.docs.map(doc => {
      const d = doc.data();
      const completedAt = d.completedAt?.toDate?.()?.toISOString() ?? d.completedAt ?? null;
      return {
        id: doc.id,
        duration: d.duration ?? 0,
        groupId: d.groupId ?? null,
        status: d.status ?? null,
        completedAt,
        completedAtMs: d.completedAt?.toMillis?.() ?? null,
      };
    });

    // Flag potential duplicates: same duration + groupId within 120 seconds of another
    const DUPE_WINDOW_MS = 120_000;
    const flagged = new Set<string>();
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        if (a.duration === b.duration && a.groupId === b.groupId) {
          const diff = Math.abs((a.completedAtMs ?? 0) - (b.completedAtMs ?? 0));
          if (diff <= DUPE_WINDOW_MS) {
            flagged.add(a.id);
            flagged.add(b.id);
          }
        }
      }
    }

    // Group summary by groupId
    const byGroup: Record<string, { totalMinutes: number; sessionCount: number }> = {};
    let grandTotal = 0;
    for (const s of sessions) {
      const key = s.groupId ?? "__solo__";
      if (!byGroup[key]) byGroup[key] = { totalMinutes: 0, sessionCount: 0 };
      byGroup[key].totalMinutes += s.duration;
      byGroup[key].sessionCount += 1;
      grandTotal += s.duration;
    }

    return NextResponse.json({
      userId,
      totalSessions: sessions.length,
      grandTotalMinutes: grandTotal,
      suspectedDuplicates: flagged.size,
      byGroup,
      sessions: sessions.map(s => ({
        ...s,
        isDuplicate: flagged.has(s.id),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
