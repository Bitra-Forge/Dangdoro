"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { logOut } from "@/lib/auth";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadProfilePicture, updateProfilePictureBase64, getSessionHistory, updateUserProfile } from "@/lib/db";
import {
    Camera, Shield, Zap, Clock, Calendar, LogOut,
    Trophy, Share2, Pencil, Activity, Award, Flame,
    Lock, Star, TrendingUp, Info, CheckCircle2, BarChart3
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, startOfDay, subDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, isSameMonth, subWeeks, startOfWeek, isSameWeek } from "date-fns";
import { toast } from "sonner";
import { AuthRequired } from "@/components/auth-required";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { BackgroundTheme } from "@/components/background-theme";
import {
    ComposedChart,
    Bar,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

// --- Themes ---
const THEMES: Record<string, { name: string; colors: string[]; accent: string; glow: string; text?: string }> = {
    daybreak: {
        name: "Daybreak",
        colors: ["#9B8EC7", "#BDA6CE", "#F2EAE0"],
        accent: "#F2EAE0",
        glow: "rgba(242, 234, 224, 0.2)"
    },
    cinematic: {
        name: "Cinematic",
        colors: ["#522546", "#88304E", "#E23E57"],
        accent: "#E23E57",
        glow: "rgba(226, 62, 87, 0.2)"
    },
    teal: {
        name: "Deep Teal Sea",
        colors: ["#024959", "#026773", "#3CA6A6"],
        accent: "#3CA6A6",
        glow: "rgba(60, 166, 166, 0.2)"
    },
    meadow: {
        name: "Emerald Meadow",
        colors: ["#A2CB8B", "#C7EABB", "#E8F5BD"],
        accent: "#E8F5BD",
        glow: "rgba(232, 245, 189, 0.2)"
    }
};

// --- Types ---
type TimeRange = "days" | "weeks" | "months";

interface SessionData {
    id: string;
    userId: string;
    duration: number;
    completedAt?: { seconds: number; nanoseconds: number };
    type: string;
}

// --- Components ---

const StatCard = ({ icon: Icon, label, value, colorClass, delay = 0, horizontal = false, lottie = null }: any) => {
    const getThemeAnimations = () => {
        if (colorClass.includes('red')) return {
            glow: "rgba(239,68,68,0.15)",
            accent: "#ef4444",
            particles: "bg-red-500",
        };
        if (colorClass.includes('amber')) return {
            glow: "rgba(245,158,11,0.15)",
            accent: "#f59e0b",
            particles: "bg-amber-500",
        };
        if (colorClass.includes('sky')) return {
            glow: "rgba(14,165,233,0.15)",
            accent: "#0ea5e9",
            particles: "bg-sky-500",
        };
        return {
            glow: "rgba(168,85,247,0.15)",
            accent: "#a855f7",
            particles: "bg-purple-500",
        };
    };

    const theme = getThemeAnimations();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover="hover"
            transition={{ delay: 0.2 + delay, duration: 0.8 }}
            className={cn(
                "relative group bg-zinc-900/10 backdrop-blur-2xl border border-white/5 rounded-[5px] flex shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer",
                horizontal ? "flex-row items-center p-4 gap-4" : "flex-col items-center text-center p-4"
            )}
        >
            {/* 1. Static Inner Glow Effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />
            </div>

            {/* 2. Theme Specific Ambient Glow */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 blur-[30px] -z-10"
                style={{ backgroundColor: theme.glow }}
            />

            {/* 3. Dynamic Particle Themes */}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 overflow-hidden">
                {lottie && (
                    <div className={cn(
                        "absolute inset-0 pointer-events-none transition-opacity duration-700 overflow-hidden",
                        colorClass.includes('red') ? "opacity-80 group-hover:opacity-100" : "opacity-30 group-hover:opacity-50"
                    )}>
                        <div className={cn(
                            "absolute right-0 top-1/2 -translate-y-1/2 h-full transition-all duration-700",
                            colorClass.includes('red') ? "-rotate-90 translate-x-[28%]" : "left-0 w-full h-full flex items-center justify-center scale-[1.6]"
                        )}>
                            <DotLottieReact
                                src={lottie}
                                autoplay
                                loop
                                style={{
                                    height: '100%',
                                    width: 'auto',
                                    mixBlendMode: colorClass.includes('red') ? 'screen' : 'normal',
                                }}
                            />
                        </div>
                    </div>
                )}
                {colorClass.includes('red') && [...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            x: [0, -140 - Math.random() * 60],
                            y: [(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 80],
                            opacity: [0, 0.6, 0],
                            scale: [1.2, 0.2]
                        }}
                        transition={{
                            duration: 1.2 + Math.random() * 0.8,
                            repeat: Infinity,
                            delay: i * 0.1,
                            ease: "easeOut"
                        }}
                        className="absolute right-0 w-1 h-1 bg-orange-400 rounded-full blur-[0.6px]"
                        style={{ top: `${(i * 100) / 24}%`, mixBlendMode: 'screen' }}
                    />
                ))}
            </div>

            {/* Free-Floating Icon with Unique Animation */}
            <motion.div
                variants={{
                    hover: colorClass.includes('sky') ? { rotate: 360 } :
                        colorClass.includes('amber') ? { x: [0, -1, 1, -1, 1, 0] } :
                            { scale: 1.15 }
                }}
                transition={{ duration: colorClass.includes('sky') ? 1.5 : 0.2 }}
                className={cn(
                    "transition-all duration-500 shrink-0 relative z-10 flex items-center justify-center",
                    horizontal ? "" : "mb-4"
                )}
            >
                <Icon
                    className="transition-all duration-500"
                    style={{
                        width: horizontal ? 16 : 24,
                        height: horizontal ? 16 : 24,
                        color: theme.accent,
                        filter: `drop-shadow(0 0 8px ${theme.accent})`
                    }}
                />
            </motion.div>

            <div className={cn("flex flex-col min-w-0 pr-1 relative z-10", horizontal ? "items-start text-left" : "items-center")}>
                <span className={cn(
                    "font-black text-white tracking-tighter tabular-nums mb-0.5 drop-shadow-sm leading-none whitespace-nowrap transition-all duration-500",
                    horizontal ? "text-lg" : "text-2xl",
                    "group-hover:drop-shadow-[0_0_10px_white]"
                )}>
                    {value}
                </span>
                <span className="text-[8.5px] font-black text-zinc-500 uppercase tracking-[0.15em] group-hover:text-zinc-300 transition-all duration-500 leading-none truncate w-full">
                    {label}
                </span>
            </div>

            {/* Reactive Corner */}
            <div className={cn(
                "absolute bottom-1 right-1 w-2 h-2 border-r border-b border-white/10 rounded-br-[1px] transition-all duration-500",
                "group-hover:border-white/40 group-hover:w-3 group-hover:h-3"
            )} />

            {/* Top Gloss Line */}
            <motion.div
                className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
        </motion.div>
    );
};

const formatFocusedTime = (totalMinutes: number) => {
    if (totalMinutes < 60) return `${totalMinutes}m`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

const ProductivitySquare = ({ level, theme }: { level: number, theme: any }) => {
    // level: 0, 1, 2, 3
    const colorIndex = level - 1;
    const bgColor = level === 0 ? "bg-white/[0.03]" : "";

    return (
        <div
            className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-700 relative group/sq",
                bgColor
            )}
            style={{
                backgroundColor: colorIndex !== -1 ? theme.colors[colorIndex] : undefined,
                boxShadow: colorIndex !== -1 ? `0 0 10px ${theme.colors[colorIndex]}44` : undefined
            }}
        >
            {level > 0 && (
                <div
                    className="absolute inset-0 blur-[2px] opacity-0 group-hover/sq:opacity-50 transition-opacity"
                    style={{ backgroundColor: theme.colors[colorIndex] }}
                />
            )}
        </div>
    );
};

// --- Page ---

export default function ProfilePage() {
    const { user, loading: authLoading, openAuthVault } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Cropping State
    const [image, setImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [showCropper, setShowCropper] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editNickname, setEditNickname] = useState("");
    const [editBio, setEditBio] = useState("");
    const [selectedTheme, setSelectedTheme] = useState("daybreak");
    const [isSaving, setIsSaving] = useState(false);

    // Stats State
    const [weekData, setWeekData] = useState<any[]>([]);
    const [monthData, setMonthData] = useState<any[]>([]);
    const [yearData, setYearData] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>("days");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { setLoading(false); return; }

        const fetchData = async () => {
            setLoading(true);
            if (user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }

            // Sync user data
            const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);
                    // Pre-fill edit state
                    setEditName(data.displayName || "");
                    setEditNickname(data.nickname || "");
                    setEditBio(data.bio || "");
                    if (data.profileTheme) {
                        const themeKey = data.profileTheme.toLowerCase();
                        setSelectedTheme(THEMES[themeKey] ? themeKey : "daybreak");
                    }
                }
                setLoading(false);
            });

            // Sync sessions info for grid & streak
            const history = (await getSessionHistory(user.uid, 365)) as SessionData[];
            setSessions(history);

            // Fetch stats data
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                // Stats cards removed, skipping setUserStats
            }

            // Process data for "Days" chart (last 7 days - daily granularity)
            const last7Days = Array.from({ length: 7 }).map((_, i) => {
                const date = subDays(new Date(), 6 - i);
                return {
                    date: format(date, "EEE"),
                    tooltipLabel: format(date, "iiii, d MMM"),
                    fullDate: startOfDay(date),
                    minutes: 0,
                };
            });

            // Process data for "Weeks" chart (last 8 weeks - weekly granularity)
            const last8Weeks = Array.from({ length: 8 }).map((_, i) => {
                const date = subWeeks(new Date(), 7 - i);
                const sOW = startOfWeek(date);
                return {
                    date: `W${format(date, "w")}`,
                    tooltipLabel: `Week of ${format(sOW, "MMM d")}`,
                    fullDate: sOW,
                    minutes: 0,
                };
            });

            // Process data for "Months" chart (last 12 months - monthly granularity)
            const last12Months = Array.from({ length: 12 }).map((_, i) => {
                const date = subMonths(new Date(), 11 - i);
                return {
                    date: format(date, "MMM"),
                    tooltipLabel: format(date, "MMMM yyyy"),
                    fullDate: startOfMonth(date),
                    minutes: 0,
                };
            });

            history.forEach((session: SessionData) => {
                if (session.completedAt) {
                    const sessionDate = new Date(session.completedAt.seconds * 1000);

                    // Days
                    const dayMatch = last7Days.find(d => isSameDay(d.fullDate, startOfDay(sessionDate)));
                    if (dayMatch) {
                        dayMatch.minutes += session.duration || 0;
                    }

                    // Weeks
                    const weekMatch = last8Weeks.find(w => isSameWeek(w.fullDate, sessionDate));
                    if (weekMatch) {
                        weekMatch.minutes += session.duration || 0;
                    }

                    // Months
                    const monthMatch = last12Months.find(m => isSameMonth(m.fullDate, sessionDate));
                    if (monthMatch) {
                        monthMatch.minutes += session.duration || 0;
                    }
                }
            });

            setWeekData(last7Days);
            setMonthData(last8Weeks);
            setYearData(last12Months);

            return unsub;
        };

        let unsubscribe: (() => void) | undefined;
        fetchData().then(unsub => { unsubscribe = unsub; });
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, authLoading]);

    // --- Calculations ---

    const streakCount = useMemo(() => {
        if (!sessions.length) return 0;
        const sortedDates = [...new Set(sessions.map(s => startOfDay(s.completedAt.toDate()).getTime()))]
            .sort((a, b) => b - a);

        let streak = 0;
        let today = startOfDay(new Date());
        let currentRef = today;

        // Check if user has focused today or yesterday to continue the streak
        const lastSessionDate = new Date(sortedDates[0]);
        if (differenceInDays(today, lastSessionDate) > 1) return 0;

        for (let i = 0; i < sortedDates.length; i++) {
            const date = new Date(sortedDates[i]);
            const diff = differenceInDays(currentRef, date);

            if (diff <= 1) {
                streak++;
                currentRef = date;
            } else {
                break;
            }
        }
        return streak;
    }, [sessions]);

    const productivityData = useMemo(() => {
        const days = 140; // 20 weeks
        const grid = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i);
            const daySessions = sessions.filter(s => isSameDay(s.completedAt.toDate(), date));
            const totalMins = daySessions.reduce((acc, curr) => acc + curr.duration, 0);
            let level = 0;
            if (totalMins > 0) {
                if (totalMins < 30) level = 1;
                else if (totalMins < 120) level = 2;
                else level = 3;
            }

            grid.push({
                date,
                level,
                minutes: totalMins,
                tooltip: `${format(date, 'MMM d')}: ${formatFocusedTime(totalMins)} focused`
            });
        }
        return grid;
    }, [sessions]);

    const monthDays = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const days = eachDayOfInterval({ start, end });

        // Add padding for the first day of the week
        const firstDayShift = getDay(start);
        const padding = Array(firstDayShift).fill(null);

        return [
            ...padding,
            ...days.map(date => ({
                date,
                isToday: isSameDay(date, now),
                hasActivity: sessions.some(s => isSameDay(s.completedAt.toDate(), date)),
                day: format(date, 'd')
            }))
        ];
    }, [sessions]);

    // --- Handlers ---

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const objectUrl = URL.createObjectURL(file);
        setImage(objectUrl);
        setShowCropper(true);
    };

    const onCropComplete = (_: any, pixels: any) => setCroppedAreaPixels(pixels);

    const handleUploadCropped = async () => {
        if (!image || !croppedAreaPixels || !user) return;
        try {
            toast.loading("Forging identity...", { id: "upload" });
            const base64Image = await getCroppedImgBase64(image, croppedAreaPixels);
            if (!base64Image) throw new Error();
            await updateProfilePictureBase64(user.uid, base64Image);
            toast.success("Updated!", { id: "upload" });
            setShowCropper(false);
            if (image.startsWith('blob:')) URL.revokeObjectURL(image);
            setImage(null);
        } catch (error) { toast.error("Failed.", { id: "upload" }); }
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserProfile(user.uid, {
                displayName: editName,
                nickname: editNickname,
                bio: editBio,
                profileTheme: selectedTheme
            });
            toast.success("Profile saved!");
            setIsEditing(false);
        } catch (e) {
            toast.error("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const getCroppedImgBase64 = async (imageSrc: string, pixelCrop: any): Promise<string | null> => {
        const img = new Image();
        img.src = imageSrc;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // High quality scale
        canvas.width = 512;
        canvas.height = 512;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            img,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            512,
            512
        );
        return canvas.toDataURL("image/jpeg", 0.92);
    };

    // --- Render ---

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden" style={{ fontFamily: '__nextjs-Geist' }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Identity Locked"
                        description="Forge your permanent profile to track streaks and productivity history."
                    />
                </main>
            </div>
        );
    }

    const currentTheme = THEMES[selectedTheme] || THEMES.daybreak;

    return (
        <BackgroundTheme>
            <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-x-hidden" style={{ fontFamily: '__nextjs-Geist' }}>

                {/* Immersive Background Elements */}
                <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-screen pointer-events-none z-0">
                    <div
                        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse-slow transition-colors duration-1000"
                        style={{ backgroundColor: `${currentTheme.accent}11` }}
                    />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                </div>

                <main className="relative z-10 flex flex-col items-center pb-32 px-6 w-full flex-1 max-w-6xl mx-auto pt-20">

                    {/* --- IDENTITY HUB --- */}
                    <section className="w-full flex flex-col lg:flex-row items-center lg:items-start gap-12 mb-20 px-2 relative">
                        <div className="flex-1 flex flex-col md:flex-row items-center md:items-start gap-12 w-full">

                            {/* Avatar & Actions Side */}
                            <div className="flex flex-col items-center gap-6 shrink-0 z-20">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                    className="relative group flex items-center"
                                >
                                    {/* Theme Picker - Left Side of Avatar when Editing */}
                                    <AnimatePresence>
                                        {isEditing && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="absolute right-full mr-8 flex flex-col gap-4 items-center"
                                            >
                                                <div className="flex flex-col gap-3">
                                                    {Object.entries(THEMES).map(([id, t]) => (
                                                        <button
                                                            key={id}
                                                            onClick={() => setSelectedTheme(id)}
                                                            className={cn(
                                                                "w-10 h-10 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center gap-0.5 overflow-hidden group/theme",
                                                                selectedTheme === id
                                                                    ? "border-white/40 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                                                    : "border-white/5 bg-zinc-950/50 hover:border-white/20"
                                                            )}
                                                        >
                                                            <div className="flex gap-0.5">
                                                                {t.colors.slice(-2).map((c, i) => (
                                                                    <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                                                                ))}
                                                            </div>
                                                            <span className="text-[6px] font-black uppercase tracking-tighter text-zinc-600 group-hover/theme:text-zinc-400">
                                                                {t.name.split(' ')[0]}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <div className="relative group">
                                        {/* Atmospheric Glow - Multilayered for strength */}
                                        <div
                                            className="absolute -inset-12 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-1000 blur-[100px] pointer-events-none z-0"
                                            style={{ backgroundColor: `${currentTheme.accent}25` }}
                                        />
                                        <div
                                            className="absolute -inset-4 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 blur-[40px] pointer-events-none z-0"
                                            style={{ backgroundColor: `${currentTheme.accent}40` }}
                                        />

                                        <Avatar
                                            className="w-40 h-40 md:w-48 md:h-48 rounded-[2.2rem] border border-white/10 relative z-10 overflow-hidden transition-all duration-500 group-hover:border-white/30"
                                        >
                                            <AvatarImage
                                                src={userData?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                                                className="object-cover w-full h-full scale-100 group-hover:scale-105 transition-transform duration-[2s] ease-out rounded-[2.2rem]"
                                            />
                                            <AvatarFallback className="bg-zinc-900 font-black text-6xl text-white rounded-[2.2rem] transition-all group-hover:bg-zinc-800">
                                                {user.displayName?.charAt(0) || "D"}
                                            </AvatarFallback>

                                            {isEditing && (
                                                <label className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer z-30">
                                                    <Camera className="w-10 h-10 text-white mb-3" />
                                                    <span className="text-[10px] font-black tracking-widest uppercase">Update Scan</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                                </label>
                                            )}
                                        </Avatar>
                                    </div>
                                </motion.div>

                                {/* Action Buttons Container - Perfectly aligned under Avatar */}
                                {!isEditing && (
                                    <div className="flex flex-col gap-2.5 w-32 md:w-40 items-center z-30">
                                        <motion.div
                                            whileHover={{ y: -2 }}
                                            whileTap={{ y: 0 }}
                                            className="w-full"
                                        >
                                            <Button
                                                onClick={() => setIsEditing(true)}
                                                className="w-full h-9 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white font-black text-[9px] tracking-widest transition-all border border-white/20 relative shadow-xl overflow-hidden group/btn cursor-pointer"
                                            >
                                                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] -translate-x-full group-hover/btn:animate-shine transition-transform" />
                                                <div className="flex items-center justify-center gap-2 relative z-10 uppercase">
                                                    <Pencil className="w-2.5 h-2.5" />
                                                    Edit Profile
                                                </div>
                                            </Button>
                                        </motion.div>

                                        <motion.div
                                            whileHover={{ y: -1 }}
                                            whileTap={{ y: 0 }}
                                            className="w-full"
                                        >
                                            <Button
                                                variant="ghost"
                                                className="w-full h-9 rounded-full border border-white/5 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all backdrop-blur-xl group/btn relative overflow-hidden text-[9px] font-black tracking-widest cursor-pointer"
                                            >
                                                <div className="flex items-center justify-center gap-2 uppercase relative z-10">
                                                    <Share2 className="w-2.5 h-2.5 transition-transform group-hover/btn:rotate-12" />
                                                    Share Vault
                                                </div>
                                            </Button>
                                        </motion.div>
                                    </div>
                                )}
                            </div>

                            {/* Text Identity Section */}
                            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left pt-4 h-full">
                                {isEditing ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center md:items-start gap-6 w-full max-w-xl"
                                    >
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            placeholder="Identity Name"
                                            className="bg-transparent border-b border-white/10 text-4xl md:text-5xl font-black text-white tracking-tighter focus:outline-none focus:border-white/30 transition-all w-full py-1 h-16 uppercase"
                                        />

                                        <textarea
                                            value={editBio}
                                            onChange={e => setEditBio(e.target.value)}
                                            placeholder="System Architect | Digital Curator"
                                            rows={2}
                                            className="bg-transparent border-b border-white/5 text-sm font-medium text-zinc-400 leading-relaxed focus:outline-none focus:border-white/20 transition-all w-full py-2 resize-none scrollbar-none [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                        />

                                        <div className="flex items-center gap-4 mt-4">
                                            <Button
                                                onClick={handleSaveProfile}
                                                disabled={isSaving}
                                                className="h-12 px-10 rounded-2xl bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all flex items-center gap-2"
                                            >
                                                {isSaving ? "Syncing..." : "Commit Changes"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={() => setIsEditing(false)}
                                                className="h-12 px-8 rounded-2xl border border-white/10 text-zinc-400 font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
                                            >
                                                Abort
                                            </Button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex flex-col items-center md:items-start w-full max-w-2xl"
                                    >
                                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-4 uppercase drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] mt-2">
                                            {userData?.displayName || "New Pilot"}
                                        </h1>

                                        <p className="text-zinc-400 text-sm md:text-base font-medium leading-[1.8] mb-14 max-w-2xl break-all">
                                            {userData?.bio || "System Architect and Digital Curator focusing on high-fidelity procedural environments and neural interface aesthetics. Architecting the void since 2024."}
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats Column - Custom Stacked Layout */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="grid grid-cols-2 gap-3 w-full lg:w-[360px] shrink-0"
                        >
                            {/* Streak: Spans 2x width (top) - Horizontal */}
                            <div className="col-span-2">
                                <StatCard
                                    icon={Flame}
                                    label="Combustion Streak"
                                    value={`${streakCount} Days`}
                                    colorClass="bg-red-500"
                                    delay={0.1}
                                    horizontal={true}
                                />
                            </div>

                            {/* Middle row: Two horizontal cards side-by-side */}
                            <StatCard
                                icon={Zap}
                                label="Sessions"
                                value={userData?.totalPomodoros || 0}
                                colorClass="bg-amber-500"
                                delay={0.2}
                                horizontal={true}
                                lottie="https://lottie.host/744101ff-3133-4079-924b-56b7ba413dc2/cG4FlIP6px.lottie"
                            />
                            <StatCard
                                icon={Clock}
                                label="Active Uptime"
                                value={formatFocusedTime(userData?.totalMinutes || 0)}
                                colorClass="bg-sky-500"
                                delay={0.3}
                                horizontal={true}
                                lottie="https://lottie.host/6d8cee47-05d6-4d85-a3e4-34ab0969f50f/OmVO7S6zrr.lottie"
                            />

                            {/* Deployment: Spans 2x width (bottom) - Horizontal */}
                            <div className="col-span-2">
                                <StatCard
                                    icon={Calendar}
                                    label="Joined since"
                                    value={userData?.createdAt?.seconds ? format(new Date(userData.createdAt.seconds * 1000), "MMM yyyy") : "---"}
                                    colorClass="bg-purple-500"
                                    delay={0.4}
                                    horizontal={true}
                                />
                            </div>
                        </motion.div>
                    </section>

                    {/* --- OPERATIONAL SUBSTRATE (Bento Grid) --- */}
                    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                        {/* Neural Activity (Heatmap) */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 0.8 }}
                            className="lg:col-span-8 bg-zinc-900/10 backdrop-blur-3xl border border-white/5 rounded-[10px] p-10 flex flex-col shadow-2xl relative overflow-hidden group"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" style={{ backgroundImage: `linear-gradient(to right, transparent, ${currentTheme.accent}33, transparent)` }} />

                            <div className="flex items-center justify-between mb-10 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-[10px] bg-zinc-900 border border-white/5 shadow-inner transition-colors" style={{ borderColor: `${currentTheme.accent}11` }}>
                                        <Activity className="w-5 h-5 group-hover:animate-pulse" style={{ color: currentTheme.accent }} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Neural Activity</h3>
                                        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Focus density over past 140 cycles</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-zinc-950/50 px-4 py-2 rounded-[10px] border border-white/5">
                                    <span className="text-[9px] uppercase text-zinc-600 font-extrabold tracking-tighter">Low</span>
                                    <div className="flex gap-1.5 items-center">
                                        {currentTheme.colors.map((c, i) => (
                                            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                    <span className="text-[9px] uppercase text-zinc-600 font-extrabold tracking-tighter">Peak</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-center py-6 px-4 bg-zinc-950/20 rounded-[10px] border border-white/[0.02] mb-8 relative">
                                {/* Grid background lines */}
                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                                {productivityData.map((day, i) => (
                                    <div key={i} title={day.tooltip} className="relative z-10">
                                        <ProductivitySquare level={day.level} theme={currentTheme} />
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Streak Calendar Terminal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.7, duration: 0.8 }}
                            className="lg:col-span-4 bg-zinc-900/10 backdrop-blur-3xl border border-white/5 rounded-[10px] p-8 flex flex-col shadow-2xl relative overflow-hidden group"
                        >
                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-[10px] bg-zinc-900 border border-white/5 shadow-inner">
                                        <Calendar className="w-5 h-5" style={{ color: currentTheme.accent }} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{format(new Date(), 'MMMM')}</h3>
                                        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Streak TimeLine</p>
                                    </div>
                                </div>
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentTheme.accent }} />
                            </div>

                            <div className="grid grid-cols-7 gap-2 mb-4">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                    <div key={i} className="text-[9px] font-black text-zinc-700 text-center uppercase py-2">
                                        {day}
                                    </div>
                                ))}
                                {monthDays.map((day, i) => (
                                    <div key={i} className="aspect-square flex items-center justify-center relative">
                                        {day ? (
                                            <>
                                                {/* Base day indicator */}
                                                <div className={cn(
                                                    "w-full h-full rounded-[10px] flex items-center justify-center text-[10px] font-black transition-all duration-500",
                                                    day.hasActivity
                                                        ? "text-white border"
                                                        : "bg-white/[0.02] text-zinc-700 border border-white/[0.02]",
                                                    day.isToday && "ring-1 ring-white/20 border-white/20"
                                                )}
                                                    style={day.hasActivity ? {
                                                        backgroundColor: `${currentTheme.accent}22`,
                                                        borderColor: `${currentTheme.accent}44`,
                                                        color: currentTheme.accent
                                                    } : {}}>
                                                    {day.day}
                                                </div>

                                                {/* Activity pulse */}
                                                {day.hasActivity && (
                                                    <div className="absolute inset-0 blur-[8px] rounded-[10px] scale-75" style={{ backgroundColor: currentTheme.accent, opacity: 0.1 }} />
                                                )}

                                                {/* Today indicator bug */}
                                                {day.isToday && (
                                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]" />
                                                )}
                                            </>
                                        ) : (
                                            <div className="w-full h-full" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* --- STATS SECTION (MERGED FROM STATS PAGE) --- */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full mt-12"
                    >
                        {/* Chart Section */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            className="w-full bg-zinc-900/10 backdrop-blur-3xl border border-white/5 rounded-[10px] p-6 md:p-10 shadow-2xl relative overflow-hidden group"
                        >
                            {/* Abstract Grid Background */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />

                            {/* Theme-based Ambient Glow */}
                            <div
                                className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[120px] opacity-20 transition-colors duration-1000"
                                style={{ backgroundColor: currentTheme.accent }}
                            />

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 shadow-inner">
                                        <BarChart3 className="w-5 h-5" style={{ color: currentTheme.accent }} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                            {timeRange === "days" && "7-Day System Flux"}
                                            {timeRange === "weeks" && "8-Week Neural Pulse"}
                                            {timeRange === "months" && "12-Month Core Load"}
                                            <motion.span 
                                                className="inline-block w-2 h-2 rounded-full animate-pulse" 
                                                animate={{ backgroundColor: currentTheme.accent }}
                                                transition={{ duration: 1 }}
                                            />
                                        </h2>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 bg-zinc-950/60 p-1.5 rounded-[12px] border border-white/5 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                                    {/* Subtle Ambient Glow inside tabs */}
                                    <motion.div
                                        className="absolute inset-0 opacity-[0.03]"
                                        animate={{ backgroundColor: currentTheme.accent }}
                                        transition={{ duration: 1 }}
                                    />

                                    {[
                                        { id: "days", label: "Days", icon: Calendar },
                                        { id: "weeks", label: "Weeks", icon: TrendingUp },
                                        { id: "months", label: "Months", icon: BarChart3 }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setTimeRange(tab.id as TimeRange)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-[8px] transition-all duration-500 relative group/tab",
                                                timeRange === tab.id
                                                    ? "text-white"
                                                    : "text-zinc-500 hover:text-zinc-300"
                                            )}
                                        >
                                            {timeRange === tab.id && (
                                                <motion.div
                                                    layoutId="activeTabHighlight"
                                                    className="absolute inset-0 z-0 rounded-[8px]"
                                                    animate={{
                                                        background: `linear-gradient(135deg, ${currentTheme.accent}EE, ${currentTheme.accent}99)`,
                                                        boxShadow: `0 4px 15px ${currentTheme.accent}44, inset 0 0 10px rgba(255,255,255,0.2)`
                                                    }}
                                                    transition={{
                                                        background: { duration: 1 },
                                                        boxShadow: { duration: 1 },
                                                        layout: {
                                                            type: "spring",
                                                            stiffness: 400,
                                                            damping: 30,
                                                            mass: 0.8
                                                        }
                                                    }}
                                                >
                                                    {/* Glass Reflection */}
                                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                                                </motion.div>
                                            )}

                                            {/* Hover Glow */}
                                            {timeRange !== tab.id && (
                                                <div className="absolute inset-0 opacity-0 group-hover/tab:opacity-100 transition-opacity duration-300 rounded-[8px] bg-white/[0.03]" />
                                            )}

                                            <tab.icon className={cn(
                                                "w-3.5 h-3.5 relative z-10 transition-transform duration-500",
                                                timeRange === tab.id ? "scale-110" : "group-hover/tab:scale-110 opacity-70"
                                            )} />
                                            <span className="relative z-10 font-black tracking-[0.15em]">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="h-[400px] w-full mt-4 relative group/chart">
                                {mounted && (
                                    <div className="relative w-full h-full">
                                        {/* Traveling Laser HUD Line */}
                                        <motion.div
                                            key={`laser_${timeRange}`}
                                            initial={{ left: "0%" }}
                                            animate={{ left: "100%" }}
                                            transition={{ duration: 2.5, ease: "easeInOut" }}
                                            className="absolute top-0 bottom-10 w-[2px] z-20 pointer-events-none"
                                            style={{
                                                background: `linear-gradient(to bottom, transparent, ${currentTheme.accent}, transparent)`,
                                                boxShadow: `0 0 15px ${currentTheme.accent}`
                                            }}
                                        />

                                        <motion.div
                                            key={`mask_${timeRange}`}
                                            initial={{ clipPath: 'inset(0 100% 0 0)' }}
                                            animate={{ clipPath: 'inset(0 0% 0 0)' }}
                                            transition={{ duration: 2.5, ease: "easeInOut" }}
                                            className="w-full h-full"
                                        >
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart
                                                    data={timeRange === "days" ? weekData : timeRange === "weeks" ? monthData : yearData}
                                                    key={`${timeRange}_composed`}
                                                    margin={{ top: 20, right: 10, left: -20, bottom: 25 }}
                                                >
                                                    <defs>
                                                        <linearGradient id="colorFlow_analytics" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={currentTheme.accent} stopOpacity={0.5} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                            <stop offset="50%" stopColor={currentTheme.accent} stopOpacity={0.2} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                            <stop offset="100%" stopColor={currentTheme.colors[0]} stopOpacity={0.05} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                        </linearGradient>
                                                        <linearGradient id="strokeFlow_analytics" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={currentTheme.accent} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                            <stop offset="100%" stopColor={currentTheme.colors[1] || currentTheme.accent} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                        </linearGradient>
                                                    </defs>

                                                    <CartesianGrid
                                                        strokeDasharray="0"
                                                        stroke="rgba(255,255,255,0.05)"
                                                        vertical={false}
                                                    />

                                                    <XAxis
                                                        dataKey="date"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900, letterSpacing: '0.05em' }}
                                                        dy={10}
                                                        padding={{ left: 30, right: 30 }}
                                                    />

                                                    <YAxis hide domain={[0, 'auto']} />

                                                    <Tooltip
                                                        cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 12 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const label = payload[0].payload.tooltipLabel || payload[0].payload.date;
                                                                return (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                        className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl relative"
                                                                    >
                                                                        <div className="relative z-10">
                                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                                                                                {label}
                                                                            </p>
                                                                            <div className="flex items-baseline gap-1.5">
                                                                                <span className="text-3xl font-black text-white tracking-tight tabular-nums">
                                                                                    {payload[0].value}
                                                                                </span>
                                                                                <span className="text-[10px] font-bold uppercase text-zinc-400">Mins</span>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />

                                                    {/* Operational Trend Area */}
                                                    <Area
                                                        type="monotone"
                                                        dataKey="minutes"
                                                        stroke="url(#strokeFlow_analytics)"
                                                        strokeWidth={3}
                                                        fill="url(#colorFlow_analytics)"
                                                        fillOpacity={1}
                                                        animationDuration={1500}
                                                        animationEasing="ease-in-out"
                                                        style={{ transition: 'stroke 1000ms ease-in-out' }}
                                                        activeDot={{
                                                            r: 6,
                                                            fill: "#fff",
                                                            stroke: currentTheme.accent,
                                                            strokeWidth: 3,
                                                            style: { 
                                                                filter: `drop-shadow(0 0 10px ${currentTheme.accent})`,
                                                                transition: 'stroke 1000ms ease-in-out'
                                                            }
                                                        }}
                                                    />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </motion.div>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Guest Persistence Notice */}
                        {user && user.isAnonymous && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                                className="w-full mt-8 p-6 bg-purple-500/5 border border-purple-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6"
                            >
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
                            </motion.div>
                        )}

                    </motion.div>
                </main>

                {/* Cropping Modal */}
                <AnimatePresence>
                    {showCropper && image && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                                className="w-full max-w-xl aspect-square bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                            >
                                <div className="absolute inset-0 pb-24">
                                    <Cropper image={image || undefined} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} cropShape="rect" showGrid={false} />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-8 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between border-t border-white/5">
                                    <Button variant="ghost" onClick={() => setShowCropper(false)} className="text-zinc-500 hover:text-white uppercase font-black text-xs tracking-[0.2em]">Abort</Button>
                                    <Button
                                        onClick={handleUploadCropped}
                                        className="text-white font-black uppercase text-xs tracking-[0.3em] px-10 h-12 rounded-2xl shadow-xl transition-all"
                                        style={{
                                            backgroundColor: currentTheme.accent,
                                            boxShadow: `0 0 30px ${currentTheme.accent}44`
                                        }}
                                    >
                                        Confirm Sync
                                    </Button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </BackgroundTheme>
    );
}
