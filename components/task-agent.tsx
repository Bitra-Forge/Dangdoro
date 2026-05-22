"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Check, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";


interface Message {
    role: "user" | "assistant";
    content: string;
}

interface GeneratedGroup {
    name: string;
    color: string;
    tasks: {
        title: string;
        priority: "urgent" | "high" | "normal" | "natural";
        durationMinutes: number | null;
        notes: string;
    }[];
}

interface TaskAgentProps {
    onApply: (groups: GeneratedGroup[]) => void;
    onClose: () => void;
}

const priorityConfig: Record<string, { dot: string; label: string }> = {
    urgent: { dot: "bg-red-500", label: "Urgent" },
    high: { dot: "bg-orange-400", label: "High" },
    normal: { dot: "bg-sky-400", label: "Normal" },
    natural: { dot: "bg-zinc-600", label: "Natural" },
};

const groupColorDot: Record<string, string> = {
    zinc: "bg-zinc-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    cyan: "bg-cyan-500",
};

export function TaskAgent({ onApply, onClose }: TaskAgentProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Tell me what you need to get done — I'll break it into groups and tasks for your board.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [pendingGroups, setPendingGroups] = useState<GeneratedGroup[] | null>(null);
    const [applying, setApplying] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 200);
    }, []);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: "user", content: input.trim() };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput("");
        setLoading(true);
        setPendingGroups(null);

        try {
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch("/api/generate-tasks", {
                method: "POST",
                headers,
                body: JSON.stringify({ messages: newMessages }),
            });

            if (!res.ok) throw new Error("API error");

            const data = await res.json();
            const parsed = data.response;

            if (parsed?.groups && Array.isArray(parsed.groups)) {
                setPendingGroups(parsed.groups);
                const total = parsed.groups.reduce((s: number, g: GeneratedGroup) => s + g.tasks.length, 0);
                setMessages([
                    ...newMessages,
                    {
                        role: "assistant",
                        content: `Created ${total} tasks across ${parsed.groups.length} group${parsed.groups.length > 1 ? "s" : ""}. Review below and apply when ready.`,
                    },
                ]);
            } else if (parsed?.message) {
                setMessages([...newMessages, { role: "assistant", content: parsed.message }]);
            } else if (parsed?.error) {
                throw new Error(parsed.error);
            } else {
                setMessages([
                    ...newMessages,
                    { role: "assistant", content: "Couldn't parse that into tasks. Try rephrasing what you need to get done." }
                ]);
            }
        } catch {
            setMessages([
                ...newMessages,
                { role: "assistant", content: "Something went wrong. Please try again." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!pendingGroups?.length || applying) return;
        setApplying(true);
        await onApply(pendingGroups);
        setApplying(false);
        setPendingGroups(null);
        toast.success("Tasks added to your board");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
        el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
        el.style.scrollbarWidth = "none";
    };

    return (
        <div className="fixed right-4 top-4 bottom-20 z-[101] w-[400px] animate-in slide-in-from-right-6 fade-in duration-300">
            <div className="flex flex-col h-full bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden">

                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent pointer-events-none" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="relative">
                            <Sparkles className="w-4 h-4 text-white/70" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-white tracking-tight">
                                Focus Planner
                            </span>
                            <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-wider">
                                AI Task Architect
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white/5 text-zinc-600 hover:text-white transition-all relative z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
                    <AnimatePresence initial={false}>
                        {messages.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                            >
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed",
                                    msg.role === "user"
                                        ? "bg-white/10 text-zinc-100 border border-white/10 rounded-br-md"
                                        : "bg-zinc-900/60 text-zinc-400 border border-white/5 rounded-bl-md"
                                )}>
                                    {msg.content}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start"
                        >
                            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                                <span className="text-[11px] text-zinc-600 font-medium">Planning…</span>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Generated groups preview */}
                <AnimatePresence>
                    {pendingGroups && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-white/5 flex-shrink-0 overflow-hidden"
                        >
                            <div className="px-4 py-3 bg-gradient-to-b from-white/[0.02] to-transparent">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-3 h-3 text-white/40" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Generated Plan</span>
                                </div>
                                <div className="space-y-3 max-h-48 overflow-y-auto mb-3" style={{ scrollbarWidth: "none" }}>
                                    {pendingGroups.map((group, gi) => (
                                        <motion.div
                                            key={gi}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: gi * 0.08 }}
                                            className="bg-zinc-900/40 border border-white/5 rounded-xl p-3"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={cn("w-2.5 h-2.5 rounded-full", groupColorDot[group.color] ?? "bg-zinc-500")} />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-white/70">{group.name}</span>
                                                <span className="text-[9px] text-zinc-600 font-bold ml-auto">{group.tasks.length} tasks</span>
                                            </div>
                                            <div className="space-y-1">
                                                {group.tasks.map((task, ti) => {
                                                    const p = priorityConfig[task.priority] ?? priorityConfig.natural;
                                                    return (
                                                        <div key={ti} className="flex items-center gap-2 py-0.5">
                                                            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", p.dot)} />
                                                            <span className="text-[11px] text-zinc-400 truncate flex-1">{task.title}</span>
                                                            {task.durationMinutes && (
                                                                <span className="flex items-center gap-0.5 text-[9px] text-zinc-600 flex-shrink-0">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    {task.durationMinutes}m
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleApply}
                                    disabled={applying}
                                    className="w-full h-9 rounded-full border-none bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden group/apply"
                                >
                                    <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                    <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                    <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                                    {applying ? (
                                        <span className="relative z-10 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Adding…</span>
                                    ) : (
                                        <span className="relative z-10 flex items-center gap-1.5"><Check className="w-3 h-3" /> Apply to Board</span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input */}
                <div className="p-4 border-t border-white/5 flex-shrink-0 bg-gradient-to-t from-white/[0.02] to-transparent">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={autoResizeTextarea}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe what you need to accomplish…"
                                rows={1}
                                className="task-agent-input w-full rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-white/25 transition-colors resize-none leading-tight"
                                style={{ overflow: "hidden" }}
                            />
                        </div>
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || loading}
                            className={cn(
                                "h-10 w-10 rounded-xl transition-all inline-flex items-center justify-center shrink-0",
                                input.trim() && !loading
                                    ? "bg-white text-black hover:bg-zinc-200 hover:shadow-[0_8px_20px_rgba(255,255,255,0.15)]"
                                    : "bg-white/5 text-zinc-700 cursor-not-allowed"
                            )}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`.task-agent-input::-webkit-scrollbar { display: none; }`}</style>
        </div>
    );
}
