import { adminDb } from "./firebase-admin";

export async function runLeaderboardUpdate() {
  console.log("⏳ [Leaderboard Update] Querying all users from Firestore...");
  const usersSnapshot = await adminDb.collection("users").get();
  
  console.log(`⏳ [Leaderboard Update] Processing ${usersSnapshot.size} users...`);
  const players = usersSnapshot.docs
    .map(doc => {
      const data = doc.data();
      // Skip anonymous users — they don't appear on the public leaderboard
      if (data.isAnonymous) return null;
      // Truncate photoURL to avoid blowing past the 1 MB Firestore doc limit.
      // Data URLs (base64) are far too large and can't be safely truncated — skip them.
      const rawPhoto: string | null = data.photoURL || null;
      const photoURL = rawPhoto && !rawPhoto.startsWith("data:")
        ? rawPhoto.slice(0, 512)
        : null;
      return {
        id: doc.id,
        uid: doc.id,
        displayName: data.displayName || "Focus Hero",
        photoURL,
        totalMinutes: data.totalMinutes || 0,
        totalPomodoros: data.totalPomodoros || 0,
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof usersSnapshot.docs[0]["data"]>>[];

  // Sort by totalMinutes desc, then totalPomodoros desc
  players.sort((a, b) => {
    const diff = b.totalMinutes - a.totalMinutes;
    if (diff !== 0) return diff;
    return b.totalPomodoros - a.totalPomodoros;
  });

  // Limit cache to top 500 players to keep document size reasonable
  const topPlayers = players.slice(0, 500);

  console.log(`⏳ [Leaderboard Update] Writing pre-built leaderboard with ${topPlayers.length} players to /cache/leaderboard...`);
  await adminDb.collection("cache").doc("leaderboard").set({
    players: topPlayers,
    updatedAt: new Date().toISOString()
  });

  console.log("✅ [Leaderboard Update] /cache/leaderboard updated successfully.");
  return topPlayers;
}
