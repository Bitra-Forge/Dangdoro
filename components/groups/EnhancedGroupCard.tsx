"use client";

import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Briefcase, Flame,
    Shield, User, ChevronRight, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { FocusGroup, PRIVACY_META, GroupPrivacy } from "@/lib/groups";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { doc, updateDoc, arrayUnion, increment, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type MemberDetail = {
    role?: "host" | "admin" | "member";
    totalMinutes?: number;
    isFocusing?: boolean;
};

export const EnhancedGroupCard = memo(function EnhancedGroupCard({ group, isMember }: { group: FocusGroup, isMember: boolean }) {
    const { user } = useAuth();
    const router = useRouter();
    const [joining, setJoining] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const isOrg = group.type === "organization";
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);
    const privacyMeta = PRIVACY_META[group.privacy as GroupPrivacy] ?? PRIVACY_META["public"];
    const PrivacyIcon = privacyMeta.icon;
    const memberDetails = group.memberDetails as MemberDetail[] | undefined;
    const totalMinutes: number = group.totalMinutes || memberDetails?.reduce((acc, m) => acc + (m.totalMinutes || 0), 0) || 0;
    const memberCount: number = group.members?.length || 0;

    const roles = useMemo(() => {
        if (!isOrg || !memberDetails) return null;
        const hosts = memberDetails.filter(m => m.role === "host").length;
        const admins = memberDetails.filter(m => m.role === "admin").length;
        const members = memberDetails.filter(m => m.role === "member").length;
        return { hosts, admins, members };
    }, [memberDetails, isOrg]);

    const activeFocuserCount = (memberDetails?.filter(m => m.isFocusing).length || 0);
    const isActive = activeFocuserCount > 0;

    const executeJoin = async () => {
        if (!user || joining) return;

        if (group.privacy === "private-code") {
            toast.info("Use the join button on the main page with a code.");
            return;
        }
        if (group.privacy === "private-invite") {
            toast.error("Invite-only workspace.");
            return;
        }

        setJoining(true);
        try {
            const groupRef = doc(db, "focusGroups", group.id);
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
            router.push(`/groups/${group.id}`);
        } catch (error) {
            console.error("Failed to join group:", error);
            toast.error("Failed to join group");
        } finally {
            setJoining(false);
            setShowConfirm(false);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isMember) {
            router.push(`/groups/${group.id}`);
        } else {
            e.preventDefault();
            setShowConfirm(true);
        }
    };

    const handleJoinClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowConfirm(true);
    };

    return (
        <>
            <Link href={`/groups/${group.id}`} onClick={handleClick}>
                <motion.div
                    initial={false}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={cn(
                        "relative group cursor-pointer overflow-hidden rounded-[10px] border-[0.5px] transition-all duration-300 h-full",
                        settingsGlassmorphism ? "bg-zinc-900/55" : "bg-zinc-900",
                        "hover:shadow-[inset_0_0_12px_rgba(34,197,94,0.05)]",
                        isActive
                            ? "border-white/10"
                            : isMember
                            ? "border-white/5 hover:border-white/10"
                            : "border-white/5 hover:border-white/10"
                    )}
                >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
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
                                    <span className="text-[white]">{Math.min(100, Math.round((totalMinutes / 60) / group.settings.goalHours * 100))}% Complete</span>
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
                                <span className="text-[10px] text-zinc-500 font-bold tracking-wide">
                                    {activeFocuserCount > 0 ? (
                                        <span className="text-cyan-400/80 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                            {activeFocuserCount} {activeFocuserCount === 1 ? "active" : "active"}
                                        </span>
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
                                {isMember ? (
                                    <>Open<ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" /></>
                                ) : (
                                    <button
                                        onClick={handleJoinClick}
                                        disabled={joining}
                                        className="flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {joining ? "Joining..." : "Join"}
                                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </Link>

            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
                        onClick={() => setShowConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="bg-zinc-900 border border-white/10 rounded-[15px] p-8 max-w-sm w-full shadow-2xl space-y-6 relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="space-y-2 text-center">
                                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white">Join {group.name}?</h3>
                                <p className="text-zinc-500 text-sm">you'll be added as a member and can start focusing with the group.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={executeJoin}
                                    disabled={joining}
                                    className="w-full py-3.5 bg-white hover:bg-zinc-100 text-black font-black rounded-[10px] text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {joining ? "Joining..." : "Confirm Join"}
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="w-full py-3.5 bg-zinc-800/50 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 font-black rounded-[10px] text-xs uppercase tracking-widest transition-all cursor-pointer relative overflow-hidden"
                                >
                                    {/* Glass highlights */}
                                    <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none" />
                                    <div className="absolute inset-x-0 bottom-0 h-px border-b-[0.5px] border-white/5 pointer-events-none" />
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}, (prev, next) => {
    return prev.group.id === next.group.id &&
           prev.group.totalMinutes === next.group.totalMinutes &&
           prev.group.settings?.goalHours === next.group.settings?.goalHours &&
           prev.group.members?.length === next.group.members?.length &&
           (prev.group.memberDetails as MemberDetail[] | undefined)?.filter(m => m.isFocusing).length === (next.group.memberDetails as MemberDetail[] | undefined)?.filter(m => m.isFocusing).length;
});
