import { useEffect, useRef, useCallback } from "react";
import { useAudio } from "@/lib/stores/useAudio";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

const FADE_DURATION = 2000;

function fadeAudio(audio: HTMLAudioElement, targetVolume: number, duration: number, onComplete?: () => void) {
  const startVolume = audio.volume;
  const startTime = Date.now();
  
  const fade = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = progress * (2 - progress);
    
    audio.volume = startVolume + (targetVolume - startVolume) * easeProgress;
    
    if (progress < 1) {
      requestAnimationFrame(fade);
    } else {
      audio.volume = targetVolume;
      if (targetVolume === 0) {
        audio.pause();
      }
      onComplete?.();
    }
  };
  
  requestAnimationFrame(fade);
}

export function SoundManager() {
  const { 
    setBackgroundMusic, 
    isMuted, 
    backgroundMusic,
    synthMenuMusic,
    synthGameMusic,
    initSynthMenuMusic,
    currentMusicType,
    synthBossMusic,
    startBossMusic,
    startGameMusic,
  } = useAudio();
  const { phase, gameMode, loadingType, arcadeLevel, boss } = useMagicOrb();
  const initialized = useRef(false);
  const chillMusicRef = useRef<HTMLAudioElement | null>(null);
  const defaultMusicRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<"pixel_drift" | "powerline_cappuccino" | "menu">("menu");
  const fadeInProgressRef = useRef(false);
  const pendingTrackRef = useRef<"pixel_drift" | "powerline_cappuccino" | "menu" | "boss" | "none" | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const defaultMusic = new Audio("/sounds/pixel_drift.mp3");
    defaultMusic.loop = true;
    defaultMusic.volume = 0.24;
    defaultMusicRef.current = defaultMusic;
    setBackgroundMusic(defaultMusic);
    
    const chillMusic = new Audio("/sounds/powerline_cappuccino.mp3");
    chillMusic.loop = true;
    chillMusic.volume = 0.24;
    chillMusicRef.current = chillMusic;
  }, [setBackgroundMusic]);

  const isBossLevel = gameMode === "arcade" && Math.floor(arcadeLevel * 10) % 10 === 9;
  const hasBossActive = boss !== null;
  const prevBossActiveRef = useRef(false);
  
  const getTargetTrack = useCallback((): "pixel_drift" | "powerline_cappuccino" | "menu" | "boss" | "none" => {
    if (phase === "menu") return "menu";
    
    if (phase === "loading") {
      if (loadingType === "exiting") return "menu";
      
      const levelNum = Math.floor(arcadeLevel * 10) % 10;
      const isLoadingToBoss = levelNum === 9;
      if (isLoadingToBoss && gameMode === "arcade") {
        return "none";
      }
      
      if (gameMode === "chill") return "powerline_cappuccino";
      return "pixel_drift";
    }
    
    if (phase === "playing") {
      if (hasBossActive || currentMusicType === "boss") {
        return "boss";
      }
      if (gameMode === "chill") return "powerline_cappuccino";
      return "pixel_drift";
    }
    
    return currentTrackRef.current as any;
  }, [phase, gameMode, loadingType, currentMusicType, hasBossActive, arcadeLevel]);

  const ensureTrackPlaying = useCallback((track: "pixel_drift" | "powerline_cappuccino" | "menu") => {
    const chillMusic = chillMusicRef.current;
    const defaultMusic = defaultMusicRef.current;
    
    if (!chillMusic || !defaultMusic) return;
    
    if (track === "menu") {
      initSynthMenuMusic();
      synthMenuMusic?.start();
      currentTrackRef.current = track;
      return;
    }
    
    const audio = track === "powerline_cappuccino" ? chillMusic : defaultMusic;
    const targetVolume = 0.3;
    
    if (audio.paused) {
      audio.volume = targetVolume;
      audio.play().catch(() => {});
    }
    currentTrackRef.current = track;
  }, [synthMenuMusic, initSynthMenuMusic]);

  const stopAllGameMusic = useCallback(() => {
    const chillMusic = chillMusicRef.current;
    const defaultMusic = defaultMusicRef.current;
    
    if (chillMusic && !chillMusic.paused) {
      fadeAudio(chillMusic, 0, FADE_DURATION, () => chillMusic.pause());
    }
    if (defaultMusic && !defaultMusic.paused) {
      fadeAudio(defaultMusic, 0, FADE_DURATION, () => defaultMusic.pause());
    }
    synthMenuMusic?.stop();
    synthGameMusic?.fadeOut();
  }, [synthMenuMusic, synthGameMusic]);

  const transitionToTrack = useCallback((targetTrack: "pixel_drift" | "powerline_cappuccino" | "menu" | "boss" | "none") => {
    if (isMuted) return;
    
    const chillMusic = chillMusicRef.current;
    const defaultMusic = defaultMusicRef.current;
    
    if (!chillMusic || !defaultMusic) return;
    
    if (targetTrack === "boss") {
      stopAllGameMusic();
      if (currentMusicType !== "boss") {
        startBossMusic();
      }
      fadeInProgressRef.current = false;
      return;
    }

    // Route normal gameplay through the synth engine instead of the MP3 file
    if (targetTrack === "pixel_drift") {
      stopAllGameMusic();
      if (currentMusicType !== "game") {
        startGameMusic();
      }
      fadeInProgressRef.current = false;
      return;
    }
    
    if (targetTrack === "none") {
      stopAllGameMusic();
      fadeInProgressRef.current = false;
      return;
    }
    
    const currentTrack = currentTrackRef.current;
    
    if (currentTrack === targetTrack) {
      ensureTrackPlaying(targetTrack);
      pendingTrackRef.current = null;
      return;
    }
    
    if (fadeInProgressRef.current) {
      pendingTrackRef.current = targetTrack;
      return;
    }
    
    fadeInProgressRef.current = true;
    pendingTrackRef.current = null;
    
    if (currentTrack === "menu") {
      synthMenuMusic?.stop();
    } else {
      const currentAudio = currentTrack === "powerline_cappuccino" ? chillMusic : defaultMusic;
      if (!currentAudio.paused) {
        fadeAudio(currentAudio, 0, FADE_DURATION, () => {
          currentAudio.pause();
        });
      }
    }
    
    if (targetTrack === "menu") {
      initSynthMenuMusic();
      setTimeout(() => {
        synthMenuMusic?.start();
        currentTrackRef.current = targetTrack;
        fadeInProgressRef.current = false;
      }, FADE_DURATION);
    } else {
      const targetAudio = targetTrack === "powerline_cappuccino" ? chillMusic : defaultMusic;
      const targetVolume = 0.3;
      
      setTimeout(() => {
        targetAudio.volume = 0;
        targetAudio.play().catch(() => {});
        fadeAudio(targetAudio, targetVolume, FADE_DURATION, () => {
          currentTrackRef.current = targetTrack;
          fadeInProgressRef.current = false;
          
          const newTarget = getTargetTrack();
          if (pendingTrackRef.current && pendingTrackRef.current !== targetTrack) {
            const pending = pendingTrackRef.current;
            pendingTrackRef.current = null;
            transitionToTrack(pending as any);
          } else if (newTarget !== targetTrack && newTarget !== "boss" && newTarget !== "none") {
            transitionToTrack(newTarget);
          }
        });
      }, FADE_DURATION);
    }
  }, [isMuted, synthMenuMusic, initSynthMenuMusic, ensureTrackPlaying, getTargetTrack, stopAllGameMusic, currentMusicType, startBossMusic]);

  useEffect(() => {
    if (isMuted) {
      const chillMusic = chillMusicRef.current;
      const defaultMusic = defaultMusicRef.current;
      synthMenuMusic?.stop();
      synthBossMusic?.fadeOut();
      chillMusic?.pause();
      defaultMusic?.pause();
      return;
    }
    
    const targetTrack = getTargetTrack();
    
    if (phase === "loading" || phase === "playing" || phase === "menu") {
      transitionToTrack(targetTrack);
    }
  }, [phase, gameMode, isMuted, synthMenuMusic, synthBossMusic, currentMusicType, getTargetTrack, transitionToTrack]);

  useEffect(() => {
    const wasBossActive = prevBossActiveRef.current;
    prevBossActiveRef.current = hasBossActive;
    
    if (wasBossActive && !hasBossActive && phase === "playing") {
      setTimeout(() => {
        if (currentMusicType === "boss") {
          startGameMusic();
        }
      }, 500);
    }
  }, [hasBossActive, phase, currentMusicType, startGameMusic]);

  return null;
}
