"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChangelogItem, TabFilter, ChangelogType, tabsConfig } from "./changelog-types";

interface ChangelogTabsProps {
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
  entries: ChangelogItem[];
  className?: string;
  compact?: boolean;
}

export function ChangelogTabs({
  activeTab,
  onTabChange,
  entries,
  className,
  compact = false,
}: ChangelogTabsProps) {
  const tabCounts = useMemo(() => {
    const counts: Record<TabFilter, number> = {
      all: entries.length,
      feature: 0,
      fix: 0,
      upcoming: 0,
    };
    entries.forEach((e) => {
      if (e.type in counts) {
        counts[e.type as ChangelogType]++;
      }
    });
    return counts;
  }, [entries]);

  return (
    <div className={cn("flex justify-center w-auto sm:w-full", className)}>
      <div
        className={cn(
          "bg-[#121110] border-y border-x-0 sm:border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex sm:inline-flex items-center justify-start sm:justify-center w-full sm:w-auto max-w-full overflow-x-auto scrollbar-none",
          compact
            ? "py-1 rounded-none sm:p-1.5 sm:rounded-xl gap-1.5 sm:gap-2"
            : "py-1.5 rounded-none gap-2 sm:p-2.5 sm:rounded-2xl sm:gap-3"
        )}
      >
        {/* Mobile scroll padding start */}
        <div className="w-4 sm:hidden shrink-0" />
        {tabsConfig.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative group font-pixelify font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer select-none shrink-0 flex items-center overflow-hidden border-2",
                compact
                  ? "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs gap-1 sm:gap-2"
                  : "px-2 py-1 rounded-lg text-[10px] gap-1 sm:px-5 sm:py-2.5 sm:rounded-xl sm:text-sm sm:gap-2.5",
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
                  "rounded-full transition-all duration-300 shrink-0",
                  compact ? "w-1.5 h-1.5" : "w-1.5 h-1.5 sm:w-2 sm:h-2",
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
                  "relative z-10 font-black rounded-md transition-colors duration-200 font-pixelify",
                  compact
                    ? "text-[9px] sm:text-[10px] px-1.5 py-0.2"
                    : "text-[9px] px-1.5 py-0.2 sm:text-xs sm:px-2 sm:py-0.5",
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

        {/* Mobile scroll padding end */}
        <div className="w-4 sm:hidden shrink-0" />
      </div>
    </div>
  );
}
