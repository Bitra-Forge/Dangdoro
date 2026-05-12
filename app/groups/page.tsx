"use client";

import { useEffect, useState, useMemo, useRef, memo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import {
    Users, Clock, LogOut, Check,
    Hourglass, Plus, Play, StopCircle, UserCheck, Sparkles,
    Timer, Target, Zap, Settings, Lock, Globe, Copy, Key,
    ListTodo, ChevronRight, Trash2, Edit2, Shield, UserX, Pause,
    Briefcase, UserPlus, X, MoreVertical, LayoutGrid, User,
    Link2, Mail, Crown, Star, CheckCircle2, Search, Send,
    Flame, ArrowUpRight, TrendingUp, ExternalLink, MonitorPlay, Save, Circle
} from "lucide-react";
import { Power } from "lucide-react";
import { useTimerStore } from "@/lib/store";
import {
    subscribeToFriendsList
} from "@/lib/friendship";
import { fetchUserProfiles, savePartialPomodoroSession } from "@/lib/db";
import { applyGroupSessionAction } from "@/lib/group-session";
import { toast } from "sonner";
import { 
    doc, setDoc, onSnapshot, deleteDoc, collection, 
    serverTimestamp, updateDoc, addDoc, arrayUnion, increment,
    query, where, orderBy, getDocs 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["300", "400", "500", "600", "700"],
});

type GroupType = "friends" | "organization";
type GroupPrivacy = "public" | "private-code" | "private-invite";

interface SharedTask {
    id: string;
    title: string;
    description: string;
    assignedTo?: string;
    status: "todo" | "in-progress" | "in-review" | "done";
    priority: "high" | "medium" | "low";
    createdBy: string;
    createdAt: any;
    updatedAt?: any;
}

interface ObjectiveTemplateDraft {
    title: string;
    priority: "high" | "medium" | "low";
    description?: string;
}

interface FocusGroup {
    id: string;
    name: string;
    description: string;
    type: GroupType;
    hostId: string;
    hostName: string;
    members: string[];
    memberStats?: Record<string, {
        role: "host" | "admin" | "member";
        totalMinutes: number;
        joinedAt: any;
        lastActive?: any;
        isFocusing?: boolean;
        sessionStartedAt?: any;
    }>;
    memberDetails?: any[];
    startTime: any;
    status: "active" | "paused" | "idle";
    maxMembers?: number;
    privacy: GroupPrivacy;
    accessCode?: string;
    inviteToken?: string;
    pendingInvites?: string[];
    totalMinutes?: number;
    createdAt: any;
    settings?: {
        goalHours: number;
        maxMembers: number;
    };
}

// ─── Invite token helpers ───────────────────────────────────────────────────
function generateInviteToken() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function buildInviteLink(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/groups?invite=${token}`;
}

// ─── Format minutes ─────────────────────────────────────────────────────────
function fmtMinutes(mins: number) {
    if (!mins) return "0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

// ─── Privacy label helpers ───────────────────────────────────────────────────
const PRIVACY_META: Record<GroupPrivacy, { label: string; icon: any; color: string }> = {
    "public":         { label: "Public",          icon: Globe,  color: "text-emerald-400" },
    "private-code":   { label: "Code",            icon: Key,    color: "text-zinc-300" },
    "private-invite": { label: "Invite Only",     icon: Mail,   color: "text-violet-400" },
};

const LIVE_SESSION_STALE_MS = 3 * 60 * 1000;

function toMillis(ts: any): number | null {
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    if (typeof ts === "number") return ts;
    if (ts instanceof Date) return ts.getTime();
    // Fallback: If it's an object without these properties, it's likely an optimistic pending serverTimestamp.
    // Treat it as "now" so it wins deduplication battles.
    if (typeof ts === "object") return Date.now();
    return null;
}

function getEarliestActiveStart(memberDetails: any[] | undefined): any | null {
    if (!memberDetails?.length) return null;
    const activeStarts = memberDetails
        .filter((m: any) => m.isFocusing && m.liveSessionStartedAt)
        .map((m: any) => ({ raw: m.liveSessionStartedAt, ms: toMillis(m.liveSessionStartedAt) }))
        .filter((item: any) => typeof item.ms === "number")
        .sort((a: any, b: any) => a.ms - b.ms);
    return activeStarts.length > 0 ? activeStarts[0].raw : null;
}

function resolveLiveSessionsForGroup(groupId: string, sessions: any[]): any[] {
    const now = Date.now();
    const filtered = sessions.filter((s: any) => {
        if (s.groupId !== groupId) return false;
        const heartbeatMs = toMillis(s.lastHeartbeat) ?? toMillis(s.startedAt);
        // Keep pending/in-flight docs instead of dropping them and causing UI flicker.
        if (!heartbeatMs) return s.status === "focusing";
        return now - heartbeatMs <= LIVE_SESSION_STALE_MS;
    });

    // Deduplicate by userId and keep the freshest record.
    const byUser = new Map<string, any>();
    for (const session of filtered) {
        const key = session.userId;
        if (!key) continue;
        const current = byUser.get(key);
        if (!current) {
            byUser.set(key, session);
            continue;
        }

        const currentMs = toMillis(current.lastHeartbeat) ?? toMillis(current.startedAt) ?? 0;
        const nextMs = toMillis(session.lastHeartbeat) ?? toMillis(session.startedAt) ?? 0;
        if (nextMs >= currentMs) {
            byUser.set(key, session);
        }
    }
    return Array.from(byUser.values());
}

function normalizeLiveSessions(sessions: any[]): any[] {
    // Keep only active focusing sessions and dedupe globally per user.
    const active = sessions.filter((s: any) => s?.status === "focusing");
    const byUser = new Map<string, any>();
    for (const session of active) {
        const userId = session?.userId;
        if (!userId) continue;
        const current = byUser.get(userId);
        if (!current) {
            byUser.set(userId, session);
            continue;
        }
        const currentMs = toMillis(current.lastHeartbeat) ?? toMillis(current.startedAt) ?? 0;
        const nextMs = toMillis(session.lastHeartbeat) ?? toMillis(session.startedAt) ?? 0;
        if (nextMs >= currentMs) byUser.set(userId, session);
    }
    return Array.from(byUser.values());
}

export default function GroupsPage() {
    const { user, loading: authLoading } = useAuth();
    const [friends, setFriends] = useState<any[]>([]);
    const [focusGroups, setFocusGroups] = useState<FocusGroup[]>([]);
    const [liveSessions, setLiveSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [privacy, setPrivacy] = useState<GroupPrivacy>("private-invite");
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const setActiveGroupId = useTimerStore(s => s.setActiveGroupId);

    // sync local activeGroupId is handled through explicit session actions
    const [activeModalTab, setActiveModalTab] = useState<"workspace" | "members">("workspace");

    const [hydratedProfiles, setHydratedProfiles] = useState<Record<string, any>>({});
    const lastActiveCountRef = useRef<Record<string, number>>({});

    // Toast notifications for joined focusers
    useEffect(() => {
        focusGroups.forEach(group => {
            const currentActiveUsers = group.memberDetails?.filter((m: any) => m.isFocusing) || [];
            const previousCount = lastActiveCountRef.current[group.id] || 0;
            
            if (currentActiveUsers.length > previousCount) {
                const newUser = currentActiveUsers[currentActiveUsers.length - 1];
                if (newUser && newUser.uid !== user?.uid) {
                    toast.success(`${newUser.displayName} started focusing`, {
                        description: `Now focusing in ${group.name}`,
                        icon: <Flame className="w-4 h-4 text-indigo-500" />
                    });
                }
            }
            lastActiveCountRef.current[group.id] = currentActiveUsers.length;
        });
    }, [focusGroups, user?.uid]);

    const enrichedGroups = useMemo(() => {
        return focusGroups.map(group => {
            const groupLiveSessions = resolveLiveSessionsForGroup(group.id, liveSessions);
            const memberDetails: any[] = [];
            for (const memberId of group.members) {
                const friend = friends.find(f => f.friendId === memberId);
                const stats = group.memberStats?.[memberId] || { role: "member", totalMinutes: 0 };
                const hydration = hydratedProfiles[memberId];
                
                // Real-time activity is now derived from liveSessions collection
                const memberLiveSession = groupLiveSessions.find(ls => ls.userId === memberId);
                const isFocusing = !!memberLiveSession;

                const role = stats.role || (group.hostId === memberId ? "host" : "member");

                if (memberId === user?.uid) {
                    const firestoreProfile = hydratedProfiles[memberId];
                    memberDetails.push({
                        uid: user.uid,
                        displayName: firestoreProfile?.displayName || user.displayName,
                        photoURL: firestoreProfile?.photoURL || user.photoURL,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === user.uid
                    });
                } else if (friend?.userData) {
                    memberDetails.push({
                        ...friend.userData,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === memberId
                    });
                } else if (hydration) {
                    memberDetails.push({
                        ...hydration,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === memberId
                    });
                } else {
                    memberDetails.push({
                        uid: memberId,
                        displayName: "Member",
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === memberId
                    });
                }
            }
            return { ...group, memberDetails };
        });
    }, [focusGroups, friends, user, hydratedProfiles, liveSessions]);

    const userGroups = useMemo(() => {
        if (!user) return [];
        return enrichedGroups.filter(g => g.members.includes(user.uid));
    }, [enrichedGroups, user]);

    const publicGroups = useMemo(() => {
        if (!user) return enrichedGroups.filter(g => g.privacy === "public");
        return enrichedGroups.filter(g => g.privacy === "public" && !g.members.includes(user.uid));
    }, [enrichedGroups, user]);

    // Handle invite token from URL
    useEffect(() => {
        if (!user || typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const token = params.get("invite");
        if (!token) return;
        const matchingGroup = focusGroups.find(g => g.inviteToken === token);
        if (matchingGroup && !matchingGroup.members.includes(user.uid)) {
            handleJoinGroup(matchingGroup.id);
            window.history.replaceState({}, "", "/groups");
        }
    }, [focusGroups, user]);

    useEffect(() => {
        if (!user) return;

        const unsubFriends = subscribeToFriendsList(user.uid, (friendsData) => {
            setFriends(friendsData);
        });

        const unsubGroups = onSnapshot(
            collection(db, "focusGroups"),
            (snapshot) => {
                const groups: FocusGroup[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FocusGroup));
                setFocusGroups(groups);
                setLoading(false);
            },
            (error) => {
                console.error("focusGroups listener error:", error);
                setLoading(false);
            }
        );

        const unsubLive = onSnapshot(
            collection(db, "liveSessions"),
            (snapshot) => {
                const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const normalized = normalizeLiveSessions(raw);
                setLiveSessions(prev => {
                    if (prev.length !== normalized.length) return normalized;
                    const prevMap = new Map(prev.map(s => [s.userId, s]));
                    let changed = false;
                    for (const n of normalized) {
                        const p = prevMap.get(n.userId);
                        if (!p) { changed = true; break; }
                        if (p.groupId !== n.groupId) { changed = true; break; }
                        if (p.status !== n.status) { changed = true; break; }
                        if (toMillis(p.startedAt) !== toMillis(n.startedAt)) { changed = true; break; }
                    }
                    return changed ? normalized : prev;
                });
            }
        );

        return () => {
            unsubFriends();
            unsubGroups();
            unsubLive();
        };
    }, [user?.uid]);

    useEffect(() => {
        const missingUids = new Set<string>();
        focusGroups.forEach(group => {
            group.members.forEach(uid => {
                if (!friends.find(f => f.friendId === uid) && !hydratedProfiles[uid]) {
                    missingUids.add(uid);
                }
            });
        });

        if (missingUids.size > 0) {
            fetchUserProfiles(Array.from(missingUids)).then(profiles => {
                const newProfiles: any = { ...hydratedProfiles };
                let updated = false;
                profiles.forEach((p: any) => {
                    newProfiles[p.uid] = p;
                    updated = true;
                });
                // To prevent infinite loop if a profile doesn't exist, we must add a marker
                missingUids.forEach(uid => {
                    if (!newProfiles[uid]) {
                        newProfiles[uid] = { uid, notFound: true }; // Marker to prevent re-fetching
                        updated = true;
                    }
                });
                if (updated) setHydratedProfiles(newProfiles);
            });
        }
    }, [focusGroups, friends, user?.uid, hydratedProfiles]);

    // All members currently focusing across user's groups
    const activeFocusers = useMemo(() => {
        if (!user) return [];
        const seen = new Set<string>();
        const result: any[] = [];
        userGroups.forEach(g => {
            g.memberDetails?.forEach((m: any) => {
                // Now uses the specific isFocusing flag for real-time accuracy
                if (m.uid !== user.uid && m.isFocusing && !seen.has(m.uid)) {
                    seen.add(m.uid);
                    result.push({ ...m, groupName: g.name, groupId: g.id });
                }
            });
        });
        return result;
    }, [userGroups, user?.uid]);

    const handleJoinGroup = async (groupId: string, accessCode?: string) => {
        if (!user) return;
        const group = focusGroups.find(g => g.id === groupId);
        if (!group) return;

        if (group.privacy === "private-code" && !accessCode) {
            setShowJoinCodeModal(true);
            return;
        }
        if (group.privacy === "private-invite") {
            toast.error("This workspace is invite-only. Ask the host for an invite.");
            return;
        }

        // Enforce Member Capacity
        if (group.settings?.maxMembers && (group.members?.length || 0) >= group.settings.maxMembers) {
            toast.error(`This unit is at maximum capacity (${group.settings.maxMembers} members).`);
            return;
        }

        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, {
            members: arrayUnion(user.uid),
            memberCount: increment(1),
            [`memberStats.${user.uid}`]: {
                role: "member",
                totalMinutes: 0,
                joinedAt: serverTimestamp()
            }
        });

        toast.success(`Joined "${group.name}"!`);
        setSelectedGroupId(groupId);
    };

    const handleJoinByCode = async (code: string) => {
        if (!user || !code.trim()) return;
        
        try {
            const q = query(collection(db, "focusGroups"), where("accessCode", "==", code.trim().toUpperCase()));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                toast.error("Invalid or expired access code");
                return;
            }

            const groupDoc = snap.docs[0];
            const groupData = groupDoc.data() as FocusGroup;

            if (groupData.members.includes(user.uid)) {
                toast.info(`You are already a member of "${groupData.name}"`);
                setSelectedGroupId(groupDoc.id);
                setShowJoinCodeModal(false);
                return;
            }

            // Enforce Member Capacity
            if (groupData.settings?.maxMembers && (groupData.members?.length || 0) >= groupData.settings.maxMembers) {
                toast.error(`This unit is at maximum capacity (${groupData.settings.maxMembers} members).`);
                return;
            }

            const groupRef = doc(db, "focusGroups", groupDoc.id);
            await updateDoc(groupRef, {
                members: arrayUnion(user.uid),
                memberCount: increment(1),
                [`memberStats.${user.uid}`]: {
                    role: "member",
                    totalMinutes: 0,
                    joinedAt: serverTimestamp()
                }
            });

            toast.success(`Joined "${groupData.name}"!`);
            setSelectedGroupId(groupDoc.id);
            setShowJoinCodeModal(false);
        } catch (error) {
            console.error("Error joining group by code:", error);
            toast.error("System error during connection");
        }
    };

    const handleLeaveGroup = async (groupId: string) => {
        if (!user) return;
        const group = focusGroups.find(g => g.id === groupId);
        if (!group) return;

        const newMembers = group.members.filter(m => m !== user.uid);
        if (newMembers.length === 0) {
            await deleteDoc(doc(db, "focusGroups", groupId));
        } else {
            const newHostId = group.hostId === user.uid ? newMembers[0] : group.hostId;
            const updateStats: any = { ...group.memberStats };
            delete updateStats[user.uid];
            
            if (group.hostId === user.uid && newHostId && updateStats[newHostId]) {
                updateStats[newHostId].role = "host";
            }
            
            await updateDoc(doc(db, "focusGroups", groupId), {
                members: newMembers,
                hostId: newHostId,
                memberStats: updateStats,
                memberCount: increment(-1)
            });
        }
        toast.info("Left group");
        setSelectedGroupId(null);
    };

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[white]/20 border-t-[white] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <BackgroundTheme showSettings={false} disableDots subtleOverlay />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Groups Locked" description="Sign in to create focus groups and join organizations." />
            </main>
        </div>
    );

    if (loading) return (
        <BackgroundTheme showSettings={false} disableDots subtleOverlay>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    <header className="flex flex-col items-center text-center mb-12 w-full">
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Groups</h1>
                        <p className="text-zinc-500 text-sm max-w-md">Create a group or join with a code.</p>
                    </header>
                    <div className="w-full max-w-4xl space-y-6 animate-pulse">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="h-24 rounded-3xl bg-zinc-900/60 border border-white/5" />
                            <div className="h-24 rounded-3xl bg-zinc-900/60 border border-white/5" />
                        </div>
                        <div className="h-4 w-32 rounded-full bg-zinc-800 mt-8" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="h-52 rounded-3xl bg-zinc-900/60 border border-white/5" />
                            <div className="h-52 rounded-3xl bg-zinc-900/60 border border-white/5" />
                        </div>
                    </div>
                </main>
            </div>
        </BackgroundTheme>
    );

    return (
        <BackgroundTheme showSettings={false} disableDots subtleOverlay>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">

                    {/* ── Hero Header ── */}
                    <header className="flex flex-col items-center text-center mb-12 w-full pt-10 relative">

                        <motion.div
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mb-4"
                        >
                            <span className="text-[10px] font-black tracking-[0.25em] text-zinc-500 uppercase">Team Focus</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                            className="text-4xl md:text-5xl font-black tracking-tight mb-3 leading-none text-white"
                        >
                            Groups
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.16 }}
                            className="text-zinc-500 text-sm max-w-lg leading-relaxed"
                        >
                            Create a group, join with a code, and focus together.
                        </motion.p>
                    </header>

                    <div className="w-full max-w-4xl space-y-6">
                        {/* ── Action Cards ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <motion.button
                                initial={false}
                                whileHover={{ scale: 1.01, y: -1 }}
                                whileTap={{ scale: 0.985 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                onClick={() => setShowCreateGroup(!showCreateGroup)}
                                className={cn(
                                    "p-5 rounded-2xl border transition-colors duration-200 flex items-center gap-4 group",
                                    showCreateGroup
                                        ? "bg-[white]/10 border-[white]/40"
                                        : settingsGlassmorphism
                                        ? "bg-zinc-900/50 border-white/10 hover:border-[white]/35 hover:bg-zinc-800/60"
                                        : "bg-zinc-900 border-white/10 hover:border-[white]/35 hover:bg-zinc-800/60"
                                )}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 shrink-0",
                                    showCreateGroup ? "bg-[white]/25" : "bg-[white]/10 group-hover:bg-[white]/20"
                                )}>
                                    <Plus className={cn("w-7 h-7 transition-transform duration-200", showCreateGroup ? "text-[white] rotate-45" : "text-[white]")} />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-black text-white mb-0.5">Create Group</h3>
                                    <p className="text-[11px] text-zinc-500">Start a new focus group.</p>
                                </div>
                            </motion.button>

                            <motion.button
                                initial={false}
                                whileHover={{ scale: 1.01, y: -1 }}
                                whileTap={{ scale: 0.985 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                onClick={() => setShowJoinCodeModal(true)}
                                className={cn(
                                    "p-5 rounded-2xl border transition-colors duration-200 flex items-center gap-4 group",
                                    settingsGlassmorphism
                                        ? "bg-zinc-900/50 border-white/10 hover:border-zinc-300/30 hover:bg-zinc-800/60"
                                        : "bg-zinc-900 border-white/10 hover:border-zinc-300/30 hover:bg-zinc-800/60"
                                )}
                            >
                                <div className="w-12 h-12 rounded-xl bg-zinc-950/70 flex items-center justify-center group-hover:bg-zinc-300/10 transition-colors duration-200 border border-white/10 shrink-0">
                                    <Key className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 transition-colors duration-200" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-black text-white mb-0.5">Join with Code</h3>
                                    <p className="text-[11px] text-zinc-500">Enter a 6-character group code.</p>
                                </div>
                            </motion.button>
                        </div>

                        <AnimatePresence>
                            {showCreateGroup && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                    <CreateGroupForm
                                        user={user}
                                        onClose={() => setShowCreateGroup(false)}
                                        privacy={privacy}
                                        setPrivacy={setPrivacy}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Active Focusers Banner */}
                        {activeFocusers.length > 0 && (
                            <ActiveFocusersBanner focusers={activeFocusers} />
                        )}

                        <div className="space-y-14">
                            {userGroups.length > 0 && (
                                <section>
                                    {/* Section header */}
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[white]" />
                                        <h2 className="text-lg font-black text-white tracking-tight">Your Groups</h2>
                                        <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/8 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            {userGroups.length} {userGroups.length === 1 ? "group" : "groups"}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {userGroups.map((group, i) => (
                                            <div key={group.id}>
                                                <EnhancedGroupCard group={group} onClick={() => setSelectedGroupId(group.id)} isMember={true} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {userGroups.length === 0 && publicGroups.length === 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center py-24 gap-6 text-center"
                                >
                                    <div className="relative">
                                        <div className="w-24 h-24 rounded-3xl bg-zinc-900/80 border border-white/5 flex items-center justify-center">
                                            <Users className="w-10 h-10 text-zinc-700" />
                                        </div>
                                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-[white]/10 border border-[white]/20 flex items-center justify-center">
                                            <Plus className="w-4 h-4 text-[white]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-white">No groups yet</h3>
                                        <p className="text-sm text-zinc-600 max-w-xs">Create your first group or join one with an access code to start focusing together.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateGroup(true)}
                                        className="px-6 py-3 bg-[white] text-black font-black text-sm rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_8px_24px_rgba(232,130,26,0.3)]"
                                    >
                                        Create First Group
                                    </button>
                                </motion.div>
                            )}

                            {publicGroups.length > 0 && (
                                <section>
                                    {/* Section header */}
                                    <div className="flex items-center gap-3 mb-6">
                                        <Globe className="w-5 h-5 text-zinc-600" />
                                        <h2 className="text-lg font-black text-zinc-400 tracking-tight">Explore Public Groups</h2>
                                        <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/8 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                            {publicGroups.length} open
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {publicGroups.map((group, i) => (
                                            <div key={group.id}>
                                                <EnhancedGroupCard group={group} onClick={() => setSelectedGroupId(group.id)} isMember={false} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </main>

                <AnimatePresence>
                    {selectedGroupId && (
                        <MemoizedGroupDetailModal
                            key={selectedGroupId}
                            groupId={selectedGroupId}
                            onClose={() => setSelectedGroupId(null)}
                            user={user}
                            groups={enrichedGroups}
                            friends={friends}
                            activeTab={activeModalTab}
                            setActiveTab={setActiveModalTab}
                            onJoin={handleJoinGroup}
                            onLeave={handleLeaveGroup}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showJoinCodeModal && (
                        <JoinCodeModal 
                            onClose={() => setShowJoinCodeModal(false)} 
                            onJoin={handleJoinByCode}
                        />
                    )}
                </AnimatePresence>
            </div>

        </BackgroundTheme>
    );
}

// ─── Create Group Form ────────────────────────────────────────────────────────
function CreateGroupForm({ user, onClose, privacy, setPrivacy }: any) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    useEffect(() => {
        if (privacy === "private-invite") {
            setPrivacy("private-code");
        }
    }, [privacy, setPrivacy]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        const groupRef = doc(collection(db, "focusGroups"));
        const accessCode = privacy === "private-code" ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
        const inviteToken = privacy === "private-invite" ? generateInviteToken() : null;
        
        const initialMembers = [user.uid];
        const memberStats: any = {
            [user.uid]: { role: "host", totalMinutes: 0, joinedAt: serverTimestamp() }
        };

        // Legacy compatibility for older private-invite groups.
        const pendingInvites: string[] = [];

        await setDoc(groupRef, {
            name,
            description: desc,
            type: "friends",
            hostId: user.uid,
            hostName: user.displayName || "Forge User",
            members: initialMembers,
            memberCount: 1,
            totalMinutes: 0,
            memberStats,
            privacy,
            accessCode,
            inviteToken,
            pendingInvites,
            status: "idle",
            createdAt: serverTimestamp()
        });
        toast.success("Group created");
        onClose();
    };

    const privacyOptions: { value: Exclude<GroupPrivacy, "private-invite">; label: string; desc: string; icon: any; color: string }[] = [
        { value: "public",         label: "Public",         desc: "Discoverable by everyone",  icon: Globe,  color: "#34d399" },
        { value: "private-code",   label: "Code Access",    desc: "Entry via 6-char code",     icon: Key,    color: "#fbbf24" },
    ];

    return (
        <div className={cn("p-6 rounded-2xl border space-y-6", settingsGlassmorphism ? "bg-zinc-900/50 border-white/10" : "bg-zinc-900 border-white/10")}>
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="w-9 h-9 rounded-xl bg-[white]/15 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-[white]" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-white">Create New Group</h3>
                    <p className="text-[10px] text-zinc-600">Friends-focused workspace for shared objectives.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Group Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning Deep Workers" className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[white]/40 outline-none transition-all placeholder:text-zinc-700" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Description</label>
                        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Goals, schedule, what you're working on..." className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[white]/40 outline-none transition-all h-28 resize-none placeholder:text-zinc-700" />
                    </div>
                </div>
                <div className="space-y-5">
                    {/* Privacy */}
                    <div>
                        <p className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-3">Privacy</p>
                        <div className="flex flex-col gap-2">
                            {privacyOptions.map(opt => {
                                const Icon = opt.icon;
                                const isSelected = privacy === opt.value;
                                return (
                                    <button key={opt.value} onClick={() => setPrivacy(opt.value)} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all text-left", isSelected ? "border-white/20 bg-white/5" : "border-white/10 bg-zinc-950 hover:bg-zinc-900")}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected ? opt.color + "22" : "transparent" }}>
                                            <Icon className="w-4 h-4" style={{ color: isSelected ? opt.color : "#52525b" }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-xs font-bold", isSelected ? "text-white" : "text-zinc-500")}>{opt.label}</p>
                                            <p className="text-[10px] text-zinc-600">{opt.desc}</p>
                                        </div>
                                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white/40 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-1">
                <button onClick={handleCreate} className="flex-1 bg-[white] text-black font-black py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all">Create Group</button>
                <button onClick={onClose} className="px-6 bg-zinc-800 text-white font-bold rounded-xl border border-white/10">Cancel</button>
            </div>
        </div>
    );
}

// ─── Enhanced Group Card ──────────────────────────────────────────────────────
const EnhancedGroupCard = memo(function EnhancedGroupCard({ group, onClick, isMember }: any) {
    const isOrg = group.type === "organization";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const privacyMeta = PRIVACY_META[group.privacy as GroupPrivacy] ?? PRIVACY_META["public"];
    const PrivacyIcon = privacyMeta.icon;
    const totalMinutes: number = group.totalMinutes || group.memberDetails?.reduce((acc: number, m: any) => acc + (m.totalMinutes || 0), 0) || 0;
    const memberCount: number = group.members?.length || 0;

    // Role breakdown for orgs
    const roles = useMemo(() => {
        if (!isOrg || !group.memberDetails) return null;
        const hosts = group.memberDetails.filter((m: any) => m.role === "host").length;
        const admins = group.memberDetails.filter((m: any) => m.role === "admin").length;
        const members = group.memberDetails.filter((m: any) => m.role === "member").length;
        return { hosts, admins, members };
    }, [group.memberDetails, isOrg]);

    const activeFocuserCount = (group.memberDetails?.filter((m: any) => m.isFocusing).length || 0);
    const isActive = activeFocuserCount > 0;
    const activeStartTime = getEarliestActiveStart(group.memberDetails) ?? group.startTime;
    const activeRatio = memberCount > 0 ? Math.min(100, Math.round((activeFocuserCount / memberCount) * 100)) : 0;

    return (
        <motion.div
            initial={false}
            whileHover={{ scale: 1.015, y: -2 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={onClick}
            className={cn(
                "relative group cursor-pointer overflow-hidden rounded-2xl border transition-colors duration-200",
                settingsGlassmorphism ? "bg-zinc-900/55" : "bg-zinc-900",
                isActive
                    ? "border-[white]/40"
                    : isMember
                    ? "border-white/10 hover:border-[white]/25"
                    : "border-white/10 hover:border-white/20"
            )}
        >
            {/* ── Org accent bar ── */}
            {isOrg && (
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-[white]/40" />
            )}

            {/* ── Card body ── */}
            <div className="relative z-10 p-5 flex flex-col gap-4">

                {/* Top row: badges + member count */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            isOrg
                                ? "bg-[white]/10 border-[white]/25 text-[white]"
                                : "bg-indigo-500/8 border-indigo-400/20 text-indigo-400"
                        )}>
                            {isOrg ? <Briefcase className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                            {isOrg ? "Org" : "Friends"}
                        </span>
                        <span className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/8 bg-white/4",
                            privacyMeta.color
                        )}>
                            <PrivacyIcon className="w-2.5 h-2.5" />
                            {privacyMeta.label}
                        </span>
                    </div>
                    <span className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black border shrink-0",
                        isActive ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" : "bg-white/5 text-zinc-500 border-white/10"
                    )}>
                        <Flame className="w-2.5 h-2.5" />
                        {isActive ? `${activeFocuserCount} active` : "idle"}
                    </span>
                </div>

                {/* Name + host */}
                <div>
                    <h4 className="text-base font-black text-white group-hover:text-[white] transition-colors duration-200 leading-snug tracking-tight truncate">
                        {group.name}
                    </h4>
                    {group.description && (
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{group.description}</p>
                    )}
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.18em] mt-1.5 flex items-center gap-1.5">
                        <Crown className="w-2.5 h-2.5" /> {group.hostName}
                    </p>
                </div>



                {/* Org role breakdown */}
                {isOrg && roles && (roles.admins > 0 || roles.members > 0) && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[9px] font-black text-zinc-300/60 uppercase tracking-wider">
                            <Shield className="w-2.5 h-2.5" />
                            {roles.hosts + roles.admins} officers
                        </div>
                        <div className="w-1 h-1 rounded-full bg-zinc-800" />
                        <div className="flex items-center gap-1 text-[9px] font-black text-zinc-600 uppercase tracking-wider">
                            <User className="w-2.5 h-2.5" />
                            {roles.members} members
                        </div>
                    </div>
                )}

                {/* Goal progress */}
                {group.settings?.goalHours && group.settings.goalHours > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-zinc-600">
                            <span>Goal Progress</span>
                            <span className="text-[white]">{Math.round((totalMinutes / 60) / group.settings.goalHours * 100)}% Complete</span>
                        </div>
                        <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (totalMinutes / 60) / group.settings.goalHours * 100)}%` }}
                                className="h-full bg-gradient-to-r from-[white] to-zinc-400" 
                            />
                        </div>
                    </div>
                )}

                {/* Bottom row: member avatars + CTA */}
                <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/10">
                    <div className="flex items-center gap-2.5">
                        <div className="flex -space-x-1.5">
                            {group.memberDetails?.filter((m: any) => m.isFocusing).slice(0, 5).map((m: any, i: number) => (
                                <div key={i} className="relative group/avatar z-10">
                                    <Avatar className="w-7 h-7 rounded-full border-2 border-zinc-950 bg-zinc-900 transition-all duration-300 ring-1 ring-cyan-500 ring-offset-1 ring-offset-zinc-950 z-10 scale-105">
                                        <AvatarImage src={m.photoURL} className="object-cover w-full h-full rounded-full" />
                                        <AvatarFallback className="text-[8px] bg-zinc-800 text-white rounded-full flex items-center justify-center">{m.displayName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-500 border border-zinc-950 shadow-[0_0_6px_rgba(6,182,212,0.6)] z-20" />
                                </div>
                            ))}
                            {activeFocuserCount > 5 && (
                                <div className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[8px] font-black text-zinc-400">
                                    +{activeFocuserCount - 5}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-bold tracking-wide">
                            {activeFocuserCount > 0 ? (
                                <span className="text-cyan-400/80">{activeFocuserCount} {activeFocuserCount === 1 ? "active" : "active"}</span>
                            ) : (
                                <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                            )}
                        </span>
                    </div>

                    <div className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 px-3 py-1.5 rounded-lg",
                        isActive
                            ? "bg-[white]/15 text-[white] group-hover:bg-[white]/25"
                            : isMember
                            ? "bg-zinc-800/70 text-zinc-400 group-hover:bg-zinc-800 group-hover:text-[white]"
                            : "bg-white/5 text-zinc-600 group-hover:bg-white/10 group-hover:text-white"
                    )}>
                        {isMember ? "Open" : "Join"}
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}, (prev, next) => {
    return prev.group.id === next.group.id &&
           prev.group.totalMinutes === next.group.totalMinutes &&
           prev.group.settings?.goalHours === next.group.settings?.goalHours &&
           prev.group.members?.length === next.group.members?.length &&
           (prev.group.memberDetails?.filter((m: any) => m.isFocusing).length || 0) === (next.group.memberDetails?.filter((m: any) => m.isFocusing).length || 0);
});
EnhancedGroupCard.displayName = "EnhancedGroupCard";

function LiveElapsedTimer({ startTime, isActive }: { startTime: any, isActive: boolean }) {
    const elapsed = useSprintElapsed(startTime, isActive);
    return <>{elapsed > 0 ? fmtElapsed(elapsed) : "Starting…"}</>;
}

// ─── Sprint Elapsed Timer Hook ────────────────────────────────────────────────
function useSprintElapsed(startTime: any, isActive: boolean) {
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!isActive || !startTime) {
            setElapsed(0);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        const getMs = (ts: any): number => {
            if (!ts) return Date.now();
            if (typeof ts.toMillis === "function") return ts.toMillis();
            if (typeof ts === "number") return ts;
            if (ts instanceof Date) return ts.getTime();
            if (ts.seconds) return ts.seconds * 1000;
            return Date.now();
        };

        const startMs = getMs(startTime);
        const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
        tick();
        intervalRef.current = setInterval(tick, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isActive, startTime]);

    return elapsed;
}

function fmtElapsed(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2,"0")}m ${s.toString().padStart(2,"0")}s`;
    if (m > 0) return `${m}m ${s.toString().padStart(2,"0")}s`;
    return `${s}s`;
}

function getManagementGroupKey(group: any): string {
    if (!group) return "";
    const members = (group.memberDetails || [])
        .map((m: any) => `${m.uid}:${m.role}:${m.totalMinutes || 0}:${m.displayName || ""}:${m.photoURL || ""}`)
        .join("|");
    const settings = `${group.settings?.goalHours || 0}:${group.settings?.maxMembers || 0}`;
    return `${group.id}|${group.hostId}|${group.privacy}|${group.accessCode || ""}|${settings}|${members}`;
}

// ─── Group Detail Modal ───────────────────────────────────────────────────────
const GroupDetailModal = function GroupDetailModal({ groupId, onClose, user, groups, friends, activeTab, setActiveTab, onJoin, onLeave }: any) {
    const group = groups.find((g: any) => g.id === groupId);
    
    const [tasks, setTasks] = useState<SharedTask[]>([]);
    const [viewMode, setViewMode] = useState<"shared" | "personal">("shared");
    const [isManagingRoles, setIsManagingRoles] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [sessionActionPending, setSessionActionPending] = useState<"start" | "pause" | "stop" | null>(null);
    const [optimisticFocusing, setOptimisticFocusing] = useState<boolean | null>(null);
    const [roleActionPendingId, setRoleActionPendingId] = useState<string | null>(null);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [objectiveTemplateDraft, setObjectiveTemplateDraft] = useState<ObjectiveTemplateDraft | null>(null);

    const isMember = group?.members.includes(user.uid);
    const memberStats = group?.memberStats?.[user.uid];
    const isUserFocusing = !!group?.memberDetails?.some((m: any) => m.uid === user.uid && m.isFocusing);
    const effectiveIsFocusing = optimisticFocusing ?? isUserFocusing;
    const isHost = group?.hostId === user.uid;
    const userRole = memberStats?.role || (isHost ? "host" : "member");
    const isAdmin = isHost || userRole === "admin";
    const isOrg = group?.type === "organization";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const timerStart = useTimerStore(s => s.start);
    const timerPause = useTimerStore(s => s.pause);
    const timerStop = useTimerStore(s => s.stop);
    const timerIsActive = useTimerStore(s => s.isActive);
    const setActiveGroupId = useTimerStore(s => s.setActiveGroupId);

    const activeFocuserCount = useMemo(() => {
        return (group?.memberDetails?.filter((m: any) => m.isFocusing).length) || 0;
    }, [group?.memberDetails]);
    const isActive = activeFocuserCount > 0;
    const activeStartTime = getEarliestActiveStart(group?.memberDetails) ?? group?.startTime;

    useEffect(() => {
        if (!isMember || !groupId) return;
        const q = query(collection(db, `focusGroups/${groupId}/tasks`), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snap) => {
            setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedTask)));
        });
    }, [groupId, isMember]);

    const sortedMembers = useMemo(() => {
        if (!group) return [];
        return [...(group.memberDetails || [])].sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));
    }, [group]);

    useEffect(() => {
        setIsHeaderMenuOpen(false);
    }, [group?.id, isManagingRoles]);

    if (!group) return null;

    const handleAddTask = async (title: string, priority: string = "medium", assignedTo: string = "all", silent: boolean = false, description: string = "") => {
        if (!isAdmin) {
            toast.error("Only hosts and admins can add shared objectives.");
            return;
        }
        await addDoc(collection(db, `focusGroups/${groupId}/tasks`), {
            title, priority, assignedTo, description, status: "todo",
            createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        if (assignedTo !== "all" && assignedTo !== user.uid) {
            await addDoc(collection(db, "notifications"), {
                type: "objective_assignment",
                toUserId: assignedTo,
                fromUserId: user.uid,
                groupId: group.id,
                groupName: group.name,
                taskTitle: title,
                read: false,
                createdAt: serverTimestamp(),
            });
        }
        if (!silent) toast.success("Objective added.");
    };

    const handleUpdateTask = async (taskId: string, updates: any) => {
        await updateDoc(doc(db, `focusGroups/${groupId}/tasks`, taskId), { ...updates, updatedAt: serverTimestamp() });
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!isAdmin) {
            toast.error("Only hosts and admins can delete shared objectives.");
            return;
        }
        await deleteDoc(doc(db, `focusGroups/${groupId}/tasks`, taskId));
        toast.success("Objective deleted.");
    };

    const handleSessionAction = async (action: "start" | "pause" | "stop") => {
        if (!isMember) return;
        if (sessionActionPending) return;

        setSessionActionPending(action);
        if (action === "start") setOptimisticFocusing(true);
        if (action === "pause" || action === "stop") setOptimisticFocusing(false);
        try {
            const result = await applyGroupSessionAction({
                group,
                userId: user.uid,
                action
            });

            setActiveGroupId(result.shouldSetActiveGroupId);

            if (result.shouldStartTimer && !timerIsActive) timerStart();
            if (result.shouldPauseTimer) timerPause();
            if (result.shouldStopTimer) {
                const timerSnapshot = useTimerStore.getState();
                if (timerSnapshot.mode === "focus" && timerSnapshot.timeLeft > 0) {
                    const elapsedSeconds = Math.max(0, timerSnapshot.initialFocusTime - timerSnapshot.timeLeft);
                    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
                    if (elapsedMinutes >= 1) {
                        await savePartialPomodoroSession(user.uid, elapsedMinutes, group.id);
                    }
                }
                timerStop();
            }

            if (action === "pause") {
                toast.info("Focus paused.");
            } else if (action === "stop") {
                toast.info("Focus stopped.");
            }
        } catch (error) {
            console.error("Failed to update group focus session:", error);
            setOptimisticFocusing(null);
            toast.error("Could not update session. Please try again.");
        } finally {
            setSessionActionPending(null);
        }
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: "admin" | "member") => {
        if (userRole !== "host") { toast.error("Only the host can modify officer roles."); return; }
        setRoleActionPendingId(memberId);
        try {
            await updateDoc(doc(db, "focusGroups", groupId), {
                [`memberStats.${memberId}.role`]: newRole
            });
            toast.success(`Updated role to ${newRole}`);
        } finally {
            setRoleActionPendingId(null);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!isAdmin) return;
        if (memberId === group.hostId) return;
        setRoleActionPendingId(memberId);
        try {
            const newMembers = group.members.filter((m: string) => m !== memberId);
            const updateStats: any = { ...group.memberStats };
            delete updateStats[memberId];
            await updateDoc(doc(db, "focusGroups", groupId), { members: newMembers, memberStats: updateStats });
            toast.info("Member extracted from unit.");
        } finally {
            setRoleActionPendingId(null);
        }
    };


    const totalGroupMinutes = group.totalMinutes || sortedMembers.reduce((acc: number, m: any) => acc + (m.totalMinutes || 0), 0);
    const adminCount = sortedMembers.filter((m: any) => m.role === "host" || m.role === "admin").length;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/92 backdrop-blur-2xl" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="relative w-full max-w-5xl bg-zinc-900/60 border border-white/10 rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col h-[85vh] backdrop-blur-sm"
            >
                
                {/* Top accent bar */}
                <div className={cn(
                    "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent to-transparent",
                    isOrg ? "via-[white]/70" : "via-indigo-400/40"
                )} />

                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-br from-[white]/5 to-transparent">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <button onClick={() => setIsManagingRoles(false)} className={cn("transition-all", isManagingRoles ? "opacity-100 w-auto mr-2" : "opacity-0 w-0 overflow-hidden")}>
                                    <ChevronRight className="w-5 h-5 rotate-180 text-zinc-500 hover:text-white" />
                                </button>
                                <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                                    {isManagingRoles ? "Unit Management" : group.name}
                                    {!isManagingRoles && isActive && (
                                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest leading-none mt-[1px]">Live</span>
                                        </div>
                                    )}
                                </h2>
                                {!isManagingRoles && (
                                    <span className={cn(
                                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                        isOrg 
                                            ? "bg-[white]/10 text-[white] border-[white]/20" 
                                            : "bg-blue-500/10 text-blue-400 border-blue-400/20"
                                    )}>
                                        {isOrg ? <Briefcase className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                        {group.type}
                                    </span>
                                )}
                                {/* Access code display for host */}
                                {group.privacy === "private-code" && group.hostId === user.uid && (
                                    <div className="flex items-center gap-2 ml-2 p-1.5 bg-zinc-950/60 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Code:</span>
                                        <code className="text-sm font-black text-[white] bg-[white]/5 px-2 py-0.5 rounded-lg border border-[white]/20">{group.accessCode}</code>
                                        <button onClick={() => { navigator.clipboard.writeText(group.accessCode || ""); toast.success("Code copied"); }} className="p-1 px-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="text-zinc-500 text-sm max-w-xl line-clamp-1">{isManagingRoles ? `Configure authorization and hierarchy for ${group.name}` : group.description}</p>
                                {!isManagingRoles && isActive && (
                                    <>
                                        <div className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <p className="text-xs text-emerald-400/80 font-bold">{activeFocuserCount} focusing</p>
                                        <div className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <p className="text-xs text-zinc-300 font-terminal tracking-tight bg-white/5 px-2 py-0.5 rounded-md border border-white/10"><LiveElapsedTimer startTime={activeStartTime} isActive={isActive} /></p>
                                    </>
                                )}
                            </div>
                        </div>
                            <div className="flex items-center gap-3">
                                {isMember ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            {!effectiveIsFocusing ? (
                                                <button
                                                    disabled={!!sessionActionPending}
                                                    onClick={() => handleSessionAction("start")}
                                                    className={cn(
                                                        "px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2",
                                                        sessionActionPending ? "bg-[white]/60 text-black cursor-not-allowed" : "bg-[white] text-black hover:shadow-[0_0_20px_white44]"
                                                    )}
                                                >
                                                    <Play className="w-4 h-4" />
                                                    {sessionActionPending === "start" ? "Starting..." : "Start Focus"}
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        disabled={!!sessionActionPending}
                                                        onClick={() => handleSessionAction("pause")}
                                                        className={cn(
                                                            "px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 border",
                                                            sessionActionPending ? "bg-indigo-500/40 text-white border-indigo-500/20 cursor-not-allowed" : "bg-indigo-500 text-white border-indigo-400/40 hover:bg-indigo-400"
                                                        )}
                                                    >
                                                        <Pause className="w-4 h-4" />
                                                        {sessionActionPending === "pause" ? "Pausing..." : "Pause"}
                                                    </button>
                                                    <button
                                                        disabled={!!sessionActionPending}
                                                        onClick={() => handleSessionAction("stop")}
                                                        className={cn(
                                                            "px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 border",
                                                            sessionActionPending ? "bg-red-500/30 text-red-100 border-red-500/20 cursor-not-allowed" : "bg-red-500/10 text-red-300 border-red-500/40 hover:bg-red-500/20"
                                                        )}
                                                    >
                                                        <StopCircle className="w-4 h-4" />
                                                        {sessionActionPending === "stop" ? "Stopping..." : "Stop"}
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                                                title="More actions"
                                                className="h-10 w-10 rounded-xl bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 transition-all inline-flex items-center justify-center"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            {isHeaderMenuOpen && (
                                                <div className="absolute right-0 top-full mt-2 min-w-[170px] rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl z-20 p-1.5 space-y-1">
                                                    {isAdmin && (group.privacy === "private-invite" || group.privacy === "public") && (
                                                        <button
                                                            onClick={() => {
                                                                setShowInviteModal(true);
                                                                setIsHeaderMenuOpen(false);
                                                            }}
                                                            className="w-full px-3 py-2 rounded-lg text-left text-[11px] font-bold text-violet-300 hover:bg-violet-500/10 inline-flex items-center gap-2"
                                                        >
                                                            <UserPlus className="w-3.5 h-3.5" />
                                                            Invite members
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            onLeave(group.id);
                                                            setIsHeaderMenuOpen(false);
                                                        }}
                                                        className="w-full px-3 py-2 rounded-lg text-left text-[11px] font-bold text-red-300 hover:bg-red-500/10 inline-flex items-center gap-2"
                                                    >
                                                        <LogOut className="w-3.5 h-3.5" />
                                                        Leave group
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                    </>
                                ) : (
                                    <button onClick={() => onJoin(group.id)} className="px-6 py-3 bg-[white] text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all">Request Access</button>
                                )}
                                <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X className="w-4 h-4" /></button>
                            </div>
                    </div>


                    {!isManagingRoles && isMember && (
                        <div className="mt-8 flex items-center justify-between">
                            <div className="flex gap-1 p-1 bg-zinc-950/40 rounded-xl w-fit border border-white/5">
                                {[
                                    { id: "workspace", icon: LayoutGrid, label: "Overview" },
                                    { id: "members",   icon: Users, label: "Participants" }
                                ].map(t => (
                                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all", activeTab === t.id ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300")}>
                                        <t.icon className="w-4 h-4" />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {/* Desktop quick member scroll */}
                            <div className="hidden lg:flex items-center gap-4">
                                <div className="h-4 w-[1px] bg-white/10 mr-2" />
                                <div className="flex -space-x-2">
                                    {group.memberDetails?.filter((m: any) => m.isFocusing).slice(0, 8).map((m: any, i: number) => (
                                        <div key={i} className="relative group/avatar">
                                            <Avatar className={cn(
                                                "w-9 h-9 rounded-full border-2 border-zinc-950 transition-all duration-300 bg-zinc-900 z-10 scale-105",
                                                "ring-2 ring-cyan-500 ring-offset-2 ring-offset-zinc-950 hover:scale-110"
                                            )}>
                                                <AvatarImage src={m.photoURL} className="object-cover w-full h-full rounded-full" />
                                                <AvatarFallback className="text-[10px] bg-zinc-800 text-white rounded-full flex items-center justify-center">{m.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-cyan-500 border-2 border-zinc-950 shadow-[0_0_8px_rgba(6,182,212,0.6)] z-20" />
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-zinc-800/90 backdrop-blur-sm border border-white/10 text-[9px] font-bold text-white rounded-lg opacity-0 group-hover/avatar:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                                {m.displayName} <span className="text-cyan-400 ml-1">• Focusing</span>
                                            </div>
                                        </div>
                                    ))}
                                    {group.memberDetails && group.memberDetails.filter((m: any) => m.isFocusing).length > 8 && (
                                        <div className="w-9 h-9 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[10px] font-black text-zinc-400 z-0">
                                            +{group.memberDetails.filter((m: any) => m.isFocusing).length - 8}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-zinc-950/20">
                    {isManagingRoles ? (
                        <GroupManagementView 
                            group={group} user={user} userRole={userRole}
                            onUpdateRole={handleUpdateMemberRole} onRemove={handleRemoveMember}
                            roleActionPendingId={roleActionPendingId}
                        />
                    ) : isMember ? (
                        activeTab === "workspace" ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                {/* Left/Main Column */}
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
                                                <Target className="w-4 h-4" /> Focus Objectives
                                            </h3>
                                            <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                                                <button onClick={() => setViewMode("shared")} className={cn("px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all", viewMode === "shared" ? "bg-white/10 text-white shadow-md" : "text-zinc-500")}>Shared</button>
                                                <button onClick={() => setViewMode("personal")} className={cn("px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all", viewMode === "personal" ? "bg-white/10 text-white shadow-md" : "text-zinc-500")}>Personal</button>
                                            </div>
                                        </div>

                                        {viewMode === "shared" ? (
                                            <SharedTasksPanel
                                                tasks={tasks}
                                                onAdd={handleAddTask}
                                                onUpdate={handleUpdateTask}
                                                onDelete={handleDeleteTask}
                                                isAdmin={isAdmin}
                                                groupMembers={group.memberDetails}
                                                currentUserId={user.uid}
                                                prefillTemplate={objectiveTemplateDraft}
                                                onPrefillHandled={() => setObjectiveTemplateDraft(null)}
                                                onTemplateSelect={(templateId: "deep-work" | "review-respond" | "learning-sprint") => {
                                                    if (!isAdmin) return;
                                                    const dateLabel = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
                                                    if (templateId === "deep-work") {
                                                        setObjectiveTemplateDraft({
                                                            title: `Deep work block - ${dateLabel}`,
                                                            priority: "high",
                                                            description: "Define one clear output and stay focused for one uninterrupted block.",
                                                        });
                                                    } else if (templateId === "review-respond") {
                                                        setObjectiveTemplateDraft({
                                                            title: `Review and respond - ${dateLabel}`,
                                                            priority: "medium",
                                                            description: "Process inbox/queue items and close urgent follow-ups.",
                                                        });
                                                    } else {
                                                        setObjectiveTemplateDraft({
                                                            title: `Learning sprint - ${dateLabel}`,
                                                            priority: "medium",
                                                            description: "Learn one concept and produce a concrete takeaway.",
                                                        });
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                                                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600"><User className="w-8 h-8" /></div>
                                                <p className="text-sm text-zinc-500 font-medium">Personal tasks are synced from your <Link href="/tasks" className="text-[white] hover:underline">Task Dashboard</Link>.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sidebar Column */}
                                <div className="space-y-4">
                                    <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.18em]">Weekly Goal</p>
                                            <Target className="w-3.5 h-3.5 text-[white]/70" />
                                        </div>
                                        {group.settings?.goalHours && group.settings.goalHours > 0 ? (
                                            <>
                                                <p className="text-sm font-black text-white tabular-nums">
                                                    {Math.round((totalGroupMinutes / 60) * 10) / 10}h / {group.settings.goalHours}h
                                                </p>
                                                <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[white] to-zinc-400 transition-all duration-500"
                                                        style={{ width: `${Math.min(100, ((totalGroupMinutes / 60) / group.settings.goalHours) * 100)}%` }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-[11px] text-zinc-500">No weekly goal set yet.</p>
                                        )}
                                    </div>

                                    {isOrg && (
                                        <div className="p-5 bg-zinc-950/60 border border-[white]/15 rounded-2xl space-y-3 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-[white]/5 blur-3xl" />
                                            <p className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em]">Org Overview</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-3 bg-zinc-900/60 rounded-xl">
                                                    <p className="text-lg font-black text-white">{fmtMinutes(totalGroupMinutes)}</p>
                                                    <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Collective Focus</p>
                                                </div>
                                                <div className="p-3 bg-zinc-900/60 rounded-xl">
                                                    <p className="text-lg font-black text-white">{tasks.filter(t => t.status === "done").length}/{tasks.length}</p>
                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">Objectives Done</p>
                                                </div>
                                                <div className="p-3 bg-zinc-900/60 rounded-xl">
                                                    <p className="text-lg font-black text-zinc-300">{adminCount}</p>
                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">Officers</p>
                                                </div>
                                                <div className="p-3 bg-zinc-900/60 rounded-xl">
                                                    <p className="text-lg font-black text-white">{group.members.length}</p>
                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">Total Members</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-zinc-950/40 border border-white/10 rounded-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.18em]">Members</p>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25">
                                                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{activeFocuserCount} Live</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4">
                                            {sortedMembers.slice(0, 5).map((m: any) => {
                                                const goalHours = group.settings?.goalHours || 0;
                                                const goalPct = goalHours > 0 ? Math.round((((m.totalMinutes || 0) / 60) / goalHours) * 100) : null;
                                                const isMe = m.uid === user.uid;
                                                const isFocusing = m.isFocusing;
                                                return (
                                                    <div key={m.uid} className={cn("rounded-lg p-2.5 border border-white/10 bg-zinc-950/40", isMe && "bg-[white]/8 border-[white]/20")}>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="w-6 h-6 border border-white/10">
                                                                <AvatarImage src={m.photoURL} />
                                                                <AvatarFallback className="text-[8px] bg-zinc-900">{m.displayName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={cn("text-xs font-bold truncate", isMe ? "text-white" : "text-zinc-400")}>{isMe ? "You" : m.displayName}</p>
                                                                <p className="text-[10px] text-zinc-600 font-bold tabular-nums">{fmtMinutes(m.totalMinutes || 0)}</p>
                                                                {isFocusing && (
                                                                    <p className="text-[10px] text-indigo-300/80 font-bold">Session: <LiveElapsedTimer startTime={m.liveSessionStartedAt} isActive={isFocusing} /></p>
                                                                )}
                                                                {goalPct !== null && (
                                                                    <p className="text-[9px] text-[white]/85 font-bold tabular-nums">{goalPct}% of weekly goal</p>
                                                                )}
                                                            </div>
                                                            {isFocusing && <span className="text-[9px] font-black text-indigo-400 uppercase">Live</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <Link href={`/leaderboard?tab=groups&groupId=${groupId}`} className="flex items-center justify-between w-full p-3 bg-zinc-950/40 rounded-lg border border-white/10 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all">
                                            <span>Full Ranking</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>

                                    <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-2xl flex items-center gap-4">
                                        <div className="p-2.5 bg-zinc-800 rounded-xl">
                                            {userRole === "host" ? <Crown className="w-5 h-5 text-[white]" /> : userRole === "admin" ? <Zap className="w-5 h-5 text-zinc-300" /> : <User className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white capitalize">{userRole} Status</p>
                                            <p className="text-[9px] text-zinc-500 font-medium">{userRole === "host" ? "Full access & deletion" : userRole === "admin" ? "Can manage objectives" : "Visual collaborator"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === "members" ? (
                            <ParticipantsTab 
                                group={group} 
                                sortedMembers={sortedMembers} 
                                user={user} 
                                isAdmin={isAdmin}
                                onManageRoles={() => setIsManagingRoles(true)}
                                onInvite={() => setShowInviteModal(true)}
                                goalHours={group.settings?.goalHours || 0}
                            />
                        ) : null
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center gap-8">
                            <div className="w-24 h-24 rounded-full bg-[white]/5 flex items-center justify-center border border-[white]/10 relative">
                                <Lock className="w-10 h-10 text-[white]" />
                                <div className="absolute inset-0 rounded-full border border-[white]/20 animate-ping" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white">Unlock High-Intensity Session</h3>
                                <p className="text-zinc-600 max-w-md">Join this {group.type} to see active objectives, real-time presence, and collective progress.</p>
                            </div>
                            <button onClick={() => onJoin(group.id)} className="px-10 py-5 bg-[white] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_white44]">Establish Connection</button>
                        </div>
                    )}
                </div>
            </motion.div>

            <AnimatePresence>
                {showInviteModal && (
                    <InviteModal
                        key="group-detail"
                        group={group} user={user} friends={friends}
                        onClose={() => setShowInviteModal(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Custom comparison function for GroupDetailModal to prevent deep re-renders on heartbeat
const areGroupModalPropsEqual = (prev: any, next: any) => {
    if (prev.groupId !== next.groupId) return false;
    if (prev.activeTab !== next.activeTab) return false;
    
    // We only care if our specific group data changed in a meaningful way
    const prevGroup = prev.groups?.find((g: any) => g.id === prev.groupId);
    const nextGroup = next.groups?.find((g: any) => g.id === next.groupId);
    
    if (!prevGroup || !nextGroup) return prevGroup === nextGroup;
    
    // Check if member count, total minutes, or host changed
    if (prevGroup.members?.length !== nextGroup.members?.length) return false;
    if (prevGroup.totalMinutes !== nextGroup.totalMinutes) return false;
    if (prevGroup.hostId !== nextGroup.hostId) return false;
    if (prevGroup.settings?.goalHours !== nextGroup.settings?.goalHours) return false;
    if (prevGroup.settings?.maxMembers !== nextGroup.settings?.maxMembers) return false;
    
    // Check if any member's role changed
    for (const memberId of prevGroup.members) {
        if (prevGroup.memberStats?.[memberId]?.role !== nextGroup.memberStats?.[memberId]?.role) {
            return false;
        }
    }
    
    // Check if focusing status of any member changed (to catch heartbeat/start/stop)
    const prevActiveIds = (prevGroup.memberDetails || []).filter((m: any) => m.isFocusing).map((m: any) => m.uid).join(',');
    const nextActiveIds = (nextGroup.memberDetails || []).filter((m: any) => m.isFocusing).map((m: any) => m.uid).join(',');
    if (prevActiveIds !== nextActiveIds) return false;

    return true;
};

// Re-wrap GroupDetailModal
const MemoizedGroupDetailModal = memo(GroupDetailModal);

// ─── Participants Tab ─────────────────────────────────────────────────────────
const ParticipantsTab = memo(function ParticipantsTab({ group, sortedMembers, user, isAdmin, onManageRoles, onInvite, goalHours = 0 }: any) {
    const [memberNowMs, setMemberNowMs] = useState(Date.now());

    useEffect(() => {
        const hasLiveMembers = sortedMembers.some((m: any) => m.isFocusing);
        if (!hasLiveMembers) return;
        const t = setInterval(() => setMemberNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, [sortedMembers]);

    const liveMembers = sortedMembers.filter((m: any) => m.isFocusing);
    const offlineMembers = sortedMembers.filter((m: any) => !m.isFocusing);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Top area with stats and actions */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/5">
                <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tighter">Participants</h3>
                        <p className="text-zinc-500 text-xs mt-0.5 font-bold">Manage and view unit members.</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {goalHours > 0 && (
                        <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-3 min-w-[120px]">
                            <Target className="w-4 h-4 text-cyan-500/70" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Weekly Goal</span>
                                <span className="text-sm font-black text-white leading-none">{goalHours}h</span>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button onClick={onManageRoles} className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white">
                                Settings
                            </button>
                        )}
                        {isAdmin && (group.privacy === "private-invite" || group.privacy === "public") && (
                            <button onClick={onInvite} className="px-5 py-2.5 rounded-xl border border-transparent bg-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                                <Mail className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {liveMembers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {liveMembers.map((m: any, i: number) => (
                        <motion.div 
                            key={m.uid}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                        >
                            <UserCard m={m} isMe={m.uid === user.uid} memberNowMs={memberNowMs} />
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600"><Users className="w-8 h-8" /></div>
                    <p className="text-sm text-zinc-500 font-medium">No one is currently focusing in this unit.</p>
                </div>
            )}
        </div>
    );
});

const UserCard = memo(function UserCard({ m, isMe, memberNowMs }: any) {
    const elapsedText = useMemo(() => {
        if (!m.isFocusing || !m.liveSessionStartedAt) return null;
        let startedMs = 0;
        const ts = m.liveSessionStartedAt;
        if (typeof ts === "number") startedMs = ts;
        else if (ts instanceof Date) startedMs = ts.getTime();
        else if (ts.seconds) startedMs = ts.seconds * 1000;
        else return null;
        return fmtElapsed(Math.max(0, Math.floor((memberNowMs - startedMs) / 1000)));
    }, [m.isFocusing, m.liveSessionStartedAt, memberNowMs]);

    const isLive = m.isFocusing;
    return (
        <div className={cn(
            "relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-300 group rounded-[1.5rem]",
            isLive ? "bg-white/[0.03] border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.15)] min-h-[180px]" : "bg-zinc-950/60 border border-white/5 opacity-70 hover:opacity-100 min-h-[160px]"
        )}>
            {isLive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <span className="text-[8px] font-black uppercase text-cyan-400 tracking-widest leading-none">Live</span>
                </div>
            )}

            <div className="flex flex-col items-center z-10 w-full px-4 mt-4">
                <Avatar className={cn(
                    "w-12 h-12 border-2 mb-2 transition-all duration-500",
                    isLive ? "border-cyan-500 shadow-lg shadow-cyan-500/20" : "border-zinc-800"
                )}>
                    <AvatarImage src={m.photoURL} />
                    <AvatarFallback className="text-lg bg-zinc-800">{m.displayName?.[0]}</AvatarFallback>
                </Avatar>
                
                <h4 className="text-sm font-bold text-white mb-0.5 truncate w-full">{isMe ? "You" : m.displayName}</h4>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    {m.role}
                </p>
            </div>
            
            <div className="mt-auto w-full p-3 border-t border-white/5 bg-black/20">
                {isLive ? (
                    <>
                        <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Session Timer</p>
                        <p className="text-base font-black text-white tabular-nums tracking-tight">{elapsedText || "0s"}</p>
                    </>
                ) : (
                    <>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Total Time</p>
                        <p className="text-xs font-bold text-zinc-400 tabular-nums">{fmtMinutes(m.totalMinutes || 0)}</p>
                    </>
                )}
            </div>
        </div>
    );
});

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ group, user, friends, onClose }: any) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [copied, setCopied] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    
    const inviteLink = group.inviteToken ? buildInviteLink(group.inviteToken) : null;
    
    const nonMemberFriends = friends.filter((f: any) => f.userData && !group.members.includes(f.friendId));
    const filtered = searchTerm 
        ? nonMemberFriends.filter((f: any) => (f.userData?.displayName || "").toLowerCase().includes(searchTerm.toLowerCase()))
        : nonMemberFriends;

    const toggleFriend = (uid: string) => {
        setSelectedFriends(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };

    const handleCopyLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Invite link copied!");
    };

    const handleRegenerateToken = async () => {
        const newToken = generateInviteToken();
        await updateDoc(doc(db, "focusGroups", group.id), { inviteToken: newToken });
        toast.success("New invite link generated");
    };

    const handleSendInvites = async () => {
        if (!selectedFriends.length) return;
        setSending(true);
        try {
            await updateDoc(doc(db, "focusGroups", group.id), {
                pendingInvites: arrayUnion(...selectedFriends)
            });
            toast.success(`Invited ${selectedFriends.length} friend${selectedFriends.length > 1 ? "s" : ""}!`);
            setSelectedFriends([]);
        } catch (e) {
            toast.error("Failed to send invites");
        }
        setSending(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={cn("relative w-full max-w-lg border border-white/10 rounded-3xl shadow-2xl overflow-hidden", settingsGlassmorphism ? "bg-zinc-900/80 backdrop-blur-md" : "bg-zinc-900")}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-white">Invite to {group.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Pick friends or share an invite link</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Invite Link section */}
                    {(group.privacy === "private-invite" || group.privacy === "public") && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
                                <Link2 className="w-3.5 h-3.5" /> Invite Link
                            </p>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 flex items-center overflow-hidden">
                                    <span className="text-xs text-zinc-500 truncate font-mono">
                                        {inviteLink ?? "No invite link yet"}
                                    </span>
                                </div>
                                <button onClick={handleCopyLink} disabled={!inviteLink} className={cn("px-4 py-3 rounded-xl border font-black text-xs transition-all flex items-center gap-2", copied ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-white hover:bg-white/10")}>
                                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                            {group.hostId === user.uid && (
                                <button onClick={handleRegenerateToken} className="text-[10px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-wider transition-all flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" /> Regenerate link (invalidates old one)
                                </button>
                            )}
                        </div>
                    )}

                    {/* Friend picker */}
                    {nonMemberFriends.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Invite Friends
                            </p>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search friends..." className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-white/15 transition-all" />
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {filtered.map((f: any) => {
                                    const isSelected = selectedFriends.includes(f.friendId);
                                    const isPending = group.pendingInvites?.includes(f.friendId);
                                    return (
                                        <button key={f.friendId} onClick={() => !isPending && toggleFriend(f.friendId)} disabled={isPending} className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left", isSelected ? "bg-violet-500/15 border-violet-500/30" : isPending ? "bg-zinc-900/60 border-white/5 opacity-60 cursor-default" : "bg-zinc-900/40 border-white/5 hover:border-white/10")}>
                                            <Avatar className="w-9 h-9 border border-white/10">
                                                <AvatarImage src={f.userData?.photoURL} />
                                                <AvatarFallback>{f.userData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{f.userData?.displayName}</p>
                                                {isPending && <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Invite pending</p>}
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-violet-400 shrink-0" />}
                                            {isPending && <Mail className="w-4 h-4 text-violet-400/50 shrink-0" />}
                                        </button>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <p className="text-center py-6 text-xs text-zinc-600 font-bold uppercase tracking-wider">
                                        {searchTerm ? "No matching friends" : "All friends are already members"}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {selectedFriends.length > 0 && (
                    <div className="p-4 border-t border-white/5 flex gap-3">
                        <button onClick={handleSendInvites} disabled={sending} className="flex-1 py-3 bg-violet-500 text-white font-black rounded-xl text-sm hover:bg-violet-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            <Send className="w-4 h-4" />
                            {sending ? "Sending..." : `Invite ${selectedFriends.length} friend${selectedFriends.length > 1 ? "s" : ""}`}
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// ─── Group Management View ────────────────────────────────────────────────────
const GroupManagementView = memo(function GroupManagementView({ group, user, onUpdateRole, onRemove, userRole, roleActionPendingId }: any) {
    const isHost = userRole === "host";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const hostMembers    = group.memberDetails?.filter((m: any) => m.role === "host") ?? [];
    const adminMembers   = group.memberDetails?.filter((m: any) => m.role === "admin") ?? [];
    const regularMembers = group.memberDetails?.filter((m: any) => m.role === "member") ?? [];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-150">
            {isHost && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">Unit Configuration</h3>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Manage core parameters.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Target className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Focus Goal (Hours)</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="number" 
                                    value={group.settings?.goalHours || ""} 
                                    onChange={(e) => updateDoc(doc(db, "focusGroups", group.id), { "settings.goalHours": parseInt(e.target.value) || 0 })}
                                    placeholder="e.g. 100" 
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-[white]/40 outline-none" 
                                />
                                <span className="text-zinc-600 font-bold text-xs uppercase whitespace-nowrap">Hours / Weekly</span>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Users className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Unit Capacity</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="number" 
                                    value={group.settings?.maxMembers || ""} 
                                    onChange={(e) => updateDoc(doc(db, "focusGroups", group.id), { "settings.maxMembers": parseInt(e.target.value) || 0 })}
                                    placeholder="No Limit" 
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-[white]/40 outline-none" 
                                />
                                <span className="text-zinc-600 font-bold text-xs uppercase whitespace-nowrap">Members</span>
                            </div>
                        </div>
                    </div>
                    {(group.privacy === "private-code" || group.privacy === "public") && group.accessCode && (
                        <div className="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Group Code</h4>
                                <p className="text-[10px] text-zinc-600">Share to expand your unit.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <code className="text-xl font-black text-[white] tracking-[0.2em] bg-zinc-950 px-4 py-2 rounded-xl border border-[white]/30">{group.accessCode}</code>
                                <button onClick={() => { navigator.clipboard.writeText(group.accessCode || ""); toast.success("Copied!"); }} className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all">
                                    <Copy className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Unit Hierarchy</h3>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Manage Roles & Access</p>
                </div>
                <Section label="Command Unit" color="text-[white]" members={hostMembers} user={user} group={group} isHost={isHost} roleActionPendingId={roleActionPendingId} onUpdateRole={onUpdateRole} onRemove={onRemove} />
                <Section label="Officers" color="text-zinc-300" members={adminMembers} user={user} group={group} isHost={isHost} roleActionPendingId={roleActionPendingId} onUpdateRole={onUpdateRole} onRemove={onRemove} />
                <Section label="Members" color="text-zinc-500" members={regularMembers} user={user} group={group} isHost={isHost} roleActionPendingId={roleActionPendingId} onUpdateRole={onUpdateRole} onRemove={onRemove} />
            </div>

        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.userRole === nextProps.userRole &&
        prevProps.roleActionPendingId === nextProps.roleActionPendingId &&
        getManagementGroupKey(prevProps.group) === getManagementGroupKey(nextProps.group)
    );
});

const MemberRow = memo(function MemberRow({ m, user, group, isHost, roleActionPendingId, onUpdateRole, onRemove }: any) {
    return (
        <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-2xl flex items-center gap-5 group/item hover:bg-zinc-900/60 transition-all">
            <Avatar className="w-12 h-12 border-2 border-zinc-950">
                <AvatarImage src={m.photoURL} />
                <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{m.displayName}</h4>
                    {m.uid === user.uid && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-white/10 rounded text-zinc-400">You</span>}
                    {m.isFocusing && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-[7px] font-black uppercase text-indigo-400">
                            Live Focus
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1", m.role === "host" ? "text-[white]" : m.role === "admin" ? "text-zinc-300" : "text-zinc-500")}>
                        {m.role === "host" && <Crown className="w-2.5 h-2.5" />}
                        {m.role === "admin" && <Zap className="w-2.5 h-2.5" />}
                        {m.role}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span className="text-[9px] text-zinc-600 font-bold">{fmtMinutes(m.totalMinutes || 0)} contributed</span>
                </div>
            </div>

            {m.uid !== group.hostId && m.uid !== user.uid && (
                <div className="flex items-center gap-2 opacity-100 transition-all">
                    {isHost && (
                        <button 
                            onClick={() => onUpdateRole(m.uid, m.role === "admin" ? "member" : "admin")}
                            disabled={roleActionPendingId === m.uid}
                            className={cn(
                                "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                                m.role === "admin" ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-300/10 text-zinc-300 hover:bg-zinc-300/20"
                            )}
                        >
                            {roleActionPendingId === m.uid ? "Updating..." : m.role === "admin" ? "Demote" : "Promote"}
                        </button>
                    )}
                    <button 
                        onClick={() => { if (confirm(`Remove ${m.displayName}?`)) onRemove(m.uid); }}
                        disabled={roleActionPendingId === m.uid}
                        className="p-2 bg-red-400/10 text-red-400 rounded-xl hover:bg-red-400/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <UserX className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
});

const Section = memo(function Section({ label, color, members, user, group, isHost, roleActionPendingId, onUpdateRole, onRemove }: any) {
    if (!members.length) return null;
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-white/5" />
                <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", color)}>{label}</span>
                <div className="h-px flex-1 bg-white/5" />
            </div>
            {members.map((m: any) => (
                <MemberRow 
                    key={m.uid} 
                    m={m} 
                    user={user} 
                    group={group} 
                    isHost={isHost} 
                    roleActionPendingId={roleActionPendingId} 
                    onUpdateRole={onUpdateRole} 
                    onRemove={onRemove} 
                />
            ))}
        </div>
    );
});

// ─── Join Code Modal ──────────────────────────────────────────────────────────
function JoinCodeModal({ onClose, onJoin }: { onClose: () => void, onJoin: (code: string) => void }) {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setLoading(true);
        await onJoin(code);
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-3xl" onClick={onClose} />
            
            {/* Cyber background effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[white]/5 blur-[120px] rounded-full" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/[0.02]" />
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/[0.02]" />
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                transition={{ type: "spring", stiffness: 400, damping: 32 }} 
                className={cn(
                    "relative w-full max-w-md border border-[white]/20 rounded-[2.5rem] p-10 overflow-hidden", 
                    settingsGlassmorphism ? "bg-zinc-900/40 backdrop-blur-md" : "bg-zinc-900 shadow-[0_32px_100px_rgba(0,0,0,0.8)]"
                )}
            >
                {/* Decorative border elements */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[white]/30 rounded-tl-[2.5rem]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[white]/30 rounded-tr-[2.5rem]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[white]/30 rounded-bl-[2.5rem]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[white]/30 rounded-br-[2.5rem]" />

                <div className="text-center mb-10">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 bg-[white]/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-[white]/20 relative z-10 group">
                            <Key className="w-10 h-10 text-[white] group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 bg-[white]/20 blur-2xl rounded-full"
                        />
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tighter">Portal Entry</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-3">Authorize workspace connection</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="relative group">
                        <input 
                            autoFocus 
                            maxLength={6} 
                            value={code} 
                            onChange={(e) => setCode(e.target.value.toUpperCase())} 
                            placeholder="CODE" 
                            className="w-full bg-zinc-950/80 border-2 border-white/5 rounded-2xl px-6 py-6 text-center text-4xl font-black tracking-[0.4em] text-white outline-none focus:border-[white]/50 transition-all placeholder:text-zinc-800 font-terminal shadow-inner" 
                        />
                        <div className="absolute inset-0 rounded-2xl border border-[white]/0 group-focus-within:border-[white]/20 pointer-events-none transition-all duration-500" />
                    </div>
                    
                    <div className="space-y-4">
                        <button 
                            type="submit" 
                            disabled={loading || code.length < 6} 
                            className="w-full h-16 bg-[white] text-black font-black uppercase tracking-widest text-sm rounded-2xl hover:scale-[1.02] active:scale-98 transition-all shadow-[0_12px_40px_rgba(232,130,26,0.3)] disabled:opacity-50 disabled:scale-100 disabled:shadow-none group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? "Decrypting..." : "Initialize Uplink"}
                                {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                            </span>
                            <motion.div 
                                className="absolute inset-0 bg-white/20 translate-x-[-100%]"
                                whileHover={{ translateX: "100%" }}
                                transition={{ duration: 0.6 }}
                            />
                        </button>
                        
                        <button 
                            type="button"
                            onClick={onClose}
                            className="w-full py-4 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
                        >
                            Abort Mission
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

// ─── Sprint Resonance ─────────────────────────────────────────────────────────
// ─── Shared Tasks Configuration ──────────────────────────────────────────────
const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    "todo":        { label: "Todo",        color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",    icon: Circle },
    "in-progress": { label: "In Progress", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",    icon: Play },
    "in-review":   { label: "In Review",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Search },
    "done":        { label: "Done",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: Check },
};

// ─── Shared Tasks Panel ───────────────────────────────────────────────────────
const SharedTasksPanel = memo(function SharedTasksPanel({ tasks, onAdd, onUpdate, onDelete, isAdmin, groupMembers, currentUserId, prefillTemplate, onPrefillHandled, onTemplateSelect }: any) {
    const [openAdd, setOpenAdd] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [prio, setPrio] = useState<any>("medium");
    const [assign, setAssign] = useState("all");
    const [objectiveFilter, setObjectiveFilter] = useState<"all" | "mine">("all");
    
    // Inline Edit State
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editPrio, setEditPrio] = useState<any>("medium");
    const [editAssign, setEditAssign] = useState("all");

    const startEditing = (task: SharedTask) => {
        setEditingTaskId(task.id);
        setEditTitle(task.title);
        setEditDesc(task.description);
        setEditPrio(task.priority);
        setEditAssign(task.assignedTo || "all");
    };

    const handleSaveEdit = () => {
        if (!editingTaskId || !editTitle.trim()) return;
        onUpdate(editingTaskId, {
            title: editTitle,
            description: editDesc,
            priority: editPrio,
            assignedTo: editAssign
        });
        setEditingTaskId(null);
    };
    const assigneeNameById = useMemo(() => {
        const map: Record<string, string> = {};
        (groupMembers || []).forEach((m: any) => {
            if (m?.uid) map[m.uid] = m.displayName || "Member";
        });
        return map;
    }, [groupMembers]);

    useEffect(() => {
        if (!prefillTemplate) return;
        setTitle(prefillTemplate.title || "");
        setDescription(prefillTemplate.description || "");
        setPrio(prefillTemplate.priority || "medium");
        setAssign("all");
        setOpenAdd(true);
        if (onPrefillHandled) onPrefillHandled();
    }, [prefillTemplate, onPrefillHandled]);

    const handleAdd = () => {
        if (!title.trim()) return;
        onAdd(title, prio, assign, false, description);
        setTitle("");
        setDescription("");
        setOpenAdd(false);
    };

    const visibleTasks = objectiveFilter === "mine"
        ? tasks.filter((task: any) => task.assignedTo === "all" || task.assignedTo === currentUserId)
        : tasks;

    return (
        <div className="space-y-4">
            {isAdmin && !openAdd && (
                <button onClick={() => setOpenAdd(true)} className="w-full p-5 flex items-center gap-3 bg-[white]/5 border border-[white]/10 rounded-2xl group hover:bg-[white]/10 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-[white]/20 flex items-center justify-center text-[white] group-hover:scale-110 transition-all"><Plus className="w-5 h-5" /></div>
                    <span className="text-sm font-bold text-[white]/80">Create New Objective...</span>
                </button>
            )}

            {openAdd && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-zinc-900 border border-[white]/30 rounded-3xl space-y-4">
                    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title..." className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[white]/40 transition-all" />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional context for this objective..."
                        rows={3}
                        className="w-full resize-none bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[white]/40 transition-all"
                    />
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[150px]">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-2">Priority</p>
                            <div className="flex gap-2">
                                {["low", "medium", "high"].map(p => (
                                    <button key={p} onClick={() => setPrio(p)} className={cn("flex-1 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all", prio === p ? "bg-white/10 text-white" : "text-zinc-600 border-white/5")}>{p}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-2">Assignment</p>
                            <select value={assign} onChange={(e) => setAssign(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none">
                                <option value="all">Entire Unit</option>
                                {groupMembers?.map((m: any) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleAdd} className="flex-1 py-3 bg-[white] text-black font-black rounded-xl text-xs">Create Objective</button>
                        <button onClick={() => setOpenAdd(false)} className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl text-xs">Cancel</button>
                    </div>
                </motion.div>
            )}

            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Objectives</p>
                <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                    <button onClick={() => setObjectiveFilter("all")} className={cn("px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all", objectiveFilter === "all" ? "bg-white/10 text-white" : "text-zinc-500")}>All</button>
                    <button onClick={() => setObjectiveFilter("mine")} className={cn("px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all", objectiveFilter === "mine" ? "bg-white/10 text-white" : "text-zinc-500")}>Assigned to me</button>
                </div>
            </div>

            {tasks.length === 0 && !openAdd && (
                <div className="p-8 border-2 border-dashed border-white/5 rounded-3xl space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-xs font-bold text-zinc-500">No active objectives for this unit.</p>
                        <p className="text-[10px] text-zinc-600">Pick a template to prefill the objective form:</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { id: "deep-work", title: "Deep Work Session", icon: Sparkles },
                            { id: "review-respond", title: "Review & Respond", icon: Mail },
                            { id: "learning-sprint", title: "Learning Sprint", icon: Target }
                        ].map((tpl) => (
                            <button
                                key={tpl.id}
                                disabled={!isAdmin}
                                onClick={() => onTemplateSelect?.(tpl.id)}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 bg-zinc-900/60 border border-white/5 rounded-2xl transition-all group",
                                    isAdmin ? "hover:border-[white]/40" : "opacity-55 cursor-not-allowed"
                                )}
                                title={isAdmin ? `Use "${tpl.title}" template` : "Only hosts/admins can create shared objectives"}
                            >
                                <tpl.icon className="w-4 h-4 text-zinc-600 group-hover:text-[white]" />
                                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider text-center">{tpl.title}</span>
                            </button>
                        ))}
                    </div>
                    {!isAdmin && (
                        <p className="text-center text-[10px] text-zinc-600">
                            Shared objective templates are available to hosts and admins.
                        </p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {visibleTasks.map((task: any, i: number) => {
                    const isEditing = editingTaskId === task.id;
                    const canEdit = isAdmin || task.assignedTo === currentUserId;
                    const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
                    const StatusIcon = statusConfig.icon;

                    if (isEditing) {
                        return (
                            <motion.div 
                                key={task.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-5 bg-zinc-900 border border-[white]/30 rounded-2xl space-y-4 shadow-2xl z-10"
                            >
                                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-[white]/40" />
                                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[white]/40 resize-none" />
                                
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex-1 min-w-[120px]">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1.5">Priority</p>
                                        <div className="flex gap-1.5">
                                            {["low", "medium", "high"].map(p => (
                                                <button key={p} onClick={() => setEditPrio(p)} className={cn("flex-1 py-1 rounded-md border text-[9px] font-black uppercase transition-all", editPrio === p ? "bg-white/10 text-white border-white/20" : "text-zinc-600 border-white/5")}>{p}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1.5">Assignment</p>
                                        <select value={editAssign} onChange={(e) => setEditAssign(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-md px-2 py-1 text-[10px] text-zinc-400 outline-none">
                                            <option value="all">Entire Unit</option>
                                            {groupMembers?.map((m: any) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button onClick={handleSaveEdit} className="flex-1 py-2 bg-white text-black font-black rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-2">
                                        <Save className="w-3 h-3" /> Save Changes
                                    </button>
                                    <button onClick={() => setEditingTaskId(null)} className="px-4 py-2 bg-zinc-800 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider">Cancel</button>
                                </div>
                            </motion.div>
                        );
                    }

                    return (
                        <motion.div 
                            key={task.id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                            className={cn(
                                "flex flex-col gap-3 p-5 rounded-2xl transition-all duration-300 border relative group/task", 
                                task.status === "done" 
                                    ? "bg-zinc-900/20 border-white/5 opacity-60" 
                                    : "bg-zinc-900/60 border-white/10 hover:border-white/20 active:scale-[0.99]"
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className={cn(
                                            "text-[13px] font-black tracking-tight transition-all duration-500 truncate", 
                                            task.status === "done" ? "text-zinc-600 line-through" : "text-white group-hover/task:text-[white]"
                                        )}>
                                            {task.title}
                                        </h4>
                                        {isAdmin && (
                                            <button onClick={() => startEditing(task)} className="opacity-0 group-hover/task:opacity-100 p-1 text-zinc-600 hover:text-white transition-all">
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {task.description && (
                                        <p className="text-[11px] text-zinc-500 line-clamp-2">{task.description}</p>
                                    )}
                                </div>

                                {isAdmin && (
                                    <button
                                        onClick={() => onDelete(task.id)}
                                        title="Delete objective"
                                        className="w-7 h-7 rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-500 transition-all flex items-center justify-center opacity-0 group-hover/task:opacity-100"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    {["todo", "in-progress", "in-review", "done"].map((status) => {
                                        const cfg = TASK_STATUS_CONFIG[status];
                                        const isActive = task.status === status;
                                        const Icon = cfg.icon;
                                        
                                        return (
                                            <button
                                                key={status}
                                                disabled={!canEdit}
                                                onClick={() => onUpdate(task.id, { status })}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                                    isActive 
                                                        ? cfg.color 
                                                        : "bg-white/5 border-transparent text-zinc-600 hover:bg-white/10 hover:text-zinc-400 disabled:hover:bg-white/5 disabled:hover:text-zinc-600"
                                                )}
                                                title={canEdit ? `Mark as ${cfg.label}` : "Only assignee or admins can change status"}
                                            >
                                                <Icon className="w-2.5 h-2.5" />
                                                <span className={cn(isActive ? "inline" : "hidden sm:inline")}>{cfg.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                        task.priority === "high" ? "bg-red-500/10 text-red-500 border border-red-500/20" : 
                                        task.priority === "medium" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                                        "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                                    )}>
                                        {task.priority}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                                        <div className="w-1 h-1 rounded-full bg-zinc-800" />
                                        {task.assignedTo === "all" ? "All" : assigneeNameById[task.assignedTo] || "Member"}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                {tasks.length > 0 && visibleTasks.length === 0 && (
                    <div className="py-10 text-center border border-white/10 rounded-2xl bg-zinc-950/30">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.16em]">No objectives match this filter</p>
                    </div>
                )}
            </div>
        </div>
    );
});

// ─── Active Focusers Banner ───────────────────────────────────────────────────
const ActiveFocusersBanner = memo(function ActiveFocusersBanner({ focusers }: { focusers: any[] }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-[1.5rem] border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-zinc-900/60 p-4 flex items-center gap-4 overflow-hidden relative shadow-[0_4px_24px_rgba(249,115,22,0.08)]"
        >
            {/* Shimmer sweep */}
            <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-indigo-400/8 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Live indicator */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-indigo-400" />
                    </div>
                    <motion.div
                        animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                        className="absolute inset-0 rounded-2xl bg-indigo-500/25"
                    />
                </div>
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400 leading-none">{focusers.length} focusing now</p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">across your groups</p>
                </div>
            </div>

            <div className="w-px h-8 bg-white/8 shrink-0" />

            {/* Focuser avatars */}
            <div className="flex items-center gap-0 flex-1 overflow-x-auto no-scrollbar">
                {focusers.map((f) => (
                    <Link
                        key={f.uid}
                        href={`/profile?user=${f.uid}`}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group/focuser shrink-0"
                        title={`${f.displayName} — ${f.groupName}`}
                    >
                        <div className="relative">
                            <Avatar className="w-8 h-8 border-2 border-indigo-500/40 group-hover/focuser:border-indigo-400 transition-all shadow-[0_0_8px_rgba(249,115,22,0.3)]">
                                <AvatarImage src={f.photoURL} />
                                <AvatarFallback className="text-[9px] bg-zinc-800">{f.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <motion.div
                                animate={{ scale: [1, 1.4], opacity: [0.7, 0] }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-indigo-400/60"
                            />
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-indigo-400 border border-zinc-950 shadow-[0_0_6px_#f97316]" />
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-xs font-black text-white group-hover/focuser:text-indigo-300 transition-colors">{f.displayName}</p>
                            <p className="text-[9px] text-zinc-600">{f.groupName}</p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="shrink-0 hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/8 border border-indigo-500/15">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Join them!</span>
            </div>
        </motion.div>
    );
}, (prev, next) => {
    if (prev.focusers.length !== next.focusers.length) return false;
    for (let i = 0; i < prev.focusers.length; i++) {
        if (prev.focusers[i].uid !== next.focusers[i].uid) return false;
        if (prev.focusers[i].groupName !== next.focusers[i].groupName) return false;
    }
    return true;
});
