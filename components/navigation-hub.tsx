"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QuickActionsNav } from "@/components/quick-actions-nav";
import { Navigation } from "@/components/navigation";
import { useTimerStore } from "@/lib/store";

const BackgroundPanel = dynamic(() => import("@/components/background-panel").then((m) => m.BackgroundPanel), { ssr: false });
const SoundPanel = dynamic(() => import("@/components/sound-panel").then((m) => m.SoundPanel), { ssr: false });
const StickyNotesOverlay = dynamic(() => import("@/components/sticky-notes-overlay").then((m) => m.StickyNotesOverlay), { ssr: false });
const StickyNotesPanel = dynamic(() => import("@/components/sticky-notes-panel").then((m) => m.StickyNotesPanel), { ssr: false });
const QuickTasksPanel = dynamic(() => import("@/components/quick-tasks-panel").then((m) => m.QuickTasksPanel), { ssr: false });

export function NavigationHub() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isAdminPage = pathname?.startsWith("/admin");
  const isFocusMode = useTimerStore((state) => state.isNavFocusMode);
  const setIsNavFocusMode = useTimerStore((state) => state.setIsNavFocusMode);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [visitedChecked, setVisitedChecked] = useState(false);
  const [isFirstTimeVisitor, setIsFirstTimeVisitor] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const visited = localStorage.getItem("dangdoro_visited");
      setIsFirstTimeVisitor(!visited);
      setVisitedChecked(true);
    }
  }, [pathname]);

  const hideNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        setIsInputFocused(true);
        document.body.classList.add("input-focused");
      }
    };
    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA")) {
          setIsInputFocused(false);
          document.body.classList.remove("input-focused");
        }
      }, 50);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("focusin", handleFocusIn);
      document.addEventListener("focusout", handleFocusOut);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("focusin", handleFocusIn);
        document.removeEventListener("focusout", handleFocusOut);
        document.body.classList.remove("input-focused");
      }
    };
  }, []);

  const clearHideNavTimeout = useCallback(() => {
    if (hideNavTimeoutRef.current) {
      clearTimeout(hideNavTimeoutRef.current);
      hideNavTimeoutRef.current = null;
    }
  }, []);

  const scheduleHideNav = useCallback(() => {
    clearHideNavTimeout();
    hideNavTimeoutRef.current = setTimeout(() => {
      setIsNavVisible(false);
      hideNavTimeoutRef.current = null;
    }, 3000);
  }, [clearHideNavTimeout]);

  const handleNavMouseEnter = () => {
    clearHideNavTimeout();
    setIsNavVisible(true);
  };

  const handleNavMouseLeave = () => {
    if (isFocusMode) {
      clearHideNavTimeout();
      setIsNavVisible(false);
      return;
    }
    scheduleHideNav();
  };

  // Still handle focus mode reset on page change
  useEffect(() => {
    if (!isHomePage) {
      setIsNavFocusMode(false);
    }
  }, [isHomePage, setIsNavFocusMode]);

  // Keep navigation bar visible when driver.js tour is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.body.classList.contains("driver-active")) {
        setIsNavVisible(true);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Re-show nav after route changes and focus-mode toggles.
    clearHideNavTimeout();

    const raf = requestAnimationFrame(() => {
      setIsNavVisible(!isFocusMode);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearHideNavTimeout();
    };
  }, [pathname, isFocusMode, clearHideNavTimeout]);

  const handleNavTouchStart = useCallback(() => {
    clearHideNavTimeout();
    setIsNavVisible(true);
    // Set 4-second auto-hide timeout on touch
    hideNavTimeoutRef.current = setTimeout(() => {
      setIsNavVisible(false);
      hideNavTimeoutRef.current = null;
    }, 4000);
  }, [clearHideNavTimeout]);

  useEffect(() => {
    if (isFocusMode) {
      clearHideNavTimeout();
      return;
    }

    const handleMouseMove = () => {
      setIsNavVisible(true);
      scheduleHideNav();
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchstart", handleMouseMove, { passive: true });
    scheduleHideNav();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleMouseMove);
      clearHideNavTimeout();
    };
  }, [isFocusMode, clearHideNavTimeout, scheduleHideNav]);

  if (isAdminPage || pathname?.startsWith("/welcome") || !visitedChecked || (isHomePage && isFirstTimeVisitor)) return null;

  const forceHide = isInputFocused || (typeof document !== "undefined" && document.body.classList.contains("hide-navigation-bar"));

  return (
    <>
      {isHomePage && (
        <>
          <StickyNotesOverlay />
          <StickyNotesPanel />
          <QuickTasksPanel />
        </>
      )}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-4 w-full justify-center pointer-events-none">
        {isFocusMode && !isNavVisible && (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-16 w-[720px] max-w-[96vw] pointer-events-auto"
            onMouseEnter={handleNavMouseEnter}
            onTouchStart={handleNavTouchStart}
          />
        )}

        <div
          onMouseEnter={handleNavMouseEnter}
          onMouseLeave={handleNavMouseLeave}
          onTouchStart={handleNavTouchStart}
          className={cn(
            "flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 relative px-1 transition-all duration-500",
            isNavVisible && !forceHide
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 translate-y-5 scale-95 pointer-events-none"
          )}
        >
          {isHomePage && (
            <>
              <BackgroundPanel />
              <SoundPanel />
              <QuickActionsNav />
            </>
          )}
          <Navigation />
        </div>
      </div>
    </>
  );
}
