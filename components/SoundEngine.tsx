"use client";

import { useTimerStore } from "@/lib/store";
import { useEffect, useRef } from "react";

export function SoundEngine() {
  const activeSounds = useTimerStore((state) => state.activeSounds);
  // Re-map to a stable format to compare in useEffect
  const activeSoundIds = Object.keys(activeSounds).sort().join(",");
  const audioInstances = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    const currentActiveIds = Object.keys(activeSounds);
    
    // 1. Clean up sounds that are no longer active
    Object.keys(audioInstances.current).forEach((id) => {
      if (!currentActiveIds.includes(id)) {
        audioInstances.current[id].pause();
        audioInstances.current[id].currentTime = 0;
        delete audioInstances.current[id];
      }
    });

    // 2. Add new sounds
    currentActiveIds.forEach((id) => {
      if (!audioInstances.current[id]) {
        const audio = new Audio(`/Sounds/${id}`);
        audio.loop = true;
        audio.volume = activeSounds[id] / 100;
        
        const playAudio = async () => {
          try {
            await audio.play();
          } catch (error) {
            console.warn(`Audio playback failed for ${id}:`, error);
          }
        };

        playAudio();
        audioInstances.current[id] = audio;
      }
    });
  }, [activeSoundIds]);

  // 3. Update volumes independently
  useEffect(() => {
    Object.keys(activeSounds).forEach((id) => {
      const audio = audioInstances.current[id];
      if (audio) {
        const targetVolume = activeSounds[id] / 100;
        if (audio.volume !== targetVolume) {
          audio.volume = targetVolume;
        }
      }
    });
  }, [activeSounds]);

  useEffect(() => {
    return () => {
      // Final cleanup on unmount
      Object.values(audioInstances.current).forEach((audio) => {
        audio.pause();
      });
      audioInstances.current = {};
    };
  }, []);

  return null;
}
