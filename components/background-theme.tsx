"use client";

import { useState, ReactNode } from "react";
import { AnimatedDotGrid } from "@/components/animated-dot-grid";
import { BG_PALETTES } from "@/lib/background-config";
import { useBackgroundTheme } from "@/lib/use-background-theme";
import { cn } from "@/lib/utils";
import { Settings, X } from "lucide-react";

interface BackgroundThemeProps {
    children?: ReactNode;
    showSettings?: boolean;
    isHomePage?: boolean;
    disableDots?: boolean;
    subtleOverlay?: boolean;
}

export function BackgroundTheme({
    children,
    showSettings = true,
    isHomePage = false,
    disableDots = false,
    subtleOverlay = false
}: BackgroundThemeProps = {}) {
    const { showDots, bgPalette, updateShowDots, updateBgPalette, isHydrated } = useBackgroundTheme(isHomePage);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const shouldShowFloatingSettings = showSettings && !isHomePage;
    const effectiveShowDots = disableDots ? false : showDots;

    if (!isHydrated) return null;

    return (
        <>
            {/* Background */}
            <AnimatedDotGrid showDots={effectiveShowDots} palette={bgPalette} />
            {subtleOverlay && <div className="fixed inset-0 z-[1] bg-zinc-950/55 pointer-events-none" />}
            
            {/* Children content */}
            {children}

            {/* Settings button & panel - only show if showSettings prop is true */}
            {shouldShowFloatingSettings && (
                <div className="fixed top-20 right-8 z-20">
                    <button
                        onClick={() => setShowSettingsPanel(v => !v)}
                        className={cn(
                            "p-2.5 rounded-xl border backdrop-blur-sm transition-all",
                            showSettingsPanel
                                ? "bg-white/15 border-white/25 text-white"
                                : "bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white"
                        )}
                        title="Background settings"
                    >
                        <Settings className={cn("w-4 h-4 transition-transform duration-300", showSettingsPanel && "rotate-90")} />
                    </button>
                    
                    {showSettingsPanel && (
                        <div className="absolute top-12 right-0 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Dots toggle */}
                            <div className="mb-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block">
                                    Dot Grid
                                </label>
                                <button
                                    onClick={() => updateShowDots(!showDots)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all",
                                        showDots 
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                            : "bg-white/5 border-white/10 text-zinc-500"
                                    )}
                                >
                                    <span className="text-xs font-semibold">{showDots ? "Enabled" : "Disabled"}</span>
                                    <div className={cn(
                                        "w-8 h-4 rounded-full transition-all relative",
                                        showDots ? "bg-emerald-500" : "bg-zinc-700"
                                    )}>
                                        <div className={cn(
                                            "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                                            showDots ? "left-4" : "left-0.5"
                                        )} />
                                    </div>
                                </button>
                            </div>
                            
                            {/* Palette options */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block">
                                    Color Palette
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(Object.keys(BG_PALETTES) as (keyof typeof BG_PALETTES)[]).map((key) => (
                                        <button
                                            key={key}
                                            onClick={() => updateBgPalette(key)}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-left",
                                                bgPalette === key
                                                    ? "bg-white/15 text-white border border-white/20"
                                                    : "bg-white/5 text-zinc-500 hover:text-zinc-300 border border-transparent"
                                            )}
                                        >
                                            {BG_PALETTES[key].name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
