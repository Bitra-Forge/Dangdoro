"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Clock, TrendingUp, Zap } from "lucide-react";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});

interface ProfileStatsCardProps {
  user: any;
  rank: number;
}

export function ProfileStatsCard({ user, rank }: ProfileStatsCardProps) {
  if (!user) return null;

  const totalMinutes = user.totalMinutes || 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <div className={cn(
      "relative flex flex-col bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-[#C9B037]/40 hover:bg-white/[0.04] group animate-in fade-in slide-in-from-left-10",
      spaceGrotesk.variable,
      "font-sans"
    )}
      style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      
      {/* Top Gradient Bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9B037]/60 to-transparent" />
      
      {/* Dynamic Aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#C9B037]/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-[#C9B037]/10 transition-colors duration-700" />

      {/* Content */}
      <div className="relative flex flex-col items-center p-6 gap-5">
        {/* Avatar with Rank Badge */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-[#C9B037]/40 overflow-hidden transition-all duration-500 group-hover:border-[#C9B037]/80 group-hover:shadow-[0_0_30px_rgba(201,176,55,0.3)]">
            <Avatar className="w-full h-full rounded-none bg-transparent">
              <AvatarImage
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                className="object-cover w-full h-full"
              />
              <AvatarFallback className="bg-zinc-800 font-bold text-xl text-[#C9B037] rounded-none">{user.displayName?.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </div>
          {/* Rank Badge */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-950 border-2 border-[#C9B037]/60 flex items-center justify-center shadow-lg">
            <span className="text-xs font-black text-[#C9B037]">#{rank}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 w-full">
          {/* Focus Time */}
          <div className="flex-1 bg-white/[0.03] rounded-xl p-3 flex flex-col items-center justify-center border border-white/5 transition-all duration-500 hover:bg-white/[0.06] hover:border-[#C9B037]/20">
            <div className="flex items-baseline gap-0.5">
              {hours > 0 && <span className="text-lg font-sans font-black text-white">{hours}h</span>}
              <span className={cn("text-lg font-sans font-black", hours > 0 ? "text-[#C9B037]" : "text-white")}>{minutes}m</span>
            </div>
            <span className="text-[6px] font-black uppercase text-zinc-500 tracking-[0.15em] mt-1">Focus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
