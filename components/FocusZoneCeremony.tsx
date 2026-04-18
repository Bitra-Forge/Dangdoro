"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Flame, Shield, Zap, Target } from "lucide-react";

interface FocusZoneCeremonyProps {
    isOpen: boolean;
    onComplete: () => void;
    groupName: string;
}

export function FocusZoneCeremony({ isOpen, onComplete, groupName }: FocusZoneCeremonyProps) {
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        if (!isOpen) {
            setCountdown(3);
            return;
        }

        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(onComplete, 1000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, countdown, onComplete]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0D0C0A] overflow-hidden"
                >
                    {/* Background Visuals */}
                    <div className="absolute inset-0 pointer-events-none">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.2, opacity: 0.1 }}
                            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
                            className="absolute inset-0 bg-gradient-to-br from-[#E8821A] via-transparent to-transparent opacity-10" 
                        />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(232,130,26,0.1)_0%,transparent_70%)]" />
                    </div>

                    <div className="relative z-10 text-center space-y-8">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-2"
                        >
                            <span className="text-[10px] font-black tracking-[0.4em] text-[#C9B037] uppercase">Tactical Deployment</span>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
                                Entering <span className="text-[#E8821A]">The Forge</span>
                            </h1>
                            <p className="text-zinc-500 font-medium">{groupName} • Resonance Establishing</p>
                        </motion.div>

                        <motion.div
                            key={countdown}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.5, opacity: 0 }}
                            className="text-8xl md:text-9xl font-black text-white font-terminal"
                        >
                            {countdown > 0 ? countdown : <Flame className="w-32 h-32 mx-auto text-[#E8821A] animate-pulse" />}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex items-center justify-center gap-8 pt-8"
                        >
                            {[
                                { icon: Shield, label: "Deep Work" },
                                { icon: target === "target" ? Target : Zap, label: "Zero Distraction" },
                                { icon: Flame, label: "High Synergy" }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <item.icon className="w-5 h-5 text-[#C9B037]" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{item.label}</span>
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Scanline effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const target = "target"; // Fix for target is not defined
