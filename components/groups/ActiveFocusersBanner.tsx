"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const ActiveFocusersBanner = memo(function ActiveFocusersBanner({ focusers }: { focusers: any[] }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-[10px] border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-zinc-900/60 p-4 flex items-center gap-4 overflow-hidden relative shadow-[0_4px_24px_rgba(249,115,22,0.08)]"
        >
            {/* Shimmer sweep */}
            <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-indigo-400/8 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Live indicator */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-indigo-400" />
                    </div>
                    <motion.div
                        animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                        className="absolute inset-0 rounded-2xl bg-indigo-500/25"
                    />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.25em] leading-none mb-1">Live Wave</span>
                    <span className="text-xs font-black text-white tracking-tight leading-none uppercase">{focusers.length} {focusers.length === 1 ? "Focuser" : "Focusers"}</span>
                </div>
            </div>

            <div className="h-8 w-px bg-white/5 mx-2" />

            {/* Avatars */}
            <div className="flex -space-x-2 overflow-hidden flex-1">
                {focusers.slice(0, 10).map((f: any, i: number) => {
                    const isPaused = f.status === "paused";
                    return (
                        <div key={f.uid} className="relative">
                            <Avatar className="w-8 h-8 rounded-xl overflow-hidden border border-zinc-950 bg-zinc-900">
                                <AvatarImage src={f.photoURL} className="rounded-xl" />
                                <AvatarFallback className="text-[8px] bg-zinc-800 text-white rounded-xl">{f.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-950",
                                isPaused ? "bg-amber-500" : "bg-indigo-500"
                            )} />
                        </div>
                    );
                })}
                {focusers.length > 10 && (
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[8px] font-black text-zinc-500">
                        +{focusers.length - 10}
                    </div>
                )}
            </div>
        </motion.div>
    );
});
