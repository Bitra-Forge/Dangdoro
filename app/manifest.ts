import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dangdoro - Collaborative Pomodoro & Real-time Leaderboard",
    short_name: "Dangdoro",
    description:
      "Focus. Compete. Win. — The ultimate real-time collaborative Pomodoro tracker. Join focus groups, sync timers with friends, listen to ambient sounds, and boost your productivity together.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ef4444",
    icons: [
      {
        src: "/icon.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
