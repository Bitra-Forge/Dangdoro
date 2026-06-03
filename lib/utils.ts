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

export function getHighQualityAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  // Google avatar URLs usually have size suffix like =s96-c or =s96.
  // We request a larger size (e.g., 384px) for better quality.
  if (url.includes("googleusercontent.com")) {
    return url.replace(/=s\d+(-c)?$/, "=s384-c");
  }

  // GitHub avatar URLs can be sized using the `s` query parameter.
  if (url.includes("githubusercontent.com")) {
    if (url.includes("s=")) {
      return url.replace(/s=\d+/, "s=384");
    }
    return url.includes("?") ? `${url}&s=384` : `${url}?s=384`;
  }

  return url;
}

