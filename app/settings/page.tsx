"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    Bell, Clock, Palette, LogOut, Shield, Mail, LogIn,
    Play, Pause, Zap, Minus, Plus, RotateCcw, Save, CheckCircle2
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { logOut } from "@/lib/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateUserSettings } from "@/lib/db";
import { useTimerStore } from "@/lib/store";

const DEFAULT_SETTINGS = {
    focusTime: 25,
    breakTime: 5,
    longBreakTime: 15,
    adjustmentAmount: 1,
    notifications: true,
    sound: true,
    sessionEndSound: "universfield-new-notification-027-383749.mp3"
};

function settingsEqual(a: typeof DEFAULT_SETTINGS, b: typeof DEFAULT_SETTINGS) {
    return (
        a.focusTime === b.focusTime &&
        a.breakTime === b.breakTime &&
        a.longBreakTime === b.longBreakTime &&
        a.adjustmentAmount === b.adjustmentAmount &&
        a.notifications === b.notifications &&
        a.sound === b.sound &&
        a.sessionEndSound === b.sessionEndSound
    );
}


// ... (keep settings page logic)

export default function SettingsPage() {
    const { user, loading: authLoading, openAuthVault } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Saved settings from DB — used as baseline for diff detection
    const [savedSettings, setSavedSettings] = useState({ ...DEFAULT_SETTINGS });

    const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
    const [saving, setSaving] = useState(false);
    const [inputValues, setInputValues] = useState<Record<string, string>>({
        focusTime: "25",
        breakTime: "5",
        longBreakTime: "15",
        adjustmentAmount: "1"
    });

    const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    // Derived: has changes only when settings differ from savedSettings
    const hasChanges = !settingsEqual(settings, savedSettings);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                if (data.settings) {
                    const merged = { ...DEFAULT_SETTINGS, ...data.settings };
                    setSavedSettings(merged);
                    setSettings(merged);
                    setInputValues({
                        focusTime: String(merged.focusTime),
                        breakTime: String(merged.breakTime),
                        longBreakTime: String(merged.longBreakTime),
                        adjustmentAmount: String(merged.adjustmentAmount)
                    });
                }
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const handleUpdateSetting = useCallback((key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setInputValues(prev => ({ ...prev, [key]: String(value) }));
    }, []);

    const handleRestoreDefaults = () => {
        setSettings({ ...DEFAULT_SETTINGS });
        setInputValues({
            focusTime: String(DEFAULT_SETTINGS.focusTime),
            breakTime: String(DEFAULT_SETTINGS.breakTime),
            longBreakTime: String(DEFAULT_SETTINGS.longBreakTime),
            adjustmentAmount: String(DEFAULT_SETTINGS.adjustmentAmount)
        });
    };

    const { setSessionEndSound, setInitialTime } = useTimerStore();

    const handleSaveSettings = async () => {
        if (!user || !hasChanges) return;

        setSaving(true);
        const success = await updateUserSettings(user.uid, settings);
        if (success) {
            // Update local store immediately
            setSessionEndSound(settings.sessionEndSound);
            setInitialTime("focus", settings.focusTime * 60);
            setInitialTime("break", settings.breakTime * 60);
            setInitialTime("long-break", settings.longBreakTime * 60);

            toast.success("Settings saved successfully");
            setSavedSettings({ ...settings });
        } else {
            toast.error("Failed to save settings");
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem("manual-sign-out", "true");
            }
            await logOut();
            toast.success("Signed out safely.");
        } catch (error: any) {
            toast.error("Error signing out.");
        }
    };

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
            </div>
        );
    }

    const timerFields = [
        { label: "Focus Duration", key: "focusTime", icon: Zap, accent: "text-blue-400", border: "border-blue-500/20", glow: "shadow-blue-500/10", bg: "bg-blue-500/10" },
        { label: "Short Break", key: "breakTime", icon: Clock, accent: "text-green-400", border: "border-green-500/20", glow: "shadow-green-500/10", bg: "bg-green-500/10" },
        { label: "Long Break", key: "longBreakTime", icon: Clock, accent: "text-purple-400", border: "border-purple-500/20", glow: "shadow-purple-500/10", bg: "bg-purple-500/10" },
        { label: "Adjustment Step", key: "adjustmentAmount", icon: Zap, accent: "text-rose-400", border: "border-rose-500/20", glow: "shadow-rose-500/10", bg: "bg-rose-500/10" }
    ];

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                {/* Header */}
                <header className="w-full max-w-2xl mb-10">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-3">
                        Configuration Engine
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
                            Tailor Your<br />
                            <span className="text-sky-400">Flow</span>
                        </h1>

                        {/* Action buttons — always visible, disabled when no changes */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRestoreDefaults}
                                title="Restore Defaults"
                                className="flex items-center gap-2 px-4 h-10 rounded-xl border border-white/5 bg-zinc-900/60 text-zinc-500 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Defaults</span>
                            </button>

                            <button
                                onClick={handleSaveSettings}
                                disabled={!hasChanges || saving}
                                className={`flex items-center gap-2 px-6 h-10 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 ${hasChanges
                                    ? "bg-sky-500 text-black hover:bg-sky-400 shadow-lg shadow-sky-500/25 active:scale-95"
                                    : "bg-zinc-900/60 text-zinc-600 border border-white/5 cursor-not-allowed"
                                    }`}
                            >
                                {saving ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Saving
                                    </>
                                ) : hasChanges ? (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        Save Changes
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Saved
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Change indicator */}
                    <div className={`mt-4 h-[2px] rounded-full transition-all duration-500 ${hasChanges ? "bg-gradient-to-r from-sky-500 to-purple-500 opacity-100" : "bg-white/5 opacity-0"}`} />
                </header>

                <div className="w-full max-w-2xl space-y-6">
                    {/* Timer Configuration */}
                    <section className="bg-zinc-900/40 backdrop-blur-3xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Section header */}
                        <div className="flex items-center gap-3 px-8 py-5 border-b border-white/[0.06]">
                            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-sky-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white uppercase italic tracking-tighter">Timer Protocols</h2>
                                <p className="text-[10px] text-zinc-500 font-medium">Configure your session durations</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-3">
                            {timerFields.map((item) => (
                                <div
                                    key={item.key}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all group
                                        bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-9 h-9 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center flex-shrink-0 shadow-md ${item.glow}`}>
                                            <item.icon className={`w-4 h-4 ${item.accent}`} />
                                        </div>
                                        <span className="text-base font-bold text-zinc-300 group-hover:text-white transition-colors">
                                            {item.label}
                                        </span>
                                    </div>

                                    {/* Stepper */}
                                    <div className="flex items-center gap-1 bg-zinc-950/60 px-2 py-1.5 rounded-xl border border-white/[0.06]">
                                        <button
                                            onClick={() => handleUpdateSetting(item.key, Math.max(1, (settings as any)[item.key] - (settings as any).adjustmentAmount))}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="flex items-center gap-0.5 w-16 justify-center">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={inputValues[item.key] ?? (settings as any)[item.key]}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                                    setInputValues(prev => ({ ...prev, [item.key]: raw }));
                                                }}
                                                onBlur={() => {
                                                    const val = parseInt(inputValues[item.key], 10);
                                                    if (isNaN(val) || val < 1) {
                                                        handleUpdateSetting(item.key, 1);
                                                    } else if (val > 120) {
                                                        handleUpdateSetting(item.key, 120);
                                                    } else {
                                                        handleUpdateSetting(item.key, val);
                                                    }
                                                }}
                                                className="w-12 text-center font-black text-white italic bg-transparent border-none outline-none text-lg"
                                            />
                                            <span className={`text-sm font-black italic ${item.accent}`}>m</span>
                                        </div>
                                        <button
                                            onClick={() => handleUpdateSetting(item.key, Math.min(120, (settings as any)[item.key] + (settings as any).adjustmentAmount))}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Audio Protocols */}
                    <section className="bg-zinc-900/40 backdrop-blur-3xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-75">
                         <div className="flex items-center gap-3 px-8 py-5 border-b border-white/[0.06]">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Bell className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white uppercase italic tracking-tighter">Audio Protocols</h2>
                                <p className="text-[10px] text-zinc-500 font-medium">Select your session completion frequency</p>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { id: "universfield-new-notification-027-383749.mp3", label: "Minimal Tech", desc: "Clean & Precise" },
                                    { id: "universfield-soft-piano-logo-141290.mp3", label: "Zen Piano", desc: "Balanced & Calm" },
                                    { id: "koiroylers-cutie-cat-355747.mp3", label: "Cyber Cat", desc: "Playful & Vibrant" }
                                ].map((sound) => (
                                    <button
                                        key={sound.id}
                                        onClick={() => handleUpdateSetting("sessionEndSound", sound.id)}
                                        className={`group relative flex flex-col items-center justify-between p-4 h-32 rounded-[1.5rem] border transition-all duration-500 overflow-hidden ${
                                            settings.sessionEndSound === sound.id
                                                ? "bg-emerald-500/[0.08] border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                                                : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10"
                                        }`}
                                    >
                                        <div className="relative z-10 flex flex-col items-center gap-1.5 pt-2">
                                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                                                settings.sessionEndSound === sound.id 
                                                    ? "text-emerald-400 scale-105" 
                                                    : "text-zinc-400 group-hover:text-zinc-200"
                                            }`}>
                                                {sound.label}
                                            </span>
                                        </div>

                                        {/* Play Preview button */}
                                        <div className="flex flex-col items-center gap-2 pb-1">
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    
                                                    // If already playing this sound, stop it
                                                    if (playingSoundId === sound.id) {
                                                        if (audioRef.current) {
                                                            audioRef.current.pause();
                                                            audioRef.current = null;
                                                        }
                                                        setPlayingSoundId(null);
                                                        return;
                                                    }

                                                    // If another sound is playing, stop it first
                                                    if (audioRef.current) {
                                                        audioRef.current.pause();
                                                    }

                                                    const audio = new Audio(`/SessionEndSounds/${sound.id}`);
                                                    audio.volume = 0.5;
                                                    audioRef.current = audio;
                                                    setPlayingSoundId(sound.id);
                                                    
                                                    audio.play();
                                                    audio.onended = () => {
                                                        setPlayingSoundId(null);
                                                        audioRef.current = null;
                                                    };
                                                }}
                                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                                                    settings.sessionEndSound === sound.id
                                                        ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                                                        : "bg-white/5 text-zinc-500 border border-white/10 group-hover:bg-white/10 group-hover:text-white"
                                                } active:scale-90`}
                                            >
                                                {playingSoundId === sound.id ? (
                                                    <Pause className="w-4 h-4 fill-current" />
                                                ) : (
                                                    <Play className={`w-3.5 h-3.5 fill-current ${settings.sessionEndSound === sound.id ? "ml-0.5" : "ml-0.5"}`} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Selection indicator — subtle border glow */}
                                        {settings.sessionEndSound === sound.id && (
                                            <div className="absolute inset-0 border border-emerald-500/20 rounded-[1.5rem] pointer-events-none animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Account Center */}
                    <section className="bg-zinc-900/40 backdrop-blur-3xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                        <div className="flex items-center gap-3 px-8 py-5 border-b border-white/[0.06]">
                            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                                <Shield className="w-4 h-4 text-sky-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white uppercase italic tracking-tighter">
                                    {user ? "Account Center" : "Session Engine"}
                                </h2>
                                <p className="text-[10px] text-zinc-500 font-medium">Manage your identity and session</p>
                            </div>
                        </div>

                        <div className="p-6">
                            {user ? (
                                <>
                                    <div className="space-y-3 mb-5">
                                        <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                                            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                <Mail className="w-4 h-4 text-zinc-500" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Email Address</span>
                                                <span className="text-sm font-bold text-white truncate">{user.email || "No email linked — Guest Session"}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                                            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                <LogIn className="w-4 h-4 text-zinc-500" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Auth Method</span>
                                                <span className="text-sm font-black text-white uppercase italic tracking-tighter">
                                                    {user.providerData[0]?.providerId || "Anonymous Guest"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={user.isAnonymous ? openAuthVault : handleSignOut}
                                        variant="outline"
                                        className="w-full h-12 rounded-2xl border-white/[0.06] bg-zinc-950/50 text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/10 transition-all font-black uppercase tracking-widest text-xs"
                                    >
                                        {user.isAnonymous ? (
                                            <>
                                                <LogIn className="mr-2 h-4 w-4" /> Sign In / Establish Identity
                                            </>
                                        ) : (
                                            <>
                                                <LogOut className="mr-2 h-4 w-4" /> Terminate Session
                                            </>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6 leading-relaxed">
                                        Your session is offline. Connect to synchronize your focus protocols.
                                    </p>
                                    <Button
                                        onClick={openAuthVault}
                                        className="w-full h-12 rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all font-black uppercase tracking-widest shadow-xl shadow-white/5 text-xs"
                                    >
                                        <LogIn className="mr-2 h-4 w-4" /> Initialize Sign In
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
