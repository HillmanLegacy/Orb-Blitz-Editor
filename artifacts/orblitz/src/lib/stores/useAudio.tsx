import { create } from "zustand";
import { disposeAudioContext, setMasterVolume } from "@/lib/audio/SynthSounds";
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
let _arcadeGeneration = 0;
const clampAudioVolume = (value: number) => Math.max(0, Math.min(1, value));

function reportAudioPlaybackError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[audio] ${context} playback failed`, error);
  }
}

function playAudioElement(audio: HTMLAudioElement, context: string): void {
  try {
    audio.play().catch((error) => reportAudioPlaybackError(context, error));
  } catch (error) {
    reportAudioPlaybackError(context, error);
  }
}

function _shuffleArcade(): string[] {
  const a = [...ARCADE_TRACKS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _unloadAudio(el: HTMLAudioElement) {
  el.onended = null;
  el.pause();
  el.removeAttribute("src");
  el.load();
}

function _fadeArcade(el: HTMLAudioElement, from: number, to: number, ms: number, onDone?: () => void) {
  if (_arcadeFadeTimer) { clearInterval(_arcadeFadeTimer); _arcadeFadeTimer = null; }
  if (_arcadeEl !== el) return;
  const generation = _arcadeGeneration;
  const steps = 40;
  const step_ms = ms / steps;
  let s = 0;
  el.volume = clampAudioVolume(from);
  _arcadeFadeTimer = window.setInterval(() => {
    if (_arcadeEl !== el || generation !== _arcadeGeneration) {
      if (_arcadeFadeTimer) clearInterval(_arcadeFadeTimer);
      _arcadeFadeTimer = null;
      return;
    }
    s++;
    const t = s / steps;
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    el.volume = clampAudioVolume(from + (to - from) * e);
    if (s >= steps) {
      clearInterval(_arcadeFadeTimer!);
      _arcadeFadeTimer = null;
      el.volume = clampAudioVolume(to);
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
  const previous = _arcadeEl;
  _arcadeGeneration++;
  if (previous) _unloadAudio(previous);
  const el = new Audio(src);
  _arcadeEl = el;
  el.volume = 0;
  el.onended = () => {
    if (_arcadeEl === el && _arcadeActive) _playNextArcadeTrack(targetVol);
  };
  playAudioElement(el, "arcade track");
  _fadeArcade(el, 0, Math.min(1, targetVol), 1800);
}

// ── WAV sound effect player — rotating pool ───────────────────────────────────
// Pre-allocates POOL_SIZE Audio elements per sound path on first use, then
// cycles through them.  Prevents `new Audio()` allocation on every trigger —
// the single biggest source of abandoned HTMLAudioElement accumulation.
const WAV_POOL_SIZE = 6;
const MAX_WAV_POOLS = 8;
type WavPool = { els: HTMLAudioElement[]; idx: number; baseVolume: number };
const _wavPools = new Map<string, WavPool>();
let _wavOutputVolume = (() => {
  try {
    const stored = parseFloat(localStorage.getItem("orb_volume") ?? "1");
    return Number.isFinite(stored) ? clampAudioVolume(stored) : 1;
  } catch {
    return 1;
  }
})();
let _wavOutputMuted = false;

function _unloadWavPool(pool: { els: HTMLAudioElement[] }) {
  pool.els.forEach(_unloadAudio);
}

function setWavOutput(volume: number, muted: boolean) {
  _wavOutputVolume = clampAudioVolume(volume);
  _wavOutputMuted = muted;
  _wavPools.forEach((pool) => {
    pool.els.forEach((el) => {
      el.volume = clampAudioVolume(pool.baseVolume * _wavOutputVolume);
      el.muted = muted;
    });
  });
}

function playWav(path: string, volume = 0.6) {
  try {
    let pool = _wavPools.get(path);
    if (!pool) {
      // Map insertion order is our deterministic least-recently-used order.
      // Move entries on use below, so the first entry is always the eviction target.
      if (_wavPools.size >= MAX_WAV_POOLS) {
        const oldest = _wavPools.entries().next().value as [string, WavPool] | undefined;
        if (oldest) {
          _unloadWavPool(oldest[1]);
          _wavPools.delete(oldest[0]);
        }
      }
      pool = {
        els: Array.from({ length: WAV_POOL_SIZE }, () => new Audio(path)),
        idx: 0,
        baseVolume: volume,
      };
      _wavPools.set(path, pool);
    } else {
      _wavPools.delete(path);
      _wavPools.set(path, pool);
    }
    const el = pool.els[pool.idx % WAV_POOL_SIZE];
    pool.idx++;
    pool.baseVolume = volume;
    el.currentTime = 0;
    el.volume = clampAudioVolume(volume * _wavOutputVolume);
    el.muted = _wavOutputMuted;
    playAudioElement(el, "sound effect");
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

type SynthMusicNode = {
  start: () => void;
  stop: () => void;
  fadeIn: () => void;
  fadeOut: (onComplete?: () => void) => void;
  setMuted: (muted: boolean) => void;
};

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
  playUiClick: () => void;
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
  releaseAudio: () => void;
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
    const { isMuted, menuBgm, backgroundMusic, menuMusic } = get();
    set({ volume: clamped });
    setMasterVolume(isMuted ? 0 : clamped);
    setWavOutput(clamped, isMuted);
    try { localStorage.setItem("orb_volume", String(clamped)); } catch {}
    // Keep every active HTML audio output in sync with the setting.
    if (menuBgm) {
      if (menuBgmFadeInterval !== null) {
        clearInterval(menuBgmFadeInterval);
        menuBgmFadeInterval = null;
      }
      menuBgm.volume = clampAudioVolume(0.65 * clamped);
      menuBgm.muted = isMuted;
    }
    if (_arcadeEl) {
      if (_arcadeFadeTimer !== null) {
        clearInterval(_arcadeFadeTimer);
        _arcadeFadeTimer = null;
      }
      _arcadeEl.volume = clampAudioVolume(0.65 * clamped);
      _arcadeEl.muted = isMuted;
    }
    [backgroundMusic, menuMusic].forEach((audio) => {
      if (audio) audio.muted = isMuted;
    });
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
    const {
      isMuted,
      synthMenuMusic,
      synthGameMusic,
      synthBossMusic,
      currentMusicType,
      volume,
      menuBgm,
      backgroundMusic,
      menuMusic,
    } = get();
    const newMutedState = !isMuted;
    set({ isMuted: newMutedState });

    // Mute is an output setting, so it must take effect without waiting for a
    // scheduled note or an HTML audio fade interval to reach its endpoint.
    setMasterVolume(newMutedState ? 0 : volume);
    setWavOutput(volume, newMutedState);
    [backgroundMusic, menuMusic].forEach((audio) => {
      if (audio) audio.muted = newMutedState;
    });
    if (menuBgm) {
      if (menuBgmFadeInterval !== null) {
        clearInterval(menuBgmFadeInterval);
        menuBgmFadeInterval = null;
      }
      menuBgm.volume = clampAudioVolume(0.65 * volume);
      menuBgm.muted = newMutedState;
    }
    if (_arcadeEl) {
      if (_arcadeFadeTimer !== null) {
        clearInterval(_arcadeFadeTimer);
        _arcadeFadeTimer = null;
      }
      _arcadeEl.volume = clampAudioVolume(0.65 * volume);
      _arcadeEl.muted = newMutedState;
    }

    if (newMutedState) {
      synthMenuMusic?.setMuted(true);
      synthGameMusic?.setMuted(true);
      synthBossMusic?.setMuted(true);
    } else {
      if (currentMusicType === "menu") {
        get().initSynthMenuMusic()?.setMuted(false);
      } else if (currentMusicType === "game") {
        get().initSynthGameMusic()?.setMuted(false);
      } else if (currentMusicType === "boss") {
        get().initSynthBossMusic()?.setMuted(false);
      }
    }
    // Resume arcade BGM if the playlist is still active.
    if (!newMutedState && _arcadeActive && _arcadeEl) {
      playAudioElement(_arcadeEl, "arcade track");
    } else if (!newMutedState && _arcadeActive) {
      _playNextArcadeTrack(0.65 * volume);
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
    playAudioElement(audio, "menu music");
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
      _fadeArcade(el, el.volume, 0, 1200, () => {
        if (_arcadeEl === el) {
          _arcadeEl = null;
          _arcadeGeneration++;
          _unloadAudio(el);
        }
      });
    }
  },

  releaseAudio: () => {
    if (_arcadeFadeTimer !== null) {
      clearInterval(_arcadeFadeTimer);
      _arcadeFadeTimer = null;
    }
    if (menuBgmFadeInterval !== null) {
      clearInterval(menuBgmFadeInterval);
      menuBgmFadeInterval = null;
    }
    if (gameMusicFadeInterval !== null) {
      clearInterval(gameMusicFadeInterval);
      gameMusicFadeInterval = null;
    }

    _arcadeActive = false;
    _arcadeGeneration++;
    if (_arcadeEl) {
      _unloadAudio(_arcadeEl);
      _arcadeEl = null;
    }

    const { backgroundMusic, menuMusic, menuBgm, synthMenuMusic, synthGameMusic, synthBossMusic } = get();
    const elements = new Set([backgroundMusic, menuMusic, menuBgm].filter(Boolean));
    elements.forEach(_unloadAudio);
    synthMenuMusic?.stop();
    synthGameMusic?.stop();
    synthBossMusic?.stop();
    _wavPools.forEach(_unloadWavPool);
    _wavPools.clear();
    disposeAudioContext();

    set({
      backgroundMusic: null,
      menuMusic: null,
      menuBgm: null,
      synthMenuMusic: null,
      synthGameMusic: null,
      synthBossMusic: null,
      currentMusicType: null,
    });
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
  playUiClick: () => {
    if (!get().isMuted) playWav("/sounds/retro9-ui-click.ogg", 0.52);
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
