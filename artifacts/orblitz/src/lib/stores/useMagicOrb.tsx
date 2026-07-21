import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { MagiOrbType, DefenseType } from "./useShop";
import { useShop } from "./useShop";

export type GamePhase = "menu" | "loading" | "playing" | "paused" | "gameOver" | "levelComplete" | "modeSelect" | "arcadeComplete";
export type LoadingType = "entering" | "exiting" | "exiting_to_menu" | "nextLevel" | null;
export type GameMode = "survival" | "chill" | "arcade" | "gauntlet";
export type PowerUpType = "chargeBeam" | "shield" | "healing" | "distort" | "doubleCoins" | "rapidFire";
export type OrbShape = "sphere" | "cube" | "tetrahedron" | "octahedron" | "dodecahedron" | "bird" | "launcher" | "star" | "arrow" | "triangle" | "trapezoid" | "lightning" | "circle" | "tentacle" | "monster";
export type MovementPattern = "direct" | "zigzag" | "spiral" | "wave" | "orbit" | "homing" | "sine_horizontal" | "sine_vertical" | "figure8" | "pendulum" | "burst" | "retreat";

export interface DarkOrb {
  id: string;
  position: [number, number, number];
  direction?: [number, number, number];
  speed: number;
  size: number;
  seed: number;
  shape: OrbShape;
  pattern: MovementPattern;
  patternPhase: number;
  destroying?: boolean;
  destroyTimer?: number;
  frozen?: boolean;
  isBossOrb?: boolean;
  bossType?: BossType;
  bossDefeatColor?: BossType;
  hurtTimer?: number;
  /** Base speed used as ramp reference for lazy-float boss orbs */
  baseSpeed?: number;
  /** Age in seconds; used to ramp lazy-float orb speed over time */
  age?: number;
  /** When true, speed ramps from lazyMinMult → lazyMaxMult over lazyRampTime seconds */
  lazyFloat?: boolean;
  /** Speed multiplier at spawn (default 0.4) */
  lazyMinMult?: number;
  /** Speed multiplier cap (default 2.0) */
  lazyMaxMult?: number;
  /** Ramp duration in seconds (default 12) */
  lazyRampTime?: number;
}

export type BossType = "bird" | "star" | "arrow" | "triangle" | "trapezoid" | "cube" | "cloud" | "circle" | "tentacle" | "monster";

export interface Boss {
  id: string;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  angle: number;
  dodging: boolean;
  dodgeTimer: number;
  attackTimer: number;
  destroying?: boolean;
  destroyTimer?: number;
  bossType?: BossType;
  visible?: boolean;
  visibleTimer?: number;
  phase?: number;
  phaseTimer?: number;
  pieces?: Array<{id: string; position: [number, number, number]; launched: boolean; direction?: [number, number, number]}>;
  encircling?: boolean;
  encircleTimer?: number;
  floatTimer?: number;
  launching?: boolean;
  launchDirection?: [number, number, number];
  knockbackCount?: number;
  distortActive?: boolean;
  distortTimer?: number;
  reflectedProjectiles?: Array<{position: [number, number, number]; direction: [number, number, number]; timer: number}>;
  shieldActive?: boolean;
  shieldTimer?: number;
  shieldCooldown?: number;
  circleOrbs?: Array<{id: string; angle: number; distance: number; destroyed: boolean}>;
  spinSpeed?: number;
  starFormation?: Array<{id: string; position: [number, number, number]; destroyed: boolean; launching?: boolean; launchProgress?: number}>;
  formationPattern?: number;
  formationTimer?: number;
  swoopAngle?: number;
  swooping?: boolean;
  swoopCooldown?: number;
  bossProjectiles?: Array<{id: string; position: [number, number, number]; direction: [number, number, number]}>;
  targetPosition?: [number, number, number];
  moveTimer?: number;
  bounceVelocity?: [number, number];
}

export type ProjectileType = "normal" | "scattershot" | "spiral" | "overcharged" | "homing" | "subblaster";

export interface Projectile {
  id: string;
  position: [number, number, number];
  direction: [number, number, number];
  isCharged: boolean;
  size: number;
  type?: ProjectileType;
  hitCount?: number;
  piercing?: boolean;
  homing?: boolean;
  spiralAngle?: number;
  volleyId?: string;
  createdAt?: number;
  noMissTracking?: boolean;
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: [number, number, number];
  velocity: [number, number, number];
  collected?: boolean;
  collectTimer?: number;
}

export interface Particle {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  life: number;
  maxLife: number;
}

export interface ImpactEffect {
  id: string;
  position: [number, number, number];
  timer: number;
  maxTimer: number;
  seed: number;
  isBossHit?: boolean;
}

export interface LaserBeam {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  timer: number;
}

interface MagicOrbState {
  phase: GamePhase;
  loadingType: LoadingType;
  pendingLevel: number | null;
  gameMode: GameMode;
  arcadeLevel: number;
  completedLevel: number | null;
  orbsDestroyedInLevel: number;
  orbsRequiredForLevel: number;
  arcadeTotalOrbs: number;
  boss: Boss | null;
  defeatedBosses: number[];
  survivalBossTimer: number;
  survivalBossPending: boolean;
  
  health: number;
  maxHealth: number;
  bonusMaxHealth: number;
  killSpeedBonus: number;
  killSpawnBonus: number;
  timeDifficultyBonus: number;
  lastDifficultyTick: number;
  score: number;
  highScore: number;
  stars: number;
  gameTime: number;
  gauntletOrbsDestroyed: number;
  
  hasShield: boolean;
  hasChargeBeam: boolean;
  chargeBeamTimer: number;
  
  orbaniteBeamCooldown: number;
  orbaniteBeamMaxCooldown: number;
  
  hasDistort: boolean;
  distortSpawned: boolean;
  distortCooldown: number;
  distortMaxCooldown: number;
  distortActive: boolean;
  distortTimer: number;
  
  teletransferCooldown: number;
  teletransferMaxCooldown: number;
  
  pulseShieldCooldown: number;
  pulseShieldMaxCooldown: number;
  pulseShieldActive: boolean;
  pulseShieldTimer: number;
  
  spatialRelocationCooldown: number;
  spatialRelocationMaxCooldown: number;
  
  defenseOrbs: Array<{ id: string; angle: number; alive: boolean }>;
  
  hasDoubleCoins: boolean;
  doubleCoinsTimer: number;
  
  hasRapidFire: boolean;
  rapidFireTimer: number;
  
  selectedWeapon: "normal" | "orbanite" | "distort" | "teletransfer";
  
  isDamaged: boolean;
  damageTimer: number;
  isDying: boolean;
  deathTimer: number;
  isStaggered: boolean;
  staggerTimer: number;
  
  playerPosition: [number, number, number];
  
  darkOrbs: DarkOrb[];
  projectiles: Projectile[];
  powerUps: PowerUp[];
  particles: Particle[];
  impactEffects: ImpactEffect[];
  laserBeams: LaserBeam[];
  
  backgroundPulse: number;
  backgroundShake: number;
  
  spawnRate: number;
  difficultyMultiplier: number;
  
  setPhase: (phase: GamePhase) => void;
  setGameMode: (mode: GameMode) => void;
  startLoading: (type: LoadingType, level?: number) => void;
  finishLoading: () => void;
  startGame: () => void;
  startArcadeLevel: (level: number) => void;
  completeLevel: () => void;
  incrementOrbsDestroyed: () => void;
  
  updateBoss: (boss: Boss | null) => void;
  damageBoss: () => boolean;
  spawnBossOrb: (position: [number, number, number], direction: [number, number, number], pattern?: MovementPattern) => void;
  endGame: () => void;
  returnToMenu: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  
  takeDamage: () => void;
  heal: () => void;
  activateShield: () => void;
  activateChargeBeam: () => void;
  activateDistort: () => void;
  activateDoubleCoins: () => void;
  activateRapidFire: () => void;
  
  setSelectedWeapon: (weapon: "normal" | "orbanite" | "distort" | "teletransfer") => void;
  fireOrbaniteBeam: (direction: [number, number, number]) => void;
  activateDistortField: () => void;
  
  addDarkOrb: (orb: DarkOrb) => void;
  removeDarkOrb: (id: string) => void;
  updateDarkOrbs: (orbs: DarkOrb[]) => void;
  markOrbDestroying: (id: string) => void;
  freezeAllOrbs: () => void;
  unfreezeAllOrbs: () => void;
  
  addProjectile: (projectile: Projectile) => void;
  removeProjectile: (id: string) => void;
  updateProjectiles: (projectiles: Projectile[]) => void;
  
  addPowerUp: (powerUp: PowerUp) => void;
  removePowerUp: (id: string) => void;
  markPowerUpCollected: (id: string) => void;
  updatePowerUps: (powerUps: PowerUp[]) => void;
  
  addParticles: (particles: Particle[]) => void;
  updateParticles: (particles: Particle[]) => void;
  
  addImpactEffect: (effect: ImpactEffect) => void;
  updateImpactEffects: (effects: ImpactEffect[]) => void;
  
  addLaserBeam: (beam: LaserBeam) => void;
  updateLaserBeams: (beams: LaserBeam[]) => void;
  
  triggerBackgroundPulse: () => void;
  triggerBackgroundShake: () => void;
  updateBackgroundEffects: (delta: number) => void;
  
  addScore: (points: number) => void;
  addStars: (amount: number) => void;
  addOrbDestroyStars: () => void;
  addBossDefeatStars: () => void;
  updateGameTime: (delta: number) => void;
  updateDifficulty: () => void;
  updateTimeDifficulty: () => void;
  consumeShield: () => void;
  updateChargeBeamTimer: (delta: number) => void;
  updateDamageTimer: (delta: number) => void;
  updateDeathTimer: (delta: number) => void;
  updateOrbaniteBeamCooldown: (delta: number) => void;
  updateDistortCooldown: (delta: number) => void;
  updateTeletransferCooldown: (delta: number) => void;
  useTeletransfer: () => void;
  updatePulseShieldCooldown: (delta: number) => void;
  activatePulseShield: () => void;
  updateSpatialRelocationCooldown: (delta: number) => void;
  useSpatialRelocation: () => void;
  spawnDefenseOrbs: () => void;
  updateDefenseOrbs: (delta: number) => void;
  destroyDefenseOrb: (id: string) => void;
  updateDistortTimer: (delta: number) => void;
  updateDoubleCoinsTimer: (delta: number) => void;
  updateRapidFireTimer: (delta: number) => void;
  updateStaggerTimer: (delta: number) => void;
  triggerStagger: () => void;
  updateSurvivalBossTimer: (delta: number) => void;
  spawnSurvivalBoss: () => void;
  triggerDeath: () => void;
  teleportPlayer: (position: [number, number, number]) => void;
  registerMissedShot: () => void;
  incrementGauntletOrbs: () => void;
  
  // Magi-Orb state
  magiOrb1Active: boolean; // Circular movement
  magiOrb2Active: boolean; // Invisible/phase
  magiOrb2Cooldown: number;
  magiOrb2MaxCooldown: number;
  magiOrb3Cooldown: number; // Homing projectiles
  magiOrb3MaxCooldown: number;
  magiOrb4Active: boolean; // Quarter-circle barrier
  magiOrb4Cooldown: number;
  magiOrb4MaxCooldown: number;
  magiOrb4Timer: number;
  magiOrb4Direction: number; // Angle in radians
  magiOrb5HP: number; // Protective cube HP
  magiOrb5MaxHP: number;
  magiOrb6Timer: number; // Random teleport timer
  magiOrb7Active: boolean; // Slow pulse
  magiOrb7Cooldown: number;
  magiOrb7MaxCooldown: number;
  magiOrb7Timer: number;
  magiOrb8Position: [number, number, number] | null; // Allied orb position
  magiOrb8HP: number;
  magiOrb9Timer: number; // Spawn frequency reset timer
  
  // Magi-Orb actions
  activateMagiOrb2: () => void;
  activateMagiOrb3: () => void;
  activateMagiOrb4: (direction: number) => void;
  activateMagiOrb7: () => void;
  updateMagiOrbTimers: (delta: number) => void;
  damageMagiOrb5: () => boolean;
  damageMagiOrb8: () => void;
  initMagiOrbs: () => void;
}

export const WORLD_COLORS: Record<number, { primary: string; secondary: string; accent: string }> = {
  1: { primary: "#00ffff", secondary: "#0088aa", accent: "#00ccff" },
  2: { primary: "#ffdd00", secondary: "#ff8800", accent: "#ffaa00" },
  3: { primary: "#ff4400", secondary: "#cc2200", accent: "#ff6600" },
  4: { primary: "#ff00ff", secondary: "#aa00aa", accent: "#ff44ff" },
  5: { primary: "#00ff00", secondary: "#00aa00", accent: "#44ff44" },
  6: { primary: "#8800ff", secondary: "#5500aa", accent: "#aa44ff" },
  7: { primary: "#ff0088", secondary: "#aa0055", accent: "#ff44aa" },
  8: { primary: "#004488", secondary: "#002244", accent: "#0066bb" },
  9: { primary: "#880000", secondary: "#440000", accent: "#cc0000" },
};

const getStoredHighScore = (): number => {
  try {
    const stored = localStorage.getItem("orblitz_highScore");
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    localStorage.setItem("orblitz_highScore", score.toString());
  } catch {
  }
};

const getStoredBonusHP = (): number => {
  try {
    const stored = localStorage.getItem("orblitz_bonus_hp");
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
};

const getStoredDefeatedBosses = (): number[] => {
  try {
    const stored = localStorage.getItem("orblitz_defeated_bosses");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveDefeatedBoss = (world: number) => {
  try {
    const current = getStoredDefeatedBosses();
    if (!current.includes(world)) {
      current.push(world);
      localStorage.setItem("orblitz_defeated_bosses", JSON.stringify(current));
    }
  } catch {}
};

export const useMagicOrb = create<MagicOrbState>()(
  subscribeWithSelector((set, get) => ({
    phase: "menu",
    loadingType: null as LoadingType,
    pendingLevel: null as number | null,
    gameMode: "survival" as GameMode,
    arcadeLevel: 1.1,
    completedLevel: null,
    orbsDestroyedInLevel: 0,
    orbsRequiredForLevel: 15,
    arcadeTotalOrbs: 0,
    boss: null,
    defeatedBosses: getStoredDefeatedBosses(),
    survivalBossTimer: 0,
    survivalBossPending: false,
    
    health: 3,
    maxHealth: 3,
    bonusMaxHealth: getStoredBonusHP(),
    killSpeedBonus: 0,
    killSpawnBonus: 0,
    timeDifficultyBonus: 0,
    lastDifficultyTick: 0,
    score: 0,
    highScore: getStoredHighScore(),
    stars: 0,
    gameTime: 0,
    gauntletOrbsDestroyed: 0,
    
    hasShield: false,
    hasChargeBeam: false,
    chargeBeamTimer: 0,
    
    orbaniteBeamCooldown: 0,
    orbaniteBeamMaxCooldown: 8,
    
    hasDistort: false,
    distortSpawned: false,
    distortCooldown: 0,
    distortMaxCooldown: 12,
    teletransferCooldown: 0,
    teletransferMaxCooldown: 15,
    pulseShieldCooldown: 0,
    pulseShieldMaxCooldown: 12,
    pulseShieldActive: false,
    pulseShieldTimer: 0,
    spatialRelocationCooldown: 0,
    spatialRelocationMaxCooldown: 20,
    defenseOrbs: [],
    distortActive: false,
    distortTimer: 0,
    
    hasDoubleCoins: false,
    doubleCoinsTimer: 0,
    
    hasRapidFire: false,
    rapidFireTimer: 0,
    
    selectedWeapon: "normal",
    
    isDamaged: false,
    damageTimer: 0,
    isDying: false,
    deathTimer: 0,
    isStaggered: false,
    staggerTimer: 0,
    
    playerPosition: [0, 0, 0] as [number, number, number],
    
    darkOrbs: [],
    projectiles: [],
    powerUps: [],
    particles: [],
    impactEffects: [],
    laserBeams: [],
    
    backgroundPulse: 0,
    backgroundShake: 0,
    
    spawnRate: 2,
    difficultyMultiplier: 1,
    
    // Magi-Orb state defaults
    magiOrb1Active: false,
    magiOrb2Active: false,
    magiOrb2Cooldown: 0,
    magiOrb2MaxCooldown: 15,
    magiOrb3Cooldown: 0,
    magiOrb3MaxCooldown: 10,
    magiOrb4Active: false,
    magiOrb4Cooldown: 0,
    magiOrb4MaxCooldown: 15,
    magiOrb4Timer: 0,
    magiOrb4Direction: 0,
    magiOrb5HP: 5,
    magiOrb5MaxHP: 5,
    magiOrb6Timer: 0,
    magiOrb7Active: false,
    magiOrb7Cooldown: 0,
    magiOrb7MaxCooldown: 15,
    magiOrb7Timer: 0,
    magiOrb8Position: null as [number, number, number] | null,
    magiOrb8HP: 3,
    magiOrb9Timer: 0,
    
    setPhase: (phase) => set({ phase }),
    setGameMode: (mode) => set({ gameMode: mode }),
    
    startLoading: (type, level) => {
      set({ 
        phase: "loading", 
        loadingType: type,
        pendingLevel: level ?? null,
      });
    },
    
    finishLoading: () => {
      const { loadingType, pendingLevel, gameMode, bonusMaxHealth } = get();
      if (loadingType === "entering") {
        const maxHP = 3 + bonusMaxHealth;
        set({
          phase: "playing",
          loadingType: null,
          pendingLevel: null,
          arcadeLevel: 1.1,
          orbsDestroyedInLevel: 0,
          orbsRequiredForLevel: 15,
          arcadeTotalOrbs: 0,
          boss: null,
          survivalBossTimer: 0,
          survivalBossPending: false,
          health: maxHP,
          maxHealth: maxHP,
          killSpeedBonus: 0,
          killSpawnBonus: 0,
          timeDifficultyBonus: 0,
          lastDifficultyTick: 0,
          score: 0,
          stars: 0,
          gameTime: 0,
          hasShield: false,
          hasChargeBeam: false,
          chargeBeamTimer: 0,
          orbaniteBeamCooldown: 0,
          hasDistort: false,
          distortSpawned: false,
          distortCooldown: 0,
          distortActive: false,
          distortTimer: 0,
          teletransferCooldown: 0,
          pulseShieldCooldown: 0,
          pulseShieldActive: false,
          pulseShieldTimer: 0,
          hasDoubleCoins: false,
          doubleCoinsTimer: 0,
          hasRapidFire: false,
          rapidFireTimer: 0,
          selectedWeapon: "normal",
          isDamaged: false,
          damageTimer: 0,
          isDying: false,
          deathTimer: 0,
          isStaggered: false,
          staggerTimer: 0,
          playerPosition: [0, 0, 0] as [number, number, number],
          darkOrbs: [],
          projectiles: [],
          powerUps: [],
          particles: [],
          impactEffects: [],
          laserBeams: [],
          backgroundPulse: 0,
          backgroundShake: 0,
          spawnRate: gameMode === "chill" ? 3 : 2,
          difficultyMultiplier: 1,
        });
        get().initMagiOrbs();
      } else if (loadingType === "nextLevel" && pendingLevel !== null) {
        const isBossLevel = Math.floor(pendingLevel * 10) % 10 === 9;
        const subLevel = Math.round((pendingLevel % 1) * 10);
        const worldLevel = Math.floor(pendingLevel);
        let orbsRequired: number;
        if (isBossLevel) {
          orbsRequired = 1;
        } else {
          const worldBase = 15 + (worldLevel - 1) * 10;
          orbsRequired = worldBase + (subLevel - 1) * 5;
        }
        const maxHP = 3 + get().bonusMaxHealth;
        
        const bossTypes: Record<number, BossType> = {
          1: "circle", 2: "star", 3: "triangle", 4: "trapezoid", 5: "cube",
          6: "cloud", 7: "arrow", 8: "tentacle", 9: "monster",
        };
        const bossHPs: Record<number, number> = {
          1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100,
        };
        const bossType = bossTypes[worldLevel] || "monster";
        const bossHP = bossHPs[worldLevel] || 100;
        
        let bossInit: Boss | null = null;
        if (isBossLevel) {
          bossInit = {
            id: `boss-${Date.now()}`,
            position: bossType === "cloud" ? [0, 6, 0] : bossType === "star" ? [0, 4, 0] : bossType === "circle" ? [5, 0, 0] : [8, 0, 0],
            health: bossHP,
            maxHealth: bossHP,
            angle: 0,
            dodging: false,
            dodgeTimer: 0,
            attackTimer: 2,
            bossType,
            visible: true,
            visibleTimer: 0,
            phase: 0,
            phaseTimer: bossType === "triangle" ? 2 + Math.random() * 2 : 0,
            floatTimer: bossType === "triangle" ? 2 + Math.random() * 2 : 0,
            pieces: bossType === "arrow" ? Array.from({length: 5}, (_, i) => ({
              id: `piece-${i}`,
              position: [0, 0, 0] as [number, number, number],
              launched: false,
            })) : undefined,
            starFormation: bossType === "star" ? Array.from({length: 7}, (_, i) => ({
              id: `star-${i}`,
              position: [(-6 + i * 2), 4, 0] as [number, number, number],
              destroyed: false,
            })) : undefined,
            formationPattern: bossType === "star" ? 0 : undefined,
            formationTimer: bossType === "star" ? 3 : undefined,
            swoopAngle: bossType === "trapezoid" ? Math.PI / 4 : undefined,
            swooping: bossType === "trapezoid" ? false : undefined,
            swoopCooldown: bossType === "trapezoid" ? 2 : undefined,
            bossProjectiles: bossType === "triangle" ? [] : undefined,
            moveTimer: bossType === "triangle" ? 2 : undefined,
            targetPosition: bossType === "triangle" ? [6, 0, 0] : undefined,
          };
        }
        
        set({
          phase: "playing",
          loadingType: null,
          pendingLevel: null,
          arcadeLevel: pendingLevel,
          orbsDestroyedInLevel: 0,
          orbsRequiredForLevel: orbsRequired,
          boss: bossInit,
          survivalBossPending: false,
          stars: 0,
          health: maxHP,
          maxHealth: maxHP,
          isDamaged: false,
          damageTimer: 0,
          isDying: false,
          deathTimer: 0,
          darkOrbs: [],
          projectiles: [],
          powerUps: [],
          particles: [],
          impactEffects: [],
          laserBeams: [],
          killSpeedBonus: 0,
          killSpawnBonus: 0,
          gameTime: 0,
        });
      } else if (loadingType === "exiting" || loadingType === "exiting_to_menu") {
        set({
          phase: "menu",
          loadingType: null,
          pendingLevel: null,
        });
      } else {
        set({ phase: "menu", loadingType: null, pendingLevel: null });
      }
    },
    
    pauseGame: () => {
      const { phase } = get();
      if (phase === "playing") {
        set({ phase: "paused", backgroundShake: 0 });
      }
    },
    
    resumeGame: () => {
      const { phase } = get();
      if (phase === "paused") {
        set({ phase: "playing" });
      }
    },
    
    startGame: () => {
      const mode = get().gameMode;
      const maxHP = 3;
      set({
        phase: "playing",
        arcadeLevel: 1.1,
        completedLevel: null,
        orbsDestroyedInLevel: 0,
        orbsRequiredForLevel: 15,
        arcadeTotalOrbs: 0,
        boss: null,
        survivalBossTimer: 0,
        survivalBossPending: false,
        health: maxHP,
        maxHealth: maxHP,
        killSpeedBonus: 0,
        killSpawnBonus: 0,
        timeDifficultyBonus: 0,
        lastDifficultyTick: 0,
        score: 0,
        stars: 0,
        gameTime: 0,
        gauntletOrbsDestroyed: 0,
        hasShield: false,
        hasChargeBeam: false,
        chargeBeamTimer: 0,
        orbaniteBeamCooldown: 0,
        hasDistort: false,
        distortSpawned: false,
        distortCooldown: 0,
        distortActive: false,
        distortTimer: 0,
        teletransferCooldown: 0,
        pulseShieldCooldown: 0,
        pulseShieldActive: false,
        pulseShieldTimer: 0,
        hasDoubleCoins: false,
        doubleCoinsTimer: 0,
        hasRapidFire: false,
        rapidFireTimer: 0,
        selectedWeapon: "normal",
        isDamaged: false,
        damageTimer: 0,
        isDying: false,
        deathTimer: 0,
        isStaggered: false,
        staggerTimer: 0,
        spatialRelocationCooldown: 0,
        magiOrb2Cooldown: 0,
        magiOrb2Active: false,
        magiOrb3Cooldown: 0,
        magiOrb4Cooldown: 0,
        magiOrb4Active: false,
        magiOrb4Timer: 0,
        magiOrb7Cooldown: 0,
        magiOrb7Active: false,
        magiOrb7Timer: 0,
        playerPosition: [0, 0, 0] as [number, number, number],
        darkOrbs: [],
        projectiles: [],
        powerUps: [],
        particles: [],
        impactEffects: [],
        laserBeams: [],
        backgroundPulse: 0,
        backgroundShake: 0,
        spawnRate: mode === "chill" ? 3 : 2,
        difficultyMultiplier: 1,
      });
      get().initMagiOrbs();
    },
    
    startArcadeLevel: (level) => {
      const isBossLevel = Math.floor(level * 10) % 10 === 9;
      const subLevel = Math.round((level % 1) * 10);
      const worldLevel = Math.floor(level);
      
      let orbsRequired: number;
      if (isBossLevel) {
        orbsRequired = 1;
      } else {
        const worldBase = 15 + (worldLevel - 1) * 10;
        orbsRequired = worldBase + (subLevel - 1) * 5;
      }
      const bonusHP = get().bonusMaxHealth;
      
      const bossTypes: Record<number, BossType> = {
        1: "circle", 2: "star", 3: "triangle", 4: "trapezoid", 5: "cube",
        6: "cloud", 7: "arrow", 8: "tentacle", 9: "monster",
      };
      const bossHPs: Record<number, number> = {
        1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100,
      };
      const bossType = bossTypes[worldLevel] || "monster";
      const bossHP = bossHPs[worldLevel] || 100;
      
      let bossInit: Boss | null = null;
      if (isBossLevel) {
        bossInit = {
          id: `boss-${Date.now()}`,
          position: bossType === "cloud" ? [0, 6, 0] : bossType === "star" ? [0, 4, 0] : bossType === "circle" ? [5, 0, 0] : [8, 0, 0],
          health: bossHP,
          maxHealth: bossHP,
          angle: 0,
          dodging: false,
          dodgeTimer: 0,
          attackTimer: 2,
          bossType,
          visible: true,
          visibleTimer: 0,
          phase: 0,
          phaseTimer: bossType === "triangle" ? 2 + Math.random() * 2 : 0,
          floatTimer: bossType === "triangle" ? 2 + Math.random() * 2 : 0,
          pieces: bossType === "arrow" ? Array.from({length: 5}, (_, i) => ({
            id: `piece-${i}`,
            position: [0, 0, 0] as [number, number, number],
            launched: false,
          })) : undefined,
          starFormation: bossType === "star" ? Array.from({length: 7}, (_, i) => ({
            id: `star-${i}`,
            position: [(-6 + i * 2), 4, 0] as [number, number, number],
            destroyed: false,
          })) : undefined,
          formationPattern: bossType === "star" ? 0 : undefined,
          formationTimer: bossType === "star" ? 3 : undefined,
          swoopAngle: bossType === "trapezoid" ? Math.PI / 4 : undefined,
          swooping: bossType === "trapezoid" ? false : undefined,
          swoopCooldown: bossType === "trapezoid" ? 2 : undefined,
          bossProjectiles: bossType === "triangle" ? [] : undefined,
          moveTimer: bossType === "triangle" ? 2 : undefined,
          targetPosition: bossType === "triangle" ? [6, 0, 0] : undefined,
        };
      }
      
      set({
        phase: "playing",
        arcadeLevel: level,
        completedLevel: null,
        orbsDestroyedInLevel: 0,
        orbsRequiredForLevel: orbsRequired,
        arcadeTotalOrbs: 0,
        health: 3 + bonusHP,
        maxHealth: 3 + bonusHP,
        killSpeedBonus: 0,
        killSpawnBonus: 0,
        timeDifficultyBonus: 0,
        lastDifficultyTick: 0,
        hasShield: false,
        hasChargeBeam: false,
        chargeBeamTimer: 0,
        hasDoubleCoins: false,
        doubleCoinsTimer: 0,
        hasRapidFire: false,
        rapidFireTimer: 0,
        hasDistort: false,
        distortSpawned: false,
        distortCooldown: 0,
        distortActive: false,
        distortTimer: 0,
        teletransferCooldown: 0,
        pulseShieldCooldown: 0,
        pulseShieldActive: false,
        pulseShieldTimer: 0,
        spatialRelocationCooldown: 0,
        orbaniteBeamCooldown: 0,
        magiOrb2Cooldown: 0,
        magiOrb2Active: false,
        magiOrb3Cooldown: 0,
        magiOrb4Cooldown: 0,
        magiOrb4Active: false,
        magiOrb4Timer: 0,
        magiOrb7Cooldown: 0,
        magiOrb7Active: false,
        magiOrb7Timer: 0,
        selectedWeapon: "normal",
        gameTime: 0,
        difficultyMultiplier: 1,
        isStaggered: false,
        staggerTimer: 0,
        isDamaged: false,
        damageTimer: 0,
        isDying: false,
        deathTimer: 0,
        playerPosition: [0, 0, 0] as [number, number, number],
        boss: bossInit,
        darkOrbs: [],
        projectiles: [],
        powerUps: [],
        particles: [],
        impactEffects: [],
        laserBeams: [],
      });
    },
    
    completeLevel: () => {
      const { arcadeLevel, gameMode, bonusMaxHealth, defeatedBosses } = get();
      if (gameMode !== "arcade") return;
      
      const currentWorld = Math.floor(arcadeLevel);
      const currentSub = Math.round((arcadeLevel % 1) * 10);
      const completedLevelValue = arcadeLevel;
      let nextLevel: number;
      
      if (currentSub >= 9) {
        if (currentWorld >= 9) {
          if (!defeatedBosses.includes(currentWorld) && bonusMaxHealth < 9) {
            const newBonusHP = Math.min(bonusMaxHealth + 1, 9);
            set({ 
              bonusMaxHealth: newBonusHP,
              defeatedBosses: [...defeatedBosses, currentWorld],
            });
            saveDefeatedBoss(currentWorld);
            try {
              localStorage.setItem("orblitz_bonus_hp", newBonusHP.toString());
            } catch {}
          }
          try {
            localStorage.setItem("orblitz_arcade_progress", JSON.stringify({ highestLevel: 1.1 }));
          } catch {}
          set({ 
            phase: "arcadeComplete", 
            completedLevel: completedLevelValue,
            hasShield: false,
            chargeBeamTimer: 0,
            hasDoubleCoins: false,
            doubleCoinsTimer: 0,
            hasRapidFire: false,
            rapidFireTimer: 0,
            distortCooldown: 0,
            distortActive: false,
            distortTimer: 0,
            teletransferCooldown: 0,
            pulseShieldCooldown: 0,
            pulseShieldActive: false,
            spatialRelocationCooldown: 0,
            orbaniteBeamCooldown: 0,
            magiOrb2Cooldown: 0,
            magiOrb2Active: false,
            magiOrb3Cooldown: 0,
            magiOrb4Cooldown: 0,
            magiOrb4Active: false,
            magiOrb4Timer: 0,
            magiOrb7Cooldown: 0,
            magiOrb7Active: false,
            magiOrb7Timer: 0,
            projectiles: [],
            powerUps: [],
          });
          return;
        }
        nextLevel = currentWorld + 1 + 0.1;
        if (!defeatedBosses.includes(currentWorld) && bonusMaxHealth < 9) {
          const newBonusHP = Math.min(bonusMaxHealth + 1, 9);
          set({ 
            bonusMaxHealth: newBonusHP,
            defeatedBosses: [...defeatedBosses, currentWorld],
          });
          saveDefeatedBoss(currentWorld);
          try {
            localStorage.setItem("orblitz_bonus_hp", newBonusHP.toString());
          } catch {}
        }
      } else {
        nextLevel = currentWorld + (currentSub + 1) / 10;
      }
      
      try {
        const stored = localStorage.getItem("orblitz_arcade_progress");
        const current = stored ? JSON.parse(stored) : { highestLevel: 1.1 };
        if (nextLevel > current.highestLevel) {
          localStorage.setItem("orblitz_arcade_progress", JSON.stringify({
            highestLevel: nextLevel,
          }));
        }
      } catch {}
      
      set({ 
        phase: "levelComplete", 
        completedLevel: completedLevelValue,
        hasShield: false,
        chargeBeamTimer: 0,
        hasDoubleCoins: false,
        doubleCoinsTimer: 0,
        hasRapidFire: false,
        rapidFireTimer: 0,
        distortCooldown: 0,
        distortActive: false,
        distortTimer: 0,
        teletransferCooldown: 0,
        pulseShieldCooldown: 0,
        pulseShieldActive: false,
        spatialRelocationCooldown: 0,
        orbaniteBeamCooldown: 0,
        magiOrb2Cooldown: 0,
        magiOrb2Active: false,
        magiOrb3Cooldown: 0,
        magiOrb4Cooldown: 0,
        magiOrb4Active: false,
        magiOrb4Timer: 0,
        magiOrb7Cooldown: 0,
        magiOrb7Active: false,
        magiOrb7Timer: 0,
        projectiles: [],
        powerUps: [],
      });
    },
    
    incrementOrbsDestroyed: () => {
      const { orbsDestroyedInLevel, orbsRequiredForLevel, gameMode, boss, arcadeLevel, killSpeedBonus, killSpawnBonus, arcadeTotalOrbs } = get();
      if (gameMode !== "arcade") return;
      
      const newCount = orbsDestroyedInLevel + 1;
      const worldLevel = Math.floor(arcadeLevel);
      const bonusPercent = Math.pow(2, worldLevel - 1);
      
      set({ 
        orbsDestroyedInLevel: newCount,
        arcadeTotalOrbs: arcadeTotalOrbs + 1,
        killSpeedBonus: killSpeedBonus + bonusPercent,
        killSpawnBonus: killSpawnBonus + bonusPercent,
      });
      
      if (!boss && newCount >= orbsRequiredForLevel) {
        get().completeLevel();
      }
    },
    
    updateBoss: (boss) => set({ boss }),
    
    damageBoss: () => {
      const { boss, gameMode, hasChargeBeam, arcadeTotalOrbs, darkOrbs, arcadeLevel } = get();
      if (!boss || boss.destroying) return false;
      if (boss.bossType === "star" && !boss.visible) return false;
      
      const damage = hasChargeBeam ? 2 : 1;
      const newHealth = boss.health - damage;
      if (newHealth <= 0) {
        const isBossLevel = Math.floor(arcadeLevel * 10) % 10 === 9;
        const defeatedOrbs = isBossLevel ? darkOrbs.map(o => ({
          ...o,
          destroying: true,
          destroyTimer: 0.6,
          bossDefeatColor: boss.bossType,
        })) : darkOrbs;
        
        set({ 
          boss: { ...boss, destroying: true, destroyTimer: 3.5, health: 0 },
          arcadeTotalOrbs: gameMode === "arcade" ? arcadeTotalOrbs + 1 : arcadeTotalOrbs,
          darkOrbs: defeatedOrbs,
        });
        get().addBossDefeatStars();
        return true;
      } else {
        set({ boss: { ...boss, health: newHealth } });
        return false;
      }
    },
    
    spawnBossOrb: (position, direction, pattern = "direct") => {
      const { arcadeLevel, boss, darkOrbs } = get();
      const worldLevel = Math.floor(arcadeLevel);
      const worldShapes: Record<number, OrbShape> = {
        1: "circle", 2: "star", 3: "triangle", 4: "trapezoid", 5: "cube",
        6: "lightning", 7: "arrow", 8: "tentacle", 9: "monster",
      };
      const worldBossTypes: Record<number, BossType> = {
        1: "circle", 2: "star", 3: "triangle", 4: "trapezoid", 5: "cube",
        6: "cloud", 7: "arrow", 8: "tentacle", 9: "monster",
      };
      const shape = worldShapes[worldLevel] || "monster";
      const bossType = boss?.bossType || worldBossTypes[worldLevel] || "monster";
      
      const speedScale = 1 + (worldLevel - 1) * 0.15;
      const baseSpeed = 2.5 * speedScale;
      const sizeScale = 0.5 + (worldLevel - 1) * 0.03;

      // Prevent stacking: skip spawn if an existing boss orb is within minDist
      const minDist = 1.2;
      const tooClose = darkOrbs.some(o => {
        if (!o.isBossOrb || o.destroying) return false;
        const dx = o.position[0] - position[0];
        const dy = o.position[1] - position[1];
        return Math.sqrt(dx * dx + dy * dy) < minDist;
      });
      if (tooClose) return;
      
      // World 1 & 2 boss orbs float lazily toward the player, accelerating over time.
      // World 2 starts slightly faster and reaches a higher cap.
      const isLazyFloat   = worldLevel <= 2;
      const lazyMinMult   = worldLevel === 1 ? 0.4  : 0.6;  // init multiplier
      const lazyMaxMult   = worldLevel === 1 ? 2.0  : 2.2;  // speed cap
      const lazyRampTime  = worldLevel === 1 ? 12   : 10;   // ramp duration (s)
      const initialSpeed  = isLazyFloat ? baseSpeed * lazyMinMult : baseSpeed;

      const orb: DarkOrb = {
        id: `boss-orb-${Date.now()}-${Math.random()}`,
        position: [position[0], position[1], 0.5] as [number, number, number],
        direction,
        speed: initialSpeed,
        baseSpeed,
        age: 0,
        lazyFloat: isLazyFloat,
        lazyMinMult,
        lazyMaxMult,
        lazyRampTime,
        size: sizeScale,
        seed: Math.random(),
        shape,
        pattern: "homing",
        patternPhase: Math.random() * Math.PI * 2,
        isBossOrb: true,
        bossType,
      };
      get().addDarkOrb(orb);
    },
    
    endGame: () => {
      const { score, highScore } = get();
      const newHighScore = Math.max(score, highScore);
      saveHighScore(newHighScore);
      set({ 
        phase: "gameOver",
        highScore: newHighScore,
      });
    },
    
    returnToMenu: () => {
      set({
        phase: "menu",
        loadingType: null,
        arcadeLevel: 1.1,
        arcadeTotalOrbs: 0,
        orbsDestroyedInLevel: 0,
        score: 0,
        gameTime: 0,
        boss: null,
        darkOrbs: [],
        projectiles: [],
        powerUps: [],
        particles: [],
        impactEffects: [],
        laserBeams: [],
        isDamaged: false,
        damageTimer: 0,
        backgroundShake: 0,
      });
    },
    
    takeDamage: () => {
      const { health, hasShield, isDying, magiOrb2Active, magiOrb5HP, spatialRelocationCooldown } = get();
      
      if (isDying) return;
      
      if (magiOrb2Active) {
        return;
      }
      
      if (hasShield) {
        set({ hasShield: false });
        return;
      }
      
      const getEquippedMagiOrb = (): string => {
        try {
          const stored = localStorage.getItem("orblitz_shop");
          if (stored) {
            const data = JSON.parse(stored);
            return data.equippedMagiOrb || "none";
          }
        } catch {}
        return "none";
      };
      const hasMagiOrb5Equipped = getEquippedMagiOrb() === "magi_orb_5";
      
      if (hasMagiOrb5Equipped && magiOrb5HP > 0) {
        get().damageMagiOrb5();
        get().triggerBackgroundShake();
        return;
      }
      
      const newHealth = health - 1;
      if (newHealth <= 0) {
        get().triggerDeath();
      } else {
        set({ health: newHealth, isDamaged: true, damageTimer: 0.3 });
        get().triggerBackgroundShake();
        
        const getEquippedDefenses = (): [DefenseType, DefenseType] => {
          try {
            const stored = localStorage.getItem("orblitz_shop");
            if (stored) {
              const data = JSON.parse(stored);
              return data.equippedDefenses || ["none", "none"];
            }
          } catch {}
          return ["none", "none"];
        };
        const equippedDefenses = getEquippedDefenses();
        const hasSpatialRelocation = equippedDefenses[0] === "spatial_relocation" || equippedDefenses[1] === "spatial_relocation";
        
        if (hasSpatialRelocation) {
          get().useSpatialRelocation();
        }
      }
    },
    
    triggerDeath: () => {
      set({ isDying: true, deathTimer: 1.5, health: 0 });
    },
    
    teleportPlayer: (position: [number, number, number]) => {
      const maxDist = 6;
      const dist = Math.sqrt(position[0] * position[0] + position[1] * position[1]);
      let clampedPos: [number, number, number] = position;
      if (dist > maxDist) {
        const scale = maxDist / dist;
        clampedPos = [position[0] * scale, position[1] * scale, 0];
      }
      set({ playerPosition: clampedPos });
    },
    
    registerMissedShot: () => {
      const { gameMode, phase } = get();
      if (gameMode === "gauntlet" && phase === "playing") {
        get().endGame();
      }
    },
    
    incrementGauntletOrbs: () => {
      const { gameMode, gauntletOrbsDestroyed } = get();
      if (gameMode === "gauntlet") {
        set({ gauntletOrbsDestroyed: gauntletOrbsDestroyed + 1 });
      }
    },
    
    updateDamageTimer: (delta) => {
      const { isDamaged, damageTimer } = get();
      if (!isDamaged) return;

      const newTimer = damageTimer - delta;
      if (newTimer <= 0) {
        set({ isDamaged: false, damageTimer: 0 });
      } else {
        set({ damageTimer: newTimer });
      }
    },
    
    updateDeathTimer: (delta) => {
      const { isDying, deathTimer } = get();
      if (!isDying) return;
      
      const newTimer = deathTimer - delta;
      if (newTimer <= 0) {
        get().endGame();
      } else {
        set({ deathTimer: newTimer });
      }
    },
    
    heal: () => {
      const { health, maxHealth } = get();
      const newHealth = Math.min(health + 1, maxHealth);
      // Healing off last HP clears the persistent low-health effects immediately
      const clearDamage = (health === 1 && newHealth > 1)
        ? { isDamaged: false, damageTimer: 0, backgroundShake: 0 }
        : {};
      set({ health: newHealth, ...clearDamage });
    },
    
    activateShield: () => set({ hasShield: true }),
    
    activateChargeBeam: () => set({ 
      hasChargeBeam: true,
      chargeBeamTimer: 10,
    }),
    
    activateDistort: () => set({ 
      hasDistort: true,
      distortCooldown: 0,
    }),
    
    activateDoubleCoins: () => set({ 
      hasDoubleCoins: true,
      doubleCoinsTimer: 10,
    }),
    
    activateRapidFire: () => set({ 
      hasRapidFire: true,
      rapidFireTimer: 10,
    }),
    
    setSelectedWeapon: (weapon) => set({ selectedWeapon: weapon }),
    
    fireOrbaniteBeam: (direction) => {
      const { orbaniteBeamCooldown, orbaniteBeamMaxCooldown } = get();
      if (orbaniteBeamCooldown > 0) return;
      
      const len = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
      const normDir: [number, number, number] = [
        direction[0] / len * 20,
        direction[1] / len * 20,
        direction[2] / len * 20,
      ];
      
      set((state) => ({
        orbaniteBeamCooldown: orbaniteBeamMaxCooldown,
        selectedWeapon: 'normal',
        laserBeams: [...state.laserBeams, {
          id: `laser-${Date.now()}`,
          start: [0, 0, 0],
          end: normDir,
          timer: 0.5,
        }],
      }));
      
      get().triggerBackgroundPulse();
    },
    
    activateDistortField: () => {
      const { distortCooldown, hasDistort, distortMaxCooldown } = get();
      if (!hasDistort || distortCooldown > 0) return;
      
      set({
        distortActive: true,
        distortTimer: 5,
        distortCooldown: distortMaxCooldown,
        selectedWeapon: 'normal',
      });
      
      get().freezeAllOrbs();
      get().triggerBackgroundPulse();
    },
    
    consumeShield: () => set({ hasShield: false }),
    
    updateChargeBeamTimer: (delta) => {
      const { chargeBeamTimer, hasChargeBeam } = get();
      if (!hasChargeBeam) return;
      
      const newTimer = chargeBeamTimer - delta;
      if (newTimer <= 0) {
        set({ hasChargeBeam: false, chargeBeamTimer: 0 });
      } else {
        set({ chargeBeamTimer: newTimer });
      }
    },
    
    updateOrbaniteBeamCooldown: (delta) => {
      const { orbaniteBeamCooldown } = get();
      if (orbaniteBeamCooldown <= 0) return;
      set({ orbaniteBeamCooldown: Math.max(0, orbaniteBeamCooldown - delta) });
    },
    
    updateDistortCooldown: (delta) => {
      const { distortCooldown } = get();
      if (distortCooldown <= 0) return;
      set({ distortCooldown: Math.max(0, distortCooldown - delta) });
    },
    
    updateTeletransferCooldown: (delta) => {
      const { teletransferCooldown } = get();
      if (teletransferCooldown <= 0) return;
      set({ teletransferCooldown: Math.max(0, teletransferCooldown - delta) });
    },
    
    updatePulseShieldCooldown: (delta) => {
      const { pulseShieldCooldown, pulseShieldActive, pulseShieldTimer } = get();
      if (pulseShieldCooldown > 0) {
        set({ pulseShieldCooldown: Math.max(0, pulseShieldCooldown - delta) });
      }
      if (pulseShieldActive) {
        const newTimer = pulseShieldTimer - delta;
        if (newTimer <= 0) {
          set({ pulseShieldActive: false, pulseShieldTimer: 0 });
        } else {
          set({ pulseShieldTimer: newTimer });
        }
      }
    },
    
    activatePulseShield: () => {
      const { pulseShieldCooldown, pulseShieldMaxCooldown, darkOrbs } = get();
      if (pulseShieldCooldown > 0) return;
      
      const playerPos = get().playerPosition;
      const reflectRadius = 7;
      const updatedOrbs = darkOrbs.map(orb => {
        const dx = orb.position[0] - playerPos[0];
        const dy = orb.position[1] - playerPos[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < reflectRadius && !orb.destroying) {
          const normX = dx / dist;
          const normY = dy / dist;
          return {
            ...orb,
            direction: [normX, normY, 0] as [number, number, number],
            speed: orb.speed * 1.5,
          };
        }
        return orb;
      });
      
      set({ 
        darkOrbs: updatedOrbs,
        pulseShieldCooldown: pulseShieldMaxCooldown,
        pulseShieldActive: true,
        pulseShieldTimer: 0.5,
      });
    },
    
    updateSpatialRelocationCooldown: (delta) => {
      const { spatialRelocationCooldown } = get();
      if (spatialRelocationCooldown <= 0) return;
      set({ spatialRelocationCooldown: Math.max(0, spatialRelocationCooldown - delta) });
    },
    
    useSpatialRelocation: () => {
      const { darkOrbs, playerPosition, impactEffects } = get();
      
      const oldPos = playerPosition;
      let bestPos: [number, number, number] = playerPosition;
      let maxMinDist = 0;
      
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * 4;
        const testPos: [number, number, number] = [
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          0
        ];
        
        let minDist = Infinity;
        for (const orb of darkOrbs) {
          if (orb.destroying) continue;
          const d = Math.sqrt(
            (testPos[0] - orb.position[0]) ** 2 + 
            (testPos[1] - orb.position[1]) ** 2
          );
          minDist = Math.min(minDist, d);
        }
        
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          bestPos = testPos;
        }
      }
      
      const now = Date.now();
      const departureEffect: ImpactEffect = {
        id: `relocation-depart-${now}`,
        position: oldPos,
        timer: 0.6,
        maxTimer: 0.6,
        seed: Math.random(),
      };
      const arrivalEffect: ImpactEffect = {
        id: `relocation-arrive-${now}`,
        position: bestPos,
        timer: 0.6,
        maxTimer: 0.6,
        seed: Math.random(),
      };
      
      set({ 
        playerPosition: bestPos,
        impactEffects: [...impactEffects, departureEffect, arrivalEffect],
      });
    },
    
    spawnDefenseOrbs: () => {
      const orbs = [];
      for (let i = 0; i < 5; i++) {
        orbs.push({
          id: `defense-orb-${i}-${Date.now()}`,
          angle: (i / 5) * Math.PI * 2,
          alive: true,
        });
      }
      set({ defenseOrbs: orbs });
    },
    
    updateDefenseOrbs: (delta) => {
      const { defenseOrbs } = get();
      if (defenseOrbs.length === 0) return;
      
      const rotationSpeed = 1.5;
      const updated = defenseOrbs.map(orb => ({
        ...orb,
        angle: orb.angle + delta * rotationSpeed,
      }));
      set({ defenseOrbs: updated });
    },
    
    destroyDefenseOrb: (id) => {
      const { defenseOrbs } = get();
      set({ defenseOrbs: defenseOrbs.filter(o => o.id !== id) });
    },
    
    useTeletransfer: () => {
      const { teletransferCooldown, teletransferMaxCooldown } = get();
      if (teletransferCooldown > 0) return;
      set({ teletransferCooldown: teletransferMaxCooldown });
    },
    
    updateDistortTimer: (delta) => {
      const { distortActive, distortTimer } = get();
      if (!distortActive) return;
      
      const newTimer = distortTimer - delta;
      if (newTimer <= 0) {
        set({ distortActive: false, distortTimer: 0 });
        get().unfreezeAllOrbs();
      } else {
        set({ distortTimer: newTimer });
      }
    },
    
    updateDoubleCoinsTimer: (delta) => {
      const { hasDoubleCoins, doubleCoinsTimer } = get();
      if (!hasDoubleCoins) return;
      
      const newTimer = doubleCoinsTimer - delta;
      if (newTimer <= 0) {
        set({ hasDoubleCoins: false, doubleCoinsTimer: 0 });
      } else {
        set({ doubleCoinsTimer: newTimer });
      }
    },
    
    updateRapidFireTimer: (delta) => {
      const { hasRapidFire, rapidFireTimer } = get();
      if (!hasRapidFire) return;
      
      const newTimer = rapidFireTimer - delta;
      if (newTimer <= 0) {
        set({ hasRapidFire: false, rapidFireTimer: 0 });
      } else {
        set({ rapidFireTimer: newTimer });
      }
    },
    
    freezeAllOrbs: () => set((state) => ({
      darkOrbs: state.darkOrbs.map((orb) => ({ ...orb, frozen: true }))
    })),
    
    unfreezeAllOrbs: () => set((state) => ({
      darkOrbs: state.darkOrbs.map((orb) => ({ ...orb, frozen: false }))
    })),
    
    addDarkOrb: (orb) => set((state) => ({ 
      darkOrbs: [...state.darkOrbs, orb] 
    })),
    
    removeDarkOrb: (id) => set((state) => ({ 
      darkOrbs: state.darkOrbs.filter((o) => o.id !== id) 
    })),
    
    updateDarkOrbs: (orbs) => set({ darkOrbs: orbs }),
    
    markOrbDestroying: (id) => {
      set((state) => ({
        darkOrbs: state.darkOrbs.map((o) => 
          o.id === id ? { ...o, destroying: true, destroyTimer: 0.6 } : o
        )
      }));
      get().triggerBackgroundPulse();
    },
    
    addProjectile: (projectile) => set((state) => ({ 
      projectiles: [...state.projectiles, projectile] 
    })),
    
    removeProjectile: (id) => set((state) => ({ 
      projectiles: state.projectiles.filter((p) => p.id !== id) 
    })),
    
    updateProjectiles: (projectiles) => set({ projectiles }),
    
    addPowerUp: (powerUp) => set((state) => ({ 
      powerUps: [...state.powerUps, powerUp] 
    })),
    
    removePowerUp: (id) => set((state) => ({ 
      powerUps: state.powerUps.filter((p) => p.id !== id) 
    })),
    
    markPowerUpCollected: (id) => set((state) => ({
      powerUps: state.powerUps.map((p) =>
        p.id === id ? { ...p, collected: true, collectTimer: 0.4 } : p
      )
    })),
    
    updatePowerUps: (powerUps) => set({ powerUps }),
    
    addParticles: (particles) => set((state) => ({ 
      particles: [...state.particles, ...particles] 
    })),
    
    updateParticles: (particles) => set({ particles }),
    
    addImpactEffect: (effect) => set((state) => ({
      impactEffects: [...state.impactEffects, effect]
    })),
    
    updateImpactEffects: (effects) => set({ impactEffects: effects }),
    
    addLaserBeam: (beam) => set((state) => ({
      laserBeams: [...state.laserBeams, beam]
    })),
    
    updateLaserBeams: (beams) => set({ laserBeams: beams }),
    
    triggerBackgroundPulse: () => set({ backgroundPulse: 1 }),
    triggerBackgroundShake: () => set({ backgroundShake: 0.5 }),
    
    updateBackgroundEffects: (delta) => {
      const { backgroundPulse, backgroundShake, health, phase } = get();
      // At last HP while actively playing, keep a baseline shake so distortion/aberration persist
      const minShake = (health === 1 && phase === "playing") ? 0.22 : 0;
      set({
        backgroundPulse: Math.max(0, backgroundPulse - delta * 2),
        backgroundShake: Math.max(minShake, backgroundShake - delta * 2),
      });
    },
    
    triggerStagger: () => set({ isStaggered: true, staggerTimer: 2 }),
    
    updateStaggerTimer: (delta) => {
      const { isStaggered, staggerTimer } = get();
      if (!isStaggered) return;
      const newTimer = staggerTimer - delta;
      if (newTimer <= 0) {
        set({ isStaggered: false, staggerTimer: 0 });
      } else {
        set({ staggerTimer: newTimer });
      }
    },
    
    addScore: (points) => {
      const { gameMode } = get();
      if (gameMode === "survival") {
        return;
      }
      if (gameMode === "chill") {
        set((state) => ({ score: state.score + 1 }));
        return;
      }
      set((state) => ({ score: state.score + points }));
    },
    
    addStars: (amount) => set((state) => ({ 
      stars: state.stars + amount 
    })),
    
    addOrbDestroyStars: () => {
      useShop.getState().addCoins(5);
    },

    addBossDefeatStars: () => {
      useShop.getState().addCoins(50);
    },
    
    updateGameTime: (delta) => {
      const { gameMode, gameTime } = get();
      const newGameTime = gameTime + delta;
      if (gameMode === "survival") {
        set({ gameTime: newGameTime, score: Math.floor(newGameTime) });
      } else {
        set({ gameTime: newGameTime });
      }
    },
    
    updateDifficulty: () => {
      const { gameTime } = get();
      const newMultiplier = 1 + (gameTime / 30) * 0.5;
      const newSpawnRate = Math.max(0.5, 2 - (gameTime / 60));
      set({ 
        difficultyMultiplier: Math.min(newMultiplier, 5),
        spawnRate: newSpawnRate,
      });
    },
    
    updateTimeDifficulty: () => {
      const { gameMode, gameTime, lastDifficultyTick, timeDifficultyBonus, distortActive } = get();
      if (gameMode !== "arcade" && gameMode !== "survival") return;
      if (distortActive) return;
      
      const tickInterval = 10;
      if (gameTime - lastDifficultyTick >= tickInterval) {
        const newBonus = timeDifficultyBonus + 0.5;
        set({
          timeDifficultyBonus: newBonus,
          lastDifficultyTick: gameTime,
        });
      }
    },
    
    updateSurvivalBossTimer: (delta) => {
      const { gameMode, boss, survivalBossTimer, survivalBossPending, darkOrbs } = get();
      if (gameMode !== "survival" || boss) return;
      
      const newTimer = survivalBossTimer + delta;
      if (newTimer >= 60 && !survivalBossPending) {
        set({ survivalBossPending: true });
      }
      
      if (survivalBossPending && darkOrbs.filter(o => !o.destroying).length === 0) {
        get().spawnSurvivalBoss();
      }
      
      set({ survivalBossTimer: newTimer });
    },
    
    spawnSurvivalBoss: () => {
      const bossTypes: BossType[] = ["bird", "star", "arrow", "triangle", "trapezoid", "cube", "cloud", "circle", "tentacle", "monster"];
      const bossHPs: Record<BossType, number> = {
        bird: 100, star: 100, arrow: 100, triangle: 100, trapezoid: 100, cube: 100, cloud: 100, circle: 100, tentacle: 100, monster: 100,
      };
      const randomIndex = Math.floor(Math.random() * bossTypes.length);
      const bossType = bossTypes[randomIndex];
      const bossHP = bossHPs[bossType];
      
      const bossInit: Boss = {
        id: `boss-${Date.now()}`,
        position: bossType === "cloud" ? [0, 6, 0] : [8, 0, 0],
        health: bossHP,
        maxHealth: bossHP,
        angle: 0,
        dodging: false,
        dodgeTimer: 0,
        attackTimer: 2,
        bossType,
        visible: bossType !== "star",
        visibleTimer: bossType === "star" ? 5 : 0,
        phase: 0,
        phaseTimer: bossType === "triangle" ? 2 + Math.random() * 2 : 0,
        floatTimer: bossType === "triangle" ? 2 + Math.random() * 2 : 0,
        pieces: bossType === "arrow" ? Array.from({length: 5}, (_, i) => ({
          id: `piece-${i}`,
          position: [0, 0, 0] as [number, number, number],
          launched: false,
        })) : undefined,
        circleOrbs: bossType === "circle" ? Array.from({length: 8}, (_, i) => ({
          id: `circle-orb-${i}`,
          angle: (i / 8) * Math.PI * 2,
          distance: 2.5,
          destroyed: false,
        })) : undefined,
        spinSpeed: bossType === "circle" ? 1 : undefined,
      };
      
      set({ 
        boss: bossInit, 
        survivalBossPending: false,
        survivalBossTimer: 0,
      });
    },
    
    // Magi-Orb actions
    initMagiOrbs: () => {
      const { maxHealth } = get();
      set({
        magiOrb1Active: false,
        magiOrb2Active: false,
        magiOrb2Cooldown: 0,
        magiOrb3Cooldown: 0,
        magiOrb4Active: false,
        magiOrb4Cooldown: 0,
        magiOrb4Timer: 0,
        magiOrb5HP: 5,
        magiOrb6Timer: 0,
        magiOrb7Active: false,
        magiOrb7Cooldown: 0,
        magiOrb7Timer: 0,
        magiOrb8Position: [Math.random() * 6 - 3, Math.random() * 4 - 2, 0] as [number, number, number],
        magiOrb8HP: maxHealth,
        magiOrb9Timer: 0,
      });
    },
    
    activateMagiOrb2: () => {
      const { magiOrb2Cooldown } = get();
      if (magiOrb2Cooldown > 0) return;
      set({
        magiOrb2Active: true,
        magiOrb2Cooldown: 15,
      });
      setTimeout(() => {
        set({ magiOrb2Active: false });
      }, 5000);
    },
    
    activateMagiOrb3: () => {
      const { magiOrb3Cooldown, playerPosition, addProjectile } = get();
      if (magiOrb3Cooldown > 0) return;
      
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
        const projectile: Projectile = {
          id: `magi3-proj-${Date.now()}-${i}`,
          position: [...playerPosition] as [number, number, number],
          direction: [Math.cos(angle), Math.sin(angle), 0],
          isCharged: true,
          size: 0.2,
          type: "homing",
          hitCount: 1,
          homing: true,
          noMissTracking: true,
        };
        addProjectile(projectile);
      }
      set({ magiOrb3Cooldown: 10 });
    },
    
    activateMagiOrb4: (direction: number) => {
      const { magiOrb4Cooldown } = get();
      if (magiOrb4Cooldown > 0) return;
      set({
        magiOrb4Active: true,
        magiOrb4Cooldown: 15,
        magiOrb4Timer: 10,
        magiOrb4Direction: direction,
      });
    },
    
    activateMagiOrb7: () => {
      const { magiOrb7Cooldown, darkOrbs } = get();
      if (magiOrb7Cooldown > 0) return;
      
      const slowedOrbs = darkOrbs.map(orb => ({
        ...orb,
        speed: orb.speed * 0.25,
      }));
      
      set({
        magiOrb7Active: true,
        magiOrb7Cooldown: 15,
        magiOrb7Timer: 5,
        darkOrbs: slowedOrbs,
      });
    },
    
    updateMagiOrbTimers: (delta: number) => {
      const state = get();
      const updates: Partial<MagicOrbState> = {};
      
      if (state.magiOrb2Cooldown > 0) {
        updates.magiOrb2Cooldown = Math.max(0, state.magiOrb2Cooldown - delta);
      }
      if (state.magiOrb3Cooldown > 0) {
        updates.magiOrb3Cooldown = Math.max(0, state.magiOrb3Cooldown - delta);
      }
      if (state.magiOrb4Cooldown > 0) {
        updates.magiOrb4Cooldown = Math.max(0, state.magiOrb4Cooldown - delta);
      }
      if (state.magiOrb4Timer > 0) {
        updates.magiOrb4Timer = Math.max(0, state.magiOrb4Timer - delta);
        if (updates.magiOrb4Timer === 0) {
          updates.magiOrb4Active = false;
        }
      }
      if (state.magiOrb7Cooldown > 0) {
        updates.magiOrb7Cooldown = Math.max(0, state.magiOrb7Cooldown - delta);
      }
      if (state.magiOrb7Timer > 0) {
        updates.magiOrb7Timer = Math.max(0, state.magiOrb7Timer - delta);
        if (updates.magiOrb7Timer === 0) {
          updates.magiOrb7Active = false;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    },
    
    damageMagiOrb5: () => {
      const { magiOrb5HP } = get();
      if (magiOrb5HP > 0) {
        set({ magiOrb5HP: magiOrb5HP - 1 });
        return true;
      }
      return false;
    },
    
    damageMagiOrb8: () => {
      const { magiOrb8HP } = get();
      if (magiOrb8HP > 0) {
        set({ magiOrb8HP: magiOrb8HP - 1 });
        if (magiOrb8HP - 1 <= 0) {
          set({ magiOrb8Position: null });
        }
      }
    },
  }))
);
