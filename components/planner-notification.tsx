"use client";

import { useRouter } from "next/navigation";
import { X, Sparkles, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlannerStore } from "@/lib/stores/planner-store";
import { useChatNotificationStore } from "@/lib/stores/chat-notification-store";

export function PlannerNotification() {
    const plannerNotification = usePlannerStore((s) => s.notification);
    const clearPlannerNotification = usePlannerStore((s) => s.clearNotification);
    const chatNotification = useChatNotificationStore((s) => s.notification);
    const clearChatNotification = useChatNotificationStore((s) => s.clearChatNotification);
    const router = useRouter();

    const isChat = !!chatNotification;
    const notification = chatNotification || plannerNotification;

    const handleClick = () => {
        if (chatNotification) {
            const gid = chatNotification.groupId;
            router.push(`/groups/${gid}?tab=chat`);
            clearChatNotification();
        } else {
            clearPlannerNotification();
            router.push("/tasks");
        }
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (chatNotification) {
            clearChatNotification();
        } else {
            clearPlannerNotification();
        }
    };

    return (
        <AnimatePresence>
            {notification && (
                <motion.div
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick();
                        }
                    }}
                    initial={{ opacity: 0, y: -40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -40, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] cursor-pointer group outline-none focus:ring-1 focus:ring-white/20"
                >
                    {isChat ? (
                        <MessageCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : (
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="text-[13px] text-zinc-200 font-medium whitespace-nowrap">
                        {notification.message}
                    </span>
                    <button
                        onClick={handleDismiss}
                        className="p-1 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
