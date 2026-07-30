"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Users, Target, Trophy } from "lucide-react";
import { cn, getHighQualityAvatarUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMinutes, fmtElapsed, getGoalTypeLabel, toMillis } from "@/lib/groups";
import Image from "next/image";
import { useRouter } from "next/navigation";

export const ParticipantsTab = memo(function ParticipantsTab({ group, sortedMembers, user, isAdmin, onManageRoles, onInvite, goalHours = 0, goalType = "weekly" }: any) {
    const [memberNowMs, setMemberNowMs] = useState(Date.now());
    const router = useRouter();

    useEffect(() => {
        const hasLiveMembers = sortedMembers.some((m: any) => m.isFocusing);
        if (!hasLiveMembers) return;
        const t = setInterval(() => setMemberNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, [sortedMembers]);

    const activeOrPausedMembers = sortedMembers.filter((m: any) => m.isFocusing);

    const rankedMembers = useMemo(() => {
        return [...sortedMembers].sort((a: any, b: any) => (b.totalMinutes || 0) - (a.totalMinutes || 0));
    }, [sortedMembers]);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
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
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">{getGoalTypeLabel(goalType)} Goal</span>
                                <span className="text-sm font-black text-white leading-none">{goalHours}h</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Active Now</h4>
                {activeOrPausedMembers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {activeOrPausedMembers.map((m: any, i: number) => (
                            <motion.div
                                key={`active-${m.uid}`}
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
                        <div className="w-16 h-16 rounded-full bg-zinc-800/40 flex items-center justify-center mx-auto text-zinc-600"><Users className="w-8 h-8" /></div>
                        <p className="text-sm text-zinc-500 font-medium">No one is currently focusing in this unit.</p>
                    </div>
                )}
            </div>

            <div className="space-y-8 pt-4 border-t border-white/5">
                <div className="flex items-center gap-6 justify-center">
                    <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Rankings</h4>
                    <div className="h-[1px] w-16 bg-gradient-to-l from-transparent via-zinc-800 to-transparent" />
                </div>

                {rankedMembers.length === 0 ? (
                    <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                        <div className="w-16 h-16 rounded-full bg-zinc-800/40 flex items-center justify-center mx-auto text-zinc-600"><Trophy className="w-8 h-8" /></div>
                        <p className="text-sm text-zinc-500 font-medium">There are no members in this unit.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-5xl mx-auto">
                        {rankedMembers.map((player: any, i: number) => {
                            const rank = i + 1;
                            const isGold = rank === 1;
                            const isSilver = rank === 2;
                            const isBronze = rank === 3;
                            return (
                                <motion.div
                                    key={player.uid}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: i * 0.03 }}
                                >
                                    {isGold || isSilver || isBronze ? (
                                        <PodiumCard m={player} rank={rank} isMe={player.uid === user.uid} isGold={isGold} isSilver={isSilver} isBronze={isBronze} />
                                    ) : (
                                        <RankCard m={player} rank={rank} isMe={player.uid === user.uid} />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
});

const PodiumCard = memo(function PodiumCard({ m, rank, isMe, isGold, isSilver, isBronze }: any) {
    const router = useRouter();
    const totalMinutes = m.totalMinutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return (
        <button onClick={() => router.push(`/profile?user=${m.uid}`)} className={cn(
            "relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-300 group rounded-[1.5rem] shadow-lg w-full cursor-pointer min-h-[160px]",
            isGold ? "bg-gradient-to-b from-zinc-800 to-yellow-900/20 border border-yellow-500/50 shadow-yellow-500/10" :
            isSilver ? "bg-gradient-to-b from-zinc-800 to-slate-700/20 border border-slate-400/30 shadow-slate-400/5" :
            "bg-gradient-to-b from-zinc-800 to-orange-900/20 border border-orange-700/30 shadow-orange-700/5"
        )}>
            {isGold && <div className="absolute -top-16 -left-16 w-40 h-40 bg-yellow-500/15 blur-[80px] pointer-events-none" />}
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-zinc-900/80 border border-zinc-700 flex items-center justify-center z-10">
                <span className={cn(
                    "text-xs font-black",
                    isGold ? "text-[#C9B037]" : isSilver ? "text-slate-300" : "text-orange-400"
                )}>{rank}</span>
            </div>
            <div className="flex flex-col items-center z-10 w-full px-4 mt-3">
                <Avatar className={cn(
                    "w-11 h-11 border-2 mb-2 pointer-events-none",
                    isGold ? "border-[#C9B037] shadow-[0_0_15px_rgba(201,176,55,0.3)]" : isSilver ? "border-slate-400" : "border-orange-600"
                )}>
                    <AvatarImage src={getHighQualityAvatarUrl(m.photoURL)} />
                    <AvatarFallback className="text-base bg-zinc-800">{m.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <h4 className={cn(
                    "text-sm font-bold mb-0.5 truncate w-full",
                    isGold ? "text-[#C9B037]" : isSilver ? "text-slate-200" : "text-orange-200"
                )}>
                    {isMe ? "You" : m.displayName}
                </h4>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">{m.role}</p>
            </div>
            <div className="mt-auto w-full p-2.5 border-t border-white/5 bg-black/20">
                <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Total Time</p>
                <p className={cn(
                    "text-xs font-bold tabular-nums",
                    isGold ? "text-[#C9B037]" : isSilver ? "text-slate-300" : "text-orange-400"
                )}>
                    {hours > 0 ? `${hours}h ` : ""}{minutes}m
                </p>
            </div>
        </button>
    );
});

const RankCard = memo(function RankCard({ m, rank, isMe }: any) {
    const router = useRouter();
    const totalMinutes = m.totalMinutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return (
        <button onClick={() => router.push(`/profile?user=${m.uid}`)} className="relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-300 group rounded-[1.5rem] bg-zinc-950/60 border border-white/5 hover:border-white/20 min-h-[160px] w-full cursor-pointer">
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center z-10">
                <span className="text-xs font-black text-zinc-400">{rank}</span>
            </div>
            <div className="flex flex-col items-center z-10 w-full px-4 mt-3">
                <Avatar className="w-10 h-10 border-2 border-zinc-800 mb-2 pointer-events-none">
                    <AvatarImage src={m.photoURL} />
                    <AvatarFallback className="text-base bg-zinc-800">{m.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <h4 className="text-xs font-bold text-white mb-0.5 truncate w-full">{isMe ? "You" : m.displayName}</h4>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">{m.role}</p>
            </div>
            <div className="mt-auto w-full p-2.5 border-t border-white/5 bg-black/20">
                <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Total Time</p>
                <p className="text-xs font-bold text-zinc-400 tabular-nums">
                    {hours > 0 ? `${hours}h ` : ""}{minutes}m
                </p>
            </div>
        </button>
    );
});

const UserCard = memo(function UserCard({ m, isMe, memberNowMs }: any) {
    const elapsedText = useMemo(() => {
        if (!m.isFocusing || !m.liveSessionStartedAt) return null;
        const startedMs = toMillis(m.liveSessionStartedAt);
        if (!startedMs) return null;

        const isPaused = m.sessionStatus === "paused";
        let endMs = memberNowMs;
        if (isPaused) {
            endMs = toMillis(m.liveSessionPausedAt) || toMillis(m.liveSessionLastHeartbeat) || Date.now();
        }

        return fmtElapsed(Math.max(0, Math.floor((endMs - startedMs) / 1000)));
    }, [m.isFocusing, m.liveSessionStartedAt, m.sessionStatus, m.liveSessionPausedAt, m.liveSessionLastHeartbeat, memberNowMs]);

    const isLive = m.isFocusing && m.sessionStatus !== "paused";
    const isPaused = m.isFocusing && m.sessionStatus === "paused";
    return (
        <div className={cn(
            "relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-300 group rounded-[1.5rem]",
            isLive ? "bg-white/[0.03] border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.15)] min-h-[180px]" : isPaused ? "bg-white/[0.03] border border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.15)] min-h-[180px]" : "bg-zinc-950/60 border border-white/5 opacity-70 hover:opacity-100 min-h-[160px]"
        )}>
            {isLive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <span className="text-[8px] font-black uppercase text-cyan-400 tracking-widest leading-none">Live</span>
                </div>
            )}
            {isPaused && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                    <span className="text-[8px] font-black uppercase text-amber-400 tracking-widest leading-none">Paused</span>
                </div>
            )}

            <div className="flex flex-col items-center z-10 w-full px-4 mt-4">
                <Avatar className={cn(
                    "w-12 h-12 border-2 mb-2 transition-all duration-500",
                    isLive ? "border-cyan-500 shadow-lg shadow-cyan-500/20" : isPaused ? "border-amber-500 shadow-lg shadow-amber-500/20" : "border-zinc-800"
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
                {isLive || isPaused ? (
                    <>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Session Timer</p>
                        <p className={cn(
                            "text-base font-black tabular-nums tracking-tight",
                            isPaused ? "text-amber-400" : "text-white"
                        )}>{elapsedText || "0s"}</p>
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
