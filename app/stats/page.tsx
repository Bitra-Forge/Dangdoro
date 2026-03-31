"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Calendar, Zap, Clock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSessionHistory } from "@/lib/db";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";

export default function StatsPage() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<any[]>([]);
    const [userStats, setUserStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchData = async () => {
                setLoading(true);
                // Fetch sessions
                const history = await getSessionHistory(user.uid);
                setSessions(history);

                // Fetch user totals
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setUserStats(userDoc.data());
                }
                setLoading(false);
            };
            fetchData();
        }
    }, [user]);

    const stats = [
        { label: "Focus Minutes", value: userStats?.totalMinutes || 0, icon: Clock, color: "text-amber-400" },
        { label: "Total Sessions", value: userStats?.totalPomodoros || 0, icon: Zap, color: "text-purple-400" },
        { label: "Recent Activity", value: sessions.length > 0 ? "Active" : "None", icon: TrendingUp, color: "text-sky-400" }
    ];

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                <header className="flex flex-col items-center gap-4 text-center mb-12">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                            <BarChart3 className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white uppercase italic">Impact Metrics</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                        Your Focus Journey
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
                        Visualize your growth and consistency
                    </p>
                </header>

                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center group hover:bg-white/5 transition-all">
                            <stat.icon className={`w-8 h-8 ${stat.color} mb-4 group-hover:scale-110 transition-transform`} />
                            <span className="text-3xl font-black text-white">{stat.value}</span>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">{stat.label}</span>
                        </div>
                    ))}
                </div>

                <div className="w-full max-w-4xl bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Last 20 Sessions</h2>

                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600 font-bold uppercase tracking-widest text-xs">
                            No sessions recorded yet. Start focusing!
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div key={session.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white uppercase tracking-tighter italic text-sm">{session.duration} Minute Focus</p>
                                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                                                {session.completedAt?.seconds ? format(new Date(session.completedAt.seconds * 1000), "PPP p") : "Just now"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                        Completed
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
