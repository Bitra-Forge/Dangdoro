import * as admin from "firebase-admin";
import { adminDb } from "../lib/firebase-admin";

// Kill the cron interval started by importing firebase-admin
if ((global as any).leaderboardInterval) {
  clearInterval((global as any).leaderboardInterval);
  (global as any).leaderboardInterval = undefined;
}

async function runReset() {
  const db = adminDb as any as admin.firestore.Firestore;

  const cacheSnap = await db.collection("cache").doc("leaderboard_weekly").get();
  if (!cacheSnap.exists) {
    console.log("[Test Reset] /cache/leaderboard_weekly not found.");
    return;
  }

  const cacheData = cacheSnap.data()!;
  const previousWeekId = cacheData.weekId;

  const backupRef = db.collection("cache").doc("_test_weekly_backup");
  await backupRef.set(cacheData);
  console.log(`[Test Reset] ✅ Backed up current cache`);

  const historyRef = db.collection("leaderboard_history").doc(previousWeekId);
  if ((await historyRef.get()).exists) {
    console.log(`[Test Reset] leaderboard_history/${previousWeekId} already exists. Run --cleanup first.`);
    return;
  }

  const top10 = (cacheData.players || []).slice(0, 10);
  console.log(`\n[Test Reset] Archiving top ${top10.length}:`);
  top10.forEach((p: any, i: number) => console.log(`  ${i + 1}. ${p.displayName} — ${p.totalMinutes} min`));

  await historyRef.set({
    weekId: previousWeekId,
    weekStart: admin.firestore.Timestamp.fromDate(new Date()),
    weekEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)),
    players: top10,
    frozenAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`[Test Reset] ✅ Archived to leaderboard_history/${previousWeekId}`);

  const emptyWeekId = `EMPTY_${Date.now()}`;
  await db.collection("cache").doc("leaderboard_weekly").set({
    players: [],
    weekId: emptyWeekId,
    builtAt: new Date(),
  });

  const verifySnap = await db.collection("cache").doc("leaderboard_weekly").get();
  const verifyData = verifySnap.data()!;
  console.log(`[Test Reset] ✅ Wrote empty leaderboard (verified: ${(verifyData.players || []).length} players)`);

  console.log(`\n🎉 Done! The weekly leaderboard is now empty.`);
  console.log(`   📜 Past weeks → ${previousWeekId}`);
  console.log(`   🆕 Weekly tab → empty\n`);
  console.log(`   ⚠️  If your dev server is running, its 30-min cron will eventually`);
  console.log(`      overwrite this. Hard-refresh the page now to see the empty state.\n`);
}

async function cleanup() {
  const db = adminDb as any as admin.firestore.Firestore;

  const backupSnap = await db.collection("cache").doc("_test_weekly_backup").get();
  if (backupSnap.exists) {
    const backupData = backupSnap.data()!;
    await db.collection("cache").doc("leaderboard_weekly").set(backupData);
    await db.collection("cache").doc("_test_weekly_backup").delete();
    const weekId = backupData.weekId;
    await db.collection("leaderboard_history").doc(weekId).delete();
    console.log(`[Cleanup] ✅ Restored leaderboard_weekly, deleted leaderboard_history/${weekId}`);
  } else {
    console.log("[Cleanup] No backup found. Deleting any leftover history...");
    const snap = await db.collection("leaderboard_history").get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
      console.log(`[Cleanup] ✅ Deleted leaderboard_history/${doc.id}`);
    }
  }

  // Cleanup any EMPTY_ docs
  const allCache = await db.collection("cache").get();
  for (const doc of allCache.docs) {
    if (doc.id.startsWith("EMPTY_")) {
      await doc.ref.delete();
    }
  }
}

const flag = process.argv[2];
if (flag === "--cleanup") {
  cleanup();
} else {
  runReset();
}
