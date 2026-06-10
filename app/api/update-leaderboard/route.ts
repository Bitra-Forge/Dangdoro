import { NextResponse } from "next/server";
import { runLeaderboardUpdate } from "@/lib/leaderboard-updater";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const expectedToken = process.env.CRON_SECRET || "internal-cron-secret-key-12345";
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      console.warn("⚠️ [Leaderboard API] Unauthorized update attempt.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allTimePlayers } = await runLeaderboardUpdate();
    return NextResponse.json({ success: true, count: allTimePlayers.length });
  } catch (error: any) {
    console.error("❌ [Leaderboard API] Update failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
