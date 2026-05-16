import type { Metadata } from "next";
import { Figtree, Geist_Mono, Noto_Serif, Ubuntu } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/AuthProvider";
import { SoundEngine } from "@/components/SoundEngine";
import { TimerTicker } from "@/components/TimerTicker";
import { GlobalAuthModal } from "@/components/GlobalAuthModal";
import { NavigationHub } from "@/components/navigation-hub";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Heartbeat } from "@/components/Heartbeat";
import { GroupSessionSync } from "@/components/group-session-sync";


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
      className={`${figtree.variable} ${geistMono.variable} ${notoSerif.variable} ${ubuntu.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white">
        <AuthProvider>
          <div className="fixed top-8 right-8 z-[100] flex flex-col items-center gap-4">
            <NotificationsMenu />
          </div>

          {children}
          
           {/* Global timer components */}
           <GroupSessionSync />
           <TimerTicker />
          
          {/* Audio & UI components */}
          <SoundEngine />
          <GlobalAuthModal />
          <NavigationHub />
          
          <Toaster position="top-center" richColors closeButton />
          <Heartbeat />
        </AuthProvider>
      </body>
    </html>
  );
}
