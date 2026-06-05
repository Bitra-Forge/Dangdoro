if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  const globalAny = global as any;
  if (!globalAny.leaderboardInterval) {
    console.log("⏰ [Leaderboard Cron] Initializing interval (every 5 minutes)...");
    globalAny.leaderboardInterval = setInterval(async () => {
      const port = process.env.PORT || 3000;
      const origin = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`;
      const token = process.env.CRON_SECRET || "internal-cron-secret-key-12345";
      try {
        console.log("⏰ [Leaderboard Cron] Calling update API route...");
        const res = await fetch(`${origin}/api/update-leaderboard`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log(`⏰ [Leaderboard Cron] Response status: ${res.status}`);
      } catch (err) {
        console.error("⏰ [Leaderboard Cron] API call failed, running direct fallback update:", err);
        try {
          const { runLeaderboardUpdate } = await import("./leaderboard-updater");
          await runLeaderboardUpdate();
          console.log("⏰ [Leaderboard Cron] Fallback update completed successfully.");
        } catch (updateErr) {
          console.error("⏰ [Leaderboard Cron] Fallback update failed:", updateErr);
        }
      }
    }, 5 * 60 * 1000);
  }
}
