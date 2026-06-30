"use client";

import { create } from "zustand";

interface ChatNotificationState {
    notification: { groupId: string; message: string } | null;
    setChatNotification: (n: { groupId: string; message: string } | null) => void;
    clearChatNotification: () => void;
}

export const useChatNotificationStore = create<ChatNotificationState>()((set) => ({
    notification: null,
    setChatNotification: (notification) => set({ notification }),
    clearChatNotification: () => set({ notification: null }),
}));
