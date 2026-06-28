"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ────────────────────────────────────────────────────── */

export type ChangelogType = "feature" | "fix" | "upcoming";

export interface ChangelogItem {
  id: string;
  type: ChangelogType;
  title: string;
  description: string;
  date?: string | null;
  imageUrl?: string | null;
  order?: number;
}

type TabFilter = "all" | "feature" | "fix" | "upcoming";

/* ── Default Timeline Data ────────────────────────────────────── */

const defaultTimelineEntries: ChangelogItem[] = [
  {
    id: "demo-1",
    type: "feature",
    title: "Focus Zone Ambient Soundscapes & Visuals",
    description:
      "Immerse yourself in customized procedural lo-fi beats, rain audio, and dynamic glassmorphic lighting tailored to boost deep work efficiency.",
    date: "2026-06-25T10:00:00.000Z",
    imageUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "demo-2",
    type: "fix",
    title: "Multi-tab Session Sync & Timer Accuracy",
    description:
      "Resolved edge-case drift issues when running multiple browser tabs simultaneously. Timer state now syncs instantly across windows via custom broadcast channels.",
    date: "2026-06-20T14:30:00.000Z",
  },
  {
    id: "demo-3",
    type: "feature",
    title: "Study Group Leaderboards & Real-time Milestones",
    description:
      "Track cumulative focus hours with team members, view live status badges, and celebrate weekly productivity achievements on global leaderboards.",
    date: "2026-06-15T09:15:00.000Z",
    imageUrl:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "demo-4",
    type: "fix",
    title: "Mobile Dock Touch Targets & Safe Area Padding",
    description:
      "Improved navigation dock responsiveness on modern iOS and Android OLED displays with refined haptic feedback and dynamic viewport units.",
    date: "2026-06-10T11:45:00.000Z",
  },
  {
    id: "demo-5",
    type: "upcoming",
    title: "Spotify & Apple Music Widget Integration",
    description:
      "Direct control over your favorite playlists inside the DangDoro sidebar without breaking your focus flow.",
    date: null,
  },
  {
    id: "demo-6",
    type: "upcoming",
    title: "AI Productivity Insights & Session Analytics",
    description:
      "Personalized breakdown of peak concentration hours, task completion velocity, and cognitive fatigue warnings.",
    date: null,
  },
];

/* ── Type color config ────────────────────────────────────────── */

const typeConfig = {
  feature: {
    label: "New Feature",
    dot: "#34d399",
    borderColor: "rgba(52,211,153,0.28)",
    glowColor: "rgba(52,211,153,0.18)",
    accentBg: "rgba(52,211,153,0.07)",
    textColor: "#34d399",
    /* lit state */
    iconFill: "rgba(52,211,153,0.14)",
    metallicBg: "linear-gradient(135deg, #192b23 0%, #0e1210 100%)",
    neonShadow:
      "0 0 4px #34d399, 0 0 10px rgba(52,211,153,0.75), 0 0 22px rgba(52,211,153,0.4), 0 0 42px rgba(52,211,153,0.15)",
    hoverShadow:
      "0 0 8px #34d399, 0 0 24px rgba(52,211,153,0.95), 0 0 48px rgba(52,211,153,0.75), 0 0 80px rgba(52,211,153,0.45)",
    breathClass: "neon-breath-emerald",
    /* unlit / off state — looks like a cold neon tube */
    offBorder: "rgba(52,211,153,0.16)",
    offBg: "rgba(52,211,153,0.03)",
    offIcon: "rgba(52,211,153,0.22)",
    /* top-light hover effect */
    topLight: "rgba(52,211,153,0.13)",
    topRim: "rgba(52,211,153,0.65)",
    Icon: Sparkles,
  },
  fix: {
    label: "Improvement",
    dot: "#f87171",
    borderColor: "rgba(248,113,113,0.28)",
    glowColor: "rgba(248,113,113,0.18)",
    accentBg: "rgba(248,113,113,0.07)",
    textColor: "#f87171",
    iconFill: "rgba(248,113,113,0.14)",
    metallicBg: "linear-gradient(135deg, #381919 0%, #170c0c 100%)",
    neonShadow:
      "0 0 4px #f87171, 0 0 10px rgba(248,113,113,0.75), 0 0 22px rgba(248,113,113,0.4), 0 0 42px rgba(248,113,113,0.15)",
    hoverShadow:
      "0 0 8px #f87171, 0 0 24px rgba(248,113,113,0.95), 0 0 48px rgba(248,113,113,0.75), 0 0 80px rgba(248,113,113,0.45)",
    breathClass: "neon-breath-red",
    offBorder: "rgba(248,113,113,0.16)",
    offBg: "rgba(248,113,113,0.03)",
    offIcon: "rgba(248,113,113,0.22)",
    topLight: "rgba(248,113,113,0.13)",
    topRim: "rgba(248,113,113,0.65)",
    Icon: CheckCircle2,
  },
  upcoming: {
    label: "Upcoming",
    dot: "#60a5fa",
    borderColor: "rgba(96,165,250,0.22)",
    glowColor: "rgba(96,165,250,0.12)",
    accentBg: "rgba(96,165,250,0.06)",
    textColor: "#60a5fa",
    iconFill: "rgba(96,165,250,0.12)",
    metallicBg: "linear-gradient(135deg, #182433 0%, #0e1116 100%)",
    neonShadow:
      "0 0 4px #60a5fa, 0 0 10px rgba(96,165,250,0.7), 0 0 22px rgba(96,165,250,0.35), 0 0 42px rgba(96,165,250,0.12)",
    hoverShadow:
      "0 0 8px #60a5fa, 0 0 24px rgba(96,165,250,0.95), 0 0 48px rgba(96,165,250,0.75), 0 0 80px rgba(96,165,250,0.45)",
    breathClass: "",
    offBorder: "rgba(96,165,250,0.14)",
    offBg: "rgba(96,165,250,0.03)",
    offIcon: "rgba(96,165,250,0.2)",
    topLight: "rgba(96,165,250,0.1)",
    topRim: "rgba(96,165,250,0.55)",
    Icon: Clock,
  },
} satisfies Record<
  ChangelogType,
  {
    label: string;
    dot: string;
    borderColor: string;
    glowColor: string;
    accentBg: string;
    textColor: string;
    iconFill: string;
    metallicBg: string;
    neonShadow: string;
    hoverShadow: string;
    breathClass: string;
    offBorder: string;
    offBg: string;
    offIcon: string;
    topLight: string;
    topRim: string;
    Icon: React.ElementType;
  }
>;

/* ── Helper Functions ─────────────────────────────────────────── */

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Planned";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Planned";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Planned";
  }
}

function parseMarkdownContentToItems(
  docId: string,
  docTitle: string,
  content: string,
  dateStr?: string | null,
): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  const lines = content.split("\n");
  let currentType: ChangelogType = "feature";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.match(/^#+\s*(features|new features|feature|added)/i)) {
      currentType = "feature";
      continue;
    } else if (line.match(/^#+\s*(fixes|improvements|fix|fixed|improved)/i)) {
      currentType = "fix";
      continue;
    } else if (line.match(/^#+\s*(upcoming|next|future)/i)) {
      currentType = "upcoming";
      continue;
    }

    if (
      line.startsWith("-") ||
      line.startsWith("*") ||
      line.match(/^\d+\.\s/)
    ) {
      let text = line.replace(/^([-*]|\d+\.)\s*/, "").trim();
      const match = text.match(/(.*)\s*<!--\s*(.*?)\s*-->/);
      let itemDate = dateStr;

      if (match) {
        text = match[1].trim();
        const extractedDate = match[2].trim();
        if (extractedDate && !extractedDate.startsWith("separator:")) {
          itemDate = extractedDate;
        }
      }

      if (text && !text.includes("──────────────────────────────")) {
        items.push({
          id: `${docId}-${items.length}`,
          type: currentType,
          title: text.length > 60 ? text.substring(0, 60) + "..." : text,
          description: text,
          date: itemDate,
        });
      }
    }
  }

  if (items.length === 0 && (docTitle || content)) {
    items.push({
      id: docId,
      type: "feature",
      title: docTitle || "System Update",
      description:
        content.replace(/#+\s*/g, "").trim() ||
        "Performance enhancements and general stability fixes.",
      date: dateStr,
    });
  }

  return items;
}

/* ── Main Component ───────────────────────────────────────────── */

export default function PatchNotesPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [entries, setEntries] = useState<ChangelogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [tabProgress, setTabProgress] = useState<Record<TabFilter, number>>({
    all: 0,
    feature: 0,
    fix: 0,
    upcoming: 0,
  });

  const [tabLitUp, setTabLitUp] = useState<
    Record<TabFilter, Record<string, boolean>>
  >({
    all: {},
    feature: {},
    fix: {},
    upcoming: {},
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const tabMaxProgressRef = useRef<Record<TabFilter, number>>({
    all: 0,
    feature: 0,
    fix: 0,
    upcoming: 0,
  });

  useEffect(() => {
    if (loading) return;

    const handleScroll = () => {
      const totalScrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const raw =
        totalScrollable > 0
          ? Math.min(Math.max(window.scrollY / totalScrollable, 0), 1)
          : 0;

      const currentMax = Math.max(
        tabMaxProgressRef.current[activeTab] || 0,
        raw,
      );
      tabMaxProgressRef.current[activeTab] = currentMax;

      setTabProgress((prev) =>
        prev[activeTab] === currentMax
          ? prev
          : { ...prev, [activeTab]: currentMax },
      );

      const timeline = timelineRef.current;
      if (!timeline) return;

      const timelineRect = timeline.getBoundingClientRect();
      const fillHeight = currentMax * timeline.clientHeight;

      elementRefs.current.forEach((el, id) => {
        if (!el) return;
        const markerCenterY =
          el.getBoundingClientRect().top - timelineRect.top + 30;
        if (fillHeight >= markerCenterY) {
          setTabLitUp((prev) => {
            const currentTabMap = prev[activeTab] || {};
            if (currentTabMap[id]) return prev;
            return {
              ...prev,
              [activeTab]: {
                ...currentTabMap,
                [id]: true,
              },
            };
          });
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const raf = requestAnimationFrame(handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(raf);
    };
  }, [loading, activeTab, entries]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/changelog")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (
          data.entries &&
          Array.isArray(data.entries) &&
          data.entries.length > 0
        ) {
          const parsedList: ChangelogItem[] = [];

          data.entries.forEach(
            (doc: {
              id: string;
              type?: string;
              description?: string;
              title?: string;
              date?: string;
              createdAt?: string;
              imageUrl?: string;
              order?: number;
              content?: string;
            }) => {
              if (doc.type && doc.description) {
                parsedList.push({
                  id: doc.id,
                  type: doc.type as ChangelogType,
                  title: doc.title ?? "",
                  description: doc.description,
                  date: doc.date || doc.createdAt,
                  imageUrl: doc.imageUrl,
                  order: doc.order,
                });
              } else if (doc.content) {
                const items = parseMarkdownContentToItems(
                  doc.id,
                  doc.title ?? "",
                  doc.content,
                  doc.createdAt,
                );
                parsedList.push(...items);
              }
            },
          );

          if (parsedList.length > 0) {
            setEntries(parsedList);
          } else {
            setEntries(defaultTimelineEntries);
          }
        } else {
          setEntries(defaultTimelineEntries);
        }
      })
      .catch((err) => {
        console.error("Failed to load changelog entries:", err);
        if (isMounted) setEntries(defaultTimelineEntries);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /* Filter and Sort Entries */
  const filteredEntries = useMemo(() => {
    let list = [...entries];
    if (activeTab !== "all") {
      list = list.filter((item) => item.type === activeTab);
    }
    return list.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined)
        return a.order - b.order;
      if (a.type === "upcoming" && b.type !== "upcoming") return -1;
      if (a.type !== "upcoming" && b.type === "upcoming") return 1;
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [entries, activeTab]);

  /* Newest shipped entry for the one-shot bloom */
  const newestShippedId = useMemo(() => {
    const shipped = entries.filter(
      (e): e is ChangelogItem & { date: string } =>
        e.type !== "upcoming" && Boolean(e.date),
    );
    if (shipped.length === 0) return null;
    let latest = shipped[0];
    let maxTime = new Date(latest.date).getTime();
    for (let i = 1; i < shipped.length; i++) {
      const time = new Date(shipped[i].date).getTime();
      if (time > maxTime) {
        maxTime = time;
        latest = shipped[i];
      }
    }
    return latest.id;
  }, [entries]);

  /* Shared IntersectionObserver */
  useEffect(() => {
    if (loading) return;
    observerRef.current = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-entry-id");
            if (id)
              setVisibleIds((prev) =>
                prev[id] ? prev : { ...prev, [id]: true },
              );
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    elementRefs.current.forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });
    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading, filteredEntries]);

  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      elementRefs.current.set(id, el);
      observerRef.current?.observe(el);
    } else {
      elementRefs.current.delete(id);
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<TabFilter, number> = { all: entries.length, feature: 0, fix: 0, upcoming: 0 };
    entries.forEach((e) => {
      if (e.type in counts) {
        counts[e.type as ChangelogType]++;
      }
    });
    return counts;
  }, [entries]);

  const tabsConfig: { id: TabFilter; label: string; color: string; glow: string }[] = [
    { id: "all", label: "ALL", color: "#C9B037", glow: "rgba(201,176,55,0.4)" },
    { id: "feature", label: "FEATURES", color: "#34d399", glow: "rgba(52,211,153,0.4)" },
    { id: "fix", label: "FIXES", color: "#f87171", glow: "rgba(248,113,113,0.4)" },
    { id: "upcoming", label: "UPCOMING", color: "#60a5fa", glow: "rgba(96,165,250,0.4)" },
  ];

  return (
    <main className="relative min-h-screen bg-[#0b0b0a] text-zinc-100 selection:bg-[#C9B037]/20 selection:text-[#C9B037] font-sans overflow-x-hidden">
      {/* ── Background ─────────────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden
      >
        {/*
          A single directional overhead cone — as if studio lights illuminate
          the page from above. One light source is intentional; three random
          floating blobs are not.
        */}
        <div className="absolute inset-x-0 top-0 h-[65vh] bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(201,176,55,0.065)_0%,transparent_78%)]" />

        {/* Grain texture via SVG feTurbulence — adds depth without floating blobs */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.028]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <filter id="pn-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pn-grain)" />
        </svg>
      </div>

      {/* ── Gold prism rim — the very top edge of the viewport ── */}
      <div
        className="fixed inset-x-0 top-0 h-[1px] z-[60] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(201,176,55,0.55) 35%, rgba(229,199,72,0.7) 50%, rgba(201,176,55,0.55) 65%, transparent 100%)",
        }}
      />

      {/* ── Navigation Header ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0b0b0a]/85 backdrop-blur-2xl">
        {/* Hairline separator */}
        <div
          className="absolute inset-x-0 bottom-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent 100%)",
          }}
        />
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-[14px] sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-3 font-pixelify text-base sm:text-lg font-bold text-zinc-400 hover:text-zinc-100 transition-colors duration-200"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] group-hover:border-white/[0.14] group-hover:bg-white/[0.06] transition-all duration-200">
              <ArrowLeft className="h-4.5 w-4.5 transition-transform duration-200 group-hover:-translate-x-px" />
            </span>
            <span>Back</span>
          </Link>

          <p className="font-pixelify text-xs sm:text-sm font-bold uppercase tracking-[0.2em] select-none flex items-center">
            {Array.from("Update Archive").map((char, index) => {
              if (char === " ") {
                return <span key={index} className="inline-block w-[0.35em]" />;
              }
              return (
                <span
                  key={index}
                  className="inline-block animate-letter-fade"
                  style={{
                    animationDelay: `${index * 0.12}s`,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </p>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        {/* Page Title — Centered Pixelify Sans Design */}
        <div className="mb-14 text-center">
          <h1 className="font-pixelify text-5xl sm:text-7xl font-bold tracking-normal text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]">
            Patch Notes
          </h1>
          <p className="font-pixelify mt-4 text-base sm:text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed tracking-wide">
            We hear your feedback | every feature, fix, and improvement starts with you.
          </p>
        </div>

        {/* ── Filter Tabs — Retro Arcade Switcher ──────── */}
        <div className="sticky top-[57px] z-40 -mx-4 px-4 bg-[#0b0b0a]/92 backdrop-blur-2xl sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none mb-12 flex justify-center w-full">
          <div className="p-1.5 sm:p-2.5 rounded-2xl bg-[#121110] border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.5)] inline-flex items-center justify-center gap-2 sm:gap-3 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabsConfig.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = tabCounts[tab.id];

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative group font-pixelify px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer select-none shrink-0 flex items-center gap-2 sm:gap-2.5 overflow-hidden",
                    "border-2",
                    isActive
                      ? "translate-y-[2px] shadow-[0_2px_0_0_#000000] text-white"
                      : "bg-[#191816] text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700 shadow-[0_4px_0_0_#000000,0_5px_0_0_rgba(255,255,255,0.03)] active:translate-y-[2px] active:shadow-[0_2px_0_0_#000]"
                  )}
                  style={
                    isActive
                      ? {
                        borderColor: tab.color,
                        backgroundColor: "#1c1b18",
                        boxShadow: `0 2px 0 0 #000000, 0 0 16px ${tab.glow}, inset 0 0 12px ${tab.glow}`,
                      }
                      : undefined
                  }
                >
                  {/* Scanline CRT overlay for active button */}
                  {isActive && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20 z-10"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.5) 50%)",
                        backgroundSize: "100% 4px",
                      }}
                    />
                  )}

                  {/* Laser Scanline Flash effect on active toggle */}
                  {isActive && (
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="absolute inset-y-0 w-1/2 pointer-events-none z-20"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${tab.color}, transparent)`,
                        opacity: 0.6,
                      }}
                    />
                  )}

                  {/* Arcade LED light dot */}
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300 shrink-0",
                      isActive
                        ? "shadow-[0_0_8px_currentColor]"
                        : "bg-zinc-700 opacity-50 group-hover:opacity-80"
                    )}
                    style={{
                      backgroundColor: isActive ? tab.color : undefined,
                      color: isActive ? tab.color : undefined,
                    }}
                  />

                  {/* Label */}
                  <span className="relative z-10">{tab.label}</span>

                  {/* Item count bracket */}
                  <span
                    className={cn(
                      "relative z-10 text-xs sm:text-sm font-black px-2 py-0.5 rounded-md transition-colors duration-200 font-pixelify",
                      isActive
                        ? "bg-black/50 text-white border border-white/20 shadow-sm"
                        : "bg-black/30 text-zinc-400 group-hover:text-zinc-200"
                    )}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-36">
            <div className="h-5 w-5 rounded-full border-[1.5px] border-white/[0.08] border-t-[#C9B037] animate-spin" />
          </div>
        ) : (
          /* ── Timeline ─────────────────────────────────────── */
          <div ref={timelineRef} className="relative pl-10 sm:pl-12 min-h-[500px]">
            {(() => {
              const currentTabProgress = tabProgress[activeTab] || 0;
              return (
                <div className="absolute left-[16px] sm:left-[20px] top-[-24px] bottom-3 w-[2px] bg-white/[0.08] pointer-events-none">
                  {/* Start dot at top — permanently lit on initial enter */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[#C9B037] shadow-[0_0_12px_#C9B037] z-20 ring-2 ring-zinc-950" />

                  {/* End dot at bottom — lights up when current tab progress reaches the end */}
                  <div
                    className={cn(
                      "absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full z-20 ring-2 ring-zinc-950 transition-all duration-300",
                      currentTabProgress >= 0.95
                        ? "bg-[#C9B037] shadow-[0_0_14px_#C9B037,0_0_24px_rgba(201,176,55,0.7)] opacity-100"
                        : "bg-[#1a1916] border border-white/15 shadow-none opacity-50"
                    )}
                  />

                  {/* Smooth dynamic scroll progress neon fill for current tab */}
                  <div
                    className="absolute inset-x-0 top-0 transition-[height] duration-300 ease-out"
                    style={{
                      height: `${currentTabProgress * 100}%`,
                      background:
                        "linear-gradient(to bottom, rgba(229,199,72,0.95) 0%, rgba(201,176,55,0.75) 70%, rgba(201,176,55,0.95) 100%)",
                      boxShadow: [
                        "0 0 3px rgba(229,199,72,0.9)",
                        "0 0 10px rgba(201,176,55,0.75)",
                        "0 0 20px rgba(201,176,55,0.45)",
                      ].join(", "),
                    }}
                  />
                </div>
              );
            })()}

            {/* Entries — animated at container level to prevent layout displacement */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="space-y-6"
              >
                {filteredEntries.map((item) => {
                  const cfg = typeConfig[item.type];
                  const { Icon } = cfg;
                  const isNewestShipped = item.id === newestShippedId;
                  const inView = !!visibleIds[item.id];
                  const isLitUp = !!(tabLitUp[activeTab]?.[item.id]);

                  return (
                    <div
                      key={item.id}
                      ref={setRef(item.id)}
                      data-entry-id={item.id}
                      className="relative group"
                    >
                      {/*
                        ── Timeline marker: Deep Metallic Glass ─────────────────
                        30 × 30 px capsule with a 3D dark metallic surface gradient
                        and top glass rim highlight.
                      */}
                      <div className="absolute left-[-24px] sm:left-[-28px] -translate-x-1/2 top-3.5 z-30 pointer-events-none">
                        <div
                          className={cn(
                            "h-[30px] w-[30px] rounded-full flex items-center justify-center relative overflow-hidden shadow-lg bg-[#0b0b0a]",
                            "ring-[4px] ring-[#0b0b0a]",
                            "transition-[border-color,box-shadow,background-image] duration-500 ease-out",
                            /* Breathing neon glow — newest shipped entry only, while lit */
                            isNewestShipped && isLitUp && cfg.breathClass,
                          )}
                          style={{
                            backgroundColor: "#0b0b0a",
                            backgroundImage: isLitUp ? cfg.metallicBg : "linear-gradient(135deg, #161514 0%, #0b0b0a 100%)",
                            border: `1.5px solid ${isLitUp ? cfg.dot : cfg.offBorder}`,
                            boxShadow: isLitUp
                              ? `inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 6px rgba(0,0,0,0.8), ${cfg.neonShadow}`
                              : `inset 0 1px 2px rgba(0,0,0,0.6)`,
                          }}
                        >
                          {/* Subtle top glass highlight rim */}
                          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.15] to-transparent pointer-events-none" />

                          <Icon
                            className="h-[13px] w-[13px] relative z-10 transition-colors duration-500 ease-out"
                            style={{
                              color: isLitUp ? cfg.dot : cfg.offIcon,
                            }}
                            strokeWidth={2.5}
                          />
                        </div>

                        {/* One-shot bloom ring for the newest shipped entry */}
                        {isNewestShipped && isLitUp && (
                          <motion.span
                            className="absolute rounded-full pointer-events-none"
                            style={{
                              inset: "-6px",
                              border: `1px solid ${cfg.dot}`,
                            }}
                            initial={{ scale: 0.5, opacity: 0.9 }}
                            animate={{ scale: 2.6, opacity: 0 }}
                            transition={{
                              duration: 1.2,
                              ease: "easeOut",
                              delay: 0.3,
                            }}
                          />
                        )}
                      </div>

                      {/* ── Card (Turned Off -> Scroll Power-On Reveal) ────── */}
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-[10px] bg-[#111110] transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          inView
                            ? "opacity-100 translate-y-0 scale-100 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
                            : "opacity-25 translate-y-8 scale-[0.98] shadow-none",
                        )}
                        style={{
                          border: `1px solid rgba(255,255,255,${inView ? "0.08" : "0.03"})`,
                          borderLeft: `2px solid ${inView ? cfg.borderColor : "rgba(255,255,255,0.04)"}`,
                        }}
                      >
                        {/* Diagonal catchlight */}
                        <div
                          className={cn(
                            "absolute inset-0 pointer-events-none transition-opacity duration-500",
                            inView ? "opacity-100" : "opacity-0",
                          )}
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 48%)",
                          }}
                        />

                        {/*
                          Top-light hover effect — two layers that fire in sequence
                          to simulate a ceiling fixture switching on:

                          1. Rim flash (300 ms)  — a bright 1 px line along the
                             top border, the "bulb" itself becoming visible.
                          2. Light cone (500 ms) — a radial ellipse whose origin
                             sits just above the card top, spilling downward like
                             light through a skylight.

                          Color is tinted to match the card's entry type so a
                          feature card glows amber, fix cards glow green, etc.
                        */}
                        <div className="relative z-10 p-5 sm:p-6">
                          {/* Type label + date */}
                          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                            <span
                              className={cn(
                                "font-pixelify text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors duration-500",
                                inView ? "" : "text-zinc-600",
                              )}
                              style={{
                                color: inView ? cfg.textColor : undefined,
                              }}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[11px] text-zinc-600 tabular-nums font-medium select-none">
                              {formatDate(item.date)}
                            </span>
                          </div>

                          {/* Title */}
                          <h3
                            className={cn(
                              "text-base font-bold tracking-tight sm:text-[1.05rem] leading-snug transition-colors duration-500",
                              inView
                                ? "text-white group-hover:text-zinc-100"
                                : "text-zinc-500",
                            )}
                          >
                            {item.title}
                          </h3>

                          {/* Description */}
                          <p
                            className={cn(
                              "mt-2 text-sm leading-relaxed font-normal transition-colors duration-500",
                              inView
                                ? "text-zinc-400 group-hover:text-zinc-300"
                                : "text-zinc-600",
                            )}
                          >
                            {item.description}
                          </p>

                          {/* Image (scroll-reveal) */}
                          {item.imageUrl && (
                            <div
                              className={cn(
                                "mt-5 overflow-hidden rounded-[10px] border aspect-video w-full relative transition-all duration-700 ease-out",
                                inView
                                  ? "opacity-100 translate-y-0 border-white/[0.08]"
                                  : "opacity-0 translate-y-4 border-transparent",
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                              />
                              {/* Bottom-up scrim for legibility */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty state */}
                {filteredEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-white/[0.06]">
                    <p className="text-sm text-zinc-500 font-medium">
                      Nothing in this category
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Try a different filter.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="mt-24 pt-8 text-center relative z-10">
          <div
            className="w-full h-[1px] mb-8"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)",
            }}
          />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#C9B037]/35 select-none">
            DangDoro — Stay focused
          </p>
          <p className="mt-2 text-[11px] text-zinc-700">
            © {new Date().getFullYear()} DangDoro. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
