"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, orderBy, limit } from "firebase/firestore";
import { useChatNotificationStore } from "@/lib/stores/chat-notification-store";

export default function GlobalChatNotificationListener() {
    const { user } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const {
        notification,
        setChatNotification,
        clearChatNotification,
        setGroupUnread
    } = useChatNotificationStore();

    const [groupIds, setGroupIds] = useState<string[]>([]);
    const [groupNames, setGroupNames] = useState<Record<string, string>>({});
    const [mutedGroups, setMutedGroups] = useState<string[]>([]);

    const listenersRef = useRef<Record<string, () => void>>({});
    const listenerInitTime = useRef(Date.now());
    const pathnameRef = useRef(pathname);
    const searchParamsRef = useRef(searchParams);

    // Keep path parameters updated in refs so the message snapshot listener always gets the latest state
    useEffect(() => {
        pathnameRef.current = pathname;
        searchParamsRef.current = searchParams;
    }, [pathname, searchParams]);

    // 1. Subscribe to the user's joined groups
    useEffect(() => {
        if (!user) {
            setGroupIds([]);
            return;
        }

        const q = query(
            collection(db, "focusGroups"),
            where("members", "array-contains", user.uid)
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const ids = snap.docs.map((d) => d.id);
                const names: Record<string, string> = {};
                snap.docs.forEach((d) => {
                    names[d.id] = d.data().name || "group";
                });
                setGroupNames(names);
                setGroupIds(ids);
            },
            (error) => {
                console.error("GlobalChatNotificationListener group query error:", error);
            }
        );

        return () => {
            unsub();
        };
    }, [user?.uid]);

    // 2. Subscribe to user's profile to get mutedGroups
    useEffect(() => {
        if (!user) return;

        const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setMutedGroups(data.mutedGroups || []);
            }
        });

        return unsub;
    }, [user?.uid]);

    // 3. Manage listeners for messages of each group
    useEffect(() => {
        if (!user) {
            // Clean up all listeners
            Object.values(listenersRef.current).forEach((unsub) => unsub());
            listenersRef.current = {};
            return;
        }

        const currentListeners = listenersRef.current;

        // Clean up listeners for groups the user is no longer in
        Object.keys(currentListeners).forEach((gId) => {
            if (!groupIds.includes(gId)) {
                currentListeners[gId]();
                delete currentListeners[gId];
            }
        });

        // Add listeners for new groups
        groupIds.forEach((gId) => {
            if (!currentListeners[gId]) {
                const messagesRef = collection(db, `focusGroups/${gId}/messages`);
                const qMsg = query(messagesRef, orderBy("createdAt", "desc"), limit(1));

                const unsub = onSnapshot(
                    qMsg,
                    (snap) => {
                        if (snap.empty) return;
                        const docData = snap.docs[0].data();
                        const msgId = snap.docs[0].id;
                        const msg = docData as { senderId: string; content: string; senderName: string; createdAt: any };
                        
                        const msgTime = msg.createdAt?.toMillis
                            ? msg.createdAt.toMillis()
                            : msg.createdAt?.toDate
                            ? msg.createdAt.toDate().getTime()
                            : Date.now();

                        // Check if current user is viewing this chat right now
                        const isViewingChat =
                            pathnameRef.current === `/groups/${gId}` &&
                            searchParamsRef.current.get("tab") === "chat";

                        if (isViewingChat) {
                            localStorage.setItem(`dangdoro_last_read_${gId}`, msgTime.toString());
                            setGroupUnread(gId, false);
                        } else {
                            const lastReadStr = localStorage.getItem(`dangdoro_last_read_${gId}`);
                            const lastRead = lastReadStr ? parseInt(lastReadStr, 10) : 0;

                            if (msg.senderId !== user.uid) {
                                if (msgTime > lastRead) {
                                    setGroupUnread(gId, true);

                                    // Display banner if initialized and not muted
                                    if (msgTime > listenerInitTime.current && !mutedGroups.includes(gId)) {
                                        setChatNotification({
                                            groupId: gId,
                                            message: `New message in ${groupNames[gId] || "group"}: ${msg.content.slice(0, 80)}`,
                                        });
                                    }
                                }
                            }
                        }
                    },
                    (err) => {
                        console.error(`GlobalChatNotificationListener message error for ${gId}:`, err);
                    }
                );

                currentListeners[gId] = unsub;
            }
        });

        return () => {
            // No cleanup on groupIds changing, let the effect clean up on next run or unmount
        };
    }, [groupIds, user, mutedGroups, groupNames, setChatNotification, setGroupUnread]);

    // 4. Listen to route / tab changes to mark chats as read immediately
    useEffect(() => {
        if (!user) return;

        const match = pathname.match(/^\/groups\/([^/]+)/);
        if (match) {
            const gId = match[1];
            const tab = searchParams.get("tab");
            if (tab === "chat") {
                localStorage.setItem(`dangdoro_last_read_${gId}`, Date.now().toString());
                setGroupUnread(gId, false);
                if (notification?.groupId === gId) {
                    clearChatNotification();
                }
            }
        }
    }, [pathname, searchParams, user, notification, clearChatNotification, setGroupUnread]);

    return null;
}
