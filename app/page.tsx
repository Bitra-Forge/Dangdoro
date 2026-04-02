"use client";

import { Space_Grotesk } from "next/font/google";
import { TimerCard } from "@/components/timer-card";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { LogIn, Zap } from "lucide-react";
import { signInGuest } from "@/lib/auth";
import { toast } from "sonner";
import { useTimerStore } from "@/lib/store";
import Image from "next/image";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});

export default function Home() {
  const { user, loading } = useAuth();
  const backgroundImage = useTimerStore((state) => state.backgroundImage);

  return (
    <div className={`flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden ${spaceGrotesk.variable} font-sans`}
      style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none transition-all duration-1000">
        <Image
          key={backgroundImage}
          src={`/Backgrounds/${backgroundImage}`}
          alt="Background"
          fill
          sizes="100vw"
          priority
          className="object-cover opacity-100 transition-all duration-1000 animate-in fade-in fill-mode-forwards"
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
