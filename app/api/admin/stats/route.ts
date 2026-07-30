import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAdminFromRequest } from "@/lib/admin-check";
import { Timestamp, AggregateField } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    await getAdminFromRequest(req);

    const now = Timestamp.now();

    const todayStart = new Date(now.toDate());
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now.toDate());
    todayEnd.setHours(23, 59, 59, 999);

    const todayStartTs = Timestamp.fromDate(todayStart);
    const todayEndTs = Timestamp.fromDate(todayEnd);
    const tenMinutesAgoTs = Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000));

    // Generate date ranges for the last 7 days (including today)
    const days: { dateStr: string; dateKey: string; dayStartTs: Timestamp; dayEndTs: Timestamp }[] = [];
    const historicalPromises = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.toDate());
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateKey = d.toISOString().split("T")[0];

      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);

      const dayStartTs = Timestamp.fromDate(dStart);
      const dayEndTs = Timestamp.fromDate(dEnd);

      days.push({ dateStr, dateKey, dayStartTs, dayEndTs });

      // Add aggregation count queries for daily registrations & sessions
      historicalPromises.push(
        adminDb.collection("users").where("createdAt", ">=", dayStartTs).where("createdAt", "<=", dayEndTs).count().get(),
        adminDb.collection("sessions").where("completedAt", ">=", dayStartTs).where("completedAt", "<=", dayEndTs).count().get()
      );
    }

    // Execute all aggregation queries in parallel
    const [
      totalUsersSnap,
      totalSessionsSnap,
      totalMinutesSnap,
      totalPomodorosSnap,
      newUsersTodaySnap,
      newSignedInUsersTodaySnap,
      onlineUsersSnap,
      ...historicalSnaps
    ] = await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("sessions").count().get(),
      adminDb.collection("users").aggregate({ totalMinutes: AggregateField.sum("totalMinutes") }).get(),
      adminDb.collection("users").aggregate({ totalPomodoros: AggregateField.sum("totalPomodoros") }).get(),
      adminDb.collection("users").where("createdAt", ">=", todayStartTs).where("createdAt", "<=", todayEndTs).count().get(),
      adminDb.collection("users").where("createdAt", ">=", todayStartTs).where("createdAt", "<=", todayEndTs).where("isAnonymous", "==", false).count().get().catch((err) => {
        // Handle case where composite index is pending/building in Firestore
        console.warn("⚠️ Firestore composite index missing for newSignedInUsersToday:", err?.details || err?.message);
        return null;
      }),
      adminDb.collection("users").where("lastActive", ">=", tenMinutesAgoTs).count().get(),
      ...historicalPromises,
    ]);

    const totalUsers = totalUsersSnap.data().count;
    const totalSessions = totalSessionsSnap.data().count;
    const totalMinutes = totalMinutesSnap.data().totalMinutes || 0;
    const totalPomodoros = totalPomodorosSnap.data().totalPomodoros || 0;
    const newUsersToday = newUsersTodaySnap.data().count;
    const newSignedInUsersToday = newSignedInUsersTodaySnap ? newSignedInUsersTodaySnap.data().count : null;
    const onlineUsers = onlineUsersSnap.data().count;

    // Assemble historical data array
    const historicalData: { date: string; dateKey: string; registrations: number; sessions: number }[] = [];
    for (let i = 0; i < days.length; i++) {
      const regSnap = historicalSnaps[i * 2];
      const sessSnap = historicalSnaps[i * 2 + 1];
      historicalData.push({
        date: days[i].dateStr,
        dateKey: days[i].dateKey,
        registrations: regSnap.data().count,
        sessions: sessSnap.data().count,
      });
    }

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
