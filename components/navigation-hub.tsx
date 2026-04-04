"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BackgroundPanel } from "@/components/background-panel";
import { SoundPanel } from "@/components/sound-panel";
import { QuickActionsNav } from "@/components/quick-actions-nav";
import { Navigation } from "@/components/navigation";
import { useTimerStore } from "@/lib/store";

export function NavigationHub() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isFocusMode = useTimerStore((state) => state.isNavFocusMode);
  const setIsNavFocusMode = useTimerStore((state) => state.setIsNavFocusMode);

  // Still handle focus mode reset on page change
  useEffect(() => {
    if (!isHomePage) {
      setIsNavFocusMode(false);
    }
  }, [isHomePage, setIsNavFocusMode]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-4 w-full justify-center pointer-events-none">
      <div
        className={cn(
          "flex items-center gap-4 pointer-events-auto relative px-1 transition-all duration-500",
          isHomePage && isFocusMode
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
