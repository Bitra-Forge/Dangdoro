import GroupsClient from "./page.client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Groups",
  description: "Join or create synchronized Pomodoro focus groups to collaborate and focus together in real-time.",
};

export default function Page() {
  return <GroupsClient />;
}
