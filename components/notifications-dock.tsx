"use client";

import { useEffect, useRef, useState } from "react";
import { NotificationsMenu } from "@/components/notifications-menu";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function NotificationsDock() {
  const isNavFocusMode = useTimerStore((state) => state.isNavFocusMode);
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
        "fixed top-8 right-8 z-[100] flex flex-col items-center gap-4 transition-all",
        shouldShow
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-1 pointer-events-none"
      )}
    >
      <NotificationsMenu />
    </div>
  );
}
