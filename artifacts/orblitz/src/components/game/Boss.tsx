import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, MovementPattern } from "@/lib/stores/useMagicOrb";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";
import { FireBoss } from "./FireBoss";
import { FireExplosionVFX } from "./FireExplosionVFX";
import { BossShield } from "./BossShield";

const MIN_PLAYER_DISTANCE = 7;
const HARD_COLLISION_RADIUS = 4;
const DODGE_DISTANCE = 3;
const DODGE_SPEED = 8;

interface BossConfig {
  projectileCount: number;
  movementStyle: "drift" | "teleport" | "dash" | "perimeter" | "figure8" | "bounce" | "spiral" | "wave" | "chaos" | "orbit_player";
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
  monster: { projectileCount: 9, movementStyle: "chaos" },
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

// ── Fiery eyes overlay for the FireBoss ──────────────────────────────────────
// Rendered as a sibling to <FireBoss> so it never rotates with the body.
// All eye materials use depthTest={false} so they always paint over the sphere.
function FireBossEyes({ radius, healthPercent }: { radius: number; healthPercent: number }) {
  const eyeSpacingX = 0.42 * radius;
  const eyeY        = 0.22 * radius;
  // Place the eye group slightly beyond the sphere front face (radius + margin).
  // depthTest:false ensures the sclera/iris/pupil always paint on top regardless.
  const eyeZ        = radius + 0.12;

  const scleraR = 0.28 * radius;
  const irisR   = 0.19 * radius;
  const pupilR  = 0.10 * radius;
  const glowR   = 0.44 * radius;
  const maxLook = 0.12 * radius;

  const lPupilRef = useRef<THREE.Mesh>(null);
  const rPupilRef = useRef<THREE.Mesh>(null);
  const lGlowRef  = useRef<THREE.Mesh>(null);
  const rGlowRef  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t     = clock.getElapsedTime();
    const state = useMagicOrb.getState();
    const boss  = state.boss;
    if (!boss) return;

    // Direction from boss world position to player world position
    const dx   = state.playerPosition[0] - boss.position[0];
    const dy   = state.playerPosition[1] - boss.position[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx   = dist > 0.01 ? dx / dist : 0;
    const ny   = dist > 0.01 ? dy / dist : 0;

    const lookX = nx * maxLook;
    const lookY = ny * maxLook * 0.65;

    lPupilRef.current?.position.set(lookX, lookY, 0.02);
    rPupilRef.current?.position.set(lookX, lookY, 0.02);

    // Glow pulses faster and brighter in anger phase
    const pulseFreq = healthPercent < 0.3 ? 9.0 : 2.8;
    const glowBase  = healthPercent < 0.3 ? 0.55 : 0.28;
    const glowAmt   = glowBase + Math.sin(t * pulseFreq) * 0.16;
    const lMat = lGlowRef.current?.material as THREE.MeshBasicMaterial | undefined;
    const rMat = rGlowRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (lMat) lMat.opacity = glowAmt;
    if (rMat) rMat.opacity = glowAmt;
  });

  const eye = (
    side: -1 | 1,
    pupilRef: React.RefObject<THREE.Mesh>,
    glowRef:  React.RefObject<THREE.Mesh>,
  ) => (
    <group key={side} position={[side * eyeSpacingX, eyeY, eyeZ]}>
      {/* Outer flame glow halo — additive, opacity driven by useFrame */}
      <mesh ref={glowRef} renderOrder={101}>
        <circleGeometry args={[glowR, 16]} />
        <meshBasicMaterial
          color="#ff5500"
          transparent opacity={0.28}
          depthTest={false} depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Sclera — warm amber rather than stark white */}
      <mesh renderOrder={102}>
        <circleGeometry args={[scleraR, 16]} />
        <meshBasicMaterial color="#ffe4bb" depthTest={false} depthWrite={false} />
      </mesh>
      {/* Iris — deep orange-red ring */}
      <mesh position={[0, 0, 0.01]} renderOrder={103}>
        <circleGeometry args={[irisR, 12]} />
        <meshBasicMaterial color="#cc2000" depthTest={false} depthWrite={false} />
      </mesh>
      {/* Pupil — dark, tracked by useFrame */}
      <mesh ref={pupilRef} renderOrder={104}>
        <circleGeometry args={[pupilR, 8]} />
        <meshBasicMaterial color="#080000" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );

  return (
    <>
      {eye(-1, lPupilRef, lGlowRef)}
      {eye( 1, rPupilRef, rGlowRef)}
    </>
  );
}

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
      const dx = bossPos[0] - proj.position[0];
      const dy = bossPos[1] - proj.position[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < DODGE_DISTANCE) {
        const dotProduct = proj.direction[0] * -dx + proj.direction[1] * -dy;
        if (dotProduct > 0) {
          threatened = true;
          threatCount++;
          const perpX = -proj.direction[1];
          const perpY = proj.direction[0];
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
    if (!boss) return;
    
    const time = state.clock.getElapsedTime();
    
    if (boss.destroying) {
      const newTimer = (boss.destroyTimer || 0) - delta;
      if (newTimer > 0) {
        useMagicOrb.getState().updateBoss({ ...boss, destroyTimer: newTimer });
      } else {
        // Reset per-boss local accumulators so they re-initialise on next spawn.
        bossPosRef.current          = [0, 0, 0];
        localAngleRef.current       = null;
        localAttackTimerRef.current = null;
        frameCountRef.current       = 0;
        useMagicOrb.setState({ boss: null });
        if (gameMode === "survival") {
          useMagicOrb.setState({ survivalBossTimer: 0, survivalBossPending: false });
        } else {
          useMagicOrb.getState().completeLevel();
        }
      }
      return;
    }
    
    if (phase !== "playing") return;
    if (!meshRef.current) return;

    // Seed bossPosRef from Zustand on the first frame after each spawn.
    // After that it is kept in sync imperatively every frame, making the
    // lerp start independent of whether we called updateBoss last frame.
    if (bossPosRef.current[0] === 0 && bossPosRef.current[1] === 0 &&
        (boss.position[0] !== 0 || boss.position[1] !== 0)) {
      bossPosRef.current = [boss.position[0], boss.position[1], boss.position[2] || 0];
    }
    // Derive a single local angle value seeded from Zustand on first frame.
    // All switch cases and the outer increment read this so angle never
    // under-accumulates on frames where the Zustand write is throttled.
    const localAngle = localAngleRef.current ?? boss.angle;

    // Hoist bossType early — shield and movement both need it
    const bossType = boss.bossType || "circle";
    const config   = BOSS_CONFIGS[bossType] || BOSS_CONFIGS.circle;

    // Shield — permanently disabled for the FireBoss (circle) which relies on
    // fluid movement for survival rather than a passive damage-block.
    let shieldActive  = false;
    let shieldTimer   = 0;
    let shieldCooldown = 0;

    if (bossType !== "circle") {
      shieldActive  = boss.shieldActive  || false;
      shieldTimer   = boss.shieldTimer   || 0;
      shieldCooldown = boss.shieldCooldown || 0;

      if (shieldActive) {
        shieldTimer -= delta;
        if (shieldTimer <= 0) {
          shieldActive   = false;
          shieldTimer    = 0;
          shieldCooldown = 10;
        }
      } else if (shieldCooldown > 0) {
        shieldCooldown -= delta;
        if (shieldCooldown <= 0) {
          shieldActive  = true;
          shieldTimer   = 5;
          shieldCooldown = 0;
        }
      } else if (!shieldActive && shieldCooldown <= 0) {
        shieldActive = true;
        shieldTimer  = 5;
      }
    }
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
            const spread = 0.3;
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
        phaseTimerRef.current -= delta;
        if (phaseTimerRef.current <= 0 || threatened) {
          const teleportAngle = Math.random() * Math.PI * 2;
          const teleportDist = 5 + Math.random() * 4;
          targetX = Math.cos(teleportAngle) * teleportDist;
          targetY = Math.sin(teleportAngle) * teleportDist;
          targetX = Math.max(-playAreaWidth, Math.min(playAreaWidth, targetX));
          targetY = Math.max(-playAreaHeight + 2, Math.min(playAreaHeight, targetY));
          lerpSpeed = 50;
          phaseTimerRef.current = 1.5 + Math.random() * 2;
        } else {
          targetX = bossPosRef.current[0];
          targetY = bossPosRef.current[1];
          lerpSpeed = 0.5;
        }
        break;
      }
      case "dash": {
        const dashPhase = Math.floor(time * 0.8) % 4;
        const dashProgress = (time * 0.8) % 1;
        const dashTargets = [
          [playAreaWidth * 0.8, playAreaHeight * 0.5],
          [-playAreaWidth * 0.8, playAreaHeight * 0.5],
          [-playAreaWidth * 0.8, -playAreaHeight * 0.5],
          [playAreaWidth * 0.8, -playAreaHeight * 0.5],
        ];
        const currentTarget = dashTargets[dashPhase];
        const nextTarget = dashTargets[(dashPhase + 1) % 4];
        if (dashProgress < 0.3) {
          targetX = currentTarget[0];
          targetY = currentTarget[1];
          lerpSpeed = 1;
        } else {
          targetX = nextTarget[0];
          targetY = nextTarget[1];
          lerpSpeed = 12;
        }
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
      case "orbit_player": {
        // ── FireBoss easy-mode fluid orbit ──────────────────────────────
        // Slow, readable orbit that the player can learn to dodge.
        // Projectile avoidance is a gentle angle nudge, not a snap.
        const healthFrac = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 1;

        // Speed ramps very gently with damage — stays easy the whole fight
        const orbitSpeed = 0.55 + (1 - healthFrac) * 0.20; // 0.55–0.75 rad/s

        // Advance orbit angle smoothly every frame
        fireOrbitAngleRef.current += delta * orbitSpeed;

        // Gentle avoidance: when a projectile is close, nudge the angle
        // sideways by a small amount rather than snapping hard.
        // This keeps motion continuous and readable.
        if (threatened && dodgeTimerRef.current >= 0.28) {
          const bias = dodgeDirRef.current[0] >= 0 ? 1 : -1;
          fireOrbitAngleRef.current += bias * Math.PI * 0.18;
        }

        // Radius breathes slowly — feels organic, not mechanical
        const orbitRadius = 7.5 + Math.sin(time * 0.25) * 1.8;
        targetX = playerX + Math.cos(fireOrbitAngleRef.current) * orbitRadius;
        targetY = playerY + Math.sin(fireOrbitAngleRef.current) * orbitRadius;

        // Clamp to play area
        targetX = Math.max(-playAreaWidth, Math.min(playAreaWidth, targetX));
        targetY = Math.max(-playAreaHeight + 2, Math.min(playAreaHeight, targetY));

        // Smooth, constant chase speed — no snappy acceleration on threat
        lerpSpeed = 3.5;
        break;
      }
    }
    
    // bossPosRef is updated every frame so it's never stale, even on frames
    // where we skip the Zustand write.  Math.min(1, …) prevents overshooting
    // on large-delta frames (slow mobile, background tabs).
    const lerpFactor = Math.min(1, delta * lerpSpeed);
    let finalX = bossPosRef.current[0] + (targetX - bossPosRef.current[0]) * lerpFactor;
    let finalY = bossPosRef.current[1] + (targetY - bossPosRef.current[1]) * lerpFactor;
    
    const safePos = keepDistanceFromPlayer([finalX, finalY, 0], [playerX, playerY, 0], MIN_PLAYER_DISTANCE, delta);
    finalX = safePos[0];
    finalY = safePos[1];

    // bossPosRef tracks the true visual position every frame — it's the authoritative
    // source for next frame's lerp start, independent of Zustand sync frequency.
    bossPosRef.current = [finalX, finalY, 0];

    // Initialise localAttackTimerRef from Zustand once per boss spawn, then
    // count down locally so the attack cadence is accurate on throttled frames.
    if (localAttackTimerRef.current === null) localAttackTimerRef.current = boss.attackTimer;
    const attackResult = fireProjectiles([finalX, finalY, 0], localAttackTimerRef.current, attackBurstRef.current);
    localAttackTimerRef.current = attackResult.timer;
    attackBurstRef.current = attackResult.burst;
    // Accumulate locally every frame so Zustand's boss.angle (written only on
    // even frames) never causes an under-accumulation of the orbit angle.
    const newAngle = localAngle + delta * 0.5;
    localAngleRef.current = newAngle;

    // Throttle Zustand writes to every 2 frames — halves re-render pressure on
    // all 138 store subscribers with no perceptible gameplay or visual impact
    // (the mesh is driven imperatively every frame via meshRef below).
    frameCountRef.current++;
    if (frameCountRef.current % 2 === 0) {
      useMagicOrb.getState().updateBoss({
        ...boss,
        position: [finalX, finalY, 0],
        angle: newAngle,
        attackTimer: attackResult.timer,
        shieldActive,
        shieldTimer,
        shieldCooldown,
        bounceVelocity: newBounceVelocity,
      });
    }

    meshRef.current.position.set(finalX, finalY, 0);
  });
  
  if (!boss) return null;
  
  const healthPercent = boss.health / boss.maxHealth;
  const bossType = boss.bossType || "circle";
  
  if (boss.destroying) {
    const totalTime = 3.5;
    const progress = 1 - ((boss.destroyTimer || 0) / totalTime);

    // Fire Boss gets its own massive fire explosion
    if (bossType === "circle") {
      return (
        <group position={[boss.position[0], boss.position[1], boss.position[2]]}>
          <FireExplosionVFX progress={progress} scale={3.5} />
        </group>
      );
    }

    const bossTypeColors: Record<string, { color: string; glow: string }> = {
      circle:  { color: "#ff3366", glow: "#ff99bb" },
      star:    { color: "#ffcc00", glow: "#fff066" },
      triangle:{ color: "#00ffcc", glow: "#aaffee" },
      square:  { color: "#6699ff", glow: "#bbccff" },
      octagon: { color: "#ff66ff", glow: "#ffbbff" },
      cross:   { color: "#ff9933", glow: "#ffcc88" },
    };
    const deathBossType = boss.bossType || "circle";
    const deathPalette = bossTypeColors[deathBossType] ?? bossTypeColors.circle;
    return (
      <group position={[boss.position[0], boss.position[1], boss.position[2]]}>
        <EnergyDissipationVFX
          progress={progress}
          color={deathPalette.color}
          glowColor={deathPalette.glow}
          scale={3.2}
          seed={13}
        />
      </group>
    );
  }
  
  const bossSize = 2.5;
  const time = Date.now() * 0.002;
  const pulse = 1 + Math.sin(time) * 0.06;
  const angryPulse = healthPercent < 0.3 ? 1 + Math.sin(time * 8) * 0.1 : 1;
  
  // Shield is now rendered as <BossShield bossType={bossType} /> at each call-site
  
  
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
    return (
      <group ref={meshRef} position={boss.position}>
        <FireBoss radius={fireRadius} healthPercent={healthPercent} />
        <FireBossEyes radius={fireRadius} healthPercent={healthPercent} />
      </group>
    );
  }
  
  if (bossType === "star") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1.05, "#1a2a4a", "#2a4a8a", "#4488ff")}
        {renderDecoration("rings", 1.05, "#6699ff")}
        {renderEyes(2, 1.05, "#88ccff")}
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2 + time * 0.5;
          const dist = bossSize * 1.05 * 0.95;
          return (
            <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.02]} scale={0.35} rotation={[0, 0, angle]}>
              <circleGeometry args={[1, 4]} />
              <meshBasicMaterial color="#4488ff" />
            </mesh>
          );
        })}
      </group>
    );
  }
  
  if (bossType === "arrow") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(0.95, "#4a2a1a", "#8a5a2a", "#ff8844")}
        {renderDecoration("spikes", 0.95, "#ff6622")}
        {renderEyes(4, 0.95, "#ffaa44")}
        <mesh position={[0, bossSize * 0.65, 0.03]} rotation={[0, 0, 0]}>
          <circleGeometry args={[0.5, 3]} />
          <meshBasicMaterial color="#ff4400" />
        </mesh>
        <mesh position={[0, bossSize * 0.65, 0.04]} rotation={[0, 0, 0]} scale={0.6}>
          <circleGeometry args={[0.5, 3]} />
          <meshBasicMaterial color="#ffaa00" />
        </mesh>
      </group>
    );
  }
  
  if (bossType === "triangle") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1, "#1a3a2a", "#2a6a4a", "#44ff88")}
        {renderDecoration("crown", 1, "#22aa44")}
        {renderEyes(3, 1, "#88ffaa", "#002200")}
        {renderMouth(3, 1, "#114422")}
        {[0, 1, 2].map((i) => {
          const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
          const dist = bossSize * 0.85;
          return (
            <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.01]} scale={0.3} rotation={[0, 0, angle + Math.PI / 6]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#33cc66" transparent opacity={0.7} />
            </mesh>
          );
        })}
      </group>
    );
  }
  
  if (bossType === "trapezoid") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1.05, "#4a1a2a", "#8a2a4a", "#ff4488")}
        {renderEyes(1, 1.05, "#ffffff", "#440022")}
        {renderMouth(2, 1.05, "#220011")}
        <mesh scale={[bossSize * 1.1, bossSize * 0.5, 1]} position={[0, -0.4, 0.01]}>
          <circleGeometry args={[1, 4]} />
          <meshBasicMaterial color="#882244" transparent opacity={0.6} />
        </mesh>
        {renderDecoration("orbiting", 1.05, "#cc4488")}
      </group>
    );
  }
  
  if (bossType === "cube") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1.1, "#2a2a4a", "#4a4a8a", "#8888ff")}
        {renderEyes(2, 1.1, "#aaaaff")}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4 + time * 0.3;
          const dist = bossSize * 0.7;
          return (
            <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.02]} scale={0.35} rotation={[0, 0, time + i]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#6666cc" />
            </mesh>
          );
        })}
        <mesh scale={bossSize * 0.5} position={[0, 0, 0.015]} rotation={[0, 0, time * 0.5]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#4444aa" transparent opacity={0.4} />
        </mesh>
      </group>
    );
  }
  
  if (bossType === "cloud") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1.15, "#3a3a4a", "#5a5a6a", "#aaaacc")}
        {renderEyes(4, 1.15, "#ccccff")}
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * bossSize * 0.35, bossSize * 0.4 + Math.sin(time * 2 + i) * 0.15, -0.02]} scale={0.6 + Math.abs(i) * 0.1}>
            <circleGeometry args={[1, 20]} />
            <meshBasicMaterial color="#666688" transparent opacity={0.5} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => {
          const x = (i - 1.5) * 0.4;
          const drop = Math.sin(time * 4 + i * 2) * 0.3;
          return (
            <mesh key={i} position={[x, -bossSize * 0.6 - drop, 0.01]} scale={0.15}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#aabbff" transparent opacity={0.6} />
            </mesh>
          );
        })}
      </group>
    );
  }
  
  if (bossType === "tentacle") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1.1, "#1a3a3a", "#2a6a6a", "#44ffcc")}
        {renderDecoration("tentacles", 1.1, "#228888")}
        {renderEyes(3, 1.1, "#88ffdd", "#003333")}
        {renderMouth(1, 1.1, "#114444")}
        {[0, 1, 2].map((i) => {
          const x = (i - 1) * 0.6;
          const wobble = Math.sin(time * 5 + i * 2) * 0.1;
          return (
            <mesh key={i} position={[x, 0.3 + wobble, 0.025]} scale={0.12}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#66ffcc" />
            </mesh>
          );
        })}
      </group>
    );
  }
  
  if (bossType === "monster") {
    return (
      <group ref={meshRef} position={boss.position}>
        {boss.shieldActive && <BossShield bossType={bossType} />}

        {renderBaseSphere(1.2, "#3a1a1a", "#6a2a2a", "#ff4444")}
        {renderDecoration("horns", 1.2, "#882222")}
        {renderEyes(1, 1.2, "#ffff00", "#440000")}
        {renderMouth(2, 1.2, "#220000")}
        <mesh position={[0, 0, 0.01]} scale={bossSize * 0.4} rotation={[0, 0, time * 2]}>
          <ringGeometry args={[0.5, 0.7, 6]} />
          <meshBasicMaterial color="#ff2200" transparent opacity={0.3} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + time;
          const dist = 0.5;
          return (
            <mesh key={i} position={[Math.cos(angle) * dist, Math.sin(angle) * dist - 0.2, 0.03]} scale={0.08}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color="#ff6644" />
            </mesh>
          );
        })}
      </group>
    );
  }
  
  return (
    <group ref={meshRef} position={boss.position}>
      {boss.shieldActive && <BossShield bossType={bossType} />}
      {renderBaseSphere(1, "#3a1a4a", "#6a2a8a", "#8844aa")}
      {renderEyes(1, 1, "#ffffff", "#220044")}
    </group>
  );
}
