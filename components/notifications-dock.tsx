"use client";

import { useEffect, useRef, useState } from "react";
import { NotificationsMenu } from "@/components/notifications-menu";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { usePathname } from "next/navigation";

export function NotificationsDock() {
  const isNavFocusMode = useTimerStore((state) => state.isNavFocusMode);
  const pathname = usePathname();
  const isGroupPage = pathname?.startsWith("/groups");
  const [isVisible, setIsVisible] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShow = !isNavFocusMode || isVisible;

  useEffect(() => {
    if (!isNavFocusMode) {
      return;
    }

    const padding = 180;
    const hideDelayMs = 250;

    const clearHideTimeout = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };

    const scheduleHide = () => {
      if (hideTimeoutRef.current) return;
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        hideTimeoutRef.current = null;
      }, hideDelayMs);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = dockRef.current?.getBoundingClientRect();
      if (!rect) return;

      const isNearX = event.clientX >= rect.left - padding && event.clientX <= rect.right + padding;
      const isNearY = event.clientY >= rect.top - padding && event.clientY <= rect.bottom + padding;
      const isNear = isNearX && isNearY;

      if (isNear) {
        clearHideTimeout();
        setIsVisible(true);
      } else {
        scheduleHide();
      }
    };

    const hideOnEnable = requestAnimationFrame(() => {
      setIsVisible(false);
    });

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(hideOnEnable);
      clearHideTimeout();
    };
  }, [isNavFocusMode]);

  return (
    <div
      ref={dockRef}
      className={cn(
        "fixed top-8 right-8 z-[100] flex items-center gap-3 transition-all",
        shouldShow
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-1 pointer-events-none"
      )}
    >
      {!isGroupPage && (
        <a
          href="https://ko-fi.com/morales002"
          target="_blank"
          rel="noopener noreferrer"
          title="Support Dangdoro"
          className="p-2.5 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-rose-400 backdrop-blur-sm transition-all duration-300 cursor-pointer relative overflow-visible hover:bg-rose-500/10 group"
        >
          {/* Glass highlights */}
          <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/20 pointer-events-none group-hover:border-rose-500/30 transition-colors duration-300" />
          <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />

          <Heart className="w-4 h-4 transition-transform group-hover:scale-110 duration-300" />
        </a>
      )}
      <NotificationsMenu />
    </div>
  );
}
