"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Timer, Music, Trophy, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import pixelForestBg from "@/components/ui/Pixel-bg/pixel art golden forest GIF.gif";
import owlSleepy from "@/components/ui/Pixel-bg/Idle-owl-sleepy.gif";
import owlAware from "@/components/ui/Pixel-bg/Idle-owl-aware.gif";
import owlQuite from "@/components/ui/Pixel-bg/Idle-owl-quite.gif";
import { useAuth } from "@/components/AuthProvider";

function useLiveCounter(target: number, duration = 3000, start = true) {
  const [value, setValue] = useState(0);
  const [flash, setFlash] = useState(false);
  const valueRef = useRef(0);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    if (!start) return;
    const from = valueRef.current;

    let startTimestamp: number | null = null;
    let raf: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const next = from + Math.floor(progress * (target - from));
      setValue(next);
      valueRef.current = next;
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  useEffect(() => {
    if (!start) return;
    if (prevTargetRef.current > 0 && target > prevTargetRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    }
    prevTargetRef.current = target;
  }, [target, start]);

  return { value, flash };
}

function LiveNumberDisplay({ value, flash }: { value: number; flash: boolean }) {
  const str = value.toLocaleString("en-US");
  const prefix = str.length > 2 ? str.slice(0, -2) : "";
  const suffix = str.length > 2 ? str.slice(-2) : str;
  return (
    <span>
      {prefix}
      <span className={flash ? "drop-shadow-[0_0_10px_rgba(240,237,204,0.9)]" : ""}>
        {suffix}
      </span>
    </span>
  );
}

function HeaderOwl({ isHovered }: { isHovered: boolean }) {
  const [stage, setStage] = useState<'sleepy' | 'aware' | 'quite'>('sleepy');

  useEffect(() => {
    if (isHovered) {
      setStage('aware');
    } else if (stage === 'aware') {
      setStage('quite');
    }
  }, [isHovered, stage]);

  useEffect(() => {
    if (stage === 'quite') {
      const timer = setTimeout(() => {
        setStage('sleepy');
      }, 4800);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  return (
    <div className="absolute bottom-[82%] left-1/2 -translate-x-[65%] w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 pointer-events-none select-none z-20">
      <motion.img
        src={owlSleepy.src}
        alt="Owl Sleepy"
        animate={{ opacity: stage === 'sleepy' ? 1 : 0 }}
        transition={{ duration: 0.1, ease: "easeInOut" }}
        className="absolute inset-0 w-full h-full object-contain"
      />
      <motion.img
        src={owlAware.src}
        alt="Owl Aware"
        animate={{ opacity: stage === 'aware' ? 1 : 0 }}
        transition={{ duration: 0.1, ease: "easeInOut" }}
        className="absolute inset-0 w-full h-full object-contain"
      />
      <motion.img
        src={owlQuite.src}
        alt="Owl Quite"
        animate={{ opacity: stage === 'quite' ? 1 : 0 }}
        transition={{ duration: 0.1, ease: "easeInOut" }}
        className="absolute inset-0 w-full h-full object-contain"
      />
    </div>
  );
}

export default function WelcomePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const section2Ref = useRef<HTMLDivElement | null>(null);
  const [typedSub, setTypedSub] = useState("");
  const subtitleText = "FOCUS. COMPETE. WIN.";
  const [mounted, setMounted] = useState(false);
  const [isHoveredD, setIsHoveredD] = useState(false);
  const [statsData, setStatsData] = useState<{
    totalUsers: number;
    totalTimeHours: number;
    totalSessions: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    const fetchStats = () =>
      fetch("/api/public-stats")
        .then((r) => r.json())
        .then((data) => setStatsData(data))
        .catch(() => { });

    fetchStats().catch(() =>
      setStatsData({ totalUsers: 0, totalTimeHours: 0, totalSessions: 0 })
    );

    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const ready = mounted && statsData !== null;
  const targetUsers = statsData?.totalUsers ?? 0;
  const targetHours = statsData?.totalTimeHours ?? 0;
  const targetSessions = statsData?.totalSessions ?? 0;
  const userLive = useLiveCounter(ready ? targetUsers : 0, 3000, ready);
  const hoursLive = useLiveCounter(ready ? targetHours : 0, 3500, ready);
  const sessionsLive = useLiveCounter(ready ? targetSessions : 0, 4000, ready);



  const { openAuthVault } = useAuth();

  const handleEnterWorkspace = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dangdoro_visited", "true");
    }
  };

  // Simple terminal typewriter effect for the subtitle
  useEffect(() => {
    let currentIndex = 0;
    const timer = setInterval(() => {
      if (currentIndex < subtitleText.length) {
        setTypedSub(subtitleText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(timer);
      }
    }, 85);
    return () => clearInterval(timer);
  }, []);

  const titleLetters = "DANGDORO".split("");

  // Letter animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      }
    }
  };

  const letterVariants = {
    hidden: {
      opacity: 0,
      y: -50,
      scale: 0.5,
      filter: "blur(8px)"
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 12
      }
    },
    hover: {
      scale: 1.2,
      y: -10,
      textShadow: "0 0 20px rgba(240, 237, 204, 0.95), 0 0 35px rgba(240, 237, 204, 0.5)",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 8
      }
    }
  };

  const glowPulseVariants = {
    animate: {
      scale: [1, 1.08, 1],
      opacity: [0.12, 0.22, 0.12],
      transition: {
        duration: 8,
        ease: "easeInOut" as const,
        repeat: Infinity,
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-[#02343F] text-[#F0EDCC] overflow-x-hidden font-pixelify selection:bg-[#F0EDCC]/20 selection:text-[#F0EDCC]"
    >
      {/* ─── RETRO SCI-FI BACKGROUND EFFECTS ─── */}

      {/* Fixed Pixelated Background Image */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("${pixelForestBg.src}")`,
        }}
      />

      {/* Immersive Dot Grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(240, 237, 204, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Floating Ambient Glow */}
      <motion.div
        variants={glowPulseVariants}
        animate="animate"
        className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full pointer-events-none blur-[100px] z-0"
        style={{
          background: 'radial-gradient(circle, rgba(240, 237, 204, 0.12) 0%, transparent 70%)',
        }}
      />

      {/* ─── SECTION 1: HERO TITLE ─── */}
      <section
        className="relative h-screen w-full flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="text-center select-none max-w-3xl relative z-10">
          {/* Animated Pixelated Header */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-center gap-1.5 md:gap-3.5 mb-8"
          >
            {titleLetters.map((letter, idx) => (
              <motion.span
                key={idx}
                variants={letterVariants}
                whileHover="hover"
                onHoverStart={idx === 0 ? () => setIsHoveredD(true) : undefined}
                onHoverEnd={idx === 0 ? () => setIsHoveredD(false) : undefined}
                className="relative font-pixelify text-6xl sm:text-8xl md:text-[7.5rem] lg:text-[9rem] xl:text-[10rem] font-bold cursor-default select-none text-[#F0EDCC] drop-shadow-[0_0_15px_rgba(240, 237, 204, 0.35)]"
              >
                {idx === 0 && <HeaderOwl isHovered={isHoveredD} />}
                {letter}
              </motion.span>
            ))}
          </motion.div>

          {/* Typewritten Terminal Subtitle */}
          <div className="h-6 flex items-center justify-center font-pixelify text-[#F0EDCC]/70 text-xs sm:text-sm tracking-[0.25em] pl-3">
            <span>{typedSub}</span>
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" as const }}
              className="inline-block w-1.5 h-4 bg-[#F0EDCC] ml-1 shadow-[0_0_8px_#F0EDCC]"
            />
          </div>
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6"
        >
          {/* Start Focusing */}
          <motion.div
            whileHover={{
              x: -3,
              y: -3,
              boxShadow: "8px 8px 0px 0px rgba(240, 237, 204, 0.35)",
              transition: { duration: 0.1 },
            }}
            className="relative"
          >
            <Link
              href="/"
              onClick={handleEnterWorkspace}
              className="block px-10 py-4 border-4 border-[#F0EDCC] bg-[#02343F] font-pixelify text-sm font-bold uppercase tracking-wider text-[#F0EDCC] shadow-[4px_4px_0_0_rgba(240,237,204,0.15)] hover:bg-[#F0EDCC] hover:text-[#02343F] hover:border-[#02343F] transition-none"
            >
              Start Focusing
            </Link>
          </motion.div>

          {/* Join Us */}
          <motion.div
            whileHover={{
              x: -3,
              y: -3,
              boxShadow: "8px 8px 0px 0px rgba(240, 237, 204, 0.35)",
              transition: { duration: 0.1 },
            }}
            className="relative"
          >
            <button
              onClick={openAuthVault}
              className="block px-10 py-4 border-4 border-[#F0EDCC] bg-[#02343F] font-pixelify text-sm font-bold uppercase tracking-wider text-[#F0EDCC] shadow-[4px_4px_0_0_rgba(240,237,204,0.15)] hover:bg-[#F0EDCC] hover:text-[#02343F] hover:border-[#02343F] transition-none"
            >
              Join Us
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── LIVE STAT TICKER ─── */}
      <section className="relative w-full py-24 px-6 z-10 mt-48">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 max-w-xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#F0EDCC]">
              Live Ticker
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Stat: Users */}
            <motion.div
              initial="rest"
              whileHover="hover"
              className="border-4 border-[#F0EDCC]/15 bg-[#02343F]/80 p-8 text-center hover:border-[#F0EDCC]/40 transition-all duration-300 shadow-[4px_4px_0_0_rgba(240,237,204,0.08)] hover:shadow-[6px_6px_0_0_rgba(240,237,204,0.2)] hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              <motion.div
                whileHover={{
                  x: [0, -3, 3, -1, 2, 0],
                  skewX: [0, 2, -2, 1, -1, 0],
                  scaleX: [1, 1.02, 0.98, 1.01, 1],
                  transition: { duration: 0.08 },
                }}
                className="font-pixelify text-5xl md:text-6xl font-bold text-[#F0EDCC] mb-2 select-none"
              >
                {mounted ? (
                  <LiveNumberDisplay value={userLive.value} flash={userLive.flash} />
                ) : "0"}
              </motion.div>
              <div className="font-pixelify text-xs tracking-[0.2em] text-[#F0EDCC]/50 uppercase">
                Focus Users
              </div>
              <div className="flex justify-center gap-1 mt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    variants={{
                      rest: {
                        opacity: 0.3,
                        backgroundColor: "rgba(240, 237, 204, 0.3)",
                        transition: { duration: 0.25 },
                      },
                      hover: {
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: [
                          "rgba(240, 237, 204, 0.3)",
                          "rgba(240, 237, 204, 1)",
                          "rgba(240, 237, 204, 0.3)",
                        ],
                        transition: {
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.12,
                          ease: "easeInOut",
                        },
                      },
                    }}
                    className="w-1.5 h-1.5"
                  />
                ))}
              </div>
            </motion.div>

            {/* Stat: Hours */}
            <motion.div
              initial="rest"
              whileHover="hover"
              className="border-4 border-[#F0EDCC]/15 bg-[#02343F]/80 p-8 text-center hover:border-[#F0EDCC]/40 transition-all duration-300 shadow-[4px_4px_0_0_rgba(240,237,204,0.08)] hover:shadow-[6px_6px_0_0_rgba(240,237,204,0.2)] hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              <motion.div
                whileHover={{
                  x: [0, -3, 3, -1, 2, 0],
                  skewX: [0, 2, -2, 1, -1, 0],
                  scaleX: [1, 1.02, 0.98, 1.01, 1],
                  transition: { duration: 0.08 },
                }}
                className="font-pixelify text-5xl md:text-6xl font-bold text-[#F0EDCC] mb-2 select-none"
              >
                {mounted ? (
                  <LiveNumberDisplay value={hoursLive.value} flash={hoursLive.flash} />
                ) : "0"}
              </motion.div>
              <div className="font-pixelify text-xs tracking-[0.2em] text-[#F0EDCC]/50 uppercase">
                Focus Hours
              </div>
              <div className="flex justify-center gap-1 mt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    variants={{
                      rest: {
                        opacity: 0.3,
                        backgroundColor: "rgba(240, 237, 204, 0.3)",
                        transition: { duration: 0.25 },
                      },
                      hover: {
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: [
                          "rgba(240, 237, 204, 0.3)",
                          "rgba(240, 237, 204, 1)",
                          "rgba(240, 237, 204, 0.3)",
                        ],
                        transition: {
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.12,
                          ease: "easeInOut",
                        },
                      },
                    }}
                    className="w-1.5 h-1.5"
                  />
                ))}
              </div>
            </motion.div>

            {/* Stat: Sessions */}
            <motion.div
              initial="rest"
              whileHover="hover"
              className="border-4 border-[#F0EDCC]/15 bg-[#02343F]/80 p-8 text-center hover:border-[#F0EDCC]/40 transition-all duration-300 shadow-[4px_4px_0_0_rgba(240,237,204,0.08)] hover:shadow-[6px_6px_0_0_rgba(240,237,204,0.2)] hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              <motion.div
                whileHover={{
                  x: [0, -3, 3, -1, 2, 0],
                  skewX: [0, 2, -2, 1, -1, 0],
                  scaleX: [1, 1.02, 0.98, 1.01, 1],
                  transition: { duration: 0.08 },
                }}
                className="font-pixelify text-5xl md:text-6xl font-bold text-[#F0EDCC] mb-2 select-none"
              >
                {mounted ? (
                  <LiveNumberDisplay value={sessionsLive.value} flash={sessionsLive.flash} />
                ) : "0"}
              </motion.div>
              <div className="font-pixelify text-xs tracking-[0.2em] text-[#F0EDCC]/50 uppercase">
                Sessions Done
              </div>
              <div className="flex justify-center gap-1 mt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    variants={{
                      rest: {
                        opacity: 0.3,
                        backgroundColor: "rgba(240, 237, 204, 0.3)",
                        transition: { duration: 0.25 },
                      },
                      hover: {
                        opacity: [0.3, 1, 0.3],
                        backgroundColor: [
                          "rgba(240, 237, 204, 0.3)",
                          "rgba(240, 237, 204, 1)",
                          "rgba(240, 237, 204, 0.3)",
                        ],
                        transition: {
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.12,
                          ease: "easeInOut",
                        },
                      },
                    }}
                    className="w-1.5 h-1.5"
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: CORE QUICK INFORMATION ─── */}
      <section
        ref={section2Ref}
        className="relative min-h-screen w-full flex flex-col justify-center py-24 px-6 md:px-12 max-w-6xl mx-auto z-10"
      >
        {/* Header */}
        <div className="text-center mb-16 max-w-xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#F0EDCC]">
            Everything you need to master your focus
          </h2>
          <p className="text-[#F0EDCC]/60 text-sm leading-relaxed font-sans">
            DangDoro combines the proven power of the Pomodoro technique with interactive social competition and ambient soundscapes.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

          {/* Card 1: Timer */}
          <motion.div
            whileHover="hover"
            className="relative group p-8 rounded-none bg-[#02343F]/60 border-4 border-[#F0EDCC]/20 hover:border-[#F0EDCC] shadow-[4px_4px_0_0_rgba(240,237,204,0.15)] hover:shadow-[8px_8px_0_0_rgba(240,237,204,0.3)] hover:-translate-x-1 hover:-translate-y-1 transition-all duration-300 flex items-start cursor-pointer overflow-hidden"
          >
            {/* Level Select Tile Badge */}
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#F0EDCC] text-[#02343F] border-2 border-[#02343F] shadow-[-2px_2px_0_0_rgba(240,237,204,0.3)] font-pixelify font-black text-xs flex items-center justify-center select-none z-20">
              01
            </div>

            {/* Blocky Selector Arrow */}
            <motion.div
              variants={{
                initial: { opacity: 0, x: -16 },
                hover: {
                  opacity: 1,
                  x: [0, 4, 0],
                  transition: {
                    x: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
                    opacity: { duration: 0.2 }
                  }
                }
              }}
              initial="initial"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F0EDCC] z-10"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 8 8">
                <path d="M0 0h2v1H0zm0 1h4v1H0zm0 2h6v1H0zm0 1h8v1H0zm0 1h6v1H0zm0 1h4v1H0zm0 1h2v1H0z" />
              </svg>
            </motion.div>

            {/* Content Container (shifts right on hover) */}
            <div className="flex gap-6 items-start w-full transition-transform duration-300 group-hover:translate-x-4 pl-0">
              <div className="p-3.5 bg-[#F0EDCC]/5 border-2 border-[#F0EDCC]/15 rounded-none text-[#F0EDCC] shrink-0 group-hover:scale-105 transition-transform duration-300">
                <Timer className="w-6 h-6" />
              </div>
              <div className="space-y-2 pr-4">
                <h3 className="text-base font-bold text-[#F0EDCC] tracking-tight">Real-Time Collaborative Timer</h3>
                <p className="text-[#F0EDCC]/60 text-xs leading-relaxed font-sans">
                  Focus synchronously with study circles and workspaces. Experience real-time shared ticking that keeps everyone accountable.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Sounds */}
          <motion.div
            whileHover="hover"
            className="relative group p-8 rounded-none bg-[#02343F]/60 border-4 border-[#F0EDCC]/20 hover:border-[#F0EDCC] shadow-[4px_4px_0_0_rgba(240,237,204,0.15)] hover:shadow-[8px_8px_0_0_rgba(240,237,204,0.3)] hover:-translate-x-1 hover:-translate-y-1 transition-all duration-300 flex items-start cursor-pointer overflow-hidden"
          >
            {/* Level Select Tile Badge */}
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#F0EDCC] text-[#02343F] border-2 border-[#02343F] shadow-[-2px_2px_0_0_rgba(240,237,204,0.3)] font-pixelify font-black text-xs flex items-center justify-center select-none z-20">
              02
            </div>

            {/* Blocky Selector Arrow */}
            <motion.div
              variants={{
                initial: { opacity: 0, x: -16 },
                hover: {
                  opacity: 1,
                  x: [0, 4, 0],
                  transition: {
                    x: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
                    opacity: { duration: 0.2 }
                  }
                }
              }}
              initial="initial"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F0EDCC] z-10"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 8 8">
                <path d="M0 0h2v1H0zm0 1h4v1H0zm0 2h6v1H0zm0 1h8v1H0zm0 1h6v1H0zm0 1h4v1H0zm0 1h2v1H0z" />
              </svg>
            </motion.div>

            {/* Content Container (shifts right on hover) */}
            <div className="flex gap-6 items-start w-full transition-transform duration-300 group-hover:translate-x-4 pl-0">
              <div className="p-3.5 bg-[#F0EDCC]/5 border-2 border-[#F0EDCC]/15 rounded-none text-[#F0EDCC] shrink-0 group-hover:scale-105 transition-transform duration-300">
                <Music className="w-6 h-6" />
              </div>
              <div className="space-y-2 pr-4">
                <h3 className="text-base font-bold text-[#F0EDCC] tracking-tight">Ambient Audio Mixer</h3>
                <p className="text-[#F0EDCC]/60 text-xs leading-relaxed font-sans">
                  Customize your background acoustic environment. Seamlessly blend lofi music, rain patters, white noise, and fireplace crackles.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Leaderboard */}
          <motion.div
            whileHover="hover"
            className="relative group p-8 rounded-none bg-[#02343F]/60 border-4 border-[#F0EDCC]/20 hover:border-[#F0EDCC] shadow-[4px_4px_0_0_rgba(240,237,204,0.15)] hover:shadow-[8px_8px_0_0_rgba(240,237,204,0.3)] hover:-translate-x-1 hover:-translate-y-1 transition-all duration-300 flex items-start cursor-pointer overflow-hidden"
          >
            {/* Level Select Tile Badge */}
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#F0EDCC] text-[#02343F] border-2 border-[#02343F] shadow-[-2px_2px_0_0_rgba(240,237,204,0.3)] font-pixelify font-black text-xs flex items-center justify-center select-none z-20">
              03
            </div>

            {/* Blocky Selector Arrow */}
            <motion.div
              variants={{
                initial: { opacity: 0, x: -16 },
                hover: {
                  opacity: 1,
                  x: [0, 4, 0],
                  transition: {
                    x: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
                    opacity: { duration: 0.2 }
                  }
                }
              }}
              initial="initial"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F0EDCC] z-10"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 8 8">
                <path d="M0 0h2v1H0zm0 1h4v1H0zm0 2h6v1H0zm0 1h8v1H0zm0 1h6v1H0zm0 1h4v1H0zm0 1h2v1H0z" />
              </svg>
            </motion.div>

            {/* Content Container (shifts right on hover) */}
            <div className="flex gap-6 items-start w-full transition-transform duration-300 group-hover:translate-x-4 pl-0">
              <div className="p-3.5 bg-[#F0EDCC]/5 border-2 border-[#F0EDCC]/15 rounded-none text-[#F0EDCC] shrink-0 group-hover:scale-105 transition-transform duration-300">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-2 pr-4">
                <h3 className="text-base font-bold text-[#F0EDCC] tracking-tight">Competitive Leaderboards</h3>
                <p className="text-[#F0EDCC]/60 text-xs leading-relaxed font-sans">
                  Turn focus sessions into progress scores. Secure your position on the weekly board, climb ranks, and challenge your friends.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 4: AI Planner */}
          <motion.div
            whileHover="hover"
            className="relative group p-8 rounded-none bg-[#02343F]/60 border-4 border-[#F0EDCC]/20 hover:border-[#F0EDCC] shadow-[4px_4px_0_0_rgba(240,237,204,0.15)] hover:shadow-[8px_8px_0_0_rgba(240,237,204,0.3)] hover:-translate-x-1 hover:-translate-y-1 transition-all duration-300 flex items-start cursor-pointer overflow-hidden"
          >
            {/* Level Select Tile Badge */}
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#F0EDCC] text-[#02343F] border-2 border-[#02343F] shadow-[-2px_2px_0_0_rgba(240,237,204,0.3)] font-pixelify font-black text-xs flex items-center justify-center select-none z-20">
              04
            </div>

            {/* Blocky Selector Arrow */}
            <motion.div
              variants={{
                initial: { opacity: 0, x: -16 },
                hover: {
                  opacity: 1,
                  x: [0, 4, 0],
                  transition: {
                    x: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
                    opacity: { duration: 0.2 }
                  }
                }
              }}
              initial="initial"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#F0EDCC] z-10"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 8 8">
                <path d="M0 0h2v1H0zm0 1h4v1H0zm0 2h6v1H0zm0 1h8v1H0zm0 1h6v1H0zm0 1h4v1H0zm0 1h2v1H0z" />
              </svg>
            </motion.div>

            {/* Content Container (shifts right on hover) */}
            <div className="flex gap-6 items-start w-full transition-transform duration-300 group-hover:translate-x-4 pl-0">
              <div className="p-3.5 bg-[#F0EDCC]/5 border-2 border-[#F0EDCC]/15 rounded-none text-[#F0EDCC] shrink-0 group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-2 pr-4">
                <h3 className="text-base font-bold text-[#F0EDCC] tracking-tight">AI Task Breakdown</h3>
                <p className="text-[#F0EDCC]/60 text-xs leading-relaxed font-sans">
                  Break massive goals into bitesize sub-tasks automatically. Plan smart Pomodoro splits customized by our intelligent assistant.
                </p>
              </div>
            </div>
          </motion.div>

        </div>


        {/* Enter Action Button */}
        <div className="flex justify-center mt-4">
          <Link
            href="/"
            onClick={handleEnterWorkspace}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[#02343F] border border-[#F0EDCC]/30 hover:border-[#F0EDCC] rounded-2xl text-sm font-bold uppercase tracking-wider text-[#F0EDCC] hover:text-[#02343F] transition-all duration-500 shadow-[0_0_20px_rgba(240,237,204,0.02)] hover:shadow-[0_0_35px_rgba(240,237,204,0.2)] overflow-hidden"
          >
            {/* Smooth background fill color transition */}
            <div className="absolute inset-0 bg-[#F0EDCC] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

            <span>Enter Focus Cockpit</span>
            <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </div>
      </section>
    </div>
  );
}
