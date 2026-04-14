"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import {
    UserPlus, X, Search, Users, Clock, Trophy, LogOut, Check,
    UserCheck, Timer, ChevronRight
} from "lucide-react";
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest,
    removeFriend, cancelFriendRequest, subscribeToReceivedFriendRequests,
    subscribeToFriendsList, getSentFriendRequests
} from "@/lib/friendship";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["300", "400", "500", "600", "700"],
});

type Tab = "friends" | "requests" | "search";

export default function FriendsPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("friends");
    const [friends, setFriends] = useState<any[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
    const [sentRequests, setSentRequests] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
    const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;

        const unsubFriends = subscribeToFriendsList(user.uid, (friendsData) => {
            setFriends(friendsData);
            setLoading(false);
        });

        const unsubRequests = subscribeToReceivedFriendRequests(user.uid, (requests) => {
            setReceivedRequests(requests);
        });

        const loadSentRequests = async () => {
            const sent = await getSentFriendRequests(user.uid);
            setSentRequests(sent);
        };
        loadSentRequests();

        return () => {
            unsubFriends();
            unsubRequests();
        };
    }, [user?.uid]);

    useEffect(() => {
        if (searchTimeout) clearTimeout(searchTimeout);

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const timeout = setTimeout(async () => {
            const { searchUsers } = await import("@/lib/friendship");
            const results = await searchUsers(searchQuery, user?.uid || "", 20);
            setSearchResults(results);
            setSearching(false);
        }, 500);

        setSearchTimeout(timeout);
        return () => clearTimeout(timeout);
    }, [searchQuery, user?.uid]);

    const handleSendRequest = async (toUserId: string, displayName: string) => {
        if (!user) return;
        setRequestingIds(prev => new Set(prev).add(toUserId));
        const success = await sendFriendRequest(user.uid, toUserId);
        if (success) {
            toast.success(`Friend request sent to ${displayName}`);
            const sent = await getSentFriendRequests(user.uid);
            setSentRequests(sent);
        } else {
            toast.error("Failed to send friend request");
        }
        setRequestingIds(prev => {
            const next = new Set(prev);
            next.delete(toUserId);
            return next;
        });
    };

    const handleAcceptRequest = async (requestId: string, fromUserId: string) => {
        const success = await acceptFriendRequest(requestId, fromUserId, user!.uid);
        if (success) {
            toast.success("Friend request accepted!");
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        const success = await declineFriendRequest(requestId);
        if (success) toast.info("Friend request declined");
    };

    const handleRemoveFriend = async (friendId: string) => {
        if (!user) return;
        const success = await removeFriend(user.uid, friendId);
        if (success) toast.success("Friend removed");
    };

    const handleCancelRequest = async (requestId: string) => {
        const success = await cancelFriendRequest(requestId);
        if (success) {
            toast.info("Friend request canceled");
            setSentRequests(prev => prev.filter(r => r.id !== requestId));
        }
    };

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <BackgroundTheme />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Friends Locked" description="Sign in to connect with friends and see their focus activity." />
            </main>
        </div>
    );

    return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    <header className="flex flex-col items-center text-center mb-12 w-full">
                        <span className="text-[10px] font-black tracking-[0.4em] text-zinc-600 uppercase mb-4">Social Hub</span>
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Friends & Connections</h1>
                    </header>

                    <div className="flex items-center gap-2 p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl mb-8 w-full max-w-xl">
                        {[
                            { id: "friends", label: "Friends", icon: UserCheck, count: friends.length },
                            { id: "requests", label: "Requests", icon: UserPlus, count: receivedRequests.length },
                            { id: "search", label: "Search", icon: Search, count: null },
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={cn(
                                    "relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 flex-1 justify-center",
                                    isActive ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                                )}>
                                    <Icon className="w-5 h-5" />
                                    <span className="text-xs font-bold tracking-wide">{tab.label}</span>
                                    {tab.count !== null && tab.count > 0 && <span className="ml-1 px-2 py-0.5 bg-[#C9B037] text-black rounded-full text-[10px] font-black">{tab.count}</span>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="w-full max-w-2xl">
                        {activeTab === "friends" && <FriendsTab friends={friends} loading={loading} onRemoveFriend={handleRemoveFriend} onGoToSearch={() => setActiveTab("search")} />}
                        {activeTab === "requests" && <RequestsTab receivedRequests={receivedRequests} sentRequests={sentRequests} onAccept={handleAcceptRequest} onDecline={handleDeclineRequest} onCancel={handleCancelRequest} />}
                        {activeTab === "search" && <SearchTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={setSearchQuery} searching={searching} searchResults={searchResults} onSendRequest={handleSendRequest} friends={friends} sentRequests={sentRequests} requestingIds={requestingIds} />}
                    </div>
                </main>
            </div>
        </BackgroundTheme>
    );
}

function FriendsTab({ friends, loading, onRemoveFriend, onGoToSearch }: any) {
    if (loading) return <div className="flex flex-col items-center justify-center py-20 gap-4"><div className="w-10 h-10 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" /></div>;
    if (friends.length === 0) return (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700"><Users className="w-10 h-10" /></div>
            <div>
                <h3 className="text-xl font-bold text-white">No Friends Found</h3>
                <p className="text-zinc-500 text-sm mt-1">Start connecting with others to track focus together.</p>
            </div>
            <button onClick={onGoToSearch} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all">Find Friends</button>
        </div>
    );

    return (
        <div className="space-y-4">
            {friends.map((friend: any) => {
                const userData = friend.userData;
                const totalMinutes = userData?.totalMinutes || 0;
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return (
                    <motion.div key={friend.friendId} whileHover={{ scale: 1.01, y: -2 }} className="group relative flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all cursor-pointer">
                        <Link href={`/profile?user=${userData?.uid}`} className="absolute inset-0 z-0" />
                        <Avatar className="w-12 h-12 border border-white/10"><AvatarImage src={userData?.photoURL} /><AvatarFallback>{userData?.displayName?.[0]}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0 z-10">
                            <p className="text-sm font-bold text-white group-hover:text-[#C9B037] transition-colors">{userData?.displayName}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {hours}h {minutes}m</span>
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Trophy className="w-3 h-3" /> {userData?.totalPomodoros || 0} Sessions</span>
                            </div>
                        </div>
                        <button onClick={() => onRemoveFriend(friend.friendId)} className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-xl transition-all z-10"><LogOut className="w-4 h-4" /></button>
                    </motion.div>
                );
            })}
        </div>
    );
}

function RequestsTab({ receivedRequests, sentRequests, onAccept, onDecline, onCancel }: any) {
    return (
        <div className="space-y-8">
            <section>
                <h3 className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-4 px-2">Received ({receivedRequests.length})</h3>
                <div className="space-y-3">
                    {receivedRequests.map((req: any) => (
                        <div key={req.id} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
                            <Avatar className="w-10 h-10"><AvatarImage src={req.fromUserData?.photoURL} /><AvatarFallback>{req.fromUserData?.displayName?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1"><p className="text-sm font-bold text-white">{req.fromUserData?.displayName}</p></div>
                            <div className="flex gap-2">
                                <button onClick={() => onAccept(req.id, req.fromUserId)} className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all"><Check className="w-4 h-4" /></button>
                                <button onClick={() => onDecline(req.id)} className="p-2 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500/30 transition-all"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                    {receivedRequests.length === 0 && <p className="text-center py-6 text-zinc-700 text-xs font-bold uppercase tracking-widest">No incoming requests</p>}
                </div>
            </section>
            <section>
                <h3 className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-4 px-2">Sent ({sentRequests.length})</h3>
                <div className="space-y-3">
                    {sentRequests.map((req: any) => (
                        <div key={req.id} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 opacity-70">
                            <Avatar className="w-10 h-10"><AvatarImage src={req.toUserData?.photoURL} /><AvatarFallback>{req.toUserData?.displayName?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1"><p className="text-sm font-bold text-white">{req.toUserData?.displayName}</p></div>
                            <button onClick={() => onCancel(req.id)} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-zinc-700">Cancel</button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

function SearchTab({ searchQuery, setSearchQuery, onSearch, searching, searchResults, onSendRequest, friends, sentRequests, requestingIds }: any) {
    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search focusers by name..." className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-[#C9B037]/40 outline-none transition-all" />
            </div>
            <div className="space-y-3">
                {searchResults.map((res: any) => {
                    const isFriend = friends.some((f: any) => f.friendId === res.uid);
                    const hasSentRequest = sentRequests.some((r: any) => r.toUserId === res.uid);
                    const isRequesting = requestingIds.has(res.uid);
                    return (
                        <div key={res.uid} className="flex items-center gap-4 p-4 bg-zinc-900/40 rounded-2xl border border-white/5">
                            <Avatar className="w-10 h-10"><AvatarImage src={res.photoURL} /><AvatarFallback>{res.displayName?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1"><p className="text-sm font-bold text-white">{res.displayName}</p></div>
                            {isFriend ? (
                                <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Friend</span>
                            ) : hasSentRequest ? (
                                <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Pending</span>
                            ) : (
                                <button onClick={() => onSendRequest(res.uid, res.displayName)} disabled={isRequesting} className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
                                    {isRequesting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    );
                })}
                {searchQuery && !searching && searchResults.length === 0 && <p className="text-center py-10 text-zinc-600 text-sm">No users found matching "{searchQuery}"</p>}
            </div>
        </div>
    );
}
