"use client";

import React, { useEffect, useState } from "react";
import { Settings, Bell, Clock, Palette, LogOut, Shield, Mail, LogIn, ChevronRight, Minus, Plus, Zap } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { logOut } from "@/lib/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateUserSettings } from "@/lib/db";

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [settings, setSettings] = useState({
        focusTime: 25,
        breakTime: 5,
        longBreakTime: 15,
        notifications: true,
        sound: true
    });

    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

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
                    setSettings(prev => ({ ...prev, ...data.settings }));
                }
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const handleUpdateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSaveSettings = async () => {
        if (!user || !hasChanges) return;

        setSaving(true);
        const success = await updateUserSettings(user.uid, settings);
        if (success) {
            toast.success("Settings saved successfully");
            setHasChanges(false);
        } else {
            toast.error("Failed to save settings");
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        try {
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

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                <header className="flex flex-col items-center gap-4 text-center mb-12 w-full max-w-2xl relative">
                    <div className="flex items-center gap-2 mb-2 text-zinc-400 font-black uppercase text-[10px] tracking-[0.4em]">
                        Configuration Engine
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-6 px-4">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                            Tailor Your Flow
                        </h1>

                        {hasChanges && (
                            <Button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="bg-sky-500 text-black hover:bg-sky-400 font-black uppercase tracking-widest text-[10px] px-8 h-12 rounded-xl shadow-xl shadow-sky-500/20 animate-in fade-in zoom-in duration-300 transition-all active:scale-95"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        )}
                    </div>
                </header>

                <div className="w-full max-w-2xl space-y-8">
                    {/* Timer Configuration */}
                    <div className="bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-3 mb-8">
                            <Clock className="w-6 h-6 text-sky-400" />
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Timer Protocols</h2>
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: "Focus Duration", key: "focusTime", icon: Zap, color: "text-amber-500" },
                                { label: "Short Break", key: "breakTime", icon: Clock, color: "text-sky-500" },
                                { label: "Long Break", key: "longBreakTime", icon: Clock, color: "text-purple-500" }
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group hover:bg-white/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-white/10 ${item.color}`}>
                                            <item.icon className="w-4 h-4" />
                                        </div>
                                        <span className="font-bold text-zinc-300 group-hover:text-white transition-colors">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-4 bg-zinc-950/50 p-2 rounded-xl border border-white/5">
                                        <button
                                            onClick={() => handleUpdateSetting(item.key, Math.max(1, (settings as any)[item.key] - 1))}
                                            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-8 text-center font-black text-white italic">{(settings as any)[item.key]}m</span>
                                        <button
                                            onClick={() => handleUpdateSetting(item.key, Math.min(60, (settings as any)[item.key] + 1))}
                                            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Account Center Section */}
                    {user && (
                        <div className="bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                            <div className="flex items-center gap-3 mb-8">
                                <Shield className="w-6 h-6 text-sky-400" />
                                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Account Center</h2>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-white/10">
                                            <Mail className="w-4 h-4 text-zinc-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Email Address</span>
                                            <span className="text-sm font-bold text-white truncate max-w-[200px]">{user.email || "No email linked (Guest)"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-white/10">
                                            <LogIn className="w-4 h-4 text-zinc-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Auth Method</span>
                                            <span className="text-sm font-black text-white uppercase italic tracking-tighter italic">
                                                {user.providerData[0]?.providerId || "Anonymous Guest"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button
                                onClick={handleSignOut}
                                variant="outline"
                                className="w-full h-14 rounded-2xl border-white/5 bg-zinc-950/50 text-zinc-400 hover:text-white hover:bg-white/10 transition-all font-black uppercase tracking-widest"
                            >
                                <LogOut className="mr-2 h-4 w-4" /> Terminate Session
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
