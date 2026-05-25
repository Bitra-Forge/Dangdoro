"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { linkAnonymousToGoogle, signInWithGoogle, logOut, signInWithEmail, signUpWithEmail, linkAnonymousToEmail } from "@/lib/auth";
import { mapAuthError } from "@/lib/error-codes";
import { savePomodoroSession } from "@/lib/db";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LogOut, Mail, Lock, UserPlus, Eye, EyeOff, X as XIcon } from "lucide-react";


import { useRouter } from "next/navigation";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type EmailMode = "login" | "signup";

export interface AuthVaultProps {
    redirect?: string;
    isModal?: boolean;
    onSuccess?: () => void;
    initialEmailMode?: EmailMode;
}

export function AuthCard({ redirect, isModal, onSuccess, initialEmailMode = "login" }: AuthVaultProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<{ totalPomodoros: number } | null>(null);
    const [emailMode, setEmailMode] = useState<EmailMode>(initialEmailMode);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailError, setEmailError] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!user || user.isAnonymous) return;

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

    useEffect(() => {
        if (user?.isAnonymous) {
            setEmailMode("signup");
        }
    }, [user?.isAnonymous]);

    const handleGoogleAuth = async () => {
        try {
            setIsSubmitting(true);
            if (user && user.isAnonymous) {
                await linkAnonymousToGoogle(user);
                toast.success("Account linked! Your data is now saved.");
            } else {
                await signInWithGoogle();
                toast.success("Welcome back!");
            }
            if (onSuccess) onSuccess();
            if (redirect) router.push(redirect);
        } catch (error: any) {
            toast.error(mapAuthError(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();

        const isSignup = emailMode === "signup" || user?.isAnonymous;

        if (isSignup && !displayName) {
            toast.error("Please identify yourself with a username.");
            return;
        }
        if (!email || !password) {
            toast.error("Please enter your email and password.");
            return;
        }

        try {
            setIsSubmitting(true);
            if (user && user.isAnonymous) {
                // Link guest session to email with chosen name
                await linkAnonymousToEmail(user, email, password, displayName);
                toast.success("Account created! Your data is now saved.");
            } else {
                if (emailMode === "signup") {
                    await signUpWithEmail(email, password, displayName);
                    toast.success("Account created. Welcome!");
                } else {
                    await signInWithEmail(email, password);
                    toast.success("Signed in successfully.");
                }
            }
            if (onSuccess) onSuccess();
            if (redirect) router.push(redirect);
        } catch (error: any) {
            toast.error(mapAuthError(error));
            if (error.code === "auth/email-already-in-use" || error.code === "auth/invalid-email" || error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
                setEmailError(true);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await logOut();
            toast.success("Signed out.");
        } catch (error: any) {
            toast.error("Error signing out.");
        }
    };

    if (loading) {
        return (
            <div className={cn(
                "w-full bg-zinc-950/40 animate-pulse border border-white/10 rounded-lg p-6",
                isModal ? "max-w-none" : "max-w-md"
            )}>
                <div className="h-4 w-1/3 bg-white/5 rounded mb-4" />
                <div className="h-12 w-full bg-white/5 rounded" />
            </div>
        );
    }

    const title = user && !user.isAnonymous
        ? "Account"
        : (emailMode === "signup" || user?.isAnonymous ? "Create account" : "Sign in");

    const subtitle = user && !user.isAnonymous
        ? "You are signed in."
        : (emailMode === "signup" || user?.isAnonymous
            ? "Create an account to save your progress."
            : "Welcome back. Sign in to continue.");

    return (
        <div className={cn(
            "w-full relative bg-zinc-950/60 border border-white/10 rounded-lg p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]",
            isModal ? "max-w-none" : "max-w-md"
        )}>
            {isModal && (
                <button
                    onClick={onSuccess}
                    className="absolute top-4 right-4 z-50 p-2 rounded-md bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Close"
                >
                    <XIcon className="w-4 h-4" />
                </button>
            )}

            <div className="space-y-6">
                <div>
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
                </div>

                {user && !user.isAnonymous ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-md">
                            <p className="text-xs text-zinc-400">Signed in as</p>
                            <p className="text-sm font-medium text-white truncate">{user.email || "User"}</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleSignOut}
                            className="w-full h-11 rounded-md border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition-colors font-medium"
                        >
                            <LogOut className="mr-2 h-4 w-4" /> Sign out
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {user?.isAnonymous && (
                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-md">
                                <p className="text-xs text-amber-300/80">Guest session</p>
                                <p className="text-sm text-zinc-400 mt-1">Create an account to keep your progress.</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setEmailMode("signup")}
                                    className={cn(
                                        "flex-1 py-2 rounded-md text-sm font-medium transition-colors",
                                        (emailMode === "signup" || user?.isAnonymous) && emailMode !== "login"
                                            ? "bg-white/10 text-white"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    )}
                                >
                                    Create account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEmailMode("login")}
                                    className={cn(
                                        "flex-1 py-2 rounded-md text-sm font-medium transition-colors",
                                        emailMode === "login"
                                            ? "bg-white/10 text-white"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    )}
                                >
                                    Sign in
                                </button>
                            </div>

                            <Button
                                onClick={handleGoogleAuth}
                                disabled={isSubmitting}
                                variant="outline"
                                className="w-full h-11 rounded-md bg-zinc-950 border-white/10 text-white hover:bg-zinc-900 transition-colors font-medium flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                )}
                                <span>{isSubmitting ? "Working..." : "Continue with Google"}</span>
                            </Button>

                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-white/10" />
                                <span className="text-xs text-zinc-500">or use email</span>
                                <div className="h-px flex-1 bg-white/10" />
                            </div>

                            <form onSubmit={handleEmailAuth} className="space-y-4">
                                <div className="space-y-3 text-left">
                                    {(emailMode === "signup" || (user?.isAnonymous && emailMode !== "login")) && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400 ml-1">Display name</label>
                                            <div className="relative">
                                                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                <Input
                                                    type="text"
                                                    placeholder="Your name"
                                                    value={displayName}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                                                    className="bg-zinc-900 border-white/15 h-11 pl-10 rounded-md text-white placeholder:text-zinc-600 focus:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 ml-1">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                            <Input
                                                type="email"
                                                placeholder="you@example.com"
                                                value={email}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    setEmail(e.target.value);
                                                    if (emailError) setEmailError(false);
                                                }}
                                                className={cn(
                                                    "bg-zinc-900 h-11 pl-10 rounded-md text-white placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors",
                                                    emailError
                                                        ? "border-red-500/60 focus:border-red-500"
                                                        : "border-white/15 focus:border-white/60"
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400 ml-1">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                                className="bg-zinc-900 border-white/15 h-11 pl-10 pr-10 rounded-md text-white placeholder:text-zinc-600 focus:border-white/60 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-11 rounded-md bg-white text-black hover:bg-zinc-200 transition-colors font-medium"
                                >
                                    {isSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    ) : (emailMode === "signup" || (user?.isAnonymous && emailMode !== "login") ? "Create account" : "Sign in")}
                                </Button>
                            </form>
                        </div>
                    </div>
                )}

                {stats && !isModal && (
                    <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Total sessions</span>
                        <span className="text-sm font-medium text-white">{stats.totalPomodoros}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

