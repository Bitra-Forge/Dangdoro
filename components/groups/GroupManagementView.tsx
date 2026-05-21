"use client";

import { memo, useState, useEffect } from "react";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { 
    Target, Users, Copy, Crown, Zap, UserX, Calendar, RotateCcw
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMinutes, getManagementGroupKey, getGoalTypeLabel, GoalType } from "@/lib/groups";

export const GroupManagementView = memo(function GroupManagementView({ group, user, onUpdateRole, onRemove, userRole, roleActionPendingId }: any) {
    const isHost = userRole === "host";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const [goalType, setGoalType] = useState<GoalType>(group.settings?.goalType || "weekly");
    const [customDays, setCustomDays] = useState<string>("");
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleResetStats = async () => {
        setIsResetting(true);
        try {
            const resetStats: any = {};
            if (group.memberStats) {
                Object.keys(group.memberStats).forEach(key => {
                    resetStats[key] = { ...(group.memberStats as any)[key], totalMinutes: 0 };
                });
            }
            await updateDoc(doc(db, "focusGroups", group.id), {
                totalMinutes: 0,
                memberStats: resetStats,
                lastResetAt: serverTimestamp(),
            });
            toast.success("Focus progress reset successfully!");
            setShowResetConfirm(false);
        } catch (error) {
            console.error("Failed to reset stats:", error);
            toast.error("Failed to reset progress.");
        } finally {
            setIsResetting(false);
        }
    };

    useEffect(() => {
        setGoalType(group.settings?.goalType || "weekly");
        if (group.settings?.goalType === "custom" && group.settings?.customDays) {
            setCustomDays(String(group.settings.customDays));
        }
    }, [group.settings?.goalType, group.settings?.customDays]);

    const handleGoalTypeChange = async (newType: GoalType) => {
        setGoalType(newType);
        const updates: any = { "settings.goalType": newType };
        if (newType !== "custom") {
            updates["settings.customDays"] = null;
        }
        await updateDoc(doc(db, "focusGroups", group.id), updates);
        toast.success(`Goal set to ${getGoalTypeLabel(newType).toLowerCase()}`);
    };


    const handleCustomDaysChange = async (daysStr: string) => {
        setCustomDays(daysStr);
        const days = parseInt(daysStr);
        if (days > 0) {
            await updateDoc(doc(db, "focusGroups", group.id), {
                "settings.goalType": "custom",
                "settings.customDays": days,
            });
        }
    };

    const hostMembers    = group.memberDetails?.filter((m: any) => m.role === "host") ?? [];
    const adminMembers   = group.memberDetails?.filter((m: any) => m.role === "admin") ?? [];
    const regularMembers = group.memberDetails?.filter((m: any) => m.role === "member") ?? [];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-150">
            {isHost && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Unit Configuration</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Manage core parameters.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Target className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Focus Goal (Hours)</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 flex-1">
                                    <input 
                                        type="number" 
                                        value={group.settings?.goalHours || ""} 
                                        onChange={(e) => updateDoc(doc(db, "focusGroups", group.id), { "settings.goalHours": parseInt(e.target.value) || 0 })}
                                        placeholder="e.g. 100" 
                                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-[white]/40 outline-none appearance-none" 
                                    />
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => updateDoc(doc(db, "focusGroups", group.id), { "settings.goalHours": (group.settings?.goalHours || 0) + 1 })} className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                        </button>
                                        <button onClick={() => updateDoc(doc(db, "focusGroups", group.id), { "settings.goalHours": Math.max(0, (group.settings?.goalHours || 0) - 1) })} className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <span className="text-zinc-600 font-bold text-xs uppercase whitespace-nowrap">Hours</span>
                            </div>
                        </div>

                        <div className="p-5 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Users className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Unit Capacity</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 flex-1">
                                    <input 
                                        type="number" 
                                        value={group.settings?.maxMembers || ""} 
                                        onChange={(e) => updateDoc(doc(db, "focusGroups", group.id), { "settings.maxMembers": parseInt(e.target.value) || 0 })}
                                        placeholder="No Limit" 
                                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-[white]/40 outline-none appearance-none" 
                                    />
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => updateDoc(doc(db, "focusGroups", group.id), { "settings.maxMembers": (group.settings?.maxMembers || 0) + 1 })} className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                        </button>
                                        <button onClick={() => updateDoc(doc(db, "focusGroups", group.id), { "settings.maxMembers": Math.max(0, (group.settings?.maxMembers || 0) - 1) })} className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <span className="text-zinc-600 font-bold text-xs uppercase whitespace-nowrap">Members</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Calendar className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Goal Period</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {([ "daily", "weekly", "monthly", "custom" ] as GoalType[]).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => handleGoalTypeChange(type)}
                                        className={cn(
                                            "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                            goalType === type
                                                ? "bg-white text-black"
                                                : "bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800"
                                        )}
                                    >
                                        {type === "daily" ? "Day" : type === "weekly" ? "Week" : type === "monthly" ? "Month" : "Custom"}
                                    </button>
                                ))}
                            </div>
                            {goalType === "custom" && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="number"
                                            min={1}
                                            value={customDays}
                                            onChange={(e) => handleCustomDaysChange(e.target.value)}
                                            placeholder="e.g. 14"
                                            className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-[white]/40 outline-none appearance-none"
                                        />
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => handleCustomDaysChange(String(parseInt(customDays || "0") + 1))} className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                            </button>
                                            <button onClick={() => handleCustomDaysChange(String(Math.max(1, parseInt(customDays || "1") - 1)))} className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-zinc-600 font-bold text-xs uppercase whitespace-nowrap">Days</span>
                                </div>
                            )}
                            {goalType !== "custom" && (
                                <p className="text-[10px] text-zinc-600">
                                    Resets every {goalType === "daily" ? "day" : goalType === "weekly" ? "week (Sunday)" : "month (1st)"}
                                </p>
                            )}
                        </div>

                        <div className="p-5 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-4 flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <RotateCcw className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Reset Progress</span>
                                </div>
                                <p className="text-[10px] text-zinc-500">
                                    Manually archive member minutes and restart the focus goal period.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset Stats
                            </button>
                        </div>
                    </div>
                    {(group.privacy === "private-code" || group.privacy === "public") && group.accessCode && (
                        <div className="p-5 rounded-3xl bg-zinc-900/60 border border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-white mb-1">Group Code</h4>
                                <p className="text-[10px] text-zinc-600">Share to expand your unit.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <code className="text-sm font-black text-[white] tracking-[0.2em] bg-zinc-950 px-4 py-2 rounded-xl border border-[white]/30">{group.accessCode}</code>
                                <button onClick={() => { navigator.clipboard.writeText(group.accessCode || ""); toast.success("Copied!"); }} className="p-2.5 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Unit Hierarchy</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Manage Roles & Access</p>
                </div>
                <Section label="Command Unit" color="text-[white]" members={hostMembers} user={user} group={group} isHost={isHost} roleActionPendingId={roleActionPendingId} onUpdateRole={onUpdateRole} onRemove={onRemove} />
                <Section label="Officers" color="text-zinc-300" members={adminMembers} user={user} group={group} isHost={isHost} roleActionPendingId={roleActionPendingId} onUpdateRole={onUpdateRole} onRemove={onRemove} />
                <Section label="Members" color="text-zinc-500" members={regularMembers} user={user} group={group} isHost={isHost} roleActionPendingId={roleActionPendingId} onUpdateRole={onUpdateRole} onRemove={onRemove} />
            </div>

            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-md p-6 rounded-3xl border border-white/10 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200",
                        settingsGlassmorphism ? "bg-zinc-950/80 backdrop-blur-xl" : "bg-zinc-950"
                    )}>
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                                <RotateCcw className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-white">Reset Progress Stats?</h4>
                                <p className="text-xs text-zinc-500 mt-1">
                                    This will wipe the current focus minutes for all members in the group and start a new goal period. This action is irreversible.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                disabled={isResetting}
                                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResetStats}
                                disabled={isResetting}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isResetting ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : "Yes, Reset Stats"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
        <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-2xl flex items-center gap-4 group/item hover:bg-zinc-900/60 transition-all">
            <Avatar className="w-10 h-10 border-2 border-zinc-950">
                <AvatarImage src={m.photoURL} />
                <AvatarFallback>{m.displayName?.[0]}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">{m.displayName}</h4>
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
