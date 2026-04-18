"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTimerStore } from "@/lib/store";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { onSnapshot, doc, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Play, Pause, GripHorizontal, X, Flame, Users as UsersIcon } from "lucide-react";
import Link from "next/link";

// ============================================================================
// Constants
// ============================================================================

const MODE_LABELS: Record<string, string> = {
  focus: "Focus",
  break: "Break",
  "long-break": "Long Break",
};

const MODE_COLORS: Record<string, { gradient: string; bg: string; text: string }> = {
  focus: {
    gradient: "from-emerald-500/20 to-emerald-500/5",
    bg: "bg-emerald-500",
    text: "text-emerald-400",
  },
  break: {
    gradient: "from-sky-500/20 to-sky-500/5",
    bg: "bg-sky-500",
    text: "text-sky-400",
  },
  "long-break": {
    gradient: "from-violet-500/20 to-violet-500/5",
    bg: "bg-violet-500",
    text: "text-violet-400",
  },
};

// ============================================================================
// Utilities
// ============================================================================

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return hrs > 0 
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` 
    : `${pad(mins)}:${pad(secs)}`;
};

const isDocumentPiPSupported = (): boolean => {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
};

// ============================================================================
// PiP Styles Generator (for Document PiP - Chrome/Edge only)
// ============================================================================

const generatePiPStyles = (): string => `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: #09090b;
    overflow: hidden;
    height: 100vh;
    cursor: move;
    -webkit-app-region: drag;
  }
  
  .pip-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  
  .pip-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  
  .pip-bg img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.4;
  }
  
  .pip-bg-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, 
      rgba(9, 9, 11, 0.5) 0%, 
      rgba(9, 9, 11, 0.3) 50%, 
      rgba(9, 9, 11, 0.7) 100%
    );
  }
  
  .pip-widget {
    position: relative;
    z-index: 10;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
  }
  
  .pip-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .pip-mode {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .pip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }
  
  .pip-dot.focus { background: #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); }
  .pip-dot.break { background: #0ea5e9; box-shadow: 0 0 12px rgba(14, 165, 233, 0.6); }
  .pip-dot.long-break { background: #8b5cf6; box-shadow: 0 0 12px rgba(139, 92, 246, 0.6); }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(0.9); }
  }
  
  .pip-mode-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }
  
  .pip-mode-label.focus { color: #10b981; }
  .pip-mode-label.break { color: #0ea5e9; }
  .pip-mode-label.long-break { color: #8b5cf6; }
  
  .pip-status {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .pip-status.active { 
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.2);
  }
  
  .pip-status.paused { color: #71717a; }
  
  .pip-timer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .pip-time {
    font-size: 52px;
    font-weight: 700;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  }
  
  .pip-controls {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    -webkit-app-region: no-drag;
  }
  
  .pip-btn {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .pip-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
  }
  
  .pip-btn:active { transform: scale(0.95); }
  .pip-btn svg { width: 22px; height: 22px; color: white; }
  
  .pip-progress {
    height: 4px;
    background: rgba(39, 39, 42, 0.6);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 8px;
  }
  
  .pip-progress-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s linear;
  }
  
  .pip-progress-bar.focus { background: linear-gradient(90deg, #10b981, #34d399); }
  .pip-progress-bar.break { background: linear-gradient(90deg, #0ea5e9, #38bdf8); }
  .pip-progress-bar.long-break { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
`;

// ============================================================================
// PiP Content Generator
// ============================================================================

const generatePiPContent = (
  timeLeft: number,
  mode: string,
  isActive: boolean,
  progress: number,
  bgImageUrl: string
): string => {
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';
  const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';

  return `
    <div class="pip-container">
      <div class="pip-bg">
        <img src="${bgImageUrl}" alt="" />
        <div class="pip-bg-overlay"></div>
      </div>
      <div class="pip-widget">
        <div class="pip-header">
          <div class="pip-mode">
            <div class="pip-dot ${mode}"></div>
            <span class="pip-mode-label ${mode}">${MODE_LABELS[mode]}</span>
          </div>
          <span class="pip-status ${isActive ? 'active' : 'paused'}">
            ${isActive ? 'Running' : 'Paused'}
          </span>
        </div>
        <div class="pip-timer">
          <span class="pip-time">${formatTime(timeLeft)}</span>
        </div>
        <div class="pip-controls">
          <button class="pip-btn" id="pip-toggle">
            ${isActive ? pauseIcon : playIcon}
          </button>
        </div>
        <div class="pip-progress">
          <div class="pip-progress-bar ${mode}" style="width: ${progress}%"></div>
        </div>
      </div>
    </div>
  `;
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useDraggable(widgetRef: React.RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Initialize position
  useEffect(() => {
    if (position === null && typeof window !== "undefined") {
      setPosition({
        x: window.innerWidth - 280,
        y: window.innerHeight - 220,
      });
    }
  }, [position]);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!widgetRef.current) return;
    
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    setIsDragging(true);
  }, [widgetRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 260, clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 180, clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleEnd = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  return { position, isDragging, handleMouseDown, handleTouchStart };
}

// ============================================================================
// Document PiP Hook (Chrome/Edge only)
// ============================================================================

function useDocumentPiP() {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const pipIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isOpen = useCallback(() => {
    return pipWindowRef.current && !pipWindowRef.current.closed;
  }, []);

  const closePiP = useCallback(() => {
    if (pipIntervalRef.current) {
      clearInterval(pipIntervalRef.current);
      pipIntervalRef.current = null;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setIsPiPActive(false);
  }, []);

  const openPiP = useCallback(async (options?: { skipIfOpen?: boolean }) => {
    if (!isDocumentPiPSupported()) {
      return;
    }

    // Skip if already open and skipIfOpen is true
    if (options?.skipIfOpen && isOpen()) {
      return;
    }

    // Toggle off if already open (when called without skipIfOpen)
    if (!options?.skipIfOpen && isOpen()) {
      closePiP();
      return;
    }

    try {
      // @ts-ignore - documentPictureInPicture API not in types yet
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 300,
        height: 220,
      });

      pipWindowRef.current = pipWindow;
      setIsPiPActive(true);

      // Add styles
      const styleEl = document.createElement("style");
      styleEl.textContent = generatePiPStyles();
      pipWindow.document.head.appendChild(styleEl);

      // Update content function
      const updateContent = () => {
        const state = useTimerStore.getState();
        const { timeLeft, mode, isActive, initialFocusTime, initialBreakTime, initialLongBreakTime, backgroundImage } = state;
        
        const initialTime = mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime;
        const progress = (timeLeft / initialTime) * 100;
        const bgImageUrl = `${window.location.origin}/Backgrounds/${backgroundImage}`;

        pipWindow.document.body.innerHTML = generatePiPContent(timeLeft, mode, isActive, progress, bgImageUrl);

        // Attach click handler
        const toggleBtn = pipWindow.document.getElementById("pip-toggle");
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            const s = useTimerStore.getState();
            s.isActive ? s.pause() : s.start();
          };
        }
      };

      // Initial render and start interval
      updateContent();
      pipIntervalRef.current = setInterval(updateContent, 200);

      // Handle close
      pipWindow.addEventListener("pagehide", closePiP);

    } catch (error) {
      console.error("Failed to open Document PiP:", error);
      setIsPiPActive(false);
    }
  }, [closePiP, isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => closePiP();
  }, [closePiP]);

  return { isPiPActive, openPiP, closePiP, isOpen };
}

// ============================================================================
// Main Component
// ============================================================================

export function TimerPiPWidget() {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Store selectors
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const isActive = useTimerStore((s) => s.isActive);
  const mode = useTimerStore((s) => s.mode);
  const backgroundImage = useTimerStore((s) => s.backgroundImage);
  const initialFocusTime = useTimerStore((s) => s.initialFocusTime);
  const initialBreakTime = useTimerStore((s) => s.initialBreakTime);
  const initialLongBreakTime = useTimerStore((s) => s.initialLongBreakTime);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const activeGroupId = useTimerStore((s) => s.activeGroupId);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any>(null);

  // Sync group data if active
  useEffect(() => {
    if (!activeGroupId) {
      setGroupData(null);
      setActiveMembers([]);
      return;
    }

    const unsubGroup = onSnapshot(doc(db, "focusGroups", activeGroupId), (snap) => {
      if (snap.exists()) setGroupData(snap.data());
    });

    const unsubLive = onSnapshot(
      query(collection(db, "liveSessions"), where("groupId", "==", activeGroupId)),
      (snap) => {
        setActiveMembers(snap.docs.map(d => d.data()));
      }
    );

    return () => {
      unsubGroup();
      unsubLive();
    };
  }, [activeGroupId]);

  const synergy = activeMembers.length > 0 ? Math.min(100, activeMembers.length * 25) : 0;
  const synergyColor = synergy > 70 ? "text-[#E8821A]" : synergy > 30 ? "text-amber-400" : "text-sky-400";

  // Hooks
  const { position, isDragging, handleMouseDown, handleTouchStart } = useDraggable(widgetRef);
  const { openPiP, closePiP } = useDocumentPiP();

  // Check if Document PiP is supported (Chrome/Edge only)
  const supportsDocumentPiP = isDocumentPiPSupported();

  // Derived state
  const isOnTimerPage = pathname === "/" || pathname === "/pip";
  const modeStyle = MODE_COLORS[mode];
  const initialTime = mode === "focus" ? initialFocusTime : mode === "break" ? initialBreakTime : initialLongBreakTime;
  const progress = (timeLeft / initialTime) * 100;
  
  // Show widget if: not on timer page, timer is running OR paused mid-session, not dismissed
  const hasActiveTimer = isActive || timeLeft < initialTime;
  const shouldShow = !isOnTimerPage && hasActiveTimer && !isDismissed;

  // Auto-open/close Document PiP based on tab visibility (Chrome/Edge only)
  // - Open PiP when user leaves the app tab
  // - Close PiP when user returns to the app tab
  useEffect(() => {
    if (!supportsDocumentPiP) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the app tab - open PiP if timer is active
        const state = useTimerStore.getState();
        const currentInitialTime = state.mode === "focus" 
          ? state.initialFocusTime 
          : state.mode === "break" 
            ? state.initialBreakTime 
            : state.initialLongBreakTime;
        const hasTimer = state.isActive || state.timeLeft < currentInitialTime;
        
        if (hasTimer) {
          openPiP({ skipIfOpen: true });
        }
      } else {
        // User returned to the app tab - close PiP
        closePiP();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [supportsDocumentPiP, openPiP, closePiP]);

  // Reset dismissed when returning to timer page
  useEffect(() => {
    if (isOnTimerPage && isDismissed) {
      setIsDismissed(false);
    }
  }, [isOnTimerPage, isDismissed]);

  if (!shouldShow || !position) return null;

  return (
    <div
      ref={widgetRef}
      className={`fixed z-[9999] select-none ${!isDragging ? "animate-in slide-in-from-bottom-4 fade-in duration-300" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? "grabbing" : "default",
        transition: isDragging ? "none" : "opacity 0.3s",
        transform: "translateZ(0)",
        willChange: isDragging ? "left, top" : "auto",
      }}
    >
      <div className="relative group">
        {/* Glow effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r ${modeStyle.gradient} rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none`} />

        {/* Widget card */}
        <div className="relative w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-black/50">
          {/* Background image */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <Image
              src={`/Backgrounds/${backgroundImage}`}
              alt=""
              fill
              sizes="256px"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              {/* Drag handle + Mode indicator */}
              <div
                className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none touch-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                <GripHorizontal className="w-4 h-4 text-zinc-500" />
                <div className={`w-2 h-2 rounded-full animate-pulse ${modeStyle.bg}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${modeStyle.text}`}>
                  {MODE_LABELS[mode]}
                </span>
                {groupData && (
                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-white/10">
                    <Flame className={cn("w-3 h-3", synergyColor)} />
                    <span className={cn("text-[9px] font-black", synergyColor)}>{synergy}%</span>
                  </div>
                )}
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1 text-zinc-500 hover:text-white transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Timer display */}
            <Link href="/" className="block text-center mb-3 hover:scale-105 transition-transform">
              <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
                {formatTime(timeLeft)}
              </span>
            </Link>

            {/* Group Presence Row */}
            {activeMembers.length > 0 && (
              <div className="flex items-center justify-center gap-1 mb-4">
                <div className="flex -space-x-1.5">
                  {activeMembers.slice(0, 4).map((m, i) => (
                    <div key={i} className="relative">
                      <div className="w-5 h-5 rounded-full border border-zinc-950 overflow-hidden bg-zinc-800">
                        {m.userPhoto ? (
                          <img src={m.userPhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-zinc-500">
                            {m.userName?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full border border-zinc-950" />
                    </div>
                  ))}
                  {activeMembers.length > 4 && (
                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-950 flex items-center justify-center text-[7px] font-bold text-zinc-500">
                      +{activeMembers.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  {activeMembers.length} Live
                </span>
              </div>
            )}

            {/* Play/Pause button */}
            <div className="flex justify-center">
              <button
                onClick={() => (isActive ? pause() : start())}
                className={`p-3 rounded-xl border transition-all duration-200 transform active:scale-95 ${
                  isActive
                    ? "bg-white/10 border-white/20 hover:bg-white/20"
                    : "bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30"
                }`}
              >
                {isActive ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-emerald-400" />
                )}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-zinc-800">
            <div
              className={`h-full transition-all duration-1000 ${modeStyle.bg}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
