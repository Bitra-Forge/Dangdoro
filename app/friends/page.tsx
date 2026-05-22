"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
    UserPlus, X, Search, Users, Check, ArrowLeft,
    UserCheck, UserMinus
} from "lucide-react";
import {
    sendFriendRequest, acceptFriendRequest, declineFriendRequest,
    removeFriend, cancelFriendRequest, subscribeToReceivedFriendRequests,
    subscribeToFriendsList, getSentFriendRequests
} from "@/lib/friendship";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Tab = "friends" | "requests" | "search";

type FirestoreLikeTimestamp = {
    toDate?: () => Date;
    toMillis?: () => number;
};

type MaybeTimestamp = FirestoreLikeTimestamp | Date | null | undefined;

type FriendUserData = {
    id?: string;
    uid?: string;
    displayName?: string;
    photoURL?: string;
    totalMinutes?: number;
    totalPomodoros?: number;
    lastActive?: MaybeTimestamp;
};

type FriendItem = {
    friendId: string;
    since?: MaybeTimestamp;
    userData?: FriendUserData | null;
};

type RequestItem = {
    id: string;
    fromUserId: string;
    toUserId: string;
    createdAt?: MaybeTimestamp;
    fromUserData?: FriendUserData | null;
    toUserData?: FriendUserData | null;
};

type SearchUser = FriendUserData & {
    id?: string;
    uid?: string;
    displayName?: string;
};

export default function FriendsPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("friends");
    const [friends, setFriends] = useState<FriendItem[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<RequestItem[]>([]);
    const [sentRequests, setSentRequests] = useState<RequestItem[]>([]);
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());
    const [profileImageUrl, setProfileImageUrl] = useState("");
    const [unfriendDialogOpen, setUnfriendDialogOpen] = useState(false);
    const [friendToRemoveId, setFriendToRemoveId] = useState<string | null>(null);

    useEffect(() => {
        if (!user || user.isAnonymous) return;

        const unsubFriends = subscribeToFriendsList(user.uid, (friendsData) => {
            setFriends(friendsData as FriendItem[]);
            setLoading(false);
        });

        const unsubRequests = subscribeToReceivedFriendRequests(user.uid, (requests) => {
            setReceivedRequests(requests as RequestItem[]);
        });

        const loadSentRequests = async () => {
            const sent = await getSentFriendRequests(user.uid);
            setSentRequests(sent as RequestItem[]);
        };
        loadSentRequests();

        return () => {
            unsubFriends();
            unsubRequests();
        };
    }, [user]);

    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        const timeout = setTimeout(async () => {
            const { searchUsers } = await import("@/lib/friendship");
            const results = await searchUsers(searchQuery, user?.uid || "", 20);
            setSearchResults(results as SearchUser[]);
            setSearching(false);
        }, 500);

        searchTimeoutRef.current = timeout;
        return () => clearTimeout(timeout);
    }, [searchQuery, user?.uid]);

    useEffect(() => {
        const loadProfileImage = async () => {
            if (!user?.uid || user.isAnonymous) {
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
    }, [user?.uid, user?.photoURL, user?.isAnonymous]);

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
            setSentRequests(sent as RequestItem[]);
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

    const requestRemoveFriend = (friendId: string) => {
        setFriendToRemoveId(friendId);
        setUnfriendDialogOpen(true);
    };

    const confirmRemoveFriend = async () => {
        if (!friendToRemoveId) return;
        await handleRemoveFriend(friendToRemoveId);
        setUnfriendDialogOpen(false);
        setFriendToRemoveId(null);
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
                <AuthRequired title="Friends restricted" description="Sign in to connect with friends and see their focus activity." />
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

                            <div className="flex justify-center mt-3">
                                <Link
                                    href="/profile"
                                    className="group inline-flex items-center gap-2 px-1 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-white"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-1" />
                                    Back to Profile
                                </Link>
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
                                    <div className="w-20 h-20 md:w-24 md:h-24 overflow-hidden rounded-[2px] border-2 border-sky-900/60 shadow-[0_0_15px_rgba(12,74,110,0.25)] bg-zinc-800">
                                        {profileImageUrl ? (
                                            <Image
                                                src={profileImageUrl}
                                                alt="User profile"
                                                width={96}
                                                height={96}
                                                unoptimized
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
                                {activeTab === "friends" && (
                                    <FriendsTab 
                                        friends={friends} 
                                        loading={loading} 
                                        onRemoveFriend={requestRemoveFriend} 
                                        onGoToSearch={() => setActiveTab("search")} 
                                    />
                                )}
                                {activeTab === "requests" && (
                                    <RequestsTab 
                                        receivedRequests={receivedRequests} 
                                        sentRequests={sentRequests} 
                                        onAccept={handleAcceptRequest} 
                                        onDecline={handleDeclineRequest} 
                                        onCancel={handleCancelRequest} 
                                    />
                                )}
                                {activeTab === "search" && (
                                    <SearchTab 
                                        searchQuery={searchQuery} 
                                        setSearchQuery={setSearchQuery} 
                                        searching={searching} 
                                        searchResults={searchResults} 
                                        onSendRequest={handleSendRequest} 
                                        friends={friends} 
                                        sentRequests={sentRequests} 
                                        requestingIds={requestingIds} 
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                <Dialog
                    open={unfriendDialogOpen}
                    onOpenChange={(open) => {
                        setUnfriendDialogOpen(open);
                        if (!open) setFriendToRemoveId(null);
                    }}
                >
                    <DialogContent className="rounded-[5px] bg-zinc-900 border border-white/10 text-zinc-100">
                        <DialogHeader>
                            <DialogTitle className="ubuntu-bold text-zinc-100">Unfriend user?</DialogTitle>
                            <DialogDescription className="ubuntu-regular text-zinc-400">
                                This will remove the friend connection for both of you.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="rounded-b-[5px] bg-transparent border-t border-white/10 p-3 pt-4 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setUnfriendDialogOpen(false);
                                    setFriendToRemoveId(null);
                                }}
                                className="h-9 rounded-[5px] border-white/15 px-4 ubuntu-medium text-zinc-300 hover:bg-white/5 hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmRemoveFriend}
                                className="h-9 rounded-[5px] border border-red-500/30 bg-red-500/15 px-4 ubuntu-medium text-red-300 hover:bg-red-500/25 hover:text-red-200"
                            >
                                Unfriend
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </BackgroundTheme>
    );
}

function formatTimeAgo(timestamp: MaybeTimestamp) {
    if (!timestamp) return "unknown";
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate?.();
    if (!date) return "unknown";
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
}

type FriendsTabProps = {
    friends: FriendItem[];
    loading: boolean;
    onRemoveFriend: (friendId: string) => void;
    onGoToSearch: () => void;
};

function FriendsTab({ friends, loading, onRemoveFriend, onGoToSearch }: FriendsTabProps) {
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTime(Date.now()), 60_000);
        return () => clearInterval(intervalId);
    }, []);

    const formatFocusTime = (totalMinutes: number) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    const formatFriendSince = (timestamp: MaybeTimestamp) => {
        if (!timestamp) return "---";
        const date = timestamp instanceof Date ? timestamp : timestamp.toDate?.();
        if (!date) return "---";
        return date.getFullYear();
    };

    const isOnline = (timestamp: MaybeTimestamp) => {
        if (!timestamp) return false;
        const lastActive = timestamp instanceof Date ? timestamp : timestamp.toDate?.();
        if (!lastActive) return false;
        // 10 minute threshold accounts for slow heartbeats or clock drift
        return currentTime - lastActive.getTime() <= 10 * 60 * 1000;
    };

    const onlineFriends = friends.filter((friend) => isOnline(friend?.userData?.lastActive));
    const offlineFriends = friends.filter((friend) => !isOnline(friend?.userData?.lastActive));

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
                        <span className="ubuntu-bold text-[12px] font-black tracking-[0.2em] text-emerald-400">Online</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {onlineFriends.map((friend) => {
                            const userData = friend.userData;
                            const totalMinutes = userData?.totalMinutes || 0;
                            const profileUserId = userData?.uid || userData?.id || friend.friendId;
                            const online = true;

                            return (
                                <motion.div
                                    key={friend.friendId}
                                    whileHover={{}}
                                    className="ubuntu-regular group relative rounded-[5px] bg-zinc-900/40 backdrop-blur-xl border border-white/5 hover:border-white/10 shadow-2xl transition-all duration-300 overflow-hidden"
                                >
                                    <Link href={`/profile?user=${profileUserId}`} className="block p-5" aria-label={`Open ${userData?.displayName || "friend"} profile`}>
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent shadow-[0_0_8px_rgba(110,231,183,0.3)]" />
                                        </div>

                                        <div className="relative z-10 flex items-start gap-3">
                                            <Avatar className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                                                <AvatarImage src={userData?.photoURL} className="rounded-full object-cover" />
                                                <AvatarFallback className="rounded-full">{userData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="ubuntu-bold text-xl leading-none font-extrabold text-zinc-100 tracking-tight truncate">
                                                    {userData?.displayName || "Unknown"}
                                                </p>
                                                <div className="ubuntu-medium mt-2 flex items-center gap-1.5 text-[12px] font-semibold">
                                                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-500")} />
                                                    <span className={online ? "text-emerald-400" : "text-zinc-400"}>
                                                        {online ? "Online" : `Offline • Last seen ${formatTimeAgo(userData?.lastActive)}`}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>

                                        <div className="relative z-10 mt-5 border-t border-white/10 pt-4 grid grid-cols-3 gap-2">
                                            <div className="text-center">
                                                <p className="ubuntu-medium text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Focus Time</p>
                                                <p className="ubuntu-bold text-base leading-tight font-black text-zinc-100 tabular-nums">{formatFocusTime(totalMinutes)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="ubuntu-medium text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Sessions</p>
                                                <p className="ubuntu-bold text-base leading-tight font-black text-zinc-100 tabular-nums">{userData?.totalPomodoros || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="ubuntu-medium text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Friend Since</p>
                                                <p className="ubuntu-bold text-base leading-tight font-black text-zinc-100 tabular-nums">{formatFriendSince(friend.since)}</p>
                                            </div>
                                        </div>
                                    </Link>

                                    <button
                                        onClick={() => onRemoveFriend(friend.friendId)}
                                        className="absolute top-3 right-3 p-2 opacity-0 translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 text-red-500 hover:text-red-400 cursor-pointer transition-all duration-200 ease-out z-20"
                                        aria-label="Remove friend"
                                    >
                                        <motion.span
                                            whileHover={{ scale: 1.12 }}
                                            transition={{ duration: 0.18, ease: "easeOut" }}
                                            className="inline-flex"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </motion.span>
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
                        <span className="ubuntu-bold text-[12px] font-black tracking-[0.2em] text-zinc-500">Offline</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {offlineFriends.map((friend) => {
                            const userData = friend.userData;
                            const totalMinutes = userData?.totalMinutes || 0;
                            const profileUserId = userData?.uid || userData?.id || friend.friendId;
                            const online = false;

                            return (
                                <motion.div
                                    key={friend.friendId}
                                    whileHover={{}}
                                    className="ubuntu-regular group relative rounded-[5px] bg-zinc-900/40 backdrop-blur-xl border border-white/5 hover:border-white/10 shadow-2xl transition-all duration-300 overflow-hidden"
                                >
                                    <Link href={`/profile?user=${profileUserId}`} className="block p-5" aria-label={`Open ${userData?.displayName || "friend"} profile`}>
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-300/60 to-transparent shadow-[0_0_8px_rgba(125,211,252,0.3)]" />
                                        </div>

                                        <div className="relative z-10 flex items-start gap-3">
                                            <Avatar className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                                                <AvatarImage src={userData?.photoURL} className="rounded-full object-cover" />
                                                <AvatarFallback className="rounded-full">{userData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="ubuntu-bold text-xl leading-none font-extrabold text-zinc-100 tracking-tight truncate">
                                                    {userData?.displayName || "Unknown"}
                                                </p>
                                                <div className="ubuntu-medium mt-2 flex items-center gap-1.5 text-[12px] font-semibold">
                                                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-500")} />
                                                    <span className={online ? "text-emerald-400" : "text-zinc-400"}>
                                                        {online ? "Online" : `Offline • Last seen ${formatTimeAgo(userData?.lastActive)}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative z-10 mt-5 border-t border-white/10 pt-4 grid grid-cols-3 gap-2">
                                            <div className="text-center">
                                                <p className="ubuntu-medium text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Focus Time</p>
                                                <p className="ubuntu-bold text-base leading-tight font-black text-zinc-100 tabular-nums">{formatFocusTime(totalMinutes)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="ubuntu-medium text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Sessions</p>
                                                <p className="ubuntu-bold text-base leading-tight font-black text-zinc-100 tabular-nums">{userData?.totalPomodoros || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="ubuntu-medium text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Friend Since</p>
                                                <p className="ubuntu-bold text-base leading-tight font-black text-zinc-100 tabular-nums">{formatFriendSince(friend.since)}</p>
                                            </div>
                                        </div>
                                    </Link>

                                    <button
                                        onClick={() => onRemoveFriend(friend.friendId)}
                                        className="absolute top-3 right-3 p-2 opacity-0 translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 text-red-500 hover:text-red-400 cursor-pointer transition-all duration-200 ease-out z-20"
                                        aria-label="Remove friend"
                                    >
                                        <motion.span
                                            whileHover={{ scale: 1.12 }}
                                            transition={{ duration: 0.18, ease: "easeOut" }}
                                            className="inline-flex"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </motion.span>
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

type RequestsTabProps = {
    receivedRequests: RequestItem[];
    sentRequests: RequestItem[];
    onAccept: (requestId: string, fromUserId: string) => void;
    onDecline: (requestId: string) => void;
    onCancel: (requestId: string) => void;
};

function RequestsTab({ receivedRequests, sentRequests, onAccept, onDecline, onCancel }: RequestsTabProps) {
    return (
        <div className="space-y-10">
            {receivedRequests.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="inline-block w-[2px] h-4 bg-sky-400 rounded-full" />
                        <span className="ubuntu-bold text-[12px] font-black tracking-[0.2em] text-zinc-400">Received ({receivedRequests.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {receivedRequests.map((req) => {
                            const profileUserId = req.fromUserData?.uid || req.fromUserData?.id || req.fromUserId;

                            return (
                                <motion.div
                                    key={req.id}
                                    whileHover={{}}
                                    className="ubuntu-regular group relative rounded-[5px] bg-zinc-900/40 backdrop-blur-xl border border-white/5 hover:border-white/10 shadow-2xl transition-all duration-300 overflow-hidden"
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-300/60 to-transparent shadow-[0_0_8px_rgba(253,224,71,0.3)]" />
                                    </div>

                                    <div className="relative z-10 p-5">
                                        <Link href={`/profile?user=${profileUserId}`} className="flex items-center gap-3 rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60" aria-label={`Open ${req.fromUserData?.displayName || "user"} profile`}>
                                            <Avatar className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                                                <AvatarImage src={req.fromUserData?.photoURL} className="rounded-full object-cover" />
                                                <AvatarFallback className="rounded-full">{req.fromUserData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="ubuntu-bold text-lg leading-tight font-extrabold text-zinc-100 tracking-tight truncate">
                                                    {req.fromUserData?.displayName || "Unknown"}
                                                </p>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <p className="text-[11px] font-semibold text-zinc-400">Incoming request</p>
                                                    {req.createdAt && (
                                                        <p className="text-[10px] text-zinc-500 font-medium">{formatTimeAgo(req.createdAt)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>

                                        <div className="mt-5 grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => onAccept(req.id, req.fromUserId)}
                                                className="h-10 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/90 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-400 transition-all font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 group/btn"
                                            >
                                                <Check className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" />
                                                <span>Accept</span>
                                            </button>
                                            <button
                                                onClick={() => onDecline(req.id)}
                                                className="h-10 rounded-[8px] bg-zinc-800/50 border border-white/5 text-zinc-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 group/btn"
                                            >
                                                <X className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" />
                                                <span>Decline</span>
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>
            )}

            <section>
                <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block w-[2px] h-4 bg-zinc-600 rounded-full" />
                    <span className="ubuntu-bold text-[12px] font-black tracking-[0.2em] text-zinc-500">Sent ({sentRequests.length})</span>
                </div>
                {sentRequests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {sentRequests.map((req) => {
                            const profileUserId = req.toUserData?.uid || req.toUserData?.id || req.toUserId;

                            return (
                                <motion.div
                                    key={req.id}
                                    whileHover={{}}
                                    className="ubuntu-regular group relative rounded-[5px] bg-zinc-900/40 backdrop-blur-xl border border-white/5 hover:border-white/10 shadow-2xl transition-all duration-300 overflow-hidden"
                                >
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-300/60 to-transparent shadow-[0_0_8px_rgba(253,224,71,0.3)]" />
                                    </div>

                                    <div className="relative z-10 p-5">
                                        <Link href={`/profile?user=${profileUserId}`} className="flex items-center gap-3 rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60" aria-label={`Open ${req.toUserData?.displayName || "user"} profile`}>
                                            <Avatar className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                                                <AvatarImage src={req.toUserData?.photoURL} className="rounded-full object-cover" />
                                                <AvatarFallback className="rounded-full">{req.toUserData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="ubuntu-bold text-lg leading-tight font-extrabold text-zinc-100 tracking-tight truncate">
                                                    {req.toUserData?.displayName || "Unknown"}
                                                </p>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <p className="text-[11px] font-semibold text-zinc-400">Pending approval</p>
                                                    {req.createdAt && (
                                                        <p className="text-[10px] text-zinc-500 font-medium">{formatTimeAgo(req.createdAt)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>

                                        <div className="mt-5">
                                            <button
                                                onClick={() => onCancel(req.id)}
                                                className="w-full h-10 rounded-[8px] bg-zinc-800/40 border border-white/5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 group/btn"
                                            >
                                                <UserMinus className="w-3.5 h-3.5 opacity-0 scale-95 transition-all duration-200 group-hover/btn:opacity-100 group-hover/btn:scale-110" />
                                                <span>Cancel Request</span>
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-[10px] border border-white/10 bg-zinc-900/45 px-6 py-10 text-center">
                        <p className="text-zinc-600 text-[11px] font-black uppercase tracking-[0.2em]">No sent requests</p>
                    </div>
                )}
            </section>
        </div>
    );
}

type SearchTabProps = {
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    searching: boolean;
    searchResults: SearchUser[];
    onSendRequest: (toUserId: string, displayName: string) => void;
    friends: FriendItem[];
    sentRequests: RequestItem[];
    requestingIds: Set<string>;
};

function SearchTab({ searchQuery, setSearchQuery, searching, searchResults, onSendRequest, friends, sentRequests, requestingIds }: SearchTabProps) {
    const hasQuery = searchQuery.trim().length > 0;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="relative rounded-[10px] border border-white/10 bg-zinc-900/50 transition-colors focus-within:border-[#C9B037]/45">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search focusers by name..."
                        className="w-full bg-transparent pl-12 pr-12 py-4 text-white placeholder:text-zinc-500 outline-none"
                    />
                    {hasQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-[5px] border border-white/10 bg-zinc-800/70 text-zinc-400 hover:text-white hover:bg-zinc-700/70 transition-all"
                            aria-label="Clear search"
                        >
                            <X className="w-4 h-4 mx-auto" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {searching && hasQuery && (
                    <div className="rounded-[10px] border border-white/10 bg-zinc-900/40 px-6 py-10 text-center">
                        <p className="ubuntu-medium text-zinc-400 text-sm">Searching...</p>
                    </div>
                )}

                {!searching && hasQuery && searchResults.map((res) => {
                    const recipientId = res.id ?? res.uid ?? "";
                    const isFriend = friends.some((f) => f.friendId === recipientId);
                    const hasSentRequest = sentRequests.some((r) => r.toUserId === recipientId);
                    const isRequesting = requestingIds.has(recipientId);
                    return (
                        <div key={recipientId} className="ubuntu-regular flex items-center gap-4 p-4 bg-zinc-900/40 rounded-[10px] border border-white/5">
                            <Avatar className="w-10 h-10"><AvatarImage src={res.photoURL} /><AvatarFallback>{res.displayName?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1"><p className="ubuntu-bold text-sm font-bold text-white">{res.displayName}</p></div>
                            {isFriend ? (
                                <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-[5px] text-[10px] font-black uppercase tracking-widest">Friend</span>
                            ) : hasSentRequest ? (
                                <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-[5px] text-[10px] font-black uppercase tracking-widest">Pending</span>
                            ) : (
                                <button onClick={() => onSendRequest(recipientId, res.displayName ?? "Unknown")} disabled={isRequesting || !recipientId} className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-[5px] transition-all">
                                    {isRequesting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    );
                })}

                {hasQuery && !searching && searchResults.length === 0 && (
                    <div className="rounded-[10px] border border-white/10 bg-zinc-900/40 px-6 py-10 text-center">
                        <p className="ubuntu-medium text-zinc-500 text-sm">No users found matching &quot;{searchQuery}&quot;</p>
                    </div>
                )}

                {!hasQuery && (
                    <div className="rounded-[10px] border border-white/10 bg-zinc-900/20 px-6 py-10 text-center">
                        <p className="ubuntu-medium text-zinc-500 text-sm">Start typing a name to discover people.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
