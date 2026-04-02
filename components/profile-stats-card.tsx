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
      "flex flex-col items-center bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-[1rem] p-8 py-14 w-[240px] shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-all duration-500 hover:border-[#C9B037]/30 group animate-in fade-in slide-in-from-left-20",
      spaceGrotesk.variable,
      "font-sans"
    )}
      style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      {/* Avatar Section with Single Simple Ring - No internal gaps */}
      <div className="relative mb-10">
        <div className="w-22 h-22 rounded-full border border-[#C9B037]/40 transition-all duration-500 group-hover:border-[#C9B037]/80 overflow-hidden">
          <Avatar className="w-full h-full border-0 rounded-none">
            <AvatarImage
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
              className="object-cover w-full h-full"
            />
            <AvatarFallback className="bg-zinc-800 font-bold text-xl text-[#C9B037]">{user.displayName?.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="text-center mb-16">
        <h2 className="text-2xl font-sans font-bold text-[#C9B037] leading-tight mb-3">
          {user.displayName?.toLowerCase()}
        </h2>
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-[1px] bg-white/10" />
          <span className="text-[8px] font-black uppercase text-zinc-600 tracking-[0.3em]">Focus Master</span>
          <div className="w-6 h-[1px] bg-white/10" />
        </div>
      </div>

      {/* Vertical HUD Statistics Grid */}
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-zinc-950/40 rounded-[0.75rem] p-6 flex flex-col items-center justify-center border border-white/5 shadow-inner transition-colors duration-500 hover:bg-zinc-950/60 group/stat">
          <div className="p-2.5 rounded-[1rem] bg-[#C9B037]/5 mb-3 group-hover/stat:bg-[#C9B037]/10 transition-colors">
            <Clock className="w-5 h-5 text-[#C9B037]" />
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            {hours > 0 && <span className="text-xl font-sans font-bold text-white">{hours}h</span>}
            <span className={cn("text-xl font-sans font-bold", hours > 0 ? "text-[#C9B037]" : "text-white")}>{minutes}m</span>
          </div>
          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">FOCUS TIME</span>
        </div>

        <div className="bg-zinc-950/40 rounded-[0.75rem] p-6 flex flex-col items-center justify-center border border-white/5 shadow-inner transition-colors duration-500 hover:bg-zinc-950/60 group/stat">
          <div className="p-2.5 rounded-[1rem] bg-[#C9B037]/5 mb-3 group-hover/stat:bg-[#C9B037]/10 transition-colors">
            <Zap className="w-5 h-5 text-[#C9B037]" />
          </div>
          <span className="text-2xl font-sans font-bold text-white mb-0.5">{user.totalPomodoros || 0}</span>
          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] leading-tight">SESSIONS</span>
        </div>

        <div className="bg-zinc-950/40 rounded-[0.75rem] p-6 flex flex-col items-center justify-center border border-white/5 shadow-inner transition-colors duration-500 hover:bg-zinc-950/60 group/stat">
          <div className="p-2.5 rounded-[1rem] bg-[#C9B037]/5 mb-3 group-hover/stat:bg-[#C9B037]/10 transition-colors">
            <TrendingUp className="w-5 h-5 text-[#C9B037]" />
          </div>
          <span className="text-2xl font-sans font-bold text-white mb-1">#{rank}</span>
          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] leading-tight">Global Rank</span>
        </div>
      </div>
    </div>
  );
}
