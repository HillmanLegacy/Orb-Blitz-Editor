import { create } from "zustand";
import { setMasterVolume } from "@/lib/audio/SynthSounds";
import {
  playShootSound,
  playHitSound,
  playOrbDestroySound,
  playCoinSound,
  playPowerUpSound,
  playPlayerDamageSound,
  playBossHitSound,
  playLevelCompleteSound,
  playGameOverSound,
  playBossDefeatSound,
  playDefenseActivateSound,
  playPauseSound,
  playBossAttackSound,
  playIntroSound,
  playOrbWhooshSound,
  playOrbConvergeSound,
  playRingExpandSound,
  playSparkleSound,
  playTitleRevealSound,
  playShieldActivateSound,
  playTeleportSound,
  playComboSound,
  playCriticalHitSound,
  playNearMissSound,
  playChargeUpSound,
  playEnergyBurstSound,
  playWhooshBySound,
  playPowerDownSound,
  playWarningSound,
  playHealSound,
  playSparkleExplosionSound,
  createMenuMusicNode,
  createGameplayMusicNode,
  createBossMusicNode,
} from "@/lib/audio/SynthSounds";

// ── Arcade BGM shuffle playlist ──────────────────────────────────────────────
const ARCADE_TRACKS = [
  "/audio/arcade/track_01.mp3",
  "/audio/arcade/track_02.mp3",
  "/audio/arcade/track_03.mp3",
  "/audio/arcade/track_04.mp3",
  "/audio/arcade/track_05.mp3",
  "/audio/arcade/track_06.mp3",
  "/audio/arcade/track_07.mp3",
  "/audio/arcade/track_08.mp3",
  "/audio/arcade/track_09.mp3",
  "/audio/arcade/track_10.mp3",
  "/audio/arcade/track_11.mp3",
  "/audio/arcade/track_12.mp3",
  "/audio/arcade/track_13.mp3",
  "/audio/arcade/track_14.mp3",
];

let _arcadeEl: HTMLAudioElement | null = null;
let _arcadeActive = false;
let _arcadeShuffled: string[] = [];
let _arcadeIdx = 0;
let _arcadeFadeTimer: number | null = null;

function _shuffleArcade(): string[] {
  const a = [...ARCADE_TRACKS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _fadeArcade(from: number, to: number, ms: number, onDone?: () => void) {
  if (_arcadeFadeTimer) { clearInterval(_arcadeFadeTimer); _arcadeFadeTimer = null; }
  if (!_arcadeEl) { onDone?.(); return; }
  const el = _arcadeEl;
  const steps = 40;
  const step_ms = ms / steps;
  let s = 0;
  el.volume = Math.max(0, Math.min(1, from));
  _arcadeFadeTimer = window.setInterval(() => {
    s++;
    const t = s / steps;
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    el.volume = Math.max(0, Math.min(1, from + (to - from) * e));
    if (s >= steps) {
      clearInterval(_arcadeFadeTimer!);
      _arcadeFadeTimer = null;
      el.volume = Math.max(0, Math.min(1, to));
      if (to === 0) el.pause();
      onDone?.();
    }
  }, step_ms);
}

function _playNextArcadeTrack(targetVol: number) {
  if (!_arcadeActive) return;
  if (_arcadeIdx >= _arcadeShuffled.length) {
    _arcadeShuffled = _shuffleArcade();
    _arcadeIdx = 0;
  }
  const src = _arcadeShuffled[_arcadeIdx++];
  if (_arcadeEl) { _arcadeEl.onended = null; _arcadeEl.pause(); }
  _arcadeEl = new Audio(src);
  _arcadeEl.volume = 0;
  _arcadeEl.onended = () => _playNextArcadeTrack(targetVol);
  _arcadeEl.play().catch(() => {});
  _fadeArcade(0, Math.min(1, targetVol), 1800);
}

// ── WAV sound effect player ───────────────────────────────────────────────────
function playWav(path: string, volume = 0.6) {
  try {
    const a = new Audio(path);
    a.volume = volume;
    a.play().catch(() => {});
  } catch {}
}

const FADE_DURATION = 1000;
const TARGET_GAME_VOLUME = 0.24;
const TARGET_MENU_VOLUME = 0.2;

let gameMusicFadeInterval: number | null = null;
let menuMusicFadeInterval: number | null = null;
let menuBgmFadeInterval: number | null = null;

const fadeMenuBgm = (
  audio: HTMLAudioElement,
  from: number,
  to: number,
  duration: number,
  onComplete?: () => void,
) => {
  if (menuBgmFadeInterval) { clearInterval(menuBgmFadeInterval); menuBgmFadeInterval = null; }
  const steps = 40;
  const stepDuration = duration / steps;
  let step = 0;
  audio.volume = Math.max(0, Math.min(1, from));
  menuBgmFadeInterval = window.setInterval(() => {
    step++;
    const t = step / steps;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out quad
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
    if (step >= steps) {
      clearInterval(menuBgmFadeInterval!);
      menuBgmFadeInterval = null;
      audio.volume = Math.max(0, Math.min(1, to));
      if (to === 0) { audio.pause(); audio.currentTime = 0; }
      onComplete?.();
    }
  }, stepDuration);
};

const fadeAudio = (
  audio: HTMLAudioElement,
  targetVolume: number,
  duration: number,
  onComplete?: () => void
) => {
  const startVolume = audio.volume;
  const volumeDiff = targetVolume - startVolume;
  const steps = 30;
  const stepDuration = duration / steps;
  let currentStep = 0;
  
  if (gameMusicFadeInterval) {
    clearInterval(gameMusicFadeInterval);
  }
  
  gameMusicFadeInterval = window.setInterval(() => {
    currentStep++;
    const progress = currentStep / steps;
    const easeProgress = 1 - Math.pow(1 - progress, 2);
    audio.volume = Math.max(0, Math.min(1, startVolume + volumeDiff * easeProgress));
    
    if (currentStep >= steps) {
      if (gameMusicFadeInterval) {
        clearInterval(gameMusicFadeInterval);
        gameMusicFadeInterval = null;
      }
      audio.volume = targetVolume;
      if (targetVolume === 0) {
        audio.pause();
      }
      onComplete?.();
    }
  }, stepDuration);
};

type SynthMusicNode = { start: () => void; stop: () => void; fadeIn: () => void; fadeOut: (onComplete?: () => void) => void };

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  menuMusic: HTMLAudioElement | null;
  synthMenuMusic: SynthMusicNode | null;
  synthGameMusic: SynthMusicNode | null;
  synthBossMusic: SynthMusicNode | null;
  isMuted: boolean;
  volume: number;
  brightness: number;
  currentMusicType: "menu" | "game" | "boss" | null;

  setVolume: (v: number) => void;
  setBrightness: (v: number) => void;
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setMenuMusic: (music: HTMLAudioElement) => void;
  initSynthMenuMusic: () => SynthMusicNode;
  initSynthGameMusic: () => SynthMusicNode;
  initSynthBossMusic: () => SynthMusicNode;
  
  toggleMute: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playShoot: () => void;
  playPowerUp: () => void;
  playLevelComplete: () => void;
  playGameOver: () => void;
  playBossHit: () => void;
  playCoin: () => void;
  playMenuSelect: () => void;
  playLevelSelect: () => void;
  playExitToMenu: () => void;
  playPlayerDamage: () => void;
  playOrbDefeat: () => void;
  playPause: () => void;
  playBossAttack: () => void;
  playBossDefeat: () => void;
  playWeaponFire: () => void;
  playDefenseActivate: () => void;
  playProjectileHit: () => void;
  playIntro: () => void;
  playTapToStart: () => void;
  playOrbWhoosh: () => void;
  playOrbConverge: () => void;
  playRingExpand: () => void;
  playSparkle: () => void;
  playTitleReveal: () => void;
  playShieldActivate: () => void;
  playTeleport: () => void;
  playCombo: (count: number) => void;
  playCriticalHit: () => void;
  playNearMiss: () => void;
  playChargeUp: () => void;
  playEnergyBurst: () => void;
  playWhooshBy: () => void;
  playPowerDown: () => void;
  playWarning: () => void;
  playHeal: () => void;
  playSparkleExplosion: () => void;
  
  startMenuMusic: () => void;
  startGameMusic: () => void;
  startBossMusic: () => void;
  stopMusic: () => void;

  menuBgm: HTMLAudioElement | null;
  startMenuBgm: () => void;
  stopMenuBgm: () => void;

  startArcadeBgm: () => void;
  stopArcadeBgm: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  menuMusic: null,
  synthMenuMusic: null,
  synthGameMusic: null,
  synthBossMusic: null,
  menuBgm: null,
  isMuted: false,
  volume: (() => { try { const v = parseFloat(localStorage.getItem("orb_volume") ?? "1"); return isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; } catch { return 1; } })(),
  brightness: (() => { try { const v = parseFloat(localStorage.getItem("orb_brightness") ?? "1"); return isFinite(v) ? Math.min(2, Math.max(0.2, v)) : 1; } catch { return 1; } })(),
  currentMusicType: null,

  setVolume: (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    set({ volume: clamped });
    setMasterVolume(clamped);
    try { localStorage.setItem("orb_volume", String(clamped)); } catch {}
    // Keep arcade BGM in sync with master volume
    if (_arcadeEl && !_arcadeEl.paused) {
      _arcadeEl.volume = Math.min(1, 0.65 * clamped);
    }
  },
  setBrightness: (v: number) => {
    const clamped = Math.min(2, Math.max(0.2, v));
    set({ brightness: clamped });
    try { localStorage.setItem("orb_brightness", String(clamped)); } catch {}
  },
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setMenuMusic: (music) => set({ menuMusic: music }),
  initSynthMenuMusic: () => {
    const current = get().synthMenuMusic;
    if (!current) {
      const newMusic = createMenuMusicNode(0.2);
      set({ synthMenuMusic: newMusic });
      return newMusic;
    }
    return current;
  },
  initSynthGameMusic: () => {
    const current = get().synthGameMusic;
    if (!current) {
      const newMusic = createGameplayMusicNode(0.2);
      set({ synthGameMusic: newMusic });
      return newMusic;
    }
    return current;
  },
  initSynthBossMusic: () => {
    const current = get().synthBossMusic;
    if (!current) {
      const newMusic = createBossMusicNode(0.18);
      set({ synthBossMusic: newMusic });
      return newMusic;
    }
    return current;
  },
  
  toggleMute: () => {
    const { isMuted, synthMenuMusic, synthGameMusic, synthBossMusic, currentMusicType, volume } = get();
    const newMutedState = !isMuted;
    set({ isMuted: newMutedState });
    
    if (newMutedState) {
      synthMenuMusic?.fadeOut();
      synthGameMusic?.fadeOut();
      synthBossMusic?.fadeOut();
      // Fade out arcade BGM without stopping the playlist advance flag
      if (_arcadeEl && !_arcadeEl.paused) {
        _fadeArcade(_arcadeEl.volume, 0, 800);
      }
    } else {
      if (currentMusicType === "menu") {
        get().initSynthMenuMusic()?.fadeIn();
      } else if (currentMusicType === "game") {
        get().initSynthGameMusic()?.fadeIn();
      } else if (currentMusicType === "boss") {
        get().initSynthBossMusic()?.fadeIn();
      }
      // Resume arcade BGM if the playlist is still active
      if (_arcadeActive && _arcadeEl) {
        _arcadeEl.play().catch(() => {});
        _fadeArcade(0, Math.min(1, 0.65 * volume), 800);
      } else if (_arcadeActive) {
        _playNextArcadeTrack(0.65 * volume);
      }
    }
  },
  
  startMenuMusic: () => {
    const { synthGameMusic, synthBossMusic, isMuted, currentMusicType } = get();
    if (currentMusicType === "menu") return;
    synthGameMusic?.fadeOut();
    synthBossMusic?.fadeOut();
    set({ currentMusicType: "menu" });
    if (!isMuted) {
      get().initSynthMenuMusic()?.fadeIn();
    }
  },
  
  startGameMusic: () => {
    const { synthMenuMusic, synthGameMusic, synthBossMusic, isMuted, currentMusicType } = get();
    if (currentMusicType === "game") return;
    synthMenuMusic?.fadeOut();
    synthGameMusic?.fadeOut();
    synthBossMusic?.fadeOut();
    set({ currentMusicType: "game" });
    if (!isMuted) {
      get().initSynthGameMusic()?.fadeIn();
    }
  },
  
  startBossMusic: () => {
    const { synthMenuMusic, synthGameMusic, isMuted, currentMusicType } = get();
    if (currentMusicType === "boss") return;
    synthMenuMusic?.fadeOut();
    synthGameMusic?.fadeOut();
    set({ currentMusicType: "boss" });
    if (!isMuted) {
      get().initSynthBossMusic()?.fadeIn();
    }
  },
  
  stopMusic: () => {
    const { synthMenuMusic, synthGameMusic, synthBossMusic } = get();
    synthMenuMusic?.fadeOut();
    synthGameMusic?.fadeOut();
    synthBossMusic?.fadeOut();
    set({ currentMusicType: null });
  },

  startMenuBgm: () => {
    const { isMuted, volume } = get();
    if (isMuted) return;
    let audio = get().menuBgm;
    if (!audio) {
      audio = new Audio("/audio/chipper_doodle.mp3");
      audio.loop = true;
      audio.volume = 0;
      set({ menuBgm: audio });
    }
    // Already playing — don't restart or re-fade
    if (!audio.paused) return;
    // Reset and play from start each time the menu is freshly entered
    audio.currentTime = 0;
    audio.volume = 0;
    audio.play().catch(() => {});
    const targetVol = Math.min(1, 0.65 * volume);
    fadeMenuBgm(audio, 0, targetVol, 1800);
  },

  stopMenuBgm: () => {
    const audio = get().menuBgm;
    if (!audio || audio.paused) return;
    fadeMenuBgm(audio, audio.volume, 0, 900);
  },

  startArcadeBgm: () => {
    const { isMuted, volume } = get();
    if (_arcadeActive) return;          // already running, don't restart
    if (isMuted) return;
    _arcadeActive = true;
    _arcadeShuffled = _shuffleArcade();
    _arcadeIdx = 0;
    _playNextArcadeTrack(0.65 * volume);
  },

  stopArcadeBgm: () => {
    if (!_arcadeActive && !_arcadeEl) return;
    _arcadeActive = false;
    if (_arcadeEl) {
      _arcadeEl.onended = null;         // prevent next-track advance after fade
      const el = _arcadeEl;
      _fadeArcade(el.volume, 0, 1200, () => { _arcadeEl = null; });
    }
  },
  
  playHit: () => {
    if (!get().isMuted) playHitSound(0.35);
  },
  playSuccess: () => {
    if (!get().isMuted) playPowerUpSound(0.35);
  },
  playShoot: () => {
    if (!get().isMuted) playShootSound(0.35);
  },
  playPowerUp: () => {
    if (!get().isMuted) playPowerUpSound(0.35);
  },
  playLevelComplete: () => {
    if (!get().isMuted) playLevelCompleteSound(0.35);
  },
  playGameOver: () => {
    if (!get().isMuted) playGameOverSound(0.35);
  },
  playBossHit: () => {
    if (!get().isMuted) playBossHitSound(0.35);
  },
  playCoin: () => {
    if (!get().isMuted) playCoinSound(0.35);
  },
  playMenuSelect: () => {
    if (!get().isMuted) playWav("/sounds/menu_select.wav", 0.52);
  },
  playLevelSelect: () => {
    if (!get().isMuted) playWav("/sounds/level_select.wav", 0.52);
  },
  playExitToMenu: () => {
    if (!get().isMuted) playWav("/sounds/exit_to_menu.wav", 0.52);
  },
  playPlayerDamage: () => {
    if (!get().isMuted) playPlayerDamageSound(0.35);
  },
  playOrbDefeat: () => {
    if (!get().isMuted) playOrbDestroySound(0.35);
  },
  playPause: () => {
    if (!get().isMuted) playPauseSound(0.35);
  },
  playBossAttack: () => {
    if (!get().isMuted) playBossAttackSound(0.35);
  },
  playBossDefeat: () => {
    if (!get().isMuted) playBossDefeatSound(0.35);
  },
  playWeaponFire: () => {
    if (!get().isMuted) playShootSound(0.35);
  },
  playDefenseActivate: () => {
    if (!get().isMuted) playDefenseActivateSound(0.35);
  },
  playProjectileHit: () => {
    if (!get().isMuted) playHitSound(0.35);
  },
  playIntro: () => {
    if (!get().isMuted) playIntroSound(0.35);
  },
  playTapToStart: () => {
    if (!get().isMuted) playWav("/sounds/tap_to_start.wav", 0.52);
  },
  playOrbWhoosh: () => {
    if (!get().isMuted) playOrbWhooshSound(0.35);
  },
  playOrbConverge: () => {
    if (!get().isMuted) playOrbConvergeSound(0.35);
  },
  playRingExpand: () => {
    if (!get().isMuted) playRingExpandSound(0.35);
  },
  playSparkle: () => {
    if (!get().isMuted) playSparkleSound(0.35);
  },
  playTitleReveal: () => {
    if (!get().isMuted) playTitleRevealSound(0.35);
  },
  playShieldActivate: () => {
    if (!get().isMuted) playShieldActivateSound(0.35);
  },
  playTeleport: () => {
    if (!get().isMuted) playTeleportSound(0.35);
  },
  playCombo: (count: number) => {
    if (!get().isMuted) playComboSound(count, 0.35);
  },
  playCriticalHit: () => {
    if (!get().isMuted) playCriticalHitSound(0.35);
  },
  playNearMiss: () => {
    if (!get().isMuted) playNearMissSound(0.35);
  },
  playChargeUp: () => {
    if (!get().isMuted) playChargeUpSound(0.35);
  },
  playEnergyBurst: () => {
    if (!get().isMuted) playEnergyBurstSound(0.35);
  },
  playWhooshBy: () => {
    if (!get().isMuted) playWhooshBySound(0.35);
  },
  playPowerDown: () => {
    if (!get().isMuted) playPowerDownSound(0.35);
  },
  playWarning: () => {
    if (!get().isMuted) playWarningSound(0.35);
  },
  playHeal: () => {
    if (!get().isMuted) playHealSound(0.35);
  },
  playSparkleExplosion: () => {
    if (!get().isMuted) playSparkleExplosionSound(0.35);
  },
}));
