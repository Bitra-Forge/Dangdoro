"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    UserPlus, X, Search, Users, Clock, Trophy, Check,
    UserCheck, Timer, ChevronRight, UserMinus
} from "lucide-react";
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest,
    removeFriend, cancelFriendRequest, subscribeToReceivedFriendRequests,
    subscribeToFriendsList, getSentFriendRequests
} from "@/lib/friendship";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
    const [profileImageUrl, setProfileImageUrl] = useState("");

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

    useEffect(() => {
        const loadProfileImage = async () => {
            if (!user?.uid) {
                setProfileImageUrl("");
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const photoFromDoc = userDoc.exists() ? userDoc.data()?.photoURL : undefined;
                setProfileImageUrl(photoFromDoc || user.photoURL || "");
            } catch {
                setProfileImageUrl(user.photoURL || "");
            }
        };

        loadProfileImage();
    }, [user?.uid, user?.photoURL]);

    const handleSendRequest = async (toUserId: string, displayName: string) => {
        if (!user || !user.uid) {
            toast.error("Unable to send request: User not authenticated");
            return;
        }

        if (!toUserId || toUserId.trim() === "") {
            toast.error("Unable to send request: Invalid recipient");
            return;
        }

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
        if (!user || !user.uid) {
            toast.error("Unable to accept request: User not authenticated");
            return;
        }

        const success = await acceptFriendRequest(requestId, fromUserId, user.uid);
        if (success) {
            toast.success("Friend request accepted!");
        } else {
            toast.error("Failed to accept friend request");
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        const success = await declineFriendRequest(requestId);
        if (success) toast.info("Friend request declined");
        else toast.error("Failed to decline friend request");
    };

    const handleRemoveFriend = async (friendId: string) => {
        if (!user || !user.uid) {
            toast.error("Unable to remove friend: User not authenticated");
            return;
        }

        const success = await removeFriend(user.uid, friendId);
        if (success) toast.success("Friend removed");
        else toast.error("Failed to remove friend");
    };

    const handleCancelRequest = async (requestId: string) => {
        const success = await cancelFriendRequest(requestId);
        if (success) {
            toast.info("Friend request canceled");
            setSentRequests(prev => prev.filter(r => r.id !== requestId));
        } else {
            toast.error("Failed to cancel friend request");
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

    const tabs = [
        { id: "friends", label: "Friends", icon: UserCheck, count: null },
        { id: "requests", label: "Requests", icon: UserPlus, count: receivedRequests.length },
        { id: "search", label: "Search", icon: Search, count: null },
    ] as const;

    return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden font-sans")}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-3 md:px-6 w-full flex-1 max-w-[86rem] mx-auto">
                    <div className="w-full grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6 md:gap-8 items-start">
                        <aside className="hidden md:block self-start">
                            <div className="relative p-3 bg-zinc-900/45 backdrop-blur-2xl border border-white/10 rounded-[12px]">
                                <div className="flex flex-col gap-2">
                                    {tabs.map(tab => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;

                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id as Tab)}
                                                className={cn(
                                                    "relative flex items-center gap-2.5 px-3 py-4 rounded-[10px] transition-colors duration-300 w-full",
                                                    isActive ? "text-white" : "text-zinc-500 hover:text-zinc-200"
                                                )}
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="friends-side-active-pill"
                                                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                                                        className="absolute inset-0 rounded-[10px] bg-white/10 border border-white/15 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                                                    />
                                                )}

                                                <motion.div
                                                    animate={{ scale: isActive ? 1.08 : 1, opacity: isActive ? 1 : 0.85 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="relative z-10"
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </motion.div>
                                                <span className="relative z-10 text-xs font-bold tracking-wide">{tab.label}</span>

                                                {tab.count !== null && tab.count > 0 && (
                                                    <span className={cn(
                                                        "relative z-10 ml-auto px-2 py-0.5 rounded-full text-[10px] font-black transition-colors",
                                                        isActive ? "bg-[#C9B037] text-black" : "bg-zinc-800 text-zinc-300"
                                                    )}>
                                                        {tab.count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>

                        <div className="min-w-0 min-h-[620px]">
                            <div className="md:hidden relative p-2 bg-zinc-900/45 backdrop-blur-2xl border border-white/10 rounded-[10px] mb-6 w-full overflow-hidden">
                                <div className="relative z-10 flex items-center gap-2">
                                    {tabs.map(tab => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id as Tab)}
                                                className={cn(
                                                    "relative flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors duration-300 flex-1 justify-center",
                                                    isActive ? "text-white" : "text-zinc-500 hover:text-zinc-200"
                                                )}
                                            >
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="friends-top-active-pill-mobile"
                                                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                                                        className="absolute inset-0 rounded-xl bg-white/10 border border-white/15 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                                                    />
                                                )}
                                                <motion.div
                                                    animate={{ scale: isActive ? 1.08 : 1, opacity: isActive ? 1 : 0.85 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="relative z-10"
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </motion.div>
                                                <span className="relative z-10 text-xs font-bold tracking-wide">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, delay: 0.08 }}
                                className="w-full mb-8"
                            >
                                <div className="flex items-center gap-4 md:gap-5">
                                    <div className="w-20 h-20 md:w-24 md:h-24 overflow-hidden rounded-[2px] border border-emerald-400/45 shadow-[0_0_10px_rgba(16,185,129,0.22)] bg-zinc-800">
                                        {profileImageUrl ? (
                                            <img
                                                src={profileImageUrl}
                                                alt="User profile"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-200 font-bold text-2xl md:text-3xl">
                                                {(user?.displayName || "U").slice(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 text-left">
                                        <p className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase truncate">
                                            {user?.displayName || "User"}
                                        </p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-[2px] bg-[#C9B037] text-black text-[10px] font-black leading-none">
                                                {friends.length}
                                            </span>
                                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">
                                                Friends
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="w-full">
                                {activeTab === "friends" && <FriendsTab friends={friends} loading={loading} onRemoveFriend={handleRemoveFriend} onGoToSearch={() => setActiveTab("search")} />}
                                {activeTab === "requests" && <RequestsTab receivedRequests={receivedRequests} sentRequests={sentRequests} onAccept={handleAcceptRequest} onDecline={handleDeclineRequest} onCancel={handleCancelRequest} />}
                                {activeTab === "search" && <SearchTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={setSearchQuery} searching={searching} searchResults={searchResults} onSendRequest={handleSendRequest} friends={friends} sentRequests={sentRequests} requestingIds={requestingIds} />}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </BackgroundTheme>
    );
}

function FriendsTab({ friends, loading, onRemoveFriend, onGoToSearch }: any) {
    const formatFocusTime = (totalMinutes: number) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp?.toDate) return "unknown";
        const date = timestamp.toDate() as Date;
        const diffMs = Date.now() - date.getTime();
        const minutes = Math.floor(diffMs / 60000);
        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo ago`;
        const years = Math.floor(months / 12);
        return `${years}y ago`;
    };

    const formatFriendSince = (timestamp: any) => {
        if (!timestamp?.toDate) return "---";
        return timestamp.toDate().getFullYear();
    };

    const isOnline = (timestamp: any) => {
        if (!timestamp?.toDate) return false;
        const lastActive = timestamp.toDate() as Date;
        return Date.now() - lastActive.getTime() <= 5 * 60 * 1000;
    };

    const onlineFriends = friends.filter((friend: any) => isOnline(friend?.userData?.lastActive));
    const offlineFriends = friends.filter((friend: any) => !isOnline(friend?.userData?.lastActive));

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
        <div className="space-y-10">
            {onlineFriends.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="inline-block w-[2px] h-4 bg-emerald-400 rounded-full" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">Online</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {onlineFriends.map((friend: any) => {
                            const userData = friend.userData;
                            const totalMinutes = userData?.totalMinutes || 0;
                            const profileUserId = userData?.uid || userData?.id || friend.friendId;
                            const online = true;

                            return (
                                <motion.div
                                    key={friend.friendId}
                                    whileHover={{}}
                                    className={cn(
                                        "group relative rounded-[5px] bg-gradient-to-br from-zinc-900/70 via-zinc-900/50 to-zinc-950/70 backdrop-blur-xl border transition-all duration-500 overflow-hidden",
                                        online
                                            ? "border-emerald-400/45 shadow-[0_12px_34px_rgba(0,0,0,0.42),0_0_18px_rgba(16,185,129,0.22)] hover:border-emerald-300/65 hover:shadow-[0_18px_45px_rgba(0,0,0,0.5),0_0_24px_rgba(16,185,129,0.28)]"
                                            : "border-white/8 shadow-[0_8px_26px_rgba(0,0,0,0.33)] hover:border-white/15 hover:shadow-[0_14px_36px_rgba(0,0,0,0.4)]"
                                    )}
                                >
                                    <Link href={`/profile?user=${profileUserId}`} className="block p-5" aria-label={`Open ${userData?.displayName || "friend"} profile`}>
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-transparent" />
                                        </div>
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        <div className="relative z-10 flex items-start gap-3">
                                            <Avatar className="w-12 h-12 rounded-full overflow-hidden border border-emerald-400/70 ring-2 ring-emerald-500/35 shadow-[0_0_14px_rgba(16,185,129,0.35)]">
                                                <AvatarImage src={userData?.photoURL} className="rounded-full object-cover" />
                                                <AvatarFallback className="rounded-full">{userData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-2xl leading-none font-extrabold text-zinc-100 tracking-tight truncate" style={{ fontFamily: "__nextjs-Geist" }}>
                                                    {userData?.displayName || "Unknown"}
                                                </p>
                                                <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold">
                                                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-500")} />
                                                    <span className={online ? "text-emerald-400" : "text-zinc-400"}>
                                                        {online ? "Online" : `Offline • Last seen ${formatTimeAgo(userData?.lastActive)}`}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>

                                        <div className="relative z-10 mt-5 border-t border-white/10 pt-4 grid grid-cols-3 gap-2">
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Focus Time</p>
                                                <p className="text-lg leading-tight font-black text-zinc-100 tabular-nums">{formatFocusTime(totalMinutes)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Sessions</p>
                                                <p className="text-lg leading-tight font-black text-zinc-100 tabular-nums">{userData?.totalPomodoros || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Friend Since</p>
                                                <p className="text-lg leading-tight font-black text-zinc-100 tabular-nums">{formatFriendSince(friend.since)}</p>
                                            </div>
                                        </div>
                                    </Link>

                                    <button
                                        onClick={() => onRemoveFriend(friend.friendId)}
                                        className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-xl transition-all z-20"
                                        aria-label="Remove friend"
                                    >
                                        <UserMinus className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>
            )}

            {offlineFriends.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="inline-block w-[2px] h-4 bg-zinc-600 rounded-full" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Offline</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {offlineFriends.map((friend: any) => {
                const userData = friend.userData;
                const totalMinutes = userData?.totalMinutes || 0;
                const profileUserId = userData?.uid || userData?.id || friend.friendId;
                const online = false;

                return (
                    <motion.div
                        key={friend.friendId}
                        whileHover={{}}
                        className={cn(
                            "group relative rounded-[5px] bg-gradient-to-br from-zinc-900/70 via-zinc-900/50 to-zinc-950/70 backdrop-blur-xl border transition-all duration-500 overflow-hidden",
                            online
                                ? "border-emerald-400/45 shadow-[0_12px_34px_rgba(0,0,0,0.42),0_0_18px_rgba(16,185,129,0.22)] hover:border-emerald-300/65 hover:shadow-[0_18px_45px_rgba(0,0,0,0.5),0_0_24px_rgba(16,185,129,0.28)]"
                                : "border-white/8 shadow-[0_8px_26px_rgba(0,0,0,0.33)] hover:border-white/15 hover:shadow-[0_14px_36px_rgba(0,0,0,0.4)]"
                        )}
                    >
                        <Link href={`/profile?user=${profileUserId}`} className="block p-5" aria-label={`Open ${userData?.displayName || "friend"} profile`}>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-transparent" />
                            </div>
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <div className="relative z-10 flex items-start gap-3">
                                <Avatar className="w-12 h-12 rounded-full overflow-hidden border border-white/20 ring-2 ring-white/10 shadow-[0_0_16px_rgba(255,255,255,0.12)]">
                                    <AvatarImage src={userData?.photoURL} className="rounded-full object-cover" />
                                    <AvatarFallback className="rounded-full">{userData?.displayName?.[0]}</AvatarFallback>
                                </Avatar>

                                <div className="min-w-0 flex-1">
                                    <p className="text-2xl leading-none font-extrabold text-zinc-100 tracking-tight truncate" style={{ fontFamily: "__nextjs-Geist" }}>
                                        {userData?.displayName || "Unknown"}
                                    </p>
                                    <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold">
                                        <span className={cn("inline-block w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-500")} />
                                        <span className={online ? "text-emerald-400" : "text-zinc-400"}>
                                            {online ? "Online" : `Offline • Last seen ${formatTimeAgo(userData?.lastActive)}`}
                                        </span>
                                    </div>
                                </div>

                            </div>

                            <div className="relative z-10 mt-5 border-t border-white/10 pt-4 grid grid-cols-3 gap-2">
                                <div>
                                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Focus Time</p>
                                    <p className="text-lg leading-tight font-black text-zinc-100 tabular-nums">{formatFocusTime(totalMinutes)}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Sessions</p>
                                    <p className="text-lg leading-tight font-black text-zinc-100 tabular-nums">{userData?.totalPomodoros || 0}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Friend Since</p>
                                    <p className="text-lg leading-tight font-black text-zinc-100 tabular-nums">{formatFriendSince(friend.since)}</p>
                                </div>
                            </div>
                        </Link>

                        <button
                            onClick={() => onRemoveFriend(friend.friendId)}
                            className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-xl transition-all z-20"
                            aria-label="Remove friend"
                        >
                            <UserMinus className="w-4 h-4" />
                        </button>
                    </motion.div>
                );
                        })}
                    </div>
                </section>
            )}
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
                    const recipientId = res.id || res.uid;
                    const isFriend = friends.some((f: any) => f.friendId === recipientId);
                    const hasSentRequest = sentRequests.some((r: any) => r.toUserId === recipientId);
                    const isRequesting = requestingIds.has(recipientId);
                    return (
                        <div key={recipientId} className="flex items-center gap-4 p-4 bg-zinc-900/40 rounded-2xl border border-white/5">
                            <Avatar className="w-10 h-10"><AvatarImage src={res.photoURL} /><AvatarFallback>{res.displayName?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1"><p className="text-sm font-bold text-white">{res.displayName}</p></div>
                            {isFriend ? (
                                <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Friend</span>
                            ) : hasSentRequest ? (
                                <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Pending</span>
                            ) : (
                                <button onClick={() => onSendRequest(recipientId, res.displayName)} disabled={isRequesting || !recipientId} className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
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
