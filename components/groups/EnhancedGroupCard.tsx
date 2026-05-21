"use client";

import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Briefcase, Flame,
    Shield, User, ChevronRight, X, Clock,
    Globe, Key, Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { FocusGroup, PRIVACY_META, GroupPrivacy, getGoalTypeLabel } from "@/lib/groups";
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
                    className="relative group cursor-pointer"
                >
                    {/* Card Container */}
                    <div className="relative overflow-hidden rounded-[5px] bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-blue-500/30 hover:border-blue-500/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] h-full">
                        
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] -mr-8 -mt-8 group-hover:bg-blue-500/20 transition-all duration-500" />
                        
                        {/* Content */}
                        <div className="relative p-5">
                            {/* Group Name */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className={cn(
                                    "shrink-0",
                                    group.privacy === "public" ? "text-emerald-400" :
                                    group.privacy === "private-code" ? "text-amber-400" :
                                    group.privacy === "private-invite" ? "text-violet-400" :
                                    "text-zinc-500"
                                )}>
                                    <PrivacyIcon className="w-4 h-4" />
                                </span>
                                <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300 truncate">
                                    {group.name}
                                </h4>
                            </div>
                            
                            {/* Stats Grid */}
                            <div className="mb-5">
                                {/* Members */}
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-zinc-500">
                                        <Users className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Members</span>
                                    </div>
                                    <span className="text-lg font-bold text-white">{memberCount}</span>
                                </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-4">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: group.settings?.goalHours && group.settings.goalHours > 0 ? `${Math.min(100, (totalMinutes / 60) / group.settings.goalHours * 100)}%` : "0%" }}
                                    transition={{ duration: 0.8 }}
                                    className="h-full bg-gradient-to-r from-blue-500/60 to-blue-500 rounded-full"
                                />
                            </div>
                            
                            {/* Bottom Action */}
                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                                    Focus Group
                                </span>
                                <div className="flex items-center gap-2 text-zinc-600 group-hover:text-blue-400 transition-all duration-300">
                                    <span className="text-xs font-bold">View</span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
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
                                <p className="text-zinc-500 text-sm">you&apos;ll be added as a member and can start focusing with the group.</p>
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
