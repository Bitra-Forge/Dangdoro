"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FloatingFeedback() {
  const { user } = useAuth();
  const isFocusMode = useTimerStore((state) => state.isNavFocusMode);
  
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("General");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the popup if clicking outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close the popup if Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
        setIsOpen(false);
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

  // Hide the floating feedback button during active timer focus mode (unless the form is already open)
  if (isFocusMode && !isOpen) return null;

  return (
    <div ref={dropdownRef} className="relative z-50">
      {/* Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-8 right-4 sm:right-8 z-50 flex items-center justify-center w-11 h-11 rounded-2xl border transition-all duration-500 backdrop-blur-none sm:backdrop-blur-2xl cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          isOpen
            ? "bg-orange-500 border-orange-500 text-white shadow-[0_8px_32px_rgba(232,130,26,0.25)]"
            : "bg-zinc-950 sm:bg-zinc-950/30 border-white/[0.06] text-zinc-300 hover:bg-zinc-950/60 hover:border-white/15 hover:text-white"
        )}
        aria-label="Toggle feedback form"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-4 h-4" />
            </motion.div>
          ) : (
            <motion.div
              key="msg"
              initial={{ scale: 0, rotate: 45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -45 }}
              transition={{ duration: 0.2 }}
            >
              <MessageSquare className="w-4 h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Floating Feedback Form */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop (closes form when clicking outside) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Form Card */}
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
                mass: 0.8
              }}
              className="fixed top-22 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-[340px] sm:left-8 sm:translate-x-0 sm:w-[350px] sm:max-w-[calc(100vw-32px)] z-50 overflow-visible"
            >
              {/* Glassmorphic container */}
              <div className="relative bg-zinc-950 sm:bg-zinc-950/90 backdrop-blur-none sm:backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden p-6">
                
                {/* Accent border glow */}
                <div className="absolute -inset-px bg-gradient-to-r from-orange-500/10 to-transparent rounded-[2rem] pointer-events-none" />

                <div className="relative z-10">
                  {/* Form Header */}
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/25 shadow-inner shrink-0">
                      <MessageSquare className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="ubuntu-bold text-zinc-100 text-sm font-bold tracking-wide">Send Feedback</span>
                      <span className="ubuntu-regular text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">We'd love to hear from you</span>
                    </div>
                  </div>

                  {/* Form Body */}
                  <form onSubmit={handleSendFeedback} className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block text-left mb-2">Category</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["General", "Bug Report", "Feature Request", "Suggestion"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFeedbackCategory(cat)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer",
                              feedbackCategory === cat
                                ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/10"
                                : "bg-black/40 text-zinc-400 border-white/10 hover:text-white hover:border-white/20"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="floating-feedback-message" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block text-left mb-2">Your Message</label>
                      <textarea
                        id="floating-feedback-message"
                        rows={4}
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Write your feedback, bug description, or feature request here..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/25 transition-all resize-none font-sans"
                        required
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={sendingFeedback || !feedbackMessage.trim()}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg flex items-center gap-1.5 cursor-pointer",
                          feedbackMessage.trim()
                            ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/10 hover:shadow-orange-500/30"
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
    </div>
  );
}
