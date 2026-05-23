"use client";
import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateProfilePictureBase64, getSessionHistory, updateUserProfile } from "@/lib/db";
import { getFriendsList, type Friend } from "@/lib/friendship";
import {
    Camera, Zap, Clock, Calendar,
    Share2, Pencil, Activity, Flame,
    TrendingUp, BarChart3, LineChart, AreaChart,
    Users, Copy, UserCheck, ChevronRight, Timer, LayoutGrid, UserMinus
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { format, differenceInDays, startOfDay, subDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, isSameMonth, subWeeks, startOfWeek, isSameWeek } from "date-fns";
import { toast } from "sonner";
import { AuthRequired } from "@/components/auth-required";
import { motion, AnimatePresence } from "framer-motion";
import Cropper, { type Area as CropArea } from "react-easy-crop";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { BackgroundTheme } from "@/components/background-theme";
import {
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

// --- Themes ---
const THEMES: Record<string, { name: string; colors: string[]; accent: string; glow: string; text?: string }> = {
    obsidian: {
        name: "Obsidian Core",
        colors: ["#0A0A0A", "#404040", "#FFFFFF"],
        accent: "#FFFFFF",
        glow: "rgba(255, 255, 255, 0.15)"
    },
    midnight: {
        name: "Midnight",
        colors: ["#020617", "#0F172A", "#3B82F6"],
        accent: "#3B82F6",
        glow: "rgba(59, 130, 246, 0.2)"
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
    },
    crimson: {
        name: "Crimson Void",
        colors: ["#170505", "#7F1D1D", "#FCA5A5"],
        accent: "#FCA5A5",
        glow: "rgba(252, 165, 165, 0.2)"
    }
};

// --- Types ---
type TimeRange = "days" | "weeks" | "months";

interface SessionData {
    id: string;
    userId: string;
    duration: number;
    completedAt: {
        seconds: number;
        nanoseconds: number;
        toDate: () => Date;
    };
    type: string;
}

interface UserProfileData {
    displayName?: string;
    nickname?: string;
    bio?: string;
    profileTheme?: string;
    photoURL?: string;
    totalPomodoros?: number;
    totalMinutes?: number;
    createdAt?: {
        seconds: number;
        nanoseconds: number;
    };
    lastActive?: { toDate: () => Date; seconds?: number; } | Date | null;
}

interface FriendStatus {
    status?: string;
    direction?: string;
    isFriend?: boolean;
}

type FriendListItem = Friend;

interface ChartPoint {
    date: string;
    tooltipLabel: string;
    fullDate: Date;
    minutes: number;
}

type ThemeConfig = {
    name: string;
    colors: string[];
    accent: string;
    glow: string;
    text?: string;
};

interface StatCardProps {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    value: string | number;
    colorClass: string;
    delay?: number;
    horizontal?: boolean;
    lottie?: string | null;
}

// --- Components ---

const StatCard = ({ icon: Icon, label, value, colorClass, delay = 0, horizontal = false, lottie = null }: StatCardProps) => {
    const emberParticles = useMemo(
        () =>
            [...Array(15)].map((_, i) => ({
                id: i,
                top: `${(i * 100) / 24}%`,
                xEnd: -140 - i * 4,
                yStart: ((i % 7) - 3) * 10,
                yEnd: ((i % 9) - 4) * 11,
                duration: 1.2 + (i % 5) * 0.16,
                delay: i * 0.1,
            })),
        []
    );

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
                                    width: '100%',
                                    mixBlendMode: colorClass.includes('red') ? 'screen' : 'normal',
                                }}
                            />
                        </div>
                    </div>
                )}
                {colorClass.includes('red') && emberParticles.map((p) => (
                    <motion.div
                        key={p.id}
                        animate={{
                            x: [0, p.xEnd],
                            y: [p.yStart, p.yEnd],
                            opacity: [0, 0.6, 0],
                            scale: [1.2, 0.2]
                        }}
                        transition={{
                            duration: p.duration,
                            repeat: Infinity,
                            delay: p.delay,
                            ease: "easeOut"
                        }}
                        className="absolute right-0 w-1 h-1 bg-orange-400 rounded-full blur-[0.6px]"
                        style={{ top: p.top, mixBlendMode: 'screen' }}
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

const ProductivitySquare = ({ level, theme }: { level: number, theme: ThemeConfig }) => {
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

function ProfileContent() {
    const searchParams = useSearchParams();
    const targetUserId = searchParams.get("user");
    const { user, loading: authLoading } = useAuth();
    const [userData, setUserData] = useState<UserProfileData | null>(null);
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 60000); // 1 minute
        return () => clearInterval(interval);
    }, []);

    const isOnline = (timestamp: any) => {
        if (!timestamp) return false;
        const lastActive = timestamp instanceof Date ? timestamp : timestamp.toDate?.();
        if (!lastActive) return false;
        // 10 minute threshold accounts for slow heartbeats or clock drift
        return currentTime - lastActive.getTime() <= 10 * 60 * 1000;
    };
    const [loading, setLoading] = useState(true);
    const [isOwnProfile, setIsOwnProfile] = useState(true);
    const [friendStatus, setFriendStatus] = useState<FriendStatus | null>(null);

    // Cropping State
    const [image, setImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [unfriendConfirmOpen, setUnfriendConfirmOpen] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editNickname, setEditNickname] = useState("");
    const [editBio, setEditBio] = useState("");
    const [selectedTheme, setSelectedTheme] = useState("obsidian");
    const [isSaving, setIsSaving] = useState(false);

    // Stats State
    const [weekData, setWeekData] = useState<ChartPoint[]>([]);
    const [monthData, setMonthData] = useState<ChartPoint[]>([]);
    const [yearData, setYearData] = useState<ChartPoint[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>("days");
    const [mounted, setMounted] = useState(false);
    const [friends, setFriends] = useState<FriendListItem[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { setLoading(false); return; }

        let active = true;
        const unsubs: (() => void)[] = [];

        const fetchData = async () => {
            setLoading(true);

            const effectiveUserId = targetUserId || user.uid;
            const ownProfile = effectiveUserId === user.uid;
            setIsOwnProfile(ownProfile);

            if (ownProfile && user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }

            if (!active) return;

            // Fetch friendship status if not own profile
            if (!ownProfile) {
                const { getFriendRequestStatus, areFriends } = await import("@/lib/friendship");
                const status = await getFriendRequestStatus(user.uid, effectiveUserId);
                const isFriend = await areFriends(user.uid, effectiveUserId);
                if (!active) return;
                setFriendStatus({ status: status?.status, direction: status?.direction, isFriend });

                // Listen to friends collection for accepted / unfriended status
                const friendDocRef = doc(db, "users", user.uid, "friends", effectiveUserId);
                const unsubFriend = onSnapshot(friendDocRef, (snap) => {
                    const isNowFriend = snap.exists();
                    setFriendStatus(prev => {
                        if (prev?.isFriend === isNowFriend) return prev;
                        return { ...prev, isFriend: isNowFriend, ...(isNowFriend ? { status: undefined, direction: undefined } : {}) };
                    });
                });
                if (!active) unsubFriend();
                else unsubs.push(unsubFriend);

                // Listen to friendRequests for pending requests updates
                const { query, collection, or, and, where, onSnapshot: onSnap } = await import("firebase/firestore");
                const requestsQuery = query(
                    collection(db, "friendRequests"),
                    or(
                        and(where("fromUserId", "==", user.uid), where("toUserId", "==", effectiveUserId)),
                        and(where("fromUserId", "==", effectiveUserId), where("toUserId", "==", user.uid))
                    )
                );
                
                const unsubReq = onSnap(requestsQuery, (snap) => {
                    const docs = snap.docs.map(d => d.data());
                    const req = docs.find((r: any) => r.status === "pending");
                    if (req) {
                        const direction = req.fromUserId === user.uid ? "sent" : "received";
                        setFriendStatus(prev => ({ ...prev, status: "pending", direction }));
                    } else {
                        setFriendStatus(prev => ({ ...prev, status: undefined, direction: undefined }));
                    }
                }, (error) => {
                    console.error("Friend request listener error:", error);
                });
                if (!active) unsubReq();
                else unsubs.push(unsubReq);
            }

            // Sync user data
            const unsubData = onSnapshot(doc(db, "users", effectiveUserId), (docSnap) => {
                if (!active) return;
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);
                    // Pre-fill edit state
                    setEditName(data.displayName || "");
                    setEditNickname(data.nickname || "");
                    setEditBio(data.bio || "");
                    if (data.profileTheme) {
                        const themeKey = data.profileTheme.toLowerCase();
                        setSelectedTheme(THEMES[themeKey] ? themeKey : "obsidian");
                    }
                }
                setLoading(false);
            });
            if (!active) unsubData();
            else unsubs.push(unsubData);

            // Sync sessions info for grid & streak
            const history = (await getSessionHistory(effectiveUserId, 365)) as SessionData[];
            if (!active) return;
            setSessions(history);

            // Fetch friends list
            const friendsData = await getFriendsList(effectiveUserId);
            if (!active) return;
            setFriends(friendsData);

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

            if (!active) return;
            setWeekData(last7Days);
            setMonthData(last8Weeks);
            setYearData(last12Months);
        };

        fetchData();
        return () => {
            active = false;
            unsubs.forEach(fn => fn());
        };
    }, [user, authLoading, targetUserId]);

    // --- Calculations ---

    const streakCount = useMemo(() => {
        if (!sessions.length) return 0;
        const sortedDates = [...new Set(sessions.map(s => startOfDay(s.completedAt.toDate()).getTime()))]
            .sort((a, b) => b - a);

        let streak = 0;
        const today = startOfDay(new Date());
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
            const daySessions = sessions.filter(s => {
                if (!s.completedAt || typeof s.completedAt.toDate !== 'function') return false;
                return isSameDay(s.completedAt.toDate(), date);
            });
            const totalMins = daySessions.reduce((acc, curr) => acc + curr.duration, 0);
            let level = 0;
            if (totalMins > 0) {
                if (totalMins < 30) level = 1;
                else if (totalMins < 120) level = 2;
                else level = 3;
            }

            let tooltipText = `${format(date, 'MMM d')}: ${formatFocusedTime(totalMins)} focused`;

            grid.push({
                date,
                level,
                minutes: totalMins,
                tooltip: tooltipText
            });
        }
        return grid;
    }, [sessions]);

    const heatmapMonths = useMemo(() => {
        const labels: { label: string, colIndex: number }[] = [];
        let lastMonth: number | null = null;
        for (let i = 0; i < productivityData.length; i += 7) {
            const m = productivityData[i].date.getMonth();
            if (m !== lastMonth) {
                labels.push({ label: format(productivityData[i].date, 'MMM'), colIndex: i / 7 });
                lastMonth = m;
            }
        }
        return labels;
    }, [productivityData]);

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

    const onCropComplete = (_: CropArea, pixels: CropArea) => setCroppedAreaPixels(pixels);

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
        } catch { toast.error("Failed.", { id: "upload" }); }
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
        } catch {
            toast.error("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const getCroppedImgBase64 = async (imageSrc: string, pixelCrop: CropArea): Promise<string | null> => {
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
            <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden">
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Profile restricted"
                        description="Sign in to create your permanent profile and track your productivity history."
                    />
                </main>
            </div>
        );
    }

    const currentTheme = THEMES[selectedTheme] || THEMES.obsidian;

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

                                        {/* Online Indicator */}
                                        <div className={cn(
                                            "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full border-[3px] border-zinc-950 z-40 transition-colors duration-500",
                                            isOnline(userData?.lastActive)
                                                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                                                : "bg-zinc-600 shadow-[0_0_5px_rgba(0,0,0,0.5)]"
                                        )} />
                                    </div>
                                </motion.div>

                                {/* Action Buttons Container */}
                                {!isOwnProfile ? (
                                    <div className="flex flex-col gap-2.5 w-32 md:w-40 items-center z-30">
                                        {friendStatus?.isFriend ? (
                                            <Button 
                                                onClick={() => setUnfriendConfirmOpen(true)}
                                                className="w-full h-9 rounded-full bg-green-500/20 text-green-400 font-black text-[9px] tracking-widest border border-green-500/20 uppercase hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/20 group cursor-pointer transition-colors"
                                            >
                                                <UserCheck className="w-2.5 h-2.5 mr-2 group-hover:hidden" />
                                                <UserMinus className="w-2.5 h-2.5 mr-2 hidden group-hover:block" />
                                                <span className="group-hover:hidden">Friends</span>
                                                <span className="hidden group-hover:block">Unfriend</span>
                                            </Button>
                                        ) : friendStatus?.status === "pending" ? (
                                            friendStatus.direction === "sent" ? (
                                                <Button 
                                                    onClick={async () => {
                                                        const { getFriendRequest, cancelFriendRequest } = await import("@/lib/friendship");
                                                        const req = await getFriendRequest(user.uid, targetUserId!);
                                                        if (req && await cancelFriendRequest(req.id)) {
                                                            toast.success("Friend request cancelled");
                                                            setFriendStatus({ ...friendStatus, status: undefined, direction: undefined });
                                                        }
                                                    }}
                                                    className="w-full h-9 rounded-full font-black text-[9px] tracking-widest uppercase border transition-colors bg-yellow-500/20 text-yellow-400 border-yellow-500/20 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/20 group cursor-pointer"
                                                >
                                                    <Timer className="w-2.5 h-2.5 mr-2 group-hover:hidden" />
                                                    <UserMinus className="w-2.5 h-2.5 mr-2 hidden group-hover:block" />
                                                    <span className="group-hover:hidden">Pending</span>
                                                    <span className="hidden group-hover:block">Cancel</span>
                                                </Button>
                                            ) : (
                                                <div className="flex w-full gap-2">
                                                    <Button 
                                                        onClick={async () => {
                                                            const { getFriendRequest, acceptFriendRequest } = await import("@/lib/friendship");
                                                            const req = await getFriendRequest(targetUserId!, user.uid);
                                                            if (req && await acceptFriendRequest(req.id, targetUserId!, user.uid)) {
                                                                toast.success("Friend request accepted");
                                                                // the snapshot listener will handle state update automatically
                                                            }
                                                        }}
                                                        className="flex-1 h-9 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20 font-black text-[9px] tracking-widest uppercase cursor-pointer transition-colors"
                                                    >
                                                        Accept
                                                    </Button>
                                                    <Button 
                                                        onClick={async () => {
                                                            const { getFriendRequest, declineFriendRequest } = await import("@/lib/friendship");
                                                            const req = await getFriendRequest(targetUserId!, user.uid);
                                                            if (req && await declineFriendRequest(req.id)) {
                                                                toast.success("Friend request declined");
                                                                // the snapshot listener will handle state update automatically
                                                            }
                                                        }}
                                                        className="flex-1 h-9 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/20 font-black text-[9px] tracking-widest uppercase cursor-pointer transition-colors"
                                                    >
                                                        Decline
                                                    </Button>
                                                </div>
                                            )
                                        ) : (
                                            <Button
                                                onClick={async () => {
                                                    const { sendFriendRequest } = await import("@/lib/friendship");
                                                    const success = await sendFriendRequest(user.uid, targetUserId!);
                                                    if (success) {
                                                        toast.success("Friend request sent!");
                                                        setFriendStatus({ ...friendStatus, status: "pending", direction: "sent" });
                                                    }
                                                }}
                                                className="w-full h-9 rounded-full bg-white text-black hover:bg-zinc-200 font-black text-[9px] tracking-widest border border-white/20 uppercase shadow-xl"
                                            >
                                                <Users className="w-2.5 h-2.5 mr-2" />
                                                Add Friend
                                            </Button>
                                        )}
                                    </div>
                                ) : !isEditing && (
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
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/profile?user=${user.uid}`);
                                                    toast.success("Profile link copied!");
                                                }}
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

                                        {/* User ID for easy searching */}
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(targetUserId || user.uid);
                                                toast.success("User ID copied to clipboard!");
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-xl hover:border-white/20 transition-all mb-4 group"
                                            title="Click to copy"
                                        >
                                            <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                                                ID: {targetUserId || user.uid}
                                            </span>
                                            <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
                                        </button>

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

                            {/* Friends Card: Streamlined Navigation Hub */}
                            <div className="col-span-2">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                    className={cn(
                                        "relative group bg-zinc-900/10 backdrop-blur-2xl border border-white/5 rounded-[5px] flex items-center justify-between p-3 px-5 shadow-2xl transition-all duration-500 h-full min-h-[80px] overflow-hidden",
                                        isOwnProfile ? "cursor-pointer hover:bg-zinc-900/20" : "cursor-default"
                                    )}
                                    onClick={() => isOwnProfile && (window.location.href = "/friends")}
                                >
                                    {/* Inner Hover Light */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
                                    </div>

                                    {/* Theme Ambient Hover Glow */}
                                    <div
                                        className="absolute -inset-6 opacity-0 group-hover:opacity-100 transition-all duration-700 blur-[35px] pointer-events-none -z-10"
                                        style={{ backgroundColor: currentTheme.glow }}
                                    />

                                    {/* Friends Card Animated Background */}
                                    <div className="absolute inset-0 pointer-events-none z-0 opacity-0 group-hover:opacity-35 transition-opacity duration-700">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[320px] h-[320px]">
                                            <DotLottieReact
                                                src="https://lottie.host/57f88543-91fb-4d6d-a8a3-5c0be150cdcf/R5RnYeBnGD.lottie"
                                                autoplay
                                                loop
                                                style={{ width: "100%", height: "100%" }}
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-transparent" />
                                    </div>

                                    {/* Ambient Glow */}
                                    <div className={cn(
                                        "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent transition-opacity",
                                        isOwnProfile ? "opacity-0 group-hover:opacity-100" : "opacity-0"
                                    )} />
                                    <div
                                        className={cn(
                                            "absolute -inset-8 rounded-full transition-all duration-1000 blur-[60px] pointer-events-none z-0",
                                            isOwnProfile ? "opacity-0 group-hover:opacity-100" : "opacity-0"
                                        )}
                                        style={{ backgroundColor: "rgba(168,85,247,0.1)" }}
                                    />

                                    <div className="flex items-center gap-4 relative z-10">
                                        {/* Icon */}
                                        <div className="p-2 rounded-lg bg-zinc-900/40 border border-white/5 shadow-inner">
                                            <UserCheck className="w-4 h-4 text-purple-400" style={{ filter: "drop-shadow(0 0 5px rgba(168,85,247,0.5))" }} />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center">
                                                <span className="text-xl font-black text-white tracking-tighter tabular-nums leading-none">
                                                    {friends.length}
                                                </span>
                                            </div>
                                            <span className="text-[7.5px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1 group-hover:text-zinc-400 transition-colors">
                                                Focus Friends
                                            </span>
                                        </div>
                                    </div>

                                    {isOwnProfile && (
                                        <div className="relative z-10">
                                            <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    )}

                                    {/* Reactive Corner */}
                                    <div className="absolute top-1 right-1 w-1.5 h-1.5 border-r border-t border-white/5 rounded-tr-[1px]" />

                                    {/* Top Gloss Sweep */}
                                    <motion.div
                                        className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        initial={{ x: "-100%" }}
                                        whileHover={{ x: "100%" }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    />
                                </motion.div>
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
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const y = e.clientY - rect.top;
                                e.currentTarget.style.setProperty("--x", `${x}px`);
                                e.currentTarget.style.setProperty("--y", `${y}px`);
                            }}
                            className="lg:col-span-8 border rounded-2xl p-8 flex flex-col relative overflow-hidden group/card"
                            style={{
                                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                                background: `radial-gradient(circle at 90% 10%, ${currentTheme.accent}0f, transparent 70%), #040405`,
                                borderColor: `${currentTheme.accent}22`
                            }}
                        >
                            {/* Top-Right Ambient Glow Source */}
                            <div
                                className="absolute -top-[15%] -right-[10%] w-[50%] h-[50%] rounded-full opacity-[0.18] pointer-events-none transition-colors duration-1000 z-0"
                                style={{
                                    background: `radial-gradient(circle at center, ${currentTheme.accent}, transparent 75%)`,
                                    filter: 'blur(90px)'
                                }}
                            />

                            {/* Top Border Light Source (Centered) */}
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] z-20" style={{
                                background: `linear-gradient(90deg, transparent 15%, ${currentTheme.accent}aa, transparent 85%)`,
                                boxShadow: `0 0 20px ${currentTheme.accent}33`
                            }} />

                            {/* Interactive Spotlight */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
                                style={{
                                    background: `radial-gradient(circle 350px at var(--x, 0px) var(--y, 0px), ${currentTheme.accent}0d, transparent)`
                                }}
                            />

                            {/* Inner Border Glow */}
                            <div className="absolute inset-0 rounded-2xl border pointer-events-none z-10" style={{ borderColor: `${currentTheme.accent}11` }} />

                            <div className="flex items-center justify-between mb-16 relative z-10 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-[3px] h-5 rounded-full" style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 12px ${currentTheme.accent}66` }} />
                                    <LayoutGrid className="w-5 h-5 stroke-[2.5] opacity-60" style={{ color: currentTheme.accent }} />
                                    <h3 className="text-[15px] font-extrabold text-white tracking-tight leading-none">Focus Heatmap</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] uppercase text-zinc-600 font-extrabold tracking-widest mr-1">LESS</span>
                                    <div className="flex gap-1 items-center">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div key={i} className="w-[11px] h-[11px] rounded-[1.5px]" style={{
                                                backgroundColor: i === 0 ? "rgba(255,255,255,0.03)" : currentTheme.accent,
                                                opacity: i === 0 ? 1 : i === 1 ? 0.35 : i === 2 ? 0.7 : 1
                                            }} />
                                        ))}
                                    </div>
                                    <span className="text-[9px] uppercase text-zinc-600 font-extrabold tracking-widest ml-1">MORE</span>
                                </div>
                            </div>

                            <div className="relative w-full h-full flex flex-col justify-end mt-4">
                                {/* Months row */}
                                <div className="text-[10px] font-bold text-zinc-600 mb-3 whitespace-nowrap absolute -top-8 w-full flex">
                                    {heatmapMonths.map((m, idx) => (
                                        <div key={idx} className="absolute" style={{ left: `calc(${m.colIndex} * (100% / 20))` }}>
                                            {m.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Grid */}
                                <div className="grid grid-rows-7 grid-flow-col gap-1.5 w-full h-[140px]">
                                    {productivityData.map((day, i) => (
                                        <div key={i} title={day.tooltip} className="w-full h-full relative group/day">
                                            <div
                                                className="w-full h-full rounded-[3px] transition-all duration-300 pointer-events-none relative z-10"
                                                style={{
                                                    backgroundColor: day.level > 0 ? currentTheme.accent : "rgba(255,255,255,0.06)",
                                                    opacity: day.level === 0 ? 1 : day.level === 1 ? 0.35 : day.level === 2 ? 0.65 : 1,
                                                    boxShadow: day.level > 1 ? `0 0-8px ${currentTheme.accent}33` : 'none',
                                                }}
                                            />
                                            {day.level > 0 && (
                                                <div
                                                    className="absolute inset-0 blur-[6px] opacity-[0.15] pointer-events-none"
                                                    style={{ backgroundColor: currentTheme.accent }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Streak Calendar Terminal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.7, duration: 0.8 }}
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const y = e.clientY - rect.top;
                                e.currentTarget.style.setProperty("--x", `${x}px`);
                                e.currentTarget.style.setProperty("--y", `${y}px`);
                            }}
                            className="lg:col-span-4 border rounded-2xl p-8 flex flex-col relative overflow-hidden group/card"
                            style={{
                                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                                background: `radial-gradient(circle at 10% 10%, ${currentTheme.accent}18, transparent 70%), #040405`,
                                borderColor: `${currentTheme.accent}22`
                            }}
                        >
                            {/* Top-Left Ambient Glow Source (STRONGER) */}
                            <div
                                className="absolute -top-[15%] -left-[15%] w-[60%] h-[60%] rounded-full opacity-[0.22] pointer-events-none transition-colors duration-1000 z-0"
                                style={{
                                    background: `radial-gradient(circle at center, ${currentTheme.accent}, transparent 75%)`,
                                    filter: 'blur(80px)'
                                }}
                            />

                            {/* Top Border Light Source (Centered) */}
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] z-20" style={{
                                background: `linear-gradient(90deg, transparent 15%, ${currentTheme.accent}cc, transparent 85%)`,
                                boxShadow: `0 0 20px ${currentTheme.accent}44`
                            }} />

                            {/* Interactive Spotlight */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
                                style={{
                                    background: `radial-gradient(circle 350px at var(--x, 0px) var(--y, 0px), ${currentTheme.accent}0d, transparent)`
                                }}
                            />

                            {/* Inner Border Glow */}
                            <div className="absolute inset-0 rounded-2xl border pointer-events-none z-10" style={{ borderColor: `${currentTheme.accent}11` }} />

                            <div className="flex items-center justify-between mb-16 relative z-10 w-full">
                                <div className="flex items-center gap-3">
                                    <div className="w-[3px] h-5 rounded-full" style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 12px ${currentTheme.accent}66` }} />
                                    <Calendar className="w-5 h-5 stroke-[2.5] opacity-60" style={{ color: currentTheme.accent }} />
                                    <h3 className="text-[15px] font-extrabold text-white tracking-tight leading-none">Streak Timeline</h3>
                                </div>
                                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                    {format(new Date(), 'MMMM')}
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                    <div key={i} className="text-[9px] font-black text-zinc-700 text-center uppercase pb-3">
                                        {day}
                                    </div>
                                ))}
                                {monthDays.map((day, i) => (
                                    <div key={i} className="aspect-square flex items-center justify-center relative">
                                        {day && (
                                            <>
                                                {/* Base day indicator */}
                                                <div
                                                    className="w-full h-full rounded-xl flex items-center justify-center text-[11px] font-bold transition-all duration-300"
                                                    style={day.hasActivity ? {
                                                        backgroundColor: `${currentTheme.accent}15`,
                                                        borderColor: `${currentTheme.accent}25`,
                                                        borderWidth: '1px',
                                                        color: currentTheme.accent
                                                    } : {
                                                        backgroundColor: "transparent",
                                                        borderColor: "rgba(255,255,255,0.03)",
                                                        borderWidth: '1px',
                                                        color: "rgba(255,255,255,0.2)"
                                                    }}
                                                >
                                                    {day.day}
                                                </div>

                                                {/* Today indicator dot */}
                                                {day.isToday && (
                                                    <div className="absolute top-0 right-0 transform translate-x-[3px] -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" />
                                                )}
                                            </>
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
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8, duration: 0.8 }}
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const y = e.clientY - rect.top;
                                e.currentTarget.style.setProperty("--x", `${x}px`);
                                e.currentTarget.style.setProperty("--y", `${y}px`);
                            }}
                            className="w-full border rounded-2xl p-6 md:p-10 flex flex-col relative overflow-hidden group/card mt-4"
                            style={{
                                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                                background: `radial-gradient(circle at 10% 10%, ${currentTheme.accent}0d, transparent 60%), #040405`,
                                borderColor: `${currentTheme.accent}22`
                            }}
                        >
                            {/* Ambient Glow Source */}
                            <div
                                className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full opacity-[0.22] pointer-events-none transition-colors duration-1000 z-0"
                                style={{
                                    background: `radial-gradient(circle at center, ${currentTheme.accent}, transparent 75%)`,
                                    filter: 'blur(90px)'
                                }}
                            />

                            {/* Top Border Light Source (Centered) */}
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] z-20" style={{
                                background: `linear-gradient(90deg, transparent 15%, ${currentTheme.accent}aa, transparent 85%)`,
                                boxShadow: `0 0 20px ${currentTheme.accent}33`
                            }} />

                            {/* Interactive Spotlight */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
                                style={{
                                    background: `radial-gradient(circle 350px at var(--x, 0px) var(--y, 0px), ${currentTheme.accent}0d, transparent)`
                                }}
                            />

                            {/* Inner Border Glow */}
                            <div className="absolute inset-0 rounded-2xl border pointer-events-none z-10" style={{ borderColor: `${currentTheme.accent}11` }} />

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-[3px] h-5 rounded-full" style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 12px ${currentTheme.accent}66` }} />
                                    <AreaChart className="w-5 h-5 stroke-[2.5] opacity-60" style={{ color: currentTheme.accent }} />
                                    <h3 className="text-[17px] font-extrabold text-white tracking-tight leading-none uppercase mt-[3px]">
                                        {timeRange === "days" && "Last 7 Day Focus"}
                                        {timeRange === "weeks" && "Last 8 Week Focus"}
                                        {timeRange === "months" && "Last 12 Month Focus"}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-1.5 bg-[#040405] p-1.5 rounded-full border border-white/5 backdrop-blur-2xl shadow-xl relative overflow-hidden">
                                    {/* Subtle Ambient Glow inside tabs */}
                                    <motion.div
                                        className="absolute inset-0 opacity-[0.02]"
                                        animate={{ backgroundColor: currentTheme.accent }}
                                        transition={{ duration: 1 }}
                                    />

                                    {[
                                        { id: "days", label: "Days" },
                                        { id: "weeks", label: "Weeks" },
                                        { id: "months", label: "Months" }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setTimeRange(tab.id as TimeRange)}
                                            className={cn(
                                                "flex items-center justify-center px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 relative group/tab",
                                                timeRange === tab.id
                                                    ? "text-white"
                                                    : "text-zinc-500 hover:text-white/70"
                                            )}
                                        >
                                            {timeRange === tab.id && (
                                                <motion.div
                                                    layoutId="activeTabHighlight"
                                                    className="absolute inset-0 z-0 rounded-full"
                                                    animate={{
                                                        background: `linear-gradient(135deg, ${currentTheme.accent}dd, ${currentTheme.accent}88)`,
                                                        boxShadow: `0 2px 10px ${currentTheme.accent}33, inset 0 0 8px rgba(255,255,255,0.1)`
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 400,
                                                        damping: 30
                                                    }}
                                                />
                                            )}

                                            <span className="relative z-10">{tab.label}</span>
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
                                            className="absolute top-0 bottom-12 w-[1px] z-20 pointer-events-none opacity-40"
                                            style={{
                                                background: `linear-gradient(to bottom, transparent, ${currentTheme.accent}, transparent)`,
                                                boxShadow: `0 0 10px ${currentTheme.accent}44`
                                            }}
                                        />

                                        <motion.div
                                            key={`mask_${timeRange}`}
                                            initial={{ clipPath: 'inset(0 100% 0 0)' }}
                                            animate={{ clipPath: 'inset(0 0% 0 0)' }}
                                            transition={{ duration: 2.5, ease: "easeInOut" }}
                                            className="w-full h-full min-w-0"
                                        >
                                            <ResponsiveContainer width="100%" height={400} debounce={50}>
                                                <ComposedChart
                                                    data={timeRange === "days" ? weekData : timeRange === "weeks" ? monthData : yearData}
                                                    key={`${timeRange}_composed`}
                                                    margin={{ top: 20, right: 10, left: -20, bottom: 25 }}
                                                >
                                                    <defs>
                                                        <linearGradient id="colorFlow_analytics" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={currentTheme.accent} stopOpacity={0.5} />
                                                            <stop offset="40%" stopColor={currentTheme.accent} stopOpacity={0.15} />
                                                            <stop offset="90%" stopColor={currentTheme.accent} stopOpacity={0.02} />
                                                            <stop offset="100%" stopColor={currentTheme.accent} stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="strokeFlow_analytics" x1="0" y1="0" x2="1" y2="0">
                                                            <stop offset="0%" stopColor={currentTheme.accent} stopOpacity={0.4} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                            <stop offset="50%" stopColor={currentTheme.accent} stopOpacity={1} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                            <stop offset="100%" stopColor={currentTheme.accent} stopOpacity={0.4} style={{ transition: 'stop-color 1000ms ease-in-out' }} />
                                                        </linearGradient>
                                                        <filter id="glow_analytics" x="-20%" y="-20%" width="140%" height="140%">
                                                            <feGaussianBlur stdDeviation="3" result="blur" />
                                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                                        </filter>
                                                    </defs>

                                                    <CartesianGrid
                                                        strokeDasharray="4 4"
                                                        stroke="rgba(255,255,255,0.03)"
                                                        vertical={false}
                                                    />

                                                    <XAxis
                                                        dataKey="date"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}
                                                        dy={15}
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
                                                                        initial={{ opacity: 0, x: -10, filter: 'blur(10px)' }}
                                                                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                                                        className="relative min-w-[120px] p-[1px] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                                                    >
                                                                        {/* Animated Border Gradient */}
                                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/5" />

                                                                        <div className="relative bg-zinc-900/90 backdrop-blur-3xl rounded-[11px] p-3.5">
                                                                            {/* Left Accent Bar */}
                                                                            <div
                                                                                className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
                                                                                style={{ background: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}` }}
                                                                            />

                                                                            <div className="flex items-center gap-3">
                                                                                <p className="text-[10px] font-bold text-white/90 whitespace-nowrap">
                                                                                    {label}
                                                                                </p>

                                                                                <div className="w-[1px] h-3 bg-white/10" />

                                                                                <div className="flex items-baseline gap-1">
                                                                                    <span className="text-xl font-black text-white tabular-nums leading-none">
                                                                                        {payload[0].value}
                                                                                    </span>
                                                                                    <span className="text-[9px] font-black text-zinc-400 uppercase">min</span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Background Glow */}
                                                                            <div
                                                                                className="absolute -right-3 -bottom-3 w-12 h-12 blur-2xl opacity-10 pointer-events-none rounded-full"
                                                                                style={{ background: currentTheme.accent }}
                                                                            />
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
                                                        stroke={currentTheme.accent}
                                                        strokeWidth={2}
                                                        fill="url(#colorFlow_analytics)"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        animationDuration={1500}
                                                        animationEasing="ease-in-out"
                                                        activeDot={{
                                                            r: 8,
                                                            fill: "#fff",
                                                            stroke: currentTheme.accent,
                                                            strokeWidth: 4,
                                                            style: {
                                                                filter: `drop-shadow(0 0 12px ${currentTheme.accent})`
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
            {/* Unfriend Confirmation Dialog */}
            <Dialog open={unfriendConfirmOpen} onOpenChange={setUnfriendConfirmOpen}>
                <DialogContent className="rounded-[5px] bg-zinc-900 border border-white/10 text-zinc-100 max-w-[350px]">
                    <DialogHeader>
                        <DialogTitle className="ubuntu-bold text-zinc-100">Unfriend {userData?.displayName || "user"}?</DialogTitle>
                        <DialogDescription className="ubuntu-regular text-zinc-400">
                            This will remove the friend connection for both of you.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="rounded-b-[5px] bg-transparent border-t border-white/10 p-3 pt-4 gap-2 sm:justify-end flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setUnfriendConfirmOpen(false)}
                            className="flex-1 sm:flex-none h-9 rounded-[5px] border-white/15 px-4 ubuntu-medium text-zinc-300 hover:bg-white/5 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                const { removeFriend } = await import("@/lib/friendship");
                                const success = await removeFriend(user.uid, targetUserId!);
                                if (success) {
                                    toast.success("Friend removed");
                                    setFriendStatus({ ...friendStatus, isFriend: false, status: undefined, direction: undefined });
                                    setUnfriendConfirmOpen(false);
                                }
                            }}
                            className="flex-1 sm:flex-none h-9 rounded-[5px] border border-red-500/30 bg-red-500/15 px-4 ubuntu-medium text-red-300 hover:bg-red-500/25 hover:text-red-200"
                        >
                            Unfriend
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </BackgroundTheme>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
