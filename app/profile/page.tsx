"use client";
import React, { useEffect, useState, useMemo, Suspense, memo } from "react";
import { useSearchParams } from "next/navigation";
import { useTour, type TourStep } from "@/lib/use-tour";
import { useTimerStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { cn, getHighQualityAvatarUrl } from "@/lib/utils";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateProfilePictureBase64, getSessionHistory, updateUserProfile } from "@/lib/db";
import { getFriendsListSimple, type Friend } from "@/lib/friendship";
import {
    Camera, Zap, Clock, Calendar,
    Share2, Pencil, Flame,
    AreaChart,
    Users, UserCheck, ChevronRight, Timer, LayoutGrid, UserMinus,
    ZoomIn, ZoomOut, HelpCircle
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
import dynamic from "next/dynamic";
import frameBorder from "@/components/ui/Frame-1.png";

const DotLottieReact = dynamic(
    () => import("@lottiefiles/dotlottie-react").then(mod => mod.DotLottieReact),
    { ssr: false }
);

function useTouchDevice() {
    const [isTouch, setIsTouch] = useState(false);
    useEffect(() => {
        setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);
    return isTouch;
}

const ProfileChart = dynamic(
    () => import("@/components/profile-chart").then(mod => mod.ProfileChart),
    {
        ssr: false,
        loading: () => <div className="w-full h-full bg-zinc-950/20 animate-pulse rounded-xl" />
    }
);

const ProfilePicCropperModal = dynamic(
    () => import("@/components/profile-pic-cropper-modal"),
    { ssr: false }
);

import { BackgroundTheme } from "@/components/background-theme";

// --- Themes ---
const THEMES: Record<string, { name: string; colors: string[]; accent: string; glow: string; text?: string }> = {
    obsidian: {
        name: "Obsidian Core",
        colors: ["#0A0A0A", "#404040", "#FFFFFF"],
        accent: "#FFFFFF",
        glow: "rgba(255, 255, 255, 0.15)",
        text: "#000000"
    },
    midnight: {
        name: "Midnight",
        colors: ["#020617", "#0F172A", "#3B82F6"],
        accent: "#3B82F6",
        glow: "rgba(59, 130, 246, 0.2)",
        text: "#FFFFFF"
    },
    cinematic: {
        name: "Cinematic",
        colors: ["#522546", "#88304E", "#E23E57"],
        accent: "#E23E57",
        glow: "rgba(226, 62, 87, 0.2)",
        text: "#FFFFFF"
    },
    teal: {
        name: "Deep Teal Sea",
        colors: ["#024959", "#026773", "#3CA6A6"],
        accent: "#3CA6A6",
        glow: "rgba(60, 166, 166, 0.2)",
        text: "#FFFFFF"
    },
    meadow: {
        name: "Emerald Meadow",
        colors: ["#A2CB8B", "#C7EABB", "#E8F5BD"],
        accent: "#E8F5BD",
        glow: "rgba(232, 245, 189, 0.2)",
        text: "#152E15"
    },
    crimson: {
        name: "Crimson Void",
        colors: ["#170505", "#7F1D1D", "#FCA5A5"],
        accent: "#FCA5A5",
        glow: "rgba(252, 165, 165, 0.2)",
        text: "#3E0A0A"
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

interface FriendRequestDoc {
    status?: string;
    fromUserId?: string;
    toUserId?: string;
}

type FriendListItem = Friend;

interface ChartPoint {
    date: string;
    tooltipLabel: string;
    fullDate: Date;
    minutes: number;
}

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
const StatCard = memo(({ icon: Icon, label, value, colorClass, delay = 0, horizontal = false, lottie = null }: StatCardProps) => {
    const isTouchDevice = useTouchDevice();
    const [isHovered, setIsHovered] = useState(false);
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

    const theme = useMemo(() => {
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
    }, [colorClass]);
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover="hover"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            transition={{ duration: 0.35 }}
            className={cn(
                "relative group bg-zinc-900/90 sm:bg-zinc-900/10 backdrop-blur-none sm:backdrop-blur-2xl border border-white/5 rounded-[5px] flex shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer",
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

            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 overflow-hidden">
                {lottie && !isTouchDevice && (
                    <div className={cn(
                        "absolute inset-0 pointer-events-none transition-all duration-700 overflow-hidden",
                        isHovered
                            ? (colorClass.includes('red') ? "opacity-80 group-hover:opacity-100 visible" : "opacity-30 group-hover:opacity-50 visible")
                            : "opacity-0 invisible"
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
                    "ubuntu-bold font-black text-white tracking-tighter tabular-nums mb-0.5 drop-shadow-sm leading-none whitespace-nowrap transition-all duration-500",
                    horizontal ? "text-lg" : "text-2xl",
                    "group-hover:drop-shadow-[0_0_10px_white]"
                )}>
                    {value}
                </span>
                <span className="text-[8.5px] ubuntu-bold font-black text-zinc-500 uppercase tracking-[0.15em] group-hover:text-zinc-300 transition-all duration-500 leading-none truncate w-full">
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
});

const formatFocusedTime = (totalMinutes: number) => {
    if (totalMinutes < 60) return `${totalMinutes}m`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

const parseCompletedAt = (completedAt: any): Date | null => {
    if (!completedAt) return null;
    if (completedAt instanceof Date) return completedAt;
    if (typeof completedAt.toDate === "function") return completedAt.toDate();
    if (typeof completedAt.seconds === "number") return new Date(completedAt.seconds * 1000);
    if (typeof completedAt._seconds === "number") return new Date(completedAt._seconds * 1000);
    if (typeof completedAt === "string" || typeof completedAt === "number") return new Date(completedAt);
    return null;
};

// --- Page ---

function ProfileContent() {
    const showTourButton = useTimerStore((s) => s.showTourButton);
    const isTouchDevice = useTouchDevice();
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

    const isOnline = (timestamp?: UserProfileData["lastActive"] | null) => {
        if (!timestamp) return false;
        const lastActive = timestamp instanceof Date ? timestamp : timestamp.toDate?.();
        if (!lastActive) return false;
        // 10 minute threshold accounts for slow heartbeats or clock drift
        return currentTime - lastActive.getTime() <= 10 * 60 * 1000;
    };
    const [loading, setLoading] = useState(true);
    const [isOwnProfile, setIsOwnProfile] = useState(true);

    const tourSteps = useMemo(() => {
        const steps: TourStep[] = [
            {
                popover: {
                    title: "Welcome to Your Profile",
                    description: "View streaks, heatmaps, and charts of your focus history. Customize your profile theme.",
                },
            },
            {
                element: "#profile-identity",
                popover: {
                    title: "Your Identity Hub",
                    description: "This is where your nickname, avatar scan, and bio reside. You can also customize your workspace theme here.",
                    side: "bottom",
                    align: "center",
                },
            },
        ];

        if (isOwnProfile) {
            steps.push({
                element: "#btn-edit-profile",
                popover: {
                    title: "Edit Profile",
                    description: "Click here to modify your display details, upload a custom picture, and pick a custom accent color theme.",
                    side: "bottom",
                    align: "center",
                },
            });
        }

        steps.push(
            {
                element: "#profile-stats-grid",
                popover: {
                    title: "Combustion Streaks & Metrics",
                    description: "Monitor your active combustion days, total sessions completed, and cumulative focused uptime hours.",
                    side: "left",
                    align: "center",
                },
            },
            {
                element: "#profile-heatmap-container",
                popover: {
                    title: "Activity Heatmap",
                    description: "View your daily focus loading and concentration density over the past several months.",
                    side: "top",
                    align: "center",
                },
            },
            {
                element: "#profile-streak-calendar",
                popover: {
                    title: "Streak Timeline",
                    description: "Track your daily consistency. Green-highlighted days indicate focused activity this month.",
                    side: "left",
                    align: "center",
                },
            },
            {
                element: "#profile-chart-section",
                popover: {
                    title: "Focus Trends",
                    description: "Analyze your progression charts segmented by Days, Weeks, or Months.",
                    side: "top",
                    align: "center",
                },
            },
        );

        return steps;
    }, [isOwnProfile]);

    const { resetTour, startTour } = useTour({ pageName: "profile", steps: tourSteps });
    const handleRestartTour = () => {
        resetTour();
        startTour();
    };

    const [friendStatus, setFriendStatus] = useState<FriendStatus | null>(null);

    // Cropping State
    const [image, setImage] = useState<string | null>(null);
    const [unfriendConfirmOpen, setUnfriendConfirmOpen] = useState(false);
    const [removePhotoConfirmOpen, setRemovePhotoConfirmOpen] = useState(false);

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
    const [isFriendsHovered, setIsFriendsHovered] = useState(false);

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
                const [status, isFriend] = await Promise.all([
                    getFriendRequestStatus(user.uid, effectiveUserId),
                    areFriends(user.uid, effectiveUserId)
                ]);
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
                    const docs = snap.docs.map((d) => d.data() as FriendRequestDoc);
                    const req = docs.find((r) => r.status === "pending");
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

            // Sync sessions, friends, and stats data in parallel
            const [history, friendsData, userDoc] = await Promise.all([
                getSessionHistory(effectiveUserId, 365) as Promise<SessionData[]>,
                getFriendsListSimple(effectiveUserId),
                getDoc(doc(db, "users", user.uid))
            ]);
            if (!active) return;
            setSessions(history);
            setFriends(friendsData);
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
                const sessionDate = parseCompletedAt(session.completedAt);
                if (sessionDate) {
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
        const sortedDates = sessions
            .map(s => parseCompletedAt(s.completedAt))
            .filter((d): d is Date => d !== null)
            .map(d => startOfDay(d).getTime());
        const uniqueDates = [...new Set(sortedDates)].sort((a, b) => b - a);

        let streak = 0;
        const today = startOfDay(new Date());
        let currentRef = today;

        // Check if user has focused today or yesterday to continue the streak
        const lastSessionDate = new Date(uniqueDates[0]);
        if (differenceInDays(today, lastSessionDate) > 1) return 0;

        for (let i = 0; i < uniqueDates.length; i++) {
            const date = new Date(uniqueDates[i]);
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
                const sDate = parseCompletedAt(s.completedAt);
                return sDate ? isSameDay(sDate, date) : false;
            });
            const totalMins = daySessions.reduce((acc, curr) => acc + curr.duration, 0);
            let level = 0;
            if (totalMins > 0) {
                if (totalMins < 30) level = 1;
                else if (totalMins < 120) level = 2;
                else level = 3;
            }

            const tooltipText = `${format(date, 'MMM d')}: ${formatFocusedTime(totalMins)} focused`;

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
            ...days.map(date => {
                const hasActivity = sessions.some(s => {
                    const sDate = parseCompletedAt(s.completedAt);
                    return sDate ? isSameDay(sDate, date) : false;
                });
                return {
                    date,
                    isToday: isSameDay(date, now),
                    hasActivity,
                    day: format(date, 'd')
                };
            })
        ];
    }, [sessions]);

    // --- Handlers ---

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const objectUrl = URL.createObjectURL(file);
        setImage(objectUrl);
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

    // --- Render ---

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
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

    const effectiveId = targetUserId || user?.uid;
    const isNa3iMo = effectiveId === 'wtdNPy3VSGWlVDgANbHohYfl0492';
    const currentTheme = THEMES[selectedTheme] || THEMES.obsidian;

    return (
        <BackgroundTheme>
            <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-x-hidden">

                {/* Immersive Background Elements */}
                <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-screen pointer-events-none z-0 hidden sm:block">
                    <div
                        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-pulse-slow transition-colors duration-1000"
                        style={{ backgroundColor: `${currentTheme.accent}11` }}
                    />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                </div>

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="profile-loader"
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35, ease: "easeInOut" }}
                            className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-[999] min-h-screen"
                        >
                            <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
                        </motion.div>
                    ) : (
                        <motion.main
                            key="profile-content"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="relative z-10 flex flex-col items-center pb-32 px-6 w-full flex-1 max-w-6xl mx-auto pt-20"
                        >

                            {/* --- IDENTITY HUB --- */}
                            <section id="profile-identity" className="w-full flex flex-col lg:flex-row items-center lg:items-start gap-12 mb-20 px-2 relative">
                                <div className="flex-1 flex flex-col md:flex-row items-center md:items-start gap-12 w-full">

                                    {/* Avatar & Actions Side */}
                                    <div className="flex flex-col items-center gap-6 shrink-0 z-20">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                            className="relative group flex items-center gap-6"
                                        >
                                            {/* Theme Picker - Left Side of Avatar when Editing */}
                                            <AnimatePresence>
                                                {isEditing && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        className="flex flex-col gap-4 items-center md:absolute md:right-full md:mr-4 lg:mr-8"
                                                    >
                                                        <div className="flex flex-col gap-3">
                                                            {Object.entries(THEMES).map(([id, t]) => {
                                                                const isSelected = selectedTheme === id;
                                                                return (
                                                                    <button
                                                                        key={id}
                                                                        onClick={() => setSelectedTheme(id)}
                                                                        className={cn(
                                                                            "w-10 h-10 rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-0.5 overflow-hidden group/theme",
                                                                            isSelected
                                                                                ? "border-2 bg-white/5 scale-[1.05] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                                                                : "border border-white/5 bg-zinc-950/50 hover:border-white/20"
                                                                        )}
                                                                        style={isSelected ? { borderColor: t.accent } : undefined}
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
                                                                );
                                                            })}
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
                                                    className={cn(
                                                        "w-40 h-40 md:w-48 md:h-48 border relative z-10 overflow-hidden transition-all duration-500",
                                                        isNa3iMo
                                                            ? "rounded-full border-none"
                                                            : "rounded-[2.2rem] border-white/10 group-hover:border-white/30"
                                                    )}
                                                >
                                                    <AvatarImage
                                                        src={getHighQualityAvatarUrl(userData?.photoURL || (isOwnProfile ? user.photoURL : undefined), 256)}
                                                        className={cn(
                                                            "object-cover w-full h-full scale-100 group-hover:scale-105 transition-transform duration-[2s] ease-out",
                                                            isNa3iMo ? "rounded-full" : "rounded-[2.2rem]"
                                                        )}
                                                    />
                                                    <AvatarFallback
                                                        className={cn(
                                                            "bg-zinc-900 font-black text-6xl text-white transition-all group-hover:bg-zinc-800",
                                                            isNa3iMo ? "rounded-full" : "rounded-[2.2rem]"
                                                        )}
                                                    >
                                                        {userData?.displayName?.charAt(0) || user.displayName?.charAt(0) || "D"}
                                                    </AvatarFallback>

                                                    {isEditing && (
                                                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-30">
                                                            <label className="flex flex-col items-center cursor-pointer">
                                                                <Camera className="w-10 h-10 text-white mb-3" />
                                                                <span className="text-[10px] ubuntu-bold font-black tracking-widest uppercase">Update Scan</span>
                                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                                            </label>
                                                            {userData?.photoURL && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setRemovePhotoConfirmOpen(true); }}
                                                                    className="mt-3 text-[10px] ubuntu-bold font-black tracking-widest uppercase text-zinc-400 hover:text-white transition-colors"
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </Avatar>

                                                {isNa3iMo && (
                                                    <img
                                                        src={frameBorder.src}
                                                        alt=""
                                                        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20 rounded-full scale-[1.04]"
                                                        draggable={false}
                                                    />
                                                )}

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
                                            <div className="flex flex-col gap-2.5 min-w-[8rem] w-auto md:w-40 items-center z-30">
                                                {friendStatus?.isFriend ? (
                                                    <Button
                                                        onClick={() => setUnfriendConfirmOpen(true)}
                                                        className="w-full h-9 rounded-full bg-green-500/20 text-green-400 ubuntu-bold font-black text-[11px] tracking-widest border border-green-500/20 uppercase hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/20 group cursor-pointer transition-colors"
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
                                                            className="w-full h-9 rounded-full ubuntu-bold font-black text-[11px] tracking-widest uppercase border transition-colors bg-yellow-500/20 text-yellow-400 border-yellow-500/20 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/20 group cursor-pointer"
                                                        >
                                                            <Timer className="w-2.5 h-2.5 mr-2 group-hover:hidden" />
                                                            <UserMinus className="w-2.5 h-2.5 mr-2 hidden group-hover:block" />
                                                            <span className="group-hover:hidden">Pending</span>
                                                            <span className="hidden group-hover:block">Cancel</span>
                                                        </Button>
                                                    ) : (
                                                        <div className="flex w-full gap-2">
                                                            <motion.div
                                                                whileTap={{ scale: 0.98 }}
                                                                className="flex-1"
                                                            >
                                                                <Button
                                                                    onClick={async () => {
                                                                        const { getFriendRequest, acceptFriendRequest } = await import("@/lib/friendship");
                                                                        const req = await getFriendRequest(targetUserId!, user.uid);
                                                                        if (req && await acceptFriendRequest(req.id, targetUserId!, user.uid)) {
                                                                            toast.success("Friend request accepted");
                                                                        }
                                                                    }}
                                                                    className="w-full h-9 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white ubuntu-bold font-black text-[11px] tracking-widest transition-all border border-white/20 relative overflow-hidden group/btn cursor-pointer shadow-xl"
                                                                >
                                                                    <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] -translate-x-full group-hover/btn:animate-shine transition-transform" />
                                                                    <span className="relative z-10 uppercase">Accept</span>
                                                                </Button>
                                                            </motion.div>
                                                            <motion.div
                                                                whileTap={{ scale: 0.98 }}
                                                                className="flex-1"
                                                            >
                                                                <Button
                                                                    onClick={async () => {
                                                                        const { getFriendRequest, declineFriendRequest } = await import("@/lib/friendship");
                                                                        const req = await getFriendRequest(targetUserId!, user.uid);
                                                                        if (req && await declineFriendRequest(req.id)) {
                                                                            toast.success("Friend request declined");
                                                                        }
                                                                    }}
                                                                    className="w-full h-9 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all backdrop-blur-sm group/btn relative overflow-hidden text-[11px] ubuntu-bold font-black tracking-widest cursor-pointer active:translate-y-0"
                                                                >
                                                                    <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/20 group-hover/btn:border-white/40 pointer-events-none transition-colors duration-300" />
                                                                    <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />
                                                                    <span className="relative z-10 uppercase">Decline</span>
                                                                </Button>
                                                            </motion.div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <motion.div
                                                        whileTap={{ scale: 0.98 }}
                                                        className="w-full"
                                                    >
                                                        <Button
                                                            onClick={async () => {
                                                                const { sendFriendRequest } = await import("@/lib/friendship");
                                                                const success = await sendFriendRequest(user.uid, targetUserId!);
                                                                if (success) {
                                                                    toast.success("Friend request sent!");
                                                                    setFriendStatus({ ...friendStatus, status: "pending", direction: "sent" });
                                                                }
                                                            }}
                                                            className="w-full h-9 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white ubuntu-bold font-black text-[11px] tracking-widest transition-all border border-white/20 relative shadow-xl overflow-hidden group/btn cursor-pointer"
                                                        >
                                                            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] -translate-x-full group-hover/btn:animate-shine transition-transform" />
                                                            <div className="flex items-center justify-center gap-2 relative z-10 uppercase">
                                                                <Users className="w-2.5 h-2.5" />
                                                                Add Friend
                                                            </div>
                                                        </Button>
                                                    </motion.div>
                                                )}
                                            </div>
                                        ) : !isEditing && (
                                            <div className="flex flex-col gap-2.5 min-w-[8rem] w-auto md:w-40 items-center z-30">
                                                <motion.div
                                                    whileTap={{ scale: 0.98 }}
                                                    className="w-full"
                                                >
                                                    <Button
                                                        id="btn-edit-profile"
                                                        onClick={() => setIsEditing(true)}
                                                        className="w-full h-9 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white ubuntu-bold font-black text-[11px] tracking-widest transition-all border border-white/20 relative shadow-xl overflow-hidden group/btn cursor-pointer"
                                                    >
                                                        <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] -translate-x-full group-hover/btn:animate-shine transition-transform" />
                                                        <div className="flex items-center justify-center gap-2 relative z-10 uppercase">
                                                            <Pencil className="w-2.5 h-2.5" />
                                                            Edit Profile
                                                        </div>
                                                    </Button>
                                                </motion.div>

                                                <motion.div
                                                    whileTap={{ scale: 0.98 }}
                                                    className="w-full"
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`${window.location.origin}/profile?user=${user.uid}`);
                                                            toast.success("Profile link copied!");
                                                        }}
                                                        className="w-full h-9 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all backdrop-blur-sm group/btn relative overflow-hidden text-[11px] ubuntu-bold font-black tracking-widest cursor-pointer active:translate-y-0"
                                                    >
                                                        {/* Glass highlights matching notification button */}
                                                        <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/20 group-hover/btn:border-white/40 pointer-events-none transition-colors duration-300" />
                                                        <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />

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
                                                    className="bg-transparent border-b border-white/10 text-4xl md:text-5xl font-black text-white tracking-tighter focus:outline-none focus:border-white/30 transition-all w-full py-1 h-16"
                                                />

                                                <textarea
                                                    value={editBio}
                                                    onChange={e => setEditBio(e.target.value)}
                                                    placeholder="Write your bio..."
                                                    rows={2}
                                                    className="bg-transparent border-b border-white/5 text-sm font-medium text-zinc-400 leading-relaxed focus:outline-none focus:border-white/20 transition-all w-full py-2 resize-none scrollbar-none"
                                                />

                                                <div className="flex items-center gap-4 mt-4">
                                                    <Button
                                                        onClick={handleSaveProfile}
                                                        disabled={isSaving}
                                                        className="h-12 px-10 rounded-2xl bg-white text-black hover:bg-zinc-200 ubuntu-bold font-black uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all flex items-center gap-2"
                                                    >
                                                        {isSaving ? "Syncing..." : "Save"}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => setIsEditing(false)}
                                                        className="h-12 px-8 rounded-2xl border border-white/10 text-zinc-400 ubuntu-bold font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex flex-col items-center md:items-start w-full max-w-2xl"
                                            >
                                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-4 drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] mt-2">
                                                    {userData?.displayName || "New Pilot"}
                                                </h1>


                                                <p className="text-zinc-400 text-sm md:text-base font-medium leading-[1.8] mb-14 max-w-2xl break-all">
                                                    {userData?.bio || "No bio yet."}
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                <motion.div
                                    id="profile-stats-grid"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.35 }}
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
                                            transition={{ duration: 0.35 }}
                                            onMouseEnter={() => setIsFriendsHovered(true)}
                                            onMouseLeave={() => setIsFriendsHovered(false)}
                                            className={cn(
                                                "relative group bg-zinc-900/90 sm:bg-zinc-900/10 backdrop-blur-none sm:backdrop-blur-2xl border border-white/5 rounded-[5px] flex items-center justify-between p-3 px-5 shadow-2xl transition-all duration-500 h-full min-h-[80px] overflow-hidden",
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
                                                    {!isTouchDevice && (
                                                        <div className={cn("w-full h-full transition-all duration-700", isFriendsHovered ? "opacity-100 visible" : "opacity-0 invisible")}>
                                                            <DotLottieReact
                                                                src="https://lottie.host/57f88543-91fb-4d6d-a8a3-5c0be150cdcf/R5RnYeBnGD.lottie"
                                                                autoplay
                                                                loop
                                                                style={{ width: "100%", height: "100%" }}
                                                            />
                                                        </div>
                                                    )}
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
                                                        <span className="text-xl ubuntu-bold font-black text-white tracking-tighter tabular-nums leading-none">
                                                            {friends.length}
                                                        </span>
                                                    </div>
                                                    <span className="text-[7.5px] ubuntu-bold font-black text-zinc-600 uppercase tracking-[0.2em] mt-1 group-hover:text-zinc-400 transition-colors">
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
                                    id="profile-heatmap-container"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.35 }}
                                    onMouseMove={(e) => {
                                        if (isTouchDevice) return;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const y = e.clientY - rect.top;
                                        e.currentTarget.style.setProperty("--x", `${x}px`);
                                        e.currentTarget.style.setProperty("--y", `${y}px`);
                                    }}
                                    className="lg:col-span-8 border rounded-2xl p-8 pb-12 flex flex-col relative overflow-hidden group/card"
                                    style={{
                                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                                        background: `radial-gradient(circle at 90% 10%, ${currentTheme.accent}0f, transparent 70%), #040405`,
                                        borderColor: `${currentTheme.accent}22`
                                    }}
                                >
                                    {/* Top-Right Ambient Glow Source */}
                                    <div
                                        className="absolute -top-[15%] -right-[10%] w-[50%] h-[50%] rounded-full opacity-[0.18] pointer-events-none transition-colors duration-1000 z-0 hidden sm:block"
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

                                    <div className="w-full overflow-x-auto scrollbar-none pb-2 select-none -webkit-overflow-scrolling-touch">
                                        <div className="relative min-w-[560px] h-[130px] sm:h-[180px] mt-8">
                                            {/* Months row */}
                                            <div className="text-[10px] font-bold text-zinc-600 mb-3 whitespace-nowrap absolute top-0 w-full flex">
                                                {heatmapMonths.map((m, idx) => (
                                                    <div key={idx} className="absolute" style={{ left: `calc(${m.colIndex} * (100% / 20))` }}>
                                                        {m.label}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Grid */}
                                            <div className="grid grid-rows-7 grid-flow-col gap-1.5 w-full h-[90px] sm:h-[140px] absolute bottom-0">
                                                {productivityData.map((day, i) => {
                                                    const colIndex = Math.floor(i / 7);
                                                    const isFarLeft = colIndex < 2;
                                                    const isFarRight = colIndex > 17;
                                                    return (
                                                        <div key={i} className="w-full h-full flex items-center justify-center relative group/day">
                                                            <div
                                                                className="w-[8px] h-[8px] sm:w-full sm:h-full md:w-auto md:aspect-square lg:w-full lg:aspect-auto rounded-[1.5px] sm:rounded-[3px] transition-all duration-300 pointer-events-none relative z-10"
                                                                style={{
                                                                    backgroundColor: day.level > 0 ? currentTheme.accent : "rgba(255,255,255,0.06)",
                                                                    opacity: day.level === 0 ? 1 : day.level === 1 ? 0.35 : day.level === 2 ? 0.65 : 1,
                                                                    boxShadow: day.level > 1 ? `0 0 -8px ${currentTheme.accent}33` : 'none',
                                                                }}
                                                            />
                                                            {day.level > 0 && (
                                                                <div
                                                                    className="absolute w-[8px] h-[8px] sm:w-full sm:h-full md:w-auto md:h-full md:aspect-square lg:w-full lg:aspect-auto blur-[6px] opacity-[0.15] pointer-events-none hidden sm:block"
                                                                    style={{ backgroundColor: currentTheme.accent }}
                                                                />
                                                            )}

                                                            {/* Custom Styled Tooltip */}
                                                            <div
                                                                className={cn(
                                                                    "pointer-events-none absolute bottom-full pb-2 z-50 opacity-0 scale-95 translate-y-1 group-hover/day:opacity-100 group-hover/day:scale-100 group-hover/day:translate-y-0 transition-all duration-200 ease-out flex flex-col",
                                                                    isFarLeft ? "left-0 translate-x-0" : isFarRight ? "right-0 translate-x-0" : "left-1/2 -translate-x-1/2 items-center"
                                                                )}
                                                            >
                                                                <div
                                                                    className="bg-zinc-950/95 border text-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md p-3 min-w-[130px] flex flex-col gap-1 transition-colors duration-300 relative z-10"
                                                                    style={{ borderColor: `${currentTheme.accent}33` }}
                                                                >
                                                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider leading-none">
                                                                        {format(day.date, 'eee, MMM d')}
                                                                    </span>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <div
                                                                            className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                            style={{
                                                                                backgroundColor: day.level > 0 ? currentTheme.accent : "rgba(255,255,255,0.15)",
                                                                                boxShadow: day.level > 0 ? `0 0 8px ${currentTheme.accent}` : "none"
                                                                            }}
                                                                        />
                                                                        <span className="text-[11px] font-extrabold text-white leading-none">
                                                                            {day.minutes > 0 ? formatFocusedTime(day.minutes) : "0m"}
                                                                        </span>
                                                                        <span className="text-[9px] font-medium text-zinc-400 leading-none">
                                                                            focused
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className={cn(
                                                                        "w-1.5 h-1.5 rotate-45 border-r border-b bg-zinc-950/95 absolute bottom-[5px] z-0 transition-colors duration-300",
                                                                        isFarLeft ? "left-3" : isFarRight ? "right-3" : "left-1/2 -translate-x-1/2"
                                                                    )}
                                                                    style={{ borderColor: `${currentTheme.accent}33` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Streak Calendar Terminal */}
                                <motion.div
                                    id="profile-streak-calendar"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.35 }}
                                    onMouseMove={(e) => {
                                        if (isTouchDevice) return;
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
                                        className="absolute -top-[15%] -left-[15%] w-[60%] h-[60%] rounded-full opacity-[0.22] pointer-events-none transition-colors duration-1000 z-0 hidden sm:block"
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

                                    <div className="flex items-center justify-between mb-8 sm:mb-16 relative z-10 w-full">
                                        <div className="flex items-center gap-3">
                                            <div className="w-[3px] h-5 rounded-full" style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 12px ${currentTheme.accent}66` }} />
                                            <Calendar className="w-5 h-5 stroke-[2.5] opacity-60" style={{ color: currentTheme.accent }} />
                                            <h3 className="text-[15px] font-extrabold text-white tracking-tight leading-none">Streak Timeline</h3>
                                        </div>
                                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                            {format(new Date(), 'MMMM')}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-2 max-w-[280px] xs:max-w-[320px] sm:max-w-sm mx-auto w-full">
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                            <div key={i} className="text-[9px] sm:text-[10px] font-black text-zinc-700 text-center uppercase pb-3">
                                                {day}
                                            </div>
                                        ))}
                                        {monthDays.map((day, i) => (
                                            <div key={i} className="aspect-square flex items-center justify-center relative">
                                                {day && (
                                                    <>
                                                        {/* Base day indicator */}
                                                        <div
                                                            className="w-full h-full rounded-lg sm:rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300"
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
                                    id="profile-chart-section"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.35 }}
                                    onMouseMove={(e) => {
                                        if (isTouchDevice) return;
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
                                        className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full opacity-[0.22] pointer-events-none transition-colors duration-1000 z-0 hidden sm:block"
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

                                        <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-1 bg-[#040405] p-1.5 rounded-full border border-white/5 backdrop-blur-2xl shadow-xl relative overflow-hidden">
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
                                                        "flex-1 md:flex-none flex items-center justify-center px-4 sm:px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 relative group/tab",
                                                        timeRange === tab.id
                                                            ? ""
                                                            : "text-zinc-500 hover:text-white/70"
                                                    )}
                                                    style={timeRange === tab.id ? { color: currentTheme.text || "#FFFFFF" } : undefined}
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

                                    <div className="h-[220px] sm:h-[400px] w-full mt-4 relative group/chart">
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

                                                <ProfileChart
                                                    timeRange={timeRange}
                                                    weekData={weekData}
                                                    monthData={monthData}
                                                    yearData={yearData}
                                                    currentTheme={currentTheme}
                                                    isTouchDevice={isTouchDevice}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>



                            </motion.div>
                        </motion.main>
                    )}
                </AnimatePresence>

                {/* Cropping Modal */}
                <AnimatePresence>
                    {image && (
                        <ProfilePicCropperModal
                            image={image}
                            currentTheme={currentTheme}
                            onClose={() => {
                                if (image.startsWith('blob:')) URL.revokeObjectURL(image);
                                setImage(null);
                            }}
                            onConfirm={async (base64Image) => {
                                if (!user) return;
                                try {
                                    toast.loading("Forging identity...", { id: "upload" });
                                    await updateProfilePictureBase64(user.uid, base64Image);
                                    toast.success("Updated!", { id: "upload" });
                                    if (image.startsWith('blob:')) URL.revokeObjectURL(image);
                                    setImage(null);
                                } catch {
                                    toast.error("Failed.", { id: "upload" });
                                }
                            }}
                        />
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

            {/* Remove Photo Confirmation Dialog */}
            <Dialog open={removePhotoConfirmOpen} onOpenChange={setRemovePhotoConfirmOpen}>
                <DialogContent className="rounded-[5px] bg-zinc-900 border border-white/10 text-zinc-100 max-w-[350px]">
                    <DialogHeader>
                        <DialogTitle className="ubuntu-bold text-zinc-100">Remove profile photo?</DialogTitle>
                        <DialogDescription className="ubuntu-regular text-zinc-400">
                            Your avatar will show your initials instead.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="rounded-b-[5px] bg-transparent border-t border-white/10 p-3 pt-4 gap-2 sm:justify-end flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setRemovePhotoConfirmOpen(false)}
                            className="flex-1 sm:flex-none h-9 rounded-[5px] border-white/15 px-4 ubuntu-medium text-zinc-300 hover:bg-white/5 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!user) return;
                                const { removeProfilePicture } = await import("@/lib/db");
                                setRemovePhotoConfirmOpen(false);
                                toast.loading("Removing photo...", { id: "remove-photo" });
                                const ok = await removeProfilePicture(user.uid);
                                if (ok) {
                                    toast.success("Photo removed!", { id: "remove-photo" });
                                    setUserData(prev => prev ? { ...prev, photoURL: undefined } : prev);
                                } else {
                                    toast.error("Failed to remove photo.", { id: "remove-photo" });
                                }
                            }}
                            className="flex-1 sm:flex-none h-9 rounded-[5px] border border-red-500/30 bg-red-500/15 px-4 ubuntu-medium text-red-300 hover:bg-red-500/25 hover:text-red-200"
                        >
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Help/Tour Button */}
            {showTourButton && (
              <div className="fixed bottom-8 md:bottom-6 left-6 z-50">
                <button
                    onClick={handleRestartTour}
                    className="h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all backdrop-blur-md shadow-2xl flex items-center justify-center cursor-pointer"
                    title="Restart Page Tour"
                >
                    <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
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
