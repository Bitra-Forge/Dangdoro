"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, ChevronDown, Zap, Globe, Key, Mail, Sparkles, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface FocusGroup {
  id: string;
  name: string;
  description: string;
  type: "friends" | "organization";
  hostId: string;
  hostName: string;
  members: string[];
  privacy: "public" | "private-code" | "private-invite";
  totalMinutes?: number;
  settings?: { goalHours?: number };
  memberStats?: Record<string, {
    role: "host" | "admin" | "member";
    totalMinutes: number;
    joinedAt: any;
    lastActive?: any;
    isFocusing?: boolean;
    sessionStartedAt?: any;
    displayName?: string;
    photoURL?: string;
  }>;
}

const PRIVACY_ICONS: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  "public": { icon: Globe, color: "text-emerald-400", label: "Public" },
  "private-code": { icon: Key, color: "text-zinc-300", label: "Code" },
  "private-invite": { icon: Mail, color: "text-violet-400", label: "Invite Only" },
};

function fmtMinutes(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function GroupFocusSelector() {
  const { user } = useAuth();
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const setActiveGroupId = useTimerStore((s) => s.setActiveGroupId);
  const timerIsActive = useTimerStore((s) => s.isActive);

  const [groups, setGroups] = useState<FocusGroup[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFocusingCount, setActiveFocusingCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const q = query(
      collection(db, "focusGroups"),
      where("members", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FocusGroup[];
      const sorted = fetched.sort((a, b) => {
        const aMins = a.totalMinutes ?? 0;
        const bMins = b.totalMinutes ?? 0;
        if (bMins !== aMins) return bMins - aMins;

        const aLastActive = a.memberStats?.[user.uid]?.lastActive;
        const bLastActive = b.memberStats?.[user.uid]?.lastActive;
        const toMillis = (ts: any): number => {
          if (!ts) return 0;
          if (typeof ts.toMillis === "function") return ts.toMillis();
          if (typeof ts.seconds === "number") return ts.seconds * 1000;
          return 0;
        };
        const bTime = toMillis(bLastActive);
        const aTime = toMillis(aLastActive);
        return bTime - aTime;
      });
      setGroups(sorted);
    });

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!activeGroupId || !user || user.isAnonymous) {
      setActiveFocusingCount(0);
      return;
    }

    const q = query(
      collection(db, "liveSessions"),
      where("groupId", "==", activeGroupId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const liveCount = snap.docs.filter((d) => {
        const data = d.data();
        const hb = data.lastHeartbeat;
        const heartbeat = hb?.toMillis?.() ?? (hb?.seconds ?? 0) * 1000;
        return now - heartbeat <= 3 * 60 * 1000;
      }).length;
      setActiveFocusingCount(liveCount);
    });

    return unsub;
  }, [activeGroupId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedGroup = groups.find((g) => g.id === activeGroupId);

  const handleSelect = useCallback((groupId: string) => {
    if (timerIsActive && activeGroupId && activeGroupId !== groupId) {
      setActiveGroupId(null);
    }
    setActiveGroupId(groupId === activeGroupId ? null : groupId);
    setIsOpen(false);
  }, [timerIsActive, activeGroupId, setActiveGroupId]);

  if (groups.length === 0) return null;

  return (
    <div ref={dropdownRef} className="relative group/focus-selector">
      {/* Ambient Glow for Active Focus Context */}
      {activeGroupId && (
        <div className="absolute -inset-1.5 bg-gradient-to-r from-sky-500/20 to-blue-500/20 rounded-[22px] blur-xl opacity-60 group-hover/focus-selector:opacity-85 transition-all duration-700 pointer-events-none animate-pulse-slow" />
      )}

      {/* Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-500 backdrop-blur-2xl overflow-hidden",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          activeGroupId
            ? "bg-zinc-950/60 border-sky-500/35 text-sky-100 shadow-[0_8px_32px_rgba(56,189,248,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "bg-zinc-950/30 border-white/[0.06] text-zinc-300 hover:bg-zinc-950/60 hover:border-white/15"
        )}
      >
        {/* Shiny Hover Animation Effect */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover/focus-selector:animate-shine pointer-events-none" />

        <div className="relative">
          <Users className={cn(
            "w-4 h-4 transition-colors duration-300",
            activeGroupId ? "text-sky-400" : "text-zinc-400"
          )} />
          {activeFocusingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-2 h-2 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
        </div>

        <span className="text-[11px] font-black uppercase tracking-widest max-w-[140px] truncate">
          {selectedGroup ? selectedGroup.name : "Focus Solo"}
        </span>

        {activeFocusingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 shadow-[0_0_8px_rgba(52,211,153,0.15)] flex items-center justify-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-400 tabular-nums">{activeFocusingCount}</span>
          </span>
        )}

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="opacity-55 group-hover/focus-selector:opacity-100 transition-opacity duration-300"
        >
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </motion.div>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(2px)" }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
                mass: 0.8
              }}
              className="absolute top-full left-0 mt-3 w-[360px] z-50 overflow-visible"
            >
              {/* Glassmorphic container */}
              <div className="relative bg-zinc-950/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden">
                {/* Accent gradient line at top */}
                <div className={cn(
                  "absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent transition-all duration-500",
                  activeGroupId ? "via-sky-400/60" : "via-white/20"
                )} />

                {/* Header */}
                <div className="px-6 py-4.5 border-b border-white/[0.05] flex items-center justify-between bg-zinc-950/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400/70 animate-pulse" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-100 bg-clip-text text-transparent">
                      Focus Context
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.06] text-[9px] font-black text-zinc-500 tabular-nums">
                    {groups.length} group{groups.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Options List */}
                <div className="p-3 max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent flex flex-col gap-2">
                  {/* Solo Option */}
                  <motion.button
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                      mass: 0.8,
                      delay: 0.02
                    }}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => handleSelect("")}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group/item border text-left cursor-pointer",
                      !activeGroupId
                        ? "bg-white/[0.06] border-white/10 text-white shadow-[0_4px_20px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "bg-transparent border-transparent text-zinc-400 hover:bg-white/[0.03] hover:border-white/[0.06] hover:text-zinc-200"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 shrink-0",
                      !activeGroupId
                        ? "bg-white text-zinc-950 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.25)]"
                        : "bg-zinc-900/60 border-white/[0.06] text-zinc-500 group-hover/item:bg-zinc-800/80 group-hover/item:border-white/10 group-hover/item:text-zinc-300"
                    )}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black uppercase tracking-wider">Focus Solo</p>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Independent session</p>
                    </div>
                    {!activeGroupId && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                      />
                    )}
                  </motion.button>

                  {/* Section Label */}
                  {groups.length > 0 && (
                    <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                      <div className="h-[1px] flex-1 bg-white/[0.04]" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Groups</span>
                      <div className="h-[1px] flex-1 bg-white/[0.04]" />
                    </div>
                  )}

                  {/* Group Options */}
                  {groups.map((group, index) => {
                    const stats = group.memberStats ?? {};
                    const focusingMembers = Object.values(stats).filter((m: any) => m.isFocusing);
                    const isSelected = group.id === activeGroupId;
                    const goalHours = group.settings?.goalHours ?? 0;
                    const totalMins = group.totalMinutes ?? 0;
                    const progress = goalHours > 0 ? Math.min(100, (totalMins / (goalHours * 60)) * 100) : 0;

                    const focusingAvatars = focusingMembers.slice(0, 4).map((m: any) => ({
                      name: m.displayName ?? "Member",
                      photo: m.photoURL,
                    }));

                    const pMeta = PRIVACY_ICONS[group.privacy] ?? PRIVACY_ICONS["public"];
                    const PIcon = pMeta.icon;

                    return (
                      <motion.button
                        key={group.id}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                          mass: 0.8,
                          delay: 0.04 + index * 0.03
                        }}
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => handleSelect(group.id)}
                        className={cn(
                          "w-full flex flex-col gap-3.5 p-4 rounded-2xl transition-all duration-300 group/item border text-left cursor-pointer relative overflow-hidden",
                          isSelected
                            ? "bg-gradient-to-br from-sky-950/40 to-indigo-950/20 border-sky-500/30 text-sky-100 shadow-[0_8px_30px_rgba(56,189,248,0.08),inset_0_1px_1px_rgba(255,255,255,0.05)]"
                            : "bg-transparent border-transparent text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.08] hover:text-zinc-100"
                        )}
                      >
                        {/* Selection Accent Bar */}
                        {isSelected && (
                          <motion.div
                            layoutId="active-group-accent"
                            className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b from-sky-400 to-indigo-500 shadow-[0_0_10px_rgba(56,189,248,0.8)]"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}

                        <div className="w-full flex items-center gap-4">
                          {/* Group Icon */}
                          <div className="relative shrink-0">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300",
                              isSelected
                                ? "bg-sky-500/20 border-sky-400/30 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                                : "bg-zinc-900/60 border-white/[0.06] text-zinc-500 group-hover/item:bg-zinc-800/80 group-hover/item:border-white/10 group-hover/item:text-zinc-300"
                            )}>
                              <Users className="w-4 h-4" />
                            </div>
                            {focusingMembers.length > 0 && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1"
                              >
                                <div className="w-3 h-3 rounded-full bg-emerald-400 ring-[2px] ring-zinc-950 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                              </motion.div>
                            )}
                          </div>

                          {/* Group Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <p className="text-xs font-black uppercase tracking-wider truncate">{group.name}</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                                {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                              </span>
                              {focusingMembers.length > 0 && (
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.1)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_#34d399]" />
                                  {focusingMembers.length} Focusing
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Selected indicator */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] shrink-0"
                            />
                          )}
                        </div>

                        {/* Progress bar & avatars bottom section */}
                        {(goalHours > 0 || focusingAvatars.length > 0) && (
                          <div className="w-full pl-14 flex flex-col gap-2.5">
                            {/* Goal Progress bar */}
                            {goalHours > 0 && (
                              <div className="flex items-center gap-3">
                                <div className="relative flex-1 h-[4px] bg-white/5 rounded-full overflow-hidden">
                                  {/* Glow Layer */}
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.1 + index * 0.04 }}
                                    className={cn(
                                      "absolute top-0 bottom-0 left-0 rounded-full blur-[2px] opacity-70",
                                      progress >= 100 ? "bg-emerald-400" : "bg-sky-400"
                                    )}
                                  />
                                  {/* Core Liquid Bar */}
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.1 + index * 0.04 }}
                                    className={cn(
                                      "absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r transition-all duration-500",
                                      progress >= 100
                                        ? "from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                        : "from-sky-400 to-indigo-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                                    )}
                                  />
                                </div>
                                <span className="text-[9px] font-black text-zinc-500 tabular-nums shrink-0 uppercase">
                                  {fmtMinutes(totalMins)} / {goalHours}H
                                </span>
                              </div>
                            )}

                            {/* Focusing member avatars */}
                            {focusingAvatars.length > 0 && (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Active:</span>
                                <div className="flex items-center -space-x-2">
                                  {focusingAvatars.map((a, i) => {
                                    const photoUrl = a.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${a.name}`;
                                    const isRemote = photoUrl.startsWith("http://") || photoUrl.startsWith("https://");

                                    return (
                                      <div
                                        key={i}
                                        className="relative w-6 h-6 rounded-full overflow-hidden ring-2 ring-emerald-500/40 border border-zinc-950 transition-all duration-300 hover:scale-125 hover:z-10 hover:ring-emerald-400"
                                        title={a.name}
                                      >
                                        {isRemote ? (
                                          <Image
                                            src={photoUrl}
                                            alt={a.name}
                                            width={24}
                                            height={24}
                                            className="w-full h-full object-cover"
                                            unoptimized={photoUrl.includes("dicebear")}
                                          />
                                        ) : (
                                          <img
                                            src={photoUrl}
                                            alt={a.name}
                                            className="w-full h-full object-cover"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                  {focusingMembers.length > 4 && (
                                    <div className="w-6 h-6 rounded-full bg-zinc-900 border border-white/[0.08] flex items-center justify-center ring-2 ring-emerald-500/30">
                                      <span className="text-[8px] font-black text-emerald-400">+{focusingMembers.length - 4}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Footer accent line */}
                <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
