"use client";

import { useTimerStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { 
  X, Bird, Coffee, Flame, Waves, Moon, Wind, CloudRain, 
  Anchor, Radio, CloudLightning, Droplets, TrainFront, Activity 
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
  const toggleSound = useTimerStore((state) => state.toggleSound);
  const setSoundVolume = useTimerStore((state) => state.setSoundVolume);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full mb-3 left-0 w-full transition-all duration-500 transform origin-bottom z-50",
        isOpen 
          ? "opacity-100 scale-100 pointer-events-auto" 
          : "opacity-0 scale-95 pointer-events-none translate-y-4"
      )}
    >
      <div className="bg-zinc-900/80 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-[450px] mx-auto overflow-hidden">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-transparent z-10 px-1">

          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Atmosphere Mixer</span>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-full hover:bg-white/10 text-white/20 hover:text-white transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 max-h-[280px] overflow-y-auto px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {sounds.map((sound) => {


            const Icon = sound.icon;
            const isActive = activeSounds[sound.id] !== undefined;
            const currentVolume = isActive ? activeSounds[sound.id] : 0;
            
            return (
              <div
                key={sound.id}
                onClick={() => toggleSound(sound.id)}
                onWheel={(e) => {
                  if (!isActive) return;
                  e.stopPropagation();
                  const delta = e.deltaY > 0 ? -5 : 5;
                  const newVolume = Math.min(100, Math.max(0, currentVolume + delta));
                  setSoundVolume(sound.id, newVolume);
                }}
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
                    "transition-all duration-500 flex items-center justify-center mb-4 relative",
                    isActive 
                      ? "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] scale-110" 
                      : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-6 h-6" />
                  {isActive && (
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 animate-pulse" />
                  )}
                </div>

                {/* Slider below */}
                <div 
                  className={cn(
                    "w-[70%] h-[3px] rounded-full transition-all duration-500",
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
  );
}
