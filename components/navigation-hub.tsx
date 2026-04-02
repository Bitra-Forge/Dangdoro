"use client";

import { usePathname } from "next/navigation";
import { BackgroundPanel } from "@/components/background-panel";
import { SoundPanel } from "@/components/sound-panel";
import { QuickActionsNav } from "@/components/quick-actions-nav";
import { Navigation } from "@/components/navigation";

export function NavigationHub() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center px-4 w-full justify-center pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto relative px-1">
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
