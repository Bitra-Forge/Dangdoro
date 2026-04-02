"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Zap, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSessionHistory } from "@/lib/db";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay, subDays, isSameDay, subMonths, startOfMonth, isSameMonth } from "date-fns";
import {
    AreaChart,
    Area,
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

// Silence Recharts dimension warnings globally on this page to ensure a clean console
if (typeof window !== 'undefined') {
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
        if (typeof args[0] === 'string' &&
            (args[0].includes('The width(0) and height(0)') ||
                args[0].includes('The width(-1) and height(-1)'))) {
            return;
        }
        originalWarn(...args);
    };
}

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

    const chartData = timeRange === "week" ? weekData : timeRange === "month" ? monthData : yearData;

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-16 pb-16 px-4 w-full flex-1 max-w-5xl mx-auto">
                <header className="flex flex-col items-center gap-2 text-center mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                            <BarChart3 className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-xl font-black tracking-tight text-white uppercase italic">Impact Metrics</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                        Your Focus Journey
                    </h1>
                </header>

                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col items-center text-center group hover:bg-white/5 transition-all">
                            <stat.icon className={`w-6 h-6 ${stat.color} mb-2 group-hover:scale-110 transition-transform`} />
                            <span className="text-2xl font-black text-white">{stat.value}</span>
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{stat.label}</span>
                        </div>
                    ))}
                </div>

                <div className="w-full bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h2 className="text-lg font-black text-white uppercase italic tracking-tighter">
                            {timeRange === "week" && "7-Day Focus Intensity"}
                            {timeRange === "month" && "30-Day Focus Intensity"}
                            {timeRange === "year" && "12-Month Focus Intensity"}
                        </h2>
                        <div className="flex items-center gap-2">
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
                                            "px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                            timeRange === tab.id
                                                ? "bg-purple-500 text-white"
                                                : "text-zinc-500 hover:text-white"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-[420px] min-h-[420px] w-full mt-4 relative group/chart">
                        {mounted && (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={chartData} key={timeRange} margin={{ top: 5, right: 20, left: 20, bottom: 10 }}>
                                    <defs>
                                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900 }}
                                        dy={10}
                                        interval={timeRange === "month" ? 4 : 0}
                                        minTickGap={timeRange === "year" ? 0 : 5}
                                    />
                                    <YAxis
                                        hide
                                        domain={[0, 'auto']}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: 'rgba(168, 85, 247, 0.2)', strokeWidth: 2 }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const label = payload[0].payload.tooltipLabel || payload[0].payload.date;
                                                return (
                                                    <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl relative overflow-hidden group">
                                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] pointer-events-none" />
                                                        <div className="relative z-10">
                                                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                                                <Calendar className="w-3 h-3" />
                                                                {label}
                                                            </p>
                                                            <div className="flex items-baseline gap-2">
                                                                <p className="text-3xl font-black text-white italic tracking-tighter drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                                                                    {payload[0].value}
                                                                </p>
                                                                <span className="text-purple-500 font-black text-xs uppercase italic">Minutes</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="minutes"
                                        stroke="#a855f7"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorMinutes)"
                                        animationBegin={0}
                                        animationDuration={1500}
                                        animationEasing="ease-in-out"
                                        activeDot={{
                                            r: 6,
                                            fill: "#a855f7",
                                            stroke: "#fff",
                                            strokeWidth: 2,
                                            style: { filter: 'drop-shadow(0_0_8px_rgba(168,85,247,0.8))' }
                                        }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
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
