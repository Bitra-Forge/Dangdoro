"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Zap, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSessionHistory } from "@/lib/db";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay, subDays, isSameDay, subMonths, startOfMonth, isSameMonth } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Disable SSR for the chart to avoid dimension warnings during hydration
const ChartContainer = dynamic(
    () => import("recharts").then((mod) => mod.ResponsiveContainer),
    { ssr: false }
);

type TimeRange = "week" | "month" | "year";

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
    const [weekData, setWeekData] = useState<any[]>([]);
    const [monthData, setMonthData] = useState<any[]>([]);
    const [yearData, setYearData] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>("week");
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // Lazy Sync: Ensure guest profile exists so we can fetch their stats
                if (user.isAnonymous) {
                    const { syncUserProfile } = await import("@/lib/db");
                    await syncUserProfile(user);
                }

                const history = await getSessionHistory(user.uid) as SessionData[];
                setSessions(history);

                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setUserStats(userDoc.data());
                }

                // Process data for week chart (last 7 days)
                const last7Days = Array.from({ length: 7 }).map((_, i) => {
                    const date = subDays(new Date(), 6 - i);
                    return {
                        date: format(date, "EEE"),
                        fullDate: startOfDay(date),
                        minutes: 0,
                    };
                });

                // Process data for month chart (last 30 days)
                const last30Days = Array.from({ length: 30 }).map((_, i) => {
                    const date = subDays(new Date(), 29 - i);
                    return {
                        date: format(date, "d"),
                        tooltipLabel: format(date, "d MMM"),
                        fullDate: startOfDay(date),
                        minutes: 0,
                    };
                });

                // Process data for year chart (last 12 months)
                const last12Months = Array.from({ length: 12 }).map((_, i) => {
                    const date = subMonths(new Date(), 11 - i);
                    return {
                        date: format(date, "MMM"),
                        fullDate: startOfMonth(date),
                        minutes: 0,
                    };
                });

                history.forEach(session => {
                    if (session.completedAt) {
                        const sessionDate = new Date(session.completedAt.seconds * 1000);

                        // Week data
                        const dayMatch = last7Days.find(d => isSameDay(d.fullDate, startOfDay(sessionDate)));
                        if (dayMatch) {
                            dayMatch.minutes += session.duration || 0;
                        }

                        // Month data
                        const monthDayMatch = last30Days.find(d => isSameDay(d.fullDate, startOfDay(sessionDate)));
                        if (monthDayMatch) {
                            monthDayMatch.minutes += session.duration || 0;
                        }

                        // Year data
                        const monthMatch = last12Months.find(d => isSameMonth(d.fullDate, sessionDate));
                        if (monthMatch) {
                            monthMatch.minutes += session.duration || 0;
                        }
                    }
                });

                setWeekData(last7Days);
                setMonthData(last30Days);
                setYearData(last12Months);
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, authLoading]);

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!user || user.isAnonymous) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Insights Locked"
                        description="Sign in to your account to visualize your focus intensity and secure your long-term progress records. Guest data is temporary."
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            {timeRange === "week" && "7-Day Focus Intensity"}
                            {timeRange === "month" && "30-Day Focus Intensity"}
                            {timeRange === "year" && "12-Month Focus Intensity"}
                        </h2>
                        <div className="flex items-center gap-2">
                            {/* Time Range Tabs */}
                            <div className="flex items-center bg-zinc-950/50 p-1 rounded-xl border border-white/5">
                                {[
                                    { id: "week", label: "Week" },
                                    { id: "month", label: "Month" },
                                    { id: "year", label: "Year" }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setTimeRange(tab.id as TimeRange)}
                                        className={cn(
                                            "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                            timeRange === tab.id
                                                ? "bg-purple-500 text-white"
                                                : "text-zinc-500 hover:text-white"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-80 min-h-[320px] w-full mt-4 relative">
                        <ChartContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={1}>
                            <BarChart data={timeRange === "week" ? weekData : timeRange === "month" ? monthData : yearData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }}
                                    dy={10}
                                    interval={timeRange === "month" ? 4 : 0}
                                />
                                <YAxis
                                    hide
                                    domain={[0, 'auto']}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 12 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const label = payload[0].payload.tooltipLabel || payload[0].payload.date;
                                            return (
                                                <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
                                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
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
                                    barSize={timeRange === "month" ? 12 : timeRange === "year" ? 30 : 40}
                                >
                                    {(timeRange === "week" ? weekData : timeRange === "month" ? monthData : yearData).map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.minutes > 0 ? "rgb(168, 85, 247)" : "rgba(168, 85, 247, 0.1)"}
                                            style={{ filter: entry.minutes > 0 ? 'drop-shadow(0 0 12px rgba(168, 85, 247, 0.4))' : 'none' }}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>
                </div>

                {user && user.isAnonymous && (
                    <div className="w-full max-w-4xl mt-16 p-6 bg-purple-500/5 border border-purple-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-purple-400" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Persistence Protocol</h3>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Guest stats are temporary. Connect with Google to secure your focus history permanently.
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => window.location.href = "/profile"}
                            className="h-12 px-8 rounded-xl bg-purple-500 text-white hover:bg-purple-400 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/20 whitespace-nowrap"
                        >
                            Secure History
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
