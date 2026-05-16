"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, ChevronDown, Zap, Globe, Key, Mail, Sparkles } from "lucide-react";
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
      setGroups(fetched);
    });

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!activeGroupId) {
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
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-500 backdrop-blur-2xl",
          "shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
          activeGroupId
            ? "bg-sky-500/10 border-sky-400/25 hover:bg-sky-500/15 hover:border-sky-400/40 shadow-[0_8px_32px_rgba(56,189,248,0.1)]"
            : "bg-zinc-900/50 border-white/[0.08] hover:bg-zinc-900/70 hover:border-white/15"
        )}
      >
        <div className="relative">
          <Users className={cn(
            "w-4 h-4 transition-colors duration-300",
            activeGroupId ? "text-sky-400" : "text-zinc-400"
          )} />
          {activeFocusingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-60" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-sky-400" />
            </span>
          )}
        </div>
        <span className={cn(
          "text-xs font-bold tracking-wide max-w-[140px] truncate transition-colors duration-300",
          activeGroupId ? "text-sky-200" : "text-zinc-300"
        )}>
          {selectedGroup ? selectedGroup.name : "Focus Solo"}
        </span>
        {activeFocusingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/25">
            <span className="text-[10px] font-black text-sky-300 tabular-nums">{activeFocusingCount}</span>
          </span>
        )}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
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
              initial={{ opacity: 0, y: -12, scale: 0.95, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, scale: 0.97, filter: "blur(4px)" }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="absolute top-full left-0 mt-3 w-[340px] z-50 overflow-hidden rounded-[20px]"
            >
              {/* Glassmorphic container */}
              <div className="relative bg-zinc-900/85 backdrop-blur-3xl border border-white/[0.08] rounded-[20px] shadow-[0_30px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden">
                {/* Accent gradient line at top */}
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-sky-400/60" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Focus Context</h3>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-600 tabular-nums">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Options List */}
                <div className="p-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                  {/* Solo Option */}
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05, ease: [0.23, 1, 0.32, 1] }}
                    onClick={() => handleSelect("")}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-300 group/item",
                      !activeGroupId
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300",
                      !activeGroupId
                        ? "bg-white/10 border-white/15"
                        : "bg-zinc-800/60 border-white/[0.06] group-hover/item:bg-zinc-800/80 group-hover/item:border-white/10"
                    )}>
                      <Zap className={cn(
                        "w-4 h-4 transition-colors duration-300",
                        !activeGroupId ? "text-white" : "text-zinc-500 group-hover/item:text-zinc-300"
                      )} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold tracking-tight">Focus Solo</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Independent session</p>
                    </div>
                    {!activeGroupId && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                      />
                    )}
                  </motion.button>

                  {/* Divider */}
                  {groups.length > 0 && (
                    <div className="mx-4 my-1.5 border-t border-white/[0.04]" />
                  )}

                  {/* Group Options */}
                  {groups.map((group, index) => {
                    const stats = group.memberStats ?? {};
                    const focusingMembers = Object.values(stats).filter((m: any) => m.isFocusing);
                    const isSelected = group.id === activeGroupId;
                    const goalHours = group.settings?.goalHours ?? 0;
                    const totalMins = group.totalMinutes ?? 0;
                    const progress = goalHours > 0 ? Math.min(100, (totalMins / (goalHours * 60)) * 100) : 0;

                    const focusingAvatars = focusingMembers.slice(0, 3).map((m: any) => ({
                      name: m.displayName ?? "Member",
                      photo: m.photoURL,
                    }));

                    const pMeta = PRIVACY_ICONS[group.privacy] ?? PRIVACY_ICONS["public"];
                    const PIcon = pMeta.icon;

                    return (
                      <motion.button
                        key={group.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.06 + (index + 1) * 0.04, ease: [0.23, 1, 0.32, 1] }}
                        onClick={() => handleSelect(group.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-300 group/item",
                          isSelected
                            ? "bg-sky-500/[0.08] text-sky-200"
                            : "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
                        )}
                      >
                        {/* Group Icon */}
                        <div className="relative">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300",
                            isSelected
                              ? "bg-sky-500/15 border-sky-400/25"
                              : "bg-zinc-800/60 border-white/[0.06] group-hover/item:bg-zinc-800/80 group-hover/item:border-white/10"
                          )}>
                            <Users className={cn(
                              "w-4 h-4 transition-colors duration-300",
                              isSelected ? "text-sky-400" : "text-zinc-500 group-hover/item:text-zinc-300"
                            )} />
                          </div>
                          {focusingMembers.length > 0 && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-0.5 -right-0.5"
                            >
                              <div className="w-3 h-3 rounded-full bg-emerald-400 ring-[2px] ring-zinc-900/90 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                            </motion.div>
                          )}
                        </div>

                        {/* Group Info */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-sm font-bold truncate tracking-tight">{group.name}</p>
                            <PIcon className={cn("w-3 h-3 shrink-0 opacity-60", pMeta.color)} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-medium">
                              {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                            </span>
                            {focusingMembers.length > 0 && (
                              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                {focusingMembers.length} focusing
                              </span>
                            )}
                          </div>

                          {/* Progress bar */}
                          {goalHours > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.1 + index * 0.04 }}
                                  className={cn(
                                    "h-full rounded-full",
                                    progress >= 100 ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.3)]"
                                  )}
                                />
                              </div>
                              <span className="text-[9px] font-bold text-zinc-500 tabular-nums">
                                {fmtMinutes(totalMins)}/{goalHours}h
                              </span>
                            </div>
                          )}

                          {/* Focusing member avatars — using real photos */}
                          {focusingAvatars.length > 0 && (
                            <div className="flex items-center mt-2 -space-x-2">
                              {focusingAvatars.map((a, i) => {
                                const photoUrl = a.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${a.name}`;
                                const isRemote = photoUrl.startsWith("http://") || photoUrl.startsWith("https://");

                                return (
                                  <div
                                    key={i}
                                    className="relative w-6 h-6 rounded-full overflow-hidden ring-[1.5px] ring-zinc-900/80 border border-white/[0.06]"
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
                              {focusingMembers.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center ring-[1.5px] ring-zinc-900/80">
                                  <span className="text-[8px] font-bold text-zinc-400">+{focusingMembers.length - 3}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Selected indicator */}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] shrink-0"
                          />
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
