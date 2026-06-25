import type { Metadata } from "next";
import { Figtree, Geist_Mono, Noto_Serif, Ubuntu, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/AuthProvider";
import { SoundEngine } from "@/components/SoundEngine";
import { TimerTicker } from "@/components/TimerTicker";
import { GlobalAuthModal } from "@/components/GlobalAuthModal";
import { NavigationHub } from "@/components/navigation-hub";
import { NotificationsDock } from "@/components/notifications-dock";
import { Heartbeat } from "@/components/Heartbeat";
import { GroupSessionSync } from "@/components/group-session-sync";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";





const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

const ubuntu = Ubuntu({
  variable: "--font-ubuntu",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export { metadata } from "./metadata";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Dangdoro",
  description:
    "Focus. Compete. Win. — The ultimate real-time collaborative Pomodoro tracker. Join focus groups, sync timers with friends, listen to ambient sounds, and boost your productivity together.",
  url: "https://www.dangdoro.com",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  keywords: "Dangdoro, Pomodoro, pomodoro timer, collaborative focus, group pomodoro, pomodoro with friends, study with me, study with friends, shared study timer, online study room, virtual study space, real-time leaderboard, focus leaderboard, productivity tracker, time management, ADHD focus timer, ambient sounds mixer, lofi study timer, AI task planner, AI study assistant, dango, focus timer online, work with me, team productivity tool",
  featureList: [
    "Collaborative Pomodoro sessions",
    "Real-time synchronized group timer",
    "Global & Friends Leaderboard",
    "Ambient sound engine mixer",
    "AI-powered task planning assistant",
    "Visual dashboards & session history",
    "Friend requests & presence updates",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${geistMono.variable} ${notoSerif.variable} ${ubuntu.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white" suppressHydrationWarning>
        <AuthProvider>
          <NotificationsDock />

          {children}
          
           {/* Global timer components */}
           <GroupSessionSync />
           <TimerTicker />
          
          {/* Audio & UI components */}
          <SoundEngine />
          <GlobalAuthModal />
          <NavigationHub />
          
          <Toaster position="top-center" richColors closeButton duration={2000} />
          <Heartbeat />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
