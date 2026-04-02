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
      "flex flex-col items-center bg-white/[0.01] backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-8 py-12 w-[240px] shadow-[0_30px_100px_rgba(0,0,0,0.4)] transition-all duration-700 hover:border-[#C9B037]/40 hover:bg-white/[0.03] group animate-in fade-in slide-in-from-left-20",
      spaceGrotesk.variable,
      "font-sans"
    )}
      style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
      
      {/* Dynamic Aura behind Avatar */}
      <div className="absolute top-10 w-32 h-32 bg-[#C9B037]/5 blur-[40px] rounded-full pointer-events-none group-hover:bg-[#C9B037]/10 transition-colors duration-700" />

      {/* Avatar Section */}
      <div className="relative mb-10">
        <div className="w-22 h-22 rounded-full border border-white/10 transition-all duration-500 group-hover:border-[#C9B037]/40 ring-1 ring-inset ring-transparent group-hover:ring-[#C9B037]/20 p-0 overflow-hidden">
          <div className="w-full h-full rounded-full border border-[#C9B037]/60 overflow-hidden">
            <Avatar className="w-full h-full border-0 rounded-none bg-transparent">
              <AvatarImage
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                className="object-cover w-full h-full"
              />
              <AvatarFallback className="bg-zinc-800 font-bold text-xl text-[#C9B037]">{user.displayName?.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      <div className="text-center mb-14">
        <h2 className="text-xl font-sans font-bold text-white tracking-tight leading-tight mb-2 uppercase group-hover:text-[#C9B037] transition-colors">
          {user.displayName}
        </h2>
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-[1px] bg-[#C9B037]/30" />
          <span className="text-[7px] font-black uppercase text-[#C9B037]/60 tracking-[0.4em]">Elite Tiller</span>
          <div className="w-4 h-[1px] bg-[#C9B037]/30" />
        </div>
      </div>

      {/* Vertical HUD Statistics Grid */}
      <div className="flex flex-col gap-4 w-full">
        {/* Stat Block: Focus Time */}
        <div className="bg-white/[0.03] rounded-[1rem] p-5 flex flex-col items-center justify-center border border-white/5 transition-all duration-500 hover:bg-white/[0.06] hover:border-[#C9B037]/20 group/stat">
          <div className="flex items-baseline gap-1 mb-0.5">
            {hours > 0 && <span className="text-xl font-sans font-black text-white">{hours}h</span>}
            <span className={cn("text-xl font-sans font-black", hours > 0 ? "text-[#C9B037]" : "text-white")}>{minutes}m</span>
          </div>
          <span className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em]">FOCUS TIME</span>
        </div>

        {/* Stat Block: Sessions */}
        <div className="bg-white/[0.03] rounded-[1rem] p-5 flex flex-col items-center justify-center border border-white/5 transition-all duration-500 hover:bg-white/[0.06] hover:border-[#C9B037]/20 group/stat">
          <span className="text-2xl font-sans font-black text-white mb-0.5 group-hover/stat:text-[#C9B037] transition-colors">{user.totalPomodoros || 0}</span>
          <span className="text-[8px] font-black uppercase text-zinc-500 tracking-[0.2em] leading-tight">TOTAL SESSIONS</span>
        </div>

        {/* Stat Block: Global Rank */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#C9B037]/10 to-transparent rounded-[1rem] p-5 flex flex-col items-center justify-center border border-[#C9B037]/20 transition-all duration-500 hover:from-[#C9B037]/20">
          <div className="absolute -top-10 -right-10 w-20 h-20 bg-[#C9B037]/10 blur-2xl rounded-full" />
          <span className="text-2xl font-sans font-black text-[#C9B037] mb-0.5 drop-shadow-[0_0_10px_rgba(201,176,55,0.3)]">#{rank}</span>
          <span className="text-[8px] font-black uppercase text-[#C9B037]/80 tracking-[0.2em] leading-tight">Rank Position</span>
        </div>
      </div>
    </div>
  );
}
