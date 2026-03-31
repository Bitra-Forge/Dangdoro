"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Droplets, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function TimerCard() {
  const { 
    timeLeft, 
    isActive, 
    mode, 
    start, 
    pause, 
    reset, 
    tick,
    setMode,
    setInitialTime
  } = useTimerStore();

  const initialFocusTime = useTimerStore((state) => state.initialFocusTime);
  const initialBreakTime = useTimerStore((state) => state.initialBreakTime);
  const initialLongBreakTime = useTimerStore((state) => state.initialLongBreakTime);

  const [isEditing, setIsEditing] = useState(false);
  
  // Local state for editing as strings to avoid cursor jumping and auto-padding issues
  const [editHours, setEditHours] = useState("");
  const [editMins, setEditMins] = useState("");
  const [editSecs, setEditSecs] = useState("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive) {
      timer = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isActive, tick]);

  // Sound Notification Effect
  useEffect(() => {
    if (timeLeft === 0 && !isActive) {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.volume = 0.4;
      audio.play().catch(err => console.log("Audio blocked:", err));
    }
  }, [timeLeft, isActive]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startEditing = () => {
    pause(); // Automatically pause when entering edit mode
    const hrs = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);
    const secs = timeLeft % 60;
    setEditHours(hrs.toString().padStart(2, "0"));
    setEditMins(mins.toString().padStart(2, "0"));
    setEditSecs(secs.toString().padStart(2, "0"));
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    const h = parseInt(editHours) || 0;
    const m = parseInt(editMins) || 0;
    const s = parseInt(editSecs) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;
    
    if (totalSeconds >= 0) {
      setInitialTime(mode, totalSeconds);
    }
    setIsEditing(false);
  };

  const adjustValue = (type: "h" | "m" | "s", delta: number) => {
    if (type === "h") setEditHours(prev => {
        const val = Math.max(0, Math.min(99, (parseInt(prev) || 0) + delta));
        return val.toString().padStart(2, "0");
    });
    if (type === "m") setEditMins(prev => {
        const val = Math.max(0, Math.min(59, (parseInt(prev) || 0) + delta));
        return val.toString().padStart(2, "0");
    });
    if (type === "s") setEditSecs(prev => {
        const val = Math.max(0, Math.min(59, (parseInt(prev) || 0) + delta));
        return val.toString().padStart(2, "0");
    });
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in transition-all duration-1000 relative z-10">
      {/* Mode Switcher (The 3 Choices) */}
      <div className="flex p-1.5 rounded-2xl bg-primary/5 border border-primary/10 backdrop-blur-md relative z-20">
        {[
          { id: "focus", label: "Focus" },
          { id: "break", label: "Break" },
          { id: "long-break", label: "Extended" }
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={cn(
              "px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all duration-500 cursor-pointer",
              mode === m.id 
                ? "bg-white text-primary shadow-lg ring-1 ring-primary/5" 
                : "text-primary/40 hover:text-primary/70 hover:bg-primary/5"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main Timer Display */}
      <div className="relative group perspective-1000">
         <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150 opacity-40 transition-opacity duration-1000" />
         
         <div className={cn(
            "bg-card/40 backdrop-blur-3xl border border-white/20 shadow-2xl rounded-[4rem] p-16 md:p-24 flex flex-col items-center justify-center min-w-[320px] md:min-w-[540px] transition-all duration-700",
            isEditing && "ring-2 ring-primary/20 bg-card/60"
         )}>
            
            {isEditing ? (
                <div className="flex flex-col items-center gap-8">
                  <div className="flex items-center gap-4 text-primary font-noto-serif">
                    {/* Hours */}
                    <div className="flex flex-col items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => adjustValue("h", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                        <input
                            type="text"
                            value={editHours}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                                setEditHours(val);
                            }}
                            className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-20 md:w-32 text-center outline-none border-b-2 border-primary/10 focus:border-primary/40 transition-all font-noto-serif"
                        />
                        <Button variant="ghost" size="icon" onClick={() => adjustValue("h", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                    </div>
                    <span className="text-6xl md:text-8xl font-bold mb-8 opacity-20">:</span>
                    {/* Minutes */}
                    <div className="flex flex-col items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => adjustValue("m", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                        <input
                            type="text"
                            autoFocus
                            value={editMins}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                                setEditMins(val);
                            }}
                            className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-full max-w-[5rem] md:max-w-[8rem] text-center outline-none border-b-2 border-primary/10 focus:border-primary/40 transition-all font-noto-serif"
                        />
                        <Button variant="ghost" size="icon" onClick={() => adjustValue("m", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                    </div>
                    <span className="text-6xl md:text-8xl font-bold mb-8 opacity-20">:</span>
                    {/* Seconds */}
                    <div className="flex flex-col items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => adjustValue("s", 1)} className="hover:bg-primary/5"><ChevronUp /></Button>
                        <input
                            type="text"
                            value={editSecs}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                                setEditSecs(val);
                            }}
                            className="text-6xl md:text-8xl font-bold tracking-tighter bg-transparent w-full max-w-[5rem] md:max-w-[8rem] text-center outline-none border-b-2 border-primary/10 focus:border-primary/40 transition-all font-noto-serif"
                        />
                        <Button variant="ghost" size="icon" onClick={() => adjustValue("s", -1)} className="hover:bg-primary/5"><ChevronDown /></Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button onClick={handleEditSubmit} className="rounded-full px-8 py-6 h-auto text-lg font-bold">
                      <Check className="mr-2" /> Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-full px-8 py-6 h-auto text-lg font-bold">
                      <X className="mr-2" /> Cancel
                    </Button>
                  </div>
                </div>
            ) : (
              <>
                <h1 
                    onClick={startEditing}
                    title="Click to edit"
                    className={cn(
                        "text-[9rem] md:text-[13rem] font-bold tracking-tighter leading-none select-none drop-shadow-sm cursor-pointer",
                        "bg-gradient-to-b from-primary/95 to-primary/60 bg-clip-text text-transparent",
                        "font-noto-serif transition-opacity duration-500"
                    )}
                >
                    {formatTime(timeLeft)}
                </h1>

                <div className="flex items-center gap-6 mt-12">
                  <Button 
                    onClick={isActive ? pause : start}
                    className={cn(
                        "h-20 px-12 rounded-full text-xl font-bold transition-all duration-500 shadow-xl hover:shadow-primary/20",
                        isActive ? "bg-secondary text-foreground hover:bg-secondary/80" : "bg-primary text-white hover:bg-primary/90"
                    )}
                  >
                    {isActive ? <Pause className="mr-3 fill-current" /> : <Play className="mr-3 fill-current" />}
                    {isActive ? "Pause Session" : "Start Focus"}
                  </Button>

                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={reset}
                    className="h-20 w-20 rounded-full border-2 border-primary/10 bg-white/50 text-primary/60 hover:bg-primary/10 hover:text-primary transition-all duration-500"
                  >
                    <RotateCcw className="w-8 h-8" />
                  </Button>
                </div>

                {/* Bottom Status Pill */}
                <div className="mt-16 px-6 py-2 rounded-full bg-primary/5 border border-primary/10">
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary/40">
                        {mode === "focus" 
                          ? `${Math.floor(initialFocusTime / 60)} minutes of presence` 
                          : `${Math.floor((mode === "break" ? initialBreakTime : initialLongBreakTime) / 60)} minute pause`}
                    </p>
                </div>
              </>
            )}
         </div>
      </div>


      {/* Quote Section */}
      <div className="max-w-md text-center pt-8">
        <p className="italic text-lg text-muted-foreground font-noto-serif leading-relaxed opacity-60 hover:opacity-100 transition-opacity duration-700">
          "Quiet your mind, and the soul will speak."
        </p>
      </div>
    </div>
  );
}
