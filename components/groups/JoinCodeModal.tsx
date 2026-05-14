"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Key, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";

export function JoinCodeModal({ onClose, onJoin }: { onClose: () => void, onJoin: (code: string) => void }) {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const settingsGlassmorphism = useTimerStore(s => s.settingsGlassmorphism);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setLoading(true);
        await onJoin(code);
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-3xl" onClick={onClose} />
            
            {/* Cyber background effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[white]/5 blur-[120px] rounded-full" />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/[0.02]" />
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/[0.02]" />
            </div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                transition={{ type: "spring", stiffness: 400, damping: 32 }} 
                className={cn(
                    "relative w-full max-w-md border border-[white]/20 rounded-[10px] p-10 overflow-hidden", 
                    settingsGlassmorphism ? "bg-zinc-900/40 backdrop-blur-md" : "bg-zinc-900 shadow-[0_32px_100px_rgba(0,0,0,0.8)]"
                )}
            >
                {/* Decorative border elements */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[white]/30 rounded-tl-[10px]" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[white]/30 rounded-tr-[10px]" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[white]/30 rounded-bl-[10px]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[white]/30 rounded-br-[10px]" />

                <div className="text-center mb-10">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 bg-[white]/10 rounded-[10px] flex items-center justify-center mx-auto mb-6 border border-[white]/20 relative z-10 group">
                            <Key className="w-10 h-10 text-[white] group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 bg-[white]/20 blur-2xl rounded-full"
                        />
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tighter">Portal Entry</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-3">Authorize workspace connection</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="relative group">
                        <input 
                            autoFocus 
                            maxLength={6} 
                            value={code} 
                            onChange={(e) => setCode(e.target.value.toUpperCase())} 
                            placeholder="CODE" 
                            className="w-full bg-zinc-950/80 border-2 border-white/5 rounded-[10px] px-6 py-6 text-center text-4xl font-black tracking-[0.4em] text-white outline-none focus:border-[white]/50 transition-all placeholder:text-zinc-800 font-terminal shadow-inner" 
                        />
                        <div className="absolute inset-0 rounded-[10px] border border-[white]/0 group-focus-within:border-[white]/20 pointer-events-none transition-all duration-500" />
                    </div>
                    
                    <div className="space-y-4 pt-4">
                        <motion.button 
                            whileTap={{ scale: 0.98 }}
                            type="submit" 
                            disabled={loading || code.length < 6} 
                            className="w-full h-16 bg-[white] text-black font-black uppercase tracking-widest text-sm rounded-[10px] active:scale-98 transition-all shadow-none disabled:opacity-50 disabled:scale-100 disabled:shadow-none group relative overflow-hidden cursor-pointer"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? "Joining..." : "Join Group"}
                                {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                            </span>
                        </motion.button>
                        
                        <motion.button 
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={onClose}
                            className="w-full h-14 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-[10px] relative overflow-hidden cursor-pointer"
                        >
                            {/* Glass highlights */}
                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none" />
                            <div className="absolute inset-x-0 bottom-0 h-px border-b-[0.5px] border-white/5 pointer-events-none" />
                            Cancel
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}
