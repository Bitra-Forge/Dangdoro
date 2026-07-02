"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatNotificationState {
    notification: { groupId: string; message: string } | null;
    setChatNotification: (n: { groupId: string; message: string } | null) => void;
    clearChatNotification: () => void;
    drafts: Record<string, string>;
    setDraft: (groupId: string, text: string) => void;
    clearDraft: (groupId: string) => void;
    unreadGroups: Record<string, boolean>;
    setGroupUnread: (groupId: string, unread: boolean) => void;
}

export const useChatNotificationStore = create<ChatNotificationState>()(
    persist(
        (set) => ({
            notification: null,
            setChatNotification: (notification) => set({ notification }),
            clearChatNotification: () => set({ notification: null }),
            drafts: {},
            setDraft: (groupId, text) =>
                set((state) => ({
                    drafts: { ...state.drafts, [groupId]: text },
                })),
            clearDraft: (groupId) =>
                set((state) => {
                    const newDrafts = { ...state.drafts };
                    delete newDrafts[groupId];
                    return { drafts: newDrafts };
                }),
            unreadGroups: {},
            setGroupUnread: (groupId, unread) =>
                set((state) => ({
                    unreadGroups: { ...state.unreadGroups, [groupId]: unread },
                })),
        }),
        {
            name: "dangdoro-chat-drafts",
            partialize: (state) => ({
                drafts: state.drafts,
            }),
        }
    )
);
