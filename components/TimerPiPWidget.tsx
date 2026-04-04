"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTimerStore } from "@/lib/store";
import Image from "next/image";
import { Play, Pause, ExternalLink, GripHorizontal } from "lucide-react";
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
  
  // Dragging state
  const [position, setPosition] = useState({ x: 24, y: 24 }); // bottom-right offset
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const timeLeft = useTimerStore((state) => state.timeLeft);
  const isActive = useTimerStore((state) => state.isActive);
  const mode = useTimerStore((state) => state.mode);
  const backgroundImage = useTimerStore((state) => state.backgroundImage);
  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);
  const start = useTimerStore((state) => state.start);
  const pause = useTimerStore((state) => state.pause);

  // Show widget when NOT on the home page or pip page and timer is active
  const isOnTimerPage = pathname === "/" || pathname === "/pip";
  const shouldShow = !isOnTimerPage && isActive && !isDismissed;

  // Reset dismissed state when returning to timer page
  useEffect(() => {
    if (isOnTimerPage && isDismissed) {
      setIsDismissed(false);
    }
  }, [isOnTimerPage, isDismissed]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      
      const deltaX = dragRef.current.startX - e.clientX;
      const deltaY = dragRef.current.startY - e.clientY;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 280, dragRef.current.initialX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 200, dragRef.current.initialY + deltaY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !dragRef.current) return;
      
      const touch = e.touches[0];
      const deltaX = dragRef.current.startX - touch.clientX;
      const deltaY = dragRef.current.startY - touch.clientY;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 280, dragRef.current.initialX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 200, dragRef.current.initialY + deltaY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  // Open popup window
  const openPopup = () => {
    const width = 300;
    const height = 400;
    const left = window.screenX + window.outerWidth - width - 50;
    const top = window.screenY + 50;
    
    window.open(
      "/pip",
      "dangdoro-pip",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`
    );
  };

  if (!shouldShow) return null;

  const initialTime = mode === "focus" 
    ? initialFocusTime 
    : mode === "break" 
      ? initialBreakTime 
      : initialLongBreakTime;

  const progress = (timeLeft / initialTime) * 100;

  return (
    <div 
      ref={widgetRef}
      className="fixed z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300"
      style={{ 
        right: `${position.x}px`, 
        bottom: `${position.y}px`,
        cursor: isDragging ? "grabbing" : "default"
      }}
    >
      {/* Floating PiP Widget */}
      <div className="relative group">
        {/* Glow effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r ${modeColors[mode]} rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity`} />
        
        <div className="relative w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-black/50">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <Image
              src={`/Backgrounds/${backgroundImage}`}
              alt="Background"
              fill
              sizes="256px"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-4">
            {/* Header with drag handle, mode, pop-out and dismiss */}
            <div className="flex items-center justify-between mb-3">
              {/* Drag handle */}
              <div 
                className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
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
                {/* Pop-out button */}
                <button
                  onClick={openPopup}
                  className="text-zinc-500 hover:text-white p-1 transition-colors"
                  title="Open in popup window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                {/* Dismiss button */}
                <button
                  onClick={() => setIsDismissed(true)}
                  className="text-zinc-500 hover:text-white text-lg leading-none transition-colors px-1"
                  title="Dismiss"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Timer Display - Clickable to go back to timer */}
            <Link href="/" className="block text-center mb-3 hover:scale-105 transition-transform">
              <span className="text-4xl font-bold text-white tabular-nums tracking-tight">
                {formatTime(timeLeft)}
              </span>
            </Link>

            {/* Play/Pause Button */}
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

          {/* Progress bar at bottom */}
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
  );
}
