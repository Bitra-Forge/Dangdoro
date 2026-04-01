"use client";

import { TimerCard } from "@/components/timer-card";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { LogIn, Zap } from "lucide-react";
import { signInGuest } from "@/lib/auth";
import { toast } from "sonner";
import Image from "next/image";
import bgImage from "@/components/Backgrounds/2.jpg";

export default function Home() {
  const { user, loading } = useAuth();

  const handleStartGuest = async () => {
    try {
      toast.loading("Initializing Guest Forge...", { id: "guest" });
      await signInGuest();
      toast.success("Guest session active!", { id: "guest" });
    } catch (error) {
      toast.error("Failed to start guest session.", { id: "guest" });
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
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
        <header className="flex flex-col items-center gap-4 text-center mb-8">
          {!loading && !user && (
            <div className="flex flex-col items-center gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                IDENTITY DETECTED: OFFLINE
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <Button
                  onClick={() => window.location.href = "/login"}
                  className="bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-xs px-8 h-14 rounded-2xl shadow-xl"
                >
                  <LogIn className="mr-2 h-4 w-4" /> Sign In with Google
                </Button>
                <Button
                  onClick={handleStartGuest}
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs px-8 h-14 rounded-2xl"
                >
                  <Zap className="mr-2 h-4 w-4" /> Continue as Guest
                </Button>
              </div>
            </div>
          )}
        </header>

        {(loading || user) && (
          <div className="w-full max-w-4xl flex items-center justify-center animate-in fade-in duration-700">
            <TimerCard />
          </div>
        )}
      </main>
    </div>
  );
}

