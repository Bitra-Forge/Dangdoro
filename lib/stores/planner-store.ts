"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

interface PlannerState {
    messages: Message[];
    loading: boolean;
    pendingGroups: GeneratedGroup[] | null;
    sessionActive: boolean;
    notification: { type: "needs_input" | "finished"; message: string } | null;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    setLoading: (loading: boolean) => void;
    setPendingGroups: (groups: GeneratedGroup[] | null) => void;
    setSessionActive: (active: boolean) => void;
    clearSession: () => void;
    setNotification: (n: { type: "needs_input" | "finished"; message: string } | null) => void;
    clearNotification: () => void;
}

const initialMessage: Message = {
    role: "assistant",
    content:
        "Describe a project or goal — include scope, deadlines, and priorities if you can. I'll architect task groups for your board.",
};

export const usePlannerStore = create<PlannerState>()(
    persist(
        (set) => ({
            messages: [initialMessage],
            loading: false,
            pendingGroups: null,
            sessionActive: false,
            notification: null,
            setMessages: (messages) => set({ messages }),
            addMessage: (message) =>
                set((state) => ({ messages: [...state.messages, message] })),
            setLoading: (loading) => set({ loading }),
            setPendingGroups: (pendingGroups) => set({ pendingGroups }),
            setSessionActive: (active) => set({ sessionActive: active }),
            clearSession: () =>
                set({
                    messages: [initialMessage],
                    pendingGroups: null,
                    sessionActive: false,
                    notification: null,
                }),
            setNotification: (notification) => set({ notification }),
            clearNotification: () => set({ notification: null }),
        }),
        {
            name: "dangdoro-planner-session",
            partialize: (state) => ({
                messages: state.messages,
                pendingGroups: state.pendingGroups,
                sessionActive: state.sessionActive,
                notification: state.notification,
            }),
        }
    )
);
