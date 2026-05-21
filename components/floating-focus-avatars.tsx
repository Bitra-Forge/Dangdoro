"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTimerStore } from "@/lib/store";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimationFrame } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface LiveSession {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  startedAt: any;
  lastHeartbeat: any;
  status: string;
}

/**
 * Deep equality check for sessions to prevent unnecessary state updates
 * Includes startedAt to ensure elapsed time resets correctly when users restart timers.
 * Matches sessions by ID to handle unordered Firestore snapshots.
 */
function sessionsEqual(a: LiveSession[], b: LiveSession[]): boolean {
  if (a.length !== b.length) return false;

  const byId = new Map<string, LiveSession>();
  for (const s of b) byId.set(s.id, s);

  for (const s1 of a) {
    const s2 = byId.get(s1.id);
    if (!s2) return false;
    if (s1.userId !== s2.userId) return false;
    if (s1.userName !== s2.userName) return false;
    if (s1.userPhoto !== s2.userPhoto) return false;
    if (s1.status !== s2.status) return false;

    const t1 = toMillis(s1.startedAt);
    const t2 = toMillis(s2.startedAt);
    if (t1 !== t2) return false;
  }
  return true;
}

function isPendingServerTimestamp(ts: any): boolean {
  if (!ts) return false;
  if (typeof ts === "object" && "_methodName" in ts && ts._methodName === "serverTimestamp") return true;
  return false;
}

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return Number(ts) || 0;
}

function fmtElapsed(secs: number): string {
  if (secs <= 0) return "0s";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h === 0) {
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  }
  return `${h}h ${m}m`;
}

/* ─── Orbit Configuration ─────────────────────────────────── */

const ORBIT_RX = 340;
const ORBIT_RY = 180;

// Hash a userId to a deterministic number in [0, 1)
function hashUserId(userId: string, seed: number = 0): number {
  let hash = seed;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 10000) / 10000;
}

function stableAngle(userId: string): number {
  return hashUserId(userId, 0) * Math.PI * 2;
}

function stableSpeed(userId: string): number {
  return 52 + Math.floor(hashUserId(userId, 7) * 24);
}

function stableColorIndex(userId: string): number {
  return Math.floor(hashUserId(userId, 13) * ACCENT_COLORS.length);
}

function generateOrbitKeyframes(
  startAngle: number,
  steps: number = 80
): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + t * Math.PI * 2;
    x.push(Math.cos(angle) * ORBIT_RX);
    y.push(Math.sin(angle) * ORBIT_RY);
  }
  return { x, y };
}

const ACCENT_COLORS = [
  { ring: "ring-sky-400/40", glow: "bg-sky-400", hoverGlow: "rgba(56,189,248,0.5)", dot: "bg-sky-400", text: "text-sky-400", gradient: "from-sky-500/30 to-cyan-500/20" },
  { ring: "ring-violet-400/40", glow: "bg-violet-400", hoverGlow: "rgba(167,139,250,0.5)", dot: "bg-violet-400", text: "text-violet-400", gradient: "from-violet-500/30 to-purple-500/20" },
  { ring: "ring-emerald-400/40", glow: "bg-emerald-400", hoverGlow: "rgba(52,211,153,0.5)", dot: "bg-emerald-400", text: "text-emerald-400", gradient: "from-emerald-500/30 to-teal-500/20" },
  { ring: "ring-amber-400/40", glow: "bg-amber-400", hoverGlow: "rgba(251,191,36,0.5)", dot: "bg-amber-400", text: "text-amber-400", gradient: "from-amber-500/30 to-orange-500/20" },
  { ring: "ring-rose-400/40", glow: "bg-rose-400", hoverGlow: "rgba(251,113,133,0.5)", dot: "bg-rose-400", text: "text-rose-400", gradient: "from-rose-500/30 to-pink-500/20" },
  { ring: "ring-cyan-400/40", glow: "bg-cyan-400", hoverGlow: "rgba(34,211,238,0.5)", dot: "bg-cyan-400", text: "text-cyan-400", gradient: "from-cyan-500/30 to-sky-500/20" },
  { ring: "ring-fuchsia-400/40", glow: "bg-fuchsia-400", hoverGlow: "rgba(232,121,249,0.5)", dot: "bg-fuchsia-400", text: "text-fuchsia-400", gradient: "from-fuchsia-500/30 to-pink-500/20" },
  { ring: "ring-lime-400/40", glow: "bg-lime-400", hoverGlow: "rgba(163,230,53,0.5)", dot: "bg-lime-400", text: "text-lime-400", gradient: "from-lime-500/30 to-green-500/20" },
  { ring: "ring-indigo-400/40", glow: "bg-indigo-400", hoverGlow: "rgba(129,140,248,0.5)", dot: "bg-indigo-400", text: "text-indigo-400", gradient: "from-indigo-500/30 to-blue-500/20" },
  { ring: "ring-teal-400/40", glow: "bg-teal-400", hoverGlow: "rgba(45,212,191,0.5)", dot: "bg-teal-400", text: "text-teal-400", gradient: "from-teal-500/30 to-cyan-500/20" },
];

const MAX_AVATARS = 10;

/* ─── Avatar Component ────────────────────────────────────── */

function OrbitalAvatarComponent({
  session,
  latestPhoto,
}: {
  session: LiveSession;
  latestPhoto?: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const isPaused = useTimerStore((s) => s.isPaused);

  // Local "now" for tooltip countdown — only ticks when hovered to save resources
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!hovered || isPaused) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hovered, isPaused]);

  // All visual properties derived from userId — completely stable
  const startAngleVal = useMemo(() => stableAngle(session.userId), [session.userId]);
  const speed = useMemo(() => stableSpeed(session.userId), [session.userId]);
  const accent = useMemo(() => ACCENT_COLORS[stableColorIndex(session.userId)], [session.userId]);

  // Motion values for orbit position — properly pause/resume
  const elapsedRef = useRef(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useAnimationFrame((time, delta) => {
    if (isPaused) return;
    elapsedRef.current += delta / 1000;
    const angle = startAngleVal + (elapsedRef.current / speed) * Math.PI * 2;
    x.set(Math.cos(angle) * ORBIT_RX);
    y.set(Math.sin(angle) * ORBIT_RY);
  });

  // Glow animation motion values
  const glowElapsedRef = useRef(0);
  const glowOpacity = useMotionValue(0.06);
  const glowScale = useMotionValue(1.15);

  useAnimationFrame((_, delta) => {
    if (isPaused) return;
    const duration = hovered ? 1.5 : 3.5;
    glowElapsedRef.current += delta / 1000;
    const t = (glowElapsedRef.current % duration) / duration;
    const [minO, maxO] = hovered ? [0.3, 0.5] : [0.06, 0.15];
    const [minS, maxS] = hovered ? [1.4, 1.6] : [1.15, 1.3];
    const wave = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    glowOpacity.set(minO + (maxO - minO) * wave);
    glowScale.set(minS + (maxS - minS) * wave);
  });

  // Dot pulse animation motion values
  const dotElapsedRef = useRef(0);
  const dotScale = useMotionValue(1);
  const dotOpacity = useMotionValue(0.8);

  useAnimationFrame((_, delta) => {
    if (isPaused) return;
    dotElapsedRef.current += delta / 1000;
    const t = (dotElapsedRef.current % 2) / 2;
    const wave = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    dotScale.set(1 + 0.35 * wave);
    dotOpacity.set(0.8 + 0.2 * wave);
  });

  const startedAtMs = toMillis(session.startedAt);
  const elapsedSecs = startedAtMs ? Math.floor((now - startedAtMs) / 1000) : 0;

  const getInitials = useCallback((name: string) => {
    const parts = name.split(/[\s_]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, []);

  const photoUrl = latestPhoto || session.userPhoto;
  const hasPhoto = photoUrl && photoUrl.length > 10 && !photoUrl.includes("null");
  const isRemotePhoto = hasPhoto && (photoUrl!.startsWith("http://") || photoUrl!.startsWith("https://"));

  const handleClick = useCallback(() => {
    router.push(`/profile?user=${session.userId}`);
  }, [router, session.userId]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, filter: "blur(12px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{
        opacity: 0,
        scale: 0.3,
        filter: "blur(8px)",
        transition: { duration: 0.3, ease: "easeIn" },
      }}
      transition={{
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className="absolute pointer-events-auto"
      style={{
        top: "50%",
        left: "50%",
        marginTop: -20,
        marginLeft: -20,
        zIndex: 25,
      }}
    >
      <motion.div
        style={{ x, y }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="cursor-pointer"
        onClick={handleClick}
      >
        <div className="relative">
          {/* Outer glow — breathing */}
          <motion.div
            style={{ opacity: glowOpacity, scale: glowScale }}
            className={cn("absolute inset-0 rounded-full blur-lg", accent.glow)}
          />

          {/* Avatar ring */}
          <motion.div
            animate={{ scale: hovered ? 1.18 : 1 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div
              className={cn(
                "relative w-10 h-10 rounded-full overflow-hidden transition-all duration-500",
                "ring-[1.5px] ring-offset-1 ring-offset-zinc-950/80",
                hovered
                  ? cn(accent.ring.replace("/40", "/70"), "shadow-[0_0_22px_var(--glow-color)]")
                  : cn(accent.ring, "shadow-[0_0_10px_var(--glow-color)]")
              )}
              style={{ "--glow-color": accent.hoverGlow } as React.CSSProperties}
            >
              {hasPhoto ? (
                isRemotePhoto ? (
                  <Image
                    src={photoUrl!}
                    alt={session.userName}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized={photoUrl!.includes("dicebear")}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl!}
                    alt={session.userName}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center bg-zinc-900", accent.gradient)}>
                  <span className="text-[11px] font-black text-white/90 drop-shadow-md tracking-wide">
                    {getInitials(session.userName)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Active dot */}
          <motion.div
            style={{ scale: dotScale, opacity: dotOpacity }}
            className="absolute -bottom-0.5 -right-0.5 z-10"
          >
            <div className={cn("w-2.5 h-2.5 rounded-full ring-[2px] ring-zinc-950/80", accent.dot)} />
          </motion.div>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.9 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none z-50"
              >
                <div className="relative px-3.5 py-2.5 bg-zinc-900/95 backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] whitespace-nowrap">
                  <div className={cn("absolute top-0 left-2.5 right-2.5 h-[1.5px] rounded-full opacity-50", accent.glow)} />
                  <p className="text-[11px] font-bold text-zinc-100 tracking-tight">{session.userName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isPaused ? "" : "animate-pulse", accent.dot)} />
                    <p className={cn("text-[10px] font-bold tabular-nums", accent.text)}>
                      {fmtElapsed(elapsedSecs)} focused
                    </p>
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1">Click to visit profile</p>
                </div>
                <div className="w-2 h-2 bg-zinc-900/95 border-r border-b border-white/[0.08] rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

const OrbitalAvatar = React.memo(OrbitalAvatarComponent, (prev, next) => {
  return (
    prev.session.id === next.session.id &&
    prev.session.userId === next.session.userId &&
    prev.session.userName === next.session.userName &&
    prev.session.userPhoto === next.session.userPhoto &&
    toMillis(prev.session.startedAt) === toMillis(next.session.startedAt) &&
    prev.latestPhoto === next.latestPhoto
  );
});

/* ─── Container ───────────────────────────────────────────── */

export function FloatingFocusAvatars() {
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const activeLiveSessionId = useTimerStore((s) => s.activeLiveSessionId);
  const [rawSessions, setRawSessions] = useState<LiveSession[]>([]);
  const [now, setNow] = useState(Date.now());
  const [userPhotos, setUserPhotos] = useState<Record<string, string>>({});

  // 1-second ticker for staleness filtering
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Firestore listener — re-subscribes when group or session changes
  useEffect(() => {
    if (!activeGroupId) {
      setRawSessions([]);
      return;
    }

    const q = query(
      collection(db, "liveSessions"),
      where("groupId", "==", activeGroupId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs
        .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) } as LiveSession))
        .sort((a, b) => a.userId.localeCompare(b.userId));
      setRawSessions(fetched);
    });

    return unsub;
  }, [activeGroupId, activeLiveSessionId]);

  // Derive visible sessions: filter stale + sort by userId for stability
  const sessions = useMemo(() => {
    const STALE_MS = 3 * 60 * 1000;
    return rawSessions
      .filter((s) => {
        if (isPendingServerTimestamp(s.lastHeartbeat)) return true;
        const hbMs = toMillis(s.lastHeartbeat);
        if (!hbMs) return true; // Treat pending/falsy heartbeats as active (prevents temporary filtering during updates)
        return now - hbMs <= STALE_MS;
      })
      .sort((a, b) => a.userId.localeCompare(b.userId));
  }, [rawSessions, now]);

  // Track which user IDs are currently visible to fetch their photos
  const sessionUserIdsKey = useMemo(() => sessions.map((s) => s.userId).join(","), [sessions]);

  // Fetch latest user photos whenever the set of visible users changes
  useEffect(() => {
    if (!sessionUserIdsKey) return;
    const ids = sessionUserIdsKey.split(",");

    let cancelled = false;

    async function fetchPhotos() {
      const photos: Record<string, string> = {};
      await Promise.all(
        ids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const data = snap.data();
              if (data.photoURL) photos[uid] = data.photoURL;
            }
          } catch {
            // Fallback handled by session photo
          }
        })
      );
      if (!cancelled) {
        setUserPhotos((prev) => ({ ...prev, ...photos }));
      }
    }

    fetchPhotos();
    return () => {
      cancelled = true;
    };
  }, [sessionUserIdsKey]);

  if (sessions.length === 0) return null;

  const visible = sessions.slice(0, MAX_AVATARS);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {visible.map((session) => (
          <OrbitalAvatar
            key={session.userId}
            session={session}
            latestPhoto={userPhotos[session.userId]}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
