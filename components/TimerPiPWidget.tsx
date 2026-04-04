"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTimerStore } from "@/lib/store";
import Image from "next/image";
import { Play, Pause, ExternalLink, GripHorizontal, MonitorPlay } from "lucide-react";
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

export function TimerPiPWidget() {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  
  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // PiP refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipWindowRef = useRef<PictureInPictureWindow | null>(null);
  const animationFrameRef = useRef<number>(0);

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

  // Draw timer on canvas for PiP
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = useTimerStore.getState();
    const currentTimeLeft = state.timeLeft;
    const currentMode = state.mode;
    const currentIsActive = state.isActive;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#18181b");
    gradient.addColorStop(1, "#09090b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mode color
    const modeColor = currentMode === "focus" ? "#10b981" : currentMode === "break" ? "#0ea5e9" : "#8b5cf6";
    
    // Glowing circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 10, 80, 0, Math.PI * 2);
    ctx.strokeStyle = modeColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Timer text
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatTime(currentTimeLeft), canvas.width / 2, canvas.height / 2 - 10);

    // Mode label
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = modeColor;
    ctx.fillText(modeLabels[currentMode].toUpperCase(), canvas.width / 2, canvas.height / 2 + 50);

    // Status indicator
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 + 80, 6, 0, Math.PI * 2);
    ctx.fillStyle = currentIsActive ? modeColor : "#71717a";
    ctx.fill();

    // Status text
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText(currentIsActive ? "Running" : "Paused", canvas.width / 2, canvas.height / 2 + 105);

    // Continue animation
    if (isPiPActive) {
      animationFrameRef.current = requestAnimationFrame(drawCanvas);
    }
  }, [isPiPActive]);

  // Start Picture-in-Picture
  const startPiP = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    if (!document.pictureInPictureEnabled) {
      alert("Picture-in-Picture is not supported in your browser. Try Chrome or Edge.");
      return;
    }

    // If already in PiP, exit it
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (e) {
        console.log("Error exiting PiP:", e);
      }
      return;
    }

    try {
      // Draw initial frame first
      drawCanvas();
      
      // Set up canvas stream
      const stream = canvas.captureStream(30);
      
      // Stop any existing stream
      if (video.srcObject) {
        const oldStream = video.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }
      
      video.srcObject = stream;
      video.muted = true;

      // Wait for video to be ready before playing
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 3000);
        
        const onCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          resolve();
        };
        
        // If already ready
        if (video.readyState >= 3) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        
        video.addEventListener("canplay", onCanPlay);
        video.load();
      });

      // Play the video
      await video.play();

      // Enter PiP mode
      pipWindowRef.current = await video.requestPictureInPicture();
      setIsPiPActive(true);

      // Handle PiP close
      const handleLeavePiP = () => {
        setIsPiPActive(false);
        cancelAnimationFrame(animationFrameRef.current);
        pipWindowRef.current = null;
        video.removeEventListener("leavepictureinpicture", handleLeavePiP);
      };
      video.addEventListener("leavepictureinpicture", handleLeavePiP);

    } catch (error) {
      console.error("Failed to start PiP:", error);
      setIsPiPActive(false);
    }
  }, [drawCanvas]);

  // Keep drawing while PiP is active
  useEffect(() => {
    if (isPiPActive) {
      drawCanvas();
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPiPActive, drawCanvas, timeLeft, mode, isActive]);

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
      {/* Hidden canvas and video for PiP */}
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={200} 
        className="hidden"
      />
      <video 
        ref={videoRef} 
        muted 
        playsInline
        className="hidden"
      />

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
                    {/* PiP button */}
                    <button
                      onClick={startPiP}
                      className={`p-1 transition-colors ${isPiPActive ? "text-emerald-400" : "text-zinc-500 hover:text-white"}`}
                      title="Float on top of all windows (Picture-in-Picture)"
                    >
                      <MonitorPlay className="w-4 h-4" />
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
