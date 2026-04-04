"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTimerStore } from "@/lib/store";
import Image from "next/image";
import { Play, Pause, GripHorizontal, Tv2 } from "lucide-react";
import Link from "next/link";

const modeLabels = {
  focus: "Focus",
  break: "Break",
  "long-break": "Long Break",
};

const modeColors = {
  focus: "from-emerald-500/20 to-emerald-500/5",
  break: "from-sky-500/20 to-sky-500/5",
  "long-break": "from-violet-500/20 to-violet-500/5",
};

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Check if Document PiP is supported
const isDocumentPiPSupported = () => {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
};

export function TimerPiPWidget() {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  
  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const timeLeft = useTimerStore((state) => state.timeLeft);
  const isActive = useTimerStore((state) => state.isActive);
  const mode = useTimerStore((state) => state.mode);
  const backgroundImage = useTimerStore((state) => state.backgroundImage);
  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);
  const start = useTimerStore((state) => state.start);
  const pause = useTimerStore((state) => state.pause);

  // Initialize position
  useEffect(() => {
    if (position === null && typeof window !== "undefined") {
      setPosition({
        x: window.innerWidth - 280,
        y: window.innerHeight - 220
      });
    }
  }, [position]);

  const isOnTimerPage = pathname === "/" || pathname === "/pip";
  const shouldShow = !isOnTimerPage && isActive && !isDismissed;

  useEffect(() => {
    if (isOnTimerPage && isDismissed) {
      setIsDismissed(false);
    }
  }, [isOnTimerPage, isDismissed]);

  // Start Document Picture-in-Picture
  const startDocumentPiP = useCallback(async () => {
    if (!isDocumentPiPSupported()) {
      alert("Document Picture-in-Picture is not supported in your browser. Please use Chrome 116+ or Edge.");
      return;
    }

    // Close existing PiP
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
      setIsPiPActive(false);
      return;
    }

    try {
      // @ts-ignore - documentPictureInPicture is not in types yet
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 300,
        height: 220,
      });

      pipWindowRef.current = pipWindow;
      setIsPiPActive(true);

      // Get current background image
      const currentBg = useTimerStore.getState().backgroundImage;
      const bgUrl = `${window.location.origin}/Backgrounds/${currentBg}`;

      // Add styles that match the in-app widget exactly
      const pipStyles = document.createElement("style");
      pipStyles.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
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
        
        .pip-dot.focus { 
          background: #10b981; 
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
        }
        .pip-dot.break { 
          background: #0ea5e9; 
          box-shadow: 0 0 12px rgba(14, 165, 233, 0.6);
        }
        .pip-dot.long-break { 
          background: #8b5cf6; 
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
        }
        
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
        .pip-status.paused { 
          color: #71717a;
        }
        
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
        
        .pip-btn:active {
          transform: scale(0.95);
        }
        
        .pip-btn svg {
          width: 22px;
          height: 22px;
          color: white;
        }
        
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
      pipWindow.document.head.appendChild(pipStyles);

      // Create widget content
      const updatePiPContent = () => {
        const state = useTimerStore.getState();
        const currentTimeLeft = state.timeLeft;
        const currentMode = state.mode;
        const currentIsActive = state.isActive;
        const currentBgImage = state.backgroundImage;
        
        const initialTime = currentMode === "focus" 
          ? state.initialFocusTime 
          : currentMode === "break" 
            ? state.initialBreakTime 
            : state.initialLongBreakTime;
        
        const progress = (currentTimeLeft / initialTime) * 100;
        const bgImageUrl = `${window.location.origin}/Backgrounds/${currentBgImage}`;

        pipWindow.document.body.innerHTML = `
          <div class="pip-container">
            <div class="pip-bg">
              <img src="${bgImageUrl}" alt="" />
              <div class="pip-bg-overlay"></div>
            </div>
            <div class="pip-widget">
              <div class="pip-header">
                <div class="pip-mode">
                  <div class="pip-dot ${currentMode}"></div>
                  <span class="pip-mode-label ${currentMode}">${modeLabels[currentMode]}</span>
                </div>
                <span class="pip-status ${currentIsActive ? 'active' : 'paused'}">${currentIsActive ? 'Running' : 'Paused'}</span>
              </div>
              <div class="pip-timer">
                <span class="pip-time">${formatTime(currentTimeLeft)}</span>
              </div>
              <div class="pip-controls">
                <button class="pip-btn" id="pip-toggle">
                  ${currentIsActive 
                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>'
                    : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
                  }
                </button>
              </div>
              <div class="pip-progress">
                <div class="pip-progress-bar ${currentMode}" style="width: ${progress}%"></div>
              </div>
            </div>
          </div>
        `;

        // Add click handler for play/pause
        const toggleBtn = pipWindow.document.getElementById("pip-toggle");
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            const s = useTimerStore.getState();
            if (s.isActive) {
              s.pause();
            } else {
              s.start();
            }
          };
        }
      };

      // Initial render
      updatePiPContent();

      // Update every 200ms
      pipIntervalRef.current = setInterval(updatePiPContent, 200);

      // Handle window close
      pipWindow.addEventListener("pagehide", () => {
        setIsPiPActive(false);
        if (pipIntervalRef.current) {
          clearInterval(pipIntervalRef.current);
        }
        pipWindowRef.current = null;
      });

    } catch (error) {
      console.error("Failed to start Document PiP:", error);
      setIsPiPActive(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipIntervalRef.current) {
        clearInterval(pipIntervalRef.current);
      }
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!widgetRef.current) return;
    
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    if (!widgetRef.current) return;
    
    const touch = e.touches[0];
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 260, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 180, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const newX = Math.max(0, Math.min(window.innerWidth - 260, touch.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 180, touch.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
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

  const initialTime = mode === "focus" 
    ? initialFocusTime 
    : mode === "break" 
      ? initialBreakTime 
      : initialLongBreakTime;

  const progress = (timeLeft / initialTime) * 100;

  return (
    <>
      {/* Floating widget within the app */}
      {shouldShow && position && (
        <div 
          ref={widgetRef}
          className={`fixed z-[9999] select-none ${!isDragging ? "animate-in slide-in-from-bottom-4 fade-in duration-300" : ""}`}
          style={{ 
            left: position.x,
            top: position.y,
            cursor: isDragging ? "grabbing" : "default",
            transition: isDragging ? "none" : "opacity 0.3s",
            transform: "translateZ(0)",
            willChange: isDragging ? "left, top" : "auto"
          }}
        >
          <div className="relative group">
            <div className={`absolute -inset-1 bg-gradient-to-r ${modeColors[mode]} rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none`} />
            
            <div className="relative w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-black/50">
              <div className="absolute inset-0 z-0 pointer-events-none">
                <Image
                  src={`/Backgrounds/${backgroundImage}`}
                  alt="Background"
                  fill
                  sizes="256px"
                  className="object-cover opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
              </div>

              <div className="relative z-10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div 
                    className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none touch-none"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                  >
                    <GripHorizontal className="w-4 h-4 text-zinc-500" />
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      mode === "focus" ? "bg-emerald-500" : 
                      mode === "break" ? "bg-sky-500" : "bg-violet-500"
                    }`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      mode === "focus" ? "text-emerald-400" : 
                      mode === "break" ? "text-sky-400" : "text-violet-400"
                    }`}>
                      {modeLabels[mode]}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {/* Document PiP button */}
                    <button
                      onClick={startDocumentPiP}
                      className={`p-1 transition-colors ${isPiPActive ? "text-emerald-400" : "text-zinc-500 hover:text-white"}`}
                      title="Pop out timer (floats everywhere)"
                    >
                      <Tv2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsDismissed(true)}
                      className="text-zinc-500 hover:text-white text-lg leading-none transition-colors px-1"
                      title="Dismiss"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                <Link href="/" className="block text-center mb-3 hover:scale-105 transition-transform">
                  <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
                    {formatTime(timeLeft)}
                  </span>
                </Link>

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

              <div className="h-1 bg-zinc-800">
                <div
                  className={`h-full transition-all duration-1000 ${
                    mode === "focus" ? "bg-emerald-500" : 
                    mode === "break" ? "bg-sky-500" : "bg-violet-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
