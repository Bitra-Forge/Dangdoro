import LeaderboardClient from "./page.client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "View global rankings and track growth progress of productivity units on Dangdoro.",
};

export default function Page() {
  return <LeaderboardClient />;
}
