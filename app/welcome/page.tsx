import { adminDb } from "@/lib/firebase-admin";
import WelcomeClient from "./welcome-client";

export const revalidate = 3600;

interface TickerData {
  users: number;
  hours: number;
  sessions: number;
}

async function getTicker(): Promise<TickerData> {
  try {
    const snap = await adminDb.collection("config").doc("ticker").get();
    if (!snap.exists) {
      return { users: 231, hours: 934, sessions: 1746 };
    }
    const data = snap.data();
    return {
      users: typeof data?.users === "number" ? data.users : 231,
      hours: typeof data?.hours === "number" ? data.hours : 934,
      sessions: typeof data?.sessions === "number" ? data.sessions : 1746,
    };
  } catch {
    return { users: 231, hours: 934, sessions: 1746 };
  }
}

export default async function WelcomePage() {
  const ticker = await getTicker();
  return <WelcomeClient ticker={ticker} />;
}
