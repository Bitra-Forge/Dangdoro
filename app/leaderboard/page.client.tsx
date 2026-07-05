"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { 
    Trophy, Zap, Clock, Medal, Sprout, Leaf, Flower2, ChevronRight, 
    TrendingUp, Search, Info, Users, Briefcase, ChevronLeft, HelpCircle
} from "lucide-react";
import { getLeaderboard, getGroupLeaderboard, fetchUserProfiles, getLeaderboardHistoryDocs } from "@/lib/db";
import { getFriendsLeaderboard } from "@/lib/friendship";
import { useTour, type TourStep } from "@/lib/use-tour";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getHighQualityAvatarUrl } from "@/lib/utils";
import { syncUserProfile } from "@/lib/db";
import { useAuth } from "@/components/AuthProvider";
import { ProfileStatsCard } from "@/components/profile-stats-card";
import { AuthRequired } from "@/components/auth-required";
import { BackgroundTheme } from "@/components/background-theme";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";

type LeaderboardTab = "alltime" | "weekly" | "friends";

function ResetCountdown() {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const nextFriday = new Date();
            nextFriday.setUTCHours(0, 0, 0, 0);
            
            const currentDay = now.getUTCDay();
            let daysUntilFriday = (5 - currentDay + 7) % 7;
            
            // If it is Friday and already past midnight UTC, wait until next week's Friday
            if (daysUntilFriday === 0 && (now.getUTCHours() > 0 || now.getUTCMinutes() > 0 || now.getUTCSeconds() > 0)) {
                daysUntilFriday = 7;
            }
            
            nextFriday.setUTCDate(now.getUTCDate() + daysUntilFriday);
            
            const diffMs = nextFriday.getTime() - now.getTime();
            if (diffMs <= 0) {
                setTimeLeft("Resetting...");
                return;
            }

            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0 || days > 0) parts.push(`${hours}h`);
            parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            setTimeLeft(parts.join(" "));
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, []);

    if (!timeLeft) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 bg-zinc-900 border border-white/10 rounded-full px-4 h-8 select-none">
            <Clock className="w-3.5 h-3.5 text-[#C9B037]/80 animate-pulse" />
            <span className="tracking-wide">Resets in: <strong className="text-zinc-200 font-sans font-extrabold">{timeLeft}</strong></span>
        </div>
    );
}

function LeaderboardContent() {
    const tourSteps: TourStep[] = [
        {
            popover: {
                title: "Welcome to the Leaderboard",
                description: "Climb the ranks with focus minutes. Compare weekly, all-time, and friend standings.",
            },
        },
        {
            element: "#leaderboard-tabs",
            popover: {
                title: "Filter Rankings",
                description: "Filter focus statistics by current weekly growth, all-time accumulated minutes, friend lists, or historical weeks.",
                side: "bottom",
                align: "center",
            },
        },
        {
            element: "#leaderboard-podium",
            popover: {
                title: "Focus Podium",
                description: "The top 3 focused pilots are displayed on the podium cards. Hover over them to inspect their avatar cards and total active hours.",
                side: "top",
                align: "center",
            },
        },
    ];

    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const { resetTour, startTour } = useTour({
        pageName: "leaderboard",
        steps: tourSteps,
        disabled: authLoading || !user || user.isAnonymous || loading
    });
    const handleRestartTour = () => {
        resetTour();
        startTour();
    };

    const router = useRouter();
    const [players, setPlayers] = useState<any[]>([]);
    const [visibleCount, setVisibleCount] = useState(20);
    const searchParams = useSearchParams();
    
    // Initial tab based on URL or default
    const [activeTab, setActiveTab] = useState<LeaderboardTab>(() => {
        const tab = searchParams.get("tab") as any;
        if (tab === "weekly" || tab === "friends") return tab;
        return "alltime";
    });
    
    // Group drill-down state
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

    // History weeks state
    const [historyWeeks, setHistoryWeeks] = useState<any[]>([]);
    const [selectedWeekId, setSelectedWeekId] = useState<string>("current");

    // Clear selected group when tab changes
    useEffect(() => {
        setSelectedGroup(null);
        if (activeTab !== "weekly") {
            setSelectedWeekId("current");
        }
    }, [activeTab]);

    // Load leaderboard history weeks list
    useEffect(() => {
        getLeaderboardHistoryDocs().then((docs) => {
            setHistoryWeeks(docs || []);
        }).catch((err) => console.error("Error loading week history list:", err));
    }, []);

    const tabParam = searchParams.get("tab");
    const groupIdFromUrl = searchParams.get("groupId");

    useEffect(() => {
        let isMounted = true;
        
        const fetchTops = async () => {
            if (authLoading || !user || user.isAnonymous) return;
            setLoading(true);
            setPlayers([]);
            setVisibleCount(20);

            if (user && user.isAnonymous) {
                await syncUserProfile(user);
            }

            if (selectedGroup || (groupIdFromUrl && activeTab === ("groups" as any))) {
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
            } else if (activeTab === "alltime" || activeTab === "weekly") {
                let tops: any[] = [];
                if (activeTab === "weekly" && selectedWeekId !== "current") {
                    const weekDoc = historyWeeks.find(w => w.weekId === selectedWeekId);
                    tops = weekDoc ? (weekDoc.players || []) : [];
                } else {
                    tops = await getLeaderboard(150, activeTab);
                }
                if (isMounted) {
                    const nonGuests = tops.filter(
                        (player: any) => !player.isAnonymous
                    );
                    setPlayers(nonGuests);

                    // Background profile picture fetch to load actual profile photos (including base64)
                    const uids = nonGuests.map((p: any) => p.uid).filter(Boolean);
                    if (uids.length > 0) {
                        fetchUserProfiles(uids).then((freshProfiles) => {
                            if (isMounted) {
                                setPlayers(prevPlayers => {
                                    return prevPlayers.map(p => {
                                        const fresh = freshProfiles.find(fp => fp.uid === p.uid);
                                        if (fresh) {
                                            return {
                                                ...p,
                                                displayName: fresh.displayName || p.displayName,
                                                photoURL: fresh.photoURL || p.photoURL
                                            };
                                        }
                                        return p;
                                    });
                                });
                            }
                        }).catch(err => console.error("Error fetching fresh profiles in bg:", err));
                    }
                }
            } else if (activeTab === "friends") {
                const friendsTops = await getFriendsLeaderboard(user!.uid, 200);
                if (isMounted) setPlayers(friendsTops);
            }
            if (isMounted) setLoading(false);
        };
        fetchTops();
        
        return () => {
            isMounted = false;
        };
    }, [user, authLoading, activeTab, selectedGroup, tabParam, groupIdFromUrl, selectedWeekId, historyWeeks]);

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
                    {currentUserData && !selectedGroup && (
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
                                router.replace("/leaderboard?tab=alltime");
                            }} className="mt-8 flex items-center gap-2 text-[#C9B037] font-bold text-xs hover:opacity-80 transition-all group">
                                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-all" /> Back to Leaderboard
                            </button>
                        )}
                    </header>

                    {/* Tab Toggle */}
                    {!selectedGroup && (
                        <div className="flex flex-col items-center gap-6 mb-12 w-full max-w-2xl">
                            <div id="leaderboard-tabs" className="flex items-center gap-2 p-1.5 bg-zinc-950/90 sm:bg-zinc-900/40 backdrop-blur-none sm:backdrop-blur-2xl border border-white/10 rounded-full w-full">
                                {[
                                    { id: "alltime", icon: Trophy, label: "All Time" },
                                    { id: "weekly", icon: TrendingUp, label: "Weekly" },
                                    { id: "friends", icon: Users, label: "Friends" }
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

                            {activeTab === "weekly" && (
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300 w-full">
                                    {historyWeeks.length > 0 && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Week:</span>
                                            <div className="relative flex items-center">
                                            <select
                                                value={selectedWeekId}
                                                onChange={(e) => setSelectedWeekId(e.target.value)}
                                                className="appearance-none bg-zinc-900 border border-white/10 rounded-full pl-4 pr-8 h-8 text-xs font-bold text-zinc-300 hover:border-white/20 transition-all outline-none cursor-pointer focus:ring-1 focus:ring-[#C9B037]/50"
                                            >
                                                <option value="current">Current Week</option>
                                                {historyWeeks.map((week) => (
                                                    <option key={week.weekId} value={week.weekId}>
                                                        {week.weekId}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 rotate-90 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}
                                    {selectedWeekId === "current" && <ResetCountdown />}
                                </div>
                            )}
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={loading ? "loading" : `${activeTab}_${selectedGroup ? selectedGroup.id : "none"}_${players.length}`}
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
                        <div className="w-full flex flex-col items-center gap-16">
                            {/* THE PODIUM (Top 3 Cards) - 100% VISUAL RESTORATION */}
                            <div id="leaderboard-podium" className="flex flex-col md:flex-row items-center md:items-end justify-center gap-6 w-full max-w-5xl relative">
                                {podiumOrder.map((player, idx) => {
                                    const rank = player === topThree[0] ? 1 : player === topThree[1] ? 2 : 3;
                                    const totalMinutes = player.totalMinutes || 0;
                                    const hours = Math.floor(totalMinutes / 60);
                                    const minutes = totalMinutes % 60;

                                    const isGold = rank === 1;
                                    const isSilver = rank === 2;
                                    const isBronze = rank === 3;

                                    return (
                                        <div id={`player-${player.uid}`} key={player.uid || player.id || `podium-${idx}`} className={cn("w-full md:w-[32%] max-w-[360px] relative group transition-all duration-700 animate-in fade-in slide-in-from-bottom-12", isGold ? "order-1 md:order-2 z-20" : isSilver ? "order-2 md:order-1" : "order-3 md:order-3")} style={{ animationDelay: `${rank * 150}ms` }}>
                                            <div className={cn(
                                                "relative group flex flex-col items-center rounded-[1rem] border transition-all duration-500 overflow-hidden w-full mx-auto",
                                                isGold
                                                    ? "bg-gradient-to-br from-zinc-800 via-zinc-800/80 to-yellow-900/40 border-yellow-500/60 shadow-[0_0_70px_rgba(255,215,0,0.25)] z-10 py-8 sm:py-12 scale-95 sm:scale-105"
                                                    : isSilver
                                                        ? "bg-gradient-to-b from-slate-700/30 to-zinc-800/60 border-slate-400/40 hover:border-slate-400/60 shadow-[0_0_60px_rgba(148,163,184,0.15)] py-7 sm:py-10 scale-[0.92] sm:scale-98"
                                                        : "bg-gradient-to-b from-orange-900/20 via-zinc-800/40 to-zinc-900/60 border-orange-800/30 hover:border-orange-800/50 shadow-[0_0_40px_rgba(154,52,18,0.1)] py-7 sm:py-10 scale-[0.9] sm:scale-95"
                                            )}>
                                                
                                                {/* Visual Polish Restoration */}
                                                {isGold && <div className="absolute -top-32 -left-32 w-80 h-80 bg-yellow-500/20 blur-[120px] pointer-events-none group-hover:bg-yellow-500/30 transition-all duration-700 hidden sm:block" />}
                                                {isSilver && <div className="absolute -top-24 -left-24 w-60 h-60 bg-slate-400/20 blur-[110px] pointer-events-none group-hover:bg-slate-400/30 transition-all duration-700 hidden sm:block" />}
                                                {isBronze && <div className="absolute -top-16 -left-16 w-48 h-48 bg-orange-600/10 blur-[90px] pointer-events-none group-hover:bg-orange-600/20 transition-all duration-700 hidden sm:block" />}
                                                
                                                <div className={cn("absolute inset-0 transition-all duration-700 pointer-events-none skew-x-[-20deg] scale-150", isGold ? "opacity-15 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-yellow-400/40 to-transparent" : isSilver ? "opacity-20 group-hover:opacity-40 bg-gradient-to-tr from-transparent via-slate-300/30 to-transparent" : "opacity-20 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-orange-400/20 to-transparent")} />

                                                <div className="relative mb-6">
                                                    <div onClick={() => router.push(`/profile?user=${player.uid}`)} className={cn("rounded-full border transition-all duration-300 group-hover:border-opacity-100 overflow-hidden cursor-pointer", isGold ? "border-[#C9B037]/40 w-20 h-20 sm:w-24 sm:h-24" : isSilver ? "border-zinc-400/30 w-16 h-16 sm:w-20 sm:h-20" : "border-orange-700/20 w-16 h-16 sm:w-20 sm:h-20")}>
                                                        <Avatar className="w-full h-full border-0 rounded-full">
                                                            <AvatarImage src={getHighQualityAvatarUrl(player.photoURL)} className="object-cover" />
                                                            <AvatarFallback className="rounded-full">{player.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center bg-zinc-950 shadow-xl overflow-hidden pt-0.5">
                                                        <Image src={`/Icons/medal (${rank === 1 ? 3 : rank === 3 ? 1 : 2}).png`} alt={`Rank ${rank}`} width={20} height={20} className="w-5 h-5 object-contain" />
                                                    </div>
                                                </div>

                                                <h2 className={cn("font-sans text-2xl tracking-tight text-white mb-2", isGold && "text-3xl text-[#C9B037]", isSilver && "text-slate-200", isBronze && "text-orange-200")}>
                                                    {player.displayName}
                                                </h2>

                                                <div className={cn("px-4 py-1 rounded-[0.75rem] text-[10px] font-black uppercase tracking-[0.2em] mb-8 border", isGold ? "bg-yellow-400/10 text-yellow-500 border-yellow-500/30" : "bg-white/5 text-zinc-600 border-white/5")}>
                                                    {isGold ? "Legacy Tiller" : isSilver ? "Consistent Grower" : "Budding Focus"}
                                                </div>

                                                <div className="flex justify-center w-full px-8">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] uppercase font-black tracking-[0.2em] text-zinc-500 mb-2">FOCUS TIME</span>
                                                        <div className="flex items-baseline gap-1">
                                                            {hours > 0 && <span className="text-xl font-sans font-bold text-white">{hours}h</span>}
                                                            <span className={cn("text-xl font-sans font-bold", isGold ? "text-[#C9B037]" : isSilver ? "text-slate-300" : isBronze ? "text-orange-400" : "text-white")}>{minutes}m</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* OTHER NEIGHBORS LIST - 100% VISUAL RESTORATION */}
                            {others.length > 0 && (
                                <div className="w-full max-w-4xl space-y-4 mt-10">
                                    <div className="flex items-center gap-6 justify-center mb-8 w-full">
                                        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                        <h3 className="hidden sm:block text-zinc-500 font-sans text-[12px] font-black tracking-[0.5em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">Slow and steady wins the race</h3>
                                        <div className="h-[1px] w-24 bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                    </div>
                                    {others.slice(0, Math.max(0, visibleCount - 3)).map((player, index) => {
                                        const rank = index + 4;
                                        return (
                                            <div id={`player-${player.uid}`} key={player.uid || player.id || `other-${index}`} className="group relative flex items-center gap-6 p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300 shadow-sm">
                                                <div className="w-8 text-center font-sans font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">{rank}</div>
                                                <div onClick={() => router.push(`/profile?user=${player.uid}`)} className="relative w-10 h-10 rounded-full border border-white/10 group-hover:border-white/20 transition-all duration-300 overflow-hidden cursor-pointer">
                                                    <Avatar className="w-full h-full border-0 rounded-full">
                                                        <AvatarImage src={getHighQualityAvatarUrl(player.photoURL)} className="object-cover w-full h-full" />
                                                        <AvatarFallback className="text-[9px] rounded-full">{player.displayName?.slice(0, 1) || "U"}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors tracking-wider">{player.displayName}</p>
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
                        </div>
                    )}
                        </motion.div>
                    </AnimatePresence>
                </main>

                {/* Floating Help/Tour Button */}
                <div className="fixed bottom-6 left-6 z-50">
                    <button
                        onClick={handleRestartTour}
                        className="p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all backdrop-blur-md shadow-2xl flex items-center justify-center cursor-pointer"
                        title="Restart Page Tour"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                </div>
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
