import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/admin/audit-user-minutes
 *
 * Scans every non-anonymous user and compares their stored totalMinutes
 * against the real sum of their completed sessions.
 *
 * Reports all users where the stored value is LOWER than the real sum
 * (meaning they lost time due to the syncUserProfile bug).
 *
 * Query params:
 *   ?fix=true   — also apply the correction automatically for every mismatch
 *   ?threshold=5 — only flag users where the gap is >= N minutes (default 1)
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
  const threshold = parseInt(searchParams.get("threshold") || "1", 10);

  try {
    // 1. Load all non-anonymous users
    const usersSnap = await adminDb
      .collection("users")
      .where("isAnonymous", "==", false)
      .get();

    console.log(`⏳ [Audit] Scanning ${usersSnap.size} non-anonymous users...`);

    // 2. For each user, sum their sessions
    const mismatches: Array<{
      uid: string;
      displayName: string;
      email: string;
      storedMinutes: number;
      realMinutes: number;
      storedPomodoros: number;
      realPomodoros: number;
      delta: number;
      fixed: boolean;
    }> = [];

    const ok: number[] = [];

    // Process in batches to avoid timeout
    const userDocs = usersSnap.docs;
    for (const userDoc of userDocs) {
      const uid = userDoc.id;
      const data = userDoc.data();

      const storedMinutes: number = typeof data.totalMinutes === "number" ? data.totalMinutes : 0;
      const storedPomodoros: number = typeof data.totalPomodoros === "number" ? data.totalPomodoros : 0;

      // Sum sessions for this user
      const sessionsSnap = await adminDb
        .collection("sessions")
        .where("userId", "==", uid)
        .get();

      let realMinutes = 0;
      let realPomodoros = 0;
      for (const s of sessionsSnap.docs) {
        const d = s.data();
        const dur = typeof d.duration === "number" ? d.duration : 0;
        if (dur >= 1) {
          realMinutes += dur;
          realPomodoros += 1;
        }
      }

      const delta = realMinutes - storedMinutes;

      if (delta >= threshold) {
        let fixed = false;

        if (fix) {
          await adminDb.collection("users").doc(uid).update({
            totalMinutes: realMinutes,
            totalPomodoros: realPomodoros,
          });
          fixed = true;
          console.log(
            `✅ [Audit] Fixed ${uid} (${data.displayName}): ` +
            `${storedMinutes} → ${realMinutes} min (Δ+${delta})`
          );
        }

        mismatches.push({
          uid,
          displayName: data.displayName || "Unknown",
          email: data.email || "",
          storedMinutes,
          realMinutes,
          storedPomodoros,
          realPomodoros,
          delta,
          fixed,
        });
      } else {
        ok.push(storedMinutes);
      }
    }

    // Sort mismatches by largest delta first
    mismatches.sort((a, b) => b.delta - a.delta);

    const summary = {
      scanned: usersSnap.size,
      mismatchCount: mismatches.length,
      okCount: ok.length,
      fixApplied: fix,
      threshold,
      mismatches,
    };

    console.log(
      `✅ [Audit] Done. Scanned: ${usersSnap.size}, ` +
      `Mismatches: ${mismatches.length}, Fixed: ${fix ? mismatches.length : 0}`
    );

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("❌ [Audit] Failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
