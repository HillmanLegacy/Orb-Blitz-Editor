import { Suspense, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, MovementPattern } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { BossVisual } from "./BossVisual";
import { FireExplosionVFX } from "./FireExplosionVFX";
import { BOSS_DEFEAT_DURATION, BOSS_DEFEAT_SIZE_SCALE } from "./BossDefeatPalette";
import { StarBossTeleportVFX, StarTeleportVFXState } from "./StarBossTeleportVFX";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { FlameAura } from "./FlameAura";
import { getBackwardFlameAuraRotation } from "./Projectiles";
import { getPerspectiveViewAtPlane } from "@/game-runtime/EnemySpawnConfig";
import {
  canStartFireBossAmbush,
  createFireBossAmbushImpact,
  FIRE_BOSS_AMBUSH_CHARGE_DURATION,
  FIRE_BOSS_AMBUSH_DASH_DURATION,
  FIRE_BOSS_AMBUSH_INITIAL_DELAY,
  FIRE_BOSS_AMBUSH_IMPACT_SCALE,
  FIRE_BOSS_AMBUSH_MAX_USES,
  FIRE_BOSS_AMBUSH_REPOSITION_DURATION,
  FIRE_BOSS_AMBUSH_REPOSITION_SPEED,
  FIRE_BOSS_AMBUSH_RECOVERY_DURATION,
  getFireBossAmbushChargeProgress,
  getFireBossAmbushChargeSpeedMultiplier,
  getFireBossAmbushDashDestination,
  getFireBossAmbushDashProgress,
  getFireBossAmbushImpactProgress,
  getFireBossAmbushTarget,
  shouldTriggerFireBossAmbushHit,
  type FireBossAmbushPhase,
} from "@/game-runtime/FireBossAmbush";


const MIN_PLAYER_DISTANCE = 7;
const HARD_COLLISION_RADIUS = 4;
const DODGE_DISTANCE = 3;
const DODGE_SPEED = 8;

interface BossConfig {
  projectileCount: number;
  movementStyle: "drift" | "teleport" | "dash" | "perimeter" | "figure8" | "bounce" | "spiral" | "wave" | "chaos" | "orbit_player" | "shadow";
}

const BOSS_CONFIGS: Record<string, BossConfig> = {
  circle: { projectileCount: 1, movementStyle: "orbit_player" },
  star: { projectileCount: 2, movementStyle: "teleport" },
  triangle: { projectileCount: 3, movementStyle: "dash" },
  trapezoid: { projectileCount: 4, movementStyle: "perimeter" },
  cube: { projectileCount: 5, movementStyle: "figure8" },
  cloud: { projectileCount: 6, movementStyle: "bounce" },
  arrow: { projectileCount: 7, movementStyle: "spiral" },
  tentacle: { projectileCount: 8, movementStyle: "wave" },
  monster: { projectileCount: 9, movementStyle: "shadow" },
};

const getAttackInterval = (projectileCount: number): number => {
  if (projectileCount > 5) {
    return 0.5 + Math.random() * 0.8;
  }
  return 0.5 + Math.random() * 3.0;
};

const getAttackDelay = (projectileCount: number): number => {
  if (projectileCount > 2) {
    return 3.0;
  }
  return 0;
};

export function Boss() {
  // Narrow selectors — only re-render when these rarely-changing values change.
  // projectiles / darkOrbs are NOT subscribed here because they update every frame
  // and would cause Boss to re-render 60×/sec, flooding React reconciliation.
  const boss          = useMagicOrb(s => s.boss);
  const phase         = useMagicOrb(s => s.phase);
  const gameMode      = useMagicOrb(s => s.gameMode);
  const playerPosition = useMagicOrb(s => s.playerPosition);

  const meshRef           = useRef<THREE.Group>(null);
  const dodgeTimerRef     = useRef(0);
  const dodgeDirRef       = useRef<[number, number]>([0, 0]);
  const phaseTimerRef     = useRef(0);
  const attackBurstRef    = useRef(0);
  const fireOrbitAngleRef = useRef(0);
  // Local position ref — updated every frame so the lerp start is always fresh,
  // even on frames where we skip the Zustand updateBoss call.
  const bossPosRef           = useRef<[number, number, number]>([0, 0, 0]);
  // Local angle ref — accumulates at 0.5 rad/s every frame so boss.angle in
  // Zustand (written only on throttled frames) never under-accumulates.
  const localAngleRef        = useRef<number | null>(null);
  // Local attack-timer ref — tracks the countdown each frame without depending
  // on a potentially-stale Zustand boss.attackTimer value.
  const localAttackTimerRef  = useRef<number | null>(null);
  // Frame counter used to throttle how often we push state to Zustand.
  const frameCountRef        = useRef(0);
  const offScreenTimerRef    = useRef(2.5);
  // Destroy-sequence coordination refs
  const destroyInitRef  = useRef(false); // true once SFX fires (frame 0 of destroy)
  const sfxDoneRef      = useRef(false); // true when boss_explosion.wav onended fires
  const timerDoneRef    = useRef(false); // true when 3.5 s destroyTimer expires
  const destroyAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      const audio = destroyAudioRef.current;
      if (!audio) return;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      destroyAudioRef.current = null;
    };
  }, []);

  const resetFireAmbush = () => {
    fireBossIdRef.current = null;
    fireAmbushPhaseRef.current = "idle";
    fireAmbushTimerRef.current = FIRE_BOSS_AMBUSH_INITIAL_DELAY;
    fireAmbushUsesRef.current = 0;
    fireAmbushImpactRef.current = null;
    fireAmbushImpactTriggeredRef.current = false;
    fireAmbushPlayerProgressRef.current = 0;
  };

  // ── FireBoss (circle) strike-and-retreat state machine ──────────────────────
  const fireMovePhaseRef = useRef<'entering' | 'waiting' | 'exiting'>('entering');
  const fireTargetRef    = useRef<[number, number]>([0, 0]);
  const fireOffscreenRef = useRef<[number, number]>([18, 0]);
  const fireWaitTimerRef = useRef(3.0);
  const fireInitRef      = useRef(false);
  const fireShotTimerRef = useRef(0); // countdown until next shot while moving
  const fireBossIdRef    = useRef<string | null>(null);
  const fireAmbushPhaseRef = useRef<FireBossAmbushPhase>("idle");
  const fireAmbushTimerRef = useRef(FIRE_BOSS_AMBUSH_INITIAL_DELAY);
  const fireAmbushUsesRef = useRef(0);
  const fireAmbushLaunchPointRef = useRef<[number, number]>([0, 0]);
  const fireAmbushDashStartRef = useRef<[number, number]>([0, 0]);
  const fireAmbushDashDestinationRef = useRef<[number, number]>([0, 0]);
  const fireAmbushPlayerTargetRef = useRef<[number, number]>([0, 0]);
  const fireAmbushPlayerProgressRef = useRef(0);
  const fireAmbushImpactTriggeredRef = useRef(false);
  const fireAmbushImpactIdRef = useRef(0);
  const fireAmbushImpactRef = useRef<ReturnType<typeof createFireBossAmbushImpact> | null>(null);

  // ── StarBoss teleport state machine ─────────────────────────────────────────
  const starTeleportPhaseRef    = useRef<'idle' | 'departing' | 'transiting' | 'arriving'>('idle');
  const starTeleportTimerRef    = useRef(0);
  const starTeleportCooldownRef = useRef(3 + Math.random() * 4); // 3–7 s initial
  const starTeleportTargetRef   = useRef<[number, number]>([0, 0]);
  const starTeleportVFXRef      = useRef<StarTeleportVFXState>({
    departurePos:      [0, 0, 0],
    departureProgress: 0,
    arrivalPos:        [0, 0, 0],
    arrivalProgress:   0,
  });

  const resetStarTeleportVFX = () => {
    starTeleportPhaseRef.current = "idle";
    starTeleportTimerRef.current = 0;
    starTeleportCooldownRef.current = 3 + Math.random() * 4;
    starTeleportVFXRef.current.departureProgress = 0;
    starTeleportVFXRef.current.arrivalProgress = 0;
  };

  // ── TriangleBoss (crystal) movement + burst-fire state ──────────────────────
  const triPatternRef       = useRef(0);              // active movement pattern: 0 | 1 | 2
  const triPatternTimerRef  = useRef(0);              // seconds until next pattern switch
  const triSubAngleRef      = useRef(0);              // sub-motion angle accumulator
  const triBurstCountRef    = useRef(0);              // projectiles left in current burst
  const triBurstTimerRef    = useRef(0);              // seconds until next burst shot
  const triBurstCooldownRef = useRef(1.5 + Math.random() * 2.0); // seconds until first burst

  // ── MonsterBoss (shadow) movement + attack state ─────────────────────────────
  // Movement cycles through 4 phases: stalk → charge → evade → vortex
  const monsterPhaseRef         = useRef<'stalk' | 'charge' | 'evade' | 'vortex'>('stalk');
  const monsterPhaseTimerRef    = useRef(4.0 + Math.random() * 2.0);
  const monsterOrbitAngleRef    = useRef(Math.random() * Math.PI * 2);
  const monsterChargeTargetRef  = useRef<[number, number]>([0, 0]);
  const monsterEvadeTargetRef   = useRef<[number, number]>([8, 0]);
  const monsterEvadeSetRef      = useRef(false); // true once evade target is captured for current evade phase
  // Attack: 5 modes cycling 0–3 (mode 4 = rage, triggered by low health)
  const monsterAttackModeRef    = useRef(0);
  const monsterBurstCountRef    = useRef(0);
  const monsterBurstTimerRef    = useRef(0);
  const monsterBurstCooldownRef = useRef(2.0 + Math.random() * 1.5);

  const keepDistanceFromPlayer = (
    currentPos: [number, number, number],
    playerPos: [number, number, number],
    minDist: number,
    delta: number
  ): [number, number, number] => {
    const dx = currentPos[0] - playerPos[0];
    const dy = currentPos[1] - playerPos[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < minDist && dist > 0.01) {
      const targetDist = minDist + 0.5;
      const targetX = playerPos[0] + (dx / dist) * targetDist;
      const targetY = playerPos[1] + (dy / dist) * targetDist;
      const pushSpeed = dist < HARD_COLLISION_RADIUS ? 12 : 6;
      const lerpFactor = Math.min(1, delta * pushSpeed);
      return [
        currentPos[0] + (targetX - currentPos[0]) * lerpFactor,
        currentPos[1] + (targetY - currentPos[1]) * lerpFactor,
        0
      ];
    }
    
    if (dist <= 0.01) {
      return [playerPos[0] + minDist + 0.5, playerPos[1], 0];
    }
    
    return currentPos;
  };
  
  const checkIncomingProjectiles = (bossPos: [number, number, number]): { threatened: boolean; dodgeDir: [number, number] } => {
    // Read projectiles imperatively — avoids a reactive subscription that would
    // force Boss to re-render every time a projectile moves (60×/sec).
    const { projectiles: liveProjectiles } = useMagicOrb.getState();
    let threatened = false;
    let avgDodgeX = 0;
    let avgDodgeY = 0;
    let threatCount = 0;
    
    for (const proj of liveProjectiles) {
      const liveProjectile = gameRuntime.projectiles.get(proj.id);
      const position = liveProjectile?.position ?? proj.position;
      const direction = liveProjectile?.direction ?? proj.direction;
      const dx = bossPos[0] - position[0];
      const dy = bossPos[1] - position[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < DODGE_DISTANCE) {
        const dotProduct = direction[0] * -dx + direction[1] * -dy;
        if (dotProduct > 0) {
          threatened = true;
          threatCount++;
          const perpX = -direction[1];
          const perpY = direction[0];
          avgDodgeX += perpX;
          avgDodgeY += perpY;
        }
      }
    }
    
    if (threatCount > 0) {
      const len = Math.sqrt(avgDodgeX * avgDodgeX + avgDodgeY * avgDodgeY);
      if (len > 0.01) {
        avgDodgeX /= len;
        avgDodgeY /= len;
      }
    }
    
    return { threatened, dodgeDir: [avgDodgeX, avgDodgeY] };
  };
  
  useFrame((state, delta) => {
    gameRuntime.pipeline.enter("boss");
    if (!boss) {
      resetStarTeleportVFX();
      resetFireAmbush();
      if (meshRef.current) meshRef.current.visible = true;
      gameRuntime.boss.reset();
      return;
    }
    
    const time = state.clock.getElapsedTime();
    
    if (boss.destroying) {
      // ── Frame 0 of destroy: play SFX the instant the visual explosion begins ──
      if (!destroyInitRef.current) {
        destroyInitRef.current = true;
        sfxDoneRef.current     = false;
        timerDoneRef.current   = false;

        const { isMuted } = useAudio.getState();
        if (!isMuted) {
          const audio = new Audio('/sounds/boss_explosion.wav');
          destroyAudioRef.current = audio;
          audio.volume = 0.85;
          const onSfxDone = () => {
            if (sfxDoneRef.current) return;
            sfxDoneRef.current = true;
            if (destroyAudioRef.current === audio) destroyAudioRef.current = null;
            // If the 3.5 s timer already expired, complete the level now
            if (timerDoneRef.current) useMagicOrb.getState().completeLevel();
          };
          audio.onended = onSfxDone;
          audio.onerror = onSfxDone;   // fail-safe
          audio.play().catch(onSfxDone); // fail-safe (autoplay blocked)
        } else {
          sfxDoneRef.current = true;   // muted → treat as instantly done
        }
      }

      // ── Count down the 3.5 s visual explosion timer ───────────────────────
      const newTimer = (boss.destroyTimer || 0) - delta;
      if (newTimer > 0) {
        useMagicOrb.getState().updateBoss({ ...boss, destroyTimer: newTimer });
      } else if (!timerDoneRef.current) {
        timerDoneRef.current = true;

        // Reset per-boss local accumulators so they re-initialise on next spawn.
        bossPosRef.current          = [0, 0, 0];
        localAngleRef.current       = null;
        localAttackTimerRef.current = null;
        frameCountRef.current       = 0;
        fireMovePhaseRef.current    = 'entering';
        fireInitRef.current         = false;
        fireShotTimerRef.current    = 0;
        resetFireAmbush();
        triPatternRef.current       = 0;
        triPatternTimerRef.current  = 0;
        triSubAngleRef.current      = 0;
        triBurstCountRef.current    = 0;
        triBurstTimerRef.current    = 0;
        triBurstCooldownRef.current = 1.5 + Math.random() * 2.0;
        useMagicOrb.setState({ boss: null });

        if (gameMode === "survival") {
          useMagicOrb.setState({ survivalBossTimer: 0, survivalBossPending: false, bossDefeating: false });
        } else {
          // Advance to level complete only after BOTH timer and SFX are done
          if (sfxDoneRef.current) {
            useMagicOrb.getState().completeLevel();
          }
          // else: onSfxDone callback above will fire completeLevel() when audio ends
        }
      }
      return;
    }

    // Boss is alive (not destroying) — reset refs so next destroy sequence is fresh
    destroyInitRef.current = false;
    timerDoneRef.current   = false;
    
    if (phase !== "playing") return;
    if (!meshRef.current) return;

    if (fireBossIdRef.current !== boss.id) {
      resetFireAmbush();
      fireBossIdRef.current = boss.id;
    }

    if (fireAmbushImpactRef.current) {
      const nextTimer = fireAmbushImpactRef.current.timer - delta;
      fireAmbushImpactRef.current = nextTimer > 0
        ? { ...fireAmbushImpactRef.current, timer: nextTimer }
        : null;
    }

    // Seed bossPosRef from Zustand on the first frame after each spawn.
    // After that it is kept in sync imperatively every frame, making the
    // lerp start independent of whether we called updateBoss last frame.
    if (bossPosRef.current[0] === 0 && bossPosRef.current[1] === 0 &&
        (boss.position[0] !== 0 || boss.position[1] !== 0)) {
      bossPosRef.current = [boss.position[0], boss.position[1], boss.position[2] || 0];
    }
    gameRuntime.boss.beginFrame(boss.id, bossPosRef.current);
    // Derive a single local angle value seeded from Zustand on first frame.
    // All switch cases and the outer increment read this so angle never
    // under-accumulates on frames where the Zustand write is throttled.
    const localAngle = localAngleRef.current ?? boss.angle;

    // Hoist bossType early — shield and movement both need it
    const bossType = boss.bossType || "circle";
    const config   = BOSS_CONFIGS[bossType] || BOSS_CONFIGS.circle;

    const playerX = playerPosition[0];
    const playerY = playerPosition[1];
    
    const { threatened, dodgeDir } = checkIncomingProjectiles(bossPosRef.current);
    
    if (threatened && dodgeTimerRef.current <= 0) {
      dodgeTimerRef.current = 0.3;
      dodgeDirRef.current = dodgeDir;
    }
    
    if (dodgeTimerRef.current > 0) {
      dodgeTimerRef.current -= delta;
    }
    
    const fireProjectiles = (bossPos: [number, number, number], attackTimer: number, burstCount: number): { timer: number; burst: number } => {
      let newAttackTimer = attackTimer - delta;
      let newBurstCount = burstCount;
      // Read imperatively — avoids reactive subscription on darkOrbs (updates every frame).
      const { darkOrbs: liveDarkOrbs, spawnBossOrb } = useMagicOrb.getState();
      const currentOrbs = liveDarkOrbs.filter(o => o.isBossOrb && !o.destroying).length;
      const projectileCount = config.projectileCount;
      const patterns: MovementPattern[] = ["direct", "zigzag", "spiral", "wave", "homing"];
      
      if (newAttackTimer <= 0 && currentOrbs < 12) {
        const baseAngle = Math.atan2(playerY - bossPos[1], playerX - bossPos[0]);
        
        for (let i = 0; i < projectileCount; i++) {
          let angle: number;
          let pattern: MovementPattern;
          
          if (projectileCount === 1) {
            angle = baseAngle;
            pattern = "direct";
          } else if (projectileCount <= 3) {
            // Star boss (2 projectiles): wider spread so they never overlap.
            // Other bosses with ≤3: standard tight spread.
            const spread = bossType === "star" ? 1.2 : 0.3;
            angle = baseAngle + (i - (projectileCount - 1) / 2) * spread;
            pattern = "direct";
          } else if (projectileCount <= 5) {
            angle = baseAngle + (i - (projectileCount - 1) / 2) * (Math.PI * 2 / projectileCount);
            pattern = patterns[i % patterns.length];
          } else {
            angle = (i / projectileCount) * Math.PI * 2 + time;
            pattern = patterns[Math.floor(Math.random() * patterns.length)];
          }
          
          spawnBossOrb(bossPos, [Math.cos(angle), Math.sin(angle), 0], pattern);
        }
        
        newBurstCount++;
        
        const baseInterval = getAttackInterval(projectileCount);
        const delay = newBurstCount >= 2 ? getAttackDelay(projectileCount) : 0;
        newAttackTimer = baseInterval + delay;
        
        if (delay > 0) {
          newBurstCount = 0;
        }
      }
      return { timer: newAttackTimer, burst: newBurstCount };
    };
    
    let targetX = bossPosRef.current[0];
    let targetY = bossPosRef.current[1];
    let lerpSpeed = 2;
    let newBounceVelocity: [number, number] | undefined = boss.bounceVelocity;
    
    const playAreaWidth = 12;
    const playAreaHeight = 8;
    
    switch (config.movementStyle) {
      case "drift": {
        const driftSpeed = 0.3;
        const newAngle = localAngle + delta * driftSpeed;
        const driftX = 8 + Math.sin(time * 0.2) * 2;
        const driftY = 5 + Math.cos(time * 0.15) * 1.5;
        targetX = Math.sin(newAngle * 0.6) * driftX;
        targetY = Math.cos(newAngle * 0.4) * driftY + 2;
        lerpSpeed = 1.2;
        if (threatened) {
          targetX += dodgeDirRef.current[0] * 3;
          targetY += dodgeDirRef.current[1] * 3;
        }
        break;
      }
      case "teleport": {
        // ── Star Boss: HD VFX teleport with 3–7 s delay ──────────────────────
        const tvfx   = starTeleportVFXRef.current;
        const tPhase = starTeleportPhaseRef.current;

        if (tPhase === 'idle') {
          starTeleportCooldownRef.current -= delta;
          if (starTeleportCooldownRef.current <= 0 || threatened) {
            // Pick destination (player-relative, avoid overlapping MIN_PLAYER_DISTANCE)
            let tx: number, ty: number;
            let attempts = 0;
            do {
              const ang  = Math.random() * Math.PI * 2;
              const dist = 5 + Math.random() * 4;
              tx = Math.max(-playAreaWidth,  Math.min(playAreaWidth,  Math.cos(ang) * dist));
              ty = Math.max(-playAreaHeight + 2, Math.min(playAreaHeight, Math.sin(ang) * dist));
              attempts++;
            } while (
              Math.sqrt((tx - playerX) ** 2 + (ty - playerY) ** 2) < MIN_PLAYER_DISTANCE &&
              attempts < 8
            );
            starTeleportTargetRef.current = [tx, ty];
            // Kick off departure effect
            tvfx.departurePos      = [...bossPosRef.current] as [number, number, number];
            tvfx.departureProgress = 0.001;
            starTeleportPhaseRef.current = 'departing';
            starTeleportTimerRef.current = 0.55;
          }
          targetX   = bossPosRef.current[0];
          targetY   = bossPosRef.current[1];
          lerpSpeed = 0.5;

        } else if (tPhase === 'departing') {
          starTeleportTimerRef.current -= delta;
          tvfx.departureProgress = 1 - Math.max(0, starTeleportTimerRef.current) / 0.55;
          targetX   = bossPosRef.current[0];
          targetY   = bossPosRef.current[1];
          lerpSpeed = 0.5;
          if (starTeleportTimerRef.current <= 0) {
            // Brief invisible transit
            tvfx.departureProgress = 0;
            tvfx.arrivalProgress = 0;
            starTeleportPhaseRef.current = 'transiting';
            starTeleportTimerRef.current = 0.08;
            meshRef.current.visible = false;
            // Snap position now so it's ready for arrival
            const [atx, aty] = starTeleportTargetRef.current;
            bossPosRef.current = [atx, aty, 0];
            gameRuntime.boss.teleport(boss.id, bossPosRef.current);
          }

        } else if (tPhase === 'transiting') {
          starTeleportTimerRef.current -= delta;
          targetX   = bossPosRef.current[0];
          targetY   = bossPosRef.current[1];
          lerpSpeed = 0.5;
          if (starTeleportTimerRef.current <= 0) {
            const [atx, aty] = starTeleportTargetRef.current;
            tvfx.arrivalPos      = [atx, aty, 0];
            tvfx.arrivalProgress = 0.001;
            starTeleportPhaseRef.current = 'arriving';
            starTeleportTimerRef.current = 0.55;
            meshRef.current.visible = true;
          }

        } else { // arriving
          starTeleportTimerRef.current -= delta;
          tvfx.arrivalProgress = 1 - Math.max(0, starTeleportTimerRef.current) / 0.55;
          targetX   = bossPosRef.current[0];
          targetY   = bossPosRef.current[1];
          lerpSpeed = 0.5;
          if (starTeleportTimerRef.current <= 0) {
            tvfx.arrivalProgress = 0;
            tvfx.departureProgress = 0;
            starTeleportPhaseRef.current = 'idle';
            starTeleportCooldownRef.current = 3 + Math.random() * 4;
          }
        }
        break;
      }
      case "dash": {
        // ── TriangleBoss (crystal): 3 player-avoidant movement patterns ──────
        // Patterns cycle every 8–13 s. All patterns compute targets on the far
        // side of the arena from the player so trajectories never cross them.
        const PW = playAreaWidth;
        const PH = playAreaHeight;

        triPatternTimerRef.current -= delta;
        if (triPatternTimerRef.current <= 0) {
          triPatternRef.current     = (triPatternRef.current + 1) % 3;
          triPatternTimerRef.current = 8 + Math.random() * 5; // 8–13 s per pattern
          triSubAngleRef.current    = 0;
        }
        triSubAngleRef.current += delta;
        const subT = triSubAngleRef.current;

        // Opposition vector: unit direction pointing AWAY from the player
        const oppX   = -playerX;
        const oppY   = -playerY;
        const oppLen = Math.sqrt(oppX * oppX + oppY * oppY);
        const oppNX  = oppLen > 0.1 ? oppX / oppLen : 0;
        const oppNY  = oppLen > 0.1 ? oppY / oppLen : 1;

        const pat = triPatternRef.current;

        if (pat === 0) {
          // Pattern A – Opposition orbit: boss circles the anti-player point
          const cx  = Math.max(-PW * 0.72, Math.min(PW * 0.72, oppNX * 5.5));
          const cy  = Math.max(-PH * 0.72, Math.min(PH * 0.72, oppNY * 5.5));
          const orR = 2.6 + Math.sin(subT * 0.45) * 1.5;
          targetX   = cx + Math.cos(subT * 1.15) * orR;
          targetY   = cy + Math.sin(subT * 1.50) * orR;
          lerpSpeed = 2.8;

        } else if (pat === 1) {
          // Pattern B – Far-corner hover: seek the arena corner farthest from player
          const corners: [number, number][] = [
            [ PW * 0.82,  PH * 0.76],
            [-PW * 0.82,  PH * 0.76],
            [-PW * 0.82, -PH * 0.76],
            [ PW * 0.82, -PH * 0.76],
          ];
          let bestCorner = corners[0];
          let bestDist   = -Infinity;
          for (const [cx, cy] of corners) {
            const d = (cx - playerX) ** 2 + (cy - playerY) ** 2;
            if (d > bestDist) { bestDist = d; bestCorner = [cx, cy]; }
          }
          // Slow drift once parked at the far corner
          targetX   = bestCorner[0] + Math.sin(subT * 0.9) * 0.7;
          targetY   = bestCorner[1] + Math.cos(subT * 0.7) * 0.7;
          // Dash fast initially, then hover gently
          lerpSpeed = subT < 1.8 ? 9 : 1.4;

        } else {
          // Pattern C – Avoidant figure-8: figure-8 centred on the far point
          const cx  = Math.max(-PW * 0.60, Math.min(PW * 0.60, oppNX * 4.5));
          const cy  = Math.max(-PH * 0.60, Math.min(PH * 0.60, oppNY * 4.5));
          targetX   = cx + Math.sin(subT * 0.72) * 5.5;
          targetY   = cy + Math.sin(subT * 1.44) * 3.2;
          lerpSpeed = 3.6;
        }

        // Clamp to safe play area
        targetX = Math.max(-PW * 0.90, Math.min(PW * 0.90, targetX));
        targetY = Math.max(-PH * 0.84 + 2, Math.min(PH * 0.84, targetY));
        break;
      }
      case "perimeter": {
        const perimeterSpeed = 0.4;
        const newAngle = localAngle + delta * perimeterSpeed;
        const normalizedAngle = ((newAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const segment = normalizedAngle / (Math.PI * 0.5);
        if (segment < 1) {
          targetX = playAreaWidth;
          targetY = -playAreaHeight + (segment * 2 * playAreaHeight);
        } else if (segment < 2) {
          targetX = playAreaWidth - ((segment - 1) * 2 * playAreaWidth);
          targetY = playAreaHeight;
        } else if (segment < 3) {
          targetX = -playAreaWidth;
          targetY = playAreaHeight - ((segment - 2) * 2 * playAreaHeight);
        } else {
          targetX = -playAreaWidth + ((segment - 3) * 2 * playAreaWidth);
          targetY = -playAreaHeight;
        }
        lerpSpeed = 4;
        break;
      }
      case "figure8": {
        const figure8Speed = 0.6;
        const newAngle = localAngle + delta * figure8Speed;
        const radiusX = 9;
        const radiusY = 5;
        targetX = Math.sin(newAngle) * radiusX;
        targetY = Math.sin(newAngle * 2) * radiusY;
        lerpSpeed = 3;
        if (threatened) {
          const dodgeMult = 4;
          targetX += dodgeDirRef.current[0] * dodgeMult;
          targetY += dodgeDirRef.current[1] * dodgeMult;
        }
        break;
      }
      case "bounce": {
        const bounceVel = boss.bounceVelocity || [3, 2.5];
        let newVelX = bounceVel[0];
        let newVelY = bounceVel[1];
        targetX = bossPosRef.current[0] + newVelX * delta * 3;
        targetY = bossPosRef.current[1] + newVelY * delta * 3;
        if (targetX > playAreaWidth || targetX < -playAreaWidth) {
          newVelX = -newVelX * (0.9 + Math.random() * 0.2);
          targetX = Math.max(-playAreaWidth, Math.min(playAreaWidth, targetX));
        }
        if (targetY > playAreaHeight || targetY < -playAreaHeight + 2) {
          newVelY = -newVelY * (0.9 + Math.random() * 0.2);
          targetY = Math.max(-playAreaHeight + 2, Math.min(playAreaHeight, targetY));
        }
        newBounceVelocity = [newVelX, newVelY];
        lerpSpeed = 20;
        break;
      }
      case "spiral": {
        const spiralSpeed = 0.5;
        const newAngle = localAngle + delta * spiralSpeed;
        const spiralRadius = 4 + Math.sin(time * 0.3) * 4;
        const spiralExpand = Math.sin(time * 0.2) * 3;
        targetX = Math.cos(newAngle * 2) * (spiralRadius + spiralExpand);
        targetY = Math.sin(newAngle * 2) * (spiralRadius + spiralExpand) + 1;
        lerpSpeed = 3.5;
        if (threatened) {
          const spiralDodge = time * 6;
          targetX += Math.cos(spiralDodge) * 2.5;
          targetY += Math.sin(spiralDodge) * 2.5;
        }
        break;
      }
      case "wave": {
        const waveSpeed = 0.4;
        const newAngle = localAngle + delta * waveSpeed;
        const waveAmplitude = 4;
        const waveFreq = 2;
        targetX = Math.sin(newAngle) * playAreaWidth * 0.8;
        targetY = Math.sin(time * waveFreq) * waveAmplitude + Math.cos(newAngle * 0.5) * 3;
        lerpSpeed = 3;
        if (threatened) {
          targetY += Math.sin(time * 10) * 2;
        }
        break;
      }
      case "chaos": {
        phaseTimerRef.current -= delta;
        if (phaseTimerRef.current <= 0) {
          const chaosAngle = Math.random() * Math.PI * 2;
          const chaosDist = 3 + Math.random() * 6;
          targetX = bossPosRef.current[0] + Math.cos(chaosAngle) * chaosDist;
          targetY = bossPosRef.current[1] + Math.sin(chaosAngle) * chaosDist;
          targetX = Math.max(-playAreaWidth, Math.min(playAreaWidth, targetX));
          targetY = Math.max(-playAreaHeight + 2, Math.min(playAreaHeight, targetY));
          phaseTimerRef.current = 0.3 + Math.random() * 0.5;
          lerpSpeed = 8 + Math.random() * 6;
        } else {
          targetX = bossPosRef.current[0] + (Math.random() - 0.5) * 0.5;
          targetY = bossPosRef.current[1] + (Math.random() - 0.5) * 0.5;
          lerpSpeed = 5;
        }
        break;
      }
      case "shadow": {
        // ── Perimeter-bound state machine ─────────────────────────────────────
        // The Shadow Boss prowls the screen edge — never through the center.
        // Phases (existing ref names repurposed):
        //   'stalk'  → patrol : steady clockwise crawl (~5 wu/s)
        //   'charge' → sprint : 3× speed burst for ~2 s
        //   'evade'  → reverse: flips direction, prowls CCW briefly
        //   'vortex' → corner : races to nearest corner, holds ominously
        //
        // Ref repurposing:
        //   monsterOrbitAngleRef      → perimT   (0–4, position on perimeter)
        //   monsterChargeTargetRef[0] → dir      (1 = CW, -1 = CCW)
        //   monsterChargeTargetRef[1] → cornerT  (target corner t-value, 0–3)

        const pW = 10.0; // perimeter half-width  (arena ≈ ±12)
        const pH =  6.0; // perimeter half-height (arena ≈ ±8)

        // Map t ∈ [0,4) to world (x,y) on the rectangular perimeter
        const perimXY = (t: number): [number, number] => {
          t = ((t % 4) + 4) % 4;
          if (t < 1) return [-pW + t * 2 * pW,  pH];
          if (t < 2) return [ pW, pH - (t - 1) * 2 * pH];
          if (t < 3) return [ pW - (t - 2) * 2 * pW, -pH];
          return             [-pW, -pH + (t - 3) * 2 * pH];
        };

        // Convert world-units/s to perimeter-t/s for current segment
        const tRate = (wuPerSec: number, t: number): number => {
          const seg = Math.floor(((t % 4) + 4) % 4);
          return wuPerSec / (seg % 2 === 0 ? 2 * pW : 2 * pH);
        };

        // One-time init: seed perimT to top-center, dir to CW
        if (monsterOrbitAngleRef.current < 0 || monsterOrbitAngleRef.current >= 4) {
          monsterOrbitAngleRef.current = 0.5;
        }
        if (monsterChargeTargetRef.current[0] === 0) {
          monsterChargeTargetRef.current[0] = 1;
        }

        const perimT = monsterOrbitAngleRef;   // alias
        const dirRef = monsterChargeTargetRef; // [0]=dir, [1]=cornerT

        monsterPhaseTimerRef.current -= delta;
        const mPhase = monsterPhaseRef.current;
        let worldSpeed = 5.0;

        if (mPhase === 'stalk') {
          // ── Patrol: slow steady traversal ──────────────────────────────────
          worldSpeed = 5.0;
          if (monsterPhaseTimerRef.current <= 0) {
            const roll = Math.random();
            if (roll < 0.35) {
              // Sprint burst
              monsterPhaseRef.current = 'charge';
              monsterPhaseTimerRef.current = 1.8 + Math.random() * 0.8;
            } else if (roll < 0.65) {
              // Reverse direction
              monsterPhaseRef.current = 'evade';
              dirRef.current[0] *= -1;
              monsterPhaseTimerRef.current = 3.0 + Math.random() * 2.0;
            } else {
              // Corner dash — find nearest corner in current travel direction
              monsterPhaseRef.current = 'vortex';
              const curDir = dirRef.current[0];
              const curT   = perimT.current;
              let bestCorner = 0, bestDist = 99;
              for (const c of [0, 1, 2, 3]) {
                const fwd = ((c - curT) * curDir + 4) % 4;
                if (fwd < bestDist) { bestDist = fwd; bestCorner = c; }
              }
              dirRef.current[1] = bestCorner;
              monsterPhaseTimerRef.current = 6.0; // generous timeout
            }
          }
        } else if (mPhase === 'charge') {
          // ── Sprint: 3× speed burst ──────────────────────────────────────────
          worldSpeed = 15.0;
          if (monsterPhaseTimerRef.current <= 0) {
            monsterPhaseRef.current = 'stalk';
            monsterPhaseTimerRef.current = 4.0 + Math.random() * 2.0;
          }
        } else if (mPhase === 'evade') {
          // ── Reverse: prowl CCW briefly then flip back ───────────────────────
          worldSpeed = 5.0;
          if (monsterPhaseTimerRef.current <= 0) {
            dirRef.current[0] *= -1; // restore original direction
            monsterPhaseRef.current = 'stalk';
            monsterPhaseTimerRef.current = 4.0 + Math.random() * 2.0;
          }
        } else {
          // ── Corner: race to corner and hold ────────────────────────────────
          const cornerT = dirRef.current[1];
          const fwdDist = ((cornerT - perimT.current) * dirRef.current[0] + 4) % 4;

          if (fwdDist < 0.07 || fwdDist > 3.95) {
            // Arrived — ominous pause
            worldSpeed = 0;
            if (monsterPhaseTimerRef.current > 2.0) {
              monsterPhaseTimerRef.current = 1.0 + Math.random() * 0.8;
            }
            if (monsterPhaseTimerRef.current <= 0) {
              monsterPhaseRef.current = 'stalk';
              monsterPhaseTimerRef.current = 4.0 + Math.random() * 2.0;
            }
          } else {
            worldSpeed = 14.0; // race to corner
            if (monsterPhaseTimerRef.current <= 0) {
              // Timed out — resume patrol without stopping
              monsterPhaseRef.current = 'stalk';
              monsterPhaseTimerRef.current = 4.0 + Math.random() * 2.0;
            }
          }
        }

        // Advance perimeter — read direction AFTER phase logic so flips take effect immediately
        perimT.current = ((perimT.current + tRate(worldSpeed, perimT.current) * delta * dirRef.current[0]) % 4 + 4) % 4;

        const [px, py] = perimXY(perimT.current);
        targetX   = px;
        targetY   = py;
        lerpSpeed = 28; // tight tracking — boss stays on the perimeter path

        break;
      }
      case "orbit_player": {
        // ── FireBoss "strike-and-retreat" state machine ──────────────────────
        // Phases: entering (fires while moving) → waiting (3 s, no fire)
        //       → exiting (fires while moving) → repeat
        // Landing target is 100–300 px from the player in world units.
        // All fired orbs use indirect approach movement patterns.

        const PW  = 12;
        const PH  = 8;
        const OFF = 18;

        // Live px→world-unit conversion.
        const pxPerWU   = state.size.height / state.viewport.height;
        const minDistWU = 100 / pxPerWU;
        const maxDistWU = 300 / pxPerWU;

        // Indirect movement patterns for fired orbs.
        const INDIRECT: MovementPattern[] = [
          'zigzag', 'spiral', 'wave', 'homing',
          'sine_horizontal', 'sine_vertical', 'pendulum',
        ];

        // ── Helpers ─────────────────────────────────────────────────────────

        const pickNewCycle = () => {
          // Random edge for off-screen origin/destination.
          const side = Math.floor(Math.random() * 4);
          if (side === 0) {
            fireOffscreenRef.current = [-OFF, (Math.random() - 0.5) * PH * 1.4];
          } else if (side === 1) {
            fireOffscreenRef.current = [ OFF, (Math.random() - 0.5) * PH * 1.4];
          } else if (side === 2) {
            fireOffscreenRef.current = [(Math.random() - 0.5) * PW * 1.6,  OFF];
          } else {
            fireOffscreenRef.current = [(Math.random() - 0.5) * PW * 1.6, -OFF];
          }
          // Landing: random angle around player, radius in [100 px, 300 px].
          const angle  = Math.random() * Math.PI * 2;
          const radius = minDistWU + Math.random() * (maxDistWU - minDistWU);
          const tx = Math.max(-PW * 0.9, Math.min(PW * 0.9, playerX + Math.cos(angle) * radius));
          const ty = Math.max(-PH * 0.85, Math.min(PH * 0.85, playerY + Math.sin(angle) * radius));
          fireTargetRef.current = [tx, ty];
        };

        // Spawn one orb aimed roughly at the player with a random indirect pattern.
        const spawnFireOrb = () => {
          const { arcadeLevel, boss: liveBoss, addDarkOrb } = useMagicOrb.getState();
          const wl         = Math.max(1, Math.floor(arcadeLevel));
          const speedScale = 1 + (wl - 1) * 0.15;
          const sizeScale  = 0.5 + (wl - 1) * 0.03;
          const baseAngle  = Math.atan2(
            playerY - bossPosRef.current[1],
            playerX - bossPosRef.current[0],
          );
          const angle   = baseAngle + (Math.random() - 0.5) * 0.5;
          const pattern = INDIRECT[Math.floor(Math.random() * INDIRECT.length)];
          addDarkOrb({
            id:           `boss-fire-${Date.now()}-${Math.random()}`,
            position:     [bossPosRef.current[0], bossPosRef.current[1], 0.5],
            direction:    [Math.cos(angle), Math.sin(angle), 0],
            speed:        2.5 * speedScale * (0.7 + Math.random() * 0.6),
            size:         sizeScale,
            seed:         Math.random(),
            shape:        'circle',
            pattern,
            patternPhase: Math.random() * Math.PI * 2,
            isBossOrb:    true,
            bossType:     liveBoss?.bossType ?? 'circle',
          });
        };

        // ── First-frame init ─────────────────────────────────────────────────
        if (!fireInitRef.current) {
          pickNewCycle();
          bossPosRef.current       = [fireOffscreenRef.current[0], fireOffscreenRef.current[1], 0];
          fireMovePhaseRef.current = 'entering';
          fireShotTimerRef.current = 0.5;
          fireInitRef.current      = true;
        }

        const curX = bossPosRef.current[0];
        const curY = bossPosRef.current[1];
        let bx = curX;
        let by = curY;

        const ENTER_SPEED = 5.0;
        const EXIT_SPEED  = 6.5;

        const viewCamera = state.camera as THREE.PerspectiveCamera;
        const fireView = getPerspectiveViewAtPlane({
          cameraX: viewCamera.position.x,
          cameraY: viewCamera.position.y,
          cameraZ: viewCamera.position.z,
          planeZ: 0,
          verticalFovDegrees: viewCamera.fov,
          aspect: viewCamera.aspect,
        });

        // ── Rare low-health Backdraft Ambush ─────────────────────────────────
        // The ambush owns the Fire boss transform for its short lifetime. It
        // remains a live boss in BossRuntime, so swept collision never sees a
        // stale position while the visual crosses the arena.
        if (fireAmbushPhaseRef.current === "idle") {
          fireAmbushTimerRef.current -= delta;
          if (canStartFireBossAmbush(
            boss.health,
            fireAmbushUsesRef.current,
            fireAmbushPhaseRef.current,
            fireAmbushTimerRef.current,
          )) {
            fireAmbushLaunchPointRef.current = getFireBossAmbushTarget(
              fireView,
              Math.random,
              [playerX, playerY],
            );
            fireAmbushPhaseRef.current = "repositioning";
            fireAmbushTimerRef.current = FIRE_BOSS_AMBUSH_REPOSITION_DURATION;
            fireAmbushUsesRef.current = Math.min(
              FIRE_BOSS_AMBUSH_MAX_USES,
              fireAmbushUsesRef.current + 1,
            );
            fireAmbushImpactTriggeredRef.current = false;
          }
        }

        let ambushHandled = fireAmbushPhaseRef.current !== "idle";
        if (ambushHandled) {
          const ambushPhase = fireAmbushPhaseRef.current;

          if (ambushPhase === "repositioning") {
            const [tx, ty] = fireAmbushLaunchPointRef.current;
            const dx = tx - curX;
            const dy = ty - curY;
            const distance = Math.hypot(dx, dy);
            fireAmbushTimerRef.current -= delta;
            if (distance < 0.35 || fireAmbushTimerRef.current <= 0) {
              bx = tx;
              by = ty;
              fireAmbushPhaseRef.current = "charging";
              fireAmbushTimerRef.current = FIRE_BOSS_AMBUSH_CHARGE_DURATION;
            } else {
              const step = Math.min(1, delta * FIRE_BOSS_AMBUSH_REPOSITION_SPEED / Math.max(0.001, distance));
              bx = curX + dx * step;
              by = curY + dy * step;
            }
          } else if (ambushPhase === "charging") {
            const [tx, ty] = fireAmbushLaunchPointRef.current;
            bx = tx;
            by = ty;
            fireAmbushTimerRef.current -= delta;
            if (fireAmbushTimerRef.current <= 0) {
              const target: [number, number] = [playerX, playerY];
              const destination = getFireBossAmbushDashDestination(
                [tx, ty],
                target,
                fireView,
              );
              const totalDistance = Math.hypot(
                destination[0] - tx,
                destination[1] - ty,
              );
              const targetDistance = Math.hypot(playerX - tx, playerY - ty);
              fireAmbushDashStartRef.current = [tx, ty];
              fireAmbushPlayerTargetRef.current = target;
              fireAmbushDashDestinationRef.current = destination;
              fireAmbushPlayerProgressRef.current = Math.max(
                0,
                Math.min(1, targetDistance / Math.max(0.001, totalDistance)),
              );
              fireAmbushPhaseRef.current = "dashing";
              fireAmbushTimerRef.current = FIRE_BOSS_AMBUSH_DASH_DURATION;
              fireAmbushImpactTriggeredRef.current = false;
            }
          } else if (ambushPhase === "dashing") {
            const [sx, sy] = fireAmbushDashStartRef.current;
            const [dx, dy] = fireAmbushDashDestinationRef.current;
            const previousProgress = getFireBossAmbushDashProgress(
              FIRE_BOSS_AMBUSH_DASH_DURATION - fireAmbushTimerRef.current,
            );
            fireAmbushTimerRef.current -= delta;
            const dashProgress = getFireBossAmbushDashProgress(
              FIRE_BOSS_AMBUSH_DASH_DURATION - fireAmbushTimerRef.current,
            );

            if (shouldTriggerFireBossAmbushHit(
              previousProgress,
              dashProgress,
              fireAmbushPlayerProgressRef.current,
              fireAmbushImpactTriggeredRef.current,
            )) {
              fireAmbushImpactTriggeredRef.current = true;
              useMagicOrb.getState().takeDamage();
              fireAmbushImpactIdRef.current += 1;
              fireAmbushImpactRef.current = createFireBossAmbushImpact(
                fireAmbushImpactIdRef.current,
                [...fireAmbushPlayerTargetRef.current, 0],
              );
            }

            const safeProgress = Math.max(previousProgress, dashProgress);
            bx = sx + (dx - sx) * safeProgress;
            by = sy + (dy - sy) * safeProgress;
            if (fireAmbushTimerRef.current <= 0) {
              fireAmbushPhaseRef.current = "recovery";
              fireAmbushTimerRef.current = FIRE_BOSS_AMBUSH_RECOVERY_DURATION;
            }
          } else if (ambushPhase === "recovery") {
            bx = curX;
            by = curY;
            fireAmbushTimerRef.current -= delta;
            if (fireAmbushTimerRef.current <= 0) {
              fireAmbushPhaseRef.current = "idle";
              // Re-enter the authored Fire strike-and-retreat loop from a
              // fresh edge target after the ambush has left the screen.
              pickNewCycle();
              fireMovePhaseRef.current = "exiting";
            }
          } else {
            ambushHandled = false;
          }
        }

        if (!ambushHandled) {
          // ── Phase state machine ────────────────────────────────────────────
          switch (fireMovePhaseRef.current) {

          case 'entering': {
            const tx   = fireTargetRef.current[0];
            const ty   = fireTargetRef.current[1];
            const dx   = tx - curX;
            const dy   = ty - curY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Fire while moving.
            fireShotTimerRef.current -= delta;
            if (fireShotTimerRef.current <= 0) {
              spawnFireOrb();
              fireShotTimerRef.current = 0.4 + Math.random() * 0.4;
            }

            if (dist < 0.3) {
              bx = tx; by = ty;
              fireWaitTimerRef.current = 3.0;
              fireMovePhaseRef.current = 'waiting';
            } else {
              const f = Math.min(1, delta * ENTER_SPEED);
              bx = curX + dx * f;
              by = curY + dy * f;
            }
            break;
          }

          case 'waiting': {
            // Stationary — no firing.
            bx = curX; by = curY;
            fireWaitTimerRef.current -= delta;
            if (fireWaitTimerRef.current <= 0) {
              fireShotTimerRef.current = 0.3; // fire shortly after movement begins
              fireMovePhaseRef.current = 'exiting';
            }
            break;
          }

          case 'exiting': {
            const ex   = fireOffscreenRef.current[0];
            const ey   = fireOffscreenRef.current[1];
            const dx   = ex - curX;
            const dy   = ey - curY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Fire while retreating.
            fireShotTimerRef.current -= delta;
            if (fireShotTimerRef.current <= 0) {
              spawnFireOrb();
              fireShotTimerRef.current = 0.4 + Math.random() * 0.4;
            }

            if (dist < 0.6) {
              pickNewCycle();
              bx = fireOffscreenRef.current[0];
              by = fireOffscreenRef.current[1];
              bossPosRef.current       = [bx, by, 0];
              fireShotTimerRef.current = 0.5;
              fireMovePhaseRef.current = 'entering';
            } else {
              const f = Math.min(1, delta * EXIT_SPEED);
              bx = curX + dx * f;
              by = curY + dy * f;
            }
            break;
          }
          }
        }

        // Commit position imperatively.
        bossPosRef.current = [bx, by, 0];
        meshRef.current.position.set(bx, by, 0);
        gameRuntime.boss.commit(boss.id, bossPosRef.current);

        // Throttled Zustand write.
        frameCountRef.current++;
        if (frameCountRef.current % 2 === 0) {
          useMagicOrb.getState().updateBoss({
            ...boss,
            position: [bx, by, 0],
            fireAmbushImpact: fireAmbushImpactRef.current ?? undefined,
          });
        }
        break;
      }
    }

    // ── Generic post-switch logic (all non-FireBoss bosses) ─────────────────
    // The circle / FireBoss drives position imperatively inside orbit_player and
    // has already written to meshRef and Zustand — skip everything below for it.
    if (bossType !== "circle") {
      // bossPosRef is updated every frame so it's never stale, even on frames
      // where we skip the Zustand write.  Math.min(1, …) prevents overshooting
      // on large-delta frames (slow mobile, background tabs).
      const lerpFactor = Math.min(1, delta * lerpSpeed);
      let finalX = bossPosRef.current[0] + (targetX - bossPosRef.current[0]) * lerpFactor;
      let finalY = bossPosRef.current[1] + (targetY - bossPosRef.current[1]) * lerpFactor;

      // Monster boss orbits closely by design — use a tighter 2.5-unit exclusion
      // so its orbit/charge phases don't fight the generic 7-unit push-back.
      const monsterMinDist = bossType === "monster" ? 2.5 : MIN_PLAYER_DISTANCE;
      const safePos = keepDistanceFromPlayer([finalX, finalY, 0], [playerX, playerY, 0], monsterMinDist, delta);
      finalX = safePos[0];
      finalY = safePos[1];

      bossPosRef.current = [finalX, finalY, 0];

      if (localAttackTimerRef.current === null) localAttackTimerRef.current = boss.attackTimer;

      let attackResult: { timer: number; burst: number };

      if (bossType === "triangle") {
        // ── TriangleBoss burst fire: 3 shots back-to-back, random gap between bursts ──
        // Projectiles are 25 % faster than the star boss (level 2 base ≈ 2.875 → here 4.0)
        triBurstTimerRef.current    -= delta;
        triBurstCooldownRef.current -= delta;

        if (triBurstCountRef.current > 0 && triBurstTimerRef.current <= 0) {
          // ── Three strategically distinct shots, fired one per 120 ms ──────────
          // triBurstCountRef counts 3 → 2 → 1 so the first shot has count = 3.
          //
          //  Shot 1 (count=3): "homing"   — locks straight onto the player,
          //                                 forces them to move immediately.
          //  Shot 2 (count=2): "pendulum" — swings perpendicular to its travel
          //                                 path, punishing the dodge committed
          //                                 to dodge shot 1.
          //  Shot 3 (count=1): "spiral"   — corkscrews in, cuts off the escape
          //                                 lane that opened up after shots 1 & 2.
          const { addDarkOrb } = useMagicOrb.getState();
          const baseAngle = Math.atan2(playerY - finalY, playerX - finalX);
          const shotIndex = 3 - triBurstCountRef.current; // 0, 1, 2

          // Shot layout:
          //   shotIndex 0 → front shot — fired straight at the player
          //   shotIndex 1 → left  flank — fired ~90° to the player's left,
          //                  arcs inward with a wave oscillation
          //   shotIndex 2 → right flank — fired ~90° to the player's right,
          //                  arcs inward with a spiral corkscrew
          //
          // Because dx/dy is recomputed toward the player every frame in
          // DarkOrbs.tsx, a large initial offset causes the orb to travel
          // laterally first, then progressively curve toward the player —
          // giving a genuine side approach without custom physics.

          const FLANK = Math.PI * 0.48; // ~86°: nearly perpendicular
          const aimOffset =
            shotIndex === 0 ?  0       :   // straight ahead
            shotIndex === 1 ? -FLANK   :   // hard left
                               FLANK;      // hard right
          const angle = baseAngle + aimOffset + (Math.random() - 0.5) * 0.06;

          const pattern: MovementPattern =
            shotIndex === 0 ? "homing"  :  // front: locks straight onto player
            shotIndex === 1 ? "wave"    :  // left flank: sine-wave arc inward
                              "spiral";   // right flank: corkscrew arc inward

          const patternPhase =
            shotIndex === 0 ? 0                         :
            shotIndex === 1 ? Math.random() * Math.PI * 2 :
                              Math.random() * Math.PI * 2;

          // Flank shots travel farther to reach the player so need a speed boost;
          // the front shot stays snappy.
          const speed =
            shotIndex === 0 ? 3.8 :
            shotIndex === 1 ? 4.8 :   // wave flank — faster to compensate detour
                              4.6;    // spiral flank

          addDarkOrb({
            id:           `tri-burst-${Date.now()}-${Math.random()}`,
            position:     [finalX, finalY, 0.5] as [number, number, number],
            direction:    [Math.cos(angle), Math.sin(angle), 0] as [number, number, number],
            speed,
            size:         0.56,
            seed:         Math.random(),
            shape:        "triangle",
            pattern,
            patternPhase,
            isBossOrb:    true,
            bossType:     "triangle",
          });
          triBurstCountRef.current -= 1;
          triBurstTimerRef.current  = 0.12; // 120 ms between burst shots
        }

        if (triBurstCountRef.current <= 0 && triBurstCooldownRef.current <= 0) {
          // Start a fresh burst of 3
          triBurstCountRef.current    = 3;
          triBurstTimerRef.current    = 0;
          triBurstCooldownRef.current = 1.8 + Math.random() * 2.5; // 1.8–4.3 s gap
        }

        // Suppress generic fireProjectiles for triangle boss
        attackResult = { timer: localAttackTimerRef.current, burst: attackBurstRef.current };
      } else if (bossType === "monster") {
        // ── Shadow Boss: 6 distinct attack modes + rage ───────────────────────
        // 0: Void Cross    — 4 shots outward at diagonal angles, "direct"
        // 1: Twin Fangs    — 2 wide-fan homing shots at player
        // 2: Phantom Sweep — 4 shots perpendicular to player direction, "wave"
        // 3: Dark Orbit    — 5 evenly-spaced pentagon shots, "orbit"
        // 4: Spiral Bloom  — 5 shots rotating 72° each, "spiral"
        // 5: Shadow Pairs  — 3 opposing pairs (6 shots total), "zigzag"
        // rage (< 30% HP) — Void Barrage: 3 homing fan + 3 figure8 scatter
        // All modes: per-shot delay 0.1–0.4 s
        monsterBurstTimerRef.current    -= delta;
        monsterBurstCooldownRef.current -= delta;

        if (monsterBurstCountRef.current > 0 && monsterBurstTimerRef.current <= 0) {
          const { darkOrbs: liveMDO, addDarkOrb: addMOrb } = useMagicOrb.getState();
          const activeMBO = liveMDO.filter(o => o.isBossOrb && !o.destroying).length;

          if (activeMBO < 16) {
            const baseAngle = Math.atan2(playerY - finalY, playerX - finalX);
            const isRage    = healthPercent < 0.3;
            const mode      = isRage ? 6 : monsterAttackModeRef.current;

            // Total shots per mode index (must match initialisation block below)
            const totalShots = [4, 2, 4, 5, 5, 6, 6];
            const shotIdx    = totalShots[Math.min(mode, 6)] - monsterBurstCountRef.current;

            const mkOrb = (angle: number, speed: number, size: number, pat: MovementPattern, tag: string) =>
              addMOrb({
                id: `m-${tag}-${Date.now()}-${shotIdx}`,
                position: [finalX, finalY, 0.5],
                direction: [Math.cos(angle), Math.sin(angle), 0],
                speed, size,
                seed: Math.random(),
                shape: "circle",
                pattern: pat,
                patternPhase: Math.random() * Math.PI * 2,
                isBossOrb: true,
                bossType: "monster",
              });

            let nextDelay = 0.1 + Math.random() * 0.3; // default 0.1–0.4 s

            if (mode === 0) {
              // Void Cross: 4 shots toward screen corners — never aimed at player
              const angle = shotIdx * (Math.PI / 2) + Math.PI * 0.25; // NE, NW, SW, SE
              mkOrb(angle, 2.8 + Math.random() * 0.4, 0.50, "direct", "cross");
              nextDelay = 0.2 + Math.random() * 0.15;

            } else if (mode === 1) {
              // Twin Fangs: 2 homing shots, wide spread so player must move
              const fanOffset = shotIdx === 0 ? -0.44 : 0.44;
              mkOrb(baseAngle + fanOffset, 4.4 + Math.random() * 0.3, 0.54, "homing", "fang");
              nextDelay = 0.22 + Math.random() * 0.13;

            } else if (mode === 2) {
              // Phantom Sweep: 4 shots firing perpendicular to player dir
              // They cross the arena without tracking — player reads the sweep
              const perpAngle = baseAngle + Math.PI * 0.5;
              const sweep     = (shotIdx - 1.5) * 0.48;
              mkOrb(perpAngle + sweep, 2.8 + Math.random() * 0.3, 0.48, "wave", "sweep");
              nextDelay = 0.16 + Math.random() * 0.14;

            } else if (mode === 3) {
              // Dark Orbit: 5 pentagon shots not aimed at player — fill the space
              const angle = (shotIdx / 5) * Math.PI * 2;
              mkOrb(angle, 2.4 + Math.random() * 0.35, 0.50, "orbit", "orbit");
              nextDelay = 0.3 + Math.random() * 0.1;

            } else if (mode === 4) {
              // Spiral Bloom: 5 shots each rotated 72° from previous
              const angle = baseAngle + shotIdx * (Math.PI * 2 / 5);
              mkOrb(angle, 3.0 + Math.random() * 0.4, 0.46, "spiral", "bloom");
              nextDelay = 0.2 + Math.random() * 0.15;

            } else if (mode === 5) {
              // Shadow Pairs: 3 pairs each 180° apart, pair axis rotates 60° each time
              // Even shotIdx = first of pair (tight delay follows), odd = second of pair (long gap)
              const pairIdx    = Math.floor(shotIdx / 2);
              const isSecond   = shotIdx % 2 === 1;
              const pairAngle  = (pairIdx / 3) * Math.PI; // 0°, 60°, 120°
              mkOrb(pairAngle + (isSecond ? Math.PI : 0), 2.6 + Math.random() * 0.5, 0.50, "zigzag", "pair");
              // Tight within a pair, open between pairs
              nextDelay = isSecond ? (0.32 + Math.random() * 0.08) : (0.1 + Math.random() * 0.05);

            } else {
              // Void Barrage (rage): 3 homing fan + 3 figure8 scatter, alternating
              if (shotIdx < 3) {
                const fanOffset = (shotIdx - 1) * 0.36;
                mkOrb(baseAngle + fanOffset, 4.1 + Math.random() * 0.3, 0.52, "homing", "barrage");
              } else {
                const scatterAngle = ((shotIdx - 3) / 3) * Math.PI * 2 + baseAngle + Math.PI * 0.5;
                mkOrb(scatterAngle, 3.1 + Math.random() * 0.4, 0.46, "figure8", "barrage");
              }
              nextDelay = 0.14 + Math.random() * 0.11; // 0.14–0.25 s rage pace
            }

            monsterBurstCountRef.current -= 1;
            monsterBurstTimerRef.current  = monsterBurstCountRef.current > 0 ? nextDelay : 0;

          } else {
            // Cap reached — skip and let orbs clear
            monsterBurstCountRef.current = 0;
          }
        }

        if (monsterBurstCountRef.current <= 0 && monsterBurstCooldownRef.current <= 0) {
          const isRage = healthPercent < 0.3;
          const mode   = isRage ? 6 : monsterAttackModeRef.current;
          const totalShots = [4, 2, 4, 5, 5, 6, 6];
          monsterBurstCountRef.current    = totalShots[Math.min(mode, 6)];
          monsterBurstTimerRef.current    = 0; // fire first shot immediately
          if (!isRage) {
            monsterAttackModeRef.current = (monsterAttackModeRef.current + 1) % 6;
          }
          monsterBurstCooldownRef.current = isRage
            ? 1.2 + Math.random() * 0.6   // rage: 1.2–1.8 s between bursts
            : 2.5 + Math.random() * 1.5;  // normal: 2.5–4.0 s between bursts
        }

        // Suppress generic fireProjectiles
        attackResult = { timer: localAttackTimerRef.current, burst: attackBurstRef.current };
      } else {
        attackResult = fireProjectiles([finalX, finalY, 0], localAttackTimerRef.current, attackBurstRef.current);
      }

      localAttackTimerRef.current = attackResult.timer;
      attackBurstRef.current = attackResult.burst;

      const newAngle = localAngle + delta * 0.5;
      localAngleRef.current = newAngle;

      frameCountRef.current++;
      if (frameCountRef.current % 2 === 0) {
        useMagicOrb.getState().updateBoss({
          ...boss,
          position: [finalX, finalY, 0],
          angle: newAngle,
          attackTimer: attackResult.timer,
          bounceVelocity: newBounceVelocity,
        });
      }

      meshRef.current.position.set(finalX, finalY, 0);
      gameRuntime.boss.commit(boss.id, [finalX, finalY, 0]);

      // Star boss: hide mesh during brief invisible transit between teleport phases
      if (bossType === "star") {
        meshRef.current.visible = starTeleportPhaseRef.current !== 'transiting';
      }
    }

    // ── Off-screen ambient spawns — all boss types except monster (9.9) ─────────
    // Monster boss has its own rich attack patterns and doesn't need ambient spawns.
    // Rate: 4.5 s at world 1 → 0.9 s at world 9.
    // Count: 1 per burst at worlds 1-6, 2 at worlds 7-8, 3 at world 9.
    if (bossType !== "monster") {
      const { arcadeLevel: osAL, spawnBossOrb: osSpawn } = useMagicOrb.getState();
      const osWorld = Math.max(1, Math.floor(osAL));
      offScreenTimerRef.current -= delta;
      if (offScreenTimerRef.current <= 0) {
        const spawnCount = osWorld >= 9 ? 3 : osWorld >= 7 ? 2 : 1;
        for (let s = 0; s < spawnCount; s++) {
          const osEdge = Math.floor(Math.random() * 4);
          const osW = 16, osH = 12;
          let osSx: number, osSy: number;
          if (osEdge === 0)      { osSx = -osW; osSy = (Math.random() * 2 - 1) * osH; }
          else if (osEdge === 1) { osSx =  osW; osSy = (Math.random() * 2 - 1) * osH; }
          else if (osEdge === 2) { osSx = (Math.random() * 2 - 1) * osW; osSy =  osH; }
          else                   { osSx = (Math.random() * 2 - 1) * osW; osSy = -osH; }
          const osDx = playerX - osSx;
          const osDy = playerY - osSy;
          const osDist = Math.sqrt(osDx * osDx + osDy * osDy);
          osSpawn(
            [osSx, osSy, 0.5],
            osDist > 0 ? [osDx / osDist, osDy / osDist, 0] : [0, 1, 0],
            "homing"
          );
        }
        // Interval: 4.5 s at world 1 → 0.9 s at world 9 (challenging but not impossible)
        const osBaseInt = Math.max(0.9, 4.5 - (osWorld - 1) * 0.45);
        offScreenTimerRef.current = osBaseInt * (0.8 + Math.random() * 0.5);
      }
    }
  });
  
  if (!boss) return null;
  
  const healthPercent = boss.health / boss.maxHealth;
  const bossType = boss.bossType || "circle";
  
  if (boss.destroying) {
    const totalTime = BOSS_DEFEAT_DURATION;
    const progress = 1 - ((boss.destroyTimer || 0) / totalTime);

    return (
      <group position={[boss.position[0], boss.position[1], boss.position[2]]}>
        <FireExplosionVFX
          progress={progress}
          bossType={bossType}
          scale={3.5 * BOSS_DEFEAT_SIZE_SCALE}
        />
      </group>
    );
  }
  
  const bossSize = 2.5;
  const time = Date.now() * 0.002;
  const pulse = 1 + Math.sin(time) * 0.06;
  const angryPulse = healthPercent < 0.3 ? 1 + Math.sin(time * 8) * 0.1 : 1;
  
  
  
  const renderBaseSphere = (scale: number, primaryColor: string, secondaryColor: string, glowColor: string) => {
    const size = bossSize * pulse * angryPulse * scale;
    return (
      <>
        <mesh scale={size * 1.12} position={[0, 0, -0.02]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color="#0a0a0a" />
        </mesh>
        <mesh scale={size} position={[0, 0, 0]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color={primaryColor} />
        </mesh>
        <mesh scale={size * 0.75} position={[0.1, 0.1, 0.01]}>
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color={secondaryColor} transparent opacity={0.5} />
        </mesh>
        <mesh scale={size * 0.3} position={[0.4, 0.4, 0.02]}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
      </>
    );
  };
  
  const renderEyes = (style: number, scale: number, eyeColor: string, pupilColor: string = "#000000") => {
    const eyeSpacing = 0.5 * scale;
    const eyeY = 0.15 * scale;
    
    const dirToPlayer = {
      x: playerPosition[0] - boss.position[0],
      y: playerPosition[1] - boss.position[1],
    };
    const distToPlayer = Math.sqrt(dirToPlayer.x ** 2 + dirToPlayer.y ** 2);
    const normX = distToPlayer > 0.01 ? dirToPlayer.x / distToPlayer : 0;
    const normY = distToPlayer > 0.01 ? dirToPlayer.y / distToPlayer : 0;
    
    const maxLookOffset = 0.12 * scale;
    const lookX = normX * maxLookOffset;
    const lookY = normY * maxLookOffset * 0.5;
    
    if (style === 1) {
      return (
        <>
          <mesh position={[-eyeSpacing, eyeY, 0.03]} scale={0.35 * scale}>
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[eyeSpacing, eyeY, 0.03]} scale={0.35 * scale}>
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-eyeSpacing + lookX, eyeY + lookY, 0.04]} scale={0.18 * scale}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color={pupilColor} />
          </mesh>
          <mesh position={[eyeSpacing + lookX, eyeY + lookY, 0.04]} scale={0.18 * scale}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color={pupilColor} />
          </mesh>
          <mesh position={[-eyeSpacing + lookX + 0.05, eyeY + lookY + 0.05, 0.05]} scale={0.06 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
          <mesh position={[eyeSpacing + lookX + 0.05, eyeY + lookY + 0.05, 0.05]} scale={0.06 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
        </>
      );
    }
    
    if (style === 2) {
      const squint = healthPercent < 0.3 ? 0.08 : 0.15;
      return (
        <>
          <mesh position={[-eyeSpacing, eyeY, 0.03]} scale={[0.4 * scale, squint * scale, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[eyeSpacing, eyeY, 0.03]} scale={[0.4 * scale, squint * scale, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-eyeSpacing + lookX, eyeY, 0.04]} scale={0.08 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
          <mesh position={[eyeSpacing + lookX, eyeY, 0.04]} scale={0.08 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
        </>
      );
    }
    
    if (style === 3) {
      return (
        <>
          <mesh position={[0, eyeY + 0.1, 0.03]} scale={0.5 * scale}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[lookX * 2, eyeY + 0.1 + lookY * 2, 0.04]} scale={0.25 * scale}>
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color={pupilColor} />
          </mesh>
          <mesh position={[lookX * 2 + 0.08, eyeY + 0.18 + lookY * 2, 0.05]} scale={0.08 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
          <mesh position={[-0.35 * scale, eyeY - 0.1, 0.03]} scale={0.15 * scale}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.35 * scale, eyeY - 0.1, 0.03]} scale={0.15 * scale}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </>
      );
    }
    
    if (style === 4) {
      const blink = Math.sin(time * 3) > 0.9 ? 0.05 : 0.25;
      return (
        <>
          <mesh position={[-eyeSpacing * 0.8, eyeY, 0.03]} scale={[0.3 * scale, blink * scale, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
          <mesh position={[eyeSpacing * 0.8, eyeY, 0.03]} scale={[0.3 * scale, blink * scale, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color={eyeColor} />
          </mesh>
          <mesh position={[-eyeSpacing * 1.4, eyeY + 0.15, 0.02]} scale={0.12 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} transparent opacity={0.5} />
          </mesh>
          <mesh position={[eyeSpacing * 1.4, eyeY + 0.15, 0.02]} scale={0.12 * scale}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={eyeColor} transparent opacity={0.5} />
          </mesh>
        </>
      );
    }
    
    return (
      <>
        <mesh position={[-eyeSpacing, eyeY, 0.03]} scale={0.25 * scale}>
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        <mesh position={[eyeSpacing, eyeY, 0.03]} scale={0.25 * scale}>
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
      </>
    );
  };
  
  const renderMouth = (style: number, scale: number, color: string) => {
    const mouthY = -0.25 * scale;
    
    if (style === 1) {
      return (
        <mesh position={[0, mouthY, 0.03]} scale={[0.4 * scale, 0.15 * scale, 1]}>
          <circleGeometry args={[1, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      );
    }
    
    if (style === 2) {
      const teeth = [];
      for (let i = 0; i < 5; i++) {
        teeth.push(
          <mesh key={i} position={[-0.2 * scale + i * 0.1 * scale, mouthY + 0.08, 0.04]} scale={0.05 * scale}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        );
      }
      return (
        <>
          <mesh position={[0, mouthY, 0.03]} scale={[0.5 * scale, 0.2 * scale, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
          {teeth}
        </>
      );
    }
    
    if (style === 3) {
      return (
        <>
          <mesh position={[0, mouthY, 0.03]} scale={[0.3 * scale, 0.1 * scale, 1]}>
            <circleGeometry args={[1, 6]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[-0.08 * scale, mouthY + 0.12, 0.03]} scale={0.04 * scale}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.08 * scale, mouthY + 0.12, 0.03]} scale={0.04 * scale}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </>
      );
    }
    
    return null;
  };
  
  const renderDecoration = (type: string, scale: number, color: string) => {
    if (type === "orbiting") {
      return (
        <>
          {[0, 1, 2, 3].map((i) => {
            const angle = (i / 4) * Math.PI * 2 + time * 1.5;
            const dist = bossSize * scale * 0.8;
            return (
              <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.01]} scale={0.2 * scale}>
                <circleGeometry args={[1, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.7} />
              </mesh>
            );
          })}
        </>
      );
    }
    
    if (type === "spikes") {
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            const dist = bossSize * scale * 0.85;
            const spikeScale = 0.15 + Math.sin(time * 4 + i) * 0.05;
            return (
              <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.01]} rotation={[0, 0, angle + Math.PI / 2]} scale={[spikeScale * scale, 0.4 * scale, 1]}>
                <circleGeometry args={[1, 3]} />
                <meshBasicMaterial color={color} />
              </mesh>
            );
          })}
        </>
      );
    }
    
    if (type === "rings") {
      return (
        <>
          <mesh scale={bossSize * scale * 1.1} position={[0, 0, 0.005]} rotation={[0, 0, time * 0.5]}>
            <ringGeometry args={[0.85, 0.95, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} />
          </mesh>
          <mesh scale={bossSize * scale * 0.6} position={[0, 0, 0.006]} rotation={[0, 0, -time * 0.8]}>
            <ringGeometry args={[0.7, 0.85, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} />
          </mesh>
        </>
      );
    }
    
    if (type === "crown") {
      return (
        <>
          {[0, 1, 2].map((i) => {
            const angle = ((i - 1) / 3) * Math.PI * 0.6 + Math.PI / 2;
            const dist = bossSize * scale * 0.7;
            return (
              <mesh key={i} position={[Math.cos(angle) * dist * 0.5, Math.sin(angle) * dist + 0.3, 0.02]} scale={0.25 * scale} rotation={[0, 0, Math.PI]}>
                <circleGeometry args={[1, 3]} />
                <meshBasicMaterial color={color} />
              </mesh>
            );
          })}
        </>
      );
    }
    
    if (type === "tentacles") {
      return (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            const wave = Math.sin(time * 3 + i * 0.5) * 0.3;
            const dist = bossSize * scale * 0.9 + wave;
            return (
              <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist, -0.01]} rotation={[0, 0, angle + Math.PI / 2]} scale={[0.12 * scale, 0.6 * scale, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={color} transparent opacity={0.8} />
              </mesh>
            );
          })}
        </>
      );
    }
    
    if (type === "horns") {
      return (
        <>
          <mesh position={[-0.6 * scale, 0.7 * scale, 0.02]} rotation={[0, 0, 0.4]} scale={[0.15 * scale, 0.5 * scale, 1]}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0.6 * scale, 0.7 * scale, 0.02]} rotation={[0, 0, -0.4]} scale={[0.15 * scale, 0.5 * scale, 1]}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      );
    }
    
    return null;
  };

  if (bossType === "circle") {
    // radius = 2 × player base scale (0.72 × 2 = 1.44)
    const fireRadius = 1.44;
    const fireAmbushPhase = fireAmbushPhaseRef.current;
    const chargeProgress = fireAmbushPhase === "charging"
      ? getFireBossAmbushChargeProgress(
        FIRE_BOSS_AMBUSH_CHARGE_DURATION - fireAmbushTimerRef.current,
      )
      : 0;
    const chargeScale = 1 + getFireBossAmbushChargeSpeedMultiplier(chargeProgress) * 0.7;
    const [dashStartX, dashStartY] = fireAmbushDashStartRef.current;
    const [dashEndX, dashEndY] = fireAmbushDashDestinationRef.current;
    const dashLength = Math.hypot(dashEndX - dashStartX, dashEndY - dashStartY);
    const dashDirection: [number, number, number] = dashLength > 0.001
      ? [(dashEndX - dashStartX) / dashLength, (dashEndY - dashStartY) / dashLength, 0]
      : [0, 1, 0];
    const fireAmbushImpact = boss.fireAmbushImpact;

    return (
      <>
        {fireAmbushImpact && (
          <group
            key={`fire-ambush-impact-${fireAmbushImpact.id}`}
            position={fireAmbushImpact.position}
          >
            <FireExplosionVFX
              progress={getFireBossAmbushImpactProgress(fireAmbushImpact.timer)}
              bossType="circle"
              scale={FIRE_BOSS_AMBUSH_IMPACT_SCALE}
            />
          </group>
        )}
        <group ref={meshRef} position={boss.position}>
          <Suspense fallback={null}>
            <BossVisual type={bossType} radius={fireRadius} healthPercent={healthPercent} />
          </Suspense>
          {(fireAmbushPhase === "repositioning" || fireAmbushPhase === "charging") && (
            <group scale={chargeScale}>
              <FlameAura
                scale={fireRadius * 1.25}
                speedMultiplier={getFireBossAmbushChargeSpeedMultiplier(chargeProgress)}
              />
            </group>
          )}
          {fireAmbushPhase === "dashing" && (
            <group
              rotation={[0, 0, getBackwardFlameAuraRotation(dashDirection)]}
              scale={[1, 1.45, 1]}
            >
              <FlameAura scale={fireRadius * 1.7} speedMultiplier={1.35} />
            </group>
          )}
        </group>
      </>
    );
  }
  
  if (bossType === "star") {
    return (
      <>
        {/* Teleport VFX rendered at world positions — outside the mesh group */}
        <StarBossTeleportVFX vfxRef={starTeleportVFXRef} scale={1.8} />
        <group ref={meshRef} position={boss.position}>
          <Suspense fallback={null}>
            <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
          </Suspense>
        </group>
      </>
    );
  }
  
  if (bossType === "arrow") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  if (bossType === "triangle") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  if (bossType === "trapezoid") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  if (bossType === "cube") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  if (bossType === "cloud") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  if (bossType === "tentacle") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  if (bossType === "monster") {
    return (
      <group ref={meshRef} position={boss.position}>
        <Suspense fallback={null}>
          <BossVisual type={bossType} radius={1.44} healthPercent={healthPercent} />
        </Suspense>
      </group>
    );
  }
  
  return (
    <group ref={meshRef} position={boss.position}>
      {renderBaseSphere(1, "#3a1a4a", "#6a2a8a", "#8844aa")}
      {renderEyes(1, 1, "#ffffff", "#220044")}
    </group>
  );
}
