import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  useGraphicsPreset,
  type GraphicsPreset,
} from "@/game-runtime/PerformanceToggles";

export const OVERCHARGED_BUILD_DURATION = 0.26;
export const OVERCHARGED_CLIMAX_DURATION = 0.64;
export const OVERCHARGED_EXPLOSION_DURATION = 1.16;
export const OVERCHARGED_EXPLOSION_MAX_ACTIVE = 4;

export type OverchargedExplosionPhase =
  | "building"
  | "climax"
  | "afterglow"
  | "complete";

export type OverchargedExplosionProfile = Readonly<{
  build: number;
  plasma: number;
  sparks: number;
  shards: number;
}>;

export const OVERCHARGED_EXPLOSION_PROFILES: Record<
  GraphicsPreset,
  OverchargedExplosionProfile
> = {
  low: { build: 8, plasma: 12, sparks: 18, shards: 4 },
  standard: { build: 14, plasma: 20, sparks: 32, shards: 7 },
  high: { build: 20, plasma: 30, sparks: 48, shards: 10 },
};

type ExplosionSlot = {
  active: boolean;
  id: string;
  age: number;
  generation: number;
  seed: number;
  position: [number, number, number];
  direction: [number, number, number];
};

export type OverchargedExplosionPool = {
  slots: ExplosionSlot[];
  generation: number;
};

export type OverchargedExplosionEvent = Readonly<{
  id: string;
  position: readonly [number, number, number];
  direction: readonly [number, number, number];
}>;

export function isOverchargedPresentationEnabled(vfxEnabled: boolean): boolean {
  return vfxEnabled;
}

export function getOverchargedExplosionPhase(
  age: number,
): OverchargedExplosionPhase {
  if (age < OVERCHARGED_BUILD_DURATION) return "building";
  if (age < OVERCHARGED_BUILD_DURATION + OVERCHARGED_CLIMAX_DURATION) {
    return "climax";
  }
  if (age < OVERCHARGED_EXPLOSION_DURATION) return "afterglow";
  return "complete";
}

export function getOverchargedExplosionParticleTotal(
  profile: OverchargedExplosionProfile,
): number {
  return profile.build + profile.plasma + profile.sparks + profile.shards;
}

export function getOverchargedAfterglowParticleCount(
  profile: OverchargedExplosionProfile,
): number {
  return Math.max(2, Math.ceil(profile.build * 0.55));
}

export function createOverchargedExplosionPool(): OverchargedExplosionPool {
  return {
    generation: 0,
    slots: Array.from(
      { length: OVERCHARGED_EXPLOSION_MAX_ACTIVE },
      (): ExplosionSlot => ({
        active: false,
        id: "",
        age: 0,
        generation: 0,
        seed: 0,
        position: [0, 0, 0],
        direction: [1, 0, 0],
      }),
    ),
  };
}

function hashId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function emitOverchargedExplosion(
  pool: OverchargedExplosionPool,
  event: OverchargedExplosionEvent,
): number {
  let slotIndex = pool.slots.findIndex((slot) => !slot.active);
  if (slotIndex < 0) {
    let oldestGeneration = Infinity;
    slotIndex = 0;
    for (let i = 0; i < pool.slots.length; i++) {
      if (pool.slots[i].generation < oldestGeneration) {
        oldestGeneration = pool.slots[i].generation;
        slotIndex = i;
      }
    }
  }

  const slot = pool.slots[slotIndex];
  const length = Math.hypot(
    event.direction[0],
    event.direction[1],
    event.direction[2],
  ) || 1;
  slot.active = true;
  slot.id = event.id;
  slot.age = 0;
  slot.generation = ++pool.generation;
  slot.seed = hashId(event.id);
  slot.position[0] = event.position[0];
  slot.position[1] = event.position[1];
  slot.position[2] = event.position[2];
  slot.direction[0] = event.direction[0] / length;
  slot.direction[1] = event.direction[1] / length;
  slot.direction[2] = event.direction[2] / length;
  return slotIndex;
}

export function resetOverchargedExplosionPool(
  pool: OverchargedExplosionPool,
): void {
  pool.generation = 0;
  for (const slot of pool.slots) {
    slot.active = false;
    slot.id = "";
    slot.age = 0;
    slot.generation = 0;
  }
}

type BuildDatum = Readonly<{
  angle: number;
  radius: number;
  elevation: number;
  size: number;
  spin: number;
  phase: number;
  tone: number;
}>;

type BurstDatum = Readonly<{
  angle: number;
  elevation: number;
  speed: number;
  size: number;
  delay: number;
  life: number;
  tone: number;
}>;

const MAX_PROFILE = OVERCHARGED_EXPLOSION_PROFILES.high;
const FLASH_CAPACITY = OVERCHARGED_EXPLOSION_MAX_ACTIVE;
const RING_CAPACITY = OVERCHARGED_EXPLOSION_MAX_ACTIVE * 2;
const BUILD_CAPACITY = OVERCHARGED_EXPLOSION_MAX_ACTIVE * MAX_PROFILE.build;
const PLASMA_CAPACITY = OVERCHARGED_EXPLOSION_MAX_ACTIVE * MAX_PROFILE.plasma;
const SPARK_CAPACITY = OVERCHARGED_EXPLOSION_MAX_ACTIVE * MAX_PROFILE.sparks;
const SHARD_CAPACITY = OVERCHARGED_EXPLOSION_MAX_ACTIVE * MAX_PROFILE.shards;
const EFFECT_RADIUS = 4.8;

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const dummy = new THREE.Object3D();
const color = new THREE.Color();
const axis = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();

function seeded(index: number, offset: number): number {
  const x = Math.sin((index + 1) * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const BUILD_DATA: BuildDatum[] = Array.from(
  { length: MAX_PROFILE.build },
  (_, index) => ({
    angle: (index / MAX_PROFILE.build) * Math.PI * 2 + seeded(index, 1) * 0.7,
    radius: 0.7 + seeded(index, 2) * 1.1,
    elevation: (seeded(index, 3) - 0.5) * 1.2,
    size: 0.045 + seeded(index, 4) * 0.09,
    spin: 3.2 + seeded(index, 5) * 3.8,
    phase: seeded(index, 6) * Math.PI * 2,
    tone: seeded(index, 7),
  }),
);

function makeBurstData(count: number, speedMin: number, speedRange: number): BurstDatum[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (index / count) * Math.PI * 2 + seeded(index, 11) * 0.55,
    elevation: (seeded(index, 12) - 0.5) * 0.9,
    speed: speedMin + seeded(index, 13) * speedRange,
    size: 0.04 + seeded(index, 14) * 0.12,
    delay: seeded(index, 15) * 0.08,
    life: 0.34 + seeded(index, 16) * 0.38,
    tone: seeded(index, 17),
  }));
}

const PLASMA_DATA = makeBurstData(MAX_PROFILE.plasma, 2.4, 5.2);
const SPARK_DATA = makeBurstData(MAX_PROFILE.sparks, 7.5, 11);
const SHARD_DATA = makeBurstData(MAX_PROFILE.shards, 3.5, 5);

function hideRange(
  mesh: THREE.InstancedMesh | null,
  start: number,
  count: number,
): void {
  if (!mesh) return;
  for (let i = 0; i < count; i++) mesh.setMatrixAt(start + i, hiddenMatrix);
}

function writeEnergyColor(tone: number, brightness: number): void {
  if (tone < 0.28) color.set("#ffffff");
  else if (tone < 0.64) color.set("#61efff");
  else if (tone < 0.86) color.set("#3978ff");
  else color.set("#9d4dff");
  color.multiplyScalar(Math.max(0, brightness));
}

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function OverchargedExplosionVFX({
  pool,
}: {
  pool: OverchargedExplosionPool;
}) {
  const preset = useGraphicsPreset();
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const buildRef = useRef<THREE.InstancedMesh>(null);
  const plasmaRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const initializedRef = useRef(false);
  const lastPresetRef = useRef<GraphicsPreset | "">("");
  const visibleSlotsRef = useRef(
    Array.from({ length: OVERCHARGED_EXPLOSION_MAX_ACTIVE }, () => false),
  );

  const [flashGeometry] = useState(() => new THREE.SphereGeometry(1, 14, 10));
  const [ringGeometry] = useState(() => new THREE.TorusGeometry(1, 0.055, 5, 48));
  const [particleGeometry] = useState(() => new THREE.IcosahedronGeometry(1, 0));
  const [sparkGeometry] = useState(() => new THREE.OctahedronGeometry(1, 0));
  const [shardGeometry] = useState(() => new THREE.TetrahedronGeometry(1, 0));

  const materials = useMemo(() => ({
    flash: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
    ring: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
    build: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
    plasma: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
    spark: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
    shard: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    }),
  }), []);

  useEffect(() => () => {
    flashGeometry.dispose();
    ringGeometry.dispose();
    particleGeometry.dispose();
    sparkGeometry.dispose();
    shardGeometry.dispose();
    Object.values(materials).forEach((material) => material.dispose());
  }, [
    flashGeometry,
    materials,
    particleGeometry,
    ringGeometry,
    shardGeometry,
    sparkGeometry,
  ]);

  useFrame((_, delta) => {
    const flashMesh = flashRef.current;
    const ringMesh = ringRef.current;
    const buildMesh = buildRef.current;
    const plasmaMesh = plasmaRef.current;
    const sparkMesh = sparkRef.current;
    const shardMesh = shardRef.current;
    if (!flashMesh || !ringMesh || !buildMesh || !plasmaMesh || !sparkMesh || !shardMesh) return;
    let buffersChanged = false;

    if (!initializedRef.current) {
      hideRange(flashMesh, 0, FLASH_CAPACITY);
      hideRange(ringMesh, 0, RING_CAPACITY);
      hideRange(buildMesh, 0, BUILD_CAPACITY);
      hideRange(plasmaMesh, 0, PLASMA_CAPACITY);
      hideRange(sparkMesh, 0, SPARK_CAPACITY);
      hideRange(shardMesh, 0, SHARD_CAPACITY);
      initializedRef.current = true;
      buffersChanged = true;
    }

    const profile = OVERCHARGED_EXPLOSION_PROFILES[presetRef.current];
    if (lastPresetRef.current !== presetRef.current) {
      hideRange(flashMesh, 0, FLASH_CAPACITY);
      hideRange(ringMesh, 0, RING_CAPACITY);
      hideRange(buildMesh, 0, BUILD_CAPACITY);
      hideRange(plasmaMesh, 0, PLASMA_CAPACITY);
      hideRange(sparkMesh, 0, SPARK_CAPACITY);
      hideRange(shardMesh, 0, SHARD_CAPACITY);
      buildMesh.count = profile.build * OVERCHARGED_EXPLOSION_MAX_ACTIVE;
      plasmaMesh.count = profile.plasma * OVERCHARGED_EXPLOSION_MAX_ACTIVE;
      sparkMesh.count = profile.sparks * OVERCHARGED_EXPLOSION_MAX_ACTIVE;
      shardMesh.count = profile.shards * OVERCHARGED_EXPLOSION_MAX_ACTIVE;
      visibleSlotsRef.current.fill(false);
      lastPresetRef.current = presetRef.current;
      buffersChanged = true;
    }

    const anyActive = pool.slots.some((slot) => slot.active);
    if (groupRef.current) groupRef.current.visible = anyActive;

    for (let slotIndex = 0; slotIndex < pool.slots.length; slotIndex++) {
      const slot = pool.slots[slotIndex];
      const buildStart = slotIndex * profile.build;
      const plasmaStart = slotIndex * profile.plasma;
      const sparkStart = slotIndex * profile.sparks;
      const shardStart = slotIndex * profile.shards;
      const ringStart = slotIndex * 2;

      if (!slot.active) {
        if (visibleSlotsRef.current[slotIndex]) {
          hideRange(flashMesh, slotIndex, 1);
          hideRange(ringMesh, ringStart, 2);
          hideRange(buildMesh, buildStart, profile.build);
          hideRange(plasmaMesh, plasmaStart, profile.plasma);
          hideRange(sparkMesh, sparkStart, profile.sparks);
          hideRange(shardMesh, shardStart, profile.shards);
          visibleSlotsRef.current[slotIndex] = false;
          buffersChanged = true;
        }
        continue;
      }

      visibleSlotsRef.current[slotIndex] = true;
      buffersChanged = true;
      slot.age += Math.min(delta, 0.05);
      if (slot.age >= OVERCHARGED_EXPLOSION_DURATION) {
        slot.active = false;
        hideRange(flashMesh, slotIndex, 1);
        hideRange(ringMesh, ringStart, 2);
        hideRange(buildMesh, buildStart, profile.build);
        hideRange(plasmaMesh, plasmaStart, profile.plasma);
        hideRange(sparkMesh, sparkStart, profile.sparks);
        hideRange(shardMesh, shardStart, profile.shards);
        visibleSlotsRef.current[slotIndex] = false;
        continue;
      }

      const age = slot.age;
      const buildT = Math.min(age / OVERCHARGED_BUILD_DURATION, 1);
      const buildEase = smoothstep(buildT);
      const climaxAge = age - OVERCHARGED_BUILD_DURATION;
      const phase = getOverchargedExplosionPhase(age);
      const directionAngle = Math.atan2(slot.direction[1], slot.direction[0]);
      const seedAngle = slot.seed * Math.PI * 2;

      for (let i = 0; i < profile.build; i++) {
        const index = buildStart + i;
        const datum = BUILD_DATA[i];
        if (phase === "afterglow") {
          const afterglowCount = getOverchargedAfterglowParticleCount(profile);
          const afterglowStart = OVERCHARGED_BUILD_DURATION + OVERCHARGED_CLIMAX_DURATION;
          const afterglowT = Math.min(
            (age - afterglowStart) / (OVERCHARGED_EXPLOSION_DURATION - afterglowStart),
            1,
          );
          if (i >= afterglowCount) {
            buildMesh.setMatrixAt(index, hiddenMatrix);
            continue;
          }
          const angle = datum.angle + seedAngle + afterglowT * datum.spin * 0.45;
          const radius = 0.32 + datum.radius * afterglowT * 0.78;
          const fade = Math.max(0, 1 - smoothstep(afterglowT));
          dummy.position.set(
            slot.position[0] + Math.cos(angle) * radius,
            slot.position[1] + Math.sin(angle) * radius + afterglowT * (0.45 + datum.tone * 0.5),
            slot.position[2] + datum.elevation * radius * 0.5,
          );
          dummy.quaternion.identity();
          dummy.scale.setScalar(Math.max(0.001, datum.size * fade * 0.8));
          dummy.updateMatrix();
          buildMesh.setMatrixAt(index, dummy.matrix);
          writeEnergyColor(datum.tone, fade * 0.48);
          buildMesh.setColorAt(index, color);
          continue;
        }
        if (phase !== "building") {
          buildMesh.setMatrixAt(index, hiddenMatrix);
          continue;
        }
        const angle = datum.angle + seedAngle + datum.spin * buildT;
        const radius = (1 - buildEase) * datum.radius * 2.1 + 0.08;
        const pulse = 0.72 + Math.sin(buildT * 18 + datum.phase) * 0.28;
        dummy.position.set(
          slot.position[0] + Math.cos(angle) * radius,
          slot.position[1] + Math.sin(angle) * radius,
          slot.position[2] + datum.elevation * radius * 0.32,
        );
        dummy.quaternion.identity();
        dummy.scale.setScalar(Math.max(0.001, datum.size * (0.55 + buildEase * 1.45) * pulse));
        dummy.updateMatrix();
        buildMesh.setMatrixAt(index, dummy.matrix);
        writeEnergyColor(datum.tone, 0.55 + buildEase * 0.75);
        buildMesh.setColorAt(index, color);
      }

      if (phase === "building") {
        const pulse = 0.72 + Math.sin(buildT * 24) * 0.16;
        dummy.position.set(...slot.position);
        dummy.quaternion.identity();
        dummy.scale.setScalar((0.2 + buildEase * 0.62) * pulse);
        dummy.updateMatrix();
        flashMesh.setMatrixAt(slotIndex, dummy.matrix);
        color.set("#74eaff").multiplyScalar(0.4 + buildEase * 0.8);
        flashMesh.setColorAt(slotIndex, color);
        hideRange(ringMesh, ringStart, 2);
      } else if (phase === "climax") {
        const flashT = Math.min(climaxAge / 0.2, 1);
        dummy.position.set(...slot.position);
        dummy.quaternion.identity();
        dummy.scale.setScalar(EFFECT_RADIUS * 0.34 * (1 - Math.pow(1 - flashT, 3)));
        dummy.updateMatrix();
        flashMesh.setMatrixAt(slotIndex, dummy.matrix);
        color.set("#ffffff").multiplyScalar(Math.max(0, 1 - flashT));
        flashMesh.setColorAt(slotIndex, color);

        for (let ring = 0; ring < 2; ring++) {
          const localAge = climaxAge - ring * 0.055;
          const ringT = Math.max(0, Math.min(localAge / (0.52 + ring * 0.08), 1));
          const index = ringStart + ring;
          if (localAge <= 0 || ringT >= 1) {
            ringMesh.setMatrixAt(index, hiddenMatrix);
            continue;
          }
          dummy.position.set(...slot.position);
          dummy.rotation.set(Math.PI / 2, 0, directionAngle + ring * Math.PI * 0.5);
          dummy.scale.setScalar(
            EFFECT_RADIUS * (ring === 0 ? 1.12 : 0.76) * (1 - Math.pow(1 - ringT, 3)),
          );
          dummy.updateMatrix();
          ringMesh.setMatrixAt(index, dummy.matrix);
          color.set(ring === 0 ? "#55e7ff" : "#b47cff")
            .multiplyScalar((1 - ringT) * (ring === 0 ? 1 : 0.72));
          ringMesh.setColorAt(index, color);
        }
      } else {
        flashMesh.setMatrixAt(slotIndex, hiddenMatrix);
        hideRange(ringMesh, ringStart, 2);
      }

      for (let i = 0; i < profile.plasma; i++) {
        const index = plasmaStart + i;
        const datum = PLASMA_DATA[i];
        const localAge = climaxAge - datum.delay;
        const t = localAge / datum.life;
        if (phase !== "climax" || localAge <= 0 || t >= 1) {
          plasmaMesh.setMatrixAt(index, hiddenMatrix);
          continue;
        }
        const angle = datum.angle + seedAngle;
        const forwardBias = 0.42 + datum.tone * 0.28;
        const dx = Math.cos(angle) + Math.cos(directionAngle) * forwardBias;
        const dy = Math.sin(angle) + Math.sin(directionAngle) * forwardBias;
        const length = Math.hypot(dx, dy) || 1;
        const distance = datum.speed * localAge * (1 - t * 0.36);
        dummy.position.set(
          slot.position[0] + (dx / length) * distance,
          slot.position[1] + (dy / length) * distance,
          slot.position[2] + datum.elevation * distance,
        );
        dummy.quaternion.identity();
        const size = datum.size * (1 + smoothstep(t) * 1.8) * Math.max(0, 1 - t * t);
        dummy.scale.setScalar(Math.max(0.001, size));
        dummy.updateMatrix();
        plasmaMesh.setMatrixAt(index, dummy.matrix);
        writeEnergyColor(datum.tone, (1 - t * t) * 1.1);
        plasmaMesh.setColorAt(index, color);
      }

      for (let i = 0; i < profile.sparks; i++) {
        const index = sparkStart + i;
        const datum = SPARK_DATA[i];
        const localAge = climaxAge - datum.delay;
        const t = localAge / datum.life;
        if (phase !== "climax" || localAge <= 0 || t >= 1) {
          sparkMesh.setMatrixAt(index, hiddenMatrix);
          continue;
        }
        const angle = datum.angle + seedAngle;
        direction.set(
          Math.cos(angle) * 0.78 + Math.cos(directionAngle) * 0.42,
          Math.sin(angle) * 0.78 + Math.sin(directionAngle) * 0.42,
          datum.elevation,
        ).normalize();
        const distance = datum.speed * localAge;
        dummy.position.set(
          slot.position[0] + direction.x * distance,
          slot.position[1] + direction.y * distance - localAge * localAge * 1.5,
          slot.position[2] + direction.z * distance,
        );
        dummy.quaternion.setFromUnitVectors(axis, direction);
        const fade = Math.max(0, 1 - t * t);
        dummy.scale.set(
          datum.size * 0.2 * fade,
          datum.size * (2.5 + datum.speed * 0.12) * fade,
          datum.size * 0.2 * fade,
        );
        dummy.updateMatrix();
        sparkMesh.setMatrixAt(index, dummy.matrix);
        writeEnergyColor(datum.tone, fade * 1.25);
        sparkMesh.setColorAt(index, color);
      }

      for (let i = 0; i < profile.shards; i++) {
        const index = shardStart + i;
        const datum = SHARD_DATA[i];
        const localAge = climaxAge - datum.delay;
        const t = localAge / Math.min(0.88, datum.life + 0.18);
        if (phase !== "climax" || localAge <= 0 || t >= 1) {
          shardMesh.setMatrixAt(index, hiddenMatrix);
          continue;
        }
        const angle = datum.angle + seedAngle;
        const distance = datum.speed * localAge * (1 - t * 0.24);
        dummy.position.set(
          slot.position[0] + Math.cos(angle) * distance,
          slot.position[1] + Math.sin(angle) * distance - localAge * localAge * 0.8,
          slot.position[2] + datum.elevation * distance,
        );
        dummy.rotation.set(
          localAge * (5 + datum.tone * 5),
          localAge * (7 + datum.tone * 4),
          angle,
        );
        const fade = Math.max(0, 1 - t);
        dummy.scale.set(
          datum.size * 0.65 * fade,
          datum.size * 1.55 * fade,
          datum.size * 0.65 * fade,
        );
        dummy.updateMatrix();
        shardMesh.setMatrixAt(index, dummy.matrix);
        writeEnergyColor(datum.tone, fade * 0.9);
        shardMesh.setColorAt(index, color);
      }
    }

    if (buffersChanged) {
      for (const mesh of [flashMesh, ringMesh, buildMesh, plasmaMesh, sparkMesh, shardMesh]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh
        ref={ringRef}
        args={[ringGeometry, materials.ring, RING_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={buildRef}
        args={[particleGeometry, materials.build, BUILD_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={plasmaRef}
        args={[particleGeometry, materials.plasma, PLASMA_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sparkRef}
        args={[sparkGeometry, materials.spark, SPARK_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={shardRef}
        args={[shardGeometry, materials.shard, SHARD_CAPACITY]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={flashRef}
        args={[flashGeometry, materials.flash, FLASH_CAPACITY]}
        frustumCulled={false}
      />
    </group>
  );
}