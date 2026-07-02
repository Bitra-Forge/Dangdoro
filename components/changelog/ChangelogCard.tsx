"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChangelogItem, typeConfig, formatDate } from "./changelog-types";

interface ChangelogCardProps {
  item: ChangelogItem;
  inView?: boolean;
  isLitUp?: boolean;
  isNewestShipped?: boolean;
  setRef?: (el: HTMLDivElement | null) => void;
  showReorder?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ChangelogCard({
  item,
  inView = true,
  isLitUp = true,
  isNewestShipped = false,
  setRef,
  showReorder = false,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}: ChangelogCardProps) {
  const cfg = typeConfig[item.type] || typeConfig.feature;
  const { Icon } = cfg;
  const mediaUrl = item.media?.url || item.imageUrl;

  return (
    <div
      ref={setRef}
      data-entry-id={item.id}
      className="relative group"
    >
      {/* ── Timeline marker: Deep Metallic Glass ── */}
      <div className="absolute left-[-24px] sm:left-[-28px] -translate-x-1/2 top-3.5 z-30 pointer-events-none">
        <div
          className={cn(
            "h-[30px] w-[30px] rounded-full flex items-center justify-center relative overflow-hidden shadow-lg bg-[#0b0b0a]",
            "ring-[4px] ring-[#0b0b0a]",
            "transition-[border-color,box-shadow,background-image] duration-500 ease-out",
            isNewestShipped && isLitUp && cfg.breathClass
          )}
          style={{
            backgroundColor: "#0b0b0a",
            backgroundImage: isLitUp
              ? cfg.metallicBg
              : "linear-gradient(135deg, #161514 0%, #0b0b0a 100%)",
            border: `1.5px solid ${isLitUp ? cfg.dot : cfg.offBorder}`,
            boxShadow: isLitUp
              ? `inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -2px 6px rgba(0,0,0,0.8), ${cfg.neonShadow}`
              : `inset 0 1px 2px rgba(0,0,0,0.6)`,
          }}
        >
          {/* Top glass highlight rim */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.15] to-transparent pointer-events-none" />

          <Icon
            className="h-[13px] w-[13px] relative z-10 transition-colors duration-500 ease-out"
            style={{
              color: isLitUp ? cfg.dot : cfg.offIcon,
            }}
            strokeWidth={2.5}
          />
        </div>

        {/* One-shot bloom ring for newest shipped entry */}
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

      {/* ── Card (Scroll Power-On Reveal) ── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[10px] bg-[#111110] transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)]",
          inView
            ? "opacity-100 translate-y-0 scale-100 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]"
            : "opacity-25 translate-y-8 scale-[0.98] shadow-none"
        )}
        style={{
          borderTop: `1.5px solid ${showReorder ? "rgba(201,176,55,0.25)" : `rgba(255,255,255,${inView ? "0.08" : "0.03"})`}`,
          borderRight: `1.5px solid ${showReorder ? "rgba(201,176,55,0.25)" : `rgba(255,255,255,${inView ? "0.08" : "0.03"})`}`,
          borderBottom: `1.5px solid ${showReorder ? "rgba(201,176,55,0.25)" : `rgba(255,255,255,${inView ? "0.08" : "0.03"})`}`,
          borderLeft: `3px solid ${inView ? cfg.borderColor : "rgba(255,255,255,0.04)"}`,
        }}
      >
        {/* Diagonal catchlight */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-500",
            inView ? "opacity-100" : "opacity-0"
          )}
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 48%)",
          }}
        />

        <div className="relative z-10 p-5 sm:p-6">
          {/* Type label + date / status + Reorder arrows */}
          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-pixelify text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors duration-500",
                  inView ? "" : "text-zinc-600"
                )}
                style={{
                  color: inView ? cfg.textColor : undefined,
                }}
              >
                {cfg.label}
              </span>

              {showReorder && (
                <div className="flex items-center gap-0.5 bg-black/70 p-1 rounded-lg border border-white/15 ml-1 z-20 shadow-md">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMoveUp?.();
                    }}
                    disabled={isFirst}
                    className="p-1 rounded hover:bg-white/15 text-zinc-300 hover:text-white disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
                    title="Move Up in Preview"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-px h-3 bg-white/10" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMoveDown?.();
                    }}
                    disabled={isLast}
                    className="p-1 rounded hover:bg-white/15 text-zinc-300 hover:text-white disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95"
                    title="Move Down in Preview"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <span className="text-[11px] text-zinc-500 tabular-nums font-medium select-none flex items-center gap-2">
              {item.type === "upcoming" && item.status ? (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                    item.status === "in-progress"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  )}
                >
                  {item.status === "in-progress" ? "In Progress" : "Planned"}
                </span>
              ) : (
                <span>{formatDate(item)}</span>
              )}
            </span>
          </div>

          {/* Title */}
          <h3
            className={cn(
              "text-base font-bold tracking-tight sm:text-[1.05rem] leading-snug transition-colors duration-500",
              inView
                ? "text-white group-hover:text-zinc-100"
                : "text-zinc-500"
            )}
          >
            {item.title}
          </h3>

          {/* Description */}
          <p
            className={cn(
              "mt-2 text-sm leading-relaxed font-normal transition-colors duration-500 whitespace-pre-wrap",
              inView
                ? "text-zinc-400 group-hover:text-zinc-300"
                : "text-zinc-600"
            )}
          >
            {item.description}
          </p>

          {/* Media Attachment (Image or GIF) */}
          {mediaUrl && (
            <div
              className={cn(
                "mt-5 overflow-hidden rounded-[10px] border aspect-video w-full relative transition-all duration-700 ease-out bg-black/40",
                inView
                  ? "opacity-100 translate-y-0 border-white/[0.08]"
                  : "opacity-0 translate-y-4 border-transparent"
              )}
            >
              <Image
                src={mediaUrl}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                sizes="(max-width: 768px) 100vw, 672px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
