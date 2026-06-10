"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { 
    Trophy, Zap, Clock, Medal, Sprout, Leaf, Flower2, ChevronRight, 
    TrendingUp, Search, Info, Users, Briefcase, ChevronLeft, Calendar 
} from "lucide-react";
import { getLeaderboard, getGroupLeaderboard, fetchUserProfiles } from "@/lib/db";
import { getFriendsLeaderboard } from "@/lib/friendship";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getHighQualityAvatarUrl, getTimeUntilReset } from "@/lib/utils";
import { syncUserProfile } from "@/lib/db";
import { useAuth } from "@/components/AuthProvider";
import { ProfileStatsCard } from "@/components/profile-stats-card";
import { AuthRequired } from "@/components/auth-required";
import { BackgroundTheme } from "@/components/background-theme";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, orderBy, limit } from "firebase/firestore";

type LeaderboardTab = "weekly" | "alltime" | "friends" | "pastweeks";

function LeaderboardContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [photosLoading, setPhotosLoading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20);
    const searchParams = useSearchParams();
    
    // Initial tab based on URL or default
    const [activeTab, setActiveTab] = useState<LeaderboardTab>(
        (searchParams.get("tab") as LeaderboardTab) || "weekly"
    );
    
    // Group drill-down state (unused but preserved for compatibility/URL params if referenced elsewhere)
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

    // Past weeks history state
    const [pastWeeksList, setPastWeeksList] = useState<any[]>([]);
    const [selectedPastWeekId, setSelectedPastWeekId] = useState<string | null>(null);
    const [pastWeekPlayers, setPastWeekPlayers] = useState<any[]>([]);
    const [pastWeekLoading, setPastWeekLoading] = useState(false);
    const [resetCountdown, setResetCountdown] = useState("");

    // Reset drill-downs and loading states when tab changes
    useEffect(() => {
        setSelectedGroup(null);
        setSelectedPastWeekId(null);
        setPastWeekPlayers([]);
        if (activeTab === "weekly") {
            router.replace("/leaderboard?tab=weekly");
        } else if (activeTab === "alltime") {
            router.replace("/leaderboard?tab=alltime");
        } else if (activeTab === "friends") {
            router.replace("/leaderboard?tab=friends");
        } else if (activeTab === "pastweeks") {
            router.replace("/leaderboard?tab=pastweeks");
        }
    }, [activeTab]);

    // Countdown timer effect
    useEffect(() => {
        if (activeTab !== "weekly") {
            setResetCountdown("");
            return;
        }

        const updateTimer = () => {
            setResetCountdown(getTimeUntilReset());
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 60000);
        return () => clearInterval(intervalId);
    }, [activeTab]);

    const tabParam = searchParams.get("tab");
    const groupIdParam = searchParams.get("groupId");

    // Fetch past weeks list helper
    const fetchPastWeeks = async () => {
        try {
            const q = query(
                collection(db, "leaderboard_history"),
                orderBy("weekStart", "desc"),
                limit(10)
            );
            const snap = await getDocs(q);
            const weeks = snap.docs.map(d => {
                const data = d.data();
                const date = data.weekStart?.toDate ? data.weekStart.toDate() : new Date();
                return {
                    id: d.id,
                    label: data.label || `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                    weekStart: date
                };
            });
            setPastWeeksList(weeks);
        } catch (err) {
            console.error("Error fetching past weeks list:", err);
        }
    };

    // Lazy load specific past week rankings
    const handlePastWeekClick = async (weekId: string) => {
        setSelectedPastWeekId(weekId);
        setPastWeekLoading(true);
        try {
            const docRef = doc(db, "leaderboard_history", weekId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                const weekPlayers = data.players || data.data || [];
                // Shows top 10 for that week
                setPastWeekPlayers(weekPlayers.slice(0, 10));
            } else {
                setPastWeekPlayers([]);
            }
        } catch (err) {
            console.error("Error loading past week leaderboard:", err);
            setPastWeekPlayers([]);
        } finally {
            setPastWeekLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const hydratePhotos = (data: any[]) => {
            const uids = data.map((p: any) => p.uid).filter(Boolean);
            if (uids.length === 0) return;
            
            setPhotosLoading(true);
            fetchUserProfiles(uids).then((profiles) => {
                if (!isMounted) return;
                const photoMap = new Map(profiles.map(p => [p.uid, p.photoURL]));
                
                setPlayers(currentPlayers => {
                    return currentPlayers.map(p => {
                        const freshPhoto = photoMap.get(p.uid);
                        if (freshPhoto !== undefined && freshPhoto !== p.photoURL) {
                            return { ...p, photoURL: freshPhoto };
                        }
                        return p;
                    });
                });
            }).catch((err) => {
                console.error("Error hydrating photos in background:", err);
            }).finally(() => {
                if (isMounted) setPhotosLoading(false);
            });
        };
        
        const fetchTops = async () => {
            if (authLoading || !user || user.isAnonymous) return;

            let cachedData: any[] | null = null;
            try {
                if (typeof window !== "undefined") {
                    if (activeTab === "weekly") {
                        const raw = sessionStorage.getItem("dangdoro_weekly_leaderboard_cache");
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.data) {
                                cachedData = parsed.data.filter((p: any) => !p.isAnonymous);
                            }
                        }
                    } else if (activeTab === "alltime") {
                        const raw = sessionStorage.getItem("dangdoro_alltime_leaderboard_cache");
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.data) {
                                cachedData = parsed.data.filter((p: any) => !p.isAnonymous);
                            }
                        }
                    } else if (activeTab === "friends") {
                        const raw = sessionStorage.getItem("dangdoro_friends_leaderboard_cache");
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) {
                                const entry = parsed.find(([key]) => key.startsWith(user.uid));
                                if (entry && entry[1] && entry[1].data) {
                                    cachedData = entry[1].data;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Error reading leaderboard cache:", e);
            }

            if (cachedData && cachedData.length > 0) {
                setPlayers(cachedData);
                setLoading(false);
                hydratePhotos(cachedData);
            } else {
                setLoading(true);
                setPlayers([]);
            }
            setVisibleCount(20);

            if (user && user.isAnonymous) {
                await syncUserProfile(user);
            }

            const groupIdFromUrl = searchParams.get("groupId");

            if (selectedGroup || (groupIdFromUrl && activeTab as any === "groups")) {
                let groupToLoad = selectedGroup;
                
                if (!groupToLoad && groupIdFromUrl) {
                    const allGroups = await getGroupLeaderboard({ limitCount: 100 });
                    groupToLoad = allGroups.find(g => g.id === groupIdFromUrl);
                    if (groupToLoad && isMounted) setSelectedGroup(groupToLoad);
                }

                if (groupToLoad && isMounted) {
                    const memberUids = groupToLoad.members || [];
                    const profiles: any = await fetchUserProfiles(memberUids);
                    
                    const rankedMembers = memberUids.map((uid: string) => {
                        const profile = profiles.find((p: any) => p.uid === uid) || {};
                        const stats = groupToLoad.memberStats?.[uid] || { totalMinutes: 0 };
                        return {
                            ...profile,
                            ...stats,
                            displayName: profile.displayName || stats.displayName || "Member",
                            photoURL: profile.photoURL || stats.photoURL || null,
                            uid
                        };
                    }).sort((a: any, b: any) => (b.totalMinutes || 0) - (a.totalMinutes || 0));

                    setPlayers(rankedMembers);
                }
            } else if (activeTab === "weekly") {
                const tops = await getLeaderboard(150, "weekly");
                if (isMounted) {
                    const nonGuests = tops.filter(
                        (player: any) => !player.isAnonymous
                    );
                    setPlayers(nonGuests);
                    hydratePhotos(nonGuests);
                }
            } else if (activeTab === "alltime") {
                const tops = await getLeaderboard(150, "alltime");
                if (isMounted) {
                    const nonGuests = tops.filter(
                        (player: any) => !player.isAnonymous
                    );
                    setPlayers(nonGuests);
                    hydratePhotos(nonGuests);
                }
            } else if (activeTab === "friends") {
                const friendsTops = await getFriendsLeaderboard(user!.uid, 200);
                if (isMounted) {
                    setPlayers(friendsTops);
                    hydratePhotos(friendsTops);
                }
            } else if (activeTab === "pastweeks") {
                if (isMounted) {
                    await fetchPastWeeks();
                }
            }
            if (isMounted) setLoading(false);
        };
        fetchTops();
        
        return () => {
            isMounted = false;
        };
    }, [user, authLoading, activeTab, selectedGroup, tabParam, groupIdParam]);

    const handleSeeMore = () => {
        setVisibleCount(prev => prev + 20);
    };

    const { topThree, others, userRank, currentUserData, podiumOrder } = useMemo(() => {
        const top3 = players.slice(0, 3);
        const rest = players.slice(3);
        const rank = players.findIndex(p => p.uid === user?.uid);
        const current = players[rank];
        const podium = [top3[1], top3[0], top3[2]].filter(Boolean);
        return { topThree: top3, others: rest, userRank: rank, currentUserData: current, podiumOrder: podium };
    }, [players, user?.uid]);

    const { pastWeekTopThree, pastWeekOthers, pastWeekPodiumOrder } = useMemo(() => {
        const top3 = pastWeekPlayers.slice(0, 3);
        const rest = pastWeekPlayers.slice(3);
        const podium = [top3[1], top3[0], top3[2]].filter(Boolean);
        return { pastWeekTopThree: top3, pastWeekOthers: rest, pastWeekPodiumOrder: podium };
    }, [pastWeekPlayers]);

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Leaderboard restricted" description="Sign in to view global rankings and community focus stats." />
            </main>
        </div>
    );

    return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                {/* Background Atmosphere - Balanced Neutral Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-zinc-900/40 to-transparent pointer-events-none" />

                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    {/* Fixed Personal Stat Card (Most Left) */}
                    {currentUserData && activeTab !== "pastweeks" && activeTab !== "groups" as any && !selectedGroup && (
                        <button 
                            onClick={() => {
                                if (userRank + 1 > visibleCount) {
                                    setVisibleCount(userRank + 1);
                                    setTimeout(() => {
                                        const el = document.getElementById(`player-${user!.uid}`);
                                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 100);
                                } else {
                                    const el = document.getElementById(`player-${user!.uid}`);
                                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            }}
                            className="fixed left-8 top-8 hidden xl:flex z-50 cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95"
                        >
                            <ProfileStatsCard user={currentUserData} rank={userRank + 1} />
                        </button>
                    )}

                    {/* Clean Header */}
                    <header className="flex flex-col items-center text-center mb-12 w-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-[1px] bg-zinc-900/50" />
                            <span className="text-[10px] font-black tracking-[0.4em] text-zinc-600 uppercase">Focus Rankings</span>
                            <div className="w-12 h-[1px] bg-zinc-900/50" />
                        </div>

                        <div className="flex items-center gap-8 w-full justify-center">
                            <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                            <h1 className="text-3xl md:text-5xl font-bold text-white text-center font-sans drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
                                {selectedGroup ? selectedGroup.name : "Hall of the Dangos"}
                            </h1>
                            <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                        </div>

                        {selectedGroup && (
                            <button onClick={() => {
                                setSelectedGroup(null);
                                router.replace("/leaderboard?tab=weekly");
                            }} className="mt-8 flex items-center gap-2 text-[#C9B037] font-bold text-xs hover:opacity-80 transition-all group">
                                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-all" /> Back
                            </button>
                        )}
                    </header>

                    {/* Tab Toggle */}
                    {!selectedGroup && (
                        <div className="flex flex-col items-center gap-6 mb-12 w-full max-w-2xl">
                            <div className="flex items-center gap-2 p-1.5 bg-zinc-950/90 sm:bg-zinc-900/40 backdrop-blur-none sm:backdrop-blur-2xl border border-white/10 rounded-full w-full">
                                {[
                                    { id: "weekly", icon: Trophy, label: "Weekly" },
                                    { id: "alltime", icon: TrendingUp, label: "All-Time" },
                                    { id: "friends", icon: Users, label: "Friends" },
                                    { id: "pastweeks", icon: Calendar, label: "Past Weeks" }
                                ].map(tab => (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => setActiveTab(tab.id as LeaderboardTab)} 
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 relative overflow-hidden cursor-pointer", 
                                            activeTab === tab.id 
                                                ? "bg-white/10 text-white" 
                                                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                                        )}
                                    >
                                        {/* Glass highlights */}
                                        <div className={cn(
                                            "absolute inset-0 rounded-full border-t-[0.5px] pointer-events-none transition-colors duration-300",
                                            activeTab === tab.id ? "border-white/30" : "border-white/10"
                                        )} />
                                        <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/5 pointer-events-none" />
                                        
                                        <tab.icon className={cn("w-4 h-4 transition-transform duration-300", activeTab === tab.id && "scale-110")} />
                                        <span className="text-xs font-bold">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={loading ? "loading" : `${activeTab}_${selectedPastWeekId || "none"}_${players.length}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="w-full flex-1 flex flex-col items-center"
                        >
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-96 gap-4">
                                    <div className="w-16 h-16 border-4 border-[#C9B037]/10 border-t-[#C9B037] rounded-full animate-spin" />
                                    <p className="text-xs font-black uppercase text-zinc-600 tracking-widest animate-pulse">Syncing Growth...</p>
                                </div>
                            ) : activeTab === "pastweeks" ? (
                                <div className="w-full flex flex-col items-center gap-6">
                                    {selectedPastWeekId ? (
                                        <div className="w-full flex flex-col items-center gap-8">
                                            <div className="flex flex-col items-center gap-3">
                                                <h3 className="text-xl font-bold text-white font-sans">
                                                    {pastWeeksList.find(w => w.id === selectedPastWeekId)?.label || "Past Week Rankings"}
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        setSelectedPastWeekId(null);
                                                        setPastWeekPlayers([]);
                                                    }}
                                                    className="flex items-center gap-2 text-[#C9B037] hover:opacity-80 transition-all font-bold text-xs group"
                                                >
                                                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-all" />
                                                    Back to Past Weeks
                                                </button>
                                            </div>

                                            {pastWeekLoading ? (
                                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                                    <div className="w-10 h-10 border-2 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" />
                                                    <p className="text-[10px] font-black uppercase text-zinc-600 tracking-wider">Loading history...</p>
                                                </div>
                                            ) : pastWeekPlayers.length === 0 ? (
                                                <div className="text-center text-sm text-zinc-500 py-12">
                                                    No rankings found for this week.
                                                </div>
                                            ) : (
                                                <div className="w-full flex flex-col items-center gap-10 sm:gap-16">
                                                    {/* THE PODIUM (Top 3 Cards) */}
                                                    {pastWeekTopThree.length > 0 ? (
                                                        <div className="flex flex-row items-end justify-center gap-1 sm:gap-3 md:grid md:grid-cols-3 md:gap-6 w-full max-w-5xl relative">
                                                            {pastWeekPodiumOrder.map((player, idx) => {
                                                                const rank = player === pastWeekTopThree[0] ? 1 : player === pastWeekTopThree[1] ? 2 : 3;
                                                                const totalMinutes = player.totalMinutes || 0;
                                                                const hours = Math.floor(totalMinutes / 60);
                                                                const minutes = totalMinutes % 60;

                                                                const isGold = rank === 1;
                                                                const isSilver = rank === 2;
                                                                const isBronze = rank === 3;

                                                                return (
                                                                    <div 
                                                                        id={`past-player-${player.uid}`} 
                                                                        key={player.uid || player.id || `past-podium-${idx}`} 
                                                                        className={cn(
                                                                            "relative group transition-all duration-700 flex-1 min-w-0 max-w-[125px] sm:max-w-[145px] md:max-w-none", 
                                                                            isGold ? "order-2 md:order-2 z-20" : isSilver ? "order-1 md:order-1" : "order-3 md:order-3"
                                                                        )} 
                                                                    >
                                                                        <div className={cn(
                                                                            "relative group flex flex-col items-center rounded-[1rem] border transition-all duration-500 overflow-hidden w-full mx-auto justify-between",
                                                                            isGold
                                                                                ? "bg-gradient-to-br from-zinc-800 via-zinc-800/80 to-yellow-900/40 border-yellow-500/60 shadow-[0_0_70px_rgba(255,215,0,0.25)] z-10 h-[175px] sm:h-[240px] md:h-auto py-2.5 sm:py-6 md:py-8 lg:py-12 scale-95 sm:scale-105"
                                                                                : isSilver
                                                                                    ? "bg-gradient-to-b from-slate-700/30 to-zinc-800/60 border-slate-400/40 hover:border-slate-400/60 shadow-[0_0_60px_rgba(148,163,184,0.15)] h-[155px] sm:h-[210px] md:h-auto py-2 sm:py-5 md:py-7 lg:py-10 scale-[0.92] sm:scale-98"
                                                                                    : "bg-gradient-to-b from-orange-900/20 via-zinc-800/40 to-zinc-900/60 border-orange-800/30 hover:border-orange-800/50 shadow-[0_0_40px_rgba(154,52,18,0.1)] h-[140px] sm:h-[180px] md:h-auto py-2 sm:py-4 md:py-7 lg:py-10 scale-[0.9] sm:scale-95"
                                                                        )}>
                                                                            {isGold && <div className="absolute -top-32 -left-32 w-80 h-80 bg-yellow-500/20 blur-[120px] pointer-events-none group-hover:bg-yellow-500/30 transition-all duration-700 hidden sm:block" />}
                                                                            {isSilver && <div className="absolute -top-24 -left-24 w-60 h-60 bg-slate-400/20 blur-[110px] pointer-events-none group-hover:bg-slate-400/30 transition-all duration-700 hidden sm:block" />}
                                                                            {isBronze && <div className="absolute -top-16 -left-16 w-48 h-48 bg-orange-600/10 blur-[90px] pointer-events-none group-hover:bg-orange-600/20 transition-all duration-700 hidden sm:block" />}
                                                                            
                                                                            <div className={cn("absolute inset-0 transition-all duration-700 pointer-events-none skew-x-[-20deg] scale-150", isGold ? "opacity-15 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-yellow-400/40 to-transparent" : isSilver ? "opacity-20 group-hover:opacity-40 bg-gradient-to-tr from-transparent via-slate-300/30 to-transparent" : "opacity-20 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-orange-400/20 to-transparent")} />

                                                                            <div className="relative mb-2 sm:mb-4 md:mb-6">
                                                                                <div onClick={() => router.push(`/profile?user=${player.uid}`)} className={cn("rounded-full border transition-all duration-300 group-hover:border-opacity-100 overflow-hidden cursor-pointer", isGold ? "border-[#C9B037]/40 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24" : isSilver ? "border-zinc-400/30 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20" : "border-orange-700/20 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20")}>
                                                                                    <Avatar className="w-full h-full border-0 rounded-full">
                                                                                        <AvatarImage src={getHighQualityAvatarUrl(player.photoURL)} className="object-cover" />
                                                                                        <AvatarFallback className="rounded-full text-[10px] sm:text-xs md:text-sm">{player.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                                                    </Avatar>
                                                                                </div>
                                                                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full border border-zinc-800 flex items-center justify-center bg-zinc-950 shadow-xl overflow-hidden pt-0.5">
                                                                                    <Image src={`/Icons/medal (${rank === 1 ? 3 : rank === 3 ? 1 : 2}).png`} alt={`Rank ${rank}`} width={20} height={20} className="w-2 h-2 sm:w-4 sm:h-4 md:w-5 md:h-5 object-contain" />
                                                                                </div>
                                                                            </div>

                                                                            <h2 className={cn("font-sans text-sm sm:text-lg md:text-2xl tracking-tight text-white mb-2 text-center truncate max-w-full px-1", isGold && "text-base sm:text-xl md:text-3xl text-[#C9B037]", isSilver && "text-slate-200", isBronze && "text-orange-200")}>
                                                                                {player.displayName}
                                                                            </h2>

                                                                            <div className={cn("hidden sm:inline-block px-2 sm:px-4 py-0.5 sm:py-1 rounded-[0.75rem] text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-2 sm:mb-4 md:mb-8 border text-center truncate max-w-[90%]", isGold ? "bg-yellow-400/10 text-yellow-500 border-yellow-500/30" : "bg-white/5 text-zinc-500 sm:text-zinc-600 border-white/5")}>
                                                                                {isGold ? "Legacy Tiller" : isSilver ? "Consistent Grower" : "Budding Focus"}
                                                                            </div>

                                                                            <div className="flex justify-center w-full px-2 sm:px-4 md:px-8">
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="hidden xs:block text-[6px] sm:text-[8px] uppercase font-black tracking-[0.15em] sm:tracking-[0.2em] text-zinc-500 mb-0.5 sm:mb-2">FOCUS TIME</span>
                                                                                    <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                                        {hours > 0 && <span className="text-[10px] sm:text-sm md:text-xl font-sans font-bold text-white">{hours}h</span>}
                                                                                        <span className={cn("text-[10px] sm:text-sm md:text-xl font-sans font-bold", isGold ? "text-[#C9B037]" : isSilver ? "text-slate-300" : isBronze ? "text-orange-400" : "text-white")}>{minutes}m</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-sm text-zinc-500 py-12">
                                                            No focusers recorded yet for this period.
                                                        </div>
                                                    )}

                                                    {/* OTHER NEIGHBORS LIST */}
                                                    {pastWeekOthers.length > 0 && (
                                                        <div className="w-full max-w-4xl space-y-4 mt-10">
                                                            <div className="flex items-center gap-6 justify-center mb-8 w-full">
                                                                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                                                <h3 className="hidden sm:block text-zinc-500 font-sans text-[12px] font-black tracking-[0.5em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">Slow and steady wins the race</h3>
                                                                <div className="h-[1px] w-24 bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                                            </div>
                                                            {pastWeekOthers.map((player, index) => {
                                                                const rank = index + 4;
                                                                const isCurrentUser = player.uid === user?.uid;
                                                                const totalMinutes = player.totalMinutes || 0;
                                                                const hours = Math.floor(totalMinutes / 60);
                                                                const minutes = totalMinutes % 60;
                                                                return (
                                                                    <div 
                                                                        id={`past-player-${player.uid}`} 
                                                                        key={player.uid || player.id || `past-other-${index}`} 
                                                                        className={cn(
                                                                            "group relative flex items-center gap-6 p-4 rounded-[1rem] border transition-all duration-300 shadow-sm",
                                                                            isCurrentUser
                                                                                ? "bg-yellow-500/10 border-yellow-500/40 hover:bg-yellow-500/15"
                                                                                : "bg-zinc-800/40 border-white/15 hover:bg-zinc-800/60 hover:border-white/25"
                                                                        )}
                                                                    >
                                                                        <div className={cn("w-8 text-center font-sans font-bold transition-colors", isCurrentUser ? "text-yellow-500" : "text-zinc-500 group-hover:text-zinc-300")}>{rank}</div>
                                                                        <div onClick={() => router.push(`/profile?user=${player.uid}`)} className="relative w-10 h-10 rounded-full border border-white/10 group-hover:border-white/20 transition-all duration-300 overflow-hidden cursor-pointer">
                                                                            <Avatar className="w-full h-full border-0 rounded-full">
                                                                                <AvatarImage src={getHighQualityAvatarUrl(player.photoURL)} className="object-cover w-full h-full" />
                                                                                <AvatarFallback className="text-[9px] rounded-full">{player.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                                            </Avatar>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={cn("text-sm font-bold transition-colors tracking-wider", isCurrentUser ? "text-yellow-500" : "text-zinc-300 group-hover:text-white")}>{player.displayName}</p>
                                                                        </div>
                                                                        <div className="flex items-center pr-4 text-right">
                                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                                <div className="flex items-baseline gap-1">
                                                                                    {hours > 0 && <span className="text-sm font-sans font-bold text-white leading-none">{hours}h</span>}
                                                                                    <span className="text-sm font-sans font-bold text-[#C9B037] leading-none">{minutes}m</span>
                                                                                </div>
                                                                                <Clock className="w-3.5 h-3.5 text-[#C9B037]/70" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-2xl space-y-4 animate-in fade-in duration-200">
                                            {pastWeeksList.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center p-20 bg-zinc-900/20 border border-white/5 border-dashed rounded-[3rem] text-center space-y-4">
                                                    <Calendar className="w-10 h-10 text-zinc-700 mx-auto" />
                                                    <h3 className="text-xl font-bold text-zinc-400 font-sans">No history recorded</h3>
                                                    <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">Leaderboard history will start appearing here in subsequent weeks.</p>
                                                </div>
                                            ) : (
                                                pastWeeksList.map((week, idx) => (
                                                    <button
                                                        key={week.id}
                                                        onClick={() => handlePastWeekClick(week.id)}
                                                        className="w-full text-left group relative flex items-center justify-between p-5 rounded-[1rem] bg-zinc-800/30 border border-white/10 hover:bg-zinc-800/50 hover:border-[#C9B037]/45 transition-all duration-300 shadow-sm cursor-pointer hover:scale-[1.01] active:scale-95"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-zinc-900/50 flex items-center justify-center text-zinc-500 group-hover:text-[#C9B037] transition-colors shadow-inner animate-in fade-in">
                                                                <Trophy className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-bold text-white group-hover:text-[#C9B037] transition-colors">{week.label}</h4>
                                                                <p className="text-[10px] text-zinc-500 mt-0.5">ID: {week.id}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-zinc-500 group-hover:text-white transition-colors">
                                                            <span className="text-xs font-bold">View Results</span>
                                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : activeTab === "friends" && players.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-96 gap-6">
                                    <Users className="w-20 h-20 text-zinc-700" />
                                    <h3 className="text-2xl font-bold text-zinc-400">No Friends to Rank</h3>
                                    <p className="text-sm text-zinc-600 max-w-md text-center">Add friends to see how you stack up against each other!</p>
                                    <a href="/friends" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300 flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        <span className="text-sm font-bold">Find Friends</span>
                                    </a>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-center gap-10 sm:gap-16">
                                    {/* THE PODIUM (Top 3 Cards) */}
                                    {topThree.length > 0 ? (
                                        <div className="flex flex-row items-end justify-center gap-1 sm:gap-3 md:grid md:grid-cols-3 md:gap-6 w-full max-w-5xl relative">
                                            {podiumOrder.map((player, idx) => {
                                                const rank = player === topThree[0] ? 1 : player === topThree[1] ? 2 : 3;
                                                const totalMinutes = player.totalMinutes || 0;
                                                const hours = Math.floor(totalMinutes / 60);
                                                const minutes = totalMinutes % 60;

                                                const isGold = rank === 1;
                                                const isSilver = rank === 2;
                                                const isBronze = rank === 3;

                                                return (
                                                    <div 
                                                        id={`player-${player.uid}`} 
                                                        key={player.uid || player.id || `podium-${idx}`} 
                                                        className={cn(
                                                            "relative group transition-all duration-700 flex-1 min-w-0 max-w-[125px] sm:max-w-[145px] md:max-w-none", 
                                                            isGold ? "order-2 md:order-2 z-20" : isSilver ? "order-1 md:order-1" : "order-3 md:order-3"
                                                        )} 
                                                    >
                                                        <div className={cn(
                                                            "relative group flex flex-col items-center rounded-[1rem] border transition-all duration-500 overflow-hidden w-full mx-auto justify-between",
                                                            isGold
                                                                ? "bg-gradient-to-br from-zinc-800 via-zinc-800/80 to-yellow-900/40 border-yellow-500/60 shadow-[0_0_70px_rgba(255,215,0,0.25)] z-10 h-[175px] sm:h-[240px] md:h-auto py-2.5 sm:py-6 md:py-8 lg:py-12 scale-95 sm:scale-105"
                                                                : isSilver
                                                                    ? "bg-gradient-to-b from-slate-700/30 to-zinc-800/60 border-slate-400/40 hover:border-slate-400/60 shadow-[0_0_60px_rgba(148,163,184,0.15)] h-[155px] sm:h-[210px] md:h-auto py-2 sm:py-5 md:py-7 lg:py-10 scale-[0.92] sm:scale-98"
                                                                    : "bg-gradient-to-b from-orange-900/20 via-zinc-800/40 to-zinc-900/60 border-orange-800/30 hover:border-orange-800/50 shadow-[0_0_40px_rgba(154,52,18,0.1)] h-[140px] sm:h-[180px] md:h-auto py-2 sm:py-4 md:py-7 lg:py-10 scale-[0.9] sm:scale-95"
                                                        )}>
                                                            {isGold && <div className="absolute -top-32 -left-32 w-80 h-80 bg-yellow-500/20 blur-[120px] pointer-events-none group-hover:bg-yellow-500/30 transition-all duration-700 hidden sm:block" />}
                                                            {isSilver && <div className="absolute -top-24 -left-24 w-60 h-60 bg-slate-400/20 blur-[110px] pointer-events-none group-hover:bg-slate-400/30 transition-all duration-700 hidden sm:block" />}
                                                            {isBronze && <div className="absolute -top-16 -left-16 w-48 h-48 bg-orange-600/10 blur-[90px] pointer-events-none group-hover:bg-orange-600/20 transition-all duration-700 hidden sm:block" />}
                                                            
                                                            <div className={cn("absolute inset-0 transition-all duration-700 pointer-events-none skew-x-[-20deg] scale-150", isGold ? "opacity-15 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-yellow-400/40 to-transparent" : isSilver ? "opacity-20 group-hover:opacity-40 bg-gradient-to-tr from-transparent via-slate-300/30 to-transparent" : "opacity-20 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-orange-400/20 to-transparent")} />

                                                            <div className="relative mb-2 sm:mb-4 md:mb-6">
                                                                <div onClick={() => router.push(`/profile?user=${player.uid}`)} className={cn("rounded-full border transition-all duration-300 group-hover:border-opacity-100 overflow-hidden cursor-pointer", isGold ? "border-[#C9B037]/40 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24" : isSilver ? "border-zinc-400/30 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20" : "border-orange-700/20 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20")}>
                                                                    <Avatar className="w-full h-full border-0 rounded-full">
                                                                        <AvatarImage src={getHighQualityAvatarUrl(player.photoURL)} className="object-cover" />
                                                                        <AvatarFallback className="rounded-full text-[10px] sm:text-xs md:text-sm">{player.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                                    </Avatar>
                                                                </div>
                                                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full border border-zinc-800 flex items-center justify-center bg-zinc-950 shadow-xl overflow-hidden pt-0.5">
                                                                    <Image src={`/Icons/medal (${rank === 1 ? 3 : rank === 3 ? 1 : 2}).png`} alt={`Rank ${rank}`} width={20} height={20} className="w-2 h-2 sm:w-4 sm:h-4 md:w-5 md:h-5 object-contain" />
                                                                </div>
                                                            </div>

                                                            <h2 className={cn("font-sans text-sm sm:text-lg md:text-2xl tracking-tight text-white mb-2 text-center truncate max-w-full px-1", isGold && "text-base sm:text-xl md:text-3xl text-[#C9B037]", isSilver && "text-slate-200", isBronze && "text-orange-200")}>
                                                                {player.displayName}
                                                            </h2>

                                                            <div className={cn("hidden sm:inline-block px-2 sm:px-4 py-0.5 sm:py-1 rounded-[0.75rem] text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-2 sm:mb-4 md:mb-8 border text-center truncate max-w-[90%]", isGold ? "bg-yellow-400/10 text-yellow-500 border-yellow-500/30" : "bg-white/5 text-zinc-500 sm:text-zinc-600 border-white/5")}>
                                                                {isGold ? "Legacy Tiller" : isSilver ? "Consistent Grower" : "Budding Focus"}
                                                            </div>

                                                            <div className="flex justify-center w-full px-2 sm:px-4 md:px-8">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="hidden xs:block text-[6px] sm:text-[8px] uppercase font-black tracking-[0.15em] sm:tracking-[0.2em] text-zinc-500 mb-0.5 sm:mb-2">FOCUS TIME</span>
                                                                    <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                        {hours > 0 && <span className="text-[10px] sm:text-sm md:text-xl font-sans font-bold text-white">{hours}h</span>}
                                                                        <span className={cn("text-[10px] sm:text-sm md:text-xl font-sans font-bold", isGold ? "text-[#C9B037]" : isSilver ? "text-slate-300" : isBronze ? "text-orange-400" : "text-white")}>{minutes}m</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center text-sm text-zinc-500 py-12">
                                            No focusers recorded yet for this period.
                                        </div>
                                    )}

                                    {/* OTHER NEIGHBORS LIST */}
                                    {others.length > 0 && (
                                        <div className="w-full max-w-4xl space-y-4 mt-10">
                                            <div className="flex items-center gap-6 justify-center mb-8 w-full">
                                                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                                <h3 className="hidden sm:block text-zinc-500 font-sans text-[12px] font-black tracking-[0.5em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">Slow and steady wins the race</h3>
                                                <div className="h-[1px] w-24 bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                            </div>
                                            {others.slice(0, Math.max(0, visibleCount - 3)).map((player, index) => {
                                                const rank = index + 4;
                                                const isCurrentUser = player.uid === user?.uid;
                                                return (
                                                    <div 
                                                        id={`player-${player.uid}`} 
                                                        key={player.uid || player.id || `other-${index}`} 
                                                        className={cn(
                                                            "group relative flex items-center gap-6 p-4 rounded-[1rem] border transition-all duration-300 shadow-sm",
                                                            isCurrentUser
                                                                ? "bg-yellow-500/10 border-yellow-500/40 hover:bg-yellow-500/15"
                                                                : "bg-zinc-800/40 border-white/15 hover:bg-zinc-800/60 hover:border-white/25"
                                                        )}
                                                    >
                                                        <div className={cn("w-8 text-center font-sans font-bold transition-colors", isCurrentUser ? "text-yellow-500" : "text-zinc-500 group-hover:text-zinc-300")}>{rank}</div>
                                                        <div onClick={() => router.push(`/profile?user=${player.uid}`)} className="relative w-10 h-10 rounded-full border border-white/10 group-hover:border-white/20 transition-all duration-300 overflow-hidden cursor-pointer">
                                                            <Avatar className="w-full h-full border-0 rounded-full">
                                                                <AvatarImage src={getHighQualityAvatarUrl(player.photoURL)} className="object-cover w-full h-full" />
                                                                <AvatarFallback className="text-[9px] rounded-full">{player.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                            </Avatar>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn("text-sm font-bold transition-colors tracking-wider", isCurrentUser ? "text-yellow-500" : "text-zinc-300 group-hover:text-white")}>{player.displayName}</p>
                                                        </div>
                                                        <div className="flex items-center pr-4 text-right">
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                <div className="flex items-baseline gap-1">
                                                                    {Math.floor(player.totalMinutes / 60) > 0 && <span className="text-sm font-sans font-bold text-white leading-none">{Math.floor(player.totalMinutes / 60)}h</span>}
                                                                    <span className="text-sm font-sans font-bold text-[#C9B037] leading-none">{player.totalMinutes % 60}m</span>
                                                                </div>
                                                                <Clock className="w-3.5 h-3.5 text-[#C9B037]/70" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {players.length > visibleCount && (
                                        <div className="flex justify-center w-full -mt-8">
                                            <button
                                                onClick={handleSeeMore}
                                                className="px-8 py-3 rounded-full border border-white/10 hover:border-[#C9B037]/40 bg-zinc-900/50 hover:bg-zinc-900/80 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-[#C9B037] transition-all duration-300 shadow-sm hover:shadow-[0_0_25px_rgba(201,176,55,0.1)] active:scale-95 cursor-pointer"
                                            >
                                                See More
                                            </button>
                                        </div>
                                    )}

                                    {/* Countdown Timer at the bottom of the weekly leaderboard tab */}
                                    {activeTab === "weekly" && resetCountdown && (
                                        <div className="text-center text-xs text-zinc-500 font-medium mt-4 tracking-wider uppercase animate-pulse">
                                            {resetCountdown}
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </BackgroundTheme>
    );
}

export default function LeaderboardPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" /></div>}>
            <LeaderboardContent />
        </Suspense>
    );
}
