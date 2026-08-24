import { useRef, useMemo, memo, Suspense, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb, DarkOrb, Projectile, Particle, ImpactEffect } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop, TrailEffect } from "@/lib/stores/useShop";
import { getSkinColors, PlayerGlow } from "./PlayerOrb";
import { PlayerModel } from "./PlayerModel";
import { PlayerParticles } from "./PlayerParticles";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";
import {
  getProjectileMotion,
  projectilePhysicsMap,
  releaseProjectileMotion,
  resetProjectileMotion,
} from "./ProjectilePhysics";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { MAX_RUNTIME_PROJECTILES } from "@/game-runtime/ProjectileRuntime";
import { usePerformanceFeature } from "@/game-runtime/PerformanceToggles";

/** Projectile collision always reads live enemy transforms, never store snapshots. */
function liveOrbPosition(orb: DarkOrb): [number, number, number] {
  return gameRuntime.enemies.get(orb.id)?.position ?? orb.position;
}

/**
 * Finds where a moving point enters a moving sphere during one render frame.
 * Using relative motion makes collision robust to low FPS and fast projectiles.
 */
function sweptSphereHit(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  sphereStartX: number,
  sphereStartY: number,
  sphereStartZ: number,
  sphereEndX: number,
  sphereEndY: number,
  sphereEndZ: number,
  radius: number,
): number | null {
  const relStartX = startX - sphereStartX;
  const relStartY = startY - sphereStartY;
  const relStartZ = startZ - sphereStartZ;
  const relDeltaX = (endX - startX) - (sphereEndX - sphereStartX);
  const relDeltaY = (endY - startY) - (sphereEndY - sphereStartY);
  const relDeltaZ = (endZ - startZ) - (sphereEndZ - sphereStartZ);
  const radiusSquared = radius * radius;
  const c = relStartX * relStartX + relStartY * relStartY + relStartZ * relStartZ - radiusSquared;
  if (c <= 0) return 0;

  const a = relDeltaX * relDeltaX + relDeltaY * relDeltaY + relDeltaZ * relDeltaZ;
  if (a < 1e-8) return null;
  const b = 2 * (relStartX * relDeltaX + relStartY * relDeltaY + relStartZ * relDeltaZ);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const hitT = (-b - Math.sqrt(discriminant)) / (2 * a);
  return hitT >= 0 && hitT <= 1 ? hitT : null;
}

const ENEMY_GRID_CELL_SIZE = 4;
const ENEMY_GRID_KEY_OFFSET = 128;
const ENEMY_GRID_KEY_STRIDE = 512;
const compareEnemyIndices = (a: number, b: number) => a - b;

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
    const direction = getProjectileMotion(projectile).direction;
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

// ─── Projectile charge aura — electric sparks only ───────────────────────────
// Rendered inside the projectile group so positions are already world-correct.

// Electric spark instanced mesh for the projectile aura
const PAURA_SPARK_COUNT = 24;
// ── Charged projectile corona — tiny yellow orbiting particles ────────────────
// Palette matches the player's golden charge-beam aura: yellow → amber → white.
const _PCA_WISP_N  = 7;
const _pcaDummy    = new THREE.Object3D();
const _pcaColor    = new THREE.Color();
const _pcaPalette  = [
  new THREE.Color("#ffdd00"), // bright yellow
  new THREE.Color("#ffaa00"), // amber-gold
  new THREE.Color("#ffffff"), // white flash
];
const _pcaWispGeo  = new THREE.SphereGeometry(1, 4, 3);

interface _PCAWisp { phase: number; speed: number; axisX: number; axisY: number; size: number; colorT: number }

function ProjectileChargeAura({ projScale }: { projScale: number }) {
  const wispRef = useRef<THREE.InstancedMesh>(null);

  const wisps = useMemo<_PCAWisp[]>(() =>
    Array.from({ length: _PCA_WISP_N }, (_, i) => ({
      phase:  (i / _PCA_WISP_N) * Math.PI * 2,
      speed:  (5.5 + i * 0.9) * (i % 2 === 0 ? 1 : -1),
      axisX:  (i / _PCA_WISP_N) * Math.PI,
      axisY:  (i / _PCA_WISP_N) * Math.PI * 2,
      size:   0.016 + i * 0.003,
      colorT: i / _PCA_WISP_N,
    }))
  , []);

  const [wispMat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  useEffect(() => () => { wispMat.dispose(); }, [wispMat]);

  useFrame(({ clock }) => {
    if (!wispRef.current) return;
    const t  = clock.getElapsedTime();
    const r  = projScale * 2.2;
    const im = wispRef.current;

    for (let i = 0; i < _PCA_WISP_N; i++) {
      const w     = wisps[i];
      const theta = t * w.speed + w.phase;
      const cx    = Math.cos(w.axisX), sx = Math.sin(w.axisX);
      const cy    = Math.cos(w.axisY), sy = Math.sin(w.axisY);
      const cosT  = Math.cos(theta),   sinT = Math.sin(theta);
      _pcaDummy.position.set(
        r * (cosT * cy - sinT * sx * sy),
        r * (cosT * sy + sinT * sx * cy),
        r * (sinT * cx),
      );
      _pcaDummy.scale.setScalar(w.size * projScale * (0.55 + 0.45 * Math.sin(t * 11 + i)));
      _pcaDummy.updateMatrix();
      im.setMatrixAt(i, _pcaDummy.matrix);
      const ct = ((w.colorT + t * 0.15) % 1.0 + 1.0) % 1.0;
      if (ct < 0.5) _pcaColor.lerpColors(_pcaPalette[0], _pcaPalette[1], ct * 2);
      else           _pcaColor.lerpColors(_pcaPalette[1], _pcaPalette[2], (ct - 0.5) * 2);
      im.setColorAt(i, _pcaColor);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={wispRef} args={[_pcaWispGeo, wispMat, _PCA_WISP_N]} frustumCulled={false} />
  );
}

// SpiralBraidMesh removed — replaced by the full OrbitalSpiralBlaster SpiralBundleMesh below

const MAX_BATCHED_PROJECTILES = MAX_RUNTIME_PROJECTILES;
const _batchedProjectileCoreGeometry = new THREE.SphereGeometry(1, 10, 7);
const _batchedProjectileGlowGeometry = new THREE.SphereGeometry(1, 8, 6);
const _batchedRapidTrailGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
const _batchedProjectileDummy = new THREE.Object3D();
const _batchedProjectileCoreColor = new THREE.Color();
const _batchedProjectileGlowColor = new THREE.Color();
const _batchedProjectileAxis = new THREE.Vector3(0, 1, 0);
const _batchedProjectileDirection = new THREE.Vector3();
const _batchedModelTransform = new THREE.Matrix4();
const _batchedModelInstanceMatrix = new THREE.Matrix4();
const _batchedModelRotation = new THREE.Quaternion();
const _batchedModelEuler = new THREE.Euler();
const _batchedModelScale = new THREE.Vector3(1, 1, 1);
const _batchedModelPosition = new THREE.Vector3();

type BatchedModelPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
};

/**
 * Preserves the textured mini-orb used by standard shots, but turns each GLTF
 * mesh part into one instanced draw instead of cloning a whole GLTF scene and
 * its materials for every active projectile.
 */
function BatchedNormalProjectileModels({ projectiles }: { projectiles: readonly Projectile[] }) {
  const { scene } = useGLTF("/models/player_orb_texture.glb");
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const activeSlotsRef = useRef<Set<number>>(new Set());
  const seenSlotsRef = useRef<Set<number>>(new Set());
  const modelParts = useMemo<BatchedModelPart[]>(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const normalization = Math.max(size.x, size.y, size.z) > 0
      ? 0.288 / Math.max(size.x, size.y, size.z)
      : 1;
    const normalizationMatrix = new THREE.Matrix4()
      .makeTranslation(-center.x * normalization, -center.y * normalization, -center.z * normalization)
      .multiply(new THREE.Matrix4().makeScale(normalization, normalization, normalization));
    const parts: BatchedModelPart[] = [];
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      parts.push({
        geometry: mesh.geometry,
        material: mesh.material,
        localMatrix: normalizationMatrix.clone().multiply(mesh.matrixWorld),
      });
    });
    return parts;
  }, [scene]);

  useFrame(({ clock }) => {
    const seenSlots = seenSlotsRef.current;
    seenSlots.clear();
    let highestSlot = -1;
    _batchedModelRotation.setFromEuler(_batchedModelEuler.set(
      clock.getElapsedTime() * 1.6,
      clock.getElapsedTime() * 2.4,
      0,
    ));

    for (const projectile of projectiles) {
      if (projectile.type !== "normal" && projectile.type) continue;
      const motion = projectilePhysicsMap.get(projectile.id);
      if (!motion || motion.slot >= MAX_BATCHED_PROJECTILES) continue;
      const slot = motion.slot;
      seenSlots.add(slot);
      highestSlot = Math.max(highestSlot, slot);
      _batchedModelPosition.set(motion.position[0], motion.position[1], motion.position[2]);
      _batchedModelScale.setScalar(projectile.isCharged ? 1.5 : 1);
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

    for (const mesh of meshRefs.current) {
      if (!mesh) continue;
      mesh.count = highestSlot + 1;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {modelParts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => { meshRefs.current[index] = mesh; }}
          args={[part.geometry, part.material, MAX_BATCHED_PROJECTILES]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/**
 * Shared rendering path for normal and rapid-blaster shots. Their transforms
 * already live in gameRuntime, so keeping every active shot in a single
 * instanced layer avoids cloning a textured player model, material set, and
 * frame callback for each trigger pull.
 */
function ProjectileVisualBatch({
  projectiles,
  skinColors,
}: {
  projectiles: readonly Projectile[];
  skinColors: { core: string; glow: string; emissive: string };
}) {
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const rapidTrailRef = useRef<THREE.InstancedMesh>(null);
  const activeSlotsRef = useRef<Set<number>>(new Set());
  const seenSlotsRef = useRef<Set<number>>(new Set());
  const [coreMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  }));
  const [glowMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  }));
  const [rapidTrailMaterial] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  }));

  useEffect(() => () => {
    coreMaterial.dispose();
    glowMaterial.dispose();
    rapidTrailMaterial.dispose();
  }, [coreMaterial, glowMaterial, rapidTrailMaterial]);

  useFrame(() => {
    const coreMesh = coreRef.current;
    const glowMesh = glowRef.current;
    const rapidTrailMesh = rapidTrailRef.current;
    if (!coreMesh || !glowMesh || !rapidTrailMesh) return;

    runtimeDiagnostics.beginProjectileVisuals();
    const seenSlots = seenSlotsRef.current;
    seenSlots.clear();
    let highestSlot = -1;
    let instances = 0;

    for (const projectile of projectiles) {
      const motion = projectilePhysicsMap.get(projectile.id);
      if (!motion || motion.slot >= MAX_BATCHED_PROJECTILES) continue;

      const slot = motion.slot;
      seenSlots.add(slot);
      highestSlot = Math.max(highestSlot, slot);
      instances++;

      const isRapid = projectile.type === "rapidblaster";
      const scale = isRapid
        ? (projectile.isCharged ? 0.165 : 0.11)
        : (projectile.isCharged ? 0.216 : 0.144);

      _batchedProjectileDummy.position.set(...motion.position);
      _batchedProjectileDummy.quaternion.identity();
      // Keep a lightweight emissive core visible for normal shots while their
      // textured instanced mini-orb is loading or unavailable on a renderer.
      // This also makes the projectile readable against dense level effects.
      _batchedProjectileDummy.scale.setScalar(scale);
      _batchedProjectileDummy.updateMatrix();
      coreMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      _batchedProjectileCoreColor.set(isRapid ? "#ffffff" : skinColors.core);
      coreMesh.setColorAt(slot, _batchedProjectileCoreColor);

      _batchedProjectileDummy.scale.setScalar(scale * (isRapid ? 2.0 : 1.85));
      _batchedProjectileDummy.updateMatrix();
      glowMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      _batchedProjectileGlowColor.set(skinColors.glow);
      if (projectile.isCharged) _batchedProjectileGlowColor.multiplyScalar(1.35);
      glowMesh.setColorAt(slot, _batchedProjectileGlowColor);

      if (isRapid) {
        const [dx, dy, dz] = motion.direction;
        _batchedProjectileDirection.set(dx, dy, dz).normalize();
        _batchedProjectileDummy.position.set(
          motion.position[0] - dx * 0.55,
          motion.position[1] - dy * 0.55,
          motion.position[2] - dz * 0.55,
        );
        _batchedProjectileDummy.quaternion.setFromUnitVectors(_batchedProjectileAxis, _batchedProjectileDirection);
        _batchedProjectileDummy.scale.set(0.038, 1.1, 0.038);
        _batchedProjectileDummy.updateMatrix();
        rapidTrailMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
        rapidTrailMesh.setColorAt(slot, _batchedProjectileGlowColor);
      } else {
        _batchedProjectileDummy.scale.setScalar(0);
        _batchedProjectileDummy.updateMatrix();
        rapidTrailMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      }
    }

    const activeSlots = activeSlotsRef.current;
    for (const slot of activeSlots) {
      if (seenSlots.has(slot)) continue;
      _batchedProjectileDummy.position.set(0, 0, 0);
      _batchedProjectileDummy.quaternion.identity();
      _batchedProjectileDummy.scale.setScalar(0);
      _batchedProjectileDummy.updateMatrix();
      coreMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      glowMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      rapidTrailMesh.setMatrixAt(slot, _batchedProjectileDummy.matrix);
      activeSlots.delete(slot);
    }
    for (const slot of seenSlots) activeSlots.add(slot);

    const meshCount = highestSlot + 1;
    coreMesh.count = meshCount;
    glowMesh.count = meshCount;
    rapidTrailMesh.count = meshCount;
    coreMesh.instanceMatrix.needsUpdate = true;
    glowMesh.instanceMatrix.needsUpdate = true;
    rapidTrailMesh.instanceMatrix.needsUpdate = true;
    if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
    if (rapidTrailMesh.instanceColor) rapidTrailMesh.instanceColor.needsUpdate = true;
    runtimeDiagnostics.endProjectileVisuals(instances);
  });

  return (
    <>
      <instancedMesh
        ref={coreRef}
        args={[_batchedProjectileCoreGeometry, coreMaterial, MAX_BATCHED_PROJECTILES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={glowRef}
        args={[_batchedProjectileGlowGeometry, glowMaterial, MAX_BATCHED_PROJECTILES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={rapidTrailRef}
        args={[_batchedRapidTrailGeometry, rapidTrailMaterial, MAX_BATCHED_PROJECTILES]}
        frustumCulled={false}
      />
    </>
  );
}

function ProjectileMesh({ projectile, trailType, skinColor, skinColors }: {
  projectile: Projectile;
  trailType: TrailEffect;
  skinColor: string;
  skinColors: { core: string; glow: string; emissive: string; accent: string; particles: string[] };
  equippedSkin: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isCharged     = projectile.isCharged;
  const isRainbow     = (skinColors as any).isRainbow === true;

  // 1/5th of the player orb base scale (now 0.72)
  const projScale  = isCharged ? 0.216 : 0.144;
  const groupScale = 1;

  const initialMotion = getProjectileMotion(projectile);

  useFrame(() => {
    const motion = getProjectileMotion(projectile);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef} position={initialMotion.position}>
      {/* Charged shots retain their stronger light; standard-shot lighting is
          provided by their emissive model and batched cosmetic trail. */}
      {isCharged && (
        <pointLight color={skinColors.glow} intensity={12} distance={6} decay={2} />
      )}

      {/* Charge beam aura — mini orbiting swarm + lightning, outside the scale group
          so it stays at full size regardless of spawn-in progress */}
      {isCharged && <ProjectileChargeAura projScale={projScale * groupScale} />}

      {/* Mini player orb at 1/5th scale — FBX model + glow + particles, all skin-matched */}
      <group scale={groupScale}>
        <Suspense fallback={null}>
          <PlayerModel
            scale={projScale}
            rotationSpeedX={1.6}
            rotationSpeedY={2.4}
          />
        </Suspense>
        <PlayerGlow
          scale={projScale}
          coreColor={skinColors.core}
          glowColor={skinColors.glow}
          isRainbow={isRainbow}
        />
        {/* Particle Swarm — unlockable trail cosmetic: orbiting 3D particles */}
        {trailType === "particle_swarm" && (
          <PlayerParticles
            scale={projScale}
            particleColors={[skinColors.core]}
            isRainbow={isRainbow}
          />
        )}

      </group>
    </group>
  );
}

// ── EaseOutQuad for projectile spawn grow-in ──────────────────────────────────
function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }

// ── Overcharged Blaster timed-explosion constants ─────────────────────────────
const OC_TRAVEL_TIME   = 1.5;   // seconds before detonation
const OC_EXPLODE_RADIUS = 4.8;  // AOE radius in world units

// ── Orbital Spiral Blaster constants ─────────────────────────────────────────
const SPIRAL_ORBIT_R     = 0.91;
const SPIRAL_ORBIT_SPEED = 7.0;
const SPIRAL_SUB_SCALE   = 0.324; // 0.75 × 0.72 × 0.60
const SPIRAL_TRAIL_N     = 14;
const SPIRAL_TRAIL_HW    = 0.062;
const SPIRAL_COLORS_HEX  = ["#00ffff", "#ff00ff", "#ffdd00"] as const;
const SPIRAL_GLOW_HEX    = ["#004488", "#440044", "#443300"] as const;
const _SPIRAL_TRAIL_C    = SPIRAL_COLORS_HEX.map(h => new THREE.Color(h));

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

// ── AAA Blue Plasma Explosion — multi-layer instanced effect ─────────────────
const OC_PLASMA_N = 30;
const OC_SPARK_N  = 65;
const OC_SMOKE_N  = 14;

const _ocCoreGeo   = new THREE.SphereGeometry(1, 10, 6);
const _ocPlasmaGeo = new THREE.SphereGeometry(1, 5, 4);
const _ocSparkGeo  = new THREE.SphereGeometry(1, 4, 3);
const _ocSmokeGeo  = new THREE.PlaneGeometry(1, 1);
const _ocRing1Geo  = new THREE.TorusGeometry(1, 0.10, 6, 64);
const _ocRing2Geo  = new THREE.TorusGeometry(1, 0.055, 5, 48);

// Reusable scratch objects (single-threaded, safe)
const _ocM4  = new THREE.Matrix4();
const _ocV3  = new THREE.Vector3();
const _ocSc3 = new THREE.Vector3();
const _ocQ0  = new THREE.Quaternion();  // identity
const _ocCol = new THREE.Color();

// Plasma color ramp: white-cyan → electric blue → cobalt → deep purple → fade-to-dark
function _plasmaRamp(t: number, out: THREE.Color) {
  if      (t < 0.20) out.setHSL(0.54, 1.0, 0.95 - t * 0.50);
  else if (t < 0.50) out.setHSL(0.60, 1.0, 0.75 - (t - 0.20) * 1.00);
  else if (t < 0.78) out.setHSL(0.65, 1.0, 0.45 - (t - 0.50) * 0.80);
  else               out.setHSL(0.72, 0.90, 0.12 - (t - 0.78) * 0.55);
  // additive blending: darken = transparent, encode fade in luminance
  out.multiplyScalar(Math.max(1 - t * t, 0));
}

type _OcPart = {
  vx: number; vy: number; vz: number;
  size: number;
  pFreq: number; pAmp: number; pPhase: number;
  maxLife: number; life: number;
};
type _OcSmoke = _OcPart & { delay: number };

function OcPlasmaExplosion({ position }: { position: [number, number, number] }) {
  const coreRef   = useRef<THREE.Mesh>(null);
  const ring1Ref  = useRef<THREE.Mesh>(null);
  const ring2Ref  = useRef<THREE.Mesh>(null);
  const lightRef  = useRef<THREE.PointLight>(null);
  const plasmaRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef  = useRef<THREE.InstancedMesh>(null);
  const smokeRef  = useRef<THREE.InstancedMesh>(null);
  const elapsed   = useRef(0);

  const plasma = useRef<_OcPart[]>([]);
  const sparks  = useRef<_OcPart[]>([]);
  const smoke   = useRef<_OcSmoke[]>([]);

  // Per-instance materials (created once on mount, disposed on unmount)
  const [plasmaMat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const [sparkMat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const [smokeMat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));

  // Initialize particle banks once
  useMemo(() => {
    plasma.current = Array.from({ length: OC_PLASMA_N }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 2.0 + Math.random() * 6.0;
      return {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: (Math.random() - 0.5) * 1.2,
        size: 0.10 + Math.random() * 0.30,
        pFreq: 5 + Math.random() * 7, pAmp: 0.04 + Math.random() * 0.10,
        pPhase: Math.random() * Math.PI * 2,
        maxLife: 0.28 + Math.random() * 0.35, life: 0,
      };
    });
    sparks.current = Array.from({ length: OC_SPARK_N }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 5.0 + Math.random() * 12.0;
      return {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: (Math.random() - 0.5) * 2.5,
        size: 0.014 + Math.random() * 0.044,
        pFreq: 0, pAmp: 0, pPhase: 0,
        maxLife: 0.14 + Math.random() * 0.56, life: 0,
      };
    });
    smoke.current = Array.from({ length: OC_SMOKE_N }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 0.3 + Math.random() * 1.5;
      return {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0,
        size: 0.6 + Math.random() * 1.5,
        pFreq: 0, pAmp: 0, pPhase: 0,
        maxLife: 1.2 + Math.random() * 0.8, life: 0,
        delay: 0.22 + Math.random() * 0.35,
      };
    });
  }, []);

  useEffect(() => () => {
    plasmaMat.dispose(); sparkMat.dispose(); smokeMat.dispose();
  }, [plasmaMat, sparkMat, smokeMat]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const T = elapsed.current;

    // ── 1. Core flash sphere (0–0.13 s) ──────────────────────────────────────
    if (coreRef.current) {
      const tc = Math.min(T / 0.13, 1);
      coreRef.current.scale.setScalar(easeOutQuad(tc) * OC_EXPLODE_RADIUS * 0.28);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - tc) * 0.98;
    }

    // ── 2. Shockwave rings ────────────────────────────────────────────────────
    if (ring1Ref.current) {
      const tr = Math.min(T / 0.55, 1);
      ring1Ref.current.scale.setScalar(easeOutQuad(tr) * OC_EXPLODE_RADIUS * 1.08);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - tr) * 0.88;
    }
    if (ring2Ref.current) {
      const tr2 = Math.min(Math.max(T - 0.04, 0) / 0.50, 1);
      ring2Ref.current.scale.setScalar(easeOutQuad(tr2) * OC_EXPLODE_RADIUS * 0.65);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - tr2) * 0.55;
    }

    // ── 3. Point light: fast spike → slow decay ───────────────────────────────
    if (lightRef.current) {
      const li = T < 0.04
        ? (T / 0.04) * 82
        : 82 * Math.pow(Math.max(1 - (T - 0.04) / 0.38, 0), 2);
      lightRef.current.intensity = li;
    }

    // ── 4. Plasma blobs ───────────────────────────────────────────────────────
    if (plasmaRef.current) {
      const im = plasmaRef.current;
      for (let i = 0; i < OC_PLASMA_N; i++) {
        const p = plasma.current[i];
        p.life += delta;
        const t = p.life / p.maxLife;
        if (t >= 1) { _ocM4.makeScale(0, 0, 0); im.setMatrixAt(i, _ocM4); continue; }
        // noise-driven turbulence
        const tx = p.pAmp * Math.sin(p.pFreq * T + p.pPhase);
        const ty = p.pAmp * Math.cos(p.pFreq * T + p.pPhase + 1.3);
        _ocV3.set(p.vx * p.life + tx, p.vy * p.life + ty, p.vz * p.life);
        const sz = Math.max(p.size * (1 + easeOutQuad(t) * 1.5) * (1 - t * t), 0.0001);
        _ocSc3.setScalar(sz);
        _ocM4.compose(_ocV3, _ocQ0, _ocSc3);
        im.setMatrixAt(i, _ocM4);
        _plasmaRamp(t, _ocCol);
        im.setColorAt(i, _ocCol);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // ── 5. High-velocity spark/ember burst with gravity ───────────────────────
    if (sparkRef.current) {
      const im = sparkRef.current;
      for (let i = 0; i < OC_SPARK_N; i++) {
        const p = sparks.current[i];
        p.life += delta;
        const t = p.life / p.maxLife;
        if (t >= 1) { _ocM4.makeScale(0, 0, 0); im.setMatrixAt(i, _ocM4); continue; }
        const grav = 3.0 * p.life * p.life;  // arcs downward
        _ocV3.set(p.vx * p.life, p.vy * p.life - grav, p.vz * p.life);
        const sz = Math.max(p.size * (1 - t * t), 0.0001);
        _ocSc3.setScalar(sz);
        _ocM4.compose(_ocV3, _ocQ0, _ocSc3);
        im.setMatrixAt(i, _ocM4);
        // cyan → blue → deep blue, brightness encodes fade
        const hue = 0.54 + Math.min(t, 1) * 0.12;
        const lum = Math.max((0.82 - t * 0.68) * (1 - t * t), 0);
        _ocCol.setHSL(hue, 1.0, lum);
        im.setColorAt(i, _ocCol);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // ── 6. Ionized smoke cloud (dark violet / charcoal, delayed) ─────────────
    if (smokeRef.current) {
      const im = smokeRef.current;
      for (let i = 0; i < OC_SMOKE_N; i++) {
        const p = smoke.current[i];
        const age = T - p.delay;
        if (age <= 0) { _ocM4.makeScale(0, 0, 0); im.setMatrixAt(i, _ocM4); continue; }
        const t = Math.min(age / p.maxLife, 1);
        _ocV3.set(p.vx * age, p.vy * age, 0.02);
        const sz = Math.max(p.size * easeOutQuad(Math.min(t * 3, 1)) * (0.5 + t * 0.5), 0.0001);
        _ocSc3.setScalar(sz);
        _ocM4.compose(_ocV3, _ocQ0, _ocSc3);
        im.setMatrixAt(i, _ocM4);
        // dark violet / deep blue; fade out via additive darkening
        const hSmoke = i % 2 === 0 ? 0.73 : 0.61;
        const lum = Math.max((1 - t) * 0.22, 0);
        _ocCol.setHSL(hSmoke, 0.65, lum);
        im.setColorAt(i, _ocCol);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {/* Searing point light — spikes to 82 intensity, decays over 0.4 s */}
      <pointLight ref={lightRef} color="#aaf0ff" intensity={0} distance={20} decay={2} />

      {/* Core flash sphere — white, expands and fades in 0.13 s */}
      <mesh ref={coreRef} geometry={_ocCoreGeo} scale={0}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Shockwave rings */}
      <mesh ref={ring1Ref} geometry={_ocRing1Geo} scale={0}>
        <meshBasicMaterial color="#55ddff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2Ref} geometry={_ocRing2Geo} scale={0}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Plasma blobs — 30 instanced, turbulent burst */}
      <instancedMesh ref={plasmaRef} args={[_ocPlasmaGeo, plasmaMat, OC_PLASMA_N]} frustumCulled={false} />

      {/* Electric sparks — 65 instanced, high-velocity arc downward */}
      <instancedMesh ref={sparkRef} args={[_ocSparkGeo, sparkMat, OC_SPARK_N]} frustumCulled={false} />

      {/* Ionized smoke — 14 instanced, delayed dark violet cloud */}
      <instancedMesh ref={smokeRef} args={[_ocSmokeGeo, smokeMat, OC_SMOKE_N]} frustumCulled={false} />
    </group>
  );
}

// ── Sub Blaster defense bolt — needle trail + muzzle pop ─────────────────────
const _SB_TRAIL_N  = 8;
const _SB_TRAIL_HW = 0.022;  // very narrow needle
const _SB_HEAD_C   = new THREE.Color("#ccffff");
const _SB_TAIL_C   = new THREE.Color("#0088cc");

const _sbCoreGeo = new THREE.SphereGeometry(1, 6, 4);
const _sbCoreMat = new THREE.MeshBasicMaterial({
  color: "#ffffff", transparent: true, opacity: 0.95,
  depthWrite: false, blending: THREE.AdditiveBlending,
});

function SubblasterProjectileMesh({ projectile }: { projectile: Projectile }) {
  const groupRef = useRef<THREE.Group>(null);
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
    const motion = getProjectileMotion(proj);
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
      const tc    = t < 0.5 ? _SB_HEAD_C.clone().lerp(_SB_TAIL_C, t * 2) : _SB_TAIL_C;
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
    const motion = getProjectileMotion(projectile);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef} position={projectile.position}>
      <pointLight color="#22ddff" intensity={8} distance={2.5} decay={2} />
      <mesh geometry={ribbonGeo} material={ribbonMat} />
      <mesh geometry={_sbCoreGeo} material={_sbCoreMat} scale={0.075} />
      <mesh scale={0.18}>
        <sphereGeometry args={[1, 5, 3]} />
        <meshBasicMaterial color="#44eeff" transparent opacity={0.28}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ── Rapid Blaster projectile mesh — narrow ribbon trail + muzzle flash ────────
const _RB_TRAIL_N  = 12;
const _RB_TRAIL_HW = 0.045; // narrow ribbon half-width

const _rbCoreGeo = new THREE.SphereGeometry(1, 8, 6);
const _rbCoreMat = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
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
  skinColors,
}: {
  projectile: Projectile;
  skinColors: { core: string; glow: string };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bornRef   = useRef<number | null>(null);
  const flashRef  = useRef<THREE.Mesh>(null);

  // ── Narrow ribbon trail geometry ────────────────────────────────────────────
  const ribbonGeo = useMemo(() => {
    const geo  = new THREE.BufferGeometry();
    const N    = _RB_TRAIL_N;
    const pArr = new Float32Array(N * 2 * 3);
    const cArr = new Float32Array(N * 2 * 4);
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

  const posHistRef = useRef(new Float32Array(_RB_TRAIL_N * 3));
  const histLenRef = useRef(0);
  const projRef    = useRef(projectile);
  projRef.current  = projectile;

  useFrame(({ clock }) => {
    const proj = projRef.current;
    const motion = getProjectileMotion(proj);
    if (groupRef.current) groupRef.current.position.set(...motion.position);
    const [wx, wy, wz] = motion.position;

    // Record born time once on first frame
    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();

    // ── Muzzle flash — bright sphere at projectile head, fades in 0.05 s ──
    if (flashRef.current) {
      const age = clock.getElapsedTime() - bornRef.current!;
      const FLASH_DUR = 0.05;
      const flashAlpha = age < FLASH_DUR ? (1 - age / FLASH_DUR) * 0.85 : 0;
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = flashAlpha;
      flashRef.current.scale.setScalar(0.28 + (1 - flashAlpha) * 0.12);
    }

    // ── Position history (most-recent at index 0) ──────────────────────────
    const N   = _RB_TRAIL_N;
    const len = Math.min(histLenRef.current + 1, N);
    histLenRef.current = len;
    const hist = posHistRef.current;
    for (let i = len - 1; i > 0; i--) {
      hist[i*3] = hist[(i-1)*3]; hist[i*3+1] = hist[(i-1)*3+1]; hist[i*3+2] = hist[(i-1)*3+2];
    }
    hist[0] = wx; hist[1] = wy; hist[2] = wz;
    if (len < 2) return;

    // Perpendicular to fire direction (ribbon width axis)
    const [fdx, fdy] = motion.direction;
    const fl  = Math.sqrt(fdx*fdx + fdy*fdy) || 1;
    const px_ = -fdy / fl, py_ = fdx / fl;

    const pAttr = ribbonGeo.getAttribute("position") as THREE.BufferAttribute;
    const cAttr = ribbonGeo.getAttribute("color")    as THREE.BufferAttribute;
    const pA    = pAttr.array as Float32Array;
    const cA    = cAttr.array as Float32Array;

    // Parse skin accent colour for ribbon tint
    const gc = new THREE.Color(skinColors.glow);

    for (let i = 0; i < len; i++) {
      const t  = i / (len - 1);
      const hw = _RB_TRAIL_HW * (1 - t * 0.85);
      const rx = hist[i*3]   - wx;
      const ry = hist[i*3+1] - wy;
      const rz = hist[i*3+2] - wz;
      const vi = i * 6;
      pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
      pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
      // Fade: head is bright white, tail tapers to skin glow colour
      const alpha = (1 - t) * 0.72;
      const lerpT = t;
      const ci = i * 8;
      cA[ci]   = 1 - lerpT * (1 - gc.r); cA[ci+1] = 1 - lerpT * (1 - gc.g); cA[ci+2] = 1 - lerpT * (1 - gc.b); cA[ci+3] = alpha;
      cA[ci+4] = cA[ci]; cA[ci+5] = cA[ci+1]; cA[ci+6] = cA[ci+2]; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true;
    cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  const isCharged = projectile.isCharged;
  const projScale = isCharged ? 0.165 : 0.11; // 1.5× when charge beam active

  useFrame(() => {
    const motion = getProjectileMotion(projectile);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef} position={projectile.position}>
      {/* Point light — tight, matches skin colour */}
      <pointLight color={skinColors.glow}
        intensity={isCharged ? 12 : 8}
        distance={isCharged ? 4.5 : 3}
        decay={2} />

      {/* Muzzle flash sphere — born-time driven */}
      <mesh ref={flashRef} geometry={_rbFlashGeo} material={_rbFlashMat.clone()} scale={0.28} />

      {/* Narrow trailing ribbon — rendered at world origin, offsets in geometry */}
      <mesh geometry={ribbonGeo} material={ribbonMat} position={[0, 0, 0]} />

      {/* Bright projectile core at 100% scale */}
      <mesh geometry={_rbCoreGeo} material={_rbCoreMat} scale={projScale} />
      {/* Glow halo */}
      <mesh scale={projScale * 2.0}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          color={skinColors.glow}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {isCharged && <ProjectileChargeAura projScale={projScale} />}
    </group>
  );
}

// ── Orbital Homing Blaster — swirling trail + lock-on ring flash ──────────────
const _HM_TRAIL_N  = 20;
const _HM_TRAIL_HW = 0.068;
const _HM_HEAD_C   = new THREE.Color("#44ffee");
const _HM_TAIL_C   = new THREE.Color("#0066ff");

const _hmCoreGeo = new THREE.SphereGeometry(1, 8, 6);
const _hmCoreMat = new THREE.MeshBasicMaterial({
  color: "#aaffff", transparent: true, opacity: 0.95,
  depthWrite: false, blending: THREE.AdditiveBlending,
});

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

function HomingProjectileMesh({ projectile }: { projectile: Projectile }) {
  const groupRef = useRef<THREE.Group>(null);
  const bornRef     = useRef<number | null>(null);
  const flashRef    = useRef<THREE.Mesh>(null);
  const flashMatRef = useRef(new THREE.MeshBasicMaterial({
    color: "#88ffff", transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));

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
    ribbonGeo.dispose(); ribbonMat.dispose(); flashMatRef.current.dispose();
  }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_HM_TRAIL_N * 3));
  const histLenRef = useRef(0);
  const projRef    = useRef(projectile);
  projRef.current  = projectile;

  useFrame(({ clock }) => {
    const proj   = projRef.current;
    const motion = getProjectileMotion(proj);
    if (groupRef.current) groupRef.current.position.set(...motion.position);
    const [wx, wy, wz] = motion.position;
    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();
    const age = clock.getElapsedTime() - bornRef.current;

    // Birth flash (0.08 s)
    if (flashRef.current) {
      const FLASH_DUR = 0.08;
      const op = age < FLASH_DUR ? (1 - age / FLASH_DUR) * 0.88 : 0;
      flashMatRef.current.opacity = op;
      flashRef.current.scale.setScalar(0.34 + (1 - (op / 0.88)) * 0.12);
    }

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
      // Cyan → deep blue gradient from head to tail
      const tc    = t < 0.5 ? _HM_HEAD_C.clone().lerp(_HM_TAIL_C, t * 2) : _HM_TAIL_C;
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
  const projScale = isCharged ? 0.195 : 0.13; // 1.5× when charge beam active

  useFrame(() => {
    const motion = getProjectileMotion(projectile);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef} position={projectile.position}>
      <pointLight color="#22eedd"
        intensity={isCharged ? 12 : 8}
        distance={isCharged ? 6 : 4}
        decay={2} />
      <mesh ref={flashRef} geometry={_hmCoreGeo} material={flashMatRef.current} scale={0.34} />
      <mesh geometry={ribbonGeo} material={ribbonMat} />
      <mesh geometry={_hmCoreGeo} material={_hmCoreMat} scale={projScale} />
      <mesh scale={projScale * 2.4}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.20}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {isCharged && <ProjectileChargeAura projScale={projScale} />}
    </group>
  );
}

// ── Orbital Scattershot — plasma bolt + ribbon trail + muzzle arc ─────────────
const _SC_TRAIL_N  = 14;
const _SC_TRAIL_HW = 0.072; // wider than rapid-blaster
const _SC_CORE_C   = new THREE.Color("#ffcc44");
const _SC_TAIL_C   = new THREE.Color("#ff6600");

const _scCoreGeo = new THREE.SphereGeometry(1, 8, 6);
const _scCoreMat = new THREE.MeshBasicMaterial({
  color: "#ffffff", transparent: true, opacity: 0.95,
  depthWrite: false, blending: THREE.AdditiveBlending,
});
const _scFlashGeo = new THREE.SphereGeometry(1, 8, 6);

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

function ScattershotProjectileMesh({ projectile }: { projectile: Projectile }) {
  const groupRef = useRef<THREE.Group>(null);
  const bornRef    = useRef<number | null>(null);
  const flashRef   = useRef<THREE.Mesh>(null);
  const flashMatRef = useRef(new THREE.MeshBasicMaterial({
    color: "#ffee88", transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));

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
    ribbonGeo.dispose(); ribbonMat.dispose(); flashMatRef.current.dispose();
  }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_SC_TRAIL_N * 3));
  const histLenRef = useRef(0);
  const projRef    = useRef(projectile);
  projRef.current  = projectile;

  useFrame(({ clock }, delta) => {
    const proj   = projRef.current;
    const motion = getProjectileMotion(proj);
    if (groupRef.current) groupRef.current.position.set(...motion.position);
    const [wx, wy, wz] = motion.position;
    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();

    // Muzzle flash (0.07 s)
    if (flashRef.current) {
      const age = clock.getElapsedTime() - bornRef.current;
      const FLASH_DUR = 0.07;
      const op = age < FLASH_DUR ? (1 - age / FLASH_DUR) * 0.90 : 0;
      flashMatRef.current.opacity = op;
      flashRef.current.scale.setScalar(0.32 + (1 - (op / 0.90)) * 0.15);
    }

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
      // Gradient: white at head → orange→red at tail
      const tc    = t < 0.5 ? _SC_CORE_C.clone().lerp(_SC_TAIL_C, t * 2) : _SC_TAIL_C;
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
  const projScale = isCharged ? 0.195 : 0.13; // 1.5× when charge beam active

  useFrame(() => {
    const motion = getProjectileMotion(projectile);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
  });

  return (
    <group ref={groupRef} position={projectile.position}>
      <pointLight color="#ff9900"
        intensity={isCharged ? 12 : 8}
        distance={isCharged ? 6 : 4}
        decay={2} />
      <mesh ref={flashRef} geometry={_scFlashGeo} material={flashMatRef.current} scale={0.32} />
      <mesh geometry={ribbonGeo} material={ribbonMat} />
      <mesh geometry={_scCoreGeo} material={_scCoreMat} scale={projScale} />
      <mesh scale={projScale * 2.2}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.22}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {isCharged && <ProjectileChargeAura projScale={projScale} />}
    </group>
  );
}

// ── Overcharged Blaster visual ────────────────────────────────────────────────
const _ocProjCoreGeo = new THREE.SphereGeometry(1, 20, 14);
const _ocRingGeo     = new THREE.TorusGeometry(1, 0.055, 7, 48);
const _ocProjCoreMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
const _ocRingMat  = new THREE.MeshBasicMaterial({ color: "#33aaff", transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
const _ocRing2Mat = new THREE.MeshBasicMaterial({ color: "#aaccff", transparent: true, opacity: 0.50, depthWrite: false, blending: THREE.AdditiveBlending });

const _RIBBON_N  = 16;
const _RIBBON_HW = 0.22; // half-width at head

function OverchargedProjectileMesh({
  projectile, spawnScale,
}: {
  projectile: Projectile; spawnScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spawnGroupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringOneRef = useRef<THREE.Group>(null);
  const ringTwoRef = useRef<THREE.Group>(null);
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
    const motion = projectilePhysicsMap.get(proj.id);
    if (groupRef.current && motion) groupRef.current.position.set(...motion.position);
    const visualScale = motion?.spawnScale ?? ss;
    if (spawnGroupRef.current) spawnGroupRef.current.scale.setScalar(visualScale);
    const travelTimer = motion?.travelTimer ?? 0;
    const chargeT = Math.max(0, Math.min(1, (travelTimer - (OC_TRAVEL_TIME - 0.5)) / 0.5));
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * (4.5 + chargeT * 18));
    if (coreRef.current) coreRef.current.scale.setScalar(1.247 + pulse * (0.1505 + chargeT * 0.35));
    if (ringOneRef.current) ringOneRef.current.rotation.set(clock.getElapsedTime() * 2.1, 0, (clock.getElapsedTime() * 1.6 + 1.05) * 0.6);
    if (ringTwoRef.current) ringTwoRef.current.rotation.set((clock.getElapsedTime() * 1.6 + 1.05) * 0.5, clock.getElapsedTime() * 2.1 * 0.8, 0);
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
      const ci = i * 8;
      cA[ci]   = 0.2; cA[ci+1] = 0.55; cA[ci+2] = 1.0; cA[ci+3] = alpha;
      cA[ci+4] = 0.2; cA[ci+5] = 0.55; cA[ci+6] = 1.0; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true;
    cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  return (
    <group ref={groupRef} position={projectile.position}>
      {/* Trailing ribbon rendered behind the spawn-scale group */}
      <mesh geometry={ribbonGeo} material={ribbonMat} />
      {/* Scale-in group: everything below grows from 0.05 → 1.0 on spawn */}
      <group ref={spawnGroupRef} scale={spawnScale}>
        <pointLight ref={glowLightRef} color="#55aaff" intensity={8} distance={9} decay={2} />
        <pointLight color="#ffffff" intensity={4}              distance={3} decay={2} />
        <mesh ref={coreRef} geometry={_ocProjCoreGeo} material={_ocProjCoreMat} scale={1.247} />
        <group ref={ringOneRef}>
          <mesh geometry={_ocRingGeo} material={_ocRingMat}  scale={1.72} />
        </group>
        <group ref={ringTwoRef}>
          <mesh geometry={_ocRingGeo} material={_ocRing2Mat} scale={1.55} />
        </group>
      </group>
    </group>
  );
}

// ── Orbital Spiral Blaster mesh — 3 orbiting player-orb sub-spheres ──────────

function SpiralBundleMesh({
  projectile,
  skinColors,
}: {
  projectile: Projectile;
  skinColors: { core: string; glow: string };
}) {
  const groupRef = useRef<THREE.Group>(null);
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

  // Refs for sub-sphere groups and flash meshes
  const subGrpRefs   = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const flashRefs    = [useRef<THREE.Mesh>(null),  useRef<THREE.Mesh>(null),  useRef<THREE.Mesh>(null)];

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

      // Position sub-sphere group (relative to parent at proj center)
      const grp = subGrpRefs[si].current;
      if (grp) { grp.position.set(spx - cx, spy - cy, spz - cz); grp.visible = alive[si]; }

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
      const tc    = _SPIRAL_TRAIL_C[si];
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
    <group ref={groupRef} position={projectile.position}>
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

      {/* 3 orbiting sub-sphere orbs — player model scaled to 75% */}
      {[0, 1, 2].map(si => (
        <group key={`sub-${si}`} ref={subGrpRefs[si]}>
          <pointLight color={SPIRAL_COLORS_HEX[si]} intensity={8} distance={4} decay={2} />
          <Suspense fallback={null}>
            <PlayerModel
              scale={SPIRAL_SUB_SCALE}
              rotationSpeedX={1.2 + si * 0.4}
              rotationSpeedY={2.0 + si * 0.35}
            />
          </Suspense>
          <PlayerGlow
            scale={SPIRAL_SUB_SCALE}
            coreColor={SPIRAL_COLORS_HEX[si]}
            glowColor={SPIRAL_GLOW_HEX[si]}
          />
        </group>
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
  const incrementGauntletOrbs  = useMagicOrb(s => s.incrementGauntletOrbs);
  const addStarFlowEvent       = useMagicOrb(s => s.addStarFlowEvent);
  
  const { playHit, playSuccess, playSparkleExplosion } = useAudio();
  const { equippedTrail, equippedSkin } = useShop();
  const clockRef = useRef(0);
  const projectileSpeed = 16.5;
  const hitRadius = 1.2;
  const hitOrbsThisFrame = useRef<Set<string>>(new Set());
  const hitPowerUpsThisFrame = useRef<Set<string>>(new Set());
  // Tracks which spiral projectiles have already pierced through the boss this
  // pass so they don't register multiple hits while inside the hit radius.
  const spiralBossHit = useRef<Set<string>>(new Set());
  const projectileOrbHits = useRef<Map<string, Set<string>>>(new Map());
  const volleyHits = useRef<Set<string>>(new Set());
  const volleyProjectileCounts = useRef<Map<string, number>>(new Map());
  const volleyRemainingCounts = useRef<Map<string, number>>(new Map());
  const removedProjectileIds = useRef<Set<string>>(new Set());
  const activeProjectileIds = useRef<Set<string>>(new Set());
  const activeVolleyCounts = useRef<Map<string, number>>(new Map());
  const impactUpdateAccumulator = useRef(0);
  const enemyCollisionGrid = useRef(new EnemyCollisionGrid());
  const collisionsEnabled = usePerformanceFeature("collision");

  // ── Overcharged shockwave rings ───────────────────────────────────────────
  const knownOcIds   = useRef<Set<string>>(new Set());
  const [shockwaves,   setShockwaves]   = useState<Array<{ id: string; pos: [number,number,number] }>>([]);
  const [ocExplosions, setOcExplosions] = useState<Array<{ id: string; pos: [number,number,number] }>>([]);
  const swTimeoutsRef    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ocExpTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    resetProjectileMotion();
    for (const timeout of swTimeoutsRef.current.values()) clearTimeout(timeout);
    for (const timeout of ocExpTimeoutsRef.current.values()) clearTimeout(timeout);
    for (const timeout of hmRingTimeoutsRef.current.values()) clearTimeout(timeout);
    for (const timeout of scatterArcTimeoutsRef.current.values()) clearTimeout(timeout);
    swTimeoutsRef.current.clear();
    ocExpTimeoutsRef.current.clear();
    hmRingTimeoutsRef.current.clear();
    scatterArcTimeoutsRef.current.clear();
    knownOcIds.current.clear();
    knownHomingIds.current.clear();
    knownScatterVolleys.current.clear();
    spiralBossHit.current.clear();
    projectileOrbHits.current.clear();
    volleyHits.current.clear();
    volleyProjectileCounts.current.clear();
    volleyRemainingCounts.current.clear();
  }, []);
  
  const skinColors = useMemo(() => getSkinColors(equippedSkin, 3), [equippedSkin]);
  const projectileColor = skinColors.projectile;
   const batchedProjectiles = useMemo(
     () => projectiles.filter((projectile) =>
       projectile.type === "rapidblaster" ||
       ((projectile.type === "normal" || !projectile.type) && equippedTrail !== "particle_swarm"),
     ),
     [equippedTrail, projectiles],
   );

  // Spawn effects consume successful admission events. This avoids an active
  // projectile scan every frame while still preserving effects for shots that
  // collide and disappear before React can commit a structural update.
  useFrame(() => {
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
        const homingBoundary = 12;
        // Inline the filter into the closest-orb search (single pass, no allocation).
        let closestTargetPosition: [number, number, number] | null = null;
        let closestDist2 = Infinity; // compare squared distances — no sqrt needed for selection

        for (const orb of darkOrbs) {
          const orbPosition = liveOrbPosition(orb);
          if (orb.destroying || Math.abs(orbPosition[0]) > homingBoundary || Math.abs(orbPosition[1]) > homingBoundary) continue;
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
              // RotateTowards: clamp angular change to 45°/sec so shots curve naturally
              // and can miss targets that move perpendicular or very fast.
              const MAX_TURN_RAD = (138 * Math.PI / 180) * delta;
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
      px += dx * effSpeed * delta;
      py += dy * effSpeed * delta;
      pz += dz * effSpeed * delta;

      // Grow-in scale for overcharged (EaseOutQuad over 0.15 s)
      let newSpawnScale    = motion.spawnScale;
      let newSpawnScaleTimer = motion.spawnScaleTimer;
      if (proj.type === "overcharged" && newSpawnScaleTimer !== undefined && newSpawnScaleTimer < 0.15) {
        newSpawnScaleTimer = newSpawnScaleTimer + delta;
        const eoqT  = Math.min(1, newSpawnScaleTimer / 0.15);
        newSpawnScale = 0.05 + 0.95 * easeOutQuad(eoqT);
      }

      // travelTimer is advanced after hitSomething is declared (see below)
      let newTravelTimer = motion.travelTimer;

      const screenBoundary = 20;
      if (Math.abs(px) > screenBoundary || Math.abs(py) > screenBoundary) {
        const projHasHit = projectileOrbHits.current.has(proj.id) && projectileOrbHits.current.get(proj.id)!.size > 0;
        
        if (proj.volleyId) {
          if (projHasHit) {
            volleyHits.current.add(proj.volleyId);
          }
          const remaining = (volleyRemainingCounts.current.get(proj.volleyId) || 1) - 1;
          volleyRemainingCounts.current.set(proj.volleyId, remaining);
          
          if (remaining <= 0) {
            if (!volleyHits.current.has(proj.volleyId) && !proj.noMissTracking) {
              registerMissedShot();
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

      // ── Overcharged Blaster: timed AOE explosion after OC_TRAVEL_TIME ────────
      if (proj.type === "overcharged" && newTravelTimer !== undefined) {
        newTravelTimer = newTravelTimer + delta;
        if (newTravelTimer >= OC_TRAVEL_TIME) {
          hitSomething = true;

          const expId  = `ocexp-${proj.id}`;
          const expPos = [px, py, pz] as [number, number, number];
          setOcExplosions(prev => [...prev, { id: expId, pos: expPos }]);
          ocExpTimeoutsRef.current.set(expId, setTimeout(() => {
            setOcExplosions(prev => prev.filter(e => e.id !== expId));
            ocExpTimeoutsRef.current.delete(expId);
          }, 2600)); // extended to cover 2 s ionized smoke layer

          useMagicOrb.getState().triggerBackgroundShake();
          playSparkleExplosion();

          if (boss && !boss.destroying) {
            const [bx, by, bz] = gameRuntime.boss.get(boss.id)?.position ?? boss.position;
            if (Math.sqrt((px-bx)**2+(py-by)**2+((bz||0)-pz)**2) < OC_EXPLODE_RADIUS + 1.65) {
              const bossKilled = damageBoss(8);
              addScore(25); playHit();
              if (bossKilled) playSparkleExplosion();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: [bx, by, bz||0], timer: 0.55, maxTimer: 0.55, seed: Math.random(), isBossHit: true });
            }
          }

          const explosionCandidates = enemyCollisionGrid.current.queryAabb(
            px - OC_EXPLODE_RADIUS,
            px + OC_EXPLODE_RADIUS,
            py - OC_EXPLODE_RADIUS,
            py + OC_EXPLODE_RADIUS,
          );
          for (const orbIndex of explosionCandidates) {
            const orb = darkOrbs[orbIndex];
            if (orb.destroying) continue;
            const [ox, oy, oz] = liveOrbPosition(orb);
            if (Math.abs(ox) > 13 || Math.abs(oy) > 13) continue;
            if (Math.sqrt((px-ox)**2+(py-oy)**2+(pz-oz)**2) < OC_EXPLODE_RADIUS) {
              markOrbDestroying(orb.id, [ox, oy, oz]);
              addScore(10); incrementGauntletOrbs();
              addStarFlowEvent([ox, oy, oz], 5);
              if (gameMode === "arcade") incrementOrbsDestroyed();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: [ox, oy, oz], timer: 0.4, maxTimer: 0.4, seed: Math.random() });
            }
          }

          for (const powerUp of powerUps) {
            if (powerUp.collected || powerUp.destroying || powerUp.hurtTimer) continue;
            const [pux, puy, puz] = powerUp.position;
            if (Math.sqrt((px-pux)**2+(py-puy)**2+(pz-puz)**2) < OC_EXPLODE_RADIUS) {
              hitPowerUpsThisFrame.current.add(powerUp.id);
              hurtPowerUp(powerUp.id);
              playSuccess();
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
              2.15,
            ) !== null) {
              spiralBossHit.current.add(_sk);
              _subAlive[si] = false;
              motion.hitCount = Math.max(0, (motion.hitCount ?? 3) - 1);
              const _ph = projectileOrbHits.current.get(proj.id) || new Set<string>();
              _ph.add("boss"); projectileOrbHits.current.set(proj.id, _ph);
              const _bk = damageBoss();
              addScore(25); playHit();
              if (_bk) playSparkleExplosion();
              addImpactEffect({ id: `impact-${impactIdCounter++}`, position: [_spx, _spy, _spz], timer: 0.45, maxTimer: 0.45, seed: Math.random(), isBossHit: true });
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
          if (Math.abs(ox) > 12 || Math.abs(oy) > 12) continue;
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
              hitRadius + (orb.isBossOrb ? 0.6 : 0) + 0.38,
            ) !== null) {
              _subAlive[si] = false;
              motion.hitCount = Math.max(0, (motion.hitCount ?? 3) - 1);
              hitOrbsThisFrame.current.add(orb.id);
              markOrbDestroying(orb.id, [ox, oy, oz]);
              addScore(10); incrementGauntletOrbs(); playHit();
              addStarFlowEvent([ox, oy, oz], 5);
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

      if (!hitSomething && proj.type !== "spiral") {
      if (boss && !boss.destroying && !boss.shieldActive) {
        const liveBoss = gameRuntime.boss.get(boss.id);
        const [bx, by, bz] = liveBoss?.position ?? boss.position;
        const [previousBossX, previousBossY, previousBossZ] =
          liveBoss?.previousPosition ?? [bx, by, bz];
        const bossHitRadius = 1.65;
        
        if (
            sweptSphereHit(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              px, py, pz,
              previousBossX, previousBossY, previousBossZ || 0,
              bx, by, bz || 0,
              bossHitRadius,
            ) !== null &&
            !spiralBossHit.current.has(proj.id) &&
            (proj.type !== "overcharged" || (motion.spawnScale ?? 1) >= 0.8)) {
          const isOvercharged = proj.type === "overcharged";
           const isSpiralPiercing = motion.hitCount !== undefined && motion.hitCount > 1;

          if (isOvercharged) {
            // Overcharged passes through the boss — track so it only hits once per pass
            spiralBossHit.current.add(proj.id);
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
          const bossKilled = damageBoss(isOvercharged ? 5 : undefined);
          addScore(25);
          playHit();
          
          if (bossKilled) {
            playSparkleExplosion();
          }
          
          // Place impact at the sphere surface point the projectile entered.
          {
            const bzSafe = bz || 0;
            let dx = px - bx, dy = py - by, dz = pz - bzSafe;
            let len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len < 1e-6) {
              [dx, dy, dz] = proj.direction;
              len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            }
            const surfaceR = 1.44;
            addImpactEffect({
              id: `impact-${impactIdCounter++}`,
              position: [
                bx + (dx / len) * surfaceR,
                by + (dy / len) * surfaceR,
                bzSafe + (dz / len) * surfaceR,
              ],
              timer: 0.5,
              maxTimer: 0.5,
              seed: Math.random(),
              isBossHit: true,
            });
          }
        }
      } else if (boss && boss.shieldActive && proj.type !== "overcharged") {
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
        const orbScreenBoundary = 12;
        if (Math.abs(ox) > orbScreenBoundary || Math.abs(oy) > orbScreenBoundary) continue;
        
        if (proj.piercing) {
          const _ph = projectileOrbHits.current.get(proj.id);
          if (_ph && _ph.has(orb.id)) continue;
        }
        const bossOrbHitBonus = orb.isBossOrb ? 0.6 : 0;
        const effectiveRadius = proj.type === "overcharged"
          ? hitRadius * (proj.size ?? 1) * 2.8
          : (proj.isCharged ? hitRadius * 1.8 : hitRadius) + bossOrbHitBonus;
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
            (proj.type !== "overcharged" || (motion.spawnScale ?? 1) >= 0.8)) {
          hitOrbsThisFrame.current.add(orb.id);
          markOrbDestroying(orb.id, [ox, oy, oz]);
          addScore(10);
          incrementGauntletOrbs();
          addStarFlowEvent([ox, oy, oz], 5);
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
          
          if (proj.type === "overcharged") {
            // Unlimited pierce — destroy orb, keep flying
            let _ph = projectileOrbHits.current.get(proj.id);
            if (!_ph) { _ph = new Set(); projectileOrbHits.current.set(proj.id, _ph); }
            _ph.add(orb.id);
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
      
      for (const powerUp of powerUps) {
        if (hitPowerUpsThisFrame.current.has(powerUp.id) || powerUp.collected || powerUp.destroying || powerUp.hurtTimer) continue;
        
        if (
            sweptSphereHit(
              previousProjectileX, previousProjectileY, previousProjectileZ,
              px, py, pz,
              powerUp.position[0], powerUp.position[1], powerUp.position[2],
              powerUp.position[0], powerUp.position[1], powerUp.position[2],
              1.5,
            ) !== null
        ) {
          hitPowerUpsThisFrame.current.add(powerUp.id);
          hurtPowerUp(powerUp.id);
          hitSomething = true;
          if (proj.volleyId) volleyHits.current.add(proj.volleyId);
          playSuccess();
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
       <ProjectileVisualBatch projectiles={batchedProjectiles} skinColors={skinColors} />
       <Suspense fallback={null}>
         <BatchedNormalProjectileModels projectiles={batchedProjectiles} />
       </Suspense>
      {projectiles.map((proj) =>
        proj.type === "overcharged" ? (
          <OverchargedProjectileMesh
            key={proj.id}
            projectile={proj}
            spawnScale={proj.spawnScale ?? 1}
          />
        ) : proj.type === "spiral" ? (
          <SpiralBundleMesh
            key={proj.id}
            projectile={proj}
            skinColors={skinColors}
          />
        ) : proj.type === "homing" ? (
          <HomingProjectileMesh
            key={proj.id}
            projectile={proj}
          />
        ) : proj.type === "scattershot" ? (
          <ScattershotProjectileMesh
            key={proj.id}
            projectile={proj}
          />
        ) : proj.type === "subblaster" ? (
          <SubblasterProjectileMesh
            key={proj.id}
            projectile={proj}
          />
         ) : proj.type === "rapidblaster" ? null
         : (proj.type === "normal" || !proj.type) && equippedTrail !== "particle_swarm" ? null
         : (
           <ProjectileMesh
             key={proj.id}
             projectile={proj}
             trailType={equippedTrail}
             skinColor={projectileColor}
             skinColors={skinColors}
             equippedSkin={equippedSkin}
           />
         )
      )}
      {shockwaves.map(sw => (
        <OcShockwaveRing key={sw.id} position={sw.pos} />
      ))}
      {ocExplosions.map(ex => (
        <OcPlasmaExplosion key={ex.id} position={ex.pos} />
      ))}
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
