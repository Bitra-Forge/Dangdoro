import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/admin/find-user?email=xxx@xxx.com
 *
 * Finds a user's UID by querying their email in the users collection.
 * Returns uid, displayName, totalMinutes, totalPomodoros so you can
 * verify before running recalculate-user-minutes.
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
  const email = searchParams.get("email");
  const displayName = searchParams.get("displayName");

  if (!email && !displayName) {
    return NextResponse.json({ error: "Provide ?email= or ?displayName=" }, { status: 400 });
  }

  try {
    let snap;
    if (email) {
      snap = await adminDb.collection("users").where("email", "==", email).limit(5).get();
    } else {
      snap = await adminDb.collection("users").where("displayName", "==", displayName).limit(5).get();
    }

    if (snap.empty) {
      return NextResponse.json({ found: false, results: [] });
    }

    const results = snap.docs.map(doc => {
      const d = doc.data();
      return {
        uid: doc.id,
        displayName: d.displayName,
        email: d.email,
        totalMinutes: d.totalMinutes ?? 0,
        totalPomodoros: d.totalPomodoros ?? 0,
        isAnonymous: d.isAnonymous ?? false,
      };
    });

    return NextResponse.json({ found: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
