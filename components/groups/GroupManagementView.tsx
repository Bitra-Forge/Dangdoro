"use client";

import { memo } from "react";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { 
    Target, Users, Copy, Crown, Zap, UserX 
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fmtMinutes, getManagementGroupKey } from "@/lib/groups";

export const GroupManagementView = memo(function GroupManagementView({ group, user, onUpdateRole, onRemove, userRole, roleActionPendingId }: any) {
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
