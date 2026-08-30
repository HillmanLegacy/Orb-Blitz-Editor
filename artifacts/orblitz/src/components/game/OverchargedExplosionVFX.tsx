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
  // Keep generations monotonic so an immediate reset/re-emit cannot reuse the
  // generation still cached by a mounted presentation slot.
  pool.generation++;
  for (const slot of pool.slots) {
    slot.active = false;
    slot.id = "";
    slot.age = 0;
    slot.generation = 0;
  }
}

type BurstDatum = Readonly<{
  angle: number;
  elevation: number;
  speed: number;
  size: number;
  delay: number;
  life: number;
  tone: number;
}>;

const dummy = new THREE.Object3D();
const pointDirection = new THREE.Vector3();
const groupPosition = new THREE.Vector3();
const FLASH_RADIUS = 2.25;
const RING_RADIUS = 4.8;
const HIDDEN_POINT = 10_000;

function seeded(index: number, offset: number): number {
  const x = Math.sin((index + 1) * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeBurstData(
  count: number,
  speedMin: number,
  speedRange: number,
): BurstDatum[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (index / count) * Math.PI * 2 + seeded(index, 11) * 0.55,
    elevation: (seeded(index, 12) - 0.5) * 0.9,
    speed: speedMin + seeded(index, 13) * speedRange,
    size: 0.08 + seeded(index, 14) * 0.14,
    delay: seeded(index, 15) * 0.08,
    life: 0.34 + seeded(index, 16) * 0.38,
    tone: seeded(index, 17),
  }));
}

const BUILD_DATA = makeBurstData(20, 0.3, 0.8);
const PLASMA_DATA = makeBurstData(30, 2.4, 5.2);
const SPARK_DATA = makeBurstData(48, 7.5, 11);
const SHARD_DATA = makeBurstData(10, 3.5, 5);

function smoothstep(t: number): number {
  const value = Math.max(0, Math.min(1, t));
  return value * value * (3 - 2 * value);
}

function hideInstance(mesh: THREE.InstancedMesh, index: number): void {
  dummy.position.set(HIDDEN_POINT, HIDDEN_POINT, HIDDEN_POINT);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(0);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function writeInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rx: number,
  ry: number,
  rz: number,
): void {
  dummy.position.set(x, y, z);
  dummy.rotation.set(rx, ry, rz);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function setOpacity(
  material: THREE.Material | THREE.Material[],
  opacity: number,
): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    const transparentMaterial = item as THREE.Material & {
      opacity?: number;
      transparent?: boolean;
    };
    transparentMaterial.opacity = opacity;
    transparentMaterial.transparent = true;
  }
}

function ExplosionSlotView({
  slot,
  preset,
}: {
  slot: ExplosionSlot;
  preset: GraphicsPreset;
}) {
  const profile = OVERCHARGED_EXPLOSION_PROFILES[preset];
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringSecondaryRef = useRef<THREE.Mesh>(null);
  const buildRef = useRef<THREE.InstancedMesh>(null);
  const plasmaRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const generationRef = useRef(0);
  const disposalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [buildGeometry] = useState(() => new THREE.OctahedronGeometry(1, 0));
  const [plasmaGeometry] = useState(() => new THREE.TetrahedronGeometry(1, 0));
  const [sparkGeometry] = useState(() => new THREE.OctahedronGeometry(1, 0));
  const [shardGeometry] = useState(() => new THREE.IcosahedronGeometry(1, 0));

  useFrame((_, delta) => {
    const core = coreRef.current;
    const halo = haloRef.current;
    const ring = ringRef.current;
    const secondaryRing = ringSecondaryRef.current;
    const build = buildRef.current;
    const plasma = plasmaRef.current;
    const spark = sparkRef.current;
    const shard = shardRef.current;
    if (!core || !halo || !ring || !secondaryRing || !build || !plasma || !spark || !shard) return;

    if (!slot.active) {
      generationRef.current = -1;
      core.visible = false;
      halo.visible = false;
      ring.visible = false;
      secondaryRing.visible = false;
      build.visible = false;
      plasma.visible = false;
      spark.visible = false;
      shard.visible = false;
      return;
    }

    if (generationRef.current !== slot.generation) {
      generationRef.current = slot.generation;
      core.visible = true;
      halo.visible = true;
      ring.visible = true;
      secondaryRing.visible = true;
      build.visible = true;
      plasma.visible = true;
      spark.visible = true;
      shard.visible = true;
    }

    slot.age += Math.min(delta, 0.05);
    if (slot.age >= OVERCHARGED_EXPLOSION_DURATION) {
      slot.active = false;
      core.visible = false;
      halo.visible = false;
      ring.visible = false;
      secondaryRing.visible = false;
      build.visible = false;
      plasma.visible = false;
      spark.visible = false;
      shard.visible = false;
      return;
    }

    const age = slot.age;
    const phase = getOverchargedExplosionPhase(age);
    const buildT = Math.min(age / OVERCHARGED_BUILD_DURATION, 1);
    const buildEase = smoothstep(buildT);
    const climaxAge = age - OVERCHARGED_BUILD_DURATION;
    const directionAngle = Math.atan2(slot.direction[1], slot.direction[0]);
    const seedAngle = slot.seed * Math.PI * 2;
    groupPosition.set(...slot.position);

    core.position.copy(groupPosition);
    halo.position.copy(groupPosition);
    ring.position.copy(groupPosition);
    secondaryRing.position.copy(groupPosition);

    const coreMaterial = core.material as THREE.MeshBasicMaterial;
    const haloMaterial = halo.material as THREE.MeshBasicMaterial;
    const ringMaterial = ring.material as THREE.MeshBasicMaterial;
    const secondaryRingMaterial = secondaryRing.material as THREE.MeshBasicMaterial;

    if (phase === "building") {
      const pulse = 0.82 + Math.sin(age * 24) * 0.12;
      core.scale.setScalar((0.18 + buildEase * 0.72) * pulse);
      halo.scale.setScalar((0.36 + buildEase * 0.55) * pulse);
      setOpacity(coreMaterial, 0.95);
      setOpacity(haloMaterial, 0.22 + buildEase * 0.18);
      ring.scale.setScalar(0.18);
      secondaryRing.scale.setScalar(0.1);
      setOpacity(ringMaterial, 0);
      setOpacity(secondaryRingMaterial, 0);
    } else if (phase === "climax") {
      const flashT = Math.min(climaxAge / 0.2, 1);
      const flash = 1 - Math.pow(1 - flashT, 3);
      core.scale.setScalar(FLASH_RADIUS * 0.78 * flash);
      halo.scale.setScalar(FLASH_RADIUS * (0.9 + flash * 0.65));
      setOpacity(coreMaterial, Math.max(0.12, 1 - flashT * 0.8));
      setOpacity(haloMaterial, Math.max(0.1, 0.46 - flashT * 0.3));
      const ringT = Math.max(0, Math.min(climaxAge / 0.58, 1));
      ring.scale.setScalar(RING_RADIUS * (0.12 + ringT * 0.9));
      secondaryRing.scale.setScalar(RING_RADIUS * (0.08 + ringT * 0.62));
      ring.rotation.z = directionAngle;
      secondaryRing.rotation.z = directionAngle + Math.PI * 0.5;
      setOpacity(ringMaterial, Math.max(0.08, 0.92 * (1 - ringT)));
      setOpacity(secondaryRingMaterial, Math.max(0.05, 0.62 * (1 - ringT)));
    } else {
      const afterglowStart = OVERCHARGED_BUILD_DURATION + OVERCHARGED_CLIMAX_DURATION;
      const afterglowT = Math.min(
        (age - afterglowStart) / (OVERCHARGED_EXPLOSION_DURATION - afterglowStart),
        1,
      );
      const fade = 1 - smoothstep(afterglowT);
      core.scale.setScalar(0.55 * fade);
      halo.scale.setScalar(1.8 * fade);
      setOpacity(coreMaterial, Math.max(0.04, 0.26 * fade));
      setOpacity(haloMaterial, Math.max(0.02, 0.12 * fade));
      ring.scale.setScalar(RING_RADIUS * (1.02 + afterglowT * 0.18));
      secondaryRing.scale.setScalar(RING_RADIUS * (0.72 + afterglowT * 0.22));
      setOpacity(ringMaterial, Math.max(0.015, 0.16 * fade));
      setOpacity(secondaryRingMaterial, Math.max(0.01, 0.1 * fade));
    }

    const buildCount = phase === "afterglow"
      ? getOverchargedAfterglowParticleCount(profile)
      : profile.build;
    for (let i = 0; i < 20; i++) {
      if (i >= buildCount || (phase !== "building" && phase !== "afterglow")) {
        hideInstance(build, i);
        continue;
      }
      const datum = BUILD_DATA[i];
      const afterglowStart = OVERCHARGED_BUILD_DURATION + OVERCHARGED_CLIMAX_DURATION;
      const t = phase === "afterglow"
        ? Math.min((age - afterglowStart) / (OVERCHARGED_EXPLOSION_DURATION - afterglowStart), 1)
        : 0;
      const angle = datum.angle + seedAngle + t * 2.4;
      const radius = phase === "afterglow"
        ? 0.35 + datum.speed * t * 0.9
        : (1 - buildEase) * (1.1 + datum.speed) + 0.08;
      const size = (0.05 + datum.size * 0.42) * (phase === "afterglow" ? 0.68 : 0.82);
      writeInstance(
        build,
        i,
        slot.position[0] + Math.cos(angle) * radius,
        slot.position[1] + Math.sin(angle) * radius + t * 0.4,
        slot.position[2] + datum.elevation * radius * 0.35,
        size * 0.7,
        size * 1.25,
        size * 0.7,
        t * (2.2 + datum.speed),
        angle,
        t * 1.6,
      );
    }
    build.count = buildCount;
    build.instanceMatrix.needsUpdate = true;

    const updateBurstLayer = (
      mesh: THREE.InstancedMesh,
      data: readonly BurstDatum[],
      count: number,
      speedScale: number,
      verticalGravity: number,
      sizeScale: number,
    ) => {
      for (let i = 0; i < data.length; i++) {
        const datum = data[i];
        const localAge = climaxAge - datum.delay;
        const t = localAge / datum.life;
        if (i >= count || phase !== "climax" || localAge <= 0 || t >= 1) {
          hideInstance(mesh, i);
          continue;
        }
        const angle = datum.angle + seedAngle;
        pointDirection.set(
          Math.cos(angle) * 0.78 + Math.cos(directionAngle) * 0.42,
          Math.sin(angle) * 0.78 + Math.sin(directionAngle) * 0.42,
          datum.elevation,
        ).normalize();
        const distance = datum.speed * speedScale * localAge;
        const size = datum.size * sizeScale * (1 - t * 0.32);
        writeInstance(
          mesh,
          i,
          slot.position[0] + pointDirection.x * distance,
          slot.position[1] + pointDirection.y * distance - localAge * localAge * verticalGravity,
          slot.position[2] + pointDirection.z * distance,
          size * (mesh === spark ? 0.32 : 0.7),
          size * (mesh === spark ? 1.8 : 1.35),
          size * (mesh === spark ? 0.32 : 0.7),
          angle + Math.PI * 0.5,
          directionAngle,
          t * (datum.speed + 2.0),
        );
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateBurstLayer(plasma, PLASMA_DATA, profile.plasma, 1, 0.7, 0.72);
    updateBurstLayer(spark, SPARK_DATA, profile.sparks, 1, 1.5, 0.52);
    updateBurstLayer(shard, SHARD_DATA, profile.shards, 0.72, 0.8, 1.2);
    build.visible = phase === "building" || phase === "afterglow";
    plasma.visible = phase === "climax";
    spark.visible = phase === "climax";
    shard.visible = phase === "climax";
  });

  const meshMaterials = useMemo(() => ({
    build: new THREE.MeshBasicMaterial({
      color: "#61efff",
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    plasma: new THREE.MeshBasicMaterial({
      color: "#3978ff",
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    spark: new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    shard: new THREE.MeshBasicMaterial({
      color: "#b47cff",
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  }), []);

  useEffect(() => {
    if (disposalTimerRef.current !== null) {
      clearTimeout(disposalTimerRef.current);
      disposalTimerRef.current = null;
    }
    return () => {
      disposalTimerRef.current = setTimeout(() => {
        buildGeometry.dispose();
        plasmaGeometry.dispose();
        sparkGeometry.dispose();
        shardGeometry.dispose();
        Object.values(meshMaterials).forEach((material) => material.dispose());
        disposalTimerRef.current = null;
      }, 0);
    };
  }, [
    buildGeometry,
    meshMaterials,
    plasmaGeometry,
    shardGeometry,
    sparkGeometry,
  ]);

  return (
    <group>
      <mesh ref={haloRef} visible={false} renderOrder={30}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#3978ff"
          transparent
          opacity={0.2}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef} visible={false} renderOrder={31}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef} visible={false} renderOrder={29} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.06, 8, 64]} />
        <meshBasicMaterial
          color="#55e7ff"
          transparent
          opacity={0.9}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringSecondaryRef} visible={false} renderOrder={29} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.045, 8, 64]} />
        <meshBasicMaterial
          color="#b47cff"
          transparent
          opacity={0.65}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh ref={buildRef} args={[buildGeometry, meshMaterials.build, 20]} visible={false} frustumCulled={false} renderOrder={28} />
      <instancedMesh ref={plasmaRef} args={[plasmaGeometry, meshMaterials.plasma, 30]} visible={false} frustumCulled={false} renderOrder={28} />
      <instancedMesh ref={sparkRef} args={[sparkGeometry, meshMaterials.spark, 48]} visible={false} frustumCulled={false} renderOrder={28} />
      <instancedMesh ref={shardRef} args={[shardGeometry, meshMaterials.shard, 10]} visible={false} frustumCulled={false} renderOrder={28} />
    </group>
  );
}

export function OverchargedExplosionVFX({
  pool,
}: {
  pool: OverchargedExplosionPool;
}) {
  const preset = useGraphicsPreset();
  return (
    <group>
      {pool.slots.map((slot, index) => (
        <ExplosionSlotView key={index} slot={slot} preset={preset} />
      ))}
    </group>
  );
}