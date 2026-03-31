"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { linkAnonymousToGoogle, signInWithGoogle, logOut } from "@/lib/auth";
import { savePomodoroSession } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function AuthCard({ redirect }: { redirect?: string }) {
    const { user, loading } = useAuth();
    const router = useRouter();
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
                await linkAnonymousToGoogle(user);
                toast.success("Account successfully linked!");
            } else {
                await signInWithGoogle();
                toast.success("Welcome back!");
            }
            if (redirect) {
                router.push(redirect);
            }
        } catch (error: any) {
            toast.error(error.message || "Authentication failed.");
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

    if (loading) {
        return (
            <div className="w-full bg-zinc-900 shadow-2xl rounded-[2rem] p-8 animate-pulse border border-white/5">
                <div className="h-4 w-1/3 bg-white/5 rounded mb-4" />
                <div className="h-12 w-full bg-white/5 rounded" />
            </div>
        );
    }

    return (
        <div className="w-full bg-zinc-900/40 backdrop-blur-3xl border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] rounded-[3rem] p-10 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[64px] rounded-full" />

            <div className="relative z-10 w-full">
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">
                    {user && !user.isAnonymous ? "Hero Profile" : "Secure Sign In"}
                </h2>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-8">
                    {user && !user.isAnonymous
                        ? "Your legend is securely stored."
                        : "Sign in with Google to continue."}
                </p>

                {user && !user.isAnonymous ? (
                    <div className="space-y-6">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Authenticated via Google</p>
                            <p className="text-sm font-bold text-white truncate">{user.email || "Focus Master"}</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleSignOut}
                            className="w-full h-14 rounded-2xl border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all font-black uppercase tracking-widest"
                        >
                            <LogOut className="mr-2 h-4 w-4" /> Sign Out
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Temporary Session</p>
                            <p className="text-xs font-bold text-zinc-400">Your stats will be lost if you clear your browser data. Connect now to avoid reset.</p>
                        </div>
                        <Button
                            onClick={handleGoogleAuth}
                            className="w-full h-14 rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all font-black uppercase tracking-widest shadow-xl hover:scale-[1.02]"
                        >
                            <LogIn className="mr-2 h-4 w-4" /> Sign in with Google
                        </Button>
                    </div>
                )}

                {stats && (
                    <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Current Score</span>
                        <span className="text-lg font-black text-white italic tracking-tighter">
                            {stats.totalPomodoros} <span className="text-sky-500 text-[10px]">SESSIONS</span>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
