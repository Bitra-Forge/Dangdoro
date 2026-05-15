"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export function TaskAgent({ onApply, onClose }: TaskAgentProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! Tell me what you need to get done and I'll organize it into tasks for you.",
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
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: "user", content: input.trim() };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput("");
        setLoading(true);
        setPendingGroups(null);

        try {
            const res = await fetch("/api/generate-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages }),
            });

            if (!res.ok) throw new Error("API error");

            const data = await res.json();
            const text = data.response;

            let parsed: any;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            }

            if (parsed?.groups && Array.isArray(parsed.groups)) {
                setPendingGroups(parsed.groups);
                setMessages([
                    ...newMessages,
                    {
                        role: "assistant",
                        content: `I've created ${parsed.groups.length} group${parsed.groups.length > 1 ? "s" : ""} with tasks for you. Review below and hit "Apply" to add them to your board.`,
                    },
                ]);
            } else if (parsed?.message) {
                setMessages([...newMessages, { role: "assistant", content: parsed.message }]);
            } else {
                setMessages([...newMessages, { role: "assistant", content: text }]);
            }
        } catch {
            setMessages([
                ...newMessages,
                { role: "assistant", content: "Sorry, something went wrong. Please try again." },
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
        toast.success("Tasks added to your board!");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const priorityConfig: Record<string, { dot: string; label: string }> = {
        urgent: { dot: "bg-red-500", label: "Urgent" },
        high: { dot: "bg-orange-400", label: "High" },
        normal: { dot: "bg-sky-400", label: "Normal" },
        natural: { dot: "bg-zinc-600", label: "Natural" },
    };

    return (
        <div className="fixed right-4 top-20 bottom-20 z-40 w-96 flex flex-col bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 flex-shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-widest text-white flex-1">Task Agent</span>
                <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "none" }}>
                {messages.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                            msg.role === "user"
                                ? "bg-emerald-500/20 text-emerald-100 border border-emerald-500/20"
                                : "bg-white/5 text-zinc-300 border border-white/5"
                        )}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                            <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                            <span className="text-xs text-zinc-500">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Pending Groups Preview */}
            {pendingGroups && (
                <div className="px-4 pb-3 flex-shrink-0">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                        {pendingGroups.map((group, gi) => (
                            <div key={gi} className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("w-2 h-2 rounded-full", `bg-${group.color}-500`)} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">{group.name}</span>
                                </div>
                                {group.tasks.map((task, ti) => {
                                    const p = priorityConfig[task.priority] ?? priorityConfig.natural;
                                    return (
                                        <div key={ti} className="ml-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
                                            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", p.dot)} />
                                            <span className="truncate flex-1">{task.title}</span>
                                            {task.durationMinutes && (
                                                <span className="text-zinc-600 flex-shrink-0">{task.durationMinutes}m</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            className={cn(
                                "w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                                applying
                                    ? "bg-zinc-800 text-zinc-600 cursor-wait"
                                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20"
                            )}
                        >
                            {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {applying ? "Adding..." : "Apply to Board"}
                        </button>
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/5 flex-shrink-0">
                <div className="flex items-end gap-2 bg-white/5 rounded-xl border border-white/10 p-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your tasks..."
                        rows={1}
                        className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none resize-none min-h-[20px] max-h-[80px]"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || loading}
                        className={cn(
                            "p-1.5 rounded-lg transition-colors flex-shrink-0",
                            input.trim() && !loading
                                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                : "text-zinc-700 cursor-not-allowed"
                        )}
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
