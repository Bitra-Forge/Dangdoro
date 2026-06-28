"use client";

import { useRouter } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlannerStore } from "@/lib/stores/planner-store";

export function PlannerNotification() {
    const notification = usePlannerStore((s) => s.notification);
    const clearNotification = usePlannerStore((s) => s.clearNotification);
    const router = useRouter();

    const handleClick = () => {
        clearNotification();
        router.push("/tasks");
    };

    return (
        <AnimatePresence>
            {notification && (
                <motion.button
                    onClick={handleClick}
                    initial={{ opacity: 0, y: -40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -40, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] cursor-pointer group"
                >
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[13px] text-zinc-200 font-medium whitespace-nowrap">
                        {notification.message}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            clearNotification();
                        }}
                        className="p-1 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
