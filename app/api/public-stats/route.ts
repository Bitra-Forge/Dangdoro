import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    // 1. Fetch users
    const usersSnap = await adminDb.collection("users").get();
    const totalUsers = usersSnap.size;

    let totalMinutes = 0;
    let newUsers = 0;
    let newSignedInUsers = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      totalMinutes += data.totalMinutes ?? 0;

      if (data.createdAt) {
        const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (created >= todayStart && created <= todayEnd) {
          newUsers++;
          if (data.isAnonymous === false || data.isAnonymous === undefined) {
            newSignedInUsers++;
          }
        }
      }
    });

    // 2. Fetch sessions size
    const sessionsSnap = await adminDb.collection("sessions").get();
    const totalSessions = sessionsSnap.size;

    const stats = {
      totalUsers,
      totalTimeHours: Math.round(totalMinutes / 60),
      totalSessions,
      newUsers,
      newSignedInUsers,
    };

    return NextResponse.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
