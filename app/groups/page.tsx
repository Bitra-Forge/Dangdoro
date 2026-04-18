"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import {
    Users, Clock, Trophy, LogOut, Check,
    Hourglass, Plus, Play, StopCircle, UserCheck, Sparkles,
    Timer, Target, Zap, Settings, Lock, Globe, Copy, Key,
    ListTodo, ChevronRight, Trash2, Edit2, Shield, UserX, Pause,
    Briefcase, UserPlus, X, MoreVertical, LayoutGrid, User,
    Link2, Mail, Crown, Star, CheckCircle2, Search, Send,
    Flame, ArrowUpRight, TrendingUp, ExternalLink
} from "lucide-react";
import { Power } from "lucide-react";
import { useTimerStore } from "@/lib/store";
import {
    subscribeToFriendsList
} from "@/lib/friendship";
import { fetchUserProfiles, startLiveSession, endLiveSession } from "@/lib/db";
import { toast } from "sonner";
import { FocusZoneCeremony } from "@/components/FocusZoneCeremony";
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
    status: "todo" | "done";
    priority: "high" | "medium" | "low";
    createdBy: string;
    createdAt: any;
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
    "private-code":   { label: "Code",            icon: Key,    color: "text-amber-400" },
    "private-invite": { label: "Invite Only",     icon: Mail,   color: "text-violet-400" },
};

export default function GroupsPage() {
    const { user, loading: authLoading } = useAuth();
    const [friends, setFriends] = useState<any[]>([]);
    const [focusGroups, setFocusGroups] = useState<FocusGroup[]>([]);
    const [liveSessions, setLiveSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [privacy, setPrivacy] = useState<GroupPrivacy>("private-invite");
    const [groupType, setGroupType] = useState<GroupType>("friends");
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
    const [showSweep, setShowSweep] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const [lastActiveStatuses, setLastActiveStatuses] = useState<Record<string, string>>({});
    const setActiveGroupId = useTimerStore(s => s.setActiveGroupId);

    // sync local activeGroupId is now handled by handleToggleStatus and handleStop
    const [activeModalTab, setActiveModalTab] = useState<"workspace" | "members">("workspace");

    const [hydratedProfiles, setHydratedProfiles] = useState<Record<string, any>>({});
    const [ceremonyData, setCeremonyData] = useState<{ isOpen: boolean; groupName: string } | null>(null);
    const lastActiveCountRef = useRef<Record<string, number>>({});

    // Toast notifications for joined focusers
    useEffect(() => {
        focusGroups.forEach(group => {
            const currentActiveUsers = group.memberDetails?.filter((m: any) => m.isFocusing) || [];
            const previousCount = lastActiveCountRef.current[group.id] || 0;
            
            if (currentActiveUsers.length > previousCount) {
                const newUser = currentActiveUsers[currentActiveUsers.length - 1];
                if (newUser && newUser.uid !== user?.uid) {
                    toast.success(`${newUser.displayName} entered the Forge`, {
                        description: `Operational synergy increasing in ${group.name}`,
                        icon: <Flame className="w-4 h-4 text-orange-500" />
                    });
                }
            }
            lastActiveCountRef.current[group.id] = currentActiveUsers.length;
        });
    }, [focusGroups, user?.uid]);

    const enrichedGroups = useMemo(() => {
        return focusGroups.map(group => {
            const groupLiveSessions = liveSessions.filter(s => s.groupId === group.id);
            const memberDetails: any[] = [];
            for (const memberId of group.members) {
                const friend = friends.find(f => f.friendId === memberId);
                const stats = group.memberStats?.[memberId] || { role: "member", totalMinutes: 0 };
                const hydration = hydratedProfiles[memberId];
                
                // Real-time activity is now derived from liveSessions collection
                const isFocusing = groupLiveSessions.some(ls => ls.userId === memberId);

                const role = stats.role || (group.hostId === memberId ? "host" : "member");

                if (memberId === user?.uid) {
                    const firestoreProfile = hydratedProfiles[memberId];
                    memberDetails.push({
                        uid: user.uid,
                        displayName: firestoreProfile?.displayName || user.displayName,
                        photoURL: firestoreProfile?.photoURL || user.photoURL,
                        ...stats,
                        isFocusing,
                        role,
                        isHost: group.hostId === user.uid
                    });
                } else if (friend?.userData) {
                    memberDetails.push({
                        ...friend.userData,
                        ...stats,
                        isFocusing,
                        role,
                        isHost: group.hostId === memberId
                    });
                } else if (hydration) {
                    memberDetails.push({
                        ...hydration,
                        ...stats,
                        isFocusing,
                        role,
                        isHost: group.hostId === memberId
                    });
                } else {
                    memberDetails.push({
                        uid: memberId,
                        displayName: "Member",
                        ...stats,
                        isFocusing,
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
                setLiveSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        );

        return () => {
            unsubFriends();
            unsubGroups();
            unsubLive();
        };
    }, [user?.uid]);

    const timerIsActive = useTimerStore(s => s.isActive);
    const activeGroupId = useTimerStore(s => s.activeGroupId);
    const setLiveSessionId = useTimerStore(s => s.setLiveSessionId);
    const activeLiveSessionId = useTimerStore(s => s.activeLiveSessionId);

    useEffect(() => {
        if (!user || user.isAnonymous) return;

        const syncLiveSession = async () => {
            if (timerIsActive && activeGroupId && !activeLiveSessionId) {
                // START SESSION
                const sid = await startLiveSession(user.uid, activeGroupId, user.displayName || "Member", user.photoURL || "");
                if (sid) setLiveSessionId(sid);
            } else if (!timerIsActive && activeLiveSessionId) {
                // END SESSION
                await endLiveSession(activeLiveSessionId);
                setLiveSessionId(null);
            } else if (timerIsActive && !activeGroupId && activeLiveSessionId) {
                // DISCONNECTED FROM GROUP
                await endLiveSession(activeLiveSessionId);
                setLiveSessionId(null);
            }
        };

        syncLiveSession();
    }, [timerIsActive, activeGroupId, user, activeLiveSessionId]);

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
                profiles.forEach((p: any) => {
                    newProfiles[p.uid] = p;
                });
                setHydratedProfiles(newProfiles);
            });
        }
    }, [focusGroups, friends, user?.uid]);

    useEffect(() => {
        if (!user) return;
        const currentStatuses: Record<string, string> = {};
        let triggered = false;

        focusGroups.forEach(g => {
            currentStatuses[g.id] = g.status;
            if (g.status === "active" && lastActiveStatuses[g.id] === "idle" && g.members.includes(user.uid)) {
                triggered = true;
            }
        });

        if (triggered) {
            setShowSweep(true);
            setTimeout(() => setShowSweep(false), 2500);
        }
        setLastActiveStatuses(currentStatuses);
    }, [focusGroups, user?.uid]);



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

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#E8821A]/20 border-t-[#E8821A] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <BackgroundTheme />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Workspace Locked" description="Sign in to create focus groups and join organizations." />
            </main>
        </div>
    );

    if (loading) return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    <header className="flex flex-col items-center text-center mb-12 w-full">
                        <span className="text-[10px] font-black tracking-[0.4em] text-zinc-600 uppercase mb-4">Collaborative Forge</span>
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Focus Ecosystem</h1>
                        <p className="text-zinc-500 text-sm max-w-md">Join friends or organize your team for high-intensity deep work sessions.</p>
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
        <BackgroundTheme>
            <div className={cn("relative min-h-screen bg-zinc-950 flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">
                    <header className="flex flex-col items-center text-center mb-12 w-full">
                        <span className="text-[10px] font-black tracking-[0.4em] text-zinc-600 uppercase mb-4">Collaborative Forge</span>
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 transition-all">Focus Ecosystem</h1>
                        <p className="text-zinc-500 text-sm max-w-md">Join friends or organize your team for high-intensity deep work sessions.</p>
                    </header>

                    <div className="w-full max-w-4xl space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <motion.button initial={false} whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} onClick={() => setShowCreateGroup(!showCreateGroup)} className={cn("p-6 rounded-3xl border border-white/10 hover:bg-zinc-800/60 hover:border-[#E8821A]/30 transition-all duration-150 flex items-center gap-6 group", settingsGlassmorphism ? "bg-zinc-900/40" : "bg-zinc-900")}>
                                <div className="w-14 h-14 rounded-2xl bg-[#E8821A]/10 flex items-center justify-center group-hover:bg-[#E8821A]/20 transition-all duration-150">
                                    <Plus className="w-8 h-8 text-[#E8821A]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-white">Initialize New Workspace</h3>
                                    <p className="text-[10px] text-zinc-500">Create a social group or organization.</p>
                                </div>
                            </motion.button>

                            <motion.button initial={false} whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} onClick={() => setShowJoinCodeModal(true)} className={cn("p-6 rounded-3xl border border-white/10 hover:bg-zinc-800/60 hover:border-[#E8821A]/30 transition-all duration-150 flex items-center gap-6 group", settingsGlassmorphism ? "bg-zinc-900/40" : "bg-zinc-900")}>
                                <div className="w-14 h-14 rounded-2xl bg-zinc-950/50 flex items-center justify-center group-hover:bg-zinc-800 transition-all duration-150 border border-white/5">
                                    <Key className="w-6 h-6 text-zinc-500 group-hover:text-[#E8821A]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-white">Join via Entry Code</h3>
                                    <p className="text-[10px] text-zinc-500">Enter a specific workspace code.</p>
                                </div>
                            </motion.button>
                        </div>

                        <AnimatePresence>
                            {showCreateGroup && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                    <CreateGroupForm 
                                        user={user} 
                                        friends={friends}
                                        onClose={() => setShowCreateGroup(false)} 
                                        groupType={groupType} 
                                        setGroupType={setGroupType}
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

                    <div className="space-y-12">
                            {userGroups.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[#E8821A]" />
                                        Your Active Workspaces
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {userGroups.map(group => (
                                            <EnhancedGroupCard key={group.id} group={group} onClick={() => setSelectedGroupId(group.id)} isMember={true} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {publicGroups.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-bold text-zinc-500 mb-6 flex items-center gap-2">
                                        <Globe className="w-5 h-5" />
                                        Explore Public Groups
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {publicGroups.map(group => (
                                            <EnhancedGroupCard key={group.id} group={group} onClick={() => setSelectedGroupId(group.id)} isMember={false} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </main>

                <AnimatePresence>
                    {showSweep && <SprintResonance />}
                </AnimatePresence>

                <AnimatePresence>
                    {selectedGroupId && (
                        <GroupDetailModal
                            groupId={selectedGroupId}
                            onClose={() => setSelectedGroupId(null)}
                            user={user}
                            groups={enrichedGroups}
                            friends={friends}
                            activeTab={activeModalTab}
                            setActiveTab={setActiveModalTab}
                            onJoin={handleJoinGroup}
                            onLeave={handleLeaveGroup}
                            setCeremonyData={setCeremonyData}
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

            <FocusZoneCeremony 
                isOpen={ceremonyData?.isOpen || false} 
                groupName={ceremonyData?.groupName || ""} 
                onComplete={() => setCeremonyData(prev => prev ? { ...prev, isOpen: false } : null)} 
            />
        </BackgroundTheme>
    );
}

// ─── Create Group Form ────────────────────────────────────────────────────────
function CreateGroupForm({ user, friends, onClose, groupType, setGroupType, privacy, setPrivacy }: any) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const toggleFriend = (uid: string) => {
        setSelectedFriendIds(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const handleCreate = async () => {
        if (!name.trim()) return;
        const groupRef = doc(collection(db, "focusGroups"));
        const accessCode = privacy === "private-code" ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
        const inviteToken = privacy === "private-invite" ? generateInviteToken() : null;
        
        const initialMembers = [user.uid];
        const memberStats: any = {
            [user.uid]: { role: "host", totalMinutes: 0, joinedAt: serverTimestamp() }
        };

        // For private-invite, pre-add selected friends as pending
        const pendingInvites = privacy === "private-invite" ? selectedFriendIds : [];

        await setDoc(groupRef, {
            name,
            description: desc,
            type: groupType,
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
        toast.success("Workspace Established!");
        onClose();
    };

    const privacyOptions: { value: GroupPrivacy; label: string; desc: string; icon: any; color: string }[] = [
        { value: "public",         label: "Public",         desc: "Discoverable by everyone",  icon: Globe,  color: "#34d399" },
        { value: "private-code",   label: "Code Access",    desc: "Entry via 6-char code",     icon: Key,    color: "#fbbf24" },
        { value: "private-invite", label: "Invite Only",    desc: "Friends or link invite",    icon: Mail,   color: "#a78bfa" },
    ];

    return (
        <div className={cn("p-8 rounded-3xl border border-white/10 space-y-6", settingsGlassmorphism ? "bg-zinc-900/60" : "bg-zinc-900 shadow-2xl")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace Name" className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#E8821A]/40 outline-none transition-all" />
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Objectives & Description" className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#E8821A]/40 outline-none transition-all h-32 resize-none" />
                </div>
                <div className="space-y-5">
                    {/* Archetype */}
                    <div>
                        <p className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-3">Archetype</p>
                        <div className="flex gap-3">
                            <button onClick={() => setGroupType("friends")} className={cn("flex-1 p-4 rounded-2xl border transition-all text-left", groupType === "friends" ? "bg-[#E8821A]/10 border-[#E8821A]/40" : "bg-zinc-950 border-white/5")}>
                                <UserPlus className={cn("w-5 h-5 mb-2", groupType === "friends" ? "text-[#E8821A]" : "text-zinc-500")} />
                                <p className={cn("text-xs font-bold", groupType === "friends" ? "text-white" : "text-zinc-500")}>Friends</p>
                            </button>
                            <button onClick={() => setGroupType("organization")} className={cn("flex-1 p-4 rounded-2xl border transition-all text-left", groupType === "organization" ? "bg-[#E8821A]/10 border-[#E8821A]/40" : "bg-zinc-950 border-white/5")}>
                                <Briefcase className={cn("w-5 h-5 mb-2", groupType === "organization" ? "text-[#E8821A]" : "text-zinc-500")} />
                                <p className={cn("text-xs font-bold", groupType === "organization" ? "text-white" : "text-zinc-500")}>Organization</p>
                            </button>
                        </div>
                    </div>
                    {/* Privacy */}
                    <div>
                        <p className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-3">Privacy</p>
                        <div className="flex flex-col gap-2">
                            {privacyOptions.map(opt => {
                                const Icon = opt.icon;
                                const isSelected = privacy === opt.value;
                                return (
                                    <button key={opt.value} onClick={() => setPrivacy(opt.value)} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all text-left", isSelected ? "border-white/20 bg-white/5" : "border-white/5 bg-zinc-950 hover:bg-zinc-900")}>
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

            {/* Friend picker for invite-only */}
            <AnimatePresence>
                {privacy === "private-invite" && friends.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="border-t border-white/5 pt-5">
                            <p className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-3 flex items-center gap-2">
                                <UserPlus className="w-3.5 h-3.5" />
                                Invite Friends
                                <span className="text-zinc-700 normal-case font-medium tracking-normal">(optional — they can also join via invite link)</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {friends.filter((f: any) => f.userData).map((f: any) => {
                                    const isSelected = selectedFriendIds.includes(f.friendId);
                                    return (
                                        <button key={f.friendId} onClick={() => toggleFriend(f.friendId)} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all", isSelected ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-zinc-950 border-white/5 text-zinc-500 hover:border-white/10")}>
                                            <Avatar className="w-5 h-5">
                                                <AvatarImage src={f.userData?.photoURL} />
                                                <AvatarFallback className="text-[8px]">{f.userData?.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            {f.userData?.displayName}
                                            {isSelected && <Check className="w-3 h-3" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex gap-4 pt-2">
                <button onClick={handleCreate} className="flex-1 bg-[#E8821A] text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_4px_20px_rgba(232,130,26,0.3)]">Create Workspace</button>
                <button onClick={onClose} className="px-8 bg-zinc-800 text-white font-bold rounded-2xl">Cancel</button>
            </div>
        </div>
    );
}

// ─── Enhanced Group Card ──────────────────────────────────────────────────────
function EnhancedGroupCard({ group, onClick, isMember }: any) {
    const isActive = group.status === "active";
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

    // Live sprint elapsed timer directly on the card
    const sprintElapsed = useSprintElapsed(group.startTime, isActive);

    const activeFocuserCount = (group.memberDetails?.filter((m: any) => m.isFocusing).length || 0);

    // Top contributors for mini activity bars  
    const topContributors = useMemo(() => {
        if (!group.memberDetails) return [];
        return [...group.memberDetails]
            .sort((a: any, b: any) => (b.totalMinutes || 0) - (a.totalMinutes || 0))
            .slice(0, 3);
    }, [group.memberDetails]);
    const maxMins = topContributors[0]?.totalMinutes || 1;

    return (
        <motion.div
            initial={false}
            whileHover={{ scale: 1.018, y: -5 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={onClick}
            className={cn(
                "relative group cursor-pointer overflow-hidden rounded-[1.75rem] border transition-all duration-300 border-inner",
                settingsGlassmorphism ? "bg-zinc-900/50 backdrop-blur-sm" : "bg-zinc-900",
                isActive
                    ? "border-[#E8821A]/40 shadow-[0_4px_24px_rgba(232,130,26,0.18),0_0_0_1px_rgba(232,130,26,0.08)]"
                    : "border-white/[0.07] shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-white/[0.14]"
            )}
        >
            {/* ── Active animated glow overlay ── */}
            {isActive && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#E8821A]/8 via-transparent to-amber-600/4" />
                    <motion.div
                        initial={{ x: "-100%", skewX: -12 }}
                        animate={{ x: "250%" }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 2.5 }}
                        className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-[#E8821A]/12 to-transparent"
                    />
                </div>
            )}

            {/* ── Org accent bar ── */}
            {isOrg && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E8821A]/70 to-transparent" />
            )}

            {/* ── Pulsing active indicator (top-right) ── */}
            {isActive && (
                <div className="absolute top-5 right-5 z-20">
                    <div className="relative w-7 h-7 flex items-center justify-center">
                        <motion.div
                            animate={{ scale: [1, 2.2], opacity: [0.45, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                            className="absolute w-full h-full rounded-full bg-[#E8821A]/35"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                            className="absolute w-4 h-4 rounded-full bg-[#E8821A]/50"
                        />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E8821A] shadow-[0_0_8px_#E8821A,0_0_16px_rgba(201,176,55,0.5)]" />
                    </div>
                </div>
            )}

            {/* ── Card body ── */}
            <div className="relative z-10 p-5 flex flex-col gap-3.5">

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap pr-8">
                    <span className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                        isOrg
                            ? "bg-[#E8821A]/10 border-[#E8821A]/25 text-[#E8821A]"
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
                    {isActive && activeFocuserCount > 0 && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black bg-orange-500/12 text-orange-400 border border-orange-500/25">
                            <Flame className="w-2.5 h-2.5" />
                            {activeFocuserCount}
                        </span>
                    )}
                </div>

                {/* Name */}
                <div>
                    <h4 className="text-[1.125rem] font-black text-white group-hover:text-[#E8821A] transition-colors duration-200 leading-snug tracking-tight truncate">
                        {group.name}
                    </h4>
                    {group.description && (
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{group.description}</p>
                    )}
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.18em] mt-1.5">
                        by {group.hostName}
                    </p>
                </div>

                {/* Sprint timer / focus stats — glass panel */}
                <div className={cn(
                    "rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all duration-500",
                    isActive ? "bg-[#E8821A]/7 border-[#E8821A]/20" : "bg-zinc-950/50 border-white/5"
                )}>
                    {isActive ? (
                        <>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-[8px] font-black uppercase tracking-[0.22em] text-[#E8821A]/55 mb-0.5">Sprint Running</span>
                                <span className="text-[1.05rem] font-black text-[#E8821A] tabular-nums leading-none">
                                    {sprintElapsed > 0 ? fmtElapsed(sprintElapsed) : "Starting…"}
                                </span>
                            </div>
                            <Timer className="w-4 h-4 text-[#E8821A]/40 shrink-0" />
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-600 mb-0.5">Total Focus</span>
                                <span className="text-sm font-black text-zinc-400 tabular-nums leading-none">
                                    {totalMinutes > 0 ? fmtMinutes(totalMinutes) : "No sessions yet"}
                                </span>
                            </div>
                            <Clock className="w-4 h-4 text-zinc-700 shrink-0" />
                        </>
                    )}
                </div>

                {/* Org role breakdown */}
                {isOrg && roles && (roles.admins > 0 || roles.members > 0) && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[9px] font-black text-amber-400/60 uppercase tracking-wider">
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

                {/* Collective Progress Bar (against Host Goal) */}
                {group.settings?.goalHours && group.settings.goalHours > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-zinc-600">
                            <span>Unit Objective</span>
                            <span className="text-[#E8821A]">{Math.round((totalMinutes / 60) / group.settings.goalHours * 100)}% Complete</span>
                        </div>
                        <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (totalMinutes / 60) / group.settings.goalHours * 100)}%` }}
                                className="h-full bg-gradient-to-r from-[#E8821A] to-amber-300" 
                            />
                        </div>
                    </div>
                )}

                {/* Mini contribution bars (top 3 members, only if data exists) */}
                {topContributors.length > 0 && topContributors[0]?.totalMinutes > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                        {topContributors.map((m: any, i: number) => {
                            const pct = Math.round(((m.totalMinutes || 0) / maxMins) * 100);
                            return (
                                <div key={m.uid || i} className="flex items-center gap-2">
                                    <Avatar className="w-4 h-4 shrink-0 border border-white/10">
                                        <AvatarImage src={m.photoURL} />
                                        <AvatarFallback className="text-[6px]">{m.displayName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 h-[3px] bg-zinc-800/80 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                                            className={cn(
                                                "h-full rounded-full",
                                                i === 0 ? "bg-gradient-to-r from-[#E8821A] to-amber-300 shadow-[0_0_6px_rgba(201,176,55,0.5)]"
                                                : i === 1 ? "bg-gradient-to-r from-zinc-400 to-zinc-300"
                                                : "bg-zinc-600"
                                            )}
                                        />
                                    </div>
                                    <span className="text-[8px] font-black text-zinc-600 tabular-nums w-8 text-right shrink-0">
                                        {fmtMinutes(m.totalMinutes || 0)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Bottom row: member avatars + CTA */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                            {group.memberDetails?.slice(0, 5).map((m: any, i: number) => (
                                <div key={i} className="relative">
                                    <Avatar className={cn(
                                        "w-6 h-6 border-2 border-zinc-900 transition-all",
                                        m.isFocusing && "ring-1 ring-[#E8821A] ring-offset-1 ring-offset-zinc-950 shadow-[0_0_8px_rgba(232,130,26,0.5)]"
                                    )}>
                                        <AvatarImage src={m.photoURL} />
                                        <AvatarFallback className="text-[8px]">{m.displayName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    {isActive && m.isFocusing && (
                                        <motion.div 
                                            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute -top-px -right-px w-1.5 h-1.5 rounded-full bg-[#E8821A] shadow-[0_0_4px_#E8821A]" 
                                        />
                                    )}
                                </div>
                            ))}
                            {memberCount > 5 && (
                                <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                                    +{memberCount - 5}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-zinc-600 font-bold">
                            {memberCount} {memberCount === 1 ? "member" : "members"}
                        </span>
                    </div>

                    <div className={cn(
                        "flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all duration-200 group-hover:gap-2",
                        isActive ? "text-[#E8821A]" : "text-zinc-600 group-hover:text-[#E8821A]"
                    )}>
                        {isMember ? "Open" : "View"}
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
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

// ─── Group Detail Modal ───────────────────────────────────────────────────────
function GroupDetailModal({ groupId, onClose, user, groups, friends, activeTab, setActiveTab, onJoin, onLeave, setCeremonyData }: any) {
    const group = groups.find((g: any) => g.id === groupId);
    
    const [tasks, setTasks] = useState<SharedTask[]>([]);
    const [viewMode, setViewMode] = useState<"shared" | "personal">("shared");
    const [isManagingRoles, setIsManagingRoles] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    const isMember = group?.members.includes(user.uid);
    const memberStats = group?.memberStats?.[user.uid];
    const userRole = memberStats?.role || "member";
    const isAdmin = userRole === "host" || userRole === "admin";
    const isActive = group?.status === "active";
    const isOrg = group?.type === "organization";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const timerStart = useTimerStore(s => s.start);
    const timerPause = useTimerStore(s => s.pause);
    const timerIsActive = useTimerStore(s => s.isActive);
    const setActiveGroupId = useTimerStore(s => s.setActiveGroupId);

    // Live elapsed sprint timer
    const sprintElapsed = useSprintElapsed(group?.startTime, isActive);

    const activeFocuserCount = useMemo(() => {
        return (group?.memberDetails?.filter((m: any) => m.isFocusing).length) || 0;
    }, [group?.memberDetails]);

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

    if (!group) return null;

    const handleAddTask = async (title: string, priority: string = "medium", assignedTo: string = "all") => {
        if (!isAdmin) return;
        await addDoc(collection(db, `focusGroups/${groupId}/tasks`), {
            title, priority, assignedTo, status: "todo",
            createdBy: user.uid, createdAt: serverTimestamp()
        });
    };

    const handleUpdateTask = async (taskId: string, updates: any) => {
        await updateDoc(doc(db, `focusGroups/${groupId}/tasks`, taskId), updates);
    };

    const handleToggleStatus = async (groupId: string) => {
        if (!isMember) return;
        
        const isCurrentlyFocusing = memberStats?.isFocusing;
        const newFocusingState = !isCurrentlyFocusing;
        
        // Determine if anyone else is currently focusing
        const otherFocusers = group.memberDetails?.filter((m: any) => m.isFocusing && m.uid !== user.uid) || [];
        const anyoneElseFocusing = otherFocusers.length > 0;

        const updates: any = {};

        // Determine group-level status based on NEW focusing state
        if (newFocusingState) {
            updates.status = "active";
            if (!isActive) updates.startTime = serverTimestamp();
        } else if (!anyoneElseFocusing) {
            updates.status = "idle";
            updates.startTime = null;
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, "focusGroups", groupId), updates);
        }

        // Sync local Pomodoro timer
        if (newFocusingState) {
            setCeremonyData({ isOpen: true, groupName: group.name });
            setActiveGroupId(groupId);
            if (!timerIsActive) timerStart();
        } else {
            setActiveGroupId(null);
            // We don't pause the timer here to allow the user to continue focusing individually
        }
        
        if (!newFocusingState) {
            toast.info("Disconnected from workspace.");
        }
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: "admin" | "member") => {
        if (userRole !== "host") { toast.error("Only the host can modify officer roles."); return; }
        await updateDoc(doc(db, "focusGroups", groupId), {
            [`memberStats.${memberId}.role`]: newRole
        });
        toast.success(`Updated role to ${newRole}`);
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!isAdmin) return;
        if (memberId === group.hostId) return;
        const newMembers = group.members.filter((m: string) => m !== memberId);
        const updateStats: any = { ...group.memberStats };
        delete updateStats[memberId];
        await updateDoc(doc(db, "focusGroups", groupId), { members: newMembers, memberStats: updateStats });
        toast.info("Member extracted from unit.");
    };


    const totalGroupMinutes = group.totalMinutes || sortedMembers.reduce((acc: number, m: any) => acc + (m.totalMinutes || 0), 0);
    const adminCount = sortedMembers.filter((m: any) => m.role === "host" || m.role === "admin").length;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl" onClick={onClose} />
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="relative w-full max-w-5xl bg-zinc-900/50 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                
                {isOrg && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E8821A]/60 to-transparent" />}

                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-br from-[#E8821A]/5 to-transparent">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <button onClick={() => setIsManagingRoles(false)} className={cn("transition-all", isManagingRoles ? "opacity-100 w-auto mr-2" : "opacity-0 w-0 overflow-hidden")}>
                                    <ChevronRight className="w-5 h-5 rotate-180 text-zinc-500 hover:text-white" />
                                </button>
                                <h2 className="text-3xl font-black text-white tracking-tighter">
                                    {isManagingRoles ? "Unit Management" : group.name}
                                </h2>
                                {!isManagingRoles && (
                                    <span className={cn(
                                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                        isOrg 
                                            ? "bg-[#E8821A]/10 text-[#E8821A] border-[#E8821A]/20" 
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
                                        <code className="text-sm font-black text-[#E8821A] bg-[#E8821A]/5 px-2 py-0.5 rounded-lg border border-[#E8821A]/20">{group.accessCode}</code>
                                        <button onClick={() => { navigator.clipboard.writeText(group.accessCode || ""); toast.success("Code copied"); }} className="p-1 px-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-zinc-500 text-sm max-w-xl line-clamp-1">{isManagingRoles ? `Configure authorization and hierarchy for ${group.name}` : group.description}</p>
                        </div>
                            <div className="flex items-center gap-3">
                                {isMember ? (
                                    <>
                                        {/* Dynamic Status badge in header */}
                                        <div className={cn(
                                            "hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border font-black text-[9px] uppercase tracking-widest transition-all",
                                            activeFocuserCount > 0 ? "bg-[#E8821A]/10 border-[#E8821A]/30 text-[#E8821A]" : "bg-zinc-800 border-white/5 text-zinc-500"
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full", activeFocuserCount > 0 ? "bg-[#E8821A] animate-pulse shadow-[0_0_8px_#E8821A]" : "bg-zinc-600")} />
                                            {activeFocuserCount > 0 ? `${activeFocuserCount} Focusing Now` : "Status: Ready"}
                                        </div>

                                        <button onClick={() => handleToggleStatus(group.id)} className={cn(
                                            "px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 group/btn",
                                            memberStats?.isFocusing ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]" : "bg-[#E8821A] text-black hover:shadow-[0_0_20px_#E8821A44]"
                                        )}>
                                            {memberStats?.isFocusing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            {memberStats?.isFocusing ? "Disconnect" : "Enter Focus Zone"}
                                        </button>

                                        {isAdmin && (group.privacy === "private-invite" || group.privacy === "public") && (
                                            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2.5 rounded-xl font-black text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all flex items-center gap-2">
                                                <UserPlus className="w-4 h-4" /> Invite
                                            </button>
                                        )}
                                        <button onClick={() => onLeave(group.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all text-xs font-black flex items-center gap-2">
                                            <LogOut className="w-4 h-4" /> 
                                            <span className="hidden md:inline">Exit Unit</span>
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => onJoin(group.id)} className="px-6 py-3 bg-[#E8821A] text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all">Request Access</button>
                                )}
                                <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X className="w-4 h-4" /></button>
                            </div>
                    </div>

                    {/* Dynamic Status Display (The Forge) */}
                    <div className={cn(
                        "relative p-6 rounded-[2.5rem] overflow-hidden transition-all duration-700",
                        isActive 
                            ? "bg-orange-500/10 border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]" 
                            : "bg-zinc-900/40 border border-white/5 border-dashed"
                    )}>
                        {isActive && <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -mr-32 -mt-32 animate-pulse" />}
                        
                        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                            <div className={cn(
                                "w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all duration-500",
                                isActive ? "bg-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] scale-110" : "bg-zinc-800"
                            )}>
                                {isActive ? <Flame className="w-8 h-8 text-white animate-bounce" /> : <Power className="w-8 h-8 text-zinc-600" />}
                            </div>

                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-3">
                                    <h3 className={cn("text-xl font-black tracking-tight transition-colors", isActive ? "text-orange-400" : "text-zinc-400")}>
                                        {isActive ? "Active Focused Session" : "Group Status: Idle"}
                                    </h3>
                                    {isActive && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                            <span className="text-[8px] font-black uppercase text-orange-400 tracking-widest leading-none">Live Now</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-zinc-500 text-xs font-medium max-w-md">
                                    {isActive 
                                        ? `You and ${activeFocuserCount} participants are currently focusing in this workspace.`
                                        : "Start a focus session to sync with this group's active members."
                                    }
                                </p>
                            </div>

                            {isActive && sprintElapsed > 0 && (
                                <div className="flex items-center gap-6 px-8 py-4 bg-zinc-950/60 rounded-3xl border border-white/5 backdrop-blur-sm">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">Time Elapsed</span>
                                        <span className="text-3xl font-black text-white font-terminal tracking-tighter">
                                            {fmtElapsed(sprintElapsed)}
                                        </span>
                                    </div>
                                    <div className="w-[1px] h-10 bg-white/5" />
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">Synergy Rate</span>
                                        {(() => {
                                            const synergy = Math.min(100, (activeFocuserCount * 25));
                                            const color = synergy > 70 ? "text-[#E8821A]" : synergy > 30 ? "text-amber-400" : "text-sky-400";
                                            return (
                                                <span className={cn("text-3xl font-black transition-colors duration-500", color)}>
                                                    {synergy}%
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isManagingRoles && isMember && (
                        <div className="mt-8 flex items-center justify-between">
                            <div className="flex gap-1 p-1 bg-zinc-950/40 rounded-xl w-fit border border-white/5">
                                {[
                                    { id: "workspace", icon: LayoutGrid, label: "Workspace" },
                                    { id: "members",   icon: Users,      label: "Participants" }
                                ].map(t => (
                                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all", activeTab === t.id ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300")}>
                                        <t.icon className="w-4 h-4" />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {/* Desktop quick member scroll */}
                            <div className="hidden lg:flex items-center gap-4">
                                <div className="h-4 w-[1px] bg-white/5 mr-2" />
                                <div className="flex -space-x-2">
                                    {group.memberDetails?.slice(0, 8).map((m: any, i: number) => (
                                        <div key={i} className="relative group/avatar">
                                            <Avatar className={cn(
                                                "w-8 h-8 border-2 border-zinc-900 transition-transform hover:scale-110",
                                                m.isFocusing ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-zinc-900" : "opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                                            )}>
                                                <AvatarImage src={m.photoURL} />
                                                <AvatarFallback className="text-[10px] bg-zinc-800">{m.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-zinc-800 text-[8px] text-white rounded opacity-0 group-hover/avatar:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
                                                {m.displayName} {m.isFocusing && "• Focusing"}
                                            </div>
                                        </div>
                                    ))}
                                    {group.memberDetails && group.memberDetails.length > 8 && (
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                            +{group.memberDetails.length - 8}
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
                        />
                    ) : isMember ? (
                        activeTab === "workspace" ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
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
                                            tasks.length > 0 ? (
                                                <SharedTasksPanel tasks={tasks} onAdd={handleAddTask} onUpdate={handleUpdateTask} isAdmin={isAdmin} groupMembers={group.memberDetails} />
                                            ) : (
                                                <div className="p-8 border-2 border-dashed border-white/5 rounded-3xl space-y-6">
                                                    <div className="text-center space-y-2">
                                                        <p className="text-xs font-bold text-zinc-500">No active objectives for this unit.</p>
                                                        <p className="text-[10px] text-zinc-600">Select a template to initialize:</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {[
                                                            { title: "Deep Work Session", icon: Sparkles },
                                                            { title: "Review & Respond", icon: Mail },
                                                            { title: "Learning Sprint", icon: Target }
                                                        ].map((tpl, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => handleAddTask(tpl.title)}
                                                                className="flex flex-col items-center gap-2 p-4 bg-zinc-900/60 border border-white/5 rounded-2xl hover:border-[#E8821A]/40 transition-all group"
                                                            >
                                                                <tpl.icon className="w-4 h-4 text-zinc-600 group-hover:text-[#E8821A]" />
                                                                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider text-center">{tpl.title}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                                                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600"><User className="w-8 h-8" /></div>
                                                <p className="text-sm text-zinc-500 font-medium">Personal tasks are synced from your <Link href="/tasks" className="text-[#E8821A] hover:underline">Task Dashboard</Link>.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sidebar */}
                                <div className="space-y-4">
                                    {/* Org Stats widget */}
                                    {isOrg && (
                                        <div className="p-5 bg-zinc-950/60 border border-[#E8821A]/15 rounded-2xl space-y-3 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#E8821A]/5 blur-3xl" />
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
                                                    <p className="text-lg font-black text-amber-400">{adminCount}</p>
                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">Officers</p>
                                                </div>
                                                <div className="p-3 bg-zinc-900/60 rounded-xl">
                                                    <p className="text-lg font-black text-white">{group.members.length}</p>
                                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">Total Members</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Real-time Presence Feed */}
                                    <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em]">Operational Status</p>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                                                <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                                                <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">{activeFocuserCount} Live</span>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {group.memberDetails?.filter((m: any) => m.isFocusing).length > 0 ? (
                                                group.memberDetails?.filter((m: any) => m.isFocusing).map((m: any) => (
                                                    <div key={m.uid} className="flex items-center gap-3 p-2 bg-zinc-950/40 rounded-2xl border border-white/5 group/presence">
                                                        <div className="relative">
                                                            <Avatar className="w-8 h-8 ring-2 ring-orange-500/20 ring-offset-2 ring-offset-zinc-950">
                                                                <AvatarImage src={m.photoURL} />
                                                                <AvatarFallback className="text-[10px] bg-zinc-900">{m.displayName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-zinc-950 animate-pulse shadow-[0_0_8px_#F97316]" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[11px] font-black text-white truncate">{m.uid === user.uid ? "You" : m.displayName}</p>
                                                                <span className="text-[8px] font-black bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-zinc-500 capitalize">{m.role}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Focused State</span>
                                                                <span className="text-[8px] text-zinc-600 font-bold ml-1">• {fmtMinutes(m.totalMinutes || 0)} today</span>
                                                            </div>
                                                        </div>
                                                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-6 text-center border-2 border-white/5 border-dashed rounded-3xl">
                                                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">All Members Idle</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contributors leaderboard — competitive */}
                                    <div className="p-6 bg-zinc-950/40 border border-[#E8821A]/10 rounded-3xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8821A]/5 blur-3xl -mr-10 -mt-10" />
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em]">Group Leaderboard</p>
                                            {/* User's rank chip */}
                                            {(() => {
                                                const myRank = sortedMembers.findIndex((m: any) => m.uid === user.uid) + 1;
                                                return myRank > 0 ? (
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                                        myRank === 1 ? "bg-[#E8821A]/20 border-[#E8821A]/30 text-[#E8821A]" : "bg-white/5 border-white/10 text-zinc-400"
                                                    )}>
                                                        {myRank === 1 ? "🏆 #1" : `#${myRank} You`}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>
                                        
                                        <div className="space-y-2 mb-6">
                                            {sortedMembers.slice(0, 5).map((m: any, i: number) => {
                                                const pct = totalGroupMinutes > 0 ? Math.round(((m.totalMinutes || 0) / totalGroupMinutes) * 100) : 0;
                                                const isMe = m.uid === user.uid;
                                                const prevMember = i > 0 ? sortedMembers[i - 1] : null;
                                                const gap = prevMember ? (prevMember.totalMinutes || 0) - (m.totalMinutes || 0) : 0;
                                                const isFocusing = m.isFocusing;
                                                return (
                                                    <div key={m.uid} className={cn("space-y-1 rounded-xl p-2 transition-all", isMe && "bg-[#E8821A]/5 border border-[#E8821A]/15")}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("text-[9px] font-black w-4 shrink-0", i === 0 ? "text-[#E8821A]" : i === 1 ? "text-zinc-400" : "text-zinc-600")}>#{i + 1}</span>
                                                            <Link href={`/profile?user=${m.uid}`} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                                                                <Avatar className="w-5 h-5 border border-white/10 hover:border-white/30 transition-all">
                                                                    <AvatarImage src={m.photoURL} />
                                                                    <AvatarFallback className="text-[8px]">{m.displayName?.[0]}</AvatarFallback>
                                                                </Avatar>
                                                            </Link>
                                                            <span className={cn("text-xs font-bold flex-1 truncate", isMe ? "text-[#E8821A]" : "text-zinc-300")}>
                                                                {isMe ? "You" : m.displayName}
                                                            </span>
                                                            {isFocusing && (
                                                                <span className="flex items-center gap-0.5 text-[8px] font-black text-orange-400 shrink-0">
                                                                    <Flame className="w-2.5 h-2.5" />
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] font-black text-white shrink-0">{fmtMinutes(m.totalMinutes || 0)}</span>
                                                        </div>
                                                        {totalGroupMinutes > 0 && (
                                                            <div className="ml-6 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                                <motion.div 
                                                                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                                                    transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                                                                    className={cn("h-full", isMe ? "bg-gradient-to-r from-[#E8821A] to-amber-300" : "bg-gradient-to-r from-[#E8821A]/50 to-[#E8821A]/30")}
                                                                />
                                                            </div>
                                                        )}
                                                        {/* "Catch up" nudge for the user */}
                                                        {isMe && i > 0 && gap > 0 && (
                                                            <p className="ml-6 text-[8px] text-zinc-600 font-bold">
                                                                {fmtMinutes(gap)} behind {sortedMembers[i-1].displayName} — keep going!
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {sortedMembers.length === 0 && (
                                                <p className="text-[10px] text-zinc-600 italic">No activity recorded yet.</p>
                                            )}
                                        </div>

                                        <Link href={`/leaderboard?tab=groups&groupId=${groupId}`} className="flex items-center justify-between w-full p-4 bg-white/5 rounded-2xl group/link hover:bg-white/10 transition-all border border-white/5">
                                            <span className="text-[9px] font-black uppercase text-white tracking-[0.2em]">Full Group Leaderboard</span>
                                            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover/link:translate-x-1 transition-all" />
                                        </Link>
                                    </div>

                                    {/* Role Identity */}
                                    <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-2xl flex items-center gap-4">
                                        <div className="p-2.5 bg-zinc-800 rounded-xl">
                                            {userRole === "host" ? <Crown className="w-5 h-5 text-[#E8821A]" /> : userRole === "admin" ? <Zap className="w-5 h-5 text-amber-400" /> : <User className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white capitalize">{userRole} Status</p>
                                            <p className="text-[9px] text-zinc-500 font-medium">{userRole === "host" ? "Full access & deletion" : userRole === "admin" ? "Can manage objectives" : "Visual collaborator"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Members tab
                            <MembersTab
                                group={group} user={user} isAdmin={isAdmin} userRole={userRole}
                                sortedMembers={sortedMembers} totalGroupMinutes={totalGroupMinutes}
                                onManageRoles={() => setIsManagingRoles(true)}
                                onInvite={() => setShowInviteModal(true)}
                            />
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center gap-8 animate-in fade-in zoom-in slide-in-from-bottom-5">
                            <div className="w-24 h-24 rounded-full bg-[#E8821A]/5 flex items-center justify-center border border-[#E8821A]/10 relative">
                                <Lock className="w-10 h-10 text-[#E8821A]" />
                                <div className="absolute inset-0 rounded-full border border-[#E8821A]/20 animate-ping" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white">Unlock High-Intensity Session</h3>
                                <p className="text-zinc-600 max-w-md">Join this {group.type} to see active objectives, real-time presence, and collective progress.</p>
                            </div>
                            <button onClick={() => onJoin(group.id)} className="px-10 py-5 bg-[#E8821A] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(201,176,55,0.2)]">Establish Connection</button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Invite modal */}
            <AnimatePresence>
                {showInviteModal && (
                    <InviteModal
                        group={group} user={user} friends={friends}
                        onClose={() => setShowInviteModal(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────
function MembersTab({ group, user, isAdmin, userRole, sortedMembers, totalGroupMinutes, onManageRoles, onInvite }: any) {
    const isOrg = group.type === "organization";

    const hostMembers    = sortedMembers.filter((m: any) => m.role === "host");
    const adminMembers   = sortedMembers.filter((m: any) => m.role === "admin");
    const regularMembers = sortedMembers.filter((m: any) => m.role === "member");

    const Tier = ({ label, color, members }: { label: string; color: string; members: any[] }) => {
        if (!members.length) return null;
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", color)}>{label}</span>
                    <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {members.map((m: any) => {
                        const pct = totalGroupMinutes > 0 ? Math.round(((m.totalMinutes || 0) / totalGroupMinutes) * 100) : 0;
                        const isMe = m.uid === user.uid;
                        // lastActive is only written on session complete; for the current user
                        // treat being a member of an active group as focusing now
                        const isFocusingNow = m.isFocusing;
                        return (
                            <div key={m.uid} className={cn("p-4 rounded-2xl border space-y-3 relative transition-all group/card", isFocusingNow ? "bg-orange-500/5 border-orange-500/20" : "bg-zinc-900/50 border-white/5")}>
                                {/* Focusing live badge */}
                                {isFocusingNow && (
                                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-orange-500/20 border border-orange-500/30 rounded-full px-2 py-0.5">
                                        <Flame className="w-2.5 h-2.5 text-orange-400" />
                                        <span className="text-[8px] font-black text-orange-400 uppercase tracking-wider">Focusing</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    {/* Clickable avatar → profile */}
                                    <Link href={`/profile?user=${m.uid}`} onClick={e => e.stopPropagation()} className="relative flex-shrink-0 group/av">
                                        <Avatar className="w-10 h-10 border border-white/10 group-hover/av:border-white/30 transition-all">
                                            <AvatarImage src={m.photoURL} />
                                            <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-all">
                                            <ExternalLink className="w-2 h-2 text-zinc-400" />
                                        </div>
                                    </Link>
                                    <div className="flex-1 min-w-0">
                                        <Link href={`/profile?user=${m.uid}`} onClick={e => e.stopPropagation()} className="group/name">
                                            <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5 group-hover/name:text-[#E8821A] transition-colors">
                                                {m.displayName}
                                                {isMe && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-white/10 rounded text-zinc-400">You</span>}
                                            </h4>
                                        </Link>
                                        <p className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1", m.role === "host" ? "text-[#E8821A]" : m.role === "admin" ? "text-amber-400" : "text-zinc-500")}>
                                            {m.role === "host" && <Crown className="w-2.5 h-2.5" />}
                                            {m.role === "admin" && <Zap className="w-2.5 h-2.5" />}
                                            {m.role}
                                        </p>
                                    </div>
                                </div>
                                {/* Contribution bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Contribution</span>
                                        <span className="text-[9px] font-black text-white">{fmtMinutes(m.totalMinutes || 0)}</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            className={cn("h-full rounded-full", m.role === "host" ? "bg-gradient-to-r from-[#E8821A] to-amber-300" : m.role === "admin" ? "bg-gradient-to-r from-amber-500 to-amber-400" : isFocusingNow ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-gradient-to-r from-zinc-600 to-zinc-500")}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {isOrg ? (
                <>
                    <Tier label="Command Unit" color="text-[#E8821A]" members={hostMembers} />
                    <Tier label="Officers" color="text-amber-400" members={adminMembers} />
                    <Tier label="Members" color="text-zinc-500" members={regularMembers} />
                </>
            ) : (
                <Tier label="Members" color="text-zinc-500" members={sortedMembers} />
            )}

            {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button onClick={onManageRoles} className="flex-1 py-4 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                        <UserPlus className="w-4 h-4 text-[#E8821A]" /> Manage Roles
                    </button>
                    {(group.privacy === "private-invite" || group.privacy === "public") && (
                        <button onClick={onInvite} className="flex-1 py-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/10 text-violet-400 transition-all flex items-center justify-center gap-2">
                            <Mail className="w-4 h-4" /> Invite Members
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

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
function GroupManagementView({ group, user, onUpdateRole, onRemove, userRole }: any) {
    const isHost = userRole === "host";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const hostMembers    = group.memberDetails?.filter((m: any) => m.role === "host") ?? [];
    const adminMembers   = group.memberDetails?.filter((m: any) => m.role === "admin") ?? [];
    const regularMembers = group.memberDetails?.filter((m: any) => m.role === "member") ?? [];

    const MemberRow = ({ m }: { m: any }) => (
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
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-[7px] font-black uppercase text-orange-400 animate-pulse">
                            Live Focus
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1", m.role === "host" ? "text-[#E8821A]" : m.role === "admin" ? "text-amber-400" : "text-zinc-500")}>
                        {m.role === "host" && <Crown className="w-2.5 h-2.5" />}
                        {m.role === "admin" && <Zap className="w-2.5 h-2.5" />}
                        {m.role}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span className="text-[9px] text-zinc-600 font-bold">{fmtMinutes(m.totalMinutes || 0)} contributed</span>
                </div>
            </div>

            {m.uid !== group.hostId && m.uid !== user.uid && (
                <div className="flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-all">
                    {isHost && (
                        <button 
                            onClick={() => onUpdateRole(m.uid, m.role === "admin" ? "member" : "admin")}
                            className={cn("px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", m.role === "admin" ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20")}
                        >
                            {m.role === "admin" ? "Demote" : "Promote"}
                        </button>
                    )}
                    <button 
                        onClick={() => { if (confirm(`Remove ${m.displayName}?`)) onRemove(m.uid); }}
                        className="p-2 bg-red-400/10 text-red-400 rounded-xl hover:bg-red-400/20 transition-all"
                    >
                        <UserX className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );

    const Section = ({ label, color, members }: { label: string; color: string; members: any[] }) => {
        if (!members.length) return null;
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", color)}>{label}</span>
                    <div className="h-px flex-1 bg-white/5" />
                </div>
                {members.map((m: any) => <MemberRow key={m.uid} m={m} />)}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-150">
            <div>
                <h3 className="text-xl font-bold text-white mb-1">Unit Hierarchy</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Manage Roles & Access</p>
            </div>

            <div className="space-y-6">
                <Section label="Command Unit" color="text-[#E8821A]" members={hostMembers} />
                <Section label="Officers" color="text-amber-400" members={adminMembers} />
                <Section label="Members" color="text-zinc-500" members={regularMembers} />
            </div>

            {/* Host: Administration Settings */}
            {isHost && (
                <div className="space-y-6 pt-8 border-t border-white/5">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">Unit Administration</h3>
                        <p className="text-xs text-[#E8821A] uppercase tracking-widest font-bold">Configure Unit Parameters</p>
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
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-[#E8821A]/40 outline-none" 
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
                                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-white focus:border-[#E8821A]/40 outline-none" 
                                />
                                <span className="text-zinc-600 font-bold text-xs uppercase whitespace-nowrap">Members</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite section */}
            {(group.privacy === "private-code" || group.privacy === "public") && group.accessCode && (
                <div className="p-6 rounded-3xl bg-zinc-900/60 border border-white/5 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-white mb-1">Entry Code</h4>
                        <p className="text-[10px] text-zinc-600">Share to expand your unit.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <code className="text-xl font-black text-[#E8821A] tracking-[0.2em] bg-zinc-950 px-4 py-2 rounded-xl border border-[#E8821A]/30">{group.accessCode}</code>
                        <button onClick={() => { navigator.clipboard.writeText(group.accessCode || ""); toast.success("Copied!"); }} className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all">
                            <Copy className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className={cn("relative w-full max-w-md border border-white/10 rounded-3xl p-8 shadow-2xl", settingsGlassmorphism ? "bg-zinc-900/80 backdrop-blur-md" : "bg-zinc-900")}>
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#E8821A]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#E8821A]/20">
                        <Key className="w-8 h-8 text-[#E8821A]" />
                    </div>
                    <h3 className="text-2xl font-black text-white">Join Workspace</h3>
                    <p className="text-zinc-500 text-sm mt-2">Enter the unique 6-digit access code provided by the host.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <input 
                        autoFocus maxLength={6} value={code} 
                        onChange={(e) => setCode(e.target.value.toUpperCase())} 
                        placeholder="ENTER CODE" 
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-6 py-5 text-center text-2xl font-black tracking-[0.5em] text-[#E8821A] outline-none focus:border-[#E8821A]/50 transition-all placeholder:text-zinc-800" 
                    />
                    <div className="flex gap-4">
                        <button type="submit" disabled={loading || code.length < 6} className="flex-1 bg-[#E8821A] text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_30px_rgba(201,176,55,0.2)] disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
                            {loading ? "Searching..." : "Connect to Unit"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

// ─── Sprint Resonance ─────────────────────────────────────────────────────────
function SprintResonance() {
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] pointer-events-none overflow-hidden"
        >
            <motion.div 
                initial={{ top: "-10%" }} animate={{ top: "110%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-[#E8821A]/20 to-transparent blur-3xl"
            />
            <motion.div 
                initial={{ top: "-5%" }} animate={{ top: "105%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-1 bg-[#E8821A]/40 shadow-[0_0_20px_#E8821A]"
            />
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
            >
                <div className="px-12 py-6 bg-zinc-950/80 backdrop-blur-3xl border border-[#E8821A]/30 rounded-[2rem] shadow-[0_0_100px_rgba(201,176,55,0.2)]">
                    <h2 className="text-4xl font-black text-[#E8821A] tracking-[0.3em] uppercase animate-pulse">Session Started</h2>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Shared Tasks Panel ───────────────────────────────────────────────────────
function SharedTasksPanel({ tasks, onAdd, onUpdate, isAdmin, groupMembers }: any) {
    const [openAdd, setOpenAdd] = useState(false);
    const [title, setTitle] = useState("");
    const [prio, setPrio] = useState<any>("medium");
    const [assign, setAssign] = useState("all");

    const handleAdd = () => {
        if (!title.trim()) return;
        onAdd(title, prio, assign);
        setTitle("");
        setOpenAdd(false);
    };

    return (
        <div className="space-y-4">
            {isAdmin && !openAdd && (
                <button onClick={() => setOpenAdd(true)} className="w-full p-5 flex items-center gap-3 bg-[#E8821A]/5 border border-[#E8821A]/10 rounded-2xl group hover:bg-[#E8821A]/10 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-[#E8821A]/20 flex items-center justify-center text-[#E8821A] group-hover:scale-110 transition-all"><Plus className="w-5 h-5" /></div>
                    <span className="text-sm font-bold text-[#E8821A]/80">Create New Objective...</span>
                </button>
            )}

            {openAdd && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-zinc-900 border border-[#E8821A]/30 rounded-3xl space-y-4">
                    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title..." className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[#E8821A]/40 transition-all" />
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
                        <button onClick={handleAdd} className="flex-1 py-3 bg-[#E8821A] text-black font-black rounded-xl text-xs">Create Objective</button>
                        <button onClick={() => setOpenAdd(false)} className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl text-xs">Cancel</button>
                    </div>
                </motion.div>
            )}

            <div className="space-y-2">
                {tasks.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 group hover:border-white/10 transition-all">
                        <button onClick={() => onUpdate(task.id, { status: task.status === "done" ? "todo" : "done" })} className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", task.status === "done" ? "bg-[#E8821A] border-[#E8821A] text-black" : "border-white/10 text-transparent hover:border-white/30")}>
                            <Check className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h4 className={cn("text-sm font-bold transition-all truncate", task.status === "done" ? "text-zinc-600 line-through" : "text-white")}>{task.title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest", task.priority === "high" ? "text-red-400" : task.priority === "medium" ? "text-yellow-400" : "text-blue-400")}>{task.priority} Priority</span>
                                <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">To: {task.assignedTo === "all" ? "The Collective" : "Direct Unit"}</span>
                            </div>
                        </div>
                        {isAdmin && (
                            <button className="p-2 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"><X className="w-4 h-4" /></button>
                        )}
                    </div>
                ))}
                {tasks.length === 0 && !openAdd && (
                    <div className="py-12 text-center text-zinc-700 font-black uppercase tracking-[0.2em] text-xs">No active objectives</div>
                )}
            </div>
        </div>
    );
}

// ─── Active Focusers Banner ───────────────────────────────────────────────────
function ActiveFocusersBanner({ focusers }: { focusers: any[] }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/8 via-orange-500/5 to-transparent p-4 flex items-center gap-4 overflow-hidden relative"
        >
            {/* Shimmer */}
            <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-orange-400/8 to-transparent skew-x-12 pointer-events-none"
            />

            <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">{focusers.length} focusing now</p>
                    <p className="text-[9px] text-zinc-600">across your groups</p>
                </div>
            </div>

            <div className="flex items-center gap-0 flex-1 overflow-x-auto no-scrollbar">
                {focusers.map((f, i) => (
                    <Link
                        key={f.uid}
                        href={`/profile?user=${f.uid}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group/focuser shrink-0"
                        title={`${f.displayName} — ${f.groupName}`}
                    >
                        <div className="relative">
                            <Avatar className="w-7 h-7 border-2 border-orange-500/40 group-hover/focuser:border-orange-400 transition-all">
                                <AvatarImage src={f.photoURL} />
                                <AvatarFallback className="text-[9px]">{f.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-orange-400 border border-zinc-950 animate-pulse shadow-[0_0_6px_#f97316]" />
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-xs font-bold text-white group-hover/focuser:text-orange-300 transition-colors">{f.displayName}</p>
                            <p className="text-[9px] text-zinc-600">{f.groupName}</p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="shrink-0 hidden sm:flex items-center gap-1.5 text-[9px] font-black text-zinc-600 uppercase tracking-wider">
                <TrendingUp className="w-3 h-3" />
                start your session!
            </div>
        </motion.div>
    );
}
