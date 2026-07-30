import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "Dangdoro - Collaborative Pomodoro & Real-time Leaderboard",
    template: "%s | Dangdoro",
  },
  description:
    "Focus. Compete. Win. — The ultimate real-time collaborative Pomodoro tracker. Join focus groups, sync timers with friends, listen to ambient sounds, and boost your productivity together.",
  metadataBase: new URL("https://www.dangdoro.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Dangdoro - Collaborative Pomodoro & Real-time Leaderboard",
    description:
      "Focus. Compete. Win. — The ultimate real-time collaborative Pomodoro tracker. Join focus groups, sync timers with friends, listen to ambient sounds, and boost your productivity together.",
    url: "https://www.dangdoro.com",
    siteName: "Dangdoro",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dangdoro - Collaborative Pomodoro & Real-time Leaderboard",
    description:
      "Focus. Compete. Win. — The ultimate real-time collaborative Pomodoro tracker. Join focus groups, sync timers with friends, listen to ambient sounds, and boost your productivity together.",
  },
  keywords: [
    "Dangdoro",
    "Pomodoro",
    "pomodoro timer",
    "collaborative focus",
    "group pomodoro",
    "pomodoro with friends",
    "study with me",
    "study with friends",
    "shared study timer",
    "online study room",
    "virtual study space",
    "real-time leaderboard",
    "focus leaderboard",
    "productivity tracker",
    "time management",
    "ADHD focus timer",
    "ambient sounds mixer",
    "lofi study timer",
    "AI task planner",
    "AI study assistant",
    "dango",
    "focus timer online",
    "work with me",
    "team productivity tool",
  ],
  authors: [{ name: "Dangdoro Team" }],
  creator: "Dangdoro",
  publisher: "Dangdoro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

