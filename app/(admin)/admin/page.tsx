"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Clock,
  Activity,
  Sparkles,
  LogIn,
  Calendar,
  Radio,
} from "lucide-react";
import { DASHBOARD_SESSION_KEY } from "@/components/dashboard-splash";

interface Stats {
  totalUsers: number;
  totalTimeHours: number;
  totalSessions: number;
  newUsersToday: number;
  newSignedInUsersToday: number | null;
  onlineUsers: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Only play entrance animations once the splash overlay has fully faded out.
  // On same-session revisits (splash already passed) we animate in immediately.
  const [splashDone, setSplashDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DASHBOARD_SESSION_KEY) === "1";
  });

  useEffect(() => {
    if (splashDone) return; // already ready
    const onUnlock = () => setSplashDone(true);
    window.addEventListener("dangdoro-admin-unlocked", onUnlock);
    return () =>
      window.removeEventListener("dangdoro-admin-unlocked", onUnlock);
  }, [splashDone]);

  // Live Digital Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setTime(`${hours}:${minutes}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Current Date
  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        month: "long",
        day: "numeric",
      };
      setDateStr(now.toLocaleDateString("en-US", options));
    };
    updateDate();
  }, []);

  // Fetch Admin Stats
  useEffect(() => {
    import("firebase/auth").then(async ({ getAuth }) => {
      const auth = getAuth();
      const checkUser = async () => {
        const u = auth.currentUser;
        if (u) {
          try {
            const t = await u.getIdToken();
            const res = await fetch("/api/admin/stats", {
              headers: { Authorization: `Bearer ${t}` },
            });
            const data = await res.json();
            if (!data.error) {
              setStats(data);
            }
          } catch (err) {
            console.error("Failed to load dashboard statistics:", err);
          } finally {
            setLoading(false);
          }
        } else {
          setTimeout(checkUser, 100);
        }
      };
      checkUser();
    });
  }, []);

  // Stagger animation config
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.9 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 80,
        damping: 15,
      },
    },
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats ? stats.totalUsers.toLocaleString() : null,
      icon: Users,
      color: "text-sky-400",
      glowColor: "rgba(56,189,248,0.15)",
    },
    {
      label: "Hours Focused",
      value: stats ? `${stats.totalTimeHours.toLocaleString()}h` : null,
      icon: Clock,
      color: "text-orange-400",
      glowColor: "rgba(251,146,60,0.15)",
    },
    {
      label: "Total Sessions",
      value: stats ? stats.totalSessions.toLocaleString() : null,
      icon: Activity,
      color: "text-emerald-400",
      glowColor: "rgba(52,211,153,0.15)",
    },
    {
      label: "New Today",
      value: stats ? `+${stats.newUsersToday}` : null,
      icon: Sparkles,
      color: "text-yellow-400",
      glowColor: "rgba(250,204,21,0.15)",
    },
    {
      label: "Signed In Today",
      value: stats ? (stats.newSignedInUsersToday !== null && stats.newSignedInUsersToday !== undefined ? `+${stats.newSignedInUsersToday}` : "—") : null,
      icon: LogIn,
      color: "text-violet-400",
      glowColor: "rgba(167,139,250,0.15)",
    },
    {
      label: "Online Now",
      value: stats ? stats.onlineUsers.toLocaleString() : null,
      icon: Radio,
      color: "text-teal-400",
      glowColor: "rgba(45,212,191,0.15)",
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col p-10 md:p-14 text-white select-none">
      {/* Center Clock Section */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-40">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={splashDone ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <span className="text-[90px] md:text-[110px] font-semibold tracking-tighter leading-none text-white/95">
            {time}
          </span>
          <div className="flex items-center gap-2 mt-2 text-white/60 text-sm font-medium">
            <Calendar className="w-4 h-4 text-white/50" />
            <span>{dateStr}</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Stats Grid in Glass Squares */}
      <div className="relative z-10 w-full mt-4 mb-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={splashDone ? "show" : "hidden"}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 w-full max-w-6xl mx-auto"
        >
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            const isHovered = hoveredIdx === idx;
            return (
              <motion.div
                key={idx}
                variants={itemVariants}
                whileTap={{ scale: 0.98 }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  boxShadow: isHovered
                    ? `0 10px 30px ${card.glowColor}`
                    : "0 8px 32px rgba(0,0,0,0.37)",
                  backgroundColor: isHovered
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.04)",
                  borderColor: isHovered
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(255, 255, 255, 0.08)",
                }}
                className="h-44 w-full flex flex-col justify-between items-center p-6 rounded-[10px] backdrop-blur-[2px] border transition-all duration-300 group cursor-pointer"
              >
                {/* Top: Stat Value */}
                {card.value !== null ? (
                  <span className="text-2xl md:text-3xl font-bold tracking-tight text-white/95 group-hover:text-white">
                    {card.value}
                  </span>
                ) : (
                  <div className="h-8 w-16 bg-white/10 rounded animate-pulse my-0.5" />
                )}

                {/* Middle: Styled Icon */}
                <div className="flex items-center justify-center my-2">
                  <Icon
                    className={`w-8 h-8 ${card.color} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]`}
                  />
                </div>

                {/* Bottom: Stat Label */}
                <span className="text-[10px] md:text-xs font-space-grotesk font-black uppercase tracking-[0.15em] text-white/45 group-hover:text-white/70 text-center">
                  {card.label}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
