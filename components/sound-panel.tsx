"use client";

import { useEffect, useRef } from "react";
import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  X, Bird, Coffee, Flame, Waves, Moon, Wind, CloudRain,
  Anchor, Radio, CloudLightning, Droplets, TrainFront, Activity, Play, Pause
} from "lucide-react";

const sounds = [
  { id: "Birds.mp3", name: "Birds", icon: Bird },
  { id: "Cafe.mp3", name: "Cafe", icon: Coffee },
  { id: "Campfire.mp3", name: "Fire", icon: Flame },
  { id: "Ocean.mp3", name: "Ocean", icon: Waves },
  { id: "summer-night.ogg", name: "Night", icon: Moon },
  { id: "Wind.mp3", name: "Wind", icon: Wind },
  { id: "rain.mp3", name: "Rain", icon: CloudRain },
  { id: "boat.ogg", name: "Boat", icon: Anchor },
  { id: "pink-noise.ogg", name: "Pink", icon: Radio },
  { id: "storm.ogg", name: "Storm", icon: CloudLightning },
  { id: "stream.ogg", name: "Stream", icon: Droplets },
  { id: "train.ogg", name: "Train", icon: TrainFront },
  { id: "white-noise.ogg", name: "White", icon: Activity },
];


export function SoundPanel() {
  const isOpen = useTimerStore((state) => state.isSoundPanelOpen);
  const setIsOpen = useTimerStore((state) => state.setIsSoundPanelOpen);
  const activeSounds = useTimerStore((state) => state.activeSounds);
  const lastActiveSounds = useTimerStore((state) => state.lastActiveSounds);
  const toggleSound = useTimerStore((state) => state.toggleSound);
  const setSoundVolume = useTimerStore((state) => state.setSoundVolume);
  const toggleAllSounds = useTimerStore((state) => state.toggleAllSounds);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-quick-action-trigger="true"]')) {
        return;
      }

      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const hasActiveSounds = Object.keys(activeSounds).length > 0;

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-full max-w-[450px] transition-all duration-500 transform origin-bottom z-50",
        isOpen
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-95 pointer-events-none translate-y-4"
      )}
    >
      <div className="bg-zinc-900/80 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl relative overflow-visible h-full flex flex-col">
        {/* Scrollable area - labels are now inside and will scroll away */}
        <div className="max-h-[340px] overflow-y-auto overflow-x-hidden px-12 -mx-12 pt-6 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="px-6">
            <div className="flex items-center justify-between mb-8">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 pointer-events-none select-none">
                Atmosphere Mixer
              </span>
              <div className="flex items-center gap-4">
                {(hasActiveSounds || lastActiveSounds) && (
                  <button
                    onClick={toggleAllSounds}
                    className={cn(
                      "transition-all cursor-pointer text-white",
                      hasActiveSounds 
                        ? "drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] opacity-100" 
                        : "opacity-20 hover:opacity-100 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    )}
                    title={hasActiveSounds ? "Stop all" : "Restore session"}
                  >
                    {hasActiveSounds ? (
                      <Pause className="w-3.5 h-3.5 fill-current border-none" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5 border-none" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-white/5 text-white/20 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-y-6 gap-x-2">
              {sounds.map((sound) => {
                const Icon = sound.icon;
                const isActive = activeSounds[sound.id] !== undefined;
                const currentVolume = isActive ? activeSounds[sound.id] : 0;

                return (
                  <div
                    key={sound.id}
                    onClick={() => toggleSound(sound.id)}
                    className="flex flex-col items-center group cursor-pointer relative py-2 select-none"
                  >
                    {/* Name Label Above */}
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest text-center transition-all duration-300 mb-3",
                      isActive ? "text-white opacity-100" : "text-zinc-500 opacity-60 group-hover:opacity-100"
                    )}>
                      {sound.name}
                    </span>

                    {/* Icon in Middle */}
                    <div
                      className={cn(
                        "transition-all duration-700 ease-out flex items-center justify-center mb-4 relative",
                        isActive
                          ? "text-white scale-110"
                          : "text-zinc-500 group-hover:text-zinc-300"
                      )}
                    >
                      {/* Radial Light Effect - Even bigger and more immersive */}
                      {isActive && (
                        <div className="absolute inset-[-80%] rounded-full bg-white/[0.1] blur-3xl animate-pulse pointer-events-none" />
                      )}

                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 relative",
                          isActive
                            ? "bg-white/20 shadow-[0_0_25px_rgba(255,255,255,0.2)] border border-white/40"
                            : "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10"
                        )}
                      >
                        <Icon className={cn(
                          "w-6 h-6 relative z-10 transition-all duration-500",
                          isActive && "drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                        )} />
                      </div>
                    </div>

                    {/* Slider below - Sized for balance */}
                    <div
                      className={cn(
                        "w-[55%] h-[3px] rounded-full transition-all duration-500 mt-3",
                        isActive ? "bg-white/10 opacity-100" : "bg-white/5 opacity-0 pointer-events-none"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isActive && (
                        <div className="w-full h-full relative cursor-pointer group/slider">
                          {/* Visual fill */}
                          <div
                            className="absolute left-0 top-0 h-full bg-white transition-all duration-300 shadow-[0_0_10px_white] rounded-full"
                            style={{ width: `${currentVolume}%` }}
                          >
                            {/* Hover Dot */}
                            <div
                              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_white] opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300 pointer-events-none"
                            />
                          </div>
                          {/* Invisible range input for interaction */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={currentVolume}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSoundVolume(sound.id, parseInt(e.target.value));
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
