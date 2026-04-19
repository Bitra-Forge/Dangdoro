"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundPanel } from "@/components/background-panel";
import { SoundPanel } from "@/components/sound-panel";
import { QuickActionsNav } from "@/components/quick-actions-nav";
import { Navigation } from "@/components/navigation";
import { useTimerStore } from "@/lib/store";
import { NotesPanel } from "@/components/notes-panel";
import { QuickTasksPanel } from "@/components/quick-tasks-panel";

export function NavigationHub() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isFocusMode = useTimerStore((state) => state.isNavFocusMode);
  const setIsNavFocusMode = useTimerStore((state) => state.setIsNavFocusMode);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const hideNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    scheduleHideNav();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearHideNavTimeout();
    };
  }, [isFocusMode, clearHideNavTimeout, scheduleHideNav]);

  return (
    <>
      {isHomePage && (
        <>
          <NotesPanel />
          <QuickTasksPanel />
        </>
      )}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-4 w-full justify-center pointer-events-none">
        {isFocusMode && !isNavVisible && (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-16 w-[720px] max-w-[96vw] pointer-events-auto"
            onMouseEnter={handleNavMouseEnter}
          />
        )}

        <div
          onMouseEnter={handleNavMouseEnter}
          onMouseLeave={handleNavMouseLeave}
          className={cn(
            "flex items-center gap-4 relative px-1 transition-all duration-500",
            isNavVisible
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
