import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const WHITELISTED_DOMAINS = [
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "googleusercontent.com",
  "api.dicebear.com",
  "firebasestorage.googleapis.com",
  "github.com",
  "githubusercontent.com",
  "avatars.githubusercontent.com",
  "localhost",
  "127.0.0.1"
];

export function isWhitelistedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return WHITELISTED_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

export function getHighQualityAvatarUrl(url: string | null | undefined, size: number = 96): string | undefined {
  if (!url) return undefined;
  
  // Google avatar URLs usually have size suffix like =s96-c or =s96.
  // We request custom size for better quality vs performance balance.
  if (url.includes("googleusercontent.com")) {
    return url.replace(/=s\d+(-c)?$/, `=s${size}-c`);
  }

  // GitHub avatar URLs can be sized using the `s` query parameter.
  if (url.includes("githubusercontent.com")) {
    if (url.includes("s=")) {
      return url.replace(/s=\d+/, `s=${size}`);
    }
    return url.includes("?") ? `${url}&s=${size}` : `${url}?s=${size}`;
  }

  return url;
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return hrs > 0 
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` 
    : `${pad(mins)}:${pad(secs)}`;
}

/**
 * Test Cases (Verified manually):
 * 
 * 1. Mid-week (Wednesday, June 10, 2026, 15:39:19 UTC):
 *    - getCurrentWeekId(new Date("2026-06-10T15:39:19Z"))
 *      => Expected: "2026-W23" (Anchored to most recent Friday, June 5, 2026)
 *    - getNextFridayMidnightUTC(new Date("2026-06-10T15:39:19Z"))
 *      => Expected: Date object for 2026-06-12T00:00:00.000Z
 *    - getTimeUntilReset(new Date("2026-06-10T15:39:19Z"))
 *      => Expected: "Resets in 1d 8h 20m"
 * 
 * 2. Exactly at Reset (Friday, June 12, 2026, 00:00:00 UTC):
 *    - getCurrentWeekId(new Date("2026-06-12T00:00:00Z"))
 *      => Expected: "2026-W24" (Anchored to Friday, June 12, 2026)
 *    - getNextFridayMidnightUTC(new Date("2026-06-12T00:00:00Z"))
 *      => Expected: Date object for 2026-06-19T00:00:00.000Z
 *    - getTimeUntilReset(new Date("2026-06-12T00:00:00Z"))
 *      => Expected: "Resets in 7d 0h 0m"
 * 
 * 3. Just before Reset (Thursday, June 11, 2026, 23:59:01 UTC - 59s remaining):
 *    - getTimeUntilReset(new Date("2026-06-11T23:59:01Z"))
 *      => Expected: "" (Less than 1 minute away)
 * 
 * 4. Just over 1 min before Reset (Thursday, June 11, 2026, 23:58:59 UTC - 61s remaining):
 *    - getTimeUntilReset(new Date("2026-06-11T23:58:59Z"))
 *      => Expected: "Resets in 1m"
 */

export function getCurrentWeekId(now: Date = new Date()): string {
  // Find the most recent Friday midnight UTC at or before now
  const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const currentDay = friday.getUTCDay();
  
  // (currentDay - 5 + 7) % 7 calculates how many days to subtract to get to Friday (5)
  friday.setUTCDate(friday.getUTCDate() - ((currentDay - 5 + 7) % 7));

  // Calculate ISO week number of this Friday
  // Set to nearest Thursday: current date + 4 - current day number (Sunday is 7)
  const target = new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const isoYear = target.getUTCFullYear();

  return `${isoYear}-W${weekNum.toString().padStart(2, "0")}`;
}

export function getNextFridayMidnightUTC(now: Date = new Date()): Date {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const currentDay = target.getUTCDay();
  
  // Calculate days to add to get to the next Friday (5)
  let daysToAdd = (5 - currentDay + 7) % 7;
  // If today is Friday, the next Friday reset is 7 days from now
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }
  
  target.setUTCDate(target.getUTCDate() + daysToAdd);
  return target;
}

export function getTimeUntilReset(now: Date = new Date()): string {
  const nextFriday = getNextFridayMidnightUTC(now);
  const diffMs = nextFriday.getTime() - now.getTime();
  
  if (diffMs < 60000) {
    return "";
  }
  
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  
  return `Resets in ${parts.join(" ")}`;
}


