"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { syncUserProfile, retryPendingFocusTimeLocal } from "@/lib/db";
import { retryPendingFocusTime } from "@/lib/focus-accumulator";
import { useTimerStore } from "@/lib/store";
import { useStickyNotesStore } from "@/lib/sticky-notes-store";
import { useQuickTasksStore } from "@/lib/quick-tasks-store";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthModalOpen: boolean;
    openAuthVault: () => void;
    closeAuthVault: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAuthModalOpen: false,
    openAuthVault: () => { },
    closeAuthVault: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const openAuthVault = () => setIsAuthModalOpen(true);
    const closeAuthVault = () => setIsAuthModalOpen(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Clear manual sign out flag on successful login OR any state change to a valid user
                if (typeof window !== "undefined") {
                    localStorage.removeItem("manual-sign-out");
                }

                // LAZY SYNC: Only sync immediately for VERIFIED (non-anonymous) users.
                if (!currentUser.isAnonymous) {
                    await syncUserProfile(currentUser);
                }

                // Retry any pending focus time writes that failed in a previous session
                retryPendingFocusTime(currentUser.uid);
                retryPendingFocusTimeLocal(currentUser.uid);

                // Sync sticky notes and quick tasks from Firestore
                const { loaded: notesLoaded } = useStickyNotesStore.getState();
                if (!notesLoaded) {
                  await useStickyNotesStore.getState().pushLocalToFirestore();
                  await useStickyNotesStore.getState().loadFromFirestore();
                }

                const { loaded: tasksLoaded } = useQuickTasksStore.getState();
                if (!tasksLoaded) {
                  await useQuickTasksStore.getState().pushLocalToFirestore();
                  await useQuickTasksStore.getState().loadFromFirestore();
                }

                setUser(currentUser);
                setLoading(false);
            } else {
                // RESET TIMER & SETTINGS: Ensure no session leaks after sign-out
                useTimerStore.getState().resetToDefaults();
                useStickyNotesStore.getState().clearNotes();
                useQuickTasksStore.getState().clearTasks();
                setUser(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAuthModalOpen, openAuthVault, closeAuthVault }}>
            {children}
        </AuthContext.Provider>
    );
};
