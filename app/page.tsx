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

        <div className="w-full max-w-4xl flex items-center justify-center animate-in fade-in duration-700">
          <TimerCard />
        </div>
      </main>
    </div>
  );
}
