"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChangelogItem, TabFilter } from "./changelog-types";
import { ChangelogCard } from "./ChangelogCard";

interface ChangelogTimelineProps {
  entries: ChangelogItem[];
  activeTab?: TabFilter;
  previewMode?: boolean;
  onReorder?: (entryId: string, direction: "up" | "down") => void;
  draftId?: string;
}

export function ChangelogTimeline({
  entries,
  activeTab = "all",
  previewMode = false,
  onReorder,
  draftId = "draft-preview",
}: ChangelogTimelineProps) {
  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const [tabProgress, setTabProgress] = useState<Record<TabFilter, number>>({
    all: previewMode ? 1 : 0,
    feature: previewMode ? 1 : 0,
    fix: previewMode ? 1 : 0,
    upcoming: previewMode ? 1 : 0,
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
    all: previewMode ? 1 : 0,
    feature: previewMode ? 1 : 0,
    fix: previewMode ? 1 : 0,
    upcoming: previewMode ? 1 : 0,
  });

  /* Filter and Sort Entries (Live draft preview card pinned at top in preview mode) */
  const filteredEntries = useMemo(() => {
    let list = [...entries];
    if (activeTab !== "all") {
      list = list.filter((item) => item.type === activeTab);
    }
    return list.sort((a, b) => {
      if (previewMode) {
        const isDraftA = a.id === "draft-preview" || a.id === draftId;
        const isDraftB = b.id === "draft-preview" || b.id === draftId;
        if (isDraftA) return -1;
        if (isDraftB) return 1;
      }

      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.type === "upcoming" && b.type !== "upcoming") return -1;
      if (a.type !== "upcoming" && b.type === "upcoming") return 1;
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [entries, activeTab, previewMode, draftId]);

  /* Newest shipped entry for bloom ring */
  const newestShippedId = useMemo(() => {
    const shipped = entries.filter(
      (e): e is ChangelogItem & { date: string } =>
        e.type !== "upcoming" && Boolean(e.date)
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

  /* Scroll handling for public page mode */
  useEffect(() => {
    if (previewMode) return;

    const handleScroll = () => {
      const totalScrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const raw =
        totalScrollable > 0
          ? Math.min(Math.max(window.scrollY / totalScrollable, 0), 1)
          : 0;

      const currentMax = Math.max(
        tabMaxProgressRef.current[activeTab] || 0,
        raw
      );
      tabMaxProgressRef.current[activeTab] = currentMax;

      setTabProgress((prev) =>
        prev[activeTab] === currentMax
          ? prev
          : { ...prev, [activeTab]: currentMax }
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
  }, [activeTab, entries, previewMode]);

  /* Shared IntersectionObserver for public page */
  useEffect(() => {
    if (previewMode) return;

    observerRef.current = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-entry-id");
            if (id) {
              setVisibleIds((prev) =>
                prev[id] ? prev : { ...prev, [id]: true }
              );
            }
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elementRefs.current.forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [filteredEntries, previewMode]);

  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      elementRefs.current.set(id, el);
      if (!previewMode) {
        observerRef.current?.observe(el);
      }
    } else {
      elementRefs.current.delete(id);
    }
  };

  const currentTabProgress = previewMode ? 1 : tabProgress[activeTab] || 0;

  return (
    <div ref={timelineRef} className="relative pl-10 sm:pl-12 min-h-[300px]">
      {/* Timeline line */}
      <div className="absolute left-[16px] sm:left-[20px] top-[-24px] bottom-3 w-[2px] bg-white/[0.08] pointer-events-none">
        {/* Start dot */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[#C9B037] shadow-[0_0_12px_#C9B037] z-20 ring-2 ring-zinc-950" />

        {/* End dot */}
        <div
          className={cn(
            "absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full z-20 ring-2 ring-zinc-950 transition-all duration-300",
            currentTabProgress >= 0.95
              ? "bg-[#C9B037] shadow-[0_0_14px_#C9B037,0_0_24px_rgba(201,176,55,0.7)] opacity-100"
              : "bg-[#1a1916] border border-white/15 shadow-none opacity-50"
          )}
        />

        {/* Dynamic neon progress fill */}
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

      {/* Card entries */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="space-y-6"
        >
          {filteredEntries.map((item, idx) => {
            const isNewestShipped = item.id === newestShippedId;
            const inView = previewMode ? true : !!visibleIds[item.id];
            const isLitUp = previewMode ? true : !!tabLitUp[activeTab]?.[item.id];
            const isDraft = item.id === "draft-preview" || item.id === draftId;

            return (
              <ChangelogCard
                key={item.id}
                item={item}
                inView={inView}
                isLitUp={isLitUp}
                isNewestShipped={isNewestShipped}
                setRef={setRef(item.id)}
                showReorder={previewMode && Boolean(onReorder) && !isDraft}
                onMoveUp={() => onReorder?.(item.id, "up")}
                onMoveDown={() => onReorder?.(item.id, "down")}
                isFirst={idx === 0 || (idx === 1 && (filteredEntries[0]?.id === "draft-preview" || filteredEntries[0]?.id === draftId))}
                isLast={idx === filteredEntries.length - 1}
              />
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
  );
}
