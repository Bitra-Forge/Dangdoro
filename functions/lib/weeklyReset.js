"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyReset = void 0;
exports.buildAllTimeLeaderboard = buildAllTimeLeaderboard;
exports.buildWeeklyLeaderboard = buildWeeklyLeaderboard;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
// Self-contained week ID helper
function getCurrentWeekId(now = new Date()) {
    const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const currentDay = friday.getUTCDay();
    friday.setUTCDate(friday.getUTCDate() - ((currentDay - 5 + 7) % 7));
    const target = new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const isoYear = target.getUTCFullYear();
    return `${isoYear}-W${weekNum.toString().padStart(2, "0")}`;
}
async function buildAllTimeLeaderboard(db) {
    logger.log("⏳ [Leaderboard Update] Querying all users for all-time leaderboard...");
    const usersSnapshot = await db.collection("users").get();
    const players = usersSnapshot.docs
        .map(doc => {
        const data = doc.data();
        if (data.isAnonymous)
            return null;
        const rawPhoto = data.photoURL || null;
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
        .filter(Boolean);
    players.sort((a, b) => {
        const diff = b.totalMinutes - a.totalMinutes;
        if (diff !== 0)
            return diff;
        return b.totalPomodoros - a.totalPomodoros;
    });
    const topPlayers = players.slice(0, 500);
    logger.log("⏳ [Leaderboard Update] Writing all-time leaderboard to /cache/leaderboard_alltime...");
    await db.collection("cache").doc("leaderboard_alltime").set({
        players: topPlayers,
        builtAt: new Date()
    }, { merge: true });
    return topPlayers;
}
async function buildWeeklyLeaderboard(db) {
    const currentWeekId = getCurrentWeekId();
    logger.log(`⏳ [Leaderboard Update] Querying weekly sessions for week ${currentWeekId}...`);
    const sessionsSnapshot = await db.collection("sessions")
        .where("weekId", "==", currentWeekId)
        .where("status", "==", "completed")
        .get();
    const userMinutesMap = {};
    const userPomodorosMap = {};
    sessionsSnapshot.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        const duration = data.duration || 0;
        if (userId && duration > 0) {
            userMinutesMap[userId] = (userMinutesMap[userId] || 0) + duration;
            userPomodorosMap[userId] = (userPomodorosMap[userId] || 0) + 1;
        }
    });
    logger.log("⏳ [Leaderboard Update] Fetching all user profiles for weekly leaderboard matching...");
    const usersSnapshot = await db.collection("users").get();
    const userProfileMap = {};
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
        if (!profile || profile.isAnonymous)
            return null;
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
        .filter(Boolean);
    players.sort((a, b) => {
        const diff = b.totalMinutes - a.totalMinutes;
        if (diff !== 0)
            return diff;
        return b.totalPomodoros - a.totalPomodoros;
    });
    const topPlayers = players.slice(0, 500);
    logger.log("⏳ [Leaderboard Update] Writing weekly leaderboard to /cache/leaderboard_weekly...");
    await db.collection("cache").doc("leaderboard_weekly").set({
        players: topPlayers,
        weekId: currentWeekId,
        builtAt: new Date()
    }, { merge: true });
    return topPlayers;
}
exports.weeklyReset = (0, scheduler_1.onSchedule)("0 0 * * 5", async (event) => {
    const db = admin.firestore();
    logger.log("[Weekly Reset] Starting scheduled reset process...");
    // 1. Get the weekId that just ended (previous week)
    // Run it relative to 5 minutes ago to ensure we capture the correct week context
    const previousWeekId = getCurrentWeekId(new Date(Date.now() - 5 * 60 * 1000));
    logger.log(`[Weekly Reset] Previous week ID identified: ${previousWeekId}`);
    // Calculate start/end times for the previous week
    const thisFriday = new Date();
    thisFriday.setUTCHours(0, 0, 0, 0);
    const lastFriday = new Date(thisFriday.getTime() - 7 * 24 * 60 * 60 * 1000);
    try {
        // Check if the history document already exists
        const historyRef = db.collection("leaderboard_history").doc(previousWeekId);
        const historySnap = await historyRef.get();
        if (historySnap.exists) {
            logger.log(`[Weekly Reset] leaderboard_history/${previousWeekId} already exists. Skipping archive write.`);
        }
        else {
            // 2. Read /cache/leaderboard_weekly
            const weeklyCacheRef = db.collection("cache").doc("leaderboard_weekly");
            const weeklyCacheSnap = await weeklyCacheRef.get();
            if (weeklyCacheSnap.exists) {
                const weeklyData = weeklyCacheSnap.data();
                if (weeklyData && weeklyData.weekId === previousWeekId) {
                    const players = weeklyData.players || [];
                    // Take top 10 only
                    const top10 = players.slice(0, 10);
                    logger.log(`[Weekly Reset] Archiving top 10 players for ${previousWeekId}...`);
                    await historyRef.set({
                        weekId: previousWeekId,
                        weekStart: admin.firestore.Timestamp.fromDate(lastFriday),
                        weekEnd: admin.firestore.Timestamp.fromDate(thisFriday),
                        players: top10,
                        frozenAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    logger.log(`[Weekly Reset] Successfully archived ${previousWeekId} to history.`);
                }
                else {
                    logger.warn(`[Weekly Reset] /cache/leaderboard_weekly weekId (${weeklyData?.weekId}) does not match expected previous weekId (${previousWeekId}). Skipping archive.`);
                }
            }
            else {
                logger.warn("[Weekly Reset] /cache/leaderboard_weekly not found. Skipping archive.");
            }
        }
    }
    catch (error) {
        logger.error("❌ [Weekly Reset] Archive stage failed. Aborting reset process:", error);
        // Throw error so we do NOT proceed to steps 3 and 4
        throw error;
    }
    // 3. Trigger buildWeeklyLeaderboard() for the new week
    // 4. Trigger buildAllTimeLeaderboard()
    try {
        logger.log("[Weekly Reset] Triggering buildWeeklyLeaderboard & buildAllTimeLeaderboard in parallel...");
        await Promise.all([
            buildAllTimeLeaderboard(db),
            buildWeeklyLeaderboard(db)
        ]);
        logger.log("[Weekly Reset] Successfully rebuilt all leaderboards for the new week.");
    }
    catch (rebuildError) {
        logger.error("❌ [Weekly Reset] Rebuild stage failed (cron safety net will handle this):", rebuildError);
    }
});
//# sourceMappingURL=weeklyReset.js.map