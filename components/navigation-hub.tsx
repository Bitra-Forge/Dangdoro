"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BackgroundPanel } from "@/components/background-panel";
import { SoundPanel } from "@/components/sound-panel";
import { QuickActionsNav } from "@/components/quick-actions-nav";
import { Navigation } from "@/components/navigation";
import { useTimerStore } from "@/lib/store";

export function NavigationHub() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const isFocusMode = useTimerStore((state) => state.isNavFocusMode);
  const setIsNavFocusMode = useTimerStore((state) => state.setIsNavFocusMode);

  useEffect(() => {
    if (!isHomePage) {
      setIsNavHidden(false);
      setIsNavFocusMode(false);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }

    if (isFocusMode) {
      setIsNavHidden(true);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }

    setIsNavHidden(false);

    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!supportsFinePointer) {
      setIsNavHidden(false);
      return;
    }

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const revealNav = () => {
      clearHideTimer();
      setIsNavHidden((prev) => (prev ? false : prev));
    };

    const scheduleHide = () => {
      if (hideTimerRef.current !== null) {
        return;
      }

      hideTimerRef.current = window.setTimeout(() => {
        setIsNavHidden(true);
        hideTimerRef.current = null;
      }, 2200);
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = navContainerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);

      if (distance <= 130) {
        revealNav();
        return;
      }

      if (distance >= 260) {
        scheduleHide();
        return;
      }

      clearHideTimer();
    };

    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      clearHideTimer();
    };
  }, [isFocusMode, isHomePage, setIsNavFocusMode]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-4 w-full justify-center pointer-events-none">
      <div
        ref={navContainerRef}
        onMouseEnter={() => {
          if (!isFocusMode) {
            setIsNavHidden(false);
          }
        }}
        className={cn(
          "flex items-center gap-4 pointer-events-auto relative px-1 transition-all duration-500",
          isHomePage && (isNavHidden || isFocusMode)
            ? "opacity-0 translate-y-5 scale-95 pointer-events-none"
            : "opacity-100 translate-y-0 scale-100"
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
  );
}
