"use client";

import { useEffect, useRef, useState } from "react";
import { NotificationsMenu } from "@/components/notifications-menu";
import { useTimerStore } from "@/lib/store";
import { useDockPopoverStore } from "@/lib/dock-popover-store";
import { cn } from "@/lib/utils";
import { Heart, Send, X, ScrollText } from "lucide-react";
import { PatchNotesModal } from "@/components/patch-notes-modal";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import Image from "next/image";
import feedbackImg from "@/components/ui/feedback.png";
import { Tooltip } from "@/components/ui/tooltip";

export function NotificationsDock() {
  const { user } = useAuth();
  const isNavFocusMode = useTimerStore((state) => state.isNavFocusMode);
  const activeGroupId = useTimerStore((state) => state.activeGroupId);
  const isGroupActive = !!activeGroupId;
  const pathname = usePathname();
  const isGroupPage = pathname?.startsWith("/groups");
  const isAdminPage = pathname?.startsWith("/admin");
  const [isVisible, setIsVisible] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShow = !isNavFocusMode || isVisible;

  // Feedback popup state
  const isFeedbackOpen = useDockPopoverStore((s) => s.active === "feedback");
  const toggleFeedback = useDockPopoverStore((s) => s.toggle);
  const closeFeedback = useDockPopoverStore((s) => s.close);
  const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("General");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Close the popup if clicking outside of the dock/form area
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isClickInsideDock = dockRef.current?.contains(e.target as Node);
      const isClickInsideFeedback = feedbackRef.current?.contains(e.target as Node);
      if (!isClickInsideDock && !isClickInsideFeedback) {
        closeFeedback("feedback");
      }
    };
    if (isFeedbackOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFeedbackOpen, closeFeedback]);

  // Close the popup if Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeFeedback("feedback");
      }
    };
    if (isFeedbackOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFeedbackOpen, closeFeedback]);

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    setSendingFeedback(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (user) {
        const token = await user.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: feedbackMessage,
          category: feedbackCategory,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Feedback sent! Thank you.");
        setFeedbackMessage("");
        closeFeedback("feedback");
      } else {
        toast.error(data.error || "Failed to send feedback.");
      }
    } catch (error) {
      console.error("Error sending feedback:", error);
      toast.error("An error occurred while sending feedback.");
    } finally {
      setSendingFeedback(false);
    }
  };

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

  if (isAdminPage) return null;

  return (
    <>
      <div
        ref={dockRef}
        className={cn(
          "fixed top-4 sm:top-8 right-4 sm:right-8 z-[100] flex items-center gap-3 transition-all",
          shouldShow || isFeedbackOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none"
        )}
      >
        {!isGroupPage && (
          <Tooltip content="Support Dangdoro" side="bottom">
            <a
              href="https://ko-fi.com/morales002"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "items-center justify-center p-2.5 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-rose-400 backdrop-blur-sm transition-all duration-300 cursor-pointer relative overflow-visible hover:bg-rose-500/10 group",
                isGroupActive ? "hidden md:inline-flex" : "inline-flex"
              )}
            >
              {/* Glass highlights */}
              <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/20 pointer-events-none group-hover:border-rose-500/30 transition-colors duration-300" />
              <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />

              <Heart className="w-4 h-4 transition-transform group-hover:scale-110 duration-300" />
            </a>
          </Tooltip>
        )}

        {!isGroupPage && (
          /* Patch notes button */
          <Tooltip content="What's New" side="bottom">
            <button
              onClick={() => setIsPatchNotesOpen(true)}
              className={cn(
                "items-center justify-center p-2.5 rounded-full bg-zinc-900/80 backdrop-blur-sm transition-all duration-300 cursor-pointer relative overflow-visible group text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                isGroupActive ? "hidden md:inline-flex" : "inline-flex"
              )}
            >
              <div className="absolute inset-0 rounded-full border-t-[0.5px] border-white/20 pointer-events-none group-hover:border-white/30 transition-colors duration-300" />
              <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />
              <ScrollText className="w-4 h-4 transition-transform group-hover:scale-110 duration-300 relative z-10" />
            </button>
          </Tooltip>
        )}

        {!isGroupPage && (
          /* Floating Feedback Trigger Button */
          <Tooltip content="Send Feedback" side="bottom">
            <button
              onClick={() => toggleFeedback("feedback")}
              className={cn(
                "items-center justify-center p-2.5 rounded-full bg-zinc-900/80 backdrop-blur-sm transition-all duration-300 cursor-pointer relative overflow-visible group",
                isFeedbackOpen
                  ? "bg-white/15 text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                isGroupActive ? "hidden md:inline-flex" : "inline-flex"
              )}
            >
              {/* Glass highlights */}
              <div className={cn(
                "absolute inset-0 rounded-full border-t-[0.5px] pointer-events-none transition-colors duration-300",
                isFeedbackOpen ? "border-white/40" : "border-white/20 group-hover:border-white/30"
              )} />
              <div className="absolute inset-0 rounded-full border-b-[0.5px] border-white/10 pointer-events-none" />

              <Image
                src={feedbackImg}
                alt="Feedback"
                width={16}
                height={16}
                className={cn(
                  "w-4 h-4 object-contain transition-all duration-300 filter group-hover:scale-110 relative z-10",
                  isFeedbackOpen ? "invert" : "invert opacity-60 group-hover:opacity-100"
                )}
              />
            </button>
          </Tooltip>
        )}

        <NotificationsMenu />
      </div>

      {/* Floating Feedback Popover Form */}
      <AnimatePresence>
        {isFeedbackOpen && (
          <>
            {/* Form Card */}
            <motion.div
              ref={feedbackRef}
              initial={{ opacity: 0, y: -12, scale: 0.95, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, scale: 0.96, filter: "blur(2px)" }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
                max: 0.8
              }}
              className="fixed bottom-0 left-0 right-0 w-full z-[100] sm:fixed sm:bottom-auto sm:left-auto sm:top-[88px] sm:right-8 sm:w-96 overflow-visible"
            >
              {/* Glassmorphic container */}
              <div className="relative bg-zinc-950 border-t border-white/[0.08] rounded-t-3xl sm:border sm:rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">

                {/* Accent border glow */}
                <div className="absolute -inset-px bg-gradient-to-r from-white/10 to-transparent rounded-t-3xl sm:rounded-[2rem] pointer-events-none" />

                <div className="relative z-10">
                  {/* Form Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center border border-white/15 shadow-inner shrink-0">
                        <Image
                          src={feedbackImg}
                          alt="Feedback"
                          width={16}
                          height={16}
                          className="w-4 h-4 object-contain filter invert"
                        />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="ubuntu-bold text-zinc-100 text-sm font-bold tracking-wide">Send Feedback</span>
                        <span className="ubuntu-regular text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">We'd love to hear from you</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => closeFeedback("feedback")} className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors sm:hidden">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form Body */}
                  <form onSubmit={handleSendFeedback} className="space-y-4">
                    <div>
                      <span className="ubuntu-bold text-[10px] font-bold uppercase tracking-wider text-zinc-400 block text-left mb-2">What's this about?</span>
                      <div className="flex flex-row flex-nowrap overflow-x-auto custom-scrollbar gap-1.5 pb-1">
                        {["General", "Bug Report", "Feature Request", "Suggestion"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFeedbackCategory(cat)}
                            className={cn(
                              "ubuntu-bold px-3.5 py-2 rounded-lg text-[11px] font-extrabold transition-all border cursor-pointer shrink-0",
                              feedbackCategory === cat
                                ? "bg-white text-black border-white shadow-md shadow-white/5"
                                : "bg-black/40 text-zinc-400 border-white/10 hover:text-white hover:border-white/20"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="floating-feedback-message" className="ubuntu-bold text-[10px] font-bold uppercase tracking-wider text-zinc-400 block text-left mb-2">Your Message</label>
                      <textarea
                        id="floating-feedback-message"
                        rows={4}
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Write your feedback, bug description, or feature request here..."
                        className="ubuntu-regular w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all resize-none"
                        required
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={sendingFeedback || !feedbackMessage.trim()}
                        className={cn(
                          "ubuntu-bold px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg flex items-center gap-1.5 cursor-pointer",
                          feedbackMessage.trim()
                            ? "bg-white hover:bg-zinc-200 text-black shadow-md shadow-white/5"
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        )}
                      >
                        <Send className="w-3 h-3" />
                        {sendingFeedback ? "Sending..." : "Submit"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPatchNotesOpen && (
          <PatchNotesModal
            isOpen={isPatchNotesOpen}
            onClose={() => setIsPatchNotesOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
