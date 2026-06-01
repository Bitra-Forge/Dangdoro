"use client";

import { ReactNode } from "react";
import { AnimatedDotGrid } from "@/components/animated-dot-grid";
import { useBackgroundTheme } from "@/lib/use-background-theme";
import { cn } from "@/lib/utils";

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
    const { showDots, bgPalette, isHydrated } = useBackgroundTheme(isHomePage);
    const shouldShowFloatingSettings = showSettings && !isHomePage;
    const effectiveShowDots = disableDots ? false : showDots;

    return (
        <>
            {/* Background */}
            {isHydrated ? (
                <AnimatedDotGrid showDots={effectiveShowDots} palette={bgPalette} />
            ) : (
                <div className="fixed inset-0 z-0 pointer-events-none bg-zinc-950" />
            )}
            {subtleOverlay && <div className="fixed inset-0 z-[1] bg-zinc-950/55 pointer-events-none" />}
            
            {/* Children content */}
            {children}
        </>
    );
}
