"use client";

import { useEffect, useState } from "react";
import { Trophy, Zap, Clock, Medal } from "lucide-react";
import { getLeaderboard } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { AuthRequired } from "@/components/auth-required";

export default function LeaderboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTops = async () => {
            setLoading(true);
            const tops = await getLeaderboard(20);
            setPlayers(tops);
            setLoading(false);
        };
        fetchTops();
    }, []);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (user?.isAnonymous) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Ranks Hidden"
                        description="Join the global focus elite. Connect your account to see the full leaderboard and claim your spot."
                    />
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                <header className="flex flex-col items-center gap-4 text-center mb-12">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                            <Trophy className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white uppercase italic">Hall of Flame</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                        The Focus Masters
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
                        Top contributors to the focus engine
                    </p>
                </header>

                <div className="w-full max-w-3xl bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-6 md:p-12 shadow-2xl overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Recalibrating Streaks...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {players.map((player, index) => (
                                <div
                                    key={player.id}
                                    className={cn(
                                        "group flex items-center gap-4 p-5 rounded-3xl transition-all duration-500 border border-transparent",
                                        index === 0 && "bg-amber-500/10 border-amber-500/20 shadow-2xl scale-[1.02]",
                                        index === 1 && "bg-zinc-400/5 border-zinc-400/10",
                                        index === 2 && "bg-orange-700/5 border-orange-700/10",
                                        index > 2 && "hover:bg-white/5"
                                    )}
                                >
                                    <div className="w-10 text-center font-black text-zinc-700 group-hover:text-white transition-colors">
                                        {index === 0 ? <Medal className="w-8 h-8 text-amber-400" /> : index + 1}
                                    </div>

                                    <Avatar className="w-12 h-12 border-2 border-white/10 p-0.5 group-hover:border-white/30 transition-all">
                                        <AvatarImage src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`} />
                                        <AvatarFallback className="bg-zinc-800 font-bold">{player.displayName?.slice(0, 2)}</AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1">
                                        <p className="font-black text-white italic uppercase tracking-tighter text-lg leading-tight">
                                            {player.displayName}
                                        </p>
                                        <p className={cn(
                                            "text-[10px] font-black uppercase tracking-widest",
                                            player.isAnonymous ? "text-zinc-600" : "text-emerald-500"
                                        )}>
                                            {player.isAnonymous ? "Guest Focuser" : "Verified Hero"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-6 px-4">
                                        <div className="text-center">
                                            <p className="text-xl font-black text-white leading-none">{player.totalPomodoros || 0}</p>
                                            <Zap className="w-3 h-3 text-amber-400 mx-auto mt-1" />
                                        </div>
                                        <div className="text-center hidden md:block">
                                            <p className="text-xl font-black text-zinc-500 leading-none">{player.totalMinutes || 0}</p>
                                            <Clock className="w-3 h-3 text-zinc-600 mx-auto mt-1" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
