import { adminDb } from "./firebase-admin";
import { getCurrentWeekId } from "./utils";

export async function buildAllTimeLeaderboard() {
  console.log("⏳ [Leaderboard Update] Querying all users for all-time leaderboard...");
  const usersSnapshot = await adminDb.collection("users").get();
  
  const players = usersSnapshot.docs
    .map(doc => {
      const data = doc.data();
      if (data.isAnonymous) return null;
      const rawPhoto: string | null = data.photoURL || null;
      const photoURL = rawPhoto && !rawPhoto.startsWith("data:")
        ? rawPhoto.slice(0, 2048)
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
    .filter(Boolean) as any[];

  players.sort((a, b) => {
    const diff = b.totalMinutes - a.totalMinutes;
    if (diff !== 0) return diff;
    return b.totalPomodoros - a.totalPomodoros;
  });

  const topPlayers = players.slice(0, 500);

  console.log("⏳ [Leaderboard Update] Writing all-time leaderboard to /cache/leaderboard_alltime...");
  await adminDb.collection("cache").doc("leaderboard_alltime").set({
    players: topPlayers,
    builtAt: new Date()
  }, { merge: true });

  return topPlayers;
}

export async function buildWeeklyLeaderboard() {
  const currentWeekId = getCurrentWeekId();
  console.log(`⏳ [Leaderboard Update] Querying weekly sessions for week ${currentWeekId}...`);
  
  const sessionsSnapshot = await adminDb.collection("sessions")
    .where("weekId", "==", currentWeekId)
    .where("status", "==", "completed")
    .get();
    
  const userMinutesMap: Record<string, number> = {};
  const userPomodorosMap: Record<string, number> = {};
  
  sessionsSnapshot.forEach(doc => {
    const data = doc.data();
    const userId = data.userId;
    const duration = data.duration || 0;
    if (userId && duration > 0) {
      userMinutesMap[userId] = (userMinutesMap[userId] || 0) + duration;
      userPomodorosMap[userId] = (userPomodorosMap[userId] || 0) + 1;
    }
  });

  console.log("⏳ [Leaderboard Update] Fetching all user profiles for weekly leaderboard matching...");
  const usersSnapshot = await adminDb.collection("users").get();
  const userProfileMap: Record<string, { displayName: string; photoURL: string | null; isAnonymous: boolean }> = {};
  
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    userProfileMap[doc.id] = {
      displayName: data.displayName || "Focus Hero",
      photoURL: data.photoURL || null,
      isAnonymous: !!data.isAnonymous
    };
  });

  const players = Object.entries(userMinutesMap)
    .map(([userId, minutes]) => {
      const profile = userProfileMap[userId];
      if (!profile || profile.isAnonymous) return null;
      
      const rawPhoto = profile.photoURL;
      const photoURL = rawPhoto && !rawPhoto.startsWith("data:")
        ? rawPhoto.slice(0, 2048)
        : null;
        
      return {
        id: userId,
        uid: userId,
        displayName: profile.displayName,
        photoURL,
        totalMinutes: minutes,
        totalPomodoros: userPomodorosMap[userId] || 0,
      };
    })
    .filter(Boolean) as any[];

  players.sort((a, b) => {
    const diff = b.totalMinutes - a.totalMinutes;
    if (diff !== 0) return diff;
    return b.totalPomodoros - a.totalPomodoros;
  });

  const topPlayers = players.slice(0, 500);

  console.log("⏳ [Leaderboard Update] Writing weekly leaderboard to /cache/leaderboard_weekly...");
  await adminDb.collection("cache").doc("leaderboard_weekly").set({
    players: topPlayers,
    weekId: currentWeekId,
    builtAt: new Date()
  }, { merge: true });

  return topPlayers;
}

export async function runLeaderboardUpdate() {
  const [allTimePlayers, weeklyPlayers] = await Promise.all([
    buildAllTimeLeaderboard(),
    buildWeeklyLeaderboard()
  ]);

  return { allTimePlayers, weeklyPlayers };
}
