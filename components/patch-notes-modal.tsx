"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Wrench, Clock, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const patchNotes = {
  version: "2.0.0",
  date: "June 6, 2026",
  sections: [
    {
      id: "features",
      title: "New Features",
      icon: Sparkles,
      color: "text-yellow-400",
      dotColor: "bg-yellow-400",
      borderColor: "border-yellow-400/40",
      activeBg: "bg-yellow-400/15",
      items: [] as string[],
    },
    {
      id: "fixes",
      title: "Fixes & Improvements",
      icon: Wrench,
      color: "text-emerald-400",
      dotColor: "bg-emerald-400",
      borderColor: "border-emerald-400/40",
      activeBg: "bg-emerald-400/15",
      items: [] as string[],
    },
    {
      id: "upcoming",
      title: "Upcoming",
      icon: Clock,
      color: "text-sky-400",
      dotColor: "bg-sky-400",
      borderColor: "border-sky-400/40",
      activeBg: "bg-sky-400/15",
      items: [] as string[],
    },
  ],
};

interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string | null;
}

export function PatchNotesModal({ isOpen, onClose }: PatchNotesModalProps) {
  const settingsGlassmorphism = useTimerStore((s) => s.settingsGlassmorphism);
  const [activeTab, setActiveTab] = useState(patchNotes.sections[0].id);
  const [latestEntry, setLatestEntry] = useState<ChangelogEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    let active = true;
    
    // Set loading asynchronously to avoid React state-in-effect warning
    const timer = setTimeout(() => {
      if (active) setLoading(true);
    }, 0);

    fetch("/api/changelog")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.entries && data.entries.length > 0) {
          setLatestEntry(data.entries[0]);
        }
      })
      .catch((err) => console.error("Error loading patch notes:", err))
      .finally(() => {
        if (active) {
          clearTimeout(timer);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen]);

  const activeSection = patchNotes.sections.find((s) => s.id === activeTab)!;

  const parsed = latestEntry ? parseChangelogContent(latestEntry.content) : null;
  const hasParsedItems = parsed && (parsed.features.length > 0 || parsed.fixes.length > 0 || parsed.upcoming.length > 0);
  const items = parsed ? parsed[activeTab as keyof typeof parsed] : [];


  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[130] flex items-end md:items-center md:justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full md:max-w-4xl border border-white/10 shadow-2xl overflow-hidden flex flex-col",
          "rounded-t-3xl md:rounded-3xl",
          "max-h-[85vh]",
          "pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6",
          settingsGlassmorphism
            ? "bg-zinc-900/80 backdrop-blur-md"
            : "bg-zinc-900"
        )}
      >
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/15 shadow-inner shrink-0">
              <ScrollText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                {latestEntry ? latestEntry.title : "Patch Notes"}
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
                {latestEntry?.createdAt
                  ? new Date(latestEntry.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : patchNotes.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-zinc-500 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="px-6 pb-4">
          <div className="flex gap-1.5">
            {patchNotes.sections.map((section) => {
              const isActive = activeTab === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={cn(
                    "flex-1 py-2.5 px-3 text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer rounded-full border-t-[0.5px] border-b-[0.5px]",
                    isActive
                      ? "text-white bg-white/[0.08] backdrop-blur-sm border-white/25 border-b-white/15"
                      : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5 border-white/10 border-b-white/5 hover:border-white/20"
                  )}
                >
                  <span>{section.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-5 min-h-[200px] flex-1 md:min-h-[320px] md:flex-none md:max-h-[420px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : latestEntry ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {hasParsedItems ? (
                  items.length > 0 ? (
                    <ul className="space-y-2.5">
                      {(() => {
                        let dividerCount = 0;
                        return items.map((item, idx) => {
                          const isSepNew = item.includes("<!-- separator:new -->");
                          const isSepPrev = item.includes("<!-- separator:previous -->") || (!isSepNew && (item.trim().replace(/[-─*]/g, "").length === 0 || item.includes("<!-- separator:")));
                          const isSep = isSepNew || isSepPrev;

                          if (isSep) {
                            dividerCount++;
                            const label = dividerCount === 1 ? "NEW" : "PREVIOUS";
                            return (
                              <li key={idx} className="w-full py-1">
                                <div className="flex items-center gap-3 w-full select-none">
                                  <div className="h-px bg-white/10 flex-1" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 shrink-0">
                                    {label}
                                  </span>
                                  <div className="h-px bg-white/10 flex-1" />
                                </div>
                              </li>
                            );
                          }

                          const match = item.match(/(.*)\s*<!--\s*(.*?)\s*-->/);
                          const text = match ? match[1].trim() : item;
                          const dateStr = match
                            ? match[2].trim()
                            : (latestEntry?.createdAt
                                ? new Date(latestEntry.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : null);

                          return (
                            <li
                              key={idx}
                              className="flex items-start justify-between gap-3 text-sm text-zinc-300 leading-relaxed select-text w-full"
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <span className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", activeSection.dotColor)} />
                                <span>{text}</span>
                              </div>
                              {dateStr && (
                                <span className="text-[10px] text-zinc-500 shrink-0 font-medium tabular-nums mt-0.5 select-none">
                                  {dateStr}
                                </span>
                              )}
                            </li>
                          );
                        });
                      })()}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-sm text-zinc-500 font-medium">Nothing in this category</p>
                      <p className="text-[11px] text-zinc-600 mt-1">Select another tab to see updates</p>
                    </div>
                  )
                ) : (
                  /* Plain Text fallback */
                  <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap select-text px-1 bg-black/10 rounded-2xl p-4 border border-white/[0.02]">
                    {latestEntry.content}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-zinc-500 font-medium">Nothing here yet</p>
              <p className="text-[11px] text-zinc-700 mt-1">Check back later for updates</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2">
          <p className="text-[10px] text-zinc-700 uppercase tracking-widest text-center font-medium">
            Stay focused. Stay winning.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function parseChangelogContent(content: string) {
  const sections = {
    features: [] as string[],
    fixes: [] as string[],
    upcoming: [] as string[],
  };

  const lines = content.split("\n");
  let currentSection: "features" | "fixes" | "upcoming" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.match(/^#+\s*(features|new features|feature|added)/i)) {
      currentSection = "features";
      continue;
    } else if (trimmed.match(/^#+\s*(fixes|improvements|fix|fixed|improved)/i)) {
      currentSection = "fixes";
      continue;
    } else if (trimmed.match(/^#+\s*(upcoming|next|future)/i)) {
      currentSection = "upcoming";
      continue;
    }

    if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      const itemContent = trimmed.substring(1).trim();
      if (currentSection) {
        sections[currentSection].push(itemContent);
      } else {
        sections.features.push(itemContent);
      }
    } else if (trimmed.match(/^\d+\.\s/)) {
      const itemContent = trimmed.replace(/^\d+\.\s/, "").trim();
      if (currentSection) {
        sections[currentSection].push(itemContent);
      } else {
        sections.features.push(itemContent);
      }
    }
  }

  return sections;
}

