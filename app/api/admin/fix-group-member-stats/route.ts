import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/fix-group-member-stats
 *
 * For a given user, recalculates their memberStats.totalMinutes in every group
 * they belong to by summing sessions for that (user, group) pair.
 *
 * Also recalculates the group's overall totalMinutes by summing memberStats
 * across all members after the correction.
 *
 * Body: { userId: string, dryRun?: boolean }
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
  const { userId, dryRun = false } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // 1. Fetch all sessions for this user to get per-group real totals
    const sessionsSnap = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .get();

    // Sum real minutes per groupId from sessions
    const realMinutesByGroup: Record<string, number> = {};
    for (const doc of sessionsSnap.docs) {
      const d = doc.data();
      const gid = d.groupId;
      if (!gid) continue;
      const dur = typeof d.duration === "number" && d.duration >= 1 ? d.duration : 0;
      realMinutesByGroup[gid] = (realMinutesByGroup[gid] ?? 0) + dur;
    }

    // 2. For every group this user is in, apply the correction
    const groupIds = Object.keys(realMinutesByGroup);
    const corrections: Array<{
      groupId: string;
      prevMemberMinutes: number;
      newMemberMinutes: number;
      prevGroupTotal: number;
      newGroupTotal: number;
    }> = [];

    for (const groupId of groupIds) {
      const groupRef = adminDb.collection("focusGroups").doc(groupId);
      const groupSnap = await groupRef.get();
      if (!groupSnap.exists) continue;

      const groupData = groupSnap.data()!;
      const memberStats = groupData.memberStats ?? {};
      const prevMemberMinutes: number = memberStats[userId]?.totalMinutes ?? 0;
      const newMemberMinutes = realMinutesByGroup[groupId] ?? 0;

      // Recalculate group total: take the existing total, subtract the old member value,
      // add the corrected member value.
      const prevGroupTotal: number = groupData.totalMinutes ?? 0;
      const newGroupTotal = Math.max(0, prevGroupTotal - prevMemberMinutes + newMemberMinutes);

      corrections.push({ groupId, prevMemberMinutes, newMemberMinutes, prevGroupTotal, newGroupTotal });

      if (!dryRun) {
        await groupRef.update({
          [`memberStats.${userId}.totalMinutes`]: newMemberMinutes,
          totalMinutes: newGroupTotal,
        });
      }
    }

    return NextResponse.json({
      dryRun,
      userId,
      groupsFixed: corrections.length,
      corrections,
    });
  } catch (error: any) {
    console.error("❌ [fix-group-member-stats]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
