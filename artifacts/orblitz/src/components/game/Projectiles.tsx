import { useRef, useMemo, memo, Suspense, useState, useEffect, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb, DarkOrb, Projectile, Particle, ImpactEffect } from "@/lib/stores/useMagicOrb";
import { StarBossTeleportVFX, StarTeleportVFXState } from "./StarBossTeleportVFX";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop, TrailEffect } from "@/lib/stores/useShop";
import { getSkinColors } from "./PlayerOrb";
import { FireAuraVFX } from "./FlameAura";
import { PlayerParticles } from "./PlayerParticles";
import { MiniStarOrb } from "./MiniStarOrb";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";
import {
  getProjectileMotion,
  getLiveProjectileMotion,
  projectilePhysicsMap,
  releaseProjectileMotion,
  resetProjectileMotion,
} from "./ProjectilePhysics";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { MAX_RUNTIME_PROJECTILES } from "@/game-runtime/ProjectileRuntime";
import { usePerformanceFeature } from "@/game-runtime/PerformanceToggles";
import { sweptSphereHit } from "./ProjectileCollision";
import {
  getPlayerOrbScale,
  getPlayerProjectileSpawnVfxScale,
  getPlayerProjectileVisualScale,
  isPlayerProjectile,
  shouldRenderParticleSwarmOverlay,
  usesSharedPlayerProjectileCore,
} from "./PlayerProjectileVisualConfig";
import {
  getPlayerSkinModelPath,
  getPlayerSkinTrailPalette,
  getPlayerSkinVisualYaw,
  type PlayerSkinTrailPalette,
} from "./PlayerSkinVisualConfig";
import { clonePlayerOrbMaterial } from "./PlayerOrbMaterial";
import {
  OverchargedExplosionVFX,
  OVERCHARGED_BUILD_DURATION,
  createOverchargedExplosionPool,
  emitOverchargedExplosion,
  resetOverchargedExplosionPool,
} from "./OverchargedExplosionVFX";
import {
  BOSS_BODY_RADIUS,
  POWER_UP_BODY_RADIUS,
  getBossImpactPosition,
  getPlayerProjectileBodyRadius,
  getProjectileEnemyCollisionRadius,
  getStandardEnemyBodyRadius,
} from "./PhysicalBodyRadii";
import { getEnemyStarRewardCount } from "@/game-runtime/EnemyLifecycle";
import { getWeaponConfig } from "@/game-runtime/WeaponProgression";

/** Projectile collision always reads live enemy transforms, never store snapshots. */
function liveOrbPosition(orb: DarkOrb): [number, number, number] {
  return gameRuntime.enemies.get(orb.id)?.position ?? orb.position;
}

const ENEMY_GRID_CELL_SIZE = 4;
const ENEMY_GRID_KEY_OFFSET = 128;
const ENEMY_GRID_KEY_STRIDE = 512;
const compareEnemyIndices = (a: number, b: number) => a - b;
// DarkOrbs renders/spawns through approximately x ±28 / y ±18. Projectiles
// must remain alive across that whole envelope so distance from the center
// cannot make a rendered enemy impossible to hit.
const PROJECTILE_WORLD_BOUNDARY_X = 32;
const PROJECTILE_WORLD_BOUNDARY_Y = 24;

/**
 * Reusable broad-phase index for projectile collisions.
 *
 * Every enemy is inserted once using its live runtime transform. Queries return
 * source-array indices in their original order, so the existing deterministic
 * swept-hit and piercing behavior remains unchanged while avoiding full scans.
 */
class EnemyCollisionGrid {
  private readonly buckets = new Map<number, number[]>();
  private readonly activeKeys: number[] = [];
  private readonly candidates: number[] = [];

  build(orbs: readonly DarkOrb[]): void {
    for (const key of this.activeKeys) this.buckets.get(key)!.length = 0;
    this.activeKeys.length = 0;

    for (let index = 0; index < orbs.length; index++) {
      const orb = orbs[index];
      if (orb.destroying) continue;
      const runtimeEnemy = gameRuntime.enemies.get(orb.id);
      const position = runtimeEnemy?.position ?? orb.position;
      const previousPosition = runtimeEnemy?.previousPosition ?? orb.position;
      const startX = Math.floor(Math.min(position[0], previousPosition[0]) / ENEMY_GRID_CELL_SIZE);
      const endX = Math.floor(Math.max(position[0], previousPosition[0]) / ENEMY_GRID_CELL_SIZE);
      const startY = Math.floor(Math.min(position[1], previousPosition[1]) / ENEMY_GRID_CELL_SIZE);
      const endY = Math.floor(Math.max(position[1], previousPosition[1]) / ENEMY_GRID_CELL_SIZE);

      // Insert every cell touched by the enemy's swept transform. The narrow
      // phase still decides the hit; this only guarantees it is never omitted.
      for (let cellX = startX; cellX <= endX; cellX++) {
        for (let cellY = startY; cellY <= endY; cellY++) {
          const key = (cellX + ENEMY_GRID_KEY_OFFSET) * ENEMY_GRID_KEY_STRIDE + cellY + ENEMY_GRID_KEY_OFFSET;
          let bucket = this.buckets.get(key);
          if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
          }
          if (bucket.length === 0) this.activeKeys.push(key);
          bucket.push(index);
        }
      }
    }
  }

  queryAabb(minX: number, maxX: number, minY: number, maxY: number): readonly number[] {
    const output = this.candidates;
    output.length = 0;
    const startX = Math.floor(minX / ENEMY_GRID_CELL_SIZE);
    const endX = Math.floor(maxX / ENEMY_GRID_CELL_SIZE);
    const startY = Math.floor(minY / ENEMY_GRID_CELL_SIZE);
    const endY = Math.floor(maxY / ENEMY_GRID_CELL_SIZE);

    for (let cellX = startX; cellX <= endX; cellX++) {
      for (let cellY = startY; cellY <= endY; cellY++) {
        const key = (cellX + ENEMY_GRID_KEY_OFFSET) * ENEMY_GRID_KEY_STRIDE + cellY + ENEMY_GRID_KEY_OFFSET;
        const bucket = this.buckets.get(key);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) output.push(bucket[i]);
      }
    }

    // Cell traversal is spatial, while the original loop order is source-array
    // order. Restore source order and deduplicate swept-cell entries to keep
    // first-hit selection and per-projectile damage exactly deterministic.
    output.sort(compareEnemyIndices);
    let writeIndex = 0;
    for (let index = 0; index < output.length; index++) {
      if (index === 0 || output[index] !== output[index - 1]) {
        output[writeIndex++] = output[index];
      }
    }
    output.length = writeIndex;
    return output;
  }
}

const TRAIL_CONFIGS: Record<TrailEffect, { colors: string[]; particleCount: number; spread: number; glow: boolean }> = {
  none:           { colors: [],                                                                             particleCount: 0,  spread: 0.00, glow: false },
  sparkle:        { colors: ["#ffffff", "#ffff88", "#ffffcc", "#88ffff"],                                  particleCount: 8,  spread: 0.15, glow: true  },
  fire:           { colors: ["#ff4400", "#ff6600", "#ff8800", "#ffcc00", "#ffff00"],                       particleCount: 10, spread: 0.20, glow: true  },
  ice:            { colors: ["#88ddff", "#aaeeff", "#ccffff", "#ffffff", "#66ccff"],                       particleCount: 8,  spread: 0.12, glow: true  },
  cosmic:         { colors: ["#ff00ff", "#8800ff", "#4400ff", "#0088ff", "#00ffff"],                       particleCount: 12, spread: 0.18, glow: true  },
  lightning:      { colors: ["#ffff00", "#ffffff", "#88ffff", "#ffffaa"],                                  particleCount: 10, spread: 0.25, glow: true  },
  rainbow:        { colors: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#00ffff", "#0088ff", "#ff00ff"], particleCount: 14, spread: 0.20, glow: true  },
  plasma:         { colors: ["#ff00ff", "#ff44ff", "#ff88ff", "#ffffff", "#88ffff"],                       particleCount: 10, spread: 0.22, glow: true  },
  shadow:         { colors: ["#330033", "#440044", "#550055", "#220022", "#110011"],                       particleCount: 8,  spread: 0.18, glow: false },
  stardust:       { colors: ["#ffffff", "#ffccff", "#ccffff", "#ffffcc", "#ffddee"],                       particleCount: 16, spread: 0.20, glow: true  },
  meteor:         { colors: ["#ff4400", "#ff2200", "#ff6600", "#ff0000", "#ffaa00"],                       particleCount: 12, spread: 0.25, glow: true  },
  spirit:         { colors: ["#88ffff", "#aaddff", "#ccffff", "#ffffff", "#66ddff"],                       particleCount: 10, spread: 0.15, glow: true  },
  neon:           { colors: ["#00ff88", "#ff00ff", "#00ffff", "#ffff00", "#88ff00"],                       particleCount: 10, spread: 0.18, glow: true  },
  sakura:         { colors: ["#ffaacc", "#ff88aa", "#ffccdd", "#ffffff", "#ffbbdd"],                       particleCount: 12, spread: 0.22, glow: true  },
  galaxy:         { colors: ["#0000ff", "#4400ff", "#8800ff", "#ff00ff", "#00ffff", "#ffffff"],            particleCount: 14, spread: 0.20, glow: true  },
  particle_swarm: { colors: [],                                                                             particleCount: 0,  spread: 0.00, glow: false },
  flame_aura:     { colors: ["#cc1100", "#ff3300", "#ff6600", "#ff9900", "#ffcc00"],                        particleCount: 10, spread: 0.20, glow: true  },
};

interface TrailParticleData {
  offset: number;
  angle: number;
  size: number;
  colorIndex: number;
  wobble: number;
}

function HDTrailEffect({ 
  trailType, 
  projectile,
  baseScale,
  projectileColor 
}: { 
  trailType: TrailEffect; 
  projectile: Projectile;
  baseScale: number;
  projectileColor: string;
}) {
  const config = TRAIL_CONFIGS[trailType];
  const particleRefs = useRef<Array<THREE.Mesh | null>>([]);
  if (!config || config.particleCount === 0) return null;

  const particles = useMemo<TrailParticleData[]>(() => {
    const result: TrailParticleData[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      result.push({
        offset: i * 0.15,
        angle: (Math.random() - 0.5) * config.spread * 2,
        size: 0.5 + Math.random() * 0.65,
        colorIndex: i % config.colors.length,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    return result;
  }, [config.particleCount, config.colors.length, config.spread]);

  // Projectile transforms live outside React state. Update trail offsets from
  // the same live direction the collision loop uses so steering never leaves
  // a visual trail pointing away from the actual shot.
  useFrame(({ clock }) => {
    const direction = getLiveProjectileMotion(projectile)?.direction;
    if (!direction) return;
    const time = clock.getElapsedTime();
    for (let i = 0; i < particles.length; i++) {
      const mesh = particleRefs.current[i];
      if (!mesh) continue;
      const p = particles[i];
      const trailDist = p.offset * 1.6;
      const wobbleX = Math.sin(time * 3.2 + p.wobble) * config.spread * baseScale;
      const wobbleY = Math.cos(time * 2.7 + p.wobble) * config.spread * baseScale;
      const wobbleZ = Math.sin(time * 4.1 + p.wobble * 1.7) * config.spread * baseScale * 0.6;
      mesh.position.set(
        -direction[0] * trailDist + wobbleX,
        -direction[1] * trailDist + wobbleY,
        wobbleZ,
      );
    }
  });

  return (
    <group>
      {particles.map((p, i) => {
        // The active trail renderer is batched in ProjectileTrails. This
        // fallback is retained only for compatibility and has no frame-time
        // dependent JSX calculations.
        const time = 0;
        const trailDist = p.offset * 1.6;
        const wobbleX   = Math.sin(time * 3.2 + p.wobble) * config.spread * baseScale;
        const wobbleY   = Math.cos(time * 2.7 + p.wobble) * config.spread * baseScale;
        const wobbleZ   = Math.sin(time * 4.1 + p.wobble * 1.7) * config.spread * baseScale * 0.6;
        const sizeM     = Math.max(0.05, 1 - i / config.particleCount);
        const scale     = baseScale * 0.44 * p.size * sizeM;
        const color     = config.colors[p.colorIndex] ?? projectileColor;
        const fadeOut   = Math.max(0, 1 - trailDist * 1.8);

        return (
          <mesh
            key={i}
            ref={(mesh) => { particleRefs.current[i] = mesh; }}
            position={[
              -projectile.direction[0] * trailDist + wobbleX,
              -projectile.direction[1] * trailDist + wobbleY,
              wobbleZ,
            ]}
            scale={scale}
          >
            <sphereGeometry args={[1, 5, 4]} />
            <meshBasicMaterial color={color} transparent opacity={fadeOut * 0.88} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

const MemoizedHDTrailEffect = memo(HDTrailEffect);
const BACKDRAFT_TRAIL_SCALE_MULTIPLIER = 1.25 * 1.5;
const BACKDRAFT_TRAIL_OFFSET_MULTIPLIER = 0.6;
const BACKDRAFT_TRAIL_LENGTH_MULTIPLIER = 1.4;

export function getBackwardFlameAuraRotation(direction: readonly [number, number, number]): number {
  return Math.atan2(direction[0], -direction[1]);
}

/**
 * Reuses the authored FlameAura particle system as a projectile trail. FlameAura
 * grows along local +Y, so the wrapper rotates that axis onto the projectile's
 * live negative flight direction without changing the effect itself.
 */
function FlameAuraProjectileTrail({
  projectile,
  playerScale,
}: {
  projectile: Projectile;
  playerScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const projectileRef = useRef(projectile);
  projectileRef.current = projectile;
  const flameScale = getPlayerProjectileVisualScale(
    projectile,
    projectile.spawnScale ?? 1,
    playerScale,
  ) * BACKDRAFT_TRAIL_SCALE_MULTIPLIER;

  useFrame(() => {
    const group = groupRef.current;
    const motion = getLiveProjectileMotion(projectileRef.current);
    if (!group || !motion) {
      if (group) group.visible = false;
      return;
    }

    group.visible = true;
    const trailOffset = flameScale * BACKDRAFT_TRAIL_OFFSET_MULTIPLIER;
    group.position.set(
      motion.position[0] - motion.direction[0] * trailOffset,
      motion.position[1] - motion.direction[1] * trailOffset,
      motion.position[2] - motion.direction[2] * trailOffset,
    );
    // FlameAura's local +Y points away from the projectile after this rotation.
    group.rotation.z = getBackwardFlameAuraRotation(motion.direction);
  });

  return (
    <group ref={groupRef} visible={false}>
      <FireAuraVFX
        scale={flameScale}
        lengthMultiplier={BACKDRAFT_TRAIL_LENGTH_MULTIPLIER}
      />
    </group>
  );
}

// SpiralBraidMesh removed — replaced by the full OrbitalSpiralBlaster SpiralBundleMesh below

const MAX_BATCHED_PROJECTILES = MAX_RUNTIME_PROJECTILES;
const PLAYER_FIRE_BURST_PARTICLES = 6;
const MAX_PLAYER_FIRE_BURSTS = 16;
const MAX_PLAYER_FIRE_BURST_PARTICLES = PLAYER_FIRE_BURST_PARTICLES * MAX_PLAYER_FIRE_BURSTS;
const _batchedProjectileDummy = new THREE.Object3D();
const _batchedRapidTrailGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
const _batchedProjectileAxis = new THREE.Vector3(0, 1, 0);
const _batchedProjectileDirection = new THREE.Vector3();
const _batchedModelTransform = new THREE.Matrix4();
const _batchedModelInstanceMatrix = new THREE.Matrix4();
const _batchedModelRotation = new THREE.Quaternion();
const _batchedModelEuler = new THREE.Euler();
const _batchedModelScale = new THREE.Vector3(1, 1, 1);
const _batchedModelPosition = new THREE.Vector3();

type PlayerFireBurstPalette = {
  particles: readonly string[];
  core: string;
  glow: string;
  isRainbow?: boolean;
};

type PlayerFireBurstSlot = {
  active: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  scale: number;
  color: string;
  phase: number;
};

type PlayerFireBurstCoreSlot = {
  active: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  scale: number;
  core: string;
  glow: string;
};

export type PlayerProjectileSpawnPresentationEvent = {
  type: string | undefined;
  size?: number;
  position: readonly [number, number, number];
  direction: readonly [number, number, number];
};

export type PlayerFireBurstPool = {
  bursts: PlayerFireBurstCoreSlot[];
  slots: PlayerFireBurstSlot[];
  nextBurstSlot: number;
  nextSlot: number;
};

/** A fixed-size presentation pool: firing effects can never create shot JSX. */
export function createPlayerFireBurstPool(): PlayerFireBurstPool {
  return {
    bursts: Array.from({ length: MAX_PLAYER_FIRE_BURSTS }, () => ({
      active: false, age: 0, x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0,
      scale: 1, core: "#ffffff", glow: "#ffffff",
    })),
    slots: Array.from({ length: MAX_PLAYER_FIRE_BURST_PARTICLES }, (_, index) => ({
      active: false, age: 0, x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0,
      scale: 1, color: "#ffffff", phase: index * 2.399963229728653,
    })),
    nextBurstSlot: 0,
    nextSlot: 0,
  };
}

export function resetPlayerFireBurstPool(pool: PlayerFireBurstPool): void {
  pool.nextBurstSlot = 0;
  pool.nextSlot = 0;
  for (const burst of pool.bursts) {
    burst.active = false;
    burst.age = 0;
  }
  for (const slot of pool.slots) {
    slot.active = false;
    slot.age = 0;
  }
}

/**
 * Records a compact burst at the admitted spawn transform. The ring allocator
 * intentionally overwrites the oldest visual particle under sustained fire;
 * this has no simulation/store side effects and a dropped event is harmless.
 */
export function emitPlayerProjectileFireBurst(
  pool: PlayerFireBurstPool,
  event: PlayerProjectileSpawnPresentationEvent,
  palette: PlayerFireBurstPalette,
): void {
  const colors = palette.particles.length > 0
    ? palette.particles
    : [palette.core, palette.glow];
  const burstScale = getPlayerProjectileSpawnVfxScale({
    size: event.size ?? 0.15,
  });
  const directionLength = Math.hypot(event.direction[0], event.direction[1], event.direction[2]) || 1;
  const dx = event.direction[0] / directionLength;
  const dy = event.direction[1] / directionLength;
  const dz = event.direction[2] / directionLength;

  const burst = pool.bursts[pool.nextBurstSlot];
  pool.nextBurstSlot = (pool.nextBurstSlot + 1) % pool.bursts.length;
  burst.active = true;
  burst.age = 0;
  burst.x = event.position[0];
  burst.y = event.position[1];
  burst.z = event.position[2];
  burst.dx = dx;
  burst.dy = dy;
  burst.dz = dz;
  burst.scale = burstScale;
  burst.core = palette.core;
  burst.glow = palette.glow;

  for (let particle = 0; particle < PLAYER_FIRE_BURST_PARTICLES; particle++) {
    const slot = pool.slots[pool.nextSlot];
    pool.nextSlot = (pool.nextSlot + 1) % pool.slots.length;
    slot.active = true;
    slot.age = 0;
    slot.x = event.position[0];
    slot.y = event.position[1];
    slot.z = event.position[2];
    slot.dx = dx;
    slot.dy = dy;
    slot.dz = dz;
    slot.scale = burstScale;
    // Rainbow uses the full authored particle palette on every firing burst.
    slot.color = colors[particle % colors.length];
  }
}

const _playerFireBurstGeometry = new THREE.OctahedronGeometry(1, 0);
const _playerFireBurstFlashGeometry = new THREE.SphereGeometry(1, 8, 6);
const _playerFireBurstRingGeometry = new THREE.RingGeometry(0.72, 1, 16);
const _playerFireBurstStreakGeometry = new THREE.CylinderGeometry(0.72, 0.14, 1, 6, 1, false);
const _playerFireBurstDummy = new THREE.Object3D();
const _playerFireBurstColor = new THREE.Color();
const _playerFireBurstAxisY = new THREE.Vector3(0, 1, 0);
const _playerFireBurstAxisZ = new THREE.Vector3(0, 0, 1);
const _playerFireBurstDirection = new THREE.Vector3();

function PlayerProjectileFireBursts({ pool }: { pool: PlayerFireBurstPool }) {
  const shardMeshRef = useRef<THREE.InstancedMesh>(null);
  const flashMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const streakMeshRef = useRef<THREE.InstancedMesh>(null);
  const [shardMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const [flashMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const [ringMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const [streakMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  useEffect(() => () => {
    shardMaterial.dispose();
    flashMaterial.dispose();
    ringMaterial.dispose();
    streakMaterial.dispose();
  }, [flashMaterial, ringMaterial, shardMaterial, streakMaterial]);

  useFrame((_, delta) => {
    const shardMesh = shardMeshRef.current;
    const flashMesh = flashMeshRef.current;
    const ringMesh = ringMeshRef.current;
    const streakMesh = streakMeshRef.current;
    if (!shardMesh || !flashMesh || !ringMesh || !streakMesh) return;
    const lifetime = 0.22;

    for (let index = 0; index < pool.bursts.length; index++) {
      const burst = pool.bursts[index];
      burst.age += delta;
      if (!burst.active || burst.age >= lifetime) {
        burst.active = false;
        _playerFireBurstDummy.scale.setScalar(0);
        _playerFireBurstDummy.updateMatrix();
        flashMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
        ringMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
        streakMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
        continue;
      }

      const t = burst.age / lifetime;
      const fade = 1 - t;
      const travel = (0.035 + t * 0.16) * burst.scale;
      const burstX = burst.x + burst.dx * travel;
      const burstY = burst.y + burst.dy * travel;
      const burstZ = burst.z + burst.dz * travel;

      // A bright point stays at the orb's surface while a ring and a spear
      // expand forward, making the projectile feel emitted rather than merely
      // appearing beside the player.
      _playerFireBurstDummy.position.set(burstX, burstY, burstZ);
      _playerFireBurstDummy.rotation.set(0, 0, 0);
      _playerFireBurstDummy.scale.setScalar((0.08 + fade * 0.16) * burst.scale);
      _playerFireBurstDummy.updateMatrix();
      flashMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
      _playerFireBurstColor.set(burst.core);
      flashMesh.setColorAt(index, _playerFireBurstColor);

      _playerFireBurstDummy.position.set(burstX, burstY, burstZ);
      _playerFireBurstDummy.quaternion.setFromUnitVectors(
        _playerFireBurstAxisZ,
        _playerFireBurstDirection.set(burst.dx, burst.dy, burst.dz),
      );
      _playerFireBurstDummy.scale.setScalar((0.12 + t * 0.72) * burst.scale);
      _playerFireBurstDummy.updateMatrix();
      ringMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
      _playerFireBurstColor.set(burst.glow).multiplyScalar(0.35 + fade * 0.65);
      ringMesh.setColorAt(index, _playerFireBurstColor);

      _playerFireBurstDummy.position.set(
        burst.x + burst.dx * (0.20 + t * 0.18) * burst.scale,
        burst.y + burst.dy * (0.20 + t * 0.18) * burst.scale,
        burst.z + burst.dz * (0.20 + t * 0.18) * burst.scale,
      );
      _playerFireBurstDummy.quaternion.setFromUnitVectors(
        _playerFireBurstAxisY,
        _playerFireBurstDirection.set(burst.dx, burst.dy, burst.dz),
      );
      _playerFireBurstDummy.scale.set(
        (0.035 + fade * 0.045) * burst.scale,
        (0.28 + fade * 0.34) * burst.scale,
        (0.035 + fade * 0.045) * burst.scale,
      );
      _playerFireBurstDummy.updateMatrix();
      streakMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
      _playerFireBurstColor.set(burst.core).multiplyScalar(0.45 + fade * 0.55);
      streakMesh.setColorAt(index, _playerFireBurstColor);
    }

    for (let index = 0; index < pool.slots.length; index++) {
      const slot = pool.slots[index];
      slot.age += delta;
      if (!slot.active || slot.age >= lifetime) {
        slot.active = false;
        _playerFireBurstDummy.scale.setScalar(0);
        _playerFireBurstDummy.updateMatrix();
        shardMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
        continue;
      }
      const t = slot.age / lifetime;
      const lateralX = -slot.dy;
      const lateralY = slot.dx;
      const lateral = Math.sin(slot.phase) * (0.03 + t * 0.18) * slot.scale;
      const forward = (0.10 + t * 0.52) * slot.scale;
      _playerFireBurstDummy.position.set(
        slot.x + slot.dx * forward + lateralX * lateral,
        slot.y + slot.dy * forward + lateralY * lateral,
        slot.z + slot.dz * forward + Math.cos(slot.phase) * t * 0.08 * slot.scale,
      );
      _playerFireBurstDummy.scale.setScalar((1 - t) * 0.06 * slot.scale);
      _playerFireBurstDummy.updateMatrix();
      shardMesh.setMatrixAt(index, _playerFireBurstDummy.matrix);
      _playerFireBurstColor.set(slot.color);
      shardMesh.setColorAt(index, _playerFireBurstColor);
    }
    flashMesh.instanceMatrix.needsUpdate = true;
    ringMesh.instanceMatrix.needsUpdate = true;
    streakMesh.instanceMatrix.needsUpdate = true;
    shardMesh.instanceMatrix.needsUpdate = true;
    if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    if (streakMesh.instanceColor) streakMesh.instanceColor.needsUpdate = true;
    if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={flashMeshRef}
        args={[_playerFireBurstFlashGeometry, flashMaterial, MAX_PLAYER_FIRE_BURSTS]}
        frustumCulled={false}
        renderOrder={5}
      />
      <instancedMesh
        ref={ringMeshRef}
        args={[_playerFireBurstRingGeometry, ringMaterial, MAX_PLAYER_FIRE_BURSTS]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={streakMeshRef}
        args={[_playerFireBurstStreakGeometry, streakMaterial, MAX_PLAYER_FIRE_BURSTS]}
        frustumCulled={false}
        renderOrder={4}
      />
      <instancedMesh
        ref={shardMeshRef}
        args={[_playerFireBurstGeometry, shardMaterial, MAX_PLAYER_FIRE_BURST_PARTICLES]}
        frustumCulled={false}
        renderOrder={3}
      />
    </>
  );
}

type BatchedModelPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  localMatrix: THREE.Matrix4;
  ownedMaterials: THREE.Material[];
};

/**
 * Every non-Star player-owned projectile uses one instanced copy of the
 * equipped skin's authored GLTF geometry and material groups. Star uses the
 * same procedural MiniStarOrb renderer as the equipped player skin below.
 */
function BatchedPlayerProjectileModels({
  projectiles,
  equippedSkin,
  skinColors,
  playerScale,
}: {
  projectiles: readonly Projectile[];
  equippedSkin: Parameters<typeof getPlayerSkinModelPath>[0];
  skinColors: { core: string; glow: string };
  playerScale: number;
}) {
  const skinPath = getPlayerSkinModelPath(equippedSkin);
  const { scene: skinScene } = useGLTF(skinPath);
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const spiralMeshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const activeSlotsRef = useRef<Set<number>>(new Set());
  const activeSpiralSlotsRef = useRef<Set<number>>(new Set());
  const seenSlotsRef = useRef<Set<number>>(new Set());
  const seenSpiralSlotsRef = useRef<Set<number>>(new Set());
  const modelParts = useMemo<BatchedModelPart[]>(() => {
    skinScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(skinScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const normalization = Math.max(size.x, size.y, size.z) > 0
      ? 2 / Math.max(size.x, size.y, size.z)
      : 1;
    const normalizationMatrix = new THREE.Matrix4()
      .makeTranslation(-center.x * normalization, -center.y * normalization, -center.z * normalization)
      .multiply(new THREE.Matrix4().makeScale(normalization, normalization, normalization));
    const parts: BatchedModelPart[] = [];
    skinScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const ownedMaterials = sourceMaterials.map((sourceMaterial) =>
        clonePlayerOrbMaterial({
          baseMaterial: sourceMaterial,
          coreColor: skinColors.core,
          glowColor: skinColors.glow,
          tintColors: false,
          emissiveBoost: 0.35,
        }),
      );
      parts.push({
        geometry: mesh.geometry,
        material: Array.isArray(mesh.material) ? ownedMaterials : ownedMaterials[0],
        localMatrix: normalizationMatrix.clone().multiply(mesh.matrixWorld),
        ownedMaterials,
      });
    });
    return parts;
  }, [equippedSkin, skinColors.core, skinColors.glow, skinScene]);

  useEffect(() => () => {
    for (const part of modelParts) {
      for (const material of part.ownedMaterials) material.dispose();
    }
  }, [modelParts]);

  useFrame(({ clock }) => {
    runtimeDiagnostics.beginProjectileVisuals();
    const seenSlots = seenSlotsRef.current;
    const seenSpiralSlots = seenSpiralSlotsRef.current;
    seenSlots.clear();
    seenSpiralSlots.clear();
    let highestSlot = -1;
    let highestSpiralSlot = -1;
    let visibleModels = 0;
    const elapsed = clock.getElapsedTime();
    _batchedModelRotation.setFromEuler(
      _batchedModelEuler.set(0, getPlayerSkinVisualYaw(equippedSkin, elapsed), 0),
    );

    for (const projectile of projectiles) {
      if (!usesSharedPlayerProjectileCore(projectile)) continue;
      const motion = getLiveProjectileMotion(projectile);
      if (!motion || motion.slot >= MAX_BATCHED_PROJECTILES) continue;
      if (projectile.type === "spiral") {
        const alive = motion.subSphereAlive ?? projectile.subSphereAlive ?? [true, true, true];
        const phase = motion.spiralAngle ?? projectile.spiralAngle ?? 0;
        const visualScale = getPlayerProjectileVisualScale(projectile, 1, playerScale);
        for (let subIndex = 0; subIndex < 3; subIndex++) {
          const spiralSlot = motion.slot * 3 + subIndex;
          seenSpiralSlots.add(spiralSlot);
          highestSpiralSlot = Math.max(highestSpiralSlot, spiralSlot);
          const [x, y, z] = _getSpiralSubPos(
            motion.position[0],
            motion.position[1],
            motion.position[2],
            motion.direction[0],
            motion.direction[1],
            phase,
            subIndex,
          );
          _batchedModelPosition.set(x, y, z);
          _batchedModelScale.setScalar(alive[subIndex] ? visualScale : 0);
          _batchedModelTransform.compose(
            _batchedModelPosition,
            _batchedModelRotation,
            _batchedModelScale,
          );
          for (let partIndex = 0; partIndex < modelParts.length; partIndex++) {
            const mesh = spiralMeshRefs.current[partIndex];
            if (!mesh) continue;
            _batchedModelInstanceMatrix.multiplyMatrices(
              _batchedModelTransform,
              modelParts[partIndex].localMatrix,
            );
            mesh.setMatrixAt(spiralSlot, _batchedModelInstanceMatrix);
          }
          if (alive[subIndex]) visibleModels++;
        }
        continue;
      }
      const slot = motion.slot;
      seenSlots.add(slot);
      visibleModels++;
      highestSlot = Math.max(highestSlot, slot);
      _batchedModelPosition.set(motion.position[0], motion.position[1], motion.position[2]);
      _batchedModelScale.setScalar(
        getPlayerProjectileVisualScale(
          projectile,
          motion.spawnScale ?? projectile.spawnScale ?? 1,
          playerScale,
        ),
      );
      _batchedModelTransform.compose(
        _batchedModelPosition,
        _batchedModelRotation,
        _batchedModelScale,
      );
      for (let partIndex = 0; partIndex < modelParts.length; partIndex++) {
        const mesh = meshRefs.current[partIndex];
        if (!mesh) continue;
        _batchedModelInstanceMatrix.multiplyMatrices(_batchedModelTransform, modelParts[partIndex].localMatrix);
        mesh.setMatrixAt(slot, _batchedModelInstanceMatrix);
      }
    }

    const activeSlots = activeSlotsRef.current;
    _batchedProjectileDummy.position.set(0, 0, 0);
    _batchedProjectileDummy.quaternion.identity();
    _batchedProjectileDummy.scale.setScalar(0);
    _batchedProjectileDummy.updateMatrix();
    for (const slot of activeSlots) {
      if (seenSlots.has(slot)) continue;
      for (const mesh of meshRefs.current) mesh?.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      activeSlots.delete(slot);
    }
    for (const slot of seenSlots) activeSlots.add(slot);
    const activeSpiralSlots = activeSpiralSlotsRef.current;
    for (const slot of activeSpiralSlots) {
      if (seenSpiralSlots.has(slot)) continue;
      for (const mesh of spiralMeshRefs.current) mesh?.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      activeSpiralSlots.delete(slot);
    }
    for (const slot of seenSpiralSlots) activeSpiralSlots.add(slot);

    for (const mesh of meshRefs.current) {
      if (!mesh) continue;
      mesh.count = highestSlot + 1;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const mesh of spiralMeshRefs.current) {
      if (!mesh) continue;
      mesh.count = highestSpiralSlot + 1;
      mesh.instanceMatrix.needsUpdate = true;
    }
    runtimeDiagnostics.endProjectileVisuals(visibleModels);
  });

  // The equipped Star player uses the procedural MiniStarOrb renderer. Hide
  // this GLTF batch for Star so the old star texture cannot remain visible
  // when the equipped skin changes at runtime.
  if (equippedSkin === "star") return null;

  return (
    <>
      {modelParts.map((part, index) => (
        <instancedMesh
          key={`${skinPath}-${index}`}
          ref={(mesh) => { meshRefs.current[index] = mesh; }}
          args={[part.geometry, part.material, MAX_BATCHED_PROJECTILES]}
          frustumCulled={false}
          renderOrder={2}
        />
      ))}
      {modelParts.map((part, index) => (
        <instancedMesh
          key={`${skinPath}-spiral-${index}`}
          ref={(mesh) => { spiralMeshRefs.current[index] = mesh; }}
          args={[part.geometry, part.material, MAX_BATCHED_PROJECTILES * 3]}
          frustumCulled={false}
          renderOrder={2}
        />
      ))}
    </>
  );
}

/**
 * Star's player skin is procedural rather than GLB-backed. Render the same
 * MiniStarOrb core for each projectile so the projectile surface and the
 * equipped player surface come from the exact same shader/material path.
 *
 * Spiral weapons keep their three independently orbiting sub-orbs; only the
 * visual core source changes from the generic GLB batch to MiniStarOrb.
 */
function StarPlayerProjectileCores({
  projectiles,
  playerScale,
}: {
  projectiles: readonly Projectile[];
  playerScale: number;
}) {
  return (
    <>
      {projectiles.map((projectile) => (
        <StarPlayerProjectileCore
          key={projectile.id}
          projectile={projectile}
          playerScale={playerScale}
        />
      ))}
    </>
  );
}

function StarPlayerProjectileCore({
  projectile,
  playerScale,
}: {
  projectile: Projectile;
  playerScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const orbRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame(() => {
    const group = groupRef.current;
    const motion = getLiveProjectileMotion(projectile);
    if (!group || !motion) {
      if (group) group.visible = false;
      return;
    }

    group.visible = true;
    const isSpiral = projectile.type === "spiral";
    const visualScale = getPlayerProjectileVisualScale(
      projectile,
      isSpiral ? 1 : (motion.spawnScale ?? projectile.spawnScale ?? 1),
      playerScale,
    );

    if (!isSpiral) {
      group.position.set(motion.position[0], motion.position[1], motion.position[2]);
      const orb = orbRefs.current[0];
      if (orb) {
        orb.position.set(0, 0, 0);
        orb.scale.setScalar(visualScale);
      }
      for (let index = 1; index < orbRefs.current.length; index++) {
        orbRefs.current[index]?.scale.setScalar(0);
      }
      return;
    }

    group.position.set(0, 0, 0);
    const alive = motion.subSphereAlive ?? projectile.subSphereAlive ?? [true, true, true];
    const phase = motion.spiralAngle ?? projectile.spiralAngle ?? 0;
    for (let subIndex = 0; subIndex < 3; subIndex++) {
      const orb = orbRefs.current[subIndex];
      if (!orb) continue;
      const [x, y, z] = _getSpiralSubPos(
        motion.position[0],
        motion.position[1],
        motion.position[2],
        motion.direction[0],
        motion.direction[1],
        phase,
        subIndex,
      );
      orb.position.set(x, y, z);
      orb.scale.setScalar(alive[subIndex] ? visualScale : 0);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {[0, 1, 2].map((index) => (
        <group
          key={index}
          ref={(group) => {
            orbRefs.current[index] = group;
          }}
        >
          <MiniStarOrb radius={1} showParticles={false} showLight={false} />
        </group>
      ))}
    </group>
  );
}

/**
 * Weapon effects mount with their projectile record but stay invisible until
 * the authoritative runtime slot exists. This keeps lights and additive trails
 * from appearing at the origin or outliving their opaque core.
 */
function ProjectileEffectsGate({
  projectile,
  children,
}: {
  projectile: Projectile;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = getLiveProjectileMotion(projectile) !== undefined;
    }
  });

  return <group ref={groupRef} visible={false}>{children}</group>;
}

function ParticleSwarmProjectileOverlay({ projectile, skinColors }: {
  projectile: Projectile;
  skinColors: { core: string; glow: string; emissive: string; accent: string; particles: string[] };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isCharged     = projectile.isCharged;
  const isRainbow     = (skinColors as any).isRainbow === true;

  // 1/5th of the player orb base scale (now 0.72)
  const projScale  = isCharged ? 0.216 : 0.144;
  const groupScale = 1;

  useFrame(() => {
   const motion = getLiveProjectileMotion(projectile);
   if (!motion) return;
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
     // This group is positioned exclusively from the live projectile runtime.
     // Do not also bind the stale structural position prop here: rapid-fire
     // store updates can otherwise snap the trail back to the muzzle origin.
     <group ref={groupRef}>
      {/* The pooled batch exclusively owns the model, glow, and charged aura.
          This legacy cosmetic path contributes only its orbiting swarm. */}
      <group scale={groupScale}>
        <PlayerParticles
          scale={projScale}
          particleColors={[skinColors.core]}
          isRainbow={isRainbow}
        />
      </group>
    </group>
  );
}

// ── EaseOutQuad for projectile spawn grow-in ──────────────────────────────────
function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }

// ── Overcharged Blaster timed-explosion constants ─────────────────────────────
export const OC_TRAVEL_TIME = 1.5; // seconds before condensation begins
export const OVERCHARGED_DAMAGE_TIME = OC_TRAVEL_TIME + OVERCHARGED_BUILD_DURATION;
const OC_EXPLODE_RADIUS = 4.8;  // AOE radius in world units

export function isOverchargedVfxReady(travelTime: number): boolean {
  return travelTime >= OC_TRAVEL_TIME;
}

export function isOverchargedDamageReady(travelTime: number): boolean {
  return travelTime >= OVERCHARGED_DAMAGE_TIME;
}

export function isOverchargedDirectContact(projectile: Pick<Projectile, "type">): boolean {
  return projectile.type === "overcharged";
}

export function shouldPresentOverchargedDetonation(
  projectile: Pick<Projectile, "type">,
  alreadyPresented: boolean,
): boolean {
  return isOverchargedDirectContact(projectile) && !alreadyPresented;
}

// ── Orbital Spiral Blaster constants ─────────────────────────────────────────
const SPIRAL_ORBIT_R     = 0.91;
const SPIRAL_ORBIT_SPEED = 7.0;
const SPIRAL_SUB_SCALE   = 0.324; // 0.75 × 0.72 × 0.60
const SPIRAL_TRAIL_N     = 14;
const SPIRAL_TRAIL_HW    = 0.062;
const SPIRAL_COLORS_HEX  = ["#00ffff", "#ff00ff", "#ffdd00"] as const;
const SPIRAL_GLOW_HEX    = ["#004488", "#440044", "#443300"] as const;

/** World position of spiral sub-sphere idx relative to parent projectile center */
function _getSpiralSubPos(
  cx: number, cy: number, cz: number,
  fdx: number, fdy: number,
  phase: number, idx: number,
): [number, number, number] {
  const fl = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
  const ux = -fdy / fl, uy = fdx / fl;
  const a  = phase + (idx / 3) * Math.PI * 2;
  return [
    cx + ux * Math.cos(a) * SPIRAL_ORBIT_R,
    cy + uy * Math.cos(a) * SPIRAL_ORBIT_R,
    cz + Math.sin(a) * SPIRAL_ORBIT_R,
  ];
}

// ── Expanding energy shockwave ring spawned at overcharged fire point ─────────
const _swRingGeo = new THREE.TorusGeometry(1, 0.09, 6, 48);

function OcShockwaveRing({ position }: { position: [number, number, number] }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const timerRef = useRef(0);
  const DUR      = 0.55;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timerRef.current = Math.min(timerRef.current + delta, DUR);
    const t = timerRef.current / DUR;
    meshRef.current.scale.setScalar(t * 5.0);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
  });

  return (
    <mesh ref={meshRef} geometry={_swRingGeo} position={position}>
      <meshBasicMaterial
        color="#55aaff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Sub Blaster defense bolt — needle trail + muzzle pop ─────────────────────
const _SB_TRAIL_N  = 8;
const _SB_TRAIL_HW = 0.022;  // very narrow needle

function SubblasterProjectileMesh({
  projectile,
  trailPalette,
}: {
  projectile: Projectile;
  trailPalette: PlayerSkinTrailPalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trailHead = useMemo(() => new THREE.Color(trailPalette.head), [trailPalette.head]);
  const trailTail = useMemo(() => new THREE.Color(trailPalette.tail), [trailPalette.tail]);
  const ribbonGeo = useMemo(() => {
    const geo  = new THREE.BufferGeometry();
    const N    = _SB_TRAIL_N;
    const pArr = new Float32Array(N * 2 * 3);
    const cArr = new Float32Array(N * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const b = i * 2; idx.push(b, b+2, b+1, b+1, b+2, b+3);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(cArr, 4));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => { ribbonGeo.dispose(); ribbonMat.dispose(); }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_SB_TRAIL_N * 3));
  const histLenRef = useRef(0);
  const projRef    = useRef(projectile);
  projRef.current  = projectile;

  useFrame(() => {
    const proj   = projRef.current;
    const motion = getLiveProjectileMotion(proj);
    if (!motion) return;
    if (groupRef.current) groupRef.current.position.set(...motion.position);
    const [wx, wy, wz] = motion.position;
    const N   = _SB_TRAIL_N;
    const len = Math.min(histLenRef.current + 1, N);
    histLenRef.current = len;
    const hist = posHistRef.current;
    for (let i = len - 1; i > 0; i--) {
      hist[i*3] = hist[(i-1)*3]; hist[i*3+1] = hist[(i-1)*3+1]; hist[i*3+2] = hist[(i-1)*3+2];
    }
    hist[0] = wx; hist[1] = wy; hist[2] = wz;
    if (len < 2) return;

    const [fdx, fdy] = motion.direction;
    const fl  = Math.sqrt(fdx*fdx + fdy*fdy) || 1;
    const px_ = -fdy / fl, py_ = fdx / fl;

    const pAttr = ribbonGeo.getAttribute("position") as THREE.BufferAttribute;
    const cAttr = ribbonGeo.getAttribute("color")    as THREE.BufferAttribute;
    const pA    = pAttr.array as Float32Array;
    const cA    = cAttr.array as Float32Array;

    for (let i = 0; i < len; i++) {
      const t   = i / (len - 1);
      const hw  = _SB_TRAIL_HW * (1 - t * 0.90);
      const rx  = hist[i*3]   - wx;
      const ry  = hist[i*3+1] - wy;
      const rz  = hist[i*3+2] - wz;
      const vi  = i * 6;
      pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
      pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
      const tc = trailHead.clone().lerp(trailTail, t);
      const alpha = (1 - t) * 0.85;
      const ci    = i * 8;
      cA[ci]   = tc.r; cA[ci+1] = tc.g; cA[ci+2] = tc.b; cA[ci+3] = alpha;
      cA[ci+4] = tc.r; cA[ci+5] = tc.g; cA[ci+6] = tc.b; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true; cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  useFrame(() => {
    const motion = getLiveProjectileMotion(projectile);
    if (!motion) return;
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#22ddff" intensity={8} distance={2.5} decay={2} />
      <mesh geometry={ribbonGeo} material={ribbonMat} />
    </group>
  );
}

// ── Rapid Blaster projectile muzzle flash ─────────────────────────────────────
const _rbFlashGeo = new THREE.SphereGeometry(1, 8, 6);
const _rbFlashMat = new THREE.MeshBasicMaterial({
  color: "#fffbe8",
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function RapidBlasterProjectileMesh({
  projectile,
}: {
  projectile: Projectile;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bornRef = useRef<number | null>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const projRef = useRef(projectile);
  projRef.current = projectile;
  const flashMat = useMemo(() => _rbFlashMat.clone(), []);
  useEffect(() => () => flashMat.dispose(), [flashMat]);

  useFrame(({ clock }) => {
    const motion = getLiveProjectileMotion(projRef.current);
    const group = groupRef.current;
    if (!motion) {
      if (group) group.visible = false;
      return;
    }
    if (group) {
      group.visible = true;
      group.position.set(...motion.position);
    }

    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();
    const age = clock.getElapsedTime() - bornRef.current;
    const FLASH_DUR = 0.05;
    const flashAlpha = age < FLASH_DUR ? (1 - age / FLASH_DUR) * 0.85 : 0;
    if (flashRef.current) {
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = flashAlpha;
      flashRef.current.scale.setScalar(0.28 + (1 - flashAlpha) * 0.12);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={flashRef} geometry={_rbFlashGeo} material={flashMat} scale={0.28} />
    </group>
  );
}

// ── Rapid Blaster trail — elongated cylinder behind each projectile ───────────
function RapidProjectileTrailBatch({
  projectiles,
  trailColor,
}: {
  projectiles: readonly Projectile[];
  trailColor: string;
}) {
  const rapidTrailRef = useRef<THREE.InstancedMesh>(null);
  const activeSlotsRef = useRef<Set<number>>(new Set());
  const seenSlotsRef = useRef<Set<number>>(new Set());
  const [rapidTrailMaterial] = useState(() => new THREE.MeshBasicMaterial({
    color: trailColor,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  }));
  useEffect(() => {
    rapidTrailMaterial.color.set(trailColor);
  }, [rapidTrailMaterial, trailColor]);
  useEffect(() => () => rapidTrailMaterial.dispose(), [rapidTrailMaterial]);

  useFrame(() => {
    const rapidTrailMesh = rapidTrailRef.current;
    if (!rapidTrailMesh) return;

    const seenSlots = seenSlotsRef.current;
    seenSlots.clear();
    let highestSlot = -1;

    for (const projectile of projectiles) {
      if (projectile.type !== "rapidblaster") continue;
      const motion = projectilePhysicsMap.get(projectile.id);
      if (!motion || motion.slot >= MAX_BATCHED_PROJECTILES) continue;

      const slot = motion.slot;
      seenSlots.add(slot);
      highestSlot = Math.max(highestSlot, slot);
      const [dx, dy, dz] = motion.direction;
      _batchedProjectileDirection.set(dx, dy, dz).normalize();
      _batchedProjectileDummy.position.set(
        motion.position[0] - dx * 0.72,
        motion.position[1] - dy * 0.72,
        motion.position[2] - dz * 0.72,
      );
      _batchedProjectileDummy.quaternion.setFromUnitVectors(
        _batchedProjectileAxis,
        _batchedProjectileDirection,
      );
      _batchedProjectileDummy.scale.set(0.038, 1.0, 0.038);
      _batchedProjectileDummy.updateMatrix();
      rapidTrailMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
    }

    const activeSlots = activeSlotsRef.current;
    for (const slot of activeSlots) {
      if (seenSlots.has(slot)) continue;
      _batchedProjectileDummy.position.set(0, 0, 0);
      _batchedProjectileDummy.quaternion.identity();
      _batchedProjectileDummy.scale.setScalar(0);
      _batchedProjectileDummy.updateMatrix();
      rapidTrailMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      activeSlots.delete(slot);
    }
    for (const slot of seenSlots) activeSlots.add(slot);

    rapidTrailMesh.count = highestSlot + 1;
    rapidTrailMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={rapidTrailRef}
      args={[_batchedRapidTrailGeometry, rapidTrailMaterial, MAX_BATCHED_PROJECTILES]}
      frustumCulled={false}
    />
  );
}

// ── Orbital Homing Blaster — swirling trail + lock-on ring flash ──────────────
const _HM_TRAIL_N  = 20;
const _HM_TRAIL_HW = 0.068;
// Lock-on ring: 270° arc torus
const _hmRingGeo  = new THREE.TorusGeometry(1, 0.09, 6, 32, Math.PI * 1.5);
const _hmRingGeo2 = new THREE.TorusGeometry(1, 0.05, 5, 24, Math.PI * 1.5);

function HomingLockRing({
  position, dirX, dirY,
}: {
  position: [number, number, number]; dirX: number; dirY: number;
}) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const timerRef = useRef(0);
  const DUR = 0.30;
  const angle = Math.atan2(dirY, dirX);

  useFrame((_, delta) => {
    timerRef.current = Math.min(timerRef.current + delta, DUR);
    const t  = timerRef.current / DUR;
    const t2 = easeOutQuad(t);
    const scl = 0.5 + t2 * 1.8;
    const op  = (1 - t) * 0.85;
    if (ring1Ref.current) {
      ring1Ref.current.scale.setScalar(scl);
      ring1Ref.current.rotation.z = angle + t * Math.PI * 0.5;
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = op;
    }
    if (ring2Ref.current) {
      ring2Ref.current.scale.setScalar(scl * 0.65);
      ring2Ref.current.rotation.z = angle - t * Math.PI * 0.5;
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = op * 0.55;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ring1Ref} geometry={_hmRingGeo}>
        <meshBasicMaterial color="#44ffee" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2Ref} geometry={_hmRingGeo2}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function HomingProjectileMesh({
  projectile,
  trailPalette,
}: {
  projectile: Projectile;
  trailPalette: PlayerSkinTrailPalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trailHead = useMemo(() => new THREE.Color(trailPalette.head), [trailPalette.head]);
  const trailTail = useMemo(() => new THREE.Color(trailPalette.tail), [trailPalette.tail]);

  const ribbonGeo = useMemo(() => {
    const geo  = new THREE.BufferGeometry();
    const N    = _HM_TRAIL_N;
    const pArr = new Float32Array(N * 2 * 3);
    const cArr = new Float32Array(N * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const b = i * 2; idx.push(b, b+2, b+1, b+1, b+2, b+3);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(cArr, 4));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => {
    ribbonGeo.dispose(); ribbonMat.dispose();
  }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_HM_TRAIL_N * 3));
  const histLenRef = useRef(0);
  const projRef    = useRef(projectile);
  projRef.current  = projectile;

  useFrame(({ clock }) => {
    const proj   = projRef.current;
    const motion = getLiveProjectileMotion(proj);
    if (!motion) return;
    if (groupRef.current) groupRef.current.position.set(...motion.position);
    const [wx, wy, wz] = motion.position;
    const age = clock.getElapsedTime();

    // Swirling ribbon — stores position history, adds sine wiggle perpendicular to travel
    const N   = _HM_TRAIL_N;
    const len = Math.min(histLenRef.current + 1, N);
    histLenRef.current = len;
    const hist = posHistRef.current;
    for (let i = len - 1; i > 0; i--) {
      hist[i*3] = hist[(i-1)*3]; hist[i*3+1] = hist[(i-1)*3+1]; hist[i*3+2] = hist[(i-1)*3+2];
    }
    hist[0] = wx; hist[1] = wy; hist[2] = wz;
    if (len < 2) return;

    const [fdx, fdy] = motion.direction;
    const fl  = Math.sqrt(fdx*fdx + fdy*fdy) || 1;
    const px_ = -fdy / fl, py_ = fdx / fl; // perpendicular

    const pAttr = ribbonGeo.getAttribute("position") as THREE.BufferAttribute;
    const cAttr = ribbonGeo.getAttribute("color")    as THREE.BufferAttribute;
    const pA    = pAttr.array as Float32Array;
    const cA    = cAttr.array as Float32Array;

    for (let i = 0; i < len; i++) {
      const t    = i / (len - 1);
      // Swirl: sine wave that oscillates as projectile curves — dynamic flex effect
      const swirl = Math.sin(age * 8 - t * Math.PI * 2.5) * 0.09 * (1 - t);
      const hw    = _HM_TRAIL_HW * (1 - t * 0.80);
      const rx    = hist[i*3]   - wx + px_ * swirl;
      const ry    = hist[i*3+1] - wy + py_ * swirl;
      const rz    = hist[i*3+2] - wz;
      const vi    = i * 6;
      pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
      pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
      const tc = trailHead.clone().lerp(trailTail, t);
      const alpha = (1 - t) * 0.88;
      const ci    = i * 8;
      cA[ci]   = tc.r; cA[ci+1] = tc.g; cA[ci+2] = tc.b; cA[ci+3] = alpha;
      cA[ci+4] = tc.r; cA[ci+5] = tc.g; cA[ci+6] = tc.b; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true; cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  const isCharged = projectile.isCharged;

  useFrame(() => {
    const motion = getLiveProjectileMotion(projectile);
    if (!motion) return;
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#22eedd"
        intensity={isCharged ? 12 : 8}
        distance={isCharged ? 6 : 4}
        decay={2} />
      <mesh geometry={ribbonGeo} material={ribbonMat} />
    </group>
  );
}

// ── Orbital Scattershot — plasma bolt + ribbon trail + muzzle arc ─────────────
const _SC_TRAIL_N  = 14;
const _SC_TRAIL_HW = 0.072; // wider than rapid-blaster

// Muzzle arc — 180° torus half-ring, wide and flat
const _scArcGeo  = new THREE.TorusGeometry(1, 0.10, 6, 32, Math.PI);
const _scArcGeo2 = new THREE.TorusGeometry(1, 0.05, 5, 24, Math.PI);

function ScatterMuzzleArc({
  position, dirX, dirY,
}: {
  position: [number, number, number]; dirX: number; dirY: number;
}) {
  const arc1Ref  = useRef<THREE.Mesh>(null);
  const arc2Ref  = useRef<THREE.Mesh>(null);
  const timerRef = useRef(0);
  const DUR      = 0.18;
  // Rotate arcs to face fire direction — arc opens away from orb
  const angle = Math.atan2(dirY, dirX);

  useFrame((_, delta) => {
    timerRef.current = Math.min(timerRef.current + delta, DUR);
    const t   = timerRef.current / DUR;
    const t2  = easeOutQuad(t);
    const scl = 1.0 + t2 * 3.2; // expands outward fast
    const op  = (1 - t) * 0.92;
    if (arc1Ref.current) {
      arc1Ref.current.scale.set(scl * 1.6, scl, 1);
      (arc1Ref.current.material as THREE.MeshBasicMaterial).opacity = op;
    }
    if (arc2Ref.current) {
      arc2Ref.current.scale.set(scl * 1.8, scl * 0.85, 1);
      (arc2Ref.current.material as THREE.MeshBasicMaterial).opacity = op * 0.6;
    }
  });

  return (
    <group position={position} rotation={[0, 0, angle - Math.PI / 2]}>
      <mesh ref={arc1Ref} geometry={_scArcGeo}>
        <meshBasicMaterial color="#ffaa33" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={arc2Ref} geometry={_scArcGeo2}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function ScattershotProjectileMesh({
  projectile,
  trailPalette,
}: {
  projectile: Projectile;
  trailPalette: PlayerSkinTrailPalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trailHead = useMemo(() => new THREE.Color(trailPalette.head), [trailPalette.head]);
  const trailTail = useMemo(() => new THREE.Color(trailPalette.tail), [trailPalette.tail]);

  const ribbonGeo = useMemo(() => {
    const geo  = new THREE.BufferGeometry();
    const N    = _SC_TRAIL_N;
    const pArr = new Float32Array(N * 2 * 3);
    const cArr = new Float32Array(N * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const b = i * 2; idx.push(b, b+2, b+1, b+1, b+2, b+3);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(cArr, 4));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => {
    ribbonGeo.dispose(); ribbonMat.dispose();
  }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_SC_TRAIL_N * 3));
  const histLenRef = useRef(0);
  const projRef    = useRef(projectile);
  projRef.current  = projectile;

  useFrame(() => {
    const proj   = projRef.current;
    const motion = getLiveProjectileMotion(proj);
    if (!motion) return;
    if (groupRef.current) groupRef.current.position.set(...motion.position);
    const [wx, wy, wz] = motion.position;
    // Ribbon trail — position history
    const N   = _SC_TRAIL_N;
    const len = Math.min(histLenRef.current + 1, N);
    histLenRef.current = len;
    const hist = posHistRef.current;
    for (let i = len - 1; i > 0; i--) {
      hist[i*3] = hist[(i-1)*3]; hist[i*3+1] = hist[(i-1)*3+1]; hist[i*3+2] = hist[(i-1)*3+2];
    }
    hist[0] = wx; hist[1] = wy; hist[2] = wz;
    if (len < 2) return;

    const [fdx, fdy] = motion.direction;
    const fl  = Math.sqrt(fdx*fdx + fdy*fdy) || 1;
    const px_ = -fdy / fl, py_ = fdx / fl;

    const pAttr = ribbonGeo.getAttribute("position") as THREE.BufferAttribute;
    const cAttr = ribbonGeo.getAttribute("color")    as THREE.BufferAttribute;
    const pA    = pAttr.array as Float32Array;
    const cA    = cAttr.array as Float32Array;

    for (let i = 0; i < len; i++) {
      const t   = i / (len - 1);
      // Slight outward arc: perpendicular offset that peaks in the mid-trail
      const arc  = Math.sin(t * Math.PI) * 0.12;
      const hw   = _SC_TRAIL_HW * (1 - t * 0.75);
      const rx   = hist[i*3] - wx + px_ * arc;
      const ry   = hist[i*3+1] - wy + py_ * arc;
      const rz   = hist[i*3+2] - wz;
      const vi   = i * 6;
      pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
      pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
      const tc = trailHead.clone().lerp(trailTail, t);
      const alpha = (1 - t) * 0.82;
      const ci    = i * 8;
      cA[ci]   = tc.r; cA[ci+1] = tc.g; cA[ci+2] = tc.b; cA[ci+3] = alpha;
      cA[ci+4] = tc.r; cA[ci+5] = tc.g; cA[ci+6] = tc.b; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true; cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  const isCharged = projectile.isCharged;

  useFrame(() => {
    const motion = getLiveProjectileMotion(projectile);
    if (!motion) return;
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#ff9900"
        intensity={isCharged ? 12 : 8}
        distance={isCharged ? 6 : 4}
        decay={2} />
      <mesh geometry={ribbonGeo} material={ribbonMat} />
    </group>
  );
}

// ── Overcharged Blaster visual ────────────────────────────────────────────────
const _RIBBON_N  = 16;
const _RIBBON_HW = 0.22; // half-width at head

function OverchargedProjectileMesh({
  projectile, spawnScale, trailPalette,
}: {
  projectile: Projectile; spawnScale: number; trailPalette: PlayerSkinTrailPalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spawnGroupRef = useRef<THREE.Group>(null);
  const trailHead = useMemo(() => new THREE.Color(trailPalette.head), [trailPalette.head]);
  const trailTail = useMemo(() => new THREE.Color(trailPalette.tail), [trailPalette.tail]);
  const glowLightRef = useRef<THREE.PointLight>(null);

  // ── Trailing ribbon geometry ─────────────────────────────────────────────────
  const ribbonGeo = useMemo(() => {
    const geo   = new THREE.BufferGeometry();
    const N     = _RIBBON_N;
    const pArr  = new Float32Array(N * 2 * 3);
    const cArr  = new Float32Array(N * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const b = i * 2;
      idx.push(b, b+2, b+1, b+1, b+2, b+3);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(cArr, 4));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => { ribbonGeo.dispose(); ribbonMat.dispose(); }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_RIBBON_N * 3));
  const histLenRef = useRef(0);

  // Capture latest prop values in refs so the useFrame closure is never stale
  const projRef      = useRef(projectile);
  const spawnScaleRef = useRef(spawnScale);
  projRef.current      = projectile;
  spawnScaleRef.current = spawnScale;

  useFrame(({ clock }) => {
    const proj = projRef.current;
    const ss   = spawnScaleRef.current;
    const motion = getLiveProjectileMotion(proj);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
    const visualScale = motion?.spawnScale ?? ss;
    if (spawnGroupRef.current) spawnGroupRef.current.scale.setScalar(visualScale);
    const travelTimer = motion?.travelTimer ?? 0;
    const chargeT = Math.max(0, Math.min(1, (travelTimer - (OC_TRAVEL_TIME - 0.5)) / 0.5));
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * (4.5 + chargeT * 18));
    if (glowLightRef.current) glowLightRef.current.intensity = 8 + pulse * 4;
    const [wx, wy, wz] = motion?.position ?? proj.position;

    // Push position into history (most-recent at index 0)
    const N   = _RIBBON_N;
    const len = Math.min(histLenRef.current + 1, N);
    histLenRef.current = len;
    const hist = posHistRef.current;
    for (let i = len - 1; i > 0; i--) {
      hist[i*3] = hist[(i-1)*3]; hist[i*3+1] = hist[(i-1)*3+1]; hist[i*3+2] = hist[(i-1)*3+2];
    }
    hist[0] = wx; hist[1] = wy; hist[2] = wz;
    if (len < 2) {
      ribbonGeo.setDrawRange(0, 0);
      return;
    }

    // Perpendicular to fire direction (for ribbon width)
    const [fdx, fdy] = motion?.direction ?? proj.direction;
    const fl = Math.sqrt(fdx*fdx + fdy*fdy) || 1;
    const px_ = -fdy / fl, py_ = fdx / fl;

    const pAttr = ribbonGeo.getAttribute("position") as THREE.BufferAttribute;
    const cAttr = ribbonGeo.getAttribute("color")    as THREE.BufferAttribute;
    const pA    = pAttr.array as Float32Array;
    const cA    = cAttr.array as Float32Array;

    for (let i = 0; i < len; i++) {
      const t  = i / (len - 1);
      const hw = _RIBBON_HW * (1 - t) * visualScale;
      const rx = hist[i*3] - wx, ry = hist[i*3+1] - wy, rz = hist[i*3+2] - wz;
      const vi = i * 6;
      pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
      pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
      const alpha = (1 - t) * 0.65 * Math.min(visualScale * 2, 1);
      const tc = trailHead.clone().lerp(trailTail, t);
      const ci = i * 8;
      cA[ci]   = tc.r; cA[ci+1] = tc.g; cA[ci+2] = tc.b; cA[ci+3] = alpha;
      cA[ci+4] = tc.r; cA[ci+5] = tc.g; cA[ci+6] = tc.b; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true;
    cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  return (
    <group ref={groupRef}>
      {/* Trailing ribbon rendered behind the spawn-scale group */}
      <mesh geometry={ribbonGeo} material={ribbonMat} />
      {/* Scale-in group: everything below grows from 0.05 → 1.0 on spawn */}
      <group ref={spawnGroupRef} scale={spawnScale}>
        <pointLight ref={glowLightRef} color={trailPalette.base} intensity={8} distance={9} decay={2} />
        <pointLight color={trailPalette.head} intensity={4} distance={3} decay={2} />
      </group>
    </group>
  );
}

// ── Orbital Spiral Blaster mesh — 3 orbiting player-orb sub-spheres ──────────

function SpiralBundleMesh({
  projectile,
  trailPalette,
}: {
  projectile: Projectile;
  trailPalette: PlayerSkinTrailPalette;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trailStrands = useMemo(
    () => trailPalette.strands.map((color) => new THREE.Color(color)),
    [trailPalette.strands],
  );
  const projRef   = useRef(projectile);
  projRef.current = projectile;

  // 3 ribbon trail geometries (one per sub-sphere, helix formed by helical paths)
  const ribbonGeos = useMemo(() =>
    Array.from({ length: 3 }, () => {
      const geo  = new THREE.BufferGeometry();
      const N    = SPIRAL_TRAIL_N;
      const pArr = new Float32Array(N * 2 * 3);
      const cArr = new Float32Array(N * 2 * 4);
      const idx: number[] = [];
      for (let i = 0; i < N - 1; i++) { const b = i * 2; idx.push(b, b+2, b+1, b+1, b+2, b+3); }
      geo.setIndex(idx);
      geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
      geo.setAttribute("color",    new THREE.BufferAttribute(cArr, 4));
      geo.setDrawRange(0, 0);
      return geo;
    }), []);

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => {
    ribbonGeos.forEach(g => g.dispose());
    ribbonMat.dispose();
  }, [ribbonGeos, ribbonMat]);

  // Per-sub-sphere position histories for ribbon trails
  const posHists  = useRef<Float32Array[]>(Array.from({ length: 3 }, () => new Float32Array(SPIRAL_TRAIL_N * 3)));
  const histLens  = useRef([0, 0, 0]);

  // Death-flash state: remaining time per sub-sphere
  const deathFlashT   = useRef<[number, number, number]>([-1, -1, -1]);
  const prevAliveRef  = useRef([true, true, true]);

  // Only death flashes remain here; the pooled player-orb batch owns all three
  // live sub-sphere cores so an older PlayerGlow cannot fight it on screen.
  const flashRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  useFrame((_, delta) => {
    const proj = projRef.current;
    const motion = projectilePhysicsMap.get(proj.id);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
    const [cx, cy, cz] = motion?.position ?? proj.position;
    const [fdx, fdy]   = motion?.direction ?? proj.direction;
    const phase        = motion?.spiralAngle ?? proj.spiralAngle ?? 0;
    const alive        = motion?.subSphereAlive ?? proj.subSphereAlive ?? [true, true, true];

    // Detect newly-dead sub-spheres → start flash timer
    for (let si = 0; si < 3; si++) {
      if (prevAliveRef.current[si] && !alive[si]) deathFlashT.current[si] = 0.12;
      prevAliveRef.current[si] = alive[si];
    }

    const fl   = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
    const px_  = -fdy / fl, py_ = fdx / fl; // ribbon width perp

    for (let si = 0; si < 3; si++) {
      const [spx, spy, spz] = _getSpiralSubPos(cx, cy, cz, fdx, fdy, phase, si);

      // Death flash
      const flash = flashRefs[si].current;
      if (flash) {
        const ft = deathFlashT.current[si];
        if (ft > 0) {
          deathFlashT.current[si] = Math.max(0, ft - delta);
          const prog = deathFlashT.current[si] / 0.12;
          (flash.material as THREE.MeshBasicMaterial).opacity = prog * 0.95;
          flash.scale.setScalar(SPIRAL_SUB_SCALE * (1 + (1 - prog) * 4.5));
          flash.visible = true;
          flash.position.set(spx - cx, spy - cy, spz - cz);
        } else {
          flash.visible = false;
        }
      }

      // Ribbon trail — keep updating while alive, fade out gracefully after death
      if (!alive[si] && histLens.current[si] === 0) continue;

      const N   = SPIRAL_TRAIL_N;
      const len = Math.min(histLens.current[si] + (alive[si] ? 1 : 0), N);
      histLens.current[si] = len;
      const hist = posHists.current[si];

      if (alive[si]) {
        for (let k = Math.min(len - 1, N - 1); k > 0; k--) {
          hist[k*3] = hist[(k-1)*3]; hist[k*3+1] = hist[(k-1)*3+1]; hist[k*3+2] = hist[(k-1)*3+2];
        }
        hist[0] = spx; hist[1] = spy; hist[2] = spz;
      }

      if (len < 2) continue;

      const geo   = ribbonGeos[si];
      const pAttr = geo.getAttribute("position") as THREE.BufferAttribute;
      const cAttr = geo.getAttribute("color")    as THREE.BufferAttribute;
      const pA    = pAttr.array as Float32Array;
      const cA    = cAttr.array as Float32Array;
      const tc    = trailStrands[si];
      const fade  = alive[si] ? 1.0 : Math.max(0, deathFlashT.current[si] / 0.12);

      for (let k = 0; k < len; k++) {
        const t  = k / (len - 1);
        const hw = SPIRAL_TRAIL_HW * (1 - t * 0.8);
        const rx = hist[k*3]   - cx, ry = hist[k*3+1] - cy, rz = hist[k*3+2] - cz;
        const vi = k * 6;
        pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
        pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
        const alpha = (1 - t) * 0.78 * fade;
        const ci = k * 8;
        cA[ci]   = tc.r; cA[ci+1] = tc.g; cA[ci+2] = tc.b; cA[ci+3] = alpha;
        cA[ci+4] = tc.r; cA[ci+5] = tc.g; cA[ci+6] = tc.b; cA[ci+7] = alpha;
      }
      pAttr.needsUpdate = true; cAttr.needsUpdate = true;
      geo.setDrawRange(0, (len - 1) * 6);
      geo.computeBoundingSphere();
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central point light */}
      <pointLight color="#aaddff" intensity={8} distance={7} decay={2} />

      {/* Helix ribbon trails */}
      {ribbonGeos.map((geo, i) => (
        <mesh key={`ribbon-${i}`} geometry={geo} material={ribbonMat} />
      ))}

      {/* Per-sub-sphere death flash spheres */}
      {[0, 1, 2].map(si => (
        <mesh key={`flash-${si}`} ref={flashRefs[si]} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial
            color={SPIRAL_COLORS_HEX[si]}
            transparent opacity={0}
            depthWrite={false} blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

    </group>
  );
}

function ImpactEffectMesh({ effect, skinColors }: {
  effect: ImpactEffect;
  time: number;
  skinColors: { particles: string[]; glow: string; core: string; emissive: string };
}) {
  const progress = 1 - effect.timer / effect.maxTimer;
  const teleportRef = useRef<StarTeleportVFXState>({
    departurePos: effect.fromPosition ?? effect.position,
    departureProgress: 0,
    arrivalPos: effect.toPosition ?? effect.position,
    arrivalProgress: 0,
  });

  if (effect.isSpatialRelocation && effect.fromPosition && effect.toPosition) {
    const departureEnd = 0.48;
    const p = Math.max(0, Math.min(1, progress));
    teleportRef.current.departurePos = effect.fromPosition;
    teleportRef.current.arrivalPos = effect.toPosition;
    teleportRef.current.departureProgress = Math.min(1, p / departureEnd);
    teleportRef.current.arrivalProgress = p <= departureEnd
      ? 0
      : Math.min(1, (p - departureEnd) / (1 - departureEnd));
    return <StarBossTeleportVFX vfxRef={teleportRef} scale={1.15} />;
  }

  if (effect.isBossHit) {
    // Boss hit: point-light flash + particles only — no white crush geometry.
    // Light fades from peak brightness to zero over the effect lifetime.
    const fade = Math.max(0, 1 - progress);
    const lightIntensity = fade * fade * 24;
    return (
      <group position={effect.position}>
        {/* Warm fire-orange burst light — replaces the white circle */}
        <pointLight
          color="#ff7722"
          intensity={lightIntensity}
          distance={6}
          decay={2}
        />
        {/* Particle scatter rendered on top of the boss (depthTest off) */}
        <EnergyDissipationVFX
          progress={progress}
          color={skinColors.core}
          glowColor={skinColors.glow}
          scale={0.38}
          seed={Math.round(effect.seed * 9999)}
          depthTest={false}
          hideCrush={true}
        />
      </group>
    );
  }

  return (
    <group position={effect.position}>
      <EnergyDissipationVFX
        progress={progress}
        color={skinColors.core}
        glowColor={skinColors.glow}
        scale={0.38}
        seed={Math.round(effect.seed * 9999)}
        depthTest={false}
      />
    </group>
  );
}

let impactIdCounter = 0;

export function Projectiles() {
  const projectiles            = useMagicOrb(s => s.projectiles);
  const playerHealth           = useMagicOrb(s => s.health);
  const playerMaxHealth        = useMagicOrb(s => s.maxHealth);
  const updateProjectiles      = useMagicOrb(s => s.updateProjectiles);
  const darkOrbs               = useMagicOrb(s => s.darkOrbs);
  const markOrbDestroying      = useMagicOrb(s => s.markOrbDestroying);
  const powerUps               = useMagicOrb(s => s.powerUps);
  const markPowerUpCollected   = useMagicOrb(s => s.markPowerUpCollected);
  const removePowerUp          = useMagicOrb(s => s.removePowerUp);
  const hurtPowerUp            = useMagicOrb(s => s.hurtPowerUp);
  const activateShield         = useMagicOrb(s => s.activateShield);
  const activateChargeBeam     = useMagicOrb(s => s.activateChargeBeam);
  const heal                   = useMagicOrb(s => s.heal);
  const activateDoubleCoins    = useMagicOrb(s => s.activateDoubleCoins);
  const activateRapidFire      = useMagicOrb(s => s.activateRapidFire);
  const addScore               = useMagicOrb(s => s.addScore);
  const addParticles           = useMagicOrb(s => s.addParticles);
  const impactEffects          = useMagicOrb(s => s.impactEffects);
  const updateImpactEffects    = useMagicOrb(s => s.updateImpactEffects);
  const addImpactEffect        = useMagicOrb(s => s.addImpactEffect);
  const phase                  = useMagicOrb(s => s.phase);
  const boss                   = useMagicOrb(s => s.boss);
  const damageBoss             = useMagicOrb(s => s.damageBoss);
  const incrementOrbsDestroyed = useMagicOrb(s => s.incrementOrbsDestroyed);
  const gameMode               = useMagicOrb(s => s.gameMode);
  const registerMissedShot     = useMagicOrb(s => s.registerMissedShot);
  const recordHit              = useMagicOrb(s => s.recordHit);
  const incrementGauntletOrbs  = useMagicOrb(s => s.incrementGauntletOrbs);
  const addStarFlowEvent       = useMagicOrb(s => s.addStarFlowEvent);
  
  const {
    playHit,
    playSuccess,
    playRapidFirePowerUp,
    playChargeBeamPowerUp,
    playSparkleExplosion,
  } = useAudio();
  const { equippedTrail, equippedSkin, weaponProgression } = useShop();
  const clockRef = useRef(0);
  const projectileSpeed = 16.5;
  const hitOrbsThisFrame = useRef<Set<string>>(new Set());
  const hitPowerUpsThisFrame = useRef<Set<string>>(new Set());
  // Tracks which spiral projectiles have already pierced through the boss this
  // pass so they don't register multiple hits while inside the hit radius.
  const spiralBossHit = useRef<Set<string>>(new Set());
  const projectileOrbHits = useRef<Map<string, Set<string>>>(new Map());
  const projectilePowerUpHits = useRef<Map<string, Set<string>>>(new Map());
  const volleyHits = useRef<Set<string>>(new Set());
  const volleyProjectileCounts = useRef<Map<string, number>>(new Map());
  const volleyRemainingCounts = useRef<Map<string, number>>(new Map());
  const removedProjectileIds = useRef<Set<string>>(new Set());
  const activeProjectileIds = useRef<Set<string>>(new Set());
  const activeVolleyCounts = useRef<Map<string, number>>(new Map());
  const impactUpdateAccumulator = useRef(0);
  const enemyCollisionGrid = useRef(new EnemyCollisionGrid());
  const playerFireBurstPool = useRef<PlayerFireBurstPool>(createPlayerFireBurstPool());
  const overchargedExplosionPool = useRef(createOverchargedExplosionPool());
  const burstResetVersion = useRef(gameRuntime.resetVersion);
  const collisionsEnabled = usePerformanceFeature("collision");

  // ── Overcharged shockwave rings ───────────────────────────────────────────
  const knownOcIds   = useRef<Set<string>>(new Set());
  const presentedOverchargedDetonations = useRef<Set<string>>(new Set());
  const [shockwaves,   setShockwaves]   = useState<Array<{ id: string; pos: [number,number,number] }>>([]);
  const swTimeoutsRef    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Homing lock-on ring flashes ───────────────────────────────────────────
  const knownHomingIds = useRef<Set<string>>(new Set());
  const [homingLockRings, setHomingLockRings] = useState<Array<{
    id: string; pos: [number,number,number]; dirX: number; dirY: number;
  }>>([]);
  const hmRingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Scattershot muzzle arc flashes ────────────────────────────────────────
  const knownScatterVolleys = useRef<Set<string>>(new Set());
  const [scatterArcs, setScatterArcs] = useState<Array<{
    id: string; pos: [number,number,number]; dirX: number; dirY: number;
  }>>([]);
  const scatterArcTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => {
    resetPlayerFireBurstPool(playerFireBurstPool.current);
    resetOverchargedExplosionPool(overchargedExplosionPool.current);
    resetProjectileMotion();
    for (const timeout of swTimeoutsRef.current.values()) clearTimeout(timeout);
    for (const timeout of hmRingTimeoutsRef.current.values()) clearTimeout(timeout);
    for (const timeout of scatterArcTimeoutsRef.current.values()) clearTimeout(timeout);
    swTimeoutsRef.current.clear();
    hmRingTimeoutsRef.current.clear();
    scatterArcTimeoutsRef.current.clear();
    knownOcIds.current.clear();
    presentedOverchargedDetonations.current.clear();
    knownHomingIds.current.clear();
    knownScatterVolleys.current.clear();
    spiralBossHit.current.clear();
    projectileOrbHits.current.clear();
    projectilePowerUpHits.current.clear();
    volleyHits.current.clear();
    volleyProjectileCounts.current.clear();
    volleyRemainingCounts.current.clear();
  }, []);

  // GameScene resets the runtime at terminal/session phases. Clear the local
  // GPU presentation pool as well so a stale flash cannot enter the next run.
  useEffect(() => {
    if (phase !== "playing") {
      resetPlayerFireBurstPool(playerFireBurstPool.current);
      resetOverchargedExplosionPool(overchargedExplosionPool.current);
      presentedOverchargedDetonations.current.clear();
    }
  }, [phase]);
  
  const skinColors = useMemo(() => getSkinColors(equippedSkin, 3), [equippedSkin]);
  const playerScale = useMemo(
    () => getPlayerOrbScale(playerHealth, playerMaxHealth),
    [playerHealth, playerMaxHealth],
  );
  const projectileColor = skinColors.projectile;
  const defaultTrailPalette = useMemo(() => getPlayerSkinTrailPalette(equippedSkin), [equippedSkin]);
  const presentOverchargedDetonation = (
    projectile: Pick<Projectile, "id" | "type" | "explosionScale">,
    position: [number, number, number],
    direction: [number, number, number],
  ) => {
    if (!shouldPresentOverchargedDetonation(
      projectile,
      presentedOverchargedDetonations.current.has(projectile.id),
    )) return;

    presentedOverchargedDetonations.current.add(projectile.id);
    emitOverchargedExplosion(overchargedExplosionPool.current, {
      id: `ocexp-${projectile.id}`,
      position,
      direction,
      palette: {
        core: skinColors.core,
        glow: skinColors.glow,
        emissive: skinColors.emissive,
        accent: skinColors.accent,
        projectile: skinColors.projectile,
        particles: skinColors.particles,
      },
      scale: projectile.explosionScale ?? 1,
    });
  };
   const batchedProjectiles = useMemo(
     () => projectiles.filter(isPlayerProjectile),
     [projectiles],
   );

  // Spawn effects consume successful admission events. This avoids an active
  // projectile scan every frame while still preserving effects for shots that
  // collide and disappear before React can commit a structural update.
  useFrame(() => {
    if (burstResetVersion.current !== gameRuntime.resetVersion) {
      burstResetVersion.current = gameRuntime.resetVersion;
      resetPlayerFireBurstPool(playerFireBurstPool.current);
      resetOverchargedExplosionPool(overchargedExplosionPool.current);
    }
    gameRuntime.playerProjectileBurstSpawns.consume((event) => {
      emitPlayerProjectileFireBurst(playerFireBurstPool.current, event, skinColors);
    });
    gameRuntime.projectileSpawns.consume((event) => {
      if (event.type === "overcharged" && !knownOcIds.current.has(event.id)) {
        knownOcIds.current.add(event.id);
        const swId = `sw-${event.id}`;
        const position: [number, number, number] = [
          event.position[0], event.position[1], event.position[2],
        ];
        setShockwaves((previous) => [...previous, { id: swId, pos: position }]);
        swTimeoutsRef.current.set(swId, setTimeout(() => {
          setShockwaves((previous) => previous.filter((effect) => effect.id !== swId));
          swTimeoutsRef.current.delete(swId);
        }, 680));
      }

      if (event.type === "homing" && !knownHomingIds.current.has(event.id)) {
        knownHomingIds.current.add(event.id);
        const ringId = `hring-${event.id}`;
        const position: [number, number, number] = [
          event.position[0], event.position[1], event.position[2],
        ];
        setHomingLockRings((previous) => [
          ...previous,
          { id: ringId, pos: position, dirX: event.direction[0], dirY: event.direction[1] },
        ]);
        hmRingTimeoutsRef.current.set(ringId, setTimeout(() => {
          setHomingLockRings((previous) => previous.filter((effect) => effect.id !== ringId));
          hmRingTimeoutsRef.current.delete(ringId);
        }, 350));
      }

      if (
        event.type === "scattershot" &&
        event.volleyId &&
        !knownScatterVolleys.current.has(event.volleyId)
      ) {
        knownScatterVolleys.current.add(event.volleyId);
        const arcId = `sarc-${event.volleyId}`;
        const position: [number, number, number] = [
          event.position[0], event.position[1], event.position[2],
        ];
        setScatterArcs((previous) => [
          ...previous,
          { id: arcId, pos: position, dirX: event.direction[0], dirY: event.direction[1] },
        ]);
        scatterArcTimeoutsRef.current.set(arcId, setTimeout(() => {
          setScatterArcs((previous) => previous.filter((effect) => effect.id !== arcId));
          scatterArcTimeoutsRef.current.delete(arcId);
        }, 250));
      }
    });
  }, -1);
  
  useFrame((state, delta) => {
    gameRuntime.pipeline.enter("projectiles");
    runtimeDiagnostics.beginSimulation();
    clockRef.current = state.clock.getElapsedTime();
    
    const {
      projectiles,
      darkOrbs,
      powerUps,
      impactEffects,
      phase,
      boss,
      gameMode,
      updateProjectiles,
      markOrbDestroying,
      markPowerUpCollected,
      removePowerUp,
      activateShield,
      activateChargeBeam,
      heal,
      activateDoubleCoins,
      activateRapidFire,
      addScore,
      addParticles,
      updateImpactEffects,
      addImpactEffect,
      damageBoss,
      incrementOrbsDestroyed,
      registerMissedShot,
      recordHit,
      incrementGauntletOrbs,
      addStarFlowEvent,
    } = useMagicOrb.getState();
    
    if (phase !== "playing") {
      runtimeDiagnostics.endSimulation();
      return;
    }
    if (collisionsEnabled) {
      runtimeDiagnostics.beginCollision();
      enemyCollisionGrid.current.build(darkOrbs);
    }

    if (impactEffects.length > 0) {
      // Visual effect timing does not need a store write every render frame.
      // Apply the accumulated time at 30 Hz to preserve duration while
      // reducing React/Zustand allocation churn during dense hits.
      impactUpdateAccumulator.current += delta;
      if (impactUpdateAccumulator.current >= 1 / 30) {
        const elapsed = impactUpdateAccumulator.current;
        impactUpdateAccumulator.current = 0;
      const updatedEffects: typeof impactEffects = [];
      for (const e of impactEffects) {
          const newTimer = e.timer - elapsed;
        if (newTimer > 0) updatedEffects.push({ ...e, timer: newTimer });
      }
      updateImpactEffects(updatedEffects);
      }
    } else {
      impactUpdateAccumulator.current = 0;
    }
    
    if (projectiles.length === 0) {
      for (const id of projectilePhysicsMap.keys()) releaseProjectileMotion(id);
      projectileOrbHits.current.clear();
      projectilePowerUpHits.current.clear();
      spiralBossHit.current.clear();
      volleyHits.current.clear();
      volleyProjectileCounts.current.clear();
      volleyRemainingCounts.current.clear();
      if (collisionsEnabled) runtimeDiagnostics.endCollision();
      runtimeDiagnostics.endSimulation();
      return;
    }
    
    const removedIds = removedProjectileIds.current;
    removedIds.clear();
    let structuralChanged = false;
    const activeIds = activeProjectileIds.current;
    activeIds.clear();
    const frameVolleyCounts = activeVolleyCounts.current;
    frameVolleyCounts.clear();
    for (const proj of projectiles) {
      activeIds.add(proj.id);
      if (proj.volleyId) {
        frameVolleyCounts.set(proj.volleyId, (frameVolleyCounts.get(proj.volleyId) ?? 0) + 1);
      }
    }
    for (const proj of projectiles) getProjectileMotion(proj);
    for (const id of projectilePhysicsMap.keys()) {
      if (!activeIds.has(id)) releaseProjectileMotion(id);
    }
    hitOrbsThisFrame.current.clear();
    hitPowerUpsThisFrame.current.clear();
    
    for (const orb of darkOrbs) {
      if (orb.destroying) {
        Array.from(projectileOrbHits.current.entries()).forEach(([projId, orbSet]) => {
          orbSet.delete(orb.id);
        });
      }
    }
    
    for (const proj of projectiles) {
      const motion = getProjectileMotion(proj);
      if (proj.volleyId && !volleyProjectileCounts.current.has(proj.volleyId)) {
        const volleySize = frameVolleyCounts.get(proj.volleyId) ?? 1;
        volleyProjectileCounts.current.set(proj.volleyId, volleySize);
        volleyRemainingCounts.current.set(proj.volleyId, volleySize);
      }
      
      let [px, py, pz] = motion.position;
      let [dx, dy, dz] = motion.direction;
      motion.previousPosition[0] = px;
      motion.previousPosition[1] = py;
      motion.previousPosition[2] = pz;
      motion.previousDirection[0] = dx;
      motion.previousDirection[1] = dy;
      motion.previousDirection[2] = dz;
      motion.previousSpiralAngle = motion.spiralAngle;
      const previousProjectileX = motion.previousPosition[0];
      const previousProjectileY = motion.previousPosition[1];
      const previousProjectileZ = motion.previousPosition[2];
      
      if (proj.homing) {
        // Inline the filter into the closest-orb search (single pass, no allocation).
        let closestTargetPosition: [number, number, number] | null = null;
        let closestDist2 = Infinity; // compare squared distances — no sqrt needed for selection

        for (const orb of darkOrbs) {
          const orbPosition = liveOrbPosition(orb);
          if (orb.destroying) continue;
          const d2 = (orbPosition[0] - px) ** 2 + (orbPosition[1] - py) ** 2;
          if (d2 < closestDist2) {
            closestDist2 = d2;
            closestTargetPosition = orbPosition;
          }
        }

        if (boss && !boss.destroying && !boss.shieldActive) {
          const bossPosition = gameRuntime.boss.get(boss.id)?.position ?? boss.position;
          const bossDist2 = (bossPosition[0] - px) ** 2 + (bossPosition[1] - py) ** 2;
          if (bossDist2 < closestDist2) {
            closestDist2 = bossDist2;
            closestTargetPosition = bossPosition;
          }
        }
        
        if (closestTargetPosition) {
          const targetDirX = closestTargetPosition[0] - px;
          const targetDirY = closestTargetPosition[1] - py;
          const len = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY);
          if (len > 0.1) {
            const tdx = targetDirX / len;
            const tdy = targetDirY / len;
            // Steer within a ~90° forward cone — targets directly behind are ignored.
            const dot = dx * tdx + dy * tdy;
            if (dot > 0.0) {
              // RotateTowards: clamp angular change to the level-specific authority
              // so early homing upgrades curve less aggressively.
              // and can miss targets that move perpendicular or very fast.
              const MAX_TURN_RAD = (
                getWeaponConfig("homing_launcher", weaponProgression.homing_launcher.level).homingTurnRateDegrees
                * Math.PI / 180
              ) * delta;
              const curAngle = Math.atan2(dy, dx);
              const tgtAngle = Math.atan2(tdy, tdx);
              let dAngle = tgtAngle - curAngle;
              // Wrap to [-π, π]
              if (dAngle >  Math.PI) dAngle -= 2 * Math.PI;
              if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
              const turn = Math.sign(dAngle) * Math.min(Math.abs(dAngle), MAX_TURN_RAD);
              const newAngle = curAngle + turn;
              dx = Math.cos(newAngle);
              dy = Math.sin(newAngle);
            }
          }
        }
      }
      
      let newSpiralAngle = motion.spiralAngle;
      // Old-style spiralAngle steers direction only for non-spiral types.
      if (newSpiralAngle !== undefined && proj.type !== "spiral") {
        const spiralSpeed = 3;
        newSpiralAngle = newSpiralAngle + delta * spiralSpeed;
        dx = Math.cos(newSpiralAngle);
        dy = Math.sin(newSpiralAngle);
      } else if (proj.type === "spiral") {
        // Advance orbit phase for sub-sphere positioning (not steering)
        newSpiralAngle = (motion.spiralAngle ?? 0) + delta * SPIRAL_ORBIT_SPEED;
      }
      
      const effSpeed = proj.speed ?? projectileSpeed;
      // The projectile reaches its detonation point before the build-up starts,
      // then remains there while the condensation VFX gathers energy.
      const wasCondensing = proj.type === "overcharged" &&
        (motion.travelTimer ?? 0) >= OC_TRAVEL_TIME;
      if (!wasCondensing) {
        px += dx * effSpeed * delta;
        py += dy * effSpeed * delta;
        pz += dz * effSpeed * delta;
      }

      // Grow-in scale for overcharged (EaseOutQuad over 0.15 s)
      let newSpawnScale    = motion.spawnScale;
      let newSpawnScaleTimer = motion.spawnScaleTimer;
      if (proj.type === "overcharged" && newSpawnScaleTimer !== undefined && newSpawnScaleTimer < 0.15) {
        newSpawnScaleTimer = newSpawnScaleTimer + delta;
        const eoqT  = Math.min(1, newSpawnScaleTimer / 0.15);
        newSpawnScale = 0.05 + 0.95 * easeOutQuad(eoqT);
      }

      // Presentation admission is independent from collision profiling. Damage,
      // removal, scoring, audio, and shake remain in the gameplay branch below.
      let newTravelTimer = motion.travelTimer;
      if (proj.type === "overcharged" && newTravelTimer !== undefined) {
        newTravelTimer += delta;
        if (isOverchargedVfxReady(newTravelTimer)) {
          presentOverchargedDetonation(proj, [px, py, pz], [dx, dy, dz]);
        }
      }

      if (Math.abs(px) > PROJECTILE_WORLD_BOUNDARY_X || Math.abs(py) > PROJECTILE_WORLD_BOUNDARY_Y) {
        const projHasHit = projectileOrbHits.current.has(proj.id) && projectileOrbHits.current.get(proj.id)!.size > 0;
        
        if (proj.volleyId) {
          if (projHasHit) {
            volleyHits.current.add(proj.volleyId);
          }
          const remaining = (volleyRemainingCounts.current.get(proj.volleyId) || 1) - 1;
          volleyRemainingCounts.current.set(proj.volleyId, remaining);
          
          if (remaining <= 0) {
            if (!volleyHits.current.has(proj.volleyId) && !proj.noMissTracking) {
              registerMissedShot(volleyProjectileCounts.current.get(proj.volleyId) || 1);
            }
            volleyHits.current.delete(proj.volleyId);
            volleyRemainingCounts.current.delete(proj.volleyId);
            volleyProjectileCounts.current.delete(proj.volleyId);
          }
        } else {
          const isPrimaryShot = proj.type === "normal" || proj.type === "homing" || proj.type === undefined;
          if (isPrimaryShot && !projHasHit && !proj.noMissTracking) {
            registerMissedShot();
          }
        }
        
        projectileOrbHits.current.delete(proj.id);
        removedIds.add(proj.id);
        structuralChanged = true;
        continue;
      }

      // Development A/B switch: retain movement and out-of-bounds behavior,
      // but bypass every gameplay hit path so collision cost is measurable.
      if (!collisionsEnabled) {
        motion.position[0] = px;
        motion.position[1] = py;
        motion.position[2] = pz;
        motion.direction[0] = dx;
        motion.direction[1] = dy;
        motion.direction[2] = dz;
        motion.spiralAngle = newSpiralAngle;
        motion.spawnScale = newSpawnScale;
        motion.spawnScaleTimer = newSpawnScaleTimer;
        motion.travelTimer = newTravelTimer;
        continue;
      }
      
      let hitSomething = false;

      // VFX starts at condensation; gameplay waits for the outward climax.
      if (proj.type === "overcharged" && newTravelTimer !== undefined) {
        if (isOverchargedDamageReady(newTravelTimer)) {
          hitSomething = true;
          const explosionScale = proj.explosionScale ?? 1;
          const explosionRadius = OC_EXPLODE_RADIUS * explosionScale;

          useMagicOrb.getState().triggerBackgroundShake();
          playSparkleExplosion();

          if (boss && !boss.destroying) {
            const [bx, by, bz] = gameRuntime.boss.get(boss.id)?.position ?? boss.position;
            if (Math.sqrt((px-bx)**2+(py-by)**2+((bz||0)-pz)**2) < explosionRadius + BOSS_BODY_RADIUS) {
              recordHit(proj.id);
              const bossKilled = damageBoss(8, [dx, dy, dz]);
              addScore(25); playHit();
              if (bossKilled) playSparkleExplosion();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: [bx, by, bz||0], timer: 0.55, maxTimer: 0.55, seed: Math.random(), isBossHit: true });
            }
          }

          const explosionCandidates = enemyCollisionGrid.current.queryAabb(
            px - explosionRadius,
            px + explosionRadius,
            py - explosionRadius,
            py + explosionRadius,
          );
          for (const orbIndex of explosionCandidates) {
            const orb = darkOrbs[orbIndex];
            if (orb.destroying) continue;
            const [ox, oy, oz] = liveOrbPosition(orb);
            if (Math.sqrt((px-ox)**2+(py-oy)**2+(pz-oz)**2) < explosionRadius + getStandardEnemyBodyRadius(orb)) {
              recordHit(proj.id);
              markOrbDestroying(orb.id, [ox, oy, oz]);
              addScore(10); incrementGauntletOrbs();
              addStarFlowEvent([ox, oy, oz], getEnemyStarRewardCount(gameMode, orb.isBossOrb));
              if (gameMode === "arcade") incrementOrbsDestroyed();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: [ox, oy, oz], timer: 0.4, maxTimer: 0.4, seed: Math.random() });
            }
          }

          for (const powerUp of powerUps) {
            if (powerUp.collected || powerUp.destroying || powerUp.hurtTimer) continue;
            const { end: [pux, puy, puz] } =
              gameRuntime.powerUps.collisionSegmentFor(powerUp, delta);
            if (Math.sqrt((px-pux)**2+(py-puy)**2+(pz-puz)**2) < explosionRadius + POWER_UP_BODY_RADIUS) {
              hitPowerUpsThisFrame.current.add(powerUp.id);
              hurtPowerUp(powerUp.id);
              if (powerUp.type === "rapidFire") playRapidFirePowerUp();
              else if (powerUp.type === "chargeBeam") playChargeBeamPowerUp();
              else playSuccess();
              addImpactEffect({
                id: `impact-${impactIdCounter++}`,
                position: [pux, puy, puz],
                timer: 0.4,
                maxTimer: 0.4,
                seed: Math.random(),
              });
            }
          }
          if (proj.volleyId) volleyHits.current.add(proj.volleyId);
        }
      }

      // ── Orbital Spiral Blaster: per-sub-sphere collision (boss + orbs) ────
      if (proj.type === "spiral") {
        const _subAlive = motion.subSphereAlive ?? [true, true, true];
        const _fdx = dx;
        const _fdy = dy;
        const [_previousFdx, _previousFdy] = motion.previousDirection;
        // The collision endpoint must match the new phase committed at the end
        // of this frame; otherwise fast orbital motion can tunnel independently
        // of the projectile parent's forward movement.
        const _phase = newSpiralAngle ?? motion.spiralAngle ?? 0;
        const _previousPhase = motion.previousSpiralAngle ?? _phase;

        if (boss && !boss.destroying && !boss.shieldActive) {
          const liveBoss = gameRuntime.boss.get(boss.id);
          const [bx, by, bz] = liveBoss?.position ?? boss.position;
          for (let si = 0; si < 3; si++) {
            if (!_subAlive[si]) continue;
            const _sk = `${proj.id}-b${si}`;
            if (spiralBossHit.current.has(_sk)) continue;
            const [_prevSpx, _prevSpy, _prevSpz] = _getSpiralSubPos(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              _previousFdx, _previousFdy, _previousPhase, si,
            );
            const [_spx, _spy, _spz] = _getSpiralSubPos(px, py, pz, _fdx, _fdy, _phase, si);
            if (sweptSphereHit(
              _prevSpx, _prevSpy, _prevSpz,
              _spx, _spy, _spz,
              liveBoss?.previousPosition[0] ?? bx,
              liveBoss?.previousPosition[1] ?? by,
              liveBoss?.previousPosition[2] ?? bz ?? 0,
              bx, by, bz ?? 0,
              BOSS_BODY_RADIUS + getPlayerProjectileBodyRadius(proj, 1, playerScale),
            ) !== null) {
              spiralBossHit.current.add(_sk);
              _subAlive[si] = false;
              motion.hitCount = Math.max(0, (motion.hitCount ?? 3) - 1);
              const _ph = projectileOrbHits.current.get(proj.id) || new Set<string>();
              _ph.add("boss"); projectileOrbHits.current.set(proj.id, _ph);
              const _bk = damageBoss(undefined, [dx, dy, dz]);
              addScore(25); playHit();
              if (_bk) playSparkleExplosion();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: getBossImpactPosition([bx, by, bz ?? 0], [_spx, _spy, _spz], [dx, dy, dz]), timer: 0.45, maxTimer: 0.45, seed: Math.random(), isBossHit: true });
            }
          }
        }

        const spiralCandidates = enemyCollisionGrid.current.queryAabb(
          Math.min(previousProjectileX, px) - 3.5,
          Math.max(previousProjectileX, px) + 3.5,
          Math.min(previousProjectileY, py) - 3.5,
          Math.max(previousProjectileY, py) + 3.5,
        );
        for (const orbIndex of spiralCandidates) {
          const orb = darkOrbs[orbIndex];
          if (hitOrbsThisFrame.current.has(orb.id) || orb.destroying) continue;
          const [ox, oy, oz] = liveOrbPosition(orb);
          const _ph = projectileOrbHits.current.get(proj.id) || new Set<string>();
          if (_ph.has(orb.id)) continue;
          for (let si = 0; si < 3; si++) {
            if (!_subAlive[si]) continue;
            const [_prevSpx, _prevSpy, _prevSpz] = _getSpiralSubPos(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              _previousFdx, _previousFdy, _previousPhase, si,
            );
            const [_spx, _spy, _spz] = _getSpiralSubPos(px, py, pz, _fdx, _fdy, _phase, si);
            const previousEnemyPosition = gameRuntime.enemies.get(orb.id)?.previousPosition ?? [ox, oy, oz];
            if (sweptSphereHit(
              _prevSpx, _prevSpy, _prevSpz,
              _spx, _spy, _spz,
              previousEnemyPosition[0], previousEnemyPosition[1], previousEnemyPosition[2],
              ox, oy, oz,
              getProjectileEnemyCollisionRadius(proj, orb),
            ) !== null) {
              _subAlive[si] = false;
              motion.hitCount = Math.max(0, (motion.hitCount ?? 3) - 1);
              hitOrbsThisFrame.current.add(orb.id);
              recordHit(proj.id);
              markOrbDestroying(orb.id, [ox, oy, oz]);
              addScore(10); incrementGauntletOrbs(); playHit();
              if (proj.spiralDefeatExplosion) {
                addParticles(createExplosionParticles([ox, oy, oz], skinColors.particles));
              }
               addStarFlowEvent([ox, oy, oz], getEnemyStarRewardCount(gameMode, orb.isBossOrb));
              if (gameMode === "arcade") incrementOrbsDestroyed();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: [_spx, _spy, _spz], timer: 0.4, maxTimer: 0.4, seed: Math.random() });
              _ph.add(orb.id); projectileOrbHits.current.set(proj.id, _ph);
              break;
            }
          }
        }

        motion.subSphereAlive = _subAlive;
        if (!_subAlive.some(Boolean)) hitSomething = true;
      }

      // Overcharged shots can pierce and destroy enemies on contact, then still
      // deliver their separate timed outward AOE at the detonation point.
      if (!hitSomething && proj.type !== "spiral") {
      if (boss && !boss.destroying && !boss.shieldActive) {
        const liveBoss = gameRuntime.boss.get(boss.id);
        const [bx, by, bz] = liveBoss?.position ?? boss.position;
        const [previousBossX, previousBossY, previousBossZ] =
          liveBoss?.previousPosition ?? [bx, by, bz];
        const isOvercharged = isOverchargedDirectContact(proj);
        const bossHitRadius = BOSS_BODY_RADIUS + getPlayerProjectileBodyRadius(
          proj,
          isOvercharged ? motion.spawnScale ?? 1 : 1,
          playerScale,
        );
        
        if (
            sweptSphereHit(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              px, py, pz,
              previousBossX, previousBossY, previousBossZ || 0,
              bx, by, bz || 0,
              bossHitRadius,
            ) !== null &&
            !spiralBossHit.current.has(proj.id) &&
            (!isOvercharged || (motion.spawnScale ?? 1) >= 0.8)) {
          const isSpiralPiercing = motion.hitCount !== undefined && motion.hitCount > 1;

          if (isOvercharged) {
            spiralBossHit.current.add(proj.id);
            presentOverchargedDetonation(proj, [px, py, pz], [dx, dy, dz]);
            hitSomething = true;
          } else if (!isSpiralPiercing) {
            hitSomething = true;
          } else {
            // Spiral braid loses one strand, keeps flying
            motion.hitCount!--;
            spiralBossHit.current.add(proj.id);
          }

          const projHits = projectileOrbHits.current.get(proj.id) || new Set();
          projHits.add("boss");
          projectileOrbHits.current.set(proj.id, projHits);
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          const bossKilled = damageBoss(isOvercharged ? 5 : undefined, [dx, dy, dz]);
          recordHit(proj.id);
          addScore(25);
          playHit();
          
          if (bossKilled) {
            playSparkleExplosion();
          }
          
          // Place impact at the sphere surface point the projectile entered.
          {
            const bzSafe = bz || 0;
            addImpactEffect({
              id: `impact-${impactIdCounter++}`,
              position: getBossImpactPosition([bx, by, bzSafe], [px, py, pz], [dx, dy, dz]),
              timer: 0.5,
              maxTimer: 0.5,
              seed: Math.random(),
              isBossHit: true,
            });
          }
        }
      } else if (boss && boss.shieldActive) {
        const liveBoss = gameRuntime.boss.get(boss.id);
        const [bx, by, bz] = liveBoss?.position ?? boss.position;
        const [previousBossX, previousBossY, previousBossZ] =
          liveBoss?.previousPosition ?? [bx, by, bz];

        if (sweptSphereHit(
          previousProjectileX, previousProjectileY, previousProjectileZ,
          px, py, pz,
          previousBossX, previousBossY, previousBossZ || 0,
          bx, by, bz || 0,
          3.5,
        ) !== null) {
          hitSomething = true;
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [px, py, pz],
            timer: 0.3,
            maxTimer: 0.3,
            seed: Math.random(),
          });
        }
      }
      
        const collisionCandidates = enemyCollisionGrid.current.queryAabb(
          Math.min(previousProjectileX, px) - 4,
          Math.max(previousProjectileX, px) + 4,
          Math.min(previousProjectileY, py) - 4,
          Math.max(previousProjectileY, py) + 4,
        );
        for (const orbIndex of collisionCandidates) {
          const orb = darkOrbs[orbIndex];
        if (hitOrbsThisFrame.current.has(orb.id) || orb.destroying) continue;
        
        const [ox, oy, oz] = liveOrbPosition(orb);
        
        if (proj.piercing) {
          const _ph = projectileOrbHits.current.get(proj.id);
          if (_ph && _ph.has(orb.id)) continue;
        }
        const effectiveRadius = getProjectileEnemyCollisionRadius(
          proj,
          orb,
          isOverchargedDirectContact(proj) ? motion.spawnScale ?? 1 : 1,
          playerScale,
        );
        const enemyMotion = gameRuntime.enemies.get(orb.id);
        const previousEnemyPosition = enemyMotion?.previousPosition ?? [ox, oy, oz] as [number, number, number];

        if (
            sweptSphereHit(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              px, py, pz,
              previousEnemyPosition[0], previousEnemyPosition[1], previousEnemyPosition[2],
              ox, oy, oz,
              effectiveRadius,
            ) !== null &&
            (!isOverchargedDirectContact(proj) || (motion.spawnScale ?? 1) >= 0.8)) {
          hitOrbsThisFrame.current.add(orb.id);
          recordHit(proj.id);
          markOrbDestroying(orb.id, [ox, oy, oz]);
          addScore(10);
          incrementGauntletOrbs();
           addStarFlowEvent([ox, oy, oz], getEnemyStarRewardCount(gameMode, orb.isBossOrb));
          playHit();
          
          if (gameMode === "arcade") {
            incrementOrbsDestroyed();
          }
          
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [ox, oy, oz],
            timer: 0.4,
            maxTimer: 0.4,
            seed: Math.random(),
          });
          
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          
          if (isOverchargedDirectContact(proj)) {
            // Overcharged pierces enemies and continues toward its timed AOE.
            let overchargedHits = projectileOrbHits.current.get(proj.id);
            if (!overchargedHits) {
              overchargedHits = new Set();
              projectileOrbHits.current.set(proj.id, overchargedHits);
            }
            overchargedHits.add(orb.id);
          } else if (proj.piercing && motion.hitCount && motion.hitCount > 1) {
            motion.hitCount--;
            let _ph2 = projectileOrbHits.current.get(proj.id);
            if (!_ph2) { _ph2 = new Set(); projectileOrbHits.current.set(proj.id, _ph2); }
            _ph2.add(orb.id);
          } else {
            projectileOrbHits.current.delete(proj.id);
            hitSomething = true;
            break;
          }
        }
      }
      }  // end if (!hitSomething && proj.type !== "spiral")
      
      // Overcharged power-ups are handled only by the outward AOE.
      if (proj.type !== "overcharged") for (const powerUp of powerUps) {
        if (hitPowerUpsThisFrame.current.has(powerUp.id) || powerUp.collected || powerUp.destroying || powerUp.hurtTimer) continue;
        const powerUpSegment = gameRuntime.powerUps.collisionSegmentFor(powerUp, delta);
        const [powerUpX, powerUpY, powerUpZ] = powerUpSegment.end;
        const hitPowerUps = projectilePowerUpHits.current.get(proj.id);
        if (hitPowerUps?.has(powerUp.id)) continue;
        
        if (
            sweptSphereHit(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              px, py, pz,
              powerUpSegment.start[0], powerUpSegment.start[1], powerUpSegment.start[2],
              powerUpX, powerUpY, powerUpZ,
              getPlayerProjectileBodyRadius(
                proj,
                1,
                playerScale,
              ) + POWER_UP_BODY_RADIUS,
            ) !== null
        ) {
          hitPowerUpsThisFrame.current.add(powerUp.id);
          const projectileHits = hitPowerUps ?? new Set<string>();
          projectileHits.add(powerUp.id);
          projectilePowerUpHits.current.set(proj.id, projectileHits);
          hurtPowerUp(powerUp.id);
          if (proj.volleyId) volleyHits.current.add(proj.volleyId);
          if (powerUp.type === "rapidFire") playRapidFirePowerUp();
          else if (powerUp.type === "chargeBeam") playChargeBeamPowerUp();
          else playSuccess();
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [powerUpX, powerUpY, powerUpZ],
            timer: 0.4,
            maxTimer: 0.4,
            seed: Math.random(),
          });
          break;
        }
      }
      
      if (!hitSomething) {
        motion.position[0] = px;
        motion.position[1] = py;
        motion.position[2] = pz;
        motion.direction[0] = dx;
        motion.direction[1] = dy;
        motion.direction[2] = dz;
        motion.spiralAngle = newSpiralAngle;
        motion.spawnScale = newSpawnScale;
        motion.spawnScaleTimer = newSpawnScaleTimer;
        motion.travelTimer = newTravelTimer;
      } else {
        projectileOrbHits.current.delete(proj.id);
        removedIds.add(proj.id);
        structuralChanged = true;
      }
    }
    
    // Iterate the Map directly — avoids Array.from() allocation; safe to delete
    // the current key during Map iteration per the ECMAScript spec.
    for (const projId of projectileOrbHits.current.keys()) {
      if (removedIds.has(projId)) projectileOrbHits.current.delete(projId);
    }
    for (const projId of projectilePowerUpHits.current.keys()) {
      if (removedIds.has(projId) || !activeIds.has(projId)) projectilePowerUpHits.current.delete(projId);
    }
    for (const hitKey of spiralBossHit.current) {
      if (activeIds.has(hitKey)) continue;
      const subSphereSuffix = hitKey.lastIndexOf("-b");
      const ownerId = subSphereSuffix > 0 ? hitKey.slice(0, subSphereSuffix) : hitKey;
      if (!activeIds.has(ownerId) || removedIds.has(ownerId)) spiralBossHit.current.delete(hitKey);
    }
    for (const projId of knownOcIds.current) {
      if (!activeIds.has(projId)) knownOcIds.current.delete(projId);
    }
    for (const projId of knownHomingIds.current) {
      if (!activeIds.has(projId)) knownHomingIds.current.delete(projId);
    }
    for (const volleyId of knownScatterVolleys.current) {
      if (!frameVolleyCounts.has(volleyId)) knownScatterVolleys.current.delete(volleyId);
    }
    
    if (structuralChanged) {
      for (const id of removedIds) releaseProjectileMotion(id);
      updateProjectiles(projectiles.filter(proj => !removedIds.has(proj.id)));
      runtimeDiagnostics.noteStoreWrite();
    }
    if (collisionsEnabled) runtimeDiagnostics.endCollision();
    runtimeDiagnostics.endSimulation();
  });
  
  runtimeDiagnostics.noteProjectileRender();
  return (
    <>
       <PlayerProjectileFireBursts pool={playerFireBurstPool.current} />
       <RapidProjectileTrailBatch
         projectiles={batchedProjectiles}
         trailColor={defaultTrailPalette.base}
       />
       <Suspense fallback={null}>
         <BatchedPlayerProjectileModels
           projectiles={batchedProjectiles}
           equippedSkin={equippedSkin}
           skinColors={skinColors}
           playerScale={playerScale}
         />
         {equippedSkin === "star" && (
           <StarPlayerProjectileCores
             projectiles={batchedProjectiles}
             playerScale={playerScale}
           />
         )}
         {projectiles.map((proj) => (
           <ProjectileEffectsGate key={proj.id} projectile={proj}>
              <>
                {proj.type === "overcharged" ? (
                  <OverchargedProjectileMesh
                    projectile={proj}
                    spawnScale={proj.spawnScale ?? 1}
                    trailPalette={defaultTrailPalette}
                  />
                ) : proj.type === "spiral" ? (
                  <SpiralBundleMesh
                    projectile={proj}
                    trailPalette={defaultTrailPalette}
                  />
                ) : proj.type === "homing" ? (
                  <HomingProjectileMesh
                    projectile={proj}
                    trailPalette={defaultTrailPalette}
                  />
                ) : proj.type === "scattershot" ? (
                  <ScattershotProjectileMesh
                    projectile={proj}
                    trailPalette={defaultTrailPalette}
                  />
                ) : proj.type === "subblaster" ? (
                  <SubblasterProjectileMesh
                    projectile={proj}
                    trailPalette={defaultTrailPalette}
                  />
                ) : proj.type === "rapidblaster" ? (
                  <RapidBlasterProjectileMesh projectile={proj} />
                )
                : shouldRenderParticleSwarmOverlay(proj, equippedTrail) ? (
                  <ParticleSwarmProjectileOverlay
                    projectile={proj}
                    skinColors={skinColors}
                  />
                ) : null}
                {equippedTrail === "flame_aura" && isPlayerProjectile(proj) && (
                  <FlameAuraProjectileTrail
                    projectile={proj}
                    playerScale={playerScale}
                  />
                )}
              </>
           </ProjectileEffectsGate>
         ))}
       </Suspense>
      {shockwaves.map(sw => (
        <OcShockwaveRing key={sw.id} position={sw.pos} />
      ))}
      <OverchargedExplosionVFX pool={overchargedExplosionPool.current} />
      {scatterArcs.map(arc => (
        <ScatterMuzzleArc key={arc.id} position={arc.pos} dirX={arc.dirX} dirY={arc.dirY} />
      ))}
      {homingLockRings.map(ring => (
        <HomingLockRing key={ring.id} position={ring.pos} dirX={ring.dirX} dirY={ring.dirY} />
      ))}
      {impactEffects.map((effect) => (
        <ImpactEffectMesh key={effect.id} effect={effect} time={clockRef.current} skinColors={skinColors} />
      ))}
    </>
  );
}

function createExplosionParticles(position: [number, number, number], customColors?: string[]): Particle[] {
  const particles: Particle[] = [];
  const colors = customColors || ["#ff00ff", "#00ffff", "#ffff00", "#ff6600", "#ffffff", "#ff3388"];
  
  for (let i = 0; i < 20; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 2.5 + Math.random() * 4;
    
    particles.push({
      id: `exp-${Date.now()}-${i}`,
      position: [...position],
      velocity: [
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ],
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
    });
  }
  
  return particles;
}

function createPowerUpParticles(position: [number, number, number], colors: string[]): Particle[] {
  const particles: Particle[] = [];
  
  for (let i = 0; i < 25; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 3.5 + Math.random() * 4.5;
    
    particles.push({
      id: `pup-${Date.now()}-${i}`,
      position: [...position],
      velocity: [
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ],
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.6 + Math.random() * 0.35,
      maxLife: 0.95,
    });
  }
  
  return particles;
}
