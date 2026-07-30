"use client";

import { memo, useState, useEffect, useMemo } from "react";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { 
    Target, Copy, Crown, Zap, UserX, RotateCcw, Tag, AlignLeft, Clock, ChevronLeft, MoreHorizontal, Plus,
    HelpCircle
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMinutes, getManagementGroupKey, computeNextResetAt, toMillis } from "@/lib/groups";
import { useTour, type TourStep } from "@/lib/use-tour";

export const GroupManagementView = memo(function GroupManagementView({ 
    group, 
    user, 
    onUpdateRole, 
    onRemove, 
    userRole, 
    roleActionPendingId,
    onClose,
    onInvite
}: any) {
    const isHost = userRole === "host";
    const isAdmin = userRole === "admin";
    const isHostOrAdmin = isHost || isAdmin;

    const tourSteps: TourStep[] = [
        {
            popover: {
                title: "Welcome to Settings",
                description: "This is where you customize your group's details, weekly goals, auto-resets, and membership roles.",
            },
        },
        {
            element: "#btn-settings-back",
            popover: {
                title: "Back to Workspace",
                description: "Click here to exit settings and return to the main group workspace at any time.",
                side: "bottom",
                align: "center",
            },
        },
        {
            element: "#btn-settings-save",
            popover: {
                title: "Save Changes",
                description: "Apply any configuration edits you've made to the group.",
                side: "bottom",
                align: "center",
            },
        },
        {
            element: "#settings-about",
            popover: {
                title: "About the Group",
                description: "Update the group's name and general description here.",
                side: "bottom",
                align: "center",
            },
        },
        {
            element: "#settings-goal-config",
            popover: {
                title: "Goals & Resets",
                description: "Configure target weekly hours or perform manual resets on member progress.",
                side: "top",
                align: "center",
            },
        },
        {
            element: "#settings-auto-reset",
            popover: {
                title: "Automatic Resets",
                description: "Schedule automated progress resets (e.g. daily or weekly) to automatically start a new goal cycle.",
                side: "top",
                align: "center",
            },
        },
        {
            element: "#settings-members",
            popover: {
                title: "Members & Roles",
                description: "Manage roles, adjust permissions, or remove members from the group.",
                side: "top",
                align: "center",
            },
        },
    ];

    const { resetTour, startTour } = useTour({
        pageName: "group-settings",
        steps: tourSteps,
        disabled: !isHostOrAdmin
    });

    const handleRestartTour = () => {
        resetTour();
        startTour();
    };
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const showTourButton = useTimerStore((s) => s.showTourButton);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Draft states for Unit Configuration
    const [draftName, setDraftName] = useState(group.name || "");
    const [draftDescription, setDraftDescription] = useState(group.description || "");
    const [draftGoalHours, setDraftGoalHours] = useState(String(group.settings?.goalHours ?? ""));
    const [draftAutoResetEnabled, setDraftAutoResetEnabled] = useState(!!group.settings?.autoResetEnabled);
    const [draftAutoResetPeriod, setDraftAutoResetPeriod] = useState<string>(group.settings?.autoResetPeriod || "week");
    const [draftCustomDaysValue, setDraftCustomDaysValue] = useState<number | "">(group.settings?.customDaysValue ?? 7);
    const [isSaving, setIsSaving] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<{ uid: string; displayName: string } | null>(null);

    // Estimate the next reset date dynamically for real-time preview
    const previewNextResetDate = useMemo(() => {
        if (!draftAutoResetEnabled) return null;
        
        const wasEnabled = group.settings?.autoResetEnabled;
        const periodChanged = group.settings?.autoResetPeriod !== draftAutoResetPeriod;
        const customDaysChanged = group.settings?.customDaysValue !== draftCustomDaysValue;

        if (wasEnabled && !periodChanged && !customDaysChanged && group.settings?.nextResetAt) {
            return new Date(toMillis(group.settings.nextResetAt) || Date.now());
        }

        return computeNextResetAt(
            draftAutoResetPeriod,
            draftCustomDaysValue === "" ? 1 : draftCustomDaysValue
        );
    }, [
        draftAutoResetEnabled,
        draftAutoResetPeriod,
        draftCustomDaysValue,
        group.settings?.autoResetEnabled,
        group.settings?.autoResetPeriod,
        group.settings?.customDaysValue,
        group.settings?.nextResetAt
    ]);

    // Sync draft states when group updates from Firestore
    useEffect(() => {
        setDraftName(group.name || "");
        setDraftDescription(group.description || "");
        setDraftGoalHours(String(group.settings?.goalHours ?? ""));
        setDraftAutoResetEnabled(!!group.settings?.autoResetEnabled);
        setDraftAutoResetPeriod(group.settings?.autoResetPeriod || "week");
        setDraftCustomDaysValue(group.settings?.customDaysValue ?? 7);
    }, [
        group.name, 
        group.description, 
        group.settings?.goalHours,
        group.settings?.autoResetEnabled,
        group.settings?.autoResetPeriod,
        group.settings?.customDaysValue
    ]);

    const hasChanges = 
        draftName.trim() !== (group.name || "").trim() ||
        draftDescription.trim() !== (group.description || "").trim() ||
        draftGoalHours !== String(group.settings?.goalHours ?? "") ||
        draftAutoResetEnabled !== !!group.settings?.autoResetEnabled ||
        draftAutoResetPeriod !== (group.settings?.autoResetPeriod || "week") ||
        draftCustomDaysValue !== (group.settings?.customDaysValue ?? 7);

    const handleSave = async () => {
        if (!hasChanges || isSaving) return;
        setIsSaving(true);
        try {
            const updates: any = {
                name: draftName.trim(),
                description: draftDescription.trim(),
                "settings.goalHours": parseInt(draftGoalHours) || 0,
                "settings.autoResetEnabled": draftAutoResetEnabled,
                "settings.autoResetPeriod": draftAutoResetPeriod,
                "settings.customDaysValue": draftCustomDaysValue === "" ? 1 : draftCustomDaysValue,
            };

            if (draftAutoResetEnabled) {
                const wasEnabled = group.settings?.autoResetEnabled;
                const periodChanged = group.settings?.autoResetPeriod !== draftAutoResetPeriod;
                const customDaysChanged = group.settings?.customDaysValue !== draftCustomDaysValue;

                if (!wasEnabled || periodChanged || customDaysChanged || !group.settings?.nextResetAt) {
                    const nextResetDate = computeNextResetAt(
                        draftAutoResetPeriod,
                        draftCustomDaysValue === "" ? 1 : draftCustomDaysValue
                    );
                    updates["settings.nextResetAt"] = nextResetDate;
                }
            } else {
                updates["settings.nextResetAt"] = null;
            }

            await updateDoc(doc(db, "focusGroups", group.id), updates);
            toast.success("Group configuration saved!");
        } catch (error) {
            console.error("Failed to save configuration:", error);
            toast.error("Failed to save configuration.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        }
    };

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

    const hostMembers    = group.memberDetails?.filter((m: any) => m.role === "host") ?? [];
    const adminMembers   = group.memberDetails?.filter((m: any) => m.role === "admin") ?? [];
    const regularMembers = group.memberDetails?.filter((m: any) => m.role === "member") ?? [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-150 max-w-4xl mx-auto">
            {/* Top Header bar matching Mockup */}
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <button
                    id="btn-settings-back"
                    onClick={onClose}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to workspace
                </button>
                
                <button
                    id="btn-settings-save"
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                        hasChanges
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/10"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                    )}
                >
                    {isSaving ? "Saving..." : "Save changes"}
                </button>
            </div>

            {/* Page Titles */}
            <div className="space-y-1">
                <h3 className="text-2xl font-bold text-white">Settings</h3>
                <p className="text-sm text-zinc-500">Customize your group's details, goals, and membership.</p>
            </div>

            {isHostOrAdmin && (
                <div className="space-y-6">
                    {/* Basic Information Card */}
                    <div id="settings-about" className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6">
                        <div>
                            <h4 className="text-base font-bold text-white">About the group</h4>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Group Name</label>
                            <input 
                                type="text" 
                                value={draftName} 
                                onChange={(e) => setDraftName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Group Name" 
                                className="w-full bg-zinc-900/55 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-[white]/40 outline-none" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Description</label>
                            <textarea 
                                value={draftDescription} 
                                onChange={(e) => setDraftDescription(e.target.value)}
                                placeholder="Enter a brief description for this group..." 
                                rows={3}
                                className="w-full bg-zinc-900/55 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-[white]/40 outline-none resize-none scrollbar-none" 
                            />
                        </div>
                    </div>

                    {/* Focus Goal & Reset Progress Grid */}
                    <div id="settings-goal-config" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6 flex flex-col justify-between">
                            <div className="space-y-2">
                                <h4 className="text-base font-bold text-white">Weekly goal</h4>
                                <p className="text-xs text-zinc-500">The number of hours group members aim to focus each week.</p>
                            </div>
                            <div className="space-y-2 pt-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Hours per week</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                                        <input 
                                            type="number" 
                                            value={draftGoalHours} 
                                            onChange={(e) => setDraftGoalHours(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="e.g. 10" 
                                            className="w-full bg-zinc-900/55 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-[white]/40 outline-none appearance-none" 
                                        />
                                        <div className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => setDraftGoalHours(prev => String(Math.max(0, (parseInt(prev) || 0) + 1)))} 
                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                            </button>
                                            <button 
                                                onClick={() => setDraftGoalHours(prev => String(Math.max(0, (parseInt(prev) || 0) - 1)))} 
                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-zinc-500 font-bold text-xs uppercase">hrs</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6 flex flex-col justify-between">
                            <div className="space-y-2">
                                <h4 className="text-base font-bold text-white">Reset current progress</h4>
                                <p className="text-xs text-zinc-500">Clear everyone's current focus minutes for this goal period.</p>
                            </div>
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className="w-full py-3 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset progress
                            </button>
                        </div>
                    </div>

                    {/* Auto Reset Goal */}
                    <div id="settings-auto-reset" className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-2">
                                <h4 className="text-base font-bold text-white">Automatic resets</h4>
                                <p className="text-xs text-zinc-500">
                                    Automatically clear member progress and restart the goal period at regular intervals.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={draftAutoResetEnabled} 
                                    onChange={(e) => setDraftAutoResetEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 border border-white/5" />
                            </label>
                        </div>

                        {draftAutoResetEnabled && (
                            <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in duration-200">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reset frequency</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { value: "1day", label: "1 Day" },
                                            { value: "week", label: "1 Week" },
                                            { value: "month", label: "1 Month" },
                                            { value: "custom-days", label: "Custom" },
                                        ].map((period) => (
                                            <button
                                                key={period.value}
                                                type="button"
                                                onClick={() => setDraftAutoResetPeriod(period.value)}
                                                className={cn(
                                                    "py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative overflow-hidden border",
                                                    draftAutoResetPeriod === period.value
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                        : "bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/10 hover:text-white"
                                                )}
                                            >
                                                {period.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {draftAutoResetPeriod === "custom-days" && (
                                    <div className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-2xl border border-white/5 w-fit animate-in slide-in-from-top-2 duration-150">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Days:</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={draftCustomDaysValue}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") {
                                                    setDraftCustomDaysValue("");
                                                } else {
                                                    setDraftCustomDaysValue(Math.max(1, parseInt(val) || 1));
                                                }
                                            }}
                                            onKeyDown={handleKeyDown}
                                            className="w-20 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:border-[white]/40 outline-none"
                                        />
                                    </div>
                                )}

                                {previewNextResetDate && (
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <span>Next Reset:</span>
                                        <span className="text-white">
                                            {previewNextResetDate.toLocaleString(undefined, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Redesigned Hierarchy Table */}
            <div id="settings-members" className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h4 className="text-base font-bold text-white">Members & roles</h4>
                        <p className="text-xs text-zinc-500">See who is in the group and manage roles.</p>
                    </div>
                    {isHostOrAdmin && (
                        <button 
                            onClick={onInvite}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Add Member
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                <th className="pb-4 font-bold">Name</th>
                                <th className="pb-4 font-bold">Role</th>
                                <th className="pb-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {group.memberDetails?.map((m: any) => {
                                const isMe = m.uid === user.uid;
                                const isGroupHostUser = m.uid === group.hostId;
                                
                                return (
                                    <tr key={m.uid} className="group/row hover:bg-white/[0.01] transition-all">
                                        <td className="py-4 flex items-center gap-3">
                                            <Avatar className="w-9 h-9 border border-white/5 rounded-xl shrink-0">
                                                <AvatarImage src={m.photoURL} />
                                                <AvatarFallback className="text-xs bg-zinc-900 text-white rounded-xl flex items-center justify-center">{m.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[180px]">{m.displayName}</span>
                                                    {isMe && <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-white/10 rounded text-zinc-400">You</span>}
                                                </div>
                                                {m.email && <span className="text-[10px] text-zinc-500 block truncate max-w-[120px] sm:max-w-[180px]">{m.email}</span>}
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            {isGroupHostUser || !isHostOrAdmin || isMe ? (
                                                <span className="text-xs font-bold text-zinc-400 capitalize">{m.role}</span>
                                            ) : (
                                                <select
                                                    value={m.role}
                                                    disabled={roleActionPendingId === m.uid}
                                                    onChange={(e) => onUpdateRole(m.uid, e.target.value as any)}
                                                    className="bg-zinc-900 border border-white/5 rounded-xl px-2 py-1.5 text-xs text-white focus:border-white/20 outline-none cursor-pointer"
                                                >
                                                    <option value="member">Member</option>
                                                    <option value="admin">Admin</option>
                                                    {isHost && <option value="host">Host</option>}
                                                </select>
                                            )}
                                        </td>
                                        <td className="py-4 text-right">
                                            {!isGroupHostUser && !isMe && isHostOrAdmin && (
                                                <button
                                                    onClick={() => setMemberToRemove({ uid: m.uid, displayName: m.displayName })}
                                                    disabled={roleActionPendingId === m.uid}
                                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                                    title="Remove member"
                                                >
                                                    <UserX className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reset Stats Confirm Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-md p-6 rounded-3xl border border-white/10 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200",
                        settingsGlassmorphism ? "bg-zinc-950/80 backdrop-blur-xl" : "bg-zinc-950"
                    )}>
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-red-700/10 flex items-center justify-center border border-red-700/25 text-red-400">
                                <RotateCcw className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-white">Reset everyone's progress?</h4>
                                <p className="text-xs text-zinc-500 mt-1">
                                    This will clear the current focus minutes for everyone in this group and start a fresh goal period. This cannot be undone.
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
                                className="flex-1 py-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-700/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isResetting ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : "Yes, reset progress"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Member Confirm Modal */}
            {memberToRemove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-md p-6 rounded-3xl border border-white/10 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200",
                        settingsGlassmorphism ? "bg-zinc-950/80 backdrop-blur-xl" : "bg-zinc-950"
                    )}>
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-red-700/10 flex items-center justify-center border border-red-700/25 text-red-400">
                                <UserX className="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-white">Remove member?</h4>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Are you sure you want to remove <span className="text-white font-bold">{memberToRemove.displayName}</span> from this group? This person will no longer be able to see tasks or join focus sessions.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMemberToRemove(null)}
                                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (memberToRemove) {
                                        await onRemove(memberToRemove.uid);
                                        setMemberToRemove(null);
                                    }
                                }}
                                className="flex-1 py-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-700/20"
                            >
                                Yes, remove member
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Help/Tour Button */}
            {showTourButton && isHostOrAdmin && (
                <div className="fixed bottom-8 md:bottom-6 left-4 z-50">
                    <button
                        onClick={handleRestartTour}
                        className="h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all backdrop-blur-md shadow-2xl flex items-center justify-center cursor-pointer"
                        title="Restart Settings Tour"
                    >
                        <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
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
