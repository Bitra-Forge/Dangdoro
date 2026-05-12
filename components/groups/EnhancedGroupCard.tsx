"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { 
    Users, Briefcase, Flame, Crown, 
    Shield, User, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    FocusGroup, PRIVACY_META, GroupPrivacy, 
    fmtMinutes, getEarliestActiveStart 
} from "@/lib/groups";
import Link from "next/link";

export const EnhancedGroupCard = memo(function EnhancedGroupCard({ group, isMember }: { group: FocusGroup, isMember: boolean }) {
    const isOrg = group.type === "organization";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const privacyMeta = PRIVACY_META[group.privacy as GroupPrivacy] ?? PRIVACY_META["public"];
    const PrivacyIcon = privacyMeta.icon;
    const totalMinutes: number = group.totalMinutes || group.memberDetails?.reduce((acc: number, m: any) => acc + (m.totalMinutes || 0), 0) || 0;
    const memberCount: number = group.members?.length || 0;

    const roles = useMemo(() => {
        if (!isOrg || !group.memberDetails) return null;
        const hosts = group.memberDetails.filter((m: any) => m.role === "host").length;
        const admins = group.memberDetails.filter((m: any) => m.role === "admin").length;
        const members = group.memberDetails.filter((m: any) => m.role === "member").length;
        return { hosts, admins, members };
    }, [group.memberDetails, isOrg]);

    const activeFocuserCount = (group.memberDetails?.filter((m: any) => m.isFocusing).length || 0);
    const isActive = activeFocuserCount > 0;

    return (
        <Link href={`/groups/${group.id}`}>
            <motion.div
                initial={false}
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-2xl border transition-colors duration-200 h-full",
                    settingsGlassmorphism ? "bg-zinc-900/55" : "bg-zinc-900",
                    isActive
                        ? "border-[white]/40"
                        : isMember
                        ? "border-white/10 hover:border-[white]/25"
                        : "border-white/10 hover:border-white/20"
                )}
            >
                {isOrg && (
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-[white]/40" />
                )}

                <div className="relative z-10 p-5 flex flex-col gap-4 h-full">
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

                    <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/10">
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
        </Link>
    );
}, (prev, next) => {
    return prev.group.id === next.group.id &&
           prev.group.totalMinutes === next.group.totalMinutes &&
           prev.group.settings?.goalHours === next.group.settings?.goalHours &&
           prev.group.members?.length === next.group.members?.length &&
           (prev.group.memberDetails?.filter((m: any) => m.isFocusing).length || 0) === (next.group.memberDetails?.filter((m: any) => m.isFocusing).length || 0);
});
