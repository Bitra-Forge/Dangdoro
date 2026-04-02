import type { Metadata } from "next";
import { Figtree, Geist_Mono, Noto_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";   // Sonner toast
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/navigation";
import { QuickActionsNav } from "@/components/quick-actions-nav";
import { BackgroundPanel } from "../components/background-panel";

import { TimerTicker } from "@/components/TimerTicker";

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

export const metadata: Metadata = {
  title: "Dangdoro",
  description: "Focus. Compete. Win. — Real-time Pomodoro Leaderboard",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${geistMono.variable} ${notoSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        <AuthProvider>
          {children}
          <TimerTicker />

          {/* Main Navigation Hub */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-4 w-full justify-center pointer-events-none">
            <div className="flex items-center gap-4 pointer-events-auto relative px-1">
              <BackgroundPanel />
              <QuickActionsNav />
              <Navigation />
            </div>
          </div>


          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}