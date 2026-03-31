"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Zap, Clock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSessionHistory } from "@/lib/db";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay, subDays, isSameDay } from "date-fns";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";
import { AuthRequired } from "@/components/auth-required";

interface SessionData {
    id: string;
    userId: string;
    duration: number;
    completedAt?: { seconds: number; nanoseconds: number };
    type: string;
}

export default function StatsPage() {
    const { user, loading: authLoading } = useAuth();
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [userStats, setUserStats] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchData = async () => {
                setLoading(true);
                const history = await getSessionHistory(user.uid) as SessionData[];
                setSessions(history);

                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setUserStats(userDoc.data());
                }

                // Process data for chart (last 7 days)
                const last7Days = Array.from({ length: 7 }).map((_, i) => {
                    const date = subDays(new Date(), 6 - i);
                    return {
                        date: format(date, "EEE"),
                        fullDate: startOfDay(date),
                        minutes: 0,
                    };
                });

                history.forEach(session => {
                    if (session.completedAt) {
                        const sessionDate = new Date(session.completedAt.seconds * 1000);
                        const dayMatch = last7Days.find(d => isSameDay(d.fullDate, startOfDay(sessionDate)));
                        if (dayMatch) {
                            dayMatch.minutes += session.duration || 0;
                        }
                    }
                });

                setChartData(last7Days);
                setLoading(false);
            };
            fetchData();
        }
    }, [user]);

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (user?.isAnonymous) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Insights Restricted"
                        description="To visualize your long-term focus intensity and progress, you need a verified account."
                    />
                </main>
            </div>
        );
    }

    const stats = [
        { label: "Focus Minutes", value: userStats?.totalMinutes || 0, icon: Clock, color: "text-amber-400" },
        { label: "Total Sessions", value: userStats?.totalPomodoros || 0, icon: Zap, color: "text-purple-400" },
        { label: "Daily Avg", value: userStats?.totalPomodoros ? Math.round((userStats?.totalMinutes || 0) / userStats?.totalPomodoros) : 0, icon: TrendingUp, color: "text-sky-400" }
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
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">7-Day Focus Intensity</h2>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Feed</span>
                        </div>
                    </div>

                    <div className="h-80 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }}
                                    dy={10}
                                />
                                <YAxis
                                    hide
                                    domain={[0, 'auto']}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 12 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
                                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{payload[0].payload.date}</p>
                                                    <p className="text-lg font-black text-white italic tracking-tighter">
                                                        {payload[0].value} <span className="text-purple-500 text-[10px]">MINS</span>
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="minutes"
                                    radius={[8, 8, 8, 8]}
                                    barSize={40}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.minutes > 0 ? "rgb(168, 85, 247)" : "rgba(168, 85, 247, 0.1)"}
                                            style={{ filter: entry.minutes > 0 ? 'drop-shadow(0 0 12px rgba(168, 85, 247, 0.4))' : 'none' }}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {!loading && sessions.length > 0 && (
                    <div className="w-full max-w-4xl mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sessions.slice(0, 4).map((session) => (
                            <div key={session.id} className="flex items-center justify-between p-4 bg-zinc-900/40 border border-white/5 rounded-2xl group hover:border-white/10 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-purple-400 transition-colors">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white uppercase italic tracking-tighter">{session.duration}m Focus</p>
                                        <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">
                                            {session.completedAt?.seconds ? format(new Date(session.completedAt.seconds * 1000), "MMM d, p") : "Just now"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
