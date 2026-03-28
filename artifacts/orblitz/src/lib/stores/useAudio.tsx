import { create } from "zustand";
import {
  playShootSound,
  playHitSound,
  playOrbDestroySound,
  playCoinSound,
  playPowerUpSound,
  playMenuSelectSound,
  playPlayerDamageSound,
  playBossHitSound,
  playLevelCompleteSound,
  playGameOverSound,
  playBossDefeatSound,
  playDefenseActivateSound,
  playPauseSound,
  playBossAttackSound,
  playIntroSound,
  playTapToStartSound,
  playOrbWhooshSound,
  playOrbConvergeSound,
  playRingExpandSound,
  playSparkleSound,
  playTitleRevealSound,
  createMenuMusicNode,
  createBossMusicNode,
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
} from "@/lib/audio/SynthSounds";

const FADE_DURATION = 1000;
const TARGET_GAME_VOLUME = 0.24;
const TARGET_MENU_VOLUME = 0.2;

let gameMusicFadeInterval: number | null = null;
let menuMusicFadeInterval: number | null = null;

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
  synthBossMusic: SynthMusicNode | null;
  isMuted: boolean;
  currentMusicType: "menu" | "game" | "boss" | null;
  
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setMenuMusic: (music: HTMLAudioElement) => void;
  initSynthMenuMusic: () => SynthMusicNode;
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
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  menuMusic: null,
  synthMenuMusic: null,
  synthBossMusic: null,
  isMuted: false,
  currentMusicType: null,
  
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
    const { isMuted, backgroundMusic, synthMenuMusic, synthBossMusic, currentMusicType } = get();
    const newMutedState = !isMuted;
    set({ isMuted: newMutedState });
    
    if (newMutedState) {
      if (backgroundMusic) {
        fadeAudio(backgroundMusic, 0, 300);
      }
      synthMenuMusic?.fadeOut();
      synthBossMusic?.fadeOut();
    } else {
      if (currentMusicType === "menu") {
        const music = get().initSynthMenuMusic();
        music?.fadeIn();
      } else if (currentMusicType === "boss") {
        const music = get().initSynthBossMusic();
        music?.fadeIn();
      } else if (currentMusicType === "game" && backgroundMusic) {
        backgroundMusic.volume = 0;
        backgroundMusic.play().catch(() => {});
        fadeAudio(backgroundMusic, TARGET_GAME_VOLUME, FADE_DURATION);
      }
    }
  },
  
  startMenuMusic: () => {
    const { backgroundMusic, synthBossMusic, isMuted, currentMusicType } = get();
    if (currentMusicType === "menu") return;
    if (backgroundMusic && !backgroundMusic.paused) {
      fadeAudio(backgroundMusic, 0, FADE_DURATION, () => {
        backgroundMusic.pause();
      });
    }
    if (synthBossMusic) {
      synthBossMusic.fadeOut();
    }
    set({ currentMusicType: "menu" });
    if (!isMuted) {
      const music = get().initSynthMenuMusic();
      music?.fadeIn();
    }
  },
  
  startGameMusic: () => {
    const { backgroundMusic, synthMenuMusic, synthBossMusic, isMuted, currentMusicType } = get();
    if (currentMusicType === "game") return;
    if (synthMenuMusic) {
      synthMenuMusic.fadeOut(() => {});
    }
    if (synthBossMusic) {
      synthBossMusic.fadeOut(() => {});
    }
    set({ currentMusicType: "game" });
    if (backgroundMusic && !isMuted) {
      backgroundMusic.currentTime = 0;
      backgroundMusic.volume = 0;
      backgroundMusic.loop = true;
      backgroundMusic.play().catch(() => {});
      fadeAudio(backgroundMusic, TARGET_GAME_VOLUME, FADE_DURATION);
    }
  },
  
  startBossMusic: () => {
    const { backgroundMusic, synthMenuMusic, isMuted, currentMusicType } = get();
    if (currentMusicType === "boss") return;
    if (backgroundMusic && !backgroundMusic.paused) {
      fadeAudio(backgroundMusic, 0, FADE_DURATION, () => {
        backgroundMusic.pause();
      });
    }
    if (synthMenuMusic) {
      synthMenuMusic.fadeOut(() => {});
    }
    set({ currentMusicType: "boss" });
    if (!isMuted) {
      const music = get().initSynthBossMusic();
      music?.fadeIn();
    }
  },
  
  stopMusic: () => {
    const { backgroundMusic, synthMenuMusic, synthBossMusic } = get();
    if (backgroundMusic && !backgroundMusic.paused) {
      fadeAudio(backgroundMusic, 0, FADE_DURATION, () => {
        backgroundMusic.pause();
      });
    }
    if (synthMenuMusic) {
      synthMenuMusic.fadeOut();
    }
    if (synthBossMusic) {
      synthBossMusic.fadeOut();
    }
    set({ currentMusicType: null });
  },
  
  playHit: () => {
    if (!get().isMuted) playHitSound(0.3);
  },
  playSuccess: () => {
    if (!get().isMuted) playPowerUpSound(0.4);
  },
  playShoot: () => {
    if (!get().isMuted) playShootSound(0.2);
  },
  playPowerUp: () => {
    if (!get().isMuted) playPowerUpSound(0.35);
  },
  playLevelComplete: () => {
    if (!get().isMuted) playLevelCompleteSound(0.45);
  },
  playGameOver: () => {
    if (!get().isMuted) playGameOverSound(0.4);
  },
  playBossHit: () => {
    if (!get().isMuted) playBossHitSound(0.35);
  },
  playCoin: () => {
    if (!get().isMuted) playCoinSound(0.18);
  },
  playMenuSelect: () => {
    if (!get().isMuted) playMenuSelectSound(0.22);
  },
  playPlayerDamage: () => {
    if (!get().isMuted) playPlayerDamageSound(0.45);
  },
  playOrbDefeat: () => {
    if (!get().isMuted) playOrbDestroySound(0.22);
  },
  playPause: () => {
    if (!get().isMuted) playPauseSound(0.25);
  },
  playBossAttack: () => {
    if (!get().isMuted) playBossAttackSound(0.3);
  },
  playBossDefeat: () => {
    if (!get().isMuted) playBossDefeatSound(0.5);
  },
  playWeaponFire: () => {
    if (!get().isMuted) playShootSound(0.22);
  },
  playDefenseActivate: () => {
    if (!get().isMuted) playDefenseActivateSound(0.35);
  },
  playProjectileHit: () => {
    if (!get().isMuted) playHitSound(0.28);
  },
  playIntro: () => {
    if (!get().isMuted) playIntroSound(0.35);
  },
  playTapToStart: () => {
    if (!get().isMuted) playTapToStartSound(0.25);
  },
  playOrbWhoosh: () => {
    if (!get().isMuted) playOrbWhooshSound(0.2);
  },
  playOrbConverge: () => {
    if (!get().isMuted) playOrbConvergeSound(0.3);
  },
  playRingExpand: () => {
    if (!get().isMuted) playRingExpandSound(0.2);
  },
  playSparkle: () => {
    if (!get().isMuted) playSparkleSound(0.15);
  },
  playTitleReveal: () => {
    if (!get().isMuted) playTitleRevealSound(0.3);
  },
  playShieldActivate: () => {
    if (!get().isMuted) playShieldActivateSound(0.3);
  },
  playTeleport: () => {
    if (!get().isMuted) playTeleportSound(0.35);
  },
  playCombo: (count: number) => {
    if (!get().isMuted) playComboSound(count, 0.25);
  },
  playCriticalHit: () => {
    if (!get().isMuted) playCriticalHitSound(0.4);
  },
  playNearMiss: () => {
    if (!get().isMuted) playNearMissSound(0.2);
  },
  playChargeUp: () => {
    if (!get().isMuted) playChargeUpSound(0.25);
  },
  playEnergyBurst: () => {
    if (!get().isMuted) playEnergyBurstSound(0.35);
  },
  playWhooshBy: () => {
    if (!get().isMuted) playWhooshBySound(0.15);
  },
  playPowerDown: () => {
    if (!get().isMuted) playPowerDownSound(0.25);
  },
  playWarning: () => {
    if (!get().isMuted) playWarningSound(0.3);
  },
  playHeal: () => {
    if (!get().isMuted) playHealSound(0.3);
  },
  playSparkleExplosion: () => {
    if (!get().isMuted) playSparkleExplosionSound(0.45);
  },
}));
