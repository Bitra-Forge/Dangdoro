import type { Metadata } from "next";
import { Figtree, Geist_Mono, Noto_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/AuthProvider";
import { SoundEngine } from "@/components/SoundEngine";
import { TimerTicker } from "@/components/TimerTicker";
import { TimerPiPWidget } from "@/components/TimerPiPWidget";
import { GlobalAuthModal } from "@/components/GlobalAuthModal";
import { NavigationHub } from "@/components/navigation-hub";

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
          
          {/* Global timer components */}
          <TimerTicker />
          <TimerPiPWidget />
          
          {/* Audio & UI components */}
          <SoundEngine />
          <GlobalAuthModal />
          <NavigationHub />
          
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}