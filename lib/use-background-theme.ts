"use client";

import { useEffect, useState } from "react";
import { BG_CONFIG, BG_PALETTES } from "@/lib/background-config";

export function useBackgroundTheme(isHomePage: boolean = false) {
    const [showDots, setShowDots] = useState<boolean>(BG_CONFIG.DEFAULTS.showDots);
    const [bgPalette, setBgPalette] = useState<keyof typeof BG_PALETTES>(BG_CONFIG.DEFAULTS.palette);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const dotsKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.SHOW_DOTS : BG_CONFIG.STORAGE_KEYS.SHOW_DOTS_GLOBAL;
            const paletteKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.BG_PALETTE : BG_CONFIG.STORAGE_KEYS.BG_PALETTE_GLOBAL;

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
    }, [isHomePage]);

    const updateShowDots = (value: boolean) => {
        setShowDots(value);
        const dotsKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.SHOW_DOTS : BG_CONFIG.STORAGE_KEYS.SHOW_DOTS_GLOBAL;
        localStorage.setItem(dotsKey, String(value));
    };

    const updateBgPalette = (value: keyof typeof BG_PALETTES) => {
        setBgPalette(value);
        const paletteKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.BG_PALETTE : BG_CONFIG.STORAGE_KEYS.BG_PALETTE_GLOBAL;
        localStorage.setItem(paletteKey, value);
    };

    return {
        showDots,
        bgPalette,
        updateShowDots,
        updateBgPalette,
        isHydrated,
    };
}
