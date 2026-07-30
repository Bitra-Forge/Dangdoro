import React from "react";
import { Sparkles, CheckCircle2, Clock } from "lucide-react";

export type ChangelogType = "feature" | "fix" | "upcoming";
export type UpcomingStatus = "planned" | "in-progress";
export type TabFilter = "all" | "feature" | "fix" | "upcoming";

export interface ChangelogMedia {
  url: string;
  type: "image" | "gif";
}

export interface ChangelogItem {
  id: string;
  type: ChangelogType;
  title: string;
  description: string;
  date?: string | null;
  status?: UpcomingStatus | null;
  media?: ChangelogMedia | null;
  imageUrl?: string | null; // fallback for legacy entries
  order?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TypeConfig {
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

export const typeConfig: Record<ChangelogType, TypeConfig> = {
  feature: {
    label: "New Feature",
    dot: "#34d399",
    borderColor: "rgba(52,211,153,0.28)",
    glowColor: "rgba(52,211,153,0.18)",
    accentBg: "rgba(52,211,153,0.07)",
    textColor: "#34d399",
    iconFill: "rgba(52,211,153,0.14)",
    metallicBg: "linear-gradient(135deg, #192b23 0%, #0e1210 100%)",
    neonShadow:
      "0 0 4px #34d399, 0 0 10px rgba(52,211,153,0.75), 0 0 22px rgba(52,211,153,0.4), 0 0 42px rgba(52,211,153,0.15)",
    hoverShadow:
      "0 0 8px #34d399, 0 0 24px rgba(52,211,153,0.95), 0 0 48px rgba(52,211,153,0.75), 0 0 80px rgba(52,211,153,0.45)",
    breathClass: "neon-breath-emerald",
    offBorder: "rgba(52,211,153,0.16)",
    offBg: "rgba(52,211,153,0.03)",
    offIcon: "rgba(52,211,153,0.22)",
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
};

export const tabsConfig: { id: TabFilter; label: string; color: string; glow: string }[] = [
  { id: "all", label: "ALL", color: "#C9B037", glow: "rgba(201,176,55,0.4)" },
  { id: "feature", label: "FEATURES", color: "#34d399", glow: "rgba(52,211,153,0.4)" },
  { id: "fix", label: "FIXES", color: "#f87171", glow: "rgba(248,113,113,0.4)" },
  { id: "upcoming", label: "UPCOMING", color: "#60a5fa", glow: "rgba(96,165,250,0.4)" },
];

export function formatDate(item: ChangelogItem): string {
  if (item.type === "upcoming") {
    if (item.status === "in-progress") return "In Progress";
    return "Planned";
  }
  if (!item.date) return "Planned";
  try {
    const d = new Date(item.date);
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
