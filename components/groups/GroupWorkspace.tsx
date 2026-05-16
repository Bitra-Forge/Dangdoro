"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
    doc, onSnapshot, collection, query, orderBy,
    updateDoc, arrayUnion, increment, serverTimestamp,
    addDoc, deleteDoc, getDocs, where, writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
    Users, Briefcase, ChevronRight, Play, Pause, 
    StopCircle, MoreVertical, UserPlus, LogOut, X, 
    LayoutGrid, Target, Crown, Zap, User, Copy, Trash2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { 
    FocusGroup, SharedTask, ObjectiveTemplateDraft, 
    fmtMinutes, resolveLiveSessionsForGroup, toMillis, 
    getEarliestActiveStart, normalizeLiveSessions,
    getGoalTypeLabel, getGoalPeriodBounds, isPeriodExpired,
    computeNextPeriodStart, GoalType
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
    const router = useRouter();
    const [group, setGroup] = useState<FocusGroup | null>(null);
    const [liveSessions, setLiveSessions] = useState<any[]>([]);
    const [tasks, setTasks] = useState<SharedTask[]>([]);
    const [hydratedProfiles, setHydratedProfiles] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    
    // UI State (moved from GroupDetailModal)
    const [activeTab, setActiveTab] = useState<"workspace" | "members">("workspace");

    const [isManagingRoles, setIsManagingRoles] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [sessionActionPending, setSessionActionPending] = useState<"start" | "pause" | "stop" | null>(null);
    const [optimisticFocusing, setOptimisticFocusing] = useState<boolean | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [roleActionPendingId, setRoleActionPendingId] = useState<string | null>(null);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
                setHydratedProfiles(prev => {
                    const next = { ...prev };
                    profiles.forEach((p: any) => { next[p.uid] = p; });
                    return next;
                });
            });
        }
    }, [group, hydratedProfiles]);

    // 5. Handle non-members (automatic redirect)
    useEffect(() => {
        if (!loading && group && user && !group.members.includes(user.uid)) {
            router.push("/groups");
        }
    }, [group, user, loading, router]);

    // 6. Auto-renewal check
    useEffect(() => {
        if (!group || !user) return;
        const goalType = group.settings?.goalType as GoalType | undefined;
        const autoRenew = group.settings?.autoRenew ?? true;
        const customDays = group.settings?.customDays;
        if (!autoRenew) return;
        if (isPeriodExpired(goalType, customDays)) {
            updateDoc(doc(db, "focusGroups", group.id), {
                "settings.goalType": goalType || "weekly",
            }).catch(() => {});
        }
    }, [group, user]);

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
        const willBePaused = action === "pause" ? !isPaused : false;
        if (action === "start") {
            setOptimisticFocusing(true);
            setIsPaused(false);
        }
        if (action === "pause") {
            setIsPaused(willBePaused);
        }
        if (action === "stop") {
            setOptimisticFocusing(false);
            setIsPaused(false);
        }
        try {
            const result = await applyGroupSessionAction({
                group: enrichedGroup,
                userId: user.uid,
                action
            });

            setActiveGroupId(result.shouldSetActiveGroupId);

            if (result.shouldStartTimer && !timerIsActive) timerStart();
            if (result.shouldPauseTimer) timerPause();
            if (action === "pause" && !willBePaused && !timerIsActive) timerStart();
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

            toast.info(action === "pause" ? (willBePaused ? `Focus paused.` : `Focus resumed.`) : `Focus ${action}ed.`);
        } catch (error) {
            console.error("Failed to update group focus session:", error);
            setOptimisticFocusing(null);
            setIsPaused(false);
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

    const handleDeleteGroup = async () => {
        if (!user || !enrichedGroup || userRole !== "host") return;
        
        const deleteDocsInBatches = async (docs: Array<{ ref: any }>) => {
            let batch = writeBatch(db);
            let opCount = 0;
            for (const d of docs) {
                batch.delete(d.ref);
                opCount += 1;
                if (opCount >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    opCount = 0;
                }
            }
            if (opCount > 0) await batch.commit();
        };

        try {
            const tasksSnap = await getDocs(collection(db, `focusGroups/${groupId}/tasks`));
            await deleteDocsInBatches(tasksSnap.docs);

            const liveQ = query(collection(db, "liveSessions"), where("groupId", "==", groupId));
            const liveSnap = await getDocs(liveQ);
            await deleteDocsInBatches(liveSnap.docs);

            await deleteDoc(doc(db, "focusGroups", groupId));
            toast.success("Group deleted.");
            router.push("/groups");
        } catch (error) {
            console.error("Failed to delete group:", error);
            toast.error("Failed to delete group.");
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;
    if (!enrichedGroup || !user) return <div className="min-h-screen flex flex-col items-center justify-center text-white gap-4"><p>Group not found</p><Link href="/groups" className="text-sm text-zinc-500 hover:text-white">Back to Groups</Link></div>;
    if (!group.members.includes(user.uid)) {
        return null;
    }

    const totalGroupMinutes = enrichedGroup.totalMinutes || sortedMembers.reduce((acc: number, m: any) => acc + (m.totalMinutes || 0), 0);
    const adminCount = sortedMembers.filter((m: any) => m.role === "host" || m.role === "admin").length;

    return (
        <div className="flex flex-col min-h-screen overflow-hidden">
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
                                                "px-7 py-2.5 rounded-[10px] font-black text-xs transition-all duration-300 ease-out flex items-center gap-2 relative overflow-hidden group/btn",
                                                sessionActionPending
                                                    ? "bg-white/60 text-black/50 cursor-not-allowed"
                                                    : "bg-white text-black hover:shadow-[0_8px_30px_rgba(255,255,255,0.4)] cursor-pointer"
                                            )}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                            <Play className="w-4 h-4 relative z-10 fill-current" />
                                            <span className="relative z-10">{sessionActionPending === "start" ? "Starting..." : "Start Focus"}</span>
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                disabled={!!sessionActionPending}
                                                onClick={() => handleSessionAction("pause")}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-[10px] font-black text-xs transition-all duration-300 flex items-center gap-2 group/btn relative overflow-hidden border-none",
                                                    isPaused
                                                        ? "bg-amber-500/5 text-amber-400 cursor-default"
                                                        : sessionActionPending 
                                                            ? "bg-amber-500/20 text-amber-200/50 cursor-not-allowed" 
                                                            : "bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 hover:shadow-[0_8px_25px_rgba(245,158,11,0.15)] cursor-pointer"
                                                )}
                                            >
                                                {/* Curved Glass Edge Lights for Pause */}
                                                <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-amber-500/30 pointer-events-none z-10" />
                                                <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-amber-500/10 pointer-events-none z-10" />
                                                
                                                {/* Internal Soft Amber Glow */}
                                                <div className="absolute top-0 inset-x-0 h-[8px] bg-gradient-to-b from-amber-500/10 to-transparent z-10" />
                                                
                                                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                                {isPaused ? <Play className="w-4 h-4 relative z-10 fill-current" /> : <Pause className="w-4 h-4 relative z-10" />}
                                                <span className="relative z-10">{isPaused ? "Resume" : sessionActionPending === "pause" ? "Pausing..." : "Pause"}</span>
                                            </button>
                                            <button
                                                disabled={!!sessionActionPending}
                                                onClick={() => handleSessionAction("stop")}
                                                className={cn(
                                                    "px-6 py-2.5 rounded-[10px] font-black text-xs transition-all duration-300 flex items-center gap-2 group/btn relative overflow-hidden border-none",
                                                    sessionActionPending 
                                                        ? "bg-red-500/20 text-red-200/50 cursor-not-allowed" 
                                                        : "bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:shadow-[0_8px_25px_rgba(239,68,68,0.15)] cursor-pointer"
                                                )}
                                            >
                                                {/* Curved Glass Edge Lights for Stop */}
                                                <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-red-500/30 pointer-events-none z-10" />
                                                <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-red-500/10 pointer-events-none z-10" />
                                                
                                                {/* Internal Soft Red Glow */}
                                                <div className="absolute top-0 inset-x-0 h-[8px] bg-gradient-to-b from-red-500/10 to-transparent z-10" />
                                                
                                                <div className="absolute inset-0 bg-gradient-to-tr from-red-500/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                                <StopCircle className="w-4 h-4 relative z-10" />
                                                <span className="relative z-10">{sessionActionPending === "stop" ? "Stopping..." : "Stop"}</span>
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                                        title="More actions"
                                        className={cn(
                                            "h-10 w-10 rounded-[10px] transition-all inline-flex items-center justify-center relative overflow-hidden group/opt cursor-pointer",
                                            isHeaderMenuOpen 
                                                ? "bg-white/20 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]" 
                                                : "bg-white/5 text-zinc-300 hover:bg-white/10"
                                        )}
                                    >
                                        {/* Glass highlights */}
                                        <div className={cn(
                                            "absolute inset-0 rounded-[10px] border-t-[0.5px] pointer-events-none transition-colors duration-300",
                                            isHeaderMenuOpen ? "border-white/40" : "border-white/20"
                                        )} />
                                        <div className="absolute inset-x-0 bottom-0 h-px border-b-[0.5px] border-white/5 pointer-events-none" />
                                        
                                        <MoreVertical className={cn(
                                            "w-4 h-4 transition-colors duration-300",
                                            isHeaderMenuOpen ? "text-white scale-110" : "group-hover/opt:text-white"
                                        )} />
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
                                            {userRole === "host" && (
                                                <button
                                                    onClick={() => {
                                                        setIsHeaderMenuOpen(false);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="w-full px-3 py-2 rounded-lg text-left text-[11px] font-bold text-red-400 hover:bg-red-500/10 inline-flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete group
                                                </button>
                                            )}
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
                        <div className="flex gap-1 p-1 bg-zinc-950/40 rounded-xl w-fit border border-white/5 relative">
                            {[
                                { id: "workspace", icon: LayoutGrid, label: "Overview" },
                                { id: "members",   icon: Users, label: "Participants" }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id as any)}
                                    className={cn(
                                        "relative px-6 py-2 rounded-lg text-xs font-black transition-colors duration-200",
                                        activeTab === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {activeTab === t.id && (
                                        <motion.div
                                            layoutId={`group-workspace-tabs-indicator-${groupId}`}
                                            className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                                            transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-2">
                                        <t.icon className="w-4 h-4" />
                                        <span>{t.label}</span>
                                    </span>
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
                ) : (
                    <div className="max-w-7xl mx-auto">
                        {activeTab === "workspace" ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">
                                                <Target className="w-4 h-4" /> Focus Objectives
                                            </h3>
                                        </div>

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
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {isAdmin && (
                                        <div className="p-4 bg-zinc-900 border border-white/10 rounded-[10px] space-y-4">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.18em]">Management</p>
                                                <Crown className="w-3.5 h-3.5 text-amber-500/70" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button 
                                                    onClick={() => setIsManagingRoles(true)}
                                                    className="px-3 py-2.5 rounded-[10px] border-none bg-white/5 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group/mgt"
                                                >
                                                    {/* Curved Glass Edge Lights */}
                                                    <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                                    <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                                    
                                                    {/* Internal Depth Glow */}
                                                    <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                                                    
                                                    <span className="relative z-10 text-zinc-400 group-hover/mgt:text-white transition-colors">Settings</span>
                                                </button>
                                                <button 
                                                    onClick={() => setShowInviteModal(true)}
                                                    className="px-3 py-2.5 rounded-[10px] border-none bg-white text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all text-black flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden group/mgt"
                                                >
                                                    {/* Curved Light Effect for solid button */}
                                                    <div className="absolute inset-x-0 top-0 h-[1px] bg-white/60 z-10" />
                                                    <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/40 pointer-events-none z-10" />
                                                    <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-black/[0.04] z-10" />
                                                    <span className="relative z-10">Invite</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-zinc-900/40 border border-white/10 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.18em]">{getGoalTypeLabel(enrichedGroup.settings?.goalType)} Goal</p>
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
                                                {enrichedGroup.settings?.autoRenew && (
                                                    <p className="text-[9px] text-zinc-600 flex items-center gap-1">
                                                        <RefreshCw className="w-2.5 h-2.5" /> Auto-renews {getGoalTypeLabel(enrichedGroup.settings.goalType).toLowerCase()}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-[11px] text-zinc-500">No {getGoalTypeLabel(enrichedGroup.settings?.goalType).toLowerCase()} goal set yet.</p>
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
                                goalType={enrichedGroup.settings?.goalType || "weekly"}
                            />
                         )}
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

            <AnimatePresence>
                {showDeleteConfirm && enrichedGroup && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 rounded-[10px] p-8 max-w-sm w-full shadow-2xl space-y-6"
                        >
                            <div className="space-y-2 text-center">
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-lg font-black text-white">Delete Group?</h3>
                                <p className="text-zinc-500 text-xs">This action is permanent and will remove all tasks and member data for <span className="text-white font-bold">{enrichedGroup.name}</span>.</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleDeleteGroup}
                                    className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-[10px] text-xs uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                    Delete Forever
                                </button>
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black rounded-[10px] text-xs uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
