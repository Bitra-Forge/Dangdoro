"use client";

import { useEffect, useState, Suspense } from "react";
import { 
    Trophy, Zap, Clock, Medal, Sprout, Leaf, Flower2, ChevronRight, 
    TrendingUp, Search, Info, Users, Briefcase, ChevronLeft 
} from "lucide-react";
import { getLeaderboard, getGroupLeaderboard, fetchUserProfiles } from "@/lib/db";
import { getFriendsLeaderboard } from "@/lib/friendship";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { syncUserProfile } from "@/lib/db";
import { Space_Grotesk } from "next/font/google";
import { useAuth } from "@/components/AuthProvider";
import { ProfileStatsCard } from "@/components/profile-stats-card";
import { AuthRequired } from "@/components/auth-required";
import { BackgroundTheme } from "@/components/background-theme";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["300", "400", "500", "600", "700"],
});

type LeaderboardTab = "global" | "friends" | "groups";

function LeaderboardContent() {
    const { user, loading: authLoading } = useAuth();
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    
    // Initial tab based on URL or default
    const [activeTab, setActiveTab] = useState<LeaderboardTab>(
        (searchParams.get("tab") as LeaderboardTab) || "global"
    );
    
    // Group drill-down state
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<"joined" | "discover">("joined");
    const [sortBy, setSortBy] = useState<"members" | "minutes">("minutes");

    useEffect(() => {
        const fetchTops = async () => {
            if (authLoading) return;
            setLoading(true);

            if (user && user.isAnonymous) {
                await syncUserProfile(user);
            }

            const groupIdFromUrl = searchParams.get("groupId");

            if (selectedGroup || (groupIdFromUrl && activeTab === "groups")) {
                let groupToLoad = selectedGroup;
                
                if (!groupToLoad && groupIdFromUrl) {
                    const allGroups = await getGroupLeaderboard({ limitCount: 100 });
                    groupToLoad = allGroups.find(g => g.id === groupIdFromUrl);
                    if (groupToLoad) setSelectedGroup(groupToLoad);
                }

                if (groupToLoad) {
                    const memberUids = groupToLoad.members || [];
                    const profiles: any = await fetchUserProfiles(memberUids);
                    
                    const rankedMembers = memberUids.map((uid: string) => {
                        const profile = profiles.find((p: any) => p.uid === uid) || { displayName: "Member" };
                        const stats = groupToLoad.memberStats?.[uid] || { totalMinutes: 0 };
                        return { ...profile, ...stats, uid };
                    }).sort((a: any, b: any) => (b.totalMinutes || 0) - (a.totalMinutes || 0));

                    setPlayers(rankedMembers);
                }
            } else if (activeTab === "global") {
                const tops = await getLeaderboard(20);
                setPlayers(tops);
            } else if (activeTab === "friends") {
                const friendsTops = await getFriendsLeaderboard(user!.uid, 20);
                setPlayers(friendsTops);
            } else if (activeTab === "groups") {
                const groups = await getGroupLeaderboard({
                    userId: user!.uid,
                    filter: activeSubTab,
                    sortBy: sortBy,
                    limitCount: 20
                });
                setPlayers(groups);
            }
            setLoading(false);
        };
        fetchTops();
    }, [user, authLoading, activeTab, selectedGroup, searchParams, activeSubTab, sortBy]);

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#C9B037]/10 rounded-full blur-[120px] pointer-events-none" />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Garden Locked" description="Sign in to view the focus garden and see how your cultivation compares to the focus masters." />
            </main>
        </div>
    );

    const topThree = players.slice(0, 3);
    const others = players.slice(3);
    const userRank = players.findIndex(p => p.uid === user?.uid);
    const currentUserData = players[userRank];

    // Rearrange top 3 for the visual podium: [Rank 2, Rank 1, Rank 3]
    const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

    return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                {/* Background Atmosphere - Balanced Neutral Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-zinc-900/40 to-transparent pointer-events-none" />

                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    {/* Fixed Personal Stat Card (Most Left) */}
                    {currentUserData && activeTab !== "groups" && !selectedGroup && (
                        <div className="fixed left-8 top-1/2 -translate-y-1/2 hidden xl:flex z-50">
                            <ProfileStatsCard user={currentUserData} rank={userRank + 1} />
                        </div>
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
                                {selectedGroup ? selectedGroup.name : activeTab === "groups" ? "Top Productivity Units" : "Hall of the Dangos"}
                            </h1>
                            <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
                        </div>

                        {selectedGroup && (
                            <button onClick={() => setSelectedGroup(null)} className="mt-8 flex items-center gap-2 text-[#C9B037] font-bold text-xs hover:opacity-80 transition-all group">
                                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-all" /> Back to Units
                            </button>
                        )}
                    </header>

                    {/* Tab Toggle */}
                    {!selectedGroup && (
                        <div className="flex flex-col items-center gap-6 mb-12 w-full max-w-2xl">
                            <div className="flex items-center gap-2 p-1.5 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl w-full">
                                {[
                                    { id: "global", icon: Trophy, label: "Global" },
                                    { id: "friends", icon: Users, label: "Friends" },
                                    { id: "groups", icon: Briefcase, label: "Groups" }
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id as LeaderboardTab)} className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300", activeTab === tab.id ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5")}>
                                        <tab.icon className="w-4 h-4" />
                                        <span className="text-xs font-bold">{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {activeTab === "groups" && (
                                <div className="flex items-center justify-between w-full px-2">
                                    <div className="flex gap-1 p-1 bg-zinc-950/40 rounded-xl border border-white/5">
                                        {[
                                            { id: "joined", label: "My Units" },
                                            { id: "discover", label: "Discover" }
                                        ].map(t => (
                                            <button key={t.id} onClick={() => setActiveSubTab(t.id as any)} className={cn("px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all", activeSubTab === t.id ? "bg-white/10 text-white shadow-md" : "text-zinc-600 hover:text-zinc-400")}>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Sort By</span>
                                        <div className="flex p-1 bg-zinc-950/40 rounded-xl border border-white/5">
                                            <button onClick={() => setSortBy("minutes")} className={cn("p-1.5 rounded-lg transition-all", sortBy === "minutes" ? "bg-[#C9B037]/20 text-[#C9B037]" : "text-zinc-600")} title="Focus Time"><Clock className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setSortBy("members")} className={cn("p-1.5 rounded-lg transition-all", sortBy === "members" ? "bg-white/10 text-white" : "text-zinc-600")} title="Member Count"><Users className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-96 gap-4">
                            <div className="w-16 h-16 border-4 border-[#C9B037]/10 border-t-[#C9B037] rounded-full animate-spin" />
                            <p className="text-xs font-black uppercase text-zinc-600 tracking-widest animate-pulse">Syncing Growth...</p>
                        </div>
                    ) : activeTab === "groups" && !selectedGroup ? (
                        <div className="w-full space-y-8">
                            {players.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 bg-zinc-900/20 border border-white/5 border-dashed rounded-[3rem] text-center space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto text-zinc-700">
                                        <Briefcase className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-400">No {activeSubTab} groups found</h3>
                                    <p className="text-sm text-zinc-600 max-w-xs">{activeSubTab === "joined" ? "You haven't joined any focus groups yet." : "There are no public groups matching your search."}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                                    {players.map((group, idx) => (
                                        <motion.div key={group.id || `group-${idx}`} whileHover={{ y: -5 }} onClick={() => setSelectedGroup(group)} className="p-6 rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-[#C9B037]/40 transition-all cursor-pointer group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#C9B037]/5 blur-2xl -mr-8 -mt-8" />
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-2xl bg-[#C9B037]/10 flex items-center justify-center border border-[#C9B037]/20">
                                                    <span className="text-lg font-black text-[#C9B037]">#{idx + 1}</span>
                                                </div>
                                                <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black uppercase text-zinc-500">{group.type}</div>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">{group.name}</h3>
                                            <p className="text-xs text-zinc-500 mb-6 line-clamp-2">{group.description}</p>
                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-zinc-400">
                                                        <Users className="w-3 h-3" />
                                                        <span className="text-xs font-bold">{group.memberCount || group.members?.length || 0} Members</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-zinc-400">
                                                        <Clock className="w-3 h-3 text-[#C9B037]/60" />
                                                        <span className="text-xs font-bold text-white/80">{group.totalMinutes || 0}m focused</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#C9B037] transition-all" />
                                            </div>
                                        </motion.div>
                                    ))}
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
                        <div className="w-full flex flex-col items-center gap-16">
                            {/* THE PODIUM (Top 3 Cards) - 100% VISUAL RESTORATION */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl items-end relative">
                                {podiumOrder.map((player, idx) => {
                                    const rank = player === topThree[0] ? 1 : player === topThree[1] ? 2 : 3;
                                    const totalMinutes = player.totalMinutes || 0;
                                    const hours = Math.floor(totalMinutes / 60);
                                    const minutes = totalMinutes % 60;

                                    const isGold = rank === 1;
                                    const isSilver = rank === 2;
                                    const isBronze = rank === 3;

                                    return (
                                        <div key={player.uid || player.id || `podium-${idx}`} className={cn("relative group transition-all duration-700 animate-in fade-in slide-in-from-bottom-12", isGold ? "order-1 md:order-2 z-20" : isSilver ? "order-2 md:order-1" : "order-3 md:order-3")} style={{ animationDelay: `${rank * 150}ms` }}>
                                            <div className={cn("relative group flex flex-col items-center rounded-[1rem] border transition-all duration-500 overflow-hidden", isGold ? "bg-gradient-to-br from-zinc-800 via-zinc-800/80 to-yellow-900/40 border-yellow-500/60 shadow-[0_0_70px_rgba(255,215,0,0.25)] z-10 py-12 scale-105" : isSilver ? "bg-gradient-to-b from-slate-700/30 to-zinc-800/60 border-slate-400/40 hover:border-slate-400/60 shadow-[0_0_60px_rgba(148,163,184,0.15)] py-10 scale-98" : "bg-gradient-to-b from-orange-900/20 via-zinc-800/40 to-zinc-900/60 border-orange-800/30 hover:border-orange-800/50 shadow-[0_0_40px_rgba(154,52,18,0.1)] py-10 scale-95")}>
                                                
                                                {/* Visual Polish Restoration */}
                                                {isGold && <div className="absolute -top-32 -left-32 w-80 h-80 bg-yellow-500/20 blur-[120px] pointer-events-none group-hover:bg-yellow-500/30 transition-all duration-700" />}
                                                {isSilver && <div className="absolute -top-24 -left-24 w-60 h-60 bg-slate-400/20 blur-[110px] pointer-events-none group-hover:bg-slate-400/30 transition-all duration-700" />}
                                                {isBronze && <div className="absolute -top-16 -left-16 w-48 h-48 bg-orange-600/10 blur-[90px] pointer-events-none group-hover:bg-orange-600/20 transition-all duration-700" />}
                                                
                                                <div className={cn("absolute inset-0 transition-all duration-700 pointer-events-none skew-x-[-20deg] scale-150", isGold ? "opacity-15 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-yellow-400/40 to-transparent" : isSilver ? "opacity-20 group-hover:opacity-40 bg-gradient-to-tr from-transparent via-slate-300/30 to-transparent" : "opacity-20 group-hover:opacity-30 bg-gradient-to-tr from-transparent via-orange-400/20 to-transparent")} />

                                                <div className="relative mb-6">
                                                    <div className={cn("rounded-full border transition-all duration-300 group-hover:border-opacity-100 overflow-hidden", isGold ? "border-[#C9B037]/40 w-24 h-24" : isSilver ? "border-zinc-400/30 w-20 h-20" : "border-orange-700/20 w-20 h-20")}>
                                                        <Avatar className="w-full h-full border-0 rounded-full">
                                                            <AvatarImage src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`} className="object-cover" />
                                                            <AvatarFallback className="rounded-full">{player.displayName?.slice(0, 1)}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center bg-zinc-950 shadow-xl overflow-hidden pt-0.5">
                                                        <img src={`/Icons/medal (${rank === 1 ? 3 : rank === 3 ? 1 : 2}).png`} alt={`Rank ${rank}`} className="w-5 h-5 object-contain" />
                                                    </div>
                                                </div>

                                                <h2 className={cn("font-sans text-2xl tracking-tight text-white mb-2", isGold && "text-3xl text-[#C9B037]", isSilver && "text-slate-200", isBronze && "text-orange-200")}>
                                                    {player.displayName}
                                                </h2>

                                                <div className={cn("px-4 py-1 rounded-[0.75rem] text-[10px] font-black uppercase tracking-[0.2em] mb-8 border", isGold ? "bg-yellow-400/10 text-yellow-500 border-yellow-500/30" : "bg-white/5 text-zinc-600 border-white/5")}>
                                                    {isGold ? "Legacy Tiller" : isSilver ? "Consistent Grower" : "Budding Focus"}
                                                </div>

                                                <div className="flex justify-center gap-12 w-full px-8">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] uppercase font-black tracking-[0.2em] text-zinc-500 mb-2">FOCUS TIME</span>
                                                        <div className="flex items-baseline gap-1">
                                                            {hours > 0 && <span className="text-xl font-sans font-bold text-white">{hours}h</span>}
                                                            <span className={cn("text-xl font-sans font-bold", isGold ? "text-[#C9B037]" : isSilver ? "text-slate-300" : isBronze ? "text-orange-400" : "text-white")}>{minutes}m</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] uppercase font-black tracking-[0.2em] text-zinc-500 mb-2">SESSIONS</span>
                                                        <span className="text-3xl font-sans font-bold text-white leading-none">{player.totalPomodoros || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* OTHER NEIGHBORS LIST - 100% VISUAL RESTORATION */}
                            <div className="w-full max-w-4xl space-y-4 mt-10">
                                <div className="flex items-center gap-6 justify-center mb-8 w-full">
                                    <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                    <h3 className="text-zinc-500 font-sans text-[12px] font-black tracking-[0.5em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">Slow and steady wins the race</h3>
                                    <div className="h-[1px] w-24 bg-gradient-to-l from-transparent via-zinc-800 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
                                </div>
                                {others.map((player, index) => {
                                    const rank = index + 4;
                                    return (
                                        <div key={player.uid || player.id || `other-${index}`} className="group relative flex items-center gap-6 p-4 rounded-[1rem] bg-zinc-800/40 border border-white/15 hover:bg-zinc-800/60 hover:border-white/25 transition-all duration-300 shadow-sm">
                                            <div className="w-8 text-center font-sans font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">{rank}</div>
                                            <div className="relative w-10 h-10 rounded-full border border-white/10 group-hover:border-white/20 transition-all duration-300 overflow-hidden">
                                                <Avatar className="w-full h-full border-0 rounded-full">
                                                    <AvatarImage src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`} className="object-cover w-full h-full" />
                                                    <AvatarFallback className="text-[9px] rounded-full">{player.displayName?.slice(0, 1)}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">{player.displayName}</p>
                                            </div>
                                            <div className="flex items-center gap-12 pr-4 text-right">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5 justify-end">
                                                        <div className="flex items-baseline gap-1">
                                                            {Math.floor(player.totalMinutes / 60) > 0 && <span className="text-sm font-sans font-bold text-white leading-none">{Math.floor(player.totalMinutes / 60)}h</span>}
                                                            <span className="text-sm font-sans font-bold text-[#C9B037] leading-none">{player.totalMinutes % 60}m</span>
                                                        </div>
                                                        <Clock className="w-3.5 h-3.5 text-[#C9B037]/70" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <Zap className="w-3 h-3 text-zinc-700" />
                                                        <span className="text-sm font-bold text-zinc-400 group-hover:text-white">{player.totalPomodoros || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
