"use client";

import React, { useEffect, useState } from "react";
import {
    Bell, Clock, LogOut, Mail, LogIn,
    Zap, Minus, Plus, RotateCcw,
    ChevronRight, PlayCircle, PauseCircle, Sparkles, Palette, Check, WandSparkles
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { logOut } from "@/lib/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { updateUserSettings } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/lib/store";
import { BackgroundTheme } from "@/components/background-theme";

type AppSettings = typeof DEFAULT_SETTINGS;

type TimerSettingKey = keyof Pick<AppSettings, "focusTime" | "breakTime" | "longBreakTime" | "longBreakEvery" | "adjustmentAmount">;

type TimerField = {
    label: string;
    key: TimerSettingKey;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
};

const DEFAULT_SETTINGS = {
    focusTime: 25,
    breakTime: 5,
    longBreakTime: 15,
    longBreakEvery: 4,
    autoStartBreak: false,
    autoStartFocus: false,
    adjustmentAmount: 1,
    notifications: true,
    sound: true,
    sessionEndSound: "universfield-new-notification-027-383749.mp3",
    glassmorphism: true
};

function settingsEqual(a: typeof DEFAULT_SETTINGS, b: typeof DEFAULT_SETTINGS) {
    return (
        a.focusTime === b.focusTime &&
        a.breakTime === b.breakTime &&
        a.longBreakTime === b.longBreakTime &&
        a.longBreakEvery === b.longBreakEvery &&
        a.autoStartBreak === b.autoStartBreak &&
        a.autoStartFocus === b.autoStartFocus &&
        a.adjustmentAmount === b.adjustmentAmount &&
        a.notifications === b.notifications &&
        a.sound === b.sound &&
        a.sessionEndSound === b.sessionEndSound &&
        a.glassmorphism === b.glassmorphism
    );
}

export default function SettingsPage() {
    const NONE_SOLID_COLORS = [
        { name: "Sage", value: "#757c4f" },
        { name: "Teal Mist", value: "#2f7f7a" },
        { name: "Sky", value: "#4d7a92" },
        { name: "Slate", value: "#646baa" },
        { name: "Rose", value: "#9e5252" },
        { name: "Amber", value: "#8b4b23" },
        { name: "Sandstone", value: "#b07a45" },
        { name: "Violet", value: "#572373" },        
        { name: "Mulberry", value: "#7a3f74" },
    ] as const;

    const NONE_GRADIENT_COLORS = [
        { name: "Aurora", value: "linear-gradient(135deg, #0b1120 0%, #0f2f3a 38%, #1b6e69 72%, #2c8d99 100%)" },
        { name: "Warm Dusk", value: "linear-gradient(135deg, #2a1309 0%, #5d2411 36%, #a13f17 72%, #c35a22 100%)" },
        { name: "Berry Night", value: "linear-gradient(135deg, #1f1143 0%, #3b1a73 35%, #6a2ec7 72%, #4f1c8b 100%)" },
        { name: "Ocean Fog", value: "linear-gradient(135deg, #0a1328 0%, #16305f 36%, #2f5da8 72%, #4a6482 100%)" },
        { name: "Forest Fade", value: "linear-gradient(135deg, #042311 0%, #0f4725 36%, #2e6c2f 72%, #6c7f2a 100%)" },
        { name: "Night Steel", value: "linear-gradient(135deg, #080d1a 0%, #182536 35%, #2e425f 72%, #3f4966 100%)" },
        { name: "Charcoal Plum", value: "linear-gradient(135deg, #0f0d16 0%, #261a38 36%, #42306a 72%, #564188 100%)" },
        { name: "Midnight Pine", value: "linear-gradient(135deg, #06100c 0%, #0d2520 36%, #1a4a3d 72%, #2d6658 100%)" },
        { name: "Smoked Cocoa", value: "linear-gradient(135deg, #100b09 0%, #2a1a14 36%, #4b2b1f 72%, #6a3d2a 100%)" },
        { name: "Deep Ink", value: "linear-gradient(135deg, #050912 0%, #0f1b2f 36%, #1d334f 72%, #2f4762 100%)" },
    ] as const;

    const { user, loading: authLoading, openAuthVault } = useAuth();
    const [loading, setLoading] = useState(true);
    const [savedSettings, setSavedSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
    const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
    const [saving, setSaving] = useState(false);
    const [inputValues, setInputValues] = useState<Record<TimerSettingKey, string>>({
        focusTime: "25",
        breakTime: "5",
        longBreakTime: "15",
        longBreakEvery: "4",
        adjustmentAmount: "1"
    });

    const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const hasChanges = !settingsEqual(settings, savedSettings);

    useEffect(() => {
        if (!user) {
            return;
        }

        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.settings) {
                    const merged = { ...DEFAULT_SETTINGS, ...data.settings };
                    setSavedSettings(merged);
                    setSettings(merged);
                    setInputValues({
                        focusTime: String(merged.focusTime),
                        breakTime: String(merged.breakTime),
                        longBreakTime: String(merged.longBreakTime),
                        longBreakEvery: String(merged.longBreakEvery ?? 4),
                        adjustmentAmount: String(merged.adjustmentAmount)
                    });
                }
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const handleUpdateSetting = (key: TimerSettingKey, value: number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setInputValues(prev => ({ ...prev, [key]: String(value) }));
    };

    const handleUpdateAudio = (value: string) => {
        setSettings(prev => ({ ...prev, sessionEndSound: value }));
    };

    const toggleAutoStart = (key: "autoStartBreak" | "autoStartFocus") => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const timerFields: TimerField[] = [
        { label: "Pomodoro", key: "focusTime", icon: Zap, color: "bg-blue-500" },
        { label: "Break", key: "breakTime", icon: Clock, color: "bg-green-500" },
        { label: "Long Break", key: "longBreakTime", icon: Clock, color: "bg-purple-500" },
        { label: "Long Break Interval", key: "longBreakEvery", icon: PauseCircle, color: "bg-fuchsia-500" },
        { label: "Steps", key: "adjustmentAmount", icon: ChevronRight, color: "bg-zinc-700" },
    ];

    const handleRestoreDefaults = () => {
        setSettings({ ...DEFAULT_SETTINGS });
        setInputValues({
            focusTime: String(DEFAULT_SETTINGS.focusTime),
            breakTime: String(DEFAULT_SETTINGS.breakTime),
            longBreakTime: String(DEFAULT_SETTINGS.longBreakTime),
            longBreakEvery: String(DEFAULT_SETTINGS.longBreakEvery),
            adjustmentAmount: String(DEFAULT_SETTINGS.adjustmentAmount)
        });
    };

    const setSessionEndSound = useTimerStore((state) => state.setSessionEndSound);
    const setInitialTime = useTimerStore((state) => state.setInitialTime);
    const setLongBreakEvery = useTimerStore((state) => state.setLongBreakEvery);
    const setSettingsGlassmorphism = useTimerStore((state) => state.setSettingsGlassmorphism);
    const backgroundSolidColor = useTimerStore((state) => state.backgroundSolidColor);
    const setBackgroundSolidColor = useTimerStore((state) => state.setBackgroundSolidColor);
    const noneBackgroundMode = useTimerStore((state) => state.noneBackgroundMode);
    const setNoneBackgroundMode = useTimerStore((state) => state.setNoneBackgroundMode);
    const noneBackgroundGradient = useTimerStore((state) => state.noneBackgroundGradient);
    const setNoneBackgroundGradient = useTimerStore((state) => state.setNoneBackgroundGradient);
    const [showCustomColorPanel, setShowCustomColorPanel] = useState(false);
    const [customColorDraft, setCustomColorDraft] = useState(backgroundSolidColor);
    const customColorPanelRef = React.useRef<HTMLDivElement | null>(null);
    const presetSolidValues = new Set(NONE_SOLID_COLORS.map((color) => color.value.toLowerCase()));
    const customSolidColor = !presetSolidValues.has(backgroundSolidColor.toLowerCase());

    useEffect(() => {
        setCustomColorDraft(backgroundSolidColor);
    }, [backgroundSolidColor]);

    useEffect(() => {
        if (!showCustomColorPanel) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (customColorPanelRef.current && !customColorPanelRef.current.contains(event.target as Node)) {
                setShowCustomColorPanel(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showCustomColorPanel]);

    const normalizeHexColor = (value: string) => {
        const withHash = value.startsWith("#") ? value : `#${value}`;
        return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
    };

    const applyCustomColor = (value: string) => {
        setBackgroundSolidColor(value);
        setNoneBackgroundMode("solid");
    };

    const handleSaveSettings = async () => {
        if (!user || !hasChanges) return;

        setSaving(true);
        const success = await updateUserSettings(user.uid, settings);
        if (success) {
            setSessionEndSound(settings.sessionEndSound);
            setInitialTime("focus", settings.focusTime * 60);
            setInitialTime("break", settings.breakTime * 60);
            setInitialTime("long-break", settings.longBreakTime * 60);
            setLongBreakEvery(settings.longBreakEvery);
            useTimerStore.getState().setAutoStartBreak(settings.autoStartBreak);
            useTimerStore.getState().setAutoStartFocus(settings.autoStartFocus);
            setSettingsGlassmorphism(settings.glassmorphism);

            toast.success("Settings saved");
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
            toast.success("Signed out.");
        } catch {
            toast.error("Error signing out.");
        }
    };

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <BackgroundTheme>
            <div className="relative z-10 w-full min-h-screen font-sans text-white">
                <main className="max-w-4xl mx-auto w-full px-6 pt-20 pb-20">
                    <header className="flex items-center justify-between mb-10">
                        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                        <div className="flex items-center gap-2">
                             {hasChanges && (
                                <button
                                    onClick={handleRestoreDefaults}
                                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                                    title="Restore Defaults"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                             )}
                            <button
                                onClick={handleSaveSettings}
                                disabled={!hasChanges || saving}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                    hasChanges 
                                        ? "bg-white text-black hover:bg-zinc-200" 
                                        : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                                }`}
                            >
                                {saving ? "Saving..." : hasChanges ? "Save" : "Saved"}
                            </button>
                        </div>
                    </header>

                    <div className="space-y-8">
                        {/* Time Control Section */}
                        <section>
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-1">Timer</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 bg-zinc-900/50 rounded-lg overflow-hidden border border-white/5">
                                {timerFields.map((item, i) => (
                                    <div 
                                        key={item.key}
                                        className={`flex items-center justify-between p-6 transition-colors hover:bg-white/[0.01] 
                                            ${i < 3 ? 'border-b md:border-b-0' : ''} 
                                            ${i < 2 ? 'md:border-b' : ''} 
                                            ${i % 2 === 0 ? 'md:border-r' : ''} 
                                            border-white/5`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center`}>
                                                <item.icon className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-zinc-200 font-medium">{item.label}</span>
                        {item.key === "longBreakEvery" && (
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Number of pomodoros before a long break</span>
                        )}
                    </div>
                </div>
                                        <div className="flex items-center gap-3 bg-black/20 p-1 rounded-lg">
                                            <button 
                                                onClick={() => handleUpdateSetting(item.key, Math.max(1, settings[item.key] - 1))}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input
                                                type="text"
                                                value={inputValues[item.key] || ""}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    setInputValues(prev => ({ ...prev, [item.key]: val }));
                                                }}
                                                onBlur={(e) => {
                                                    let num = parseInt(e.target.value) || 1;
                                                    num = Math.max(1, Math.min(120, num));
                                                    handleUpdateSetting(item.key, num);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        (e.target as HTMLInputElement).blur();
                                                    }
                                                }}
                                                className="w-12 bg-transparent text-center font-bold text-lg outline-none focus:text-white focus:bg-white/5 rounded transition-all tabular-nums cursor-text"
                                            />
                                            <button 
                                                onClick={() => handleUpdateSetting(item.key, Math.min(120, settings[item.key] + 1))}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Auto Start Section */}
                        <section>
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-1">Auto Start</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 bg-zinc-900/50 rounded-lg overflow-hidden border border-white/5">
                                {[
                                    { key: "autoStartBreak", title: "Auto start break", description: "Start short and long breaks automatically after pomodoro ends." },
                                    { key: "autoStartFocus", title: "Auto start pomodoro", description: "Start the next pomodoro automatically after a break ends." },
                                ].map((item, i) => (
                                    <button
                                        key={item.key}
                                        onClick={() => toggleAutoStart(item.key as "autoStartBreak" | "autoStartFocus")}
                                        className={`text-left p-6 transition-colors hover:bg-white/[0.01] border-white/5 ${i === 0 ? "md:border-r border-b md:border-b-0" : ""}`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-zinc-200 font-medium">{item.title}</div>
                                                <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">{item.description}</div>
                                            </div>
                                            <div className={cn(
                                                "relative w-12 h-7 rounded-full transition-colors flex-shrink-0",
                                                settings[item.key as "autoStartBreak" | "autoStartFocus"] ? "bg-emerald-500" : "bg-zinc-700"
                                            )}>
                                                <div className={cn(
                                                    "absolute left-1 top-1 w-5 h-5 rounded-full bg-white transition-transform",
                                                    settings[item.key as "autoStartBreak" | "autoStartFocus"] ? "translate-x-5" : "translate-x-0"
                                                )} />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                        {/* Premium Effects Section */}
                        <section id="background-theme">
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-1">Appearance</h2>
                            <div className="relative bg-zinc-900/50 rounded-lg overflow-visible border border-white/5">
                                <div className="p-6 border-b border-white/5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                                            <Palette className="w-4 h-4 text-zinc-200" />
                                        </div>
                                        <div>
                                            <div className="text-zinc-200 font-medium">Background Theme</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4">
                                        <button
                                            onClick={() => setNoneBackgroundMode("solid")}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-xs font-bold border transition-all",
                                                noneBackgroundMode === "solid"
                                                    ? "bg-white text-black border-white"
                                                    : "bg-black/20 text-zinc-400 border-white/10 hover:text-white hover:border-white/30"
                                            )}
                                        >
                                            Solid
                                        </button>
                                        <button
                                            onClick={() => setNoneBackgroundMode("gradient")}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-xs font-bold border transition-all",
                                                noneBackgroundMode === "gradient"
                                                    ? "bg-white text-black border-white"
                                                    : "bg-black/20 text-zinc-400 border-white/10 hover:text-white hover:border-white/30"
                                            )}
                                        >
                                            Gradient
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch">
                                        <div>
                                            {noneBackgroundMode === "solid" ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {NONE_SOLID_COLORS.map((color) => {
                                                        const selected = backgroundSolidColor.toLowerCase() === color.value;
                                                        return (
                                                            <button
                                                                key={color.value}
                                                                onClick={() => setBackgroundSolidColor(color.value)}
                                                                title={color.name}
                                                                className={cn(
                                                                    "relative h-16 rounded-xl transition-all flex items-center justify-center cursor-pointer",
                                                                    selected ? "" : "hover:scale-[1.02]"
                                                                )}
                                                                style={{ backgroundColor: color.value }}
                                                            >
                                                                <div
                                                                    className={cn(
                                                                        "absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border border-white/20 bg-black/60 text-white flex items-center justify-center shadow-md shadow-black/60 backdrop-blur-[1px] transition-all duration-200",
                                                                        selected ? "opacity-100 scale-100" : "opacity-0 scale-75"
                                                                    )}
                                                                >
                                                                    <Check className="h-2.5 w-2.5" />
                                                                </div>
                                                            </button>
                                                        );
                                                    })}

                                                    <div className="relative" ref={customColorPanelRef}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNoneBackgroundMode("solid");
                                                                setShowCustomColorPanel((prev) => !prev);
                                                            }}
                                                            className={cn(
                                                                "group relative h-16 w-full rounded-xl transition-all flex items-center justify-center overflow-hidden cursor-pointer",
                                                                customSolidColor ? "" : "hover:scale-[1.02]"
                                                            )}
                                                            style={{ backgroundColor: backgroundSolidColor }}
                                                            title="Custom color"
                                                        >
                                                            <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.05)_45%,rgba(0,0,0,0.08)_100%)]" />
                                                            <WandSparkles className="relative z-10 h-5 w-5 text-white" />

                                                            <div
                                                                className={cn(
                                                                    "absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border border-white/20 bg-black/60 text-white flex items-center justify-center shadow-md shadow-black/60 backdrop-blur-[1px] transition-all duration-200",
                                                                    customSolidColor ? "opacity-100 scale-100" : "opacity-0 scale-75"
                                                                )}
                                                            >
                                                                <Check className="h-2.5 w-2.5" />
                                                            </div>
                                                        </button>

                                                        {showCustomColorPanel && (
                                                            <div className="absolute top-[calc(100%+8px)] left-0 z-30 w-72 rounded-xl border border-white/15 bg-[#0a0d16]/95 backdrop-blur-xl p-3 shadow-2xl shadow-black/70">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Custom Color</div>
                                                                    <div className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: backgroundSolidColor }} />
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="color"
                                                                        value={backgroundSolidColor.startsWith("#") ? backgroundSolidColor : "#000000"}
                                                                        onChange={(e) => applyCustomColor(e.target.value.toLowerCase())}
                                                                        className="h-10 w-10 cursor-pointer rounded-full border border-white/25 bg-transparent p-0 overflow-hidden shadow-md shadow-black/40 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full"
                                                                        aria-label="Pick custom color"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={customColorDraft}
                                                                        onChange={(e) => {
                                                                            const raw = e.target.value;
                                                                            setCustomColorDraft(raw);
                                                                            const normalized = normalizeHexColor(raw);
                                                                            if (normalized) {
                                                                                applyCustomColor(normalized);
                                                                            }
                                                                        }}
                                                                        onBlur={() => {
                                                                            const normalized = normalizeHexColor(customColorDraft);
                                                                            setCustomColorDraft(normalized ?? backgroundSolidColor);
                                                                        }}
                                                                        placeholder="#2f7f7a"
                                                                        className="h-10 flex-1 rounded-md border border-white/15 bg-black/35 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/35"
                                                                    />
                                                                </div>

                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {NONE_GRADIENT_COLORS.map((gradient) => {
                                                        const selected = noneBackgroundGradient === gradient.value;
                                                        return (
                                                            <button
                                                                key={gradient.name}
                                                                onClick={() => setNoneBackgroundGradient(gradient.value)}
                                                                className={cn(
                                                                    "group relative h-16 rounded-xl overflow-hidden transition-all flex items-center justify-center cursor-pointer",
                                                                    selected ? "text-white" : "text-zinc-300 hover:scale-[1.02]"
                                                                )}
                                                                style={{ backgroundImage: gradient.value }}
                                                                title={gradient.name}
                                                            >
                                                                <span className="pointer-events-none absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                                <span className="relative z-10 text-white/0 group-hover:text-white/40 text-base font-bold text-center transition-all duration-300">
                                                                    {gradient.name}
                                                                </span>
                                                                <div
                                                                    className={cn(
                                                                        "absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border border-white/20 bg-black/60 text-white flex items-center justify-center shadow-md shadow-black/60 backdrop-blur-[1px] z-20 transition-all duration-200",
                                                                        selected ? "opacity-100 scale-100" : "opacity-0 scale-75"
                                                                    )}
                                                                >
                                                                    <Check className="h-2.5 w-2.5" />
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="h-full">
                                            <div className="relative rounded-2xl border border-white/25 p-6 overflow-hidden h-full min-h-[368px] flex items-center justify-center">
                                                <div
                                                    className="absolute inset-0"
                                                    style={
                                                        noneBackgroundMode === "gradient"
                                                            ? { backgroundImage: noneBackgroundGradient }
                                                            : { backgroundColor: backgroundSolidColor }
                                                    }
                                                />
                                                <div className="absolute inset-0 bg-black/30" />

                                                <div className="relative z-10 flex flex-col items-center justify-center">
                                                    <div
                                                        className="text-[4rem] leading-none font-black tabular-nums bg-gradient-to-br from-white via-white/90 to-white/60 bg-clip-text text-transparent"
                                                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                                                    >
                                                        25:00
                                                    </div>
                                                    <div
                                                        className="text-xl font-semibold text-zinc-200"
                                                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                                                    >
                                                        Pomodoro
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-1">Premium Effects</h2>
                            <div className="bg-zinc-900/50 rounded-lg overflow-hidden border border-white/5">
                                <button
                                    onClick={() => setSettings(prev => ({ ...prev, glassmorphism: !prev.glassmorphism }))}
                                    className="w-full text-left p-6 transition-colors hover:bg-white/[0.01]"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-[#C9B037]/20 flex items-center justify-center border border-[#C9B037]/20">
                                                <Sparkles className="w-5 h-5 text-[#C9B037]" />
                                            </div>
                                            <div>
                                                <div className="text-zinc-200 font-medium">UI Transparency (Glassmorphism)</div>
                                                <div className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">Enable cinematic frosted-glass backgrounds. Disable for solid high-contrast mode.</div>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "relative w-12 h-7 rounded-full transition-colors flex-shrink-0",
                                            settings.glassmorphism ? "bg-[#C9B037]" : "bg-zinc-700"
                                        )}>
                                            <div className={cn(
                                                "absolute left-1 top-1 w-5 h-5 rounded-full bg-white transition-transform",
                                                settings.glassmorphism ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </section>

                        {/* Audio Section */}
                        <section>
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-1">Audio</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 bg-zinc-900/50 rounded-lg overflow-hidden border border-white/5">
                                {[
                                    { id: "universfield-new-notification-027-383749.mp3", label: "Minimal Tech" },
                                    { id: "universfield-soft-piano-logo-141290.mp3", label: "Zen Piano" },
                                    { id: "koiroylers-cutie-cat-355747.mp3", label: "Cyber Cat" }
                                ].map((sound, i) => (
                                    <div 
                                        key={sound.id}
                                        className={`flex items-center justify-between p-6 cursor-pointer transition-all
                                            ${i < 2 ? 'border-b md:border-b-0 md:border-r border-white/5' : ''} 
                                            ${i === 2 ? 'md:border-0' : ''}
                                            ${settings.sessionEndSound === sound.id ? 'bg-emerald-500/10' : 'hover:bg-white/[0.02]'}`}
                                        onClick={() => handleUpdateAudio(sound.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                                settings.sessionEndSound === sound.id ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-zinc-800"
                                            )}>
                                                <Bell className={cn("w-4 h-4", settings.sessionEndSound === sound.id ? "text-white" : "text-zinc-500")} />
                                            </div>
                                            <span className={settings.sessionEndSound === sound.id ? "text-white font-bold" : "text-zinc-400 font-medium"}>
                                                {sound.label}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (playingSoundId === sound.id) {
                                                    audioRef.current?.pause();
                                                    setPlayingSoundId(null);
                                                } else {
                                                    audioRef.current?.pause();
                                                    const audio = new Audio(`/SessionEndSounds/${sound.id}`);
                                                    audio.volume = 0.5;
                                                    audioRef.current = audio;
                                                    setPlayingSoundId(sound.id);
                                                    audio.play();
                                                    audio.onended = () => setPlayingSoundId(null);
                                                }
                                            }}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 text-zinc-500 hover:text-white transition-colors"
                                        >
                                            {playingSoundId === sound.id ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Account Section */}
                        <section>
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-1">Account</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 bg-zinc-900/50 rounded-lg overflow-hidden border border-white/5">
                                {user ? (
                                    <>
                                        <div className="flex items-center justify-between p-6 border-b md:border-b-0 md:border-r border-white/5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/20">
                                                    <Mail className="w-5 h-5 text-orange-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-0.5">Signed in as</span>
                                                    <span className="text-zinc-200 font-bold">{user.email || "Guest"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div 
                                            className="flex items-center justify-between p-6 cursor-pointer hover:bg-rose-500/10 transition-all group"
                                            onClick={user.isAnonymous ? openAuthVault : handleSignOut}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center border border-red-500/20 group-hover:bg-red-500 transition-all">
                                                    <LogOut className="w-5 h-5 text-red-500 group-hover:text-white" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-0.5">Account Status</span>
                                                    <span className="text-red-400 font-bold group-hover:text-red-300">
                                                        {user.isAnonymous ? "Sign In / Register" : "Sign Out"}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </>
                                ) : (
                                    <div 
                                        className="col-span-1 md:col-span-2 flex items-center justify-between p-8 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                        onClick={openAuthVault}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                                                <LogIn className="w-6 h-6 text-blue-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-zinc-200 font-bold">Sign In to Sync</h3>
                                                <p className="text-sm text-zinc-500">Preserve your settings and task history across all devices.</p>
                                            </div>
                                        </div>
                                        <div className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20">
                                            Sign In
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </BackgroundTheme>
    );
}
