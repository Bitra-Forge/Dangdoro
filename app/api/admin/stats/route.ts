import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAdminFromRequest } from "@/lib/admin-check";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    await getAdminFromRequest(req);

    const now = Timestamp.now();
    
    // Generate dates for the last 7 days (including today)
    const historicalData: { date: string; dateKey: string; registrations: number; sessions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.toDate());
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD
      historicalData.push({
        date: dateStr,
        dateKey,
        registrations: 0,
        sessions: 0,
      });
    }

    const todayStart = new Date(now.toDate());
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now.toDate());
    todayEnd.setHours(23, 59, 59, 999);

    const usersSnap = await adminDb.collection("users").get();
    const totalUsers = usersSnap.size;

    let totalPomodoros = 0;
    let newUsersToday = 0;
    let newSignedInUsersToday = 0;
    let totalMinutes = 0;
    let onlineUsers = 0;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      totalPomodoros += data.totalPomodoros ?? 0;
      totalMinutes += data.totalMinutes ?? 0;

      // Online status check
      if (data.lastActive) {
        const lastActive = data.lastActive.toDate ? data.lastActive.toDate() : new Date(data.lastActive);
        if (lastActive >= tenMinutesAgo) {
          onlineUsers++;
        }
      }

      if (data.createdAt) {
        const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (created >= todayStart && created <= todayEnd) {
          newUsersToday++;
          if (data.isAnonymous === false || data.isAnonymous === undefined) {
            newSignedInUsersToday++;
          }
        }

        // Group into daily registrations for the chart
        const dateKey = created.toISOString().split("T")[0];
        const dayItem = historicalData.find((item) => item.dateKey === dateKey);
        if (dayItem) {
          dayItem.registrations++;
        }
      }
    }

    const sessionsSnap = await adminDb.collection("sessions").get();
    const totalSessions = sessionsSnap.size;

    for (const doc of sessionsSnap.docs) {
      const data = doc.data();
      if (data.completedAt) {
        const completed = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
        const dateKey = completed.toISOString().split("T")[0];
        const dayItem = historicalData.find((item) => item.dateKey === dateKey);
        if (dayItem) {
          dayItem.sessions++;
        }
      }
    }

    // Return the response including the historical metrics
    return NextResponse.json({
      totalUsers,
      totalPomodoros,
      totalSessions,
      newUsersToday,
      newSignedInUsersToday,
      totalTimeHours: Math.round(totalMinutes / 60),
      onlineUsers,
      historicalData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

