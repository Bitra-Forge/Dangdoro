"use client";

import { useEffect, useState } from "react";
import { BG_CONFIG, BG_PALETTES } from "@/lib/background-config";

export function useBackgroundTheme() {
    const [showDots, setShowDots] = useState<boolean>(BG_CONFIG.DEFAULTS.showDots);
    const [bgPalette, setBgPalette] = useState<keyof typeof BG_PALETTES>(BG_CONFIG.DEFAULTS.palette);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedDots = localStorage.getItem(BG_CONFIG.STORAGE_KEYS.SHOW_DOTS);
            const savedPalette = localStorage.getItem(BG_CONFIG.STORAGE_KEYS.BG_PALETTE);
            
            if (savedDots !== null) {
                setShowDots(savedDots === "true");
            }
            
            if (savedPalette && savedPalette in BG_PALETTES) {
                setBgPalette(savedPalette as keyof typeof BG_PALETTES);
            }
            
            setIsHydrated(true);
        }
    }, []);

    const updateShowDots = (value: boolean) => {
        setShowDots(value);
        localStorage.setItem(BG_CONFIG.STORAGE_KEYS.SHOW_DOTS, String(value));
    };

    const updateBgPalette = (value: keyof typeof BG_PALETTES) => {
        setBgPalette(value);
        localStorage.setItem(BG_CONFIG.STORAGE_KEYS.BG_PALETTE, value);
    };

    return {
        showDots,
        bgPalette,
        updateShowDots,
        updateBgPalette,
        isHydrated,
    };
}
