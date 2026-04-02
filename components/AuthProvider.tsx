"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signInGuest } from "@/lib/auth";
import { syncUserProfile } from "@/lib/db";
import { useTimerStore } from "@/lib/store";

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

                setUser(currentUser);
                setLoading(false);
            } else {
                // RESET TIMER & SETTINGS: Ensure no session leaks after sign-out
                useTimerStore.getState().resetToDefaults();

                // ZERO FRICTION: Automatically sign in as a guest, 
                // UNLESS the user just manually signed out.
                const isManualSignOut = typeof window !== "undefined" && localStorage.getItem("manual-sign-out") === "true";

                if (isManualSignOut) {
                    console.log("AuthProvider: Manual sign-out detected. Skipping auto-guest sign-in.");
                    setUser(null);
                    setLoading(false);
                    return;
                }

                try {
                    console.log("AuthProvider: No user detected, initiating auto-guest sign-in...");
                    const guestUser = await signInGuest();
                    // ... (rest of logic)

                    // If for some reason the listener doesn't fire promptly, we update manually
                    if (auth.currentUser?.uid === guestUser.uid) {
                        console.log("AuthProvider: Manually updating state for guest:", guestUser.uid);
                        setUser(guestUser);
                        setLoading(false);
                    }
                } catch (error) {
                    console.error("AuthProvider: Auto guest sign-in failed:", error);
                    setUser(null);
                    setLoading(false);
                }
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
