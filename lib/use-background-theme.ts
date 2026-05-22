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
    const [state, setState] = useState<{
        showDots: boolean;
        bgPalette: keyof typeof BG_PALETTES;
        isHydrated: boolean;
    }>({
        showDots: BG_CONFIG.DEFAULTS.showDots,
        bgPalette: BG_CONFIG.DEFAULTS.palette,
        isHydrated: false,
    });

    const { showDots, bgPalette, isHydrated } = state;
    const dotsKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.SHOW_DOTS : BG_CONFIG.STORAGE_KEYS.SHOW_DOTS_GLOBAL;
    const paletteKey = isHomePage ? BG_CONFIG.STORAGE_KEYS.BG_PALETTE : BG_CONFIG.STORAGE_KEYS.BG_PALETTE_GLOBAL;

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedDots = localStorage.getItem(dotsKey);
            const savedPalette = localStorage.getItem(paletteKey);
            
            const finalDots = savedDots !== null ? savedDots === "true" : BG_CONFIG.DEFAULTS.showDots;
            const finalPalette = (savedPalette && savedPalette in BG_PALETTES)
                ? (savedPalette as keyof typeof BG_PALETTES)
                : BG_CONFIG.DEFAULTS.palette;

            // Use setTimeout to execute the state update in a macro-task
            // to prevent synchronous cascading renders in the effect loop.
            const timer = setTimeout(() => {
                setState({
                    showDots: finalDots,
                    bgPalette: finalPalette,
                    isHydrated: true,
                });
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [dotsKey, paletteKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleThemeSync = (event: Event) => {
            const customEvent = event as CustomEvent<ThemeSyncDetail>;
            const detail = customEvent.detail;
            if (!detail) return;
            if (detail.dotsKey !== dotsKey || detail.paletteKey !== paletteKey) return;
            setState((prev) => ({
                ...prev,
                showDots: detail.showDots,
                bgPalette: detail.bgPalette,
            }));
        };

        window.addEventListener(THEME_SYNC_EVENT, handleThemeSync as EventListener);
        return () => {
            window.removeEventListener(THEME_SYNC_EVENT, handleThemeSync as EventListener);
        };
    }, [dotsKey, paletteKey]);

    const updateShowDots = (value: boolean) => {
        setState((prev) => ({ ...prev, showDots: value }));
        localStorage.setItem(dotsKey, String(value));
        window.dispatchEvent(new CustomEvent<ThemeSyncDetail>(THEME_SYNC_EVENT, {
            detail: { dotsKey, paletteKey, showDots: value, bgPalette }
        }));
    };

    const updateBgPalette = (value: keyof typeof BG_PALETTES) => {
        setState((prev) => ({ ...prev, bgPalette: value }));
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

