"use client";

import { useEffect, useState } from "react";
import { BG_CONFIG, BG_PALETTES } from "@/lib/background-config";

const THEME_SYNC_EVENT = "dangdoro-background-theme-sync";

type ThemeSyncDetail = {
    dotsKey: string;
    paletteKey: string;
    showDots: boolean;
    bgPalette: keyof typeof BG_PALETTES;
};

export function useBackgroundTheme(isHomePage: boolean = false) {
    const [showDots, setShowDots] = useState<boolean>(BG_CONFIG.DEFAULTS.showDots);
    const [bgPalette, setBgPalette] = useState<keyof typeof BG_PALETTES>(BG_CONFIG.DEFAULTS.palette);
    const [isHydrated, setIsHydrated] = useState(false);
    const dotsKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.SHOW_DOTS : BG_CONFIG.STORAGE_KEYS.SHOW_DOTS_GLOBAL;
    const paletteKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.BG_PALETTE : BG_CONFIG.STORAGE_KEYS.BG_PALETTE_GLOBAL;

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedDots = localStorage.getItem(dotsKey);
            const savedPalette = localStorage.getItem(paletteKey);
            
            if (savedDots !== null) {
                setShowDots(savedDots === "true");
            } else {
                // Default fallback if not set to ensure we don't start with empty if global is not yet set
                setShowDots(BG_CONFIG.DEFAULTS.showDots);
            }
            
            if (savedPalette && savedPalette in BG_PALETTES) {
                setBgPalette(savedPalette as keyof typeof BG_PALETTES);
            } else {
                setBgPalette(BG_CONFIG.DEFAULTS.palette);
            }
            
            setIsHydrated(true);
        }
    }, [dotsKey, paletteKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleThemeSync = (event: Event) => {
            const customEvent = event as CustomEvent<ThemeSyncDetail>;
            const detail = customEvent.detail;
            if (!detail) return;
            if (detail.dotsKey !== dotsKey || detail.paletteKey !== paletteKey) return;
            setShowDots(detail.showDots);
            setBgPalette(detail.bgPalette);
        };

        window.addEventListener(THEME_SYNC_EVENT, handleThemeSync as EventListener);
        return () => {
            window.removeEventListener(THEME_SYNC_EVENT, handleThemeSync as EventListener);
        };
    }, [dotsKey, paletteKey]);

    const updateShowDots = (value: boolean) => {
        setShowDots(value);
        localStorage.setItem(dotsKey, String(value));
        window.dispatchEvent(new CustomEvent<ThemeSyncDetail>(THEME_SYNC_EVENT, {
            detail: { dotsKey, paletteKey, showDots: value, bgPalette }
        }));
    };

    const updateBgPalette = (value: keyof typeof BG_PALETTES) => {
        setBgPalette(value);
        localStorage.setItem(paletteKey, value);
        window.dispatchEvent(new CustomEvent<ThemeSyncDetail>(THEME_SYNC_EVENT, {
            detail: { dotsKey, paletteKey, showDots, bgPalette: value }
        }));
    };

    return {
        showDots,
        bgPalette,
        updateShowDots,
        updateBgPalette,
        isHydrated,
    };
}
