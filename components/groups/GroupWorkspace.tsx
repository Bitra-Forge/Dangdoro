"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { 
    doc, onSnapshot, collection, query, orderBy, 
    updateDoc, arrayUnion, increment, serverTimestamp, 
    addDoc, deleteDoc, getDocs, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
    Users, Briefcase, ChevronRight, Play, Pause, 
    StopCircle, MoreVertical, UserPlus, LogOut, X, 
    LayoutGrid, Target, Crown, Zap, User, Lock, Copy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { 
    FocusGroup, SharedTask, ObjectiveTemplateDraft, 
    fmtMinutes, resolveLiveSessionsForGroup, toMillis, 
    getEarliestActiveStart, normalizeLiveSessions
} from "@/lib/groups";
import { fetchUserProfiles, savePartialPomodoroSession } from "@/lib/db";
import { applyGroupSessionAction } from "@/lib/group-session";

// Sub-components
import { LiveElapsedTimer } from "./LiveElapsedTimer";
import { SharedTasksPanel } from "./SharedTasksPanel";
import { ParticipantsTab } from "./ParticipantsTab";
import { InviteModal } from "./InviteModal";
import { GroupManagementView } from "./GroupManagementView";

interface GroupWorkspaceProps {
    groupId: string;
    onClose?: () => void; // For backward compatibility if needed
}

export function GroupWorkspace({ groupId }: GroupWorkspaceProps) {
    const { user } = useAuth();
    const [group, setGroup] = useState<FocusGroup | null>(null);
    const [liveSessions, setLiveSessions] = useState<any[]>([]);
    const [tasks, setTasks] = useState<SharedTask[]>([]);
    const [hydratedProfiles, setHydratedProfiles] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    
    // UI State (moved from GroupDetailModal)
    const [activeTab, setActiveTab] = useState<"workspace" | "members">("workspace");
    const [viewMode, setViewMode] = useState<"shared" | "personal">("shared");
    const [isManagingRoles, setIsManagingRoles] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [sessionActionPending, setSessionActionPending] = useState<"start" | "pause" | "stop" | null>(null);
    const [optimisticFocusing, setOptimisticFocusing] = useState<boolean | null>(null);
    const [roleActionPendingId, setRoleActionPendingId] = useState<string | null>(null);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [objectiveTemplateDraft, setObjectiveTemplateDraft] = useState<ObjectiveTemplateDraft | null>(null);

    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const timerStart = useTimerStore(s => s.start);
    const timerPause = useTimerStore(s => s.pause);
    const timerStop = useTimerStore(s => s.stop);
    const timerIsActive = useTimerStore(s => s.isActive);
    const setActiveGroupId = useTimerStore(s => s.setActiveGroupId);

    // 1. Subscribe to group data
    useEffect(() => {
        if (!groupId) return;
        const unsub = onSnapshot(doc(db, "focusGroups", groupId), (snap) => {
            if (snap.exists()) {
                setGroup({ id: snap.id, ...snap.data() } as FocusGroup);
            } else {
                setGroup(null);
            }
            setLoading(false);
        });
        return unsub;
    }, [groupId]);

    // 2. Subscribe to live sessions
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "liveSessions"), (snapshot) => {
            const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLiveSessions(normalizeLiveSessions(raw));
        });
        return unsub;
    }, []);

    // 3. Subscribe to tasks
    useEffect(() => {
        if (!groupId || !user) return;
        const q = query(collection(db, `focusGroups/${groupId}/tasks`), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SharedTask)));
        });
        return unsub;
    }, [groupId, user]);

    // 4. Hydrate member profiles
    useEffect(() => {
        if (!group) return;
        const missingUids = group.members.filter(uid => !hydratedProfiles[uid]);
        if (missingUids.length > 0) {
            fetchUserProfiles(missingUids).then(profiles => {
                const newProfiles = { ...hydratedProfiles };
                profiles.forEach((p: any) => { newProfiles[p.uid] = p; });
                setHydratedProfiles(newProfiles);
            });
        }
    }, [group, hydratedProfiles]);

    // Derived State
    const enrichedGroup = useMemo(() => {
        if (!group || !user) return null;
        const groupLiveSessions = resolveLiveSessionsForGroup(group.id, liveSessions);
        const memberDetails = group.members.map(memberId => {
            const stats = group.memberStats?.[memberId] || { role: "member", totalMinutes: 0 };
            const hydration = hydratedProfiles[memberId];
            const memberLiveSession = groupLiveSessions.find(ls => ls.userId === memberId);
            const isFocusing = !!memberLiveSession;
            const role = stats.role || (group.hostId === memberId ? "host" : "member");

            return {
                uid: memberId,
                displayName: hydration?.displayName || (memberId === user.uid ? user.displayName : "Member"),
                photoURL: hydration?.photoURL || (memberId === user.uid ? user.photoURL : null),
                ...stats,
                isFocusing,
                liveSessionStartedAt: memberLiveSession?.startedAt || null,
                role,
                isHost: group.hostId === memberId
            };
        });
        return { ...group, memberDetails };
    }, [group, user, hydratedProfiles, liveSessions]);

    const isMember = enrichedGroup?.members.includes(user?.uid || "");
    const isUserFocusing = !!enrichedGroup?.memberDetails?.some((m: any) => m.uid === user?.uid && m.isFocusing);
    const effectiveIsFocusing = optimisticFocusing ?? isUserFocusing;
    const userRole = enrichedGroup?.memberStats?.[user?.uid || ""]?.role || (enrichedGroup?.hostId === user?.uid ? "host" : "member");
    const isAdmin = userRole === "host" || userRole === "admin";
    const isOrg = enrichedGroup?.type === "organization";
    const activeFocuserCount = enrichedGroup?.memberDetails?.filter((m: any) => m.isFocusing).length || 0;
    const isActive = activeFocuserCount > 0;
    const activeStartTime = getEarliestActiveStart(enrichedGroup?.memberDetails) ?? enrichedGroup?.startTime;
    const sortedMembers = useMemo(() => {
        if (!enrichedGroup) return [];
        return [...(enrichedGroup.memberDetails || [])].sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0));
    }, [enrichedGroup]);

    // Handlers
    const handleAddTask = async (title: string, priority: string = "medium", assignedTo: string = "all", silent: boolean = false, description: string = "") => {
        if (!isAdmin || !user) return;
        await addDoc(collection(db, `focusGroups/${groupId}/tasks`), {
            title, priority, assignedTo, description, status: "todo",
            createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        if (assignedTo !== "all" && assignedTo !== user.uid) {
            await addDoc(collection(db, "notifications"), {
                type: "objective_assignment",
                toUserId: assignedTo,
                fromUserId: user.uid,
                groupId: enrichedGroup?.id,
                groupName: enrichedGroup?.name,
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
        if (!isAdmin) return;
        await deleteDoc(doc(db, `focusGroups/${groupId}/tasks`, taskId));
        toast.success("Objective deleted.");
    };

    const handleSessionAction = async (action: "start" | "pause" | "stop") => {
        if (!isMember || !user || !enrichedGroup) return;
        if (sessionActionPending) return;

        setSessionActionPending(action);
        if (action === "start") setOptimisticFocusing(true);
        if (action === "pause" || action === "stop") setOptimisticFocusing(false);
        try {
            const result = await applyGroupSessionAction({
                group: enrichedGroup,
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
                        await savePartialPomodoroSession(user.uid, elapsedMinutes, enrichedGroup.id);
                    }
                }
                timerStop();
            }

            toast.info(`Focus ${action}ed.`);
        } catch (error) {
            console.error("Failed to update group focus session:", error);
            setOptimisticFocusing(null);
            toast.error("Could not update session.");
        } finally {
            setSessionActionPending(null);
        }
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: "admin" | "member") => {
        if (userRole !== "host") return;
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
        if (!isAdmin || !enrichedGroup) return;
        if (memberId === enrichedGroup.hostId) return;
        setRoleActionPendingId(memberId);
        try {
            const newMembers = enrichedGroup.members.filter((m: string) => m !== memberId);
            const updateStats: any = { ...enrichedGroup.memberStats };
            delete updateStats[memberId];
            await updateDoc(doc(db, "focusGroups", groupId), { members: newMembers, memberStats: updateStats });
            toast.info("Member removed.");
        } finally {
            setRoleActionPendingId(null);
        }
    };

    const handleJoinGroup = async () => {
        if (!user || !enrichedGroup) return;
        
        if (enrichedGroup.privacy === "private-code") {
            toast.info("Use the join button on the main page with a code.");
            return;
        }
        if (enrichedGroup.privacy === "private-invite") {
            toast.error("Invite-only workspace.");
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
        toast.success(`Joined "${enrichedGroup.name}"!`);
    };

    const handleLeaveGroup = async () => {
        if (!user || !enrichedGroup) return;
        const newMembers = enrichedGroup.members.filter(m => m !== user.uid);
        if (newMembers.length === 0) {
            await deleteDoc(doc(db, "focusGroups", groupId));
        } else {
            const newHostId = enrichedGroup.hostId === user.uid ? newMembers[0] : enrichedGroup.hostId;
            const updateStats: any = { ...enrichedGroup.memberStats };
            delete updateStats[user.uid];
            if (enrichedGroup.hostId === user.uid && newHostId && updateStats[newHostId]) {
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
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;
    if (!enrichedGroup || !user) return <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-4"><p>Group not found</p><Link href="/groups" className="text-sm text-zinc-500 hover:text-white">Back to Groups</Link></div>;

    const totalGroupMinutes = enrichedGroup.totalMinutes || sortedMembers.reduce((acc: number, m: any) => acc + (m.totalMinutes || 0), 0);
    const adminCount = sortedMembers.filter((m: any) => m.role === "host" || m.role === "admin").length;

    return (
        <div className="flex flex-col min-h-screen bg-zinc-950/50 backdrop-blur-3xl overflow-hidden">
            {/* Top accent bar */}
            <div className={cn(
                "h-[2px] bg-gradient-to-r from-transparent to-transparent shrink-0",
                isOrg ? "via-[white]/70" : "via-indigo-400/40"
            )} />

            {/* Header */}
            <div className="p-8 border-b border-white/5 bg-gradient-to-br from-[white]/5 to-transparent">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Link href="/groups" className="p-2 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all mr-2">
                                <ChevronRight className="w-5 h-5 rotate-180" />
                            </Link>
                            <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                                {isManagingRoles ? "Unit Management" : enrichedGroup.name}
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
                                    {enrichedGroup.type}
                                </span>
                            )}
                            {enrichedGroup.privacy === "private-code" && enrichedGroup.hostId === user.uid && (
                                <div className="flex items-center gap-2 ml-2 p-1.5 bg-zinc-950/60 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Code:</span>
                                    <code className="text-sm font-black text-[white] bg-[white]/5 px-2 py-0.5 rounded-lg border border-[white]/20">{enrichedGroup.accessCode}</code>
                                    <button onClick={() => { navigator.clipboard.writeText(enrichedGroup.accessCode || ""); toast.success("Code copied"); }} className="p-1 px-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 ml-12">
                            <p className="text-zinc-500 text-sm max-w-xl line-clamp-1">{isManagingRoles ? `Configure authorization and hierarchy for ${enrichedGroup.name}` : enrichedGroup.description}</p>
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
                                                sessionActionPending ? "bg-[white]/60 text-black cursor-not-allowed" : "bg-[white] text-black hover:shadow-[0_0_20px_white]"
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
                                            {isAdmin && (enrichedGroup.privacy === "private-invite" || enrichedGroup.privacy === "public") && (
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
                                                    handleLeaveGroup();
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
                            <button onClick={handleJoinGroup} className="px-6 py-3 bg-[white] text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all">Request Access</button>
                        )}
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
                        
                        <div className="hidden lg:flex items-center gap-4">
                            <div className="h-4 w-[1px] bg-white/10 mr-2" />
                            <div className="flex -space-x-2">
                                {enrichedGroup.memberDetails?.filter((m: any) => m.isFocusing).slice(0, 8).map((m: any, i: number) => (
                                    <div key={i} className="relative group/avatar">
                                        <Avatar className={cn(
                                            "w-9 h-9 rounded-full border-2 border-zinc-950 transition-all duration-300 bg-zinc-900 z-10 scale-105",
                                            "ring-2 ring-cyan-500 ring-offset-2 ring-offset-zinc-950 hover:scale-110"
                                        )}>
                                            <AvatarImage src={m.photoURL} className="object-cover w-full h-full rounded-full" />
                                            <AvatarFallback className="text-[10px] bg-zinc-800 text-white rounded-full flex items-center justify-center">{m.displayName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-cyan-500 border-2 border-zinc-950 shadow-[0_0_8px_rgba(6,182,212,0.6)] z-20" />
                                    </div>
                                ))}
                                {activeFocuserCount > 8 && (
                                    <div className="w-9 h-9 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[10px] font-black text-zinc-400 z-0">
                                        +{activeFocuserCount - 8}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {isManagingRoles ? (
                    <div className="max-w-5xl mx-auto">
                        <button onClick={() => setIsManagingRoles(false)} className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest">
                            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Workspace
                        </button>
                        <GroupManagementView 
                            group={enrichedGroup} user={user} userRole={userRole}
                            onUpdateRole={handleUpdateMemberRole} onRemove={handleRemoveMember}
                            roleActionPendingId={roleActionPendingId}
                        />
                    </div>
                ) : isMember ? (
                    <div className="max-w-7xl mx-auto">
                        {activeTab === "workspace" ? (
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
                                            <SharedTasksPanel
                                                tasks={tasks}
                                                onAdd={handleAddTask}
                                                onUpdate={handleUpdateTask}
                                                onDelete={handleDeleteTask}
                                                isAdmin={isAdmin}
                                                groupMembers={enrichedGroup.memberDetails}
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

                                <div className="space-y-4">
                                    <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.18em]">Weekly Goal</p>
                                            <Target className="w-3.5 h-3.5 text-[white]/70" />
                                        </div>
                                        {enrichedGroup.settings?.goalHours && enrichedGroup.settings.goalHours > 0 ? (
                                            <>
                                                <p className="text-sm font-black text-white tabular-nums">
                                                    {Math.round((totalGroupMinutes / 60) * 10) / 10}h / {enrichedGroup.settings.goalHours}h
                                                </p>
                                                <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[white] to-zinc-400 transition-all duration-500"
                                                        style={{ width: `${Math.min(100, ((totalGroupMinutes / 60) / enrichedGroup.settings.goalHours) * 100)}%` }}
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
                                                    <p className="text-lg font-black text-white">{enrichedGroup.members.length}</p>
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
                                                const goalHours = enrichedGroup.settings?.goalHours || 0;
                                                const goalPct = goalHours > 0 ? Math.round((((m.totalMinutes || 0) / 60) / goalHours) * 100) : null;
                                                const isMe = m.uid === user.uid;
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
                                                                {m.isFocusing && (
                                                                    <p className="text-[10px] text-indigo-300/80 font-bold">Session: <LiveElapsedTimer startTime={m.liveSessionStartedAt} isActive={m.isFocusing} /></p>
                                                                )}
                                                            </div>
                                                            {m.isFocusing && <span className="text-[9px] font-black text-indigo-400 uppercase">Live</span>}
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
                                </div>
                            </div>
                        ) : (
                            <ParticipantsTab 
                                group={enrichedGroup} 
                                sortedMembers={sortedMembers} 
                                user={user} 
                                isAdmin={isAdmin}
                                onManageRoles={() => setIsManagingRoles(true)}
                                onInvite={() => setShowInviteModal(true)}
                                goalHours={enrichedGroup.settings?.goalHours || 0}
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-8">
                        <div className="w-24 h-24 rounded-full bg-[white]/5 flex items-center justify-center border border-[white]/10 relative">
                            <Lock className="w-10 h-10 text-[white]" />
                            <div className="absolute inset-0 rounded-full border border-[white]/20 animate-ping" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white">Unlock High-Intensity Session</h3>
                            <p className="text-zinc-600 max-w-md">Join this {enrichedGroup.type} to see active objectives, real-time presence, and collective progress.</p>
                        </div>
                        <button onClick={handleJoinGroup} className="px-10 py-5 bg-[white] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_white]">Establish Connection</button>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showInviteModal && enrichedGroup && user && (
                    <InviteModal
                        group={enrichedGroup} user={user} friends={[]} // Friends should be fetched here if needed
                        onClose={() => setShowInviteModal(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
