"use client";

import { useState } from "react";
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

export function PatchNotesModal({ isOpen, onClose }: PatchNotesModalProps) {
  const settingsGlassmorphism = useTimerStore((s) => s.settingsGlassmorphism);
  const [activeTab, setActiveTab] = useState(patchNotes.sections[0].id);

  const activeSection = patchNotes.sections.find((s) => s.id === activeTab)!;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-4xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden",
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
              <h3 className="text-lg font-black text-white">Patch Notes</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
                {patchNotes.date}
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
        <div className="px-6 pb-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection.items.length > 0 ? (
                <ul className="space-y-2.5">
                  {activeSection.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-zinc-300 leading-relaxed"
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", activeSection.dotColor)} />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-zinc-500 font-medium">Nothing here yet</p>
                  <p className="text-[11px] text-zinc-700 mt-1">Check back later for updates</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
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
