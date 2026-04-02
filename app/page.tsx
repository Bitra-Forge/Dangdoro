"use client";

import { Space_Grotesk } from "next/font/google";
import { TimerCard } from "@/components/timer-card";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { LogIn, Zap } from "lucide-react";
import { signInGuest } from "@/lib/auth";
import { toast } from "sonner";
import Image from "next/image";
import bgImage from "@/components/Backgrounds/BG25.png";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className={`flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden ${spaceGrotesk.variable} font-sans`} 
         style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <Image
          src={bgImage}
          alt="Background"
          fill
          priority
          className="object-cover opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950/40" />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
        <header className="flex flex-col items-center gap-4 text-center mb-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)]">
              <div className="w-4 h-4 bg-sky-500 rounded-sm" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white uppercase italic">Dangdoro</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
            Focus. Compete. Win.
          </h1>
        </header>

        <div className="w-full max-w-4xl flex items-center justify-center animate-in fade-in duration-700">
          <TimerCard />
        </div>
      </main>
    </div>
  );
}
