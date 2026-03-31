"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signInGuest } from "@/lib/auth";
import { syncUserProfile } from "@/lib/db";

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Clear manual sign out flag on successful login
                if (typeof window !== "undefined") {
                    localStorage.removeItem("manual-sign-out");
                }
                // Sync user profile to Firestore
                await syncUserProfile(currentUser);
                setUser(currentUser);
                setLoading(false);
            } else {
                // If no user, just set to null. 
                // We stop auto-signing in as guest to prevent "Account Spam"
                // But we still need to set loading to false to allow pages to render!
                setUser(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
