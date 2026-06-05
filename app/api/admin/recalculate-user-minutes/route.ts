import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/recalculate-user-minutes
 *
 * Recalculates a user's totalMinutes and totalPomodoros by summing
 * all their completed sessions. Use this to correct users whose
 * stats were zeroed by the syncUserProfile bug.
 *
 * Body: { userId: string }
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const expectedToken = process.env.CRON_SECRET || "internal-cron-secret-key-12345";

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId: string | undefined;
  try {
    const body = await req.json();
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    // 1. Read all sessions for this user
    const sessionsSnap = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .get();

    let totalMinutes = 0;
    let totalPomodoros = 0;

    for (const doc of sessionsSnap.docs) {
      const data = doc.data();
      const duration = typeof data.duration === "number" ? data.duration : 0;
      if (duration >= 1) {
        totalMinutes += duration;
        totalPomodoros += 1;
      }
    }

    // 2. Read the current user doc so we can report the delta
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: `User doc not found: ${userId}` }, { status: 404 });
    }

    const currentData = userSnap.data()!;
    const prevMinutes = currentData.totalMinutes ?? 0;
    const prevPomodoros = currentData.totalPomodoros ?? 0;

    // 3. Write the corrected values
    await userRef.update({
      totalMinutes,
      totalPomodoros,
    });

    console.log(
      `✅ [Recalculate] User ${userId}: ` +
      `totalMinutes ${prevMinutes} → ${totalMinutes} (Δ ${totalMinutes - prevMinutes}), ` +
      `totalPomodoros ${prevPomodoros} → ${totalPomodoros} (Δ ${totalPomodoros - prevPomodoros})`
    );

    return NextResponse.json({
      success: true,
      userId,
      sessionCount: sessionsSnap.size,
      before: { totalMinutes: prevMinutes, totalPomodoros: prevPomodoros },
      after: { totalMinutes, totalPomodoros },
      delta: {
        totalMinutes: totalMinutes - prevMinutes,
        totalPomodoros: totalPomodoros - prevPomodoros,
      },
    });
  } catch (error: any) {
    console.error("❌ [Recalculate] Failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
