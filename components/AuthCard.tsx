"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { linkAnonymousToGoogle, signInWithGoogle, logOut, signInWithEmail, signUpWithEmail, linkAnonymousToEmail } from "@/lib/auth";
import { savePomodoroSession } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LogIn, LogOut, Mail, Lock, Globe, UserPlus, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AuthMethod = "choice" | "email";
type EmailMode = "login" | "signup";

export function AuthCard({ redirect }: { redirect?: string }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<{ totalPomodoros: number } | null>(null);
    const [method, setMethod] = useState<AuthMethod>("choice");
    const [emailMode, setEmailMode] = useState<EmailMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user) return;

        // When in linking mode, pre-fill the name field with the guest's unique ID
        if (user.isAnonymous && !displayName) {
            setDisplayName(user.displayName || "");
        }

        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                setStats(doc.data() as { totalPomodoros: number });
            }
        });
        return () => unsub();
    }, [user, displayName]);

    const handleGoogleAuth = async () => {
        try {
            setIsSubmitting(true);
            if (user && user.isAnonymous) {
                await linkAnonymousToGoogle(user);
                toast.success("Account successfully linked!");
            } else {
                await signInWithGoogle();
                toast.success("Welcome back Hero!");
            }
            if (redirect) router.push(redirect);
        } catch (error: any) {
            toast.error(error.message || "Google Authentication failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();

        const isSignup = emailMode === "signup" || user?.isAnonymous;

        if (isSignup && !displayName) {
            toast.error("Please choose a username.");
            return;
        }
        if (!email || !password) {
            toast.error("Please fill in all fields.");
            return;
        }

        try {
            setIsSubmitting(true);
            if (user && user.isAnonymous) {
                // Link guest session to email with chosen name
                await linkAnonymousToEmail(user, email, password, displayName);
                toast.success("Guest data safely linked to your email!");
            } else {
                if (emailMode === "signup") {
                    await signUpWithEmail(email, password, displayName);
                    toast.success("Account created! Welcome to the Forge.");
                } else {
                    await signInWithEmail(email, password);
                    toast.success("Signed in successfully.");
                }
            }
            if (redirect) router.push(redirect);
        } catch (error: any) {
            toast.error(error.message || "Authentication failed.");
        } finally {
            setIsSubmitting(false);
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
        <div className="w-full bg-zinc-900/40 backdrop-blur-3xl border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] rounded-[3rem] p-10 flex flex-col items-center relative overflow-hidden transition-all duration-500 min-h-[400px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[64px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-[64px] rounded-full" />

            <div className="relative z-10 w-full">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">
                        {user && !user.isAnonymous ? "Hero Profile" : (method === "email" ? (emailMode === "signup" ? "New Legend" : "Return to Forge") : "Secure Sign In")}
                    </h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                        {user && !user.isAnonymous
                            ? "Your legacy is securely stored."
                            : (method === "email" ? "Enter your credentials below." : "Choose your path to focus.")}
                    </p>
                </div>

                {user && !user.isAnonymous ? (
                    /* Signed In View */
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest mb-1">Authenticated Account</p>
                            <p className="text-sm font-bold text-white truncate">{user.email || "Focus Hero"}</p>
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
                    /* Auth Choice / Email Form */
                    <div className="space-y-6">
                        {/* Guest Warning */}
                        {user?.isAnonymous && method === "choice" && (
                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl animate-in fade-in duration-700">
                                <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Temporary Session</p>
                                <p className="text-[11px] font-bold text-zinc-400 leading-snug">Your progress will stay local until you connect an account.</p>
                            </div>
                        )}

                        {method === "choice" ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
                                <Button
                                    onClick={handleGoogleAuth}
                                    disabled={isSubmitting}
                                    className="w-full h-14 rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                                >
                                    <Globe className="w-5 h-5" /> Continue with Google
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setMethod("email")}
                                    className="w-full h-14 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-5 h-5" /> Continue with Email
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleEmailAuth} className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                                <div className="space-y-3">
                                    {(emailMode === "signup" || user?.isAnonymous) && (
                                        <div className="relative group">
                                            <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
                                            <Input
                                                type="text"
                                                placeholder="USERNAME"
                                                value={displayName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                                                className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white font-bold placeholder:text-zinc-600 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all tracking-wide"
                                            />
                                        </div>
                                    )}
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
                                        <Input
                                            type="email"
                                            placeholder="EMAIL ADDRESS"
                                            value={email}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                            className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white font-bold placeholder:text-zinc-600 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all tracking-wide"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
                                        <Input
                                            type="password"
                                            placeholder="PASSWORD"
                                            value={password}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                            className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white font-bold placeholder:text-zinc-600 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all tracking-wide"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-14 rounded-2xl bg-sky-500 text-white hover:bg-sky-400 transition-all font-black uppercase tracking-widest shadow-[0_0_20px_rgba(14,165,233,0.3)] mt-2"
                                >
                                    {isSubmitting ? "Processing..." : (emailMode === "signup" ? "Create Account" : "Access Account")}
                                </Button>

                                <div className="flex flex-col items-center gap-4 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEmailMode(emailMode === "login" ? "signup" : "login")}
                                        className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
                                    >
                                        {emailMode === "login" ? "Need an account? New Legend" : "Already a hero? Access Account"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMethod("choice")}
                                        className="inline-flex items-center gap-2 text-[10px] font-black text-zinc-600 hover:text-white uppercase tracking-[0.3em] transition-colors"
                                    >
                                        <ArrowLeft className="w-3 h-3" /> Back to methods
                                    </button>
                                </div>
                            </form>
                        )}
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
