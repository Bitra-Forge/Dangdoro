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
import { LogIn, LogOut, Mail, Lock, Globe, UserPlus, ArrowLeft, Eye, EyeOff, X as XIcon } from "lucide-react";


import { useRouter } from "next/navigation";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AuthMethod = "choice" | "email";
type EmailMode = "login" | "signup";

export interface AuthVaultProps {
    redirect?: string;
    isModal?: boolean;
    onSuccess?: () => void;
}

export function AuthCard({ redirect, isModal, onSuccess }: AuthVaultProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<{ totalPomodoros: number } | null>(null);
    const [method, setMethod] = useState<AuthMethod>("choice");
    const [emailMode, setEmailMode] = useState<EmailMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailError, setEmailError] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
                toast.success("Identity Secured via Cloud Vault!");
            } else {
                await signInWithGoogle();
                toast.success("Welcome back to the Core.");
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
            toast.error("Vault access requires full credentials.");
            return;
        }

        try {
            setIsSubmitting(true);
            if (user && user.isAnonymous) {
                // Link guest session to email with chosen name
                await linkAnonymousToEmail(user, email, password, displayName);
                toast.success("Guest legacy successfully archived in the Vault!");
            } else {
                if (emailMode === "signup") {
                    await signUpWithEmail(email, password, displayName);
                    toast.success("Vault slot established. Welcome Hero.");
                } else {
                    await signInWithEmail(email, password);
                    toast.success("Identity verified. Accessing Core.");
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
            toast.success("Session terminated safely.");
        } catch (error: any) {
            toast.error("Error terminating vault session.");
        }
    };

    if (loading) {
        return (
            <div className={cn(
                "w-full bg-zinc-950/20 animate-pulse border border-white/5",
                isModal ? "p-0 bg-transparent border-none" : "rounded-[2rem] p-8"
            )}>
                <div className="h-4 w-1/3 bg-white/5 rounded mb-4" />
                <div className="h-12 w-full bg-white/5 rounded" />
            </div>
        );
    }

    return (
        <div className={cn(
            "w-full flex flex-col items-center relative overflow-hidden transition-all duration-500",
            isModal ? "p-0" : "bg-zinc-900/40 backdrop-blur-3xl border border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] rounded-[3rem] p-10 min-h-[400px]"
        )}>
            {/* Vault Decorative Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-sky-500 to-transparent animate-scan" />
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-sky-500/30 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-sky-500/30 rounded-tr-2xl" />
            </div>

            {!isModal && (
                <>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[64px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-[64px] rounded-full" />
                </>
            )}

            {/* Custom Close Button (Modal Only) */}
            {isModal && (
                <button
                    onClick={onSuccess}
                    className="absolute top-4 right-4 z-50 p-2 rounded-xl bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all group"
                    title="Terminate Connection"
                >
                    <XIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                </button>
            )}

            <div className="relative z-10 w-full">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                            {user && !user.isAnonymous ? "Vault Identity" : (method === "email" ? (emailMode === "signup" || user?.isAnonymous ? "Forge New Legacy" : "Return to Vault") : "Access Core")}
                        </h2>
                    </div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] pl-4">
                        {user && !user.isAnonymous
                            ? "Legacy Slot: PROTECTED"
                            : (method === "email" ? "Awaiting Credentials..." : "Select Entry Vector")}
                    </p>
                </div>

                {user && !user.isAnonymous ? (
                    /* Signed In View */
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest mb-1">Encrypted Identity</p>
                            <p className="text-sm font-bold text-white truncate">{user.email || "Focus Hero"}</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleSignOut}
                            className="w-full h-14 rounded-2xl border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all font-black uppercase tracking-widest"
                        >
                            <LogOut className="mr-2 h-4 w-4" /> Terminate Session
                        </Button>
                    </div>
                ) : (
                    /* Auth Choice / Email Form */
                    <div className="space-y-6">
                        {/* Guest / Link Warning */}
                        {user?.isAnonymous && (
                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl animate-in fade-in duration-700">
                                <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Unprotected Vector</p>
                                <p className="text-[11px] font-bold text-zinc-400 leading-snug">Connect your identity to immunize your progress against data loss.</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Tabs */}
                            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setEmailMode("signup")}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        (emailMode === "signup" || user?.isAnonymous) && emailMode !== "login"
                                            ? "bg-white/10 text-white shadow-xl"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Forge New Legacy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEmailMode("login")}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        emailMode === "login"
                                            ? "bg-white/10 text-white shadow-xl"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    Access Existing
                                </button>
                            </div>

                            {/* Google Option (Relic Style) */}
                            <Button
                                onClick={handleGoogleAuth}
                                disabled={isSubmitting}
                                variant="outline"
                                className="w-full h-14 rounded-2xl bg-zinc-950 !border-white/10 text-white hover:bg-zinc-900 hover:!border-white/20 transition-all font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-white/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                )}
                                <span className="relative z-10">{isSubmitting ? "Linking Vault..." : "Establish Identity via Google"}</span>
                            </Button>

                            {/* Divider */}
                            <div className="flex items-center gap-4 py-2 px-1">
                                <div className="h-px flex-1 bg-white/5" />
                                <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">or manually secure</span>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>

                            {/* Email Form */}
                            <form onSubmit={handleEmailAuth} className="space-y-4 animate-in fade-in duration-700">
                                <div className="space-y-3 text-left">
                                    {(emailMode === "signup" || (user?.isAnonymous && emailMode !== "login")) && (
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Identity Tag</label>
                                            <div className="relative group">
                                                <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
                                                <Input
                                                    type="text"
                                                    placeholder="USERNAME"
                                                    value={displayName}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                                                    className="bg-white/5 border-white/10 h-14 pl-12 rounded-2xl text-white font-bold placeholder:text-zinc-700 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all tracking-wide"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Vault Key (Email)</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
                                            <Input
                                                type="email"
                                                placeholder="EMAIL ADDRESS"
                                                value={email}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    setEmail(e.target.value);
                                                    if (emailError) setEmailError(false);
                                                }}
                                                className={cn(
                                                    "bg-white/5 h-14 pl-12 rounded-2xl text-white font-bold placeholder:text-zinc-700 transition-all tracking-wide",
                                                    emailError
                                                        ? "border-red-500/50 focus:border-red-500 ring-2 ring-red-500/20"
                                                        : "border-white/10 focus:border-sky-500/50"
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Access Pass (Password)</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-sky-500 transition-colors" />
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                                className="bg-white/5 border-white/10 h-14 pl-12 pr-12 rounded-2xl text-white font-bold placeholder:text-zinc-700 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all tracking-wide"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-white transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-15 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-400 text-white hover:from-sky-500 hover:to-sky-300 transition-all font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_40px_rgba(14,165,233,0.4)] active:scale-[0.97] mt-4 border border-white/10 group overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="relative z-10 flex items-center gap-2">
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        ) : (emailMode === "signup" || (user?.isAnonymous && emailMode !== "login") ? "Forge Legacy" : "Unlock Vault")}
                                    </span>
                                </Button>
                            </form>
                        </div>
                    </div>
                )}

                {stats && !isModal && (
                    <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Archived Score</span>
                        <span className="text-lg font-black text-white italic tracking-tighter">
                            {stats.totalPomodoros} <span className="text-sky-500 text-[10px]">SESSIONS</span>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

