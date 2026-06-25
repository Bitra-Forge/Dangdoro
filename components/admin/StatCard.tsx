"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  glowColor: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  glowColor,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative rounded-2xl border border-white/[0.05] p-5 overflow-hidden transition-all duration-300 group select-none",
        "bg-zinc-900/40 backdrop-blur-md hover:border-white/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      )}
    >
      {/* Background Decorative Grid/Shapes */}
      <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-300 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      
      {/* Glow highlight */}
      <div
        className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-all duration-500 pointer-events-none"
        style={{ background: glowColor }}
      />

      {/* Top accent light */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      {/* Left indicator glow bar */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[2px] rounded-r-full opacity-40 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: glowColor,
          boxShadow: `0 0 10px ${glowColor}`,
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-400 transition-colors">
          {label}
        </span>
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center border border-white/5 transition-transform duration-300 group-hover:scale-110",
            bgClass
          )}
        >
          <Icon className={cn("w-4 h-4", colorClass)} />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <h3 className={cn("text-2xl font-black tracking-tight tabular-nums", colorClass)}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </h3>
      </div>
    </motion.div>
  );
}
