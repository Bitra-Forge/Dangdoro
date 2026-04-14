"use client";

import { useEffect, useState, useMemo } from "react";
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
    Briefcase, UserPlus, X, MoreVertical, LayoutGrid, User
} from "lucide-react";
import { useTimerStore } from "@/lib/store";
import {
    subscribeToFriendsList
} from "@/lib/friendship";
import { fetchUserProfiles } from "@/lib/db";
import { toast } from "sonner";
import { 
    doc, setDoc, onSnapshot, deleteDoc, collection, 
    serverTimestamp, updateDoc, addDoc, arrayUnion, 
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

interface SharedTask {
    id: string;
    title: string;
    description: string;
    assignedTo?: string; // UID or "all"
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
    }>;
    memberDetails?: any[];
    startTime: any;
    status: "active" | "paused" | "idle";
    maxMembers?: number;
    privacy: "public" | "private" | "code";
    accessCode?: string;
    createdAt: any;
}

export default function GroupsPage() {
    const { user, loading: authLoading } = useAuth();
    const [friends, setFriends] = useState<any[]>([]);
    const [focusGroups, setFocusGroups] = useState<FocusGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupDesc, setNewGroupDesc] = useState("");
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [privacy, setPrivacy] = useState<"public" | "private" | "code">("private");
    const [groupType, setGroupType] = useState<GroupType>("friends");
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
    const [showSweep, setShowSweep] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const [lastActiveStatuses, setLastActiveStatuses] = useState<Record<string, string>>({});
    const setActiveGroupId = useTimerStore(s => s.setActiveGroupId);

    // Automation: Set the timer's group context when a group is selected
    useEffect(() => {
        setActiveGroupId(selectedGroupId);
        return () => setActiveGroupId(null);
    }, [selectedGroupId, setActiveGroupId]);
    const [activeModalTab, setActiveModalTab] = useState<"workspace" | "members">("workspace");

    const [hydratedProfiles, setHydratedProfiles] = useState<Record<string, any>>({});

    // Subscribe to real-time updates for groups and friends
    useEffect(() => {
        if (!user) return;

        const unsubFriends = subscribeToFriendsList(user.uid, (friendsData) => {
            setFriends(friendsData);
        });

        const unsubGroups = onSnapshot(collection(db, "focusGroups"), (snapshot) => {
            const groups: FocusGroup[] = [];
            snapshot.forEach(docSnapshot => {
                const data = docSnapshot.data();
                groups.push({
                    id: docSnapshot.id,
                    ...data
                } as FocusGroup);
            });
            setFocusGroups(groups);
            setLoading(false);
        });

        return () => {
            unsubFriends();
            unsubGroups();
        };
    }, [user?.uid]);

    // Hydrate non-friend profiles
    useEffect(() => {
        const missingUids = new Set<string>();
        focusGroups.forEach(group => {
            group.members.forEach(uid => {
                if (uid !== user?.uid && !friends.find(f => f.friendId === uid) && !hydratedProfiles[uid]) {
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

    // Resonance Effect: Trigger cinematic sweep when a group member initiates a sprint
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

    const enrichedGroups = useMemo(() => {
        return focusGroups.map(group => {
            const memberDetails: any[] = [];
            for (const memberId of group.members) {
                const friend = friends.find(f => f.friendId === memberId);
                const stats = group.memberStats?.[memberId] || { role: "member", totalMinutes: 0 };
                const hydration = hydratedProfiles[memberId];
                
                if (memberId === user?.uid) {
                    memberDetails.push({
                        uid: user.uid,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        ...stats,
                        isHost: group.hostId === user.uid
                    });
                } else if (friend?.userData) {
                    memberDetails.push({
                        ...friend.userData,
                        ...stats,
                        isHost: group.hostId === memberId
                    });
                } else if (hydration) {
                    memberDetails.push({
                        ...hydration,
                        ...stats,
                        isHost: group.hostId === memberId
                    });
                } else {
                    memberDetails.push({
                        uid: memberId,
                        displayName: "Member",
                        ...stats,
                        isHost: group.hostId === memberId
                    });
                }
            }
            return { ...group, memberDetails };
        });
    }, [focusGroups, friends, user, hydratedProfiles]);

    const handleJoinGroup = async (groupId: string, accessCode?: string) => {
        if (!user) return;
        const group = focusGroups.find(g => g.id === groupId);
        if (!group) return;

        if (group.privacy === "code" && !accessCode) {
            setShowJoinCodeModal(true);
            return;
        }

        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, {
            members: arrayUnion(user.uid),
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

            await handleJoinGroup(groupDoc.id, code.trim().toUpperCase());
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
            
            // Ensure the new host has the 'host' role in stats
            if (group.hostId === user.uid && newHostId && updateStats[newHostId]) {
                updateStats[newHostId].role = "host";
            }
            
            await updateDoc(doc(db, "focusGroups", groupId), {
                members: newMembers,
                hostId: newHostId,
                memberStats: updateStats
            });
        }
        toast.info("Left group");
        setSelectedGroupId(null);
    };

    if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-[#C9B037]/20 border-t-[#C9B037] rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <BackgroundTheme />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Workspace Locked" description="Sign in to create focus groups and join organizations." />
            </main>
        </div>
    );

    const userGroups = enrichedGroups.filter(g => g.members.includes(user.uid));
    const publicGroups = enrichedGroups.filter(g => !g.members.includes(user.uid) && g.privacy === "public");

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
                            <motion.button initial={false} whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} onClick={() => setShowCreateGroup(!showCreateGroup)} className={cn("p-6 rounded-3xl border border-white/10 hover:bg-zinc-800/60 hover:border-[#C9B037]/30 transition-all duration-150 flex items-center gap-6 group", settingsGlassmorphism ? "bg-zinc-900/40" : "bg-zinc-900")}>
                                <div className="w-14 h-14 rounded-2xl bg-[#C9B037]/10 flex items-center justify-center group-hover:bg-[#C9B037]/20 transition-all duration-150">
                                    <Plus className="w-8 h-8 text-[#C9B037]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-white">Initialize New Workspace</h3>
                                    <p className="text-[10px] text-zinc-500">Create a social group or organization.</p>
                                </div>
                            </motion.button>

                            <motion.button initial={false} whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.99 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} onClick={() => setShowJoinCodeModal(true)} className={cn("p-6 rounded-3xl border border-white/10 hover:bg-zinc-800/60 hover:border-[#C9B037]/30 transition-all duration-150 flex items-center gap-6 group", settingsGlassmorphism ? "bg-zinc-900/40" : "bg-zinc-900")}>
                                <div className="w-14 h-14 rounded-2xl bg-zinc-950/50 flex items-center justify-center group-hover:bg-zinc-800 transition-all duration-150 border border-white/5">
                                    <Key className="w-6 h-6 text-zinc-500 group-hover:text-[#C9B037]" />
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
                                        onClose={() => setShowCreateGroup(false)} 
                                        groupType={groupType} 
                                        setGroupType={setGroupType}
                                        privacy={privacy}
                                        setPrivacy={setPrivacy}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-12">
                            {userGroups.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[#C9B037]" />
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

function CreateGroupForm({ user, onClose, groupType, setGroupType, privacy, setPrivacy }: any) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const handleCreate = async () => {
        if (!name.trim()) return;
        const groupRef = doc(collection(db, "focusGroups"));
        const accessCode = privacy === "code" ? Math.random().toString(36).substring(2, 8).toUpperCase() : undefined;
        
        await setDoc(groupRef, {
            name,
            description: desc,
            type: groupType,
            hostId: user.uid,
            hostName: user.displayName || "Forge User",
            members: [user.uid],
            memberStats: {
                [user.uid]: {
                    role: "host",
                    totalMinutes: 0,
                    joinedAt: serverTimestamp()
                }
            },
            privacy,
            accessCode,
            status: "idle",
            createdAt: serverTimestamp()
        });
        toast.success("Workspace Established!");
        onClose();
    };

    return (
        <div className={cn("p-8 rounded-3xl border border-white/10 space-y-6", settingsGlassmorphism ? "bg-zinc-900/60" : "bg-zinc-900 shadow-2xl")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace Name" className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#C9B037]/40 outline-none transition-all" />
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Objectives & Description" className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#C9B037]/40 outline-none transition-all h-32 resize-none" />
                </div>
                <div className="space-y-6">
                    <div>
                        <p className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-3">Archetype</p>
                        <div className="flex gap-3">
                            <button onClick={() => setGroupType("friends")} className={cn("flex-1 p-4 rounded-2xl border transition-all text-left", groupType === "friends" ? "bg-[#C9B037]/10 border-[#C9B037]/40" : "bg-zinc-950 border-white/5")}>
                                <UserPlus className={cn("w-5 h-5 mb-2", groupType === "friends" ? "text-[#C9B037]" : "text-zinc-500")} />
                                <p className={cn("text-xs font-bold", groupType === "friends" ? "text-white" : "text-zinc-500")}>Friends</p>
                            </button>
                            <button onClick={() => setGroupType("organization")} className={cn("flex-1 p-4 rounded-2xl border transition-all text-left", groupType === "organization" ? "bg-[#C9B037]/10 border-[#C9B037]/40" : "bg-zinc-950 border-white/5")}>
                                <Briefcase className={cn("w-5 h-5 mb-2", groupType === "organization" ? "text-[#C9B037]" : "text-zinc-500")} />
                                <p className={cn("text-xs font-bold", groupType === "organization" ? "text-white" : "text-zinc-500")}>Org</p>
                            </button>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase text-zinc-600 tracking-widest mb-3">Privacy</p>
                        <div className="flex gap-2">
                            {["private", "public", "code"].map(p => (
                                <button key={p} onClick={() => setPrivacy(p as any)} className={cn("flex-1 py-3 rounded-xl border transition-all capitalize text-[10px] font-black", privacy === p ? "bg-white/10 border-white/20 text-white" : "bg-zinc-950 border-white/5 text-zinc-600")}>{p}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex gap-4 pt-4">
                <button onClick={handleCreate} className="flex-1 bg-[#C9B037] text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(201,176,55,0.2)]">Establish Workspace</button>
                <button onClick={onClose} className="px-8 bg-zinc-800 text-white font-bold rounded-2xl">Cancel</button>
            </div>
        </div>
    );
}

function EnhancedGroupCard({ group, onClick, isMember }: any) {
    const isActive = group.status === "active";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    
    return (
        <motion.div 
            initial={false}
            whileHover={{ scale: 1.02, y: -4 }} 
            whileTap={{ scale: 0.98 }} 
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            onClick={onClick} 
            className={cn(
                "relative group p-6 rounded-3xl border border-white/10 hover:border-white/20 cursor-pointer overflow-hidden", 
                settingsGlassmorphism ? "bg-zinc-900/40" : "bg-zinc-900 shadow-xl",
                isActive && (settingsGlassmorphism ? "border-[#C9B037]/40 shadow-[0_0_50px_rgba(201,176,55,0.08)] bg-zinc-900/60" : "border-[#C9B037]/60 bg-zinc-900")
            )}
        >
            {isActive && (
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C9B037]/5 via-transparent to-transparent opacity-50" />
                    <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "200%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-[#C9B037]/10 to-transparent skew-x-12"
                    />
                </div>
            )}
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-lg font-bold text-white truncate group-hover:text-[#C9B037] transition-all duration-150">{group.name}</h4>
                            {group.type === "organization" && <Briefcase className="w-3 h-3 text-[#C9B037]" />}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Host: {group.hostName}</p>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all", isActive ? "bg-[#C9B037]/20 text-[#C9B037] border border-[#C9B037]/30" : "bg-zinc-800 text-zinc-500")}>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#C9B037] animate-pulse shadow-[0_0_8px_#C9B037]" />}
                        {isActive ? "High Intensity" : "Idle"}
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                        {group.memberDetails?.slice(0, 5).map((m: any, i: number) => (
                            <div key={i} className="relative">
                                <Avatar className="w-8 h-8 border-2 border-zinc-900">
                                    <AvatarImage src={m.photoURL} />
                                    <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                {isActive && m.lastActive && (
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C9B037] border-2 border-zinc-950 shadow-[0_0_10px_#C9B037]" />
                                )}
                            </div>
                        ))}
                        {group.members.length > 5 && (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                +{group.members.length - 5}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[#C9B037]/50 group-hover:text-[#C9B037] transition-all duration-150">
                        <span className="text-[10px] font-black uppercase tracking-widest">Join Session</span>
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function GroupDetailModal({ groupId, onClose, user, groups, activeTab, setActiveTab, onJoin, onLeave }: any) {
    const group = groups.find((g: any) => g.id === groupId);
    if (!group) return null;
    const isMember = group.members.includes(user.uid);
    const memberStats = group.memberStats?.[user.uid];
    const userRole = memberStats?.role || "member";
    const isAdmin = userRole === "host" || userRole === "admin";
    const isActive = group.status === "active";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const [tasks, setTasks] = useState<SharedTask[]>([]);
    const [viewMode, setViewMode] = useState<"shared" | "personal">("shared");
    const [isManagingRoles, setIsManagingRoles] = useState(false);

    useEffect(() => {
        if (!isMember) return;
        const q = query(collection(db, `focusGroups/${groupId}/tasks`), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snap) => {
            setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedTask)));
        });
    }, [groupId, isMember]);

    const handleAddTask = async (title: string, priority: string = "medium", assignedTo: string = "all") => {
        if (!isAdmin) return;
        await addDoc(collection(db, `focusGroups/${groupId}/tasks`), {
            title,
            priority,
            assignedTo,
            status: "todo",
            createdBy: user.uid,
            createdAt: serverTimestamp()
        });
    };

    const handleUpdateTask = async (taskId: string, updates: any) => {
        await updateDoc(doc(db, `focusGroups/${groupId}/tasks`, taskId), updates);
    };

    const handleToggleStatus = async (groupId: string) => {
        if (!isAdmin) return;
        const newStatus = isActive ? "idle" : "active";
        await updateDoc(doc(db, "focusGroups", groupId), { 
            status: newStatus,
            startTime: newStatus === "active" ? serverTimestamp() : null
        });
        toast.info(newStatus === "active" ? "Sprint initiated!" : "Workspace paused.");
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: "admin" | "member") => {
        if (userRole !== "host") {
            toast.error("Only the host can modify officer roles.");
            return;
        }
        await updateDoc(doc(db, "focusGroups", groupId), {
            [`memberStats.${memberId}.role`]: newRole
        });
        toast.success(`Updated role to ${newRole}`);
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!isAdmin) return;
        if (memberId === group.hostId) return; // Cannot remove host
        
        const newMembers = group.members.filter((m: string) => m !== memberId);
        const updateStats: any = { ...group.memberStats };
        delete updateStats[memberId];

        await updateDoc(doc(db, "focusGroups", groupId), {
            members: newMembers,
            memberStats: updateStats
        });
        toast.info("Member extracted from unit.");
    };

    const sortedMembers = useMemo(() => {
        return [...(group.memberDetails || [])].sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));
    }, [group.memberDetails]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl" onClick={onClose} />
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="relative w-full max-w-5xl bg-zinc-900/50 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                {/* Header Section */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-br from-[#C9B037]/5 to-transparent">
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
                                    <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", group.type === "organization" ? "bg-[#C9B037]/10 text-[#C9B037] border-[#C9B037]/20" : "bg-blue-500/10 text-blue-400 border-blue-400/20")}>
                                        {group.type}
                                    </span>
                                )}
                                {group.privacy === "code" && group.hostId === user.uid && (
                                    <div className="flex items-center gap-2 ml-4 p-1.5 bg-zinc-950/60 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Access Code:</span>
                                        <code className="text-sm font-black text-[#C9B037] bg-[#C9B037]/5 px-2 py-0.5 rounded-lg border border-[#C9B037]/20">{group.accessCode}</code>
                                        <button onClick={() => {
                                            navigator.clipboard.writeText(group.accessCode || "");
                                            toast.success("Code copied to clipboard");
                                        }} className="p-1 px-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
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
                                    {isAdmin && (
                                        <button onClick={() => handleToggleStatus(group.id)} className={cn("px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2", isActive ? "bg-zinc-800 text-zinc-400" : "bg-[#C9B037] text-black hover:shadow-[0_0_20px_#C9B03744]")}>
                                            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            {isActive ? "Pause Sprint" : "Initiate Sprint"}
                                        </button>
                                    )}
                                    <button onClick={() => onLeave(group.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"><LogOut className="w-4 h-4" /></button>
                                </>
                            ) : (
                                <button onClick={() => onJoin(group.id)} className="px-6 py-3 bg-[#C9B037] text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all">Request Access</button>
                            )}
                            <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {!isManagingRoles && isMember && (
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1 p-1 bg-zinc-950/40 rounded-xl w-fit border border-white/5">
                                {[
                                    { id: "workspace", icon: LayoutGrid, label: "Workspace" },
                                    { id: "members", icon: Users, label: "Participants" }
                                ].map(t => (
                                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black transition-all", activeTab === t.id ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300")}>
                                        <t.icon className="w-4 h-4" />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    {group.memberDetails?.map((m: any, i: number) => (
                                        <div key={i} className="relative group/avatar">
                                            <Avatar className={cn("w-7 h-7 border-2 border-zinc-900", m.lastActive && "ring-2 ring-[#C9B037]/40 ring-offset-2 ring-offset-zinc-900")}>
                                                <AvatarImage src={m.photoURL} />
                                                <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-[9px] text-white rounded opacity-0 group-hover/avatar:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 capitalize">
                                                {m.displayName} ({m.role})
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-zinc-950/20">
                    {isManagingRoles ? (
                        <GroupManagementView 
                            group={group} 
                            user={user} 
                            userRole={userRole} 
                            onUpdateRole={handleUpdateMemberRole} 
                            onRemove={handleRemoveMember} 
                        />
                    ) : isMember ? (
                        activeTab === "workspace" ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Task Management */}
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
                                                isAdmin={isAdmin} 
                                                groupMembers={group.memberDetails}
                                            />
                                        ) : (
                                            <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                                                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600"><User className="w-8 h-8" /></div>
                                                <p className="text-sm text-zinc-500 font-medium">Personal tasks are synced from your <Link href="/tasks" className="text-[#C9B037] hover:underline">Task Dashboard</Link>.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Sidebar Stats */}
                                <div className="space-y-6">
                                    <div className="p-6 bg-zinc-950/40 border border-[#C9B037]/10 rounded-3xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9B037]/5 blur-3xl -mr-10 -mt-10" />
                                        <p className="text-[9px] font-black uppercase text-zinc-600 tracking-[0.2em] mb-4">Unit Contributors</p>
                                        
                                        <div className="space-y-4 mb-8">
                                            {sortedMembers.slice(0, 5).map((m: any, i: number) => (
                                                <div key={m.uid} className="flex items-center gap-3">
                                                    <span className="text-[9px] font-black text-zinc-600 w-3">#{i + 1}</span>
                                                    <Avatar className="w-6 h-6 border border-white/10">
                                                        <AvatarImage src={m.photoURL} />
                                                        <AvatarFallback className="text-[8px]">{m.displayName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-bold text-zinc-300 flex-1 truncate">{m.displayName}</span>
                                                    <span className="text-[10px] font-black text-white">{m.totalMinutes}m</span>
                                                </div>
                                            ))}
                                            {sortedMembers.length === 0 && (
                                                <p className="text-[10px] text-zinc-600 italic">No activity recorded yet.</p>
                                            )}
                                        </div>

                                        <Link href={`/leaderboard?tab=groups&groupId=${groupId}`} className="flex items-center justify-between w-full p-4 bg-white/5 rounded-2xl group/link hover:bg-white/10 transition-all border border-white/5">
                                            <span className="text-[9px] font-black uppercase text-white tracking-[0.2em]">Group Leaderboard</span>
                                            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover/link:translate-x-1 transition-all" />
                                        </Link>
                                    </div>

                                    {/* Role Identity */}
                                    <div className="p-5 bg-zinc-900/40 border border-white/5 rounded-2xl flex items-center gap-4">
                                        <div className="p-2.5 bg-zinc-800 rounded-xl">
                                            {userRole === "host" ? <Shield className="w-5 h-5 text-red-400" /> : userRole === "admin" ? <Zap className="w-5 h-5 text-yellow-400" /> : <User className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white capitalize">{userRole} Status</p>
                                            <p className="text-[9px] text-zinc-500 font-medium">{userRole === "host" ? "Full access & deletion" : userRole === "admin" ? "Can manage objectives" : "Visual collaborator"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {group.memberDetails?.map((m: any) => (
                                        <div key={m.uid} className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center gap-4 relative">
                                            {m.lastActive && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#C9B037] shadow-[0_0_8px_#C9B037]" />}
                                            <Avatar className="w-12 h-12 border border-white/10">
                                                <AvatarImage src={m.photoURL} />
                                                <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-white truncate">{m.displayName}</h4>
                                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1">
                                                    {m.role === "host" && <Shield className="w-2.5 h-2.5" />}
                                                    {m.role}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-white">{m.totalMinutes}m</p>
                                                <p className="text-[9px] text-zinc-500">Contribution</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {isAdmin && (
                                    <button onClick={() => setIsManagingRoles(true)} className="w-full py-4 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                                        <UserPlus className="w-4 h-4 text-[#C9B037]" /> Manage Roles & Invites
                                    </button>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center gap-8 animate-in fade-in zoom-in slide-in-from-bottom-5">
                            <div className="w-24 h-24 rounded-full bg-[#C9B037]/5 flex items-center justify-center border border-[#C9B037]/10 relative">
                                <Lock className="w-10 h-10 text-[#C9B037]" />
                                <div className="absolute inset-0 rounded-full border border-[#C9B037]/20 animate-ping" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white">Unlock High-Intensity Session</h3>
                                <p className="text-zinc-600 max-w-md">Join this {group.type} to see active objectives, real-time presence, and collective progress.</p>
                            </div>
                            <button onClick={() => onJoin(group.id)} className="px-10 py-5 bg-[#C9B037] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(201,176,55,0.2)]">Establish Connection</button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function GroupManagementView({ group, onUpdateRole, onRemove, userRole }: any) {
    const isHost = userRole === "host";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-150">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Unit Hierarchy</h3>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Manage Roles & Access</p>
                </div>
            </div>

            <div className={cn("rounded-3xl border border-white/10 overflow-hidden", settingsGlassmorphism ? "bg-zinc-950/40" : "bg-zinc-950")}>
                <div className="grid grid-cols-1 gap-4">
                    {group.memberDetails?.map((m: any) => (
                        <div key={m.uid} className="p-6 rounded-3xl bg-zinc-900/40 border border-white/5 flex items-center gap-6 group/item hover:bg-zinc-900/60 transition-all">
                            <Avatar className="w-14 h-14 border-2 border-zinc-950">
                                <AvatarImage src={m.photoURL} />
                                <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-base font-bold text-white">{m.displayName}</h4>
                                    {m.uid === user.uid && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/10 rounded text-zinc-400">You</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", m.role === "host" ? "text-red-400" : m.role === "admin" ? "text-yellow-400" : "text-blue-400")}>
                                        {m.role}
                                    </span>
                                    <div className="w-1 h-1 rounded-full bg-zinc-800" />
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{m.totalMinutes}m contributed</span>
                                </div>
                            </div>

                            {m.uid !== group.hostId && m.uid !== user.uid && (
                                <div className="flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-all">
                                    {isHost && (
                                        <button 
                                            onClick={() => onUpdateRole(m.uid, m.role === "admin" ? "member" : "admin")}
                                            className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", m.role === "admin" ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20")}
                                        >
                                            {m.role === "admin" ? "Demote" : "Promote"}
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => {
                                            if (confirm(`Are you sure you want to remove ${m.displayName}?`)) {
                                                onRemove(m.uid);
                                            }
                                        }}
                                        className="p-2.5 bg-red-400/10 text-red-400 rounded-xl hover:bg-red-400/20 transition-all"
                                    >
                                        <UserX className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-8 rounded-3xl bg-[#C9B037]/5 border border-[#C9B037]/20 flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-white mb-1">Invite New Collaborators</h4>
                    <p className="text-[10px] text-[#C9B037]/70">Share the workspace entry code to expand your unit.</p>
                </div>
                <div className="flex items-center gap-3">
                    <code className="text-xl font-black text-[#C9B037] tracking-[0.2em] bg-zinc-950 px-4 py-2 rounded-xl border border-[#C9B037]/30">
                        {group.accessCode}
                    </code>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(group.accessCode || "");
                            toast.success("Code copied to clipboard");
                        }}
                        className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

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
                    <div className="w-16 h-16 bg-[#C9B037]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#C9B037]/20">
                        <Key className="w-8 h-8 text-[#C9B037]" />
                    </div>
                    <h3 className="text-2xl font-black text-white">Join Workspace</h3>
                    <p className="text-zinc-500 text-sm mt-2">Enter the unique 6-digit access code provided by the host.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <input 
                        autoFocus 
                        maxLength={6}
                        value={code} 
                        onChange={(e) => setCode(e.target.value.toUpperCase())} 
                        placeholder="ENTER CODE" 
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-6 py-5 text-center text-2xl font-black tracking-[0.5em] text-[#C9B037] outline-none focus:border-[#C9B037]/50 transition-all placeholder:text-zinc-800" 
                    />
                    <div className="flex gap-4">
                        <button type="submit" disabled={loading || code.length < 6} className="flex-1 bg-[#C9B037] text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_30px_rgba(201,176,55,0.2)] disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
                            {loading ? "Searching..." : "Connect to Unit"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

function SprintResonance() {
    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] pointer-events-none overflow-hidden"
        >
            <motion.div 
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-[#C9B037]/20 to-transparent blur-3xl"
            />
            <motion.div 
                initial={{ top: "-5%" }}
                animate={{ top: "105%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-1 bg-[#C9B037]/40 shadow-[0_0_20px_#C9B037]"
            />
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
            >
                <div className="px-12 py-6 bg-zinc-950/80 backdrop-blur-3xl border border-[#C9B037]/30 rounded-[2rem] shadow-[0_0_100px_rgba(201,176,55,0.2)]">
                    <h2 className="text-4xl font-black text-[#C9B037] tracking-[0.3em] uppercase animate-pulse">Sprint Established</h2>
                </div>
            </motion.div>
        </motion.div>
    );
}

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
                <button onClick={() => setOpenAdd(true)} className="w-full p-5 flex items-center gap-3 bg-[#C9B037]/5 border border-[#C9B037]/10 rounded-2xl group hover:bg-[#C9B037]/10 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-[#C9B037]/20 flex items-center justify-center text-[#C9B037] group-hover:scale-110 transition-all"><Plus className="w-5 h-5" /></div>
                    <span className="text-sm font-bold text-[#C9B037]/80">Construct New Objective...</span>
                </button>
            )}

            {openAdd && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-zinc-900 border border-[#C9B037]/30 rounded-3xl space-y-4">
                    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title..." className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[#C9B037]/40 transition-all" />
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
                        <button onClick={handleAdd} className="flex-1 py-3 bg-[#C9B037] text-black font-black rounded-xl text-xs">Establish Objective</button>
                        <button onClick={() => setOpenAdd(false)} className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl text-xs">Cancel</button>
                    </div>
                </motion.div>
            )}

            <div className="space-y-2">
                {tasks.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 group hover:border-white/10 transition-all">
                        <button onClick={() => onUpdate(task.id, { status: task.status === "done" ? "todo" : "done" })} className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", task.status === "done" ? "bg-[#C9B037] border-[#C9B037] text-black" : "border-white/10 text-transparent hover:border-white/30")}>
                            <Check className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h4 className={cn("text-sm font-bold transition-all truncate", task.status === "done" ? "text-zinc-600 line-through" : "text-white")}>{task.title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest", task.priority === "high" ? "text-red-400" : task.priority === "medium" ? "text-yellow-400" : "text-blue-400")}>{task.priority} Priority</span>
                                <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Assigned to: {task.assignedTo === "all" ? "The Collective" : "Direct Unit"}</span>
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
