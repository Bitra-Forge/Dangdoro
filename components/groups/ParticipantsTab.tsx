"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Users, Target, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMinutes, fmtElapsed } from "@/lib/groups";

export const ParticipantsTab = memo(function ParticipantsTab({ group, sortedMembers, user, isAdmin, onManageRoles, onInvite, goalHours = 0 }: any) {
    const [memberNowMs, setMemberNowMs] = useState(Date.now());

    useEffect(() => {
        const hasLiveMembers = sortedMembers.some((m: any) => m.isFocusing);
        if (!hasLiveMembers) return;
        const t = setInterval(() => setMemberNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, [sortedMembers]);

    const liveMembers = sortedMembers.filter((m: any) => m.isFocusing);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Top area with stats and actions */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/5">
                <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tighter">Participants</h3>
                        <p className="text-zinc-500 text-xs mt-0.5 font-bold">Manage and view unit members.</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {goalHours > 0 && (
                        <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-3 min-w-[120px]">
                            <Target className="w-4 h-4 text-cyan-500/70" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Weekly Goal</span>
                                <span className="text-sm font-black text-white leading-none">{goalHours}h</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {liveMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {liveMembers.map((m: any, i: number) => (
                        <motion.div 
                            key={m.uid}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                        >
                            <UserCard m={m} isMe={m.uid === user.uid} memberNowMs={memberNowMs} />
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600"><Users className="w-8 h-8" /></div>
                    <p className="text-sm text-zinc-500 font-medium">No one is currently focusing in this unit.</p>
                </div>
            )}
        </div>
    );
});

const UserCard = memo(function UserCard({ m, isMe, memberNowMs }: any) {
    const elapsedText = useMemo(() => {
        if (!m.isFocusing || !m.liveSessionStartedAt) return null;
        let startedMs = 0;
        const ts = m.liveSessionStartedAt;
        if (typeof ts === "number") startedMs = ts;
        else if (ts instanceof Date) startedMs = ts.getTime();
        else if (ts.seconds) startedMs = ts.seconds * 1000;
        else return null;
        return fmtElapsed(Math.max(0, Math.floor((memberNowMs - startedMs) / 1000)));
    }, [m.isFocusing, m.liveSessionStartedAt, memberNowMs]);

    const isLive = m.isFocusing;
    return (
        <div className={cn(
            "relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-300 group rounded-[1.5rem]",
            isLive ? "bg-white/[0.03] border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.15)] min-h-[180px]" : "bg-zinc-950/60 border border-white/5 opacity-70 hover:opacity-100 min-h-[160px]"
        )}>
            {isLive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <span className="text-[8px] font-black uppercase text-cyan-400 tracking-widest leading-none">Live</span>
                </div>
            )}

            <div className="flex flex-col items-center z-10 w-full px-4 mt-4">
                <Avatar className={cn(
                    "w-12 h-12 border-2 mb-2 transition-all duration-500",
                    isLive ? "border-cyan-500 shadow-lg shadow-cyan-500/20" : "border-zinc-800"
                )}>
                    <AvatarImage src={m.photoURL} />
                    <AvatarFallback className="text-lg bg-zinc-800">{m.displayName?.[0]}</AvatarFallback>
                </Avatar>
                
                <h4 className="text-sm font-bold text-white mb-0.5 truncate w-full">{isMe ? "You" : m.displayName}</h4>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    {m.role}
                </p>
            </div>
            
            <div className="mt-auto w-full p-3 border-t border-white/5 bg-black/20">
                {isLive ? (
                    <>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Session Timer</p>
                        <p className="text-base font-black text-white tabular-nums tracking-tight">{elapsedText || "0s"}</p>
                    </>
                ) : (
                    <>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Total Time</p>
                        <p className="text-xs font-bold text-zinc-400 tabular-nums">{fmtMinutes(m.totalMinutes || 0)}</p>
                    </>
                )}
            </div>
        </div>
    );
});
