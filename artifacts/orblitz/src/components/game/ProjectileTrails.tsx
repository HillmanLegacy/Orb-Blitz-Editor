import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { projectilePhysicsMap } from "./ProjectilePhysics";
import { COSMETIC_TRAIL_CONFIGS } from "./ProjectileTrailConfig";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";

const MAX_PARTICLES_PER_PROJECTILE = 16;
const MAX_COSMETIC_TRAIL_PARTICLES = 2048;
const TRAIL_BASE_SCALE = 0.144;
const trailGeometry = new THREE.SphereGeometry(1, 5, 4);
const trailDummy = new THREE.Object3D();
const trailColor = new THREE.Color();

type TrailSlot = {
  index: number;
  history: Float32Array;
  head: number;
  count: number;
  seeds: Float32Array;
};

function seedFromId(id: string, index: number): number {
  let value = index * 0x9e3779b1;
  for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 0x85ebca6b);
  return ((value >>> 0) % 10_000) / 10_000;
}

/**
 * One instanced mesh renders all standard cosmetic trails. This replaces the
 * former 8–16 React meshes and frame callbacks per normal projectile while
 * retaining each equipped trail's palette, taper, wobble, and live direction.
 */
export function ProjectileTrails() {
  const projectiles = useMagicOrb(s => s.projectiles);
  const { equippedTrail } = useShop();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const slotsByProjectileRef = useRef<Map<string, TrailSlot>>(new Map());
  const freeSlotIndicesRef = useRef<number[]>([]);
  const nextSlotIndexRef = useRef(0);
  const configuredParticleCountRef = useRef(-1);
  const activeProjectileIdsRef = useRef<Set<string>>(new Set());
  const [material] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  }));

  useEffect(() => () => material.dispose(), [material]);

  const config = COSMETIC_TRAIL_CONFIGS[equippedTrail] ?? COSMETIC_TRAIL_CONFIGS.none;

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    runtimeDiagnostics.beginTrails();

    if (config.particleCount === 0) {
      slotsByProjectileRef.current.clear();
      freeSlotIndicesRef.current.length = 0;
      nextSlotIndexRef.current = 0;
      configuredParticleCountRef.current = 0;
      mesh.count = 0;
      runtimeDiagnostics.endTrails(0);
      return;
    }

    const maxTrailSlots = Math.floor(MAX_COSMETIC_TRAIL_PARTICLES / config.particleCount);
    if (configuredParticleCountRef.current !== config.particleCount) {
      // Particle ranges depend on the equipped cosmetic's density. Clearing on
      // a cosmetic change is intentional: it prevents an old stride from being
      // interpreted as another projectile's trail for one frame.
      slotsByProjectileRef.current.clear();
      freeSlotIndicesRef.current.length = 0;
      nextSlotIndexRef.current = 0;
      configuredParticleCountRef.current = config.particleCount;
      mesh.count = 0;
    }

    const time = clock.getElapsedTime();
    const activeIds = activeProjectileIdsRef.current;
    activeIds.clear();
    let highestSlot = -1;
    let visibleParticles = 0;
    const slotsByProjectile = slotsByProjectileRef.current;

    for (const projectile of projectiles) {
      if (projectile.type !== "normal" && projectile.type) continue;
      // Simulation creates these transforms before this visual pass. Never
      // recreate a released runtime from a stale store record, which was a
      // source of one-frame trail snap-backs.
      const motion = projectilePhysicsMap.get(projectile.id);
      if (!motion) continue;

      activeIds.add(projectile.id);
      let slot = slotsByProjectile.get(projectile.id);
      if (!slot) {
        let index = freeSlotIndicesRef.current.pop();
        if (index === undefined) {
          if (nextSlotIndexRef.current >= maxTrailSlots) continue;
          index = nextSlotIndexRef.current++;
        }
        const history = new Float32Array(MAX_PARTICLES_PER_PROJECTILE * 3);
        for (let i = 0; i < MAX_PARTICLES_PER_PROJECTILE; i++) {
          history[i * 3] = motion.position[0];
          history[i * 3 + 1] = motion.position[1];
          history[i * 3 + 2] = motion.position[2];
        }
        const seeds = new Float32Array(MAX_PARTICLES_PER_PROJECTILE);
        for (let i = 0; i < seeds.length; i++) seeds[i] = seedFromId(projectile.id, i);
        slot = { index, history, head: 0, count: 1, seeds };
        slotsByProjectile.set(projectile.id, slot);
      }

      const lastOffset = slot.head * 3;
      const lastX = slot.history[lastOffset];
      const lastY = slot.history[lastOffset + 1];
      const lastZ = slot.history[lastOffset + 2];
      if (
        Math.abs(lastX - motion.position[0]) > 0.00001 ||
        Math.abs(lastY - motion.position[1]) > 0.00001 ||
        Math.abs(lastZ - motion.position[2]) > 0.00001
      ) {
        slot.head = (slot.head + 1) % MAX_PARTICLES_PER_PROJECTILE;
        const writeOffset = slot.head * 3;
        slot.history[writeOffset] = motion.position[0];
        slot.history[writeOffset + 1] = motion.position[1];
        slot.history[writeOffset + 2] = motion.position[2];
        slot.count = Math.min(slot.count + 1, MAX_PARTICLES_PER_PROJECTILE);
      }

      const [dx, dy] = motion.direction;
      const baseScale = projectile.isCharged ? 0.216 : TRAIL_BASE_SCALE;
      const instanceStart = slot.index * config.particleCount;
      highestSlot = Math.max(highestSlot, slot.index);

      for (let i = 0; i < config.particleCount; i++) {
        const seed = slot.seeds[i];
        const trailDistance = i * 0.24;
        const wobblePhase = seed * Math.PI * 2;
        const wobbleX = Math.sin(time * 3.2 + wobblePhase) * config.spread * baseScale;
        const wobbleY = Math.cos(time * 2.7 + wobblePhase) * config.spread * baseScale;
        const wobbleZ = Math.sin(time * 4.1 + wobblePhase * 1.7) * config.spread * baseScale * 0.6;
        const taper = Math.max(0.05, 1 - i / config.particleCount);
        const particleScale = baseScale * 0.44 * (0.5 + seed * 0.65) * taper;
        const fade = Math.max(0.08, 1 - trailDistance * 1.8);

        // Sample a fixed-distance point along the actual path history. This
        // keeps particle spacing intact when the frame rate drops, and the
        // stable slot prevents trails from being reassigned when another shot
        // is added or removed.
        let remaining = trailDistance;
        let historyX = motion.position[0];
        let historyY = motion.position[1];
        let historyZ = motion.position[2];
        let sampleX = historyX;
        let sampleY = historyY;
        let sampleZ = historyZ;
        let foundSample = remaining <= 0;

        for (let sample = 1; sample < slot.count && !foundSample; sample++) {
          const historyIndex = (slot.head - sample + MAX_PARTICLES_PER_PROJECTILE) % MAX_PARTICLES_PER_PROJECTILE;
          const historyOffset = historyIndex * 3;
          const nextX = slot.history[historyOffset];
          const nextY = slot.history[historyOffset + 1];
          const nextZ = slot.history[historyOffset + 2];
          const segmentX = nextX - historyX;
          const segmentY = nextY - historyY;
          const segmentZ = nextZ - historyZ;
          const segmentLength = Math.hypot(segmentX, segmentY, segmentZ);
          if (segmentLength > 0.00001 && remaining <= segmentLength) {
            const ratio = remaining / segmentLength;
            sampleX = historyX + segmentX * ratio;
            sampleY = historyY + segmentY * ratio;
            sampleZ = historyZ + segmentZ * ratio;
            foundSample = true;
          } else {
            remaining -= segmentLength;
            historyX = nextX;
            historyY = nextY;
            historyZ = nextZ;
          }
        }
        if (!foundSample) {
          sampleX = historyX - dx * remaining;
          sampleY = historyY - dy * remaining;
          sampleZ = historyZ;
        }

        trailDummy.position.set(
          sampleX + wobbleX,
          sampleY + wobbleY,
          sampleZ + wobbleZ,
        );
        trailDummy.scale.setScalar(particleScale);
        trailDummy.updateMatrix();
        mesh.setMatrixAt(instanceStart + i, trailDummy.matrix);
        trailColor.set(config.colors[i % config.colors.length]).multiplyScalar(fade);
        mesh.setColorAt(instanceStart + i, trailColor);
        visibleParticles++;
      }
    }

    for (const [projectileId, slot] of slotsByProjectile) {
      if (activeIds.has(projectileId)) continue;
      const instanceStart = slot.index * config.particleCount;
      trailDummy.position.set(0, 0, 0);
      trailDummy.scale.setScalar(0);
      trailDummy.updateMatrix();
      for (let i = 0; i < config.particleCount; i++) {
        mesh.setMatrixAt(instanceStart + i, trailDummy.matrix);
      }
      slotsByProjectile.delete(projectileId);
      freeSlotIndicesRef.current.push(slot.index);
    }

    mesh.count = highestSlot < 0 ? 0 : (highestSlot + 1) * config.particleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    runtimeDiagnostics.endTrails(visibleParticles);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[trailGeometry, material, MAX_COSMETIC_TRAIL_PARTICLES]}
      frustumCulled={false}
    />
  );
}