"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { linkAnonymousToGoogle, signInWithGoogle, logOut } from "@/lib/auth";
import { savePomodoroSession } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, LogOut } from "lucide-react";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function AuthCard() {
    const { user, loading } = useAuth();
    const [stats, setStats] = useState<{ totalPomodoros: number } | null>(null);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                setStats(doc.data() as { totalPomodoros: number });
            }
        });
        return () => unsub();
    }, [user]);

    const handleGoogleAuth = async () => {
        try {
            if (user && user.isAnonymous) {
                // Link their anonymous session to a Google account
                await linkAnonymousToGoogle(user);
                toast.success("Account successfully linked!");
            } else {
                // Standard Sign-in (just in case they logged out completely)
                await signInWithGoogle();
                toast.success("Signed in successfully!");
            }
        } catch (error: any) {
            toast.error(error.message || "Authentication failed. Please try again.");
        }
    };

    const handleSignOut = async () => {
        try {
            await logOut();
            toast.success("Signed out safely.");
        } catch (error: any) {
            toast.error("Error signing out.");
        }
    };

    const handleTestPomodoro = async () => {
        if (!user) return;
        const success = await savePomodoroSession(user.uid, 25);
        if (success) {
            toast.success("Test Pomodoro Saved! Check your stats.");
        } else {
            toast.error("Failed to save test session.");
        }
    };

    if (loading) {
        return (
            <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900 animate-pulse">
                <CardHeader>
                    <div className="h-6 w-1/2 bg-zinc-800 rounded mb-2"></div>
                </CardHeader>
                <CardContent>
                    <div className="h-10 w-full bg-zinc-800 rounded"></div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900/50">
            <CardHeader>
                <CardTitle>Your Account</CardTitle>
                <CardDescription className="text-zinc-400">
                    {user && !user.isAnonymous
                        ? "You are logged in securely."
                        : "Guest mode. Sign in to save your Pomodoros permanently!"}
                </CardDescription>
                {stats && (
                    <div className="mt-2 inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-100 border border-zinc-700">
                        🍅 {stats.totalPomodoros} Pomodoros Completed
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {user && !user.isAnonymous ? (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm font-medium text-white">{user.email || user.displayName || "Authenticated User"}</p>
                        <Button variant="destructive" onClick={handleSignOut} className="w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                        <Button variant="outline" onClick={handleTestPomodoro} className="w-full border-zinc-700 hover:bg-zinc-800">
                            ⚡ Test Complete Pomodoro (25m)
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <Button onClick={handleGoogleAuth} className="w-full bg-white text-black hover:bg-zinc-200">
                            <LogIn className="mr-2 h-4 w-4" />
                            Sign in with Google
                        </Button>
                        <Button variant="outline" onClick={handleTestPomodoro} className="w-full border-zinc-700 hover:bg-zinc-800">
                            ⚡ Test Complete Pomodoro (Guest)
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
