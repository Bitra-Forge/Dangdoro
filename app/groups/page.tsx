"use client";
// Refactored to dynamic routing

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import { 
    Users, Plus, Key, Globe, Search, Flame
} from "lucide-react";
import { useTimerStore } from "@/lib/store";
import { subscribeToFriendsList } from "@/lib/friendship";
import { fetchUserProfiles } from "@/lib/db";
import { toast } from "sonner";
import { 
    doc, setDoc, onSnapshot, collection, 
    serverTimestamp, updateDoc, arrayUnion, increment,
    query, where, getDocs 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

// Shared Library
import { 
    FocusGroup, GroupPrivacy, normalizeLiveSessions, 
    resolveLiveSessionsForGroup, generateInviteToken, GoalType
} from "@/lib/groups";

// Extracted Components
import { EnhancedGroupCard } from "@/components/groups/EnhancedGroupCard";
import { ActiveFocusersBanner } from "@/components/groups/ActiveFocusersBanner";
import { JoinCodeModal } from "@/components/groups/JoinCodeModal";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["300", "400", "500", "600", "700"],
});

export default function GroupsPage() {
    const { user, loading: authLoading } = useAuth();
    const [friends, setFriends] = useState<any[]>([]);
    const [focusGroups, setFocusGroups] = useState<FocusGroup[]>([]);
    const [liveSessions, setLiveSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [privacy, setPrivacy] = useState<GroupPrivacy>("private-invite");
    const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

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
                const memberLiveSession = groupLiveSessions.find(ls => ls.userId === memberId);
                const liveDisplayName = memberLiveSession?.userName;
                const livePhotoURL = memberLiveSession?.userPhoto;
                const isFocusing = !!memberLiveSession;
                const role = stats.role || (group.hostId === memberId ? "host" : "member");

                if (memberId === user?.uid) {
                    memberDetails.push({
                        uid: user.uid,
                        displayName: hydration?.displayName || user.displayName || liveDisplayName || "You",
                        photoURL: hydration?.photoURL || user.photoURL || livePhotoURL || null,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === user.uid
                    });
                } else if (friend?.userData) {
                    memberDetails.push({
                        ...friend.userData,
                        displayName: friend.userData.displayName || liveDisplayName || "Member",
                        photoURL: friend.userData.photoURL || livePhotoURL || null,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === memberId
                    });
                } else if (hydration) {
                    memberDetails.push({
                        ...hydration,
                        displayName: hydration.displayName || liveDisplayName || "Member",
                        photoURL: hydration.photoURL || livePhotoURL || null,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === memberId
                    });
                } else {
                    memberDetails.push({
                        uid: memberId,
                        displayName: liveDisplayName || "Member",
                        photoURL: livePhotoURL || null,
                        ...stats,
                        isFocusing,
                        liveSessionStartedAt: memberLiveSession?.startedAt || null,
                        role,
                        isHost: group.hostId === memberId
                    });
                }
            }
            return { ...group, memberDetails } as FocusGroup;
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
                setLiveSessions(normalizeLiveSessions(raw));
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
                profiles.forEach((p: any) => { newProfiles[p.uid] = p; });
                missingUids.forEach(uid => { if (!newProfiles[uid]) newProfiles[uid] = { uid, notFound: true }; });
                setHydratedProfiles(newProfiles);
            });
        }
    }, [focusGroups, friends, user?.uid, hydratedProfiles]);

    const activeFocusers = useMemo(() => {
        if (!user) return [];
        const seen = new Set<string>();
        const result: any[] = [];
        userGroups.forEach(g => {
            g.memberDetails?.forEach((m: any) => {
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
                toast.info(`Already a member of "${groupData.name}"`);
                setShowJoinCodeModal(false);
                return;
            }
            if (groupData.settings?.maxMembers && (groupData.members?.length || 0) >= groupData.settings.maxMembers) {
                toast.error(`Maximum capacity reached.`);
                return;
            }
            const groupRef = doc(db, "focusGroups", groupDoc.id);
            await updateDoc(groupRef, {
                members: arrayUnion(user.uid),
                memberCount: increment(1),
                [`memberStats.${user.uid}`]: { role: "member", totalMinutes: 0, joinedAt: serverTimestamp() }
            });
            toast.success(`Joined "${groupData.name}"!`);
            setShowJoinCodeModal(false);
        } catch (error) {
            toast.error("Error joining group");
        }
    };

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[white]/20 border-t-[white] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <BackgroundTheme showSettings={false} />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Groups Locked" description="Sign in to create focus groups and join organizations." />
            </main>
        </div>
    );

    if (loading) return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
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
                    </div>
                </main>
            </div>
        </BackgroundTheme>
    );

    return (
        <BackgroundTheme>
            <div className={cn("relative min-h-screen flex flex-col pt-16 overflow-x-hidden", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col items-center pb-48 px-4 w-full flex-1 max-w-6xl mx-auto">

                    <header className="flex flex-col items-center text-center mb-12 w-full pt-10 relative">
                        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-4">
                            <span className="text-[10px] font-black tracking-[0.25em] text-zinc-500 uppercase">Team Focus</span>
                        </motion.div>

                        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-4xl md:text-5xl font-black tracking-tight mb-3 leading-none text-white">
                            Groups
                        </motion.h1>

                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.16 }} className="text-zinc-500 text-sm max-w-lg leading-relaxed">
                            Create a group, join with a code, and focus together.
                        </motion.p>
                    </header>

                    <div className="w-full max-w-4xl space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.985 }}
                                onClick={() => setShowCreateGroup(!showCreateGroup)}
                                className={cn(
                                    "p-5 rounded-[10px] border transition-all duration-300 flex items-center gap-4 group relative overflow-hidden cursor-pointer",
                                    showCreateGroup 
                                        ? "bg-white/10 border-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]" 
                                        : "bg-zinc-900 border-zinc-800/50 hover:border-zinc-700 hover:bg-white/[0.03] hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
                                )}
                            >
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
                                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 shrink-0 relative overflow-hidden", showCreateGroup ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10")}>
                                    <Plus className={cn("w-7 h-7 transition-transform duration-200 text-white relative z-10", showCreateGroup && "rotate-45")} />
                                    {/* Glass highlights for icon container */}
                                    <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/30 pointer-events-none" />
                                    <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />
                                </div>
                                <div className="text-left relative z-10">
                                    <h3 className="text-sm font-black text-white mb-0.5">Create Group</h3>
                                    <p className="text-[11px] text-zinc-500">Start a new focus group.</p>
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.985 }}
                                onClick={() => setShowJoinCodeModal(true)}
                                className="p-5 rounded-[10px] border border-zinc-800/50 bg-zinc-900 transition-all duration-300 flex items-center gap-4 group relative overflow-hidden hover:border-zinc-700 hover:bg-white/[0.03] hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] cursor-pointer"
                            >
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
                                <div className="w-12 h-12 rounded-full bg-zinc-950/70 flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200 border border-white/5 shrink-0 relative overflow-hidden">
                                    <Key className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 relative z-10" />
                                    {/* Glass highlights for icon container */}
                                    <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/30 pointer-events-none" />
                                    <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />
                                </div>
                                <div className="text-left relative z-10">
                                    <h3 className="text-sm font-black text-white mb-0.5">Join with Code</h3>
                                    <p className="text-[11px] text-zinc-500">Enter a 6-character group code.</p>
                                </div>
                            </motion.button>
                        </div>

                        <AnimatePresence>
                            {showCreateGroup && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                    <CreateGroupForm user={user} onClose={() => setShowCreateGroup(false)} privacy={privacy} setPrivacy={setPrivacy} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {activeFocusers.length > 0 && <ActiveFocusersBanner focusers={activeFocusers} />}

                        <div className="space-y-14">
                            {userGroups.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[white]" />
                                        <h2 className="text-lg font-black text-white tracking-tight">Your Groups</h2>
                                        <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/8 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            {userGroups.length} {userGroups.length === 1 ? "group" : "groups"}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {userGroups.map((group) => (
                                            <EnhancedGroupCard key={group.id} group={group} isMember={true} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {publicGroups.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <Globe className="w-5 h-5 text-zinc-600" />
                                        <h2 className="text-lg font-black text-zinc-400 tracking-tight">Explore Public Groups</h2>
                                        <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/8 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                                            {publicGroups.length} open
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {publicGroups.map((group) => (
                                            <EnhancedGroupCard key={group.id} group={group} isMember={false} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </main>

                <AnimatePresence>
                    {showJoinCodeModal && <JoinCodeModal onClose={() => setShowJoinCodeModal(false)} onJoin={handleJoinByCode} />}
                </AnimatePresence>
            </div>
        </BackgroundTheme>
    );
}

function CreateGroupForm({ user, onClose, privacy, setPrivacy }: any) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [goalType, setGoalType] = useState<GoalType>("weekly");
    const [goalHours, setGoalHours] = useState("");
    const [autoRenew, setAutoRenew] = useState(true);

    useEffect(() => {
        if (privacy === "private-invite") setPrivacy("private-code");
    }, [privacy, setPrivacy]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        const groupRef = doc(collection(db, "focusGroups"));
        const accessCode = privacy === "private-code" ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
        const inviteToken = privacy === "private-invite" ? generateInviteToken() : null;
        
        await setDoc(groupRef, {
            name, description: desc, type: "friends", hostId: user.uid, hostName: user.displayName || "Forge User",
            members: [user.uid], memberCount: 1, privacy, accessCode, inviteToken, createdAt: serverTimestamp(),
            memberStats: { [user.uid]: { role: "host", totalMinutes: 0, joinedAt: serverTimestamp() } },
            settings: {
                goalHours: parseInt(goalHours) || 0,
                goalType,
                autoRenew,
                maxMembers: 0,
            }
        });
        toast.success("Group created!");
        onClose();
    };

    return (
        <div className="p-6 bg-zinc-900 border border-white/10 rounded-[10px] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Unit Name" className="bg-zinc-950 border border-white/5 rounded-[10px] px-4 py-3 text-white outline-none" />
                <div className="flex gap-2">
                    {["public", "private-code"].map(p => (
                        <motion.button
                            key={p}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setPrivacy(p as any)}
                            className={cn(
                                "flex-1 py-3 rounded-[10px] text-[11px] font-black uppercase tracking-wider transition-all duration-200 relative overflow-hidden cursor-pointer",
                                privacy === p
                                    ? "bg-white/10 text-white"
                                    : "text-zinc-600 hover:text-zinc-400"
                            )}
                        >
                            {/* Glass highlights */}
                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 h-px border-b-[0.5px] border-white/5 pointer-events-none" />
                            
                            {p}
                        </motion.button>
                    ))}
                </div>
            </div>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" rows={2} className="w-full bg-zinc-950 border border-white/5 rounded-[10px] px-4 py-3 text-white outline-none" />
            
            <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Focus Goal</p>
                <div className="grid grid-cols-4 gap-2">
                    {(["daily", "weekly", "monthly", "custom"] as GoalType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => setGoalType(type)}
                            className={cn(
                                "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                goalType === type
                                    ? "bg-white text-black"
                                    : "bg-zinc-950 text-zinc-500 hover:text-white hover:bg-zinc-800"
                            )}
                        >
                            {type === "daily" ? "Day" : type === "weekly" ? "Week" : type === "monthly" ? "Month" : "Custom"}
                        </button>
                    ))}
                </div>
                <div className="flex gap-3">
                    <input 
                        type="number" 
                        value={goalHours} 
                        onChange={e => setGoalHours(e.target.value)} 
                        placeholder="Goal hours" 
                        className="flex-1 bg-zinc-950 border border-white/5 rounded-[10px] px-4 py-3 text-white outline-none" 
                    />
                    <button
                        onClick={() => setAutoRenew(!autoRenew)}
                        className={cn(
                            "px-4 py-3 rounded-[10px] text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                            autoRenew ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-950 text-zinc-500 border border-white/5"
                        )}
                    >
                        Auto-renew
                    </button>
                </div>
            </div>

            <div className="flex gap-3">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreate}
                    className="flex-1 py-3 bg-white text-black font-black rounded-[10px] cursor-pointer relative overflow-hidden"
                >
                    Create Group
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-[10px] cursor-pointer relative overflow-hidden"
                >
                    {/* Glass highlights */}
                    <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-px border-b-[0.5px] border-white/5 pointer-events-none" />
                    
                    Cancel
                </motion.button>
            </div>
        </div>
    );
}
