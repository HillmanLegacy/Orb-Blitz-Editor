/**
 * StarSupernovaVFX — defeat animation for the Star Boss (level 2.9).
 *
 * Layers (progress 0 → 1, totalTime ≈ 4.0 s driven by boss.destroyTimer):
 *  0.00 – 0.15  Blinding gold-white flash core
 *  0.00 – 0.60  Shockwave ring — flat torus expanding outward
 *  0.00 – 0.55  60 corona embers radiating outward (star sparkle colours)
 *  0.00 – 1.00  600 main particles (deep amber → gold → bright gold → white)
 *  0.02 – 0.80  14 star-fragment shards (octahedrons, spinning outward)
 *  0.50 – 1.00  80 residual sparkle drifters
 *  0.00 – 1.00  Point-light pulse fading from intense gold to dim
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Counts ─────────────────────────────────────────────────────────────────────
const PARTICLE_COUNT  = 600;
const CORONA_COUNT    =  60;
const SHARD_COUNT     =  14;
const SPARKLE_COUNT   =  80;

const _dummy   = new THREE.Object3D();
const _col     = new THREE.Color();

function sr(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

// ── Star colour palette ────────────────────────────────────────────────────────
// Matches MiniStarOrb shader:
//   deep amber  HSL ≈ 0.083   (0.55, 0.28, 0.00)
//   gold        HSL ≈ 0.118   (0.95, 0.68, 0.00)
//   bright gold HSL ≈ 0.138   (1.00, 0.92, 0.30)
//   near-white  HSL ≈ 0.145   (1.00, 1.00, 0.95)
function starHue(t: number): number {
  // 0 = deep amber (0.083), 1 = near-white (0.145)
  return 0.083 + t * 0.062;
}

// ── Particle datum ─────────────────────────────────────────────────────────────
interface PD {
  dir:    THREE.Vector3;
  speed:  number;
  size:   number;
  delay:  number;
  hue:    number;
}

// ── Shard datum ────────────────────────────────────────────────────────────────
interface SD {
  dir:      THREE.Vector3;
  spinAxis: THREE.Vector3;
  speed:    number;
  size:     number;
  delay:    number;
  spinRate: number;
  hue:      number;
}

interface Props {
  progress: number;
  scale?:   number;
}

export function StarSupernovaVFX({ progress, scale = 3.2 }: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const mainRef     = useRef<THREE.InstancedMesh>(null);
  const coronaRef   = useRef<THREE.InstancedMesh>(null);
  const shardRef    = useRef<THREE.InstancedMesh>(null);
  const sparkleRef  = useRef<THREE.InstancedMesh>(null);
  const flashRef    = useRef<THREE.Mesh>(null);
  const ringRef     = useRef<THREE.Mesh>(null);
  const lightRef    = useRef<THREE.PointLight>(null);

  // ── Static particle data ──────────────────────────────────────────────────
  const particles = useMemo<PD[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + sr(7, i) * 2.0;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const t = sr(7, i * 4 + 3); // 0=deep, 1=bright
      return {
        dir,
        speed: (0.7 + sr(7, i * 4) * 2.4) * scale,
        size:  (0.025 + sr(7, i * 4 + 1) * 0.07) * scale,
        delay:  sr(7, i * 4 + 2) * 0.14,
        hue:   starHue(t * t),  // bias toward amber
      };
    });
  }, [scale]);

  const coronaEmbers = useMemo<PD[]>(() => {
    return Array.from({ length: CORONA_COUNT }, (_, i) => {
      const angle = (i / CORONA_COUNT) * Math.PI * 2 + sr(17, i) * 0.5;
      const elev  = (sr(17, i * 3 + 1) - 0.5) * Math.PI * 0.5;
      const dir   = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elev),
        Math.sin(elev),
        Math.sin(angle) * Math.cos(elev),
      ).normalize();
      return {
        dir,
        speed: (0.4 + sr(17, i * 3 + 2) * 0.8) * scale,
        size:  (0.045 + sr(17, i * 3) * 0.09) * scale,
        delay:  sr(17, i * 3 + 1) * 0.08,
        hue:   starHue(0.3 + sr(17, i) * 0.7),
      };
    });
  }, [scale]);

  const shards = useMemo<SD[]>(() => {
    return Array.from({ length: SHARD_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / SHARD_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const spinAxis = new THREE.Vector3(sr(42, i), sr(42, i + 14), sr(42, i + 28)).normalize();
      return {
        dir,
        spinAxis,
        speed:    (0.5 + sr(42, i * 5 + 1) * 0.6) * scale,
        size:     (0.28 + sr(42, i * 5 + 2) * 0.18) * scale,
        delay:    sr(42, i * 5 + 3) * 0.06,
        spinRate: (0.9 + sr(42, i * 5) * 1.8) * (sr(42, i + 77) > 0.5 ? 1 : -1),
        hue:      starHue(sr(42, i * 5 + 4)),
      };
    });
  }, [scale]);

  const sparkles = useMemo<PD[]>(() => {
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
      const phi   = Math.acos(2 * sr(99, i * 3) - 1);
      const theta = 2 * Math.PI * sr(99, i * 3 + 1);
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) + 0.3,
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        speed: (0.25 + sr(99, i * 4) * 0.55) * scale,
        size:  (0.018 + sr(99, i * 4 + 1) * 0.038) * scale,
        delay:  0.45 + sr(99, i * 4 + 2) * 0.15,
        hue:   starHue(0.5 + sr(99, i) * 0.5),
      };
    });
  }, [scale]);

  // ── Per-frame ─────────────────────────────────────────────────────────────
  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.getElapsedTime();

    // Main particles
    if (mainRef.current) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const d      = particles[i];
        const localP = Math.max(0, (p - d.delay) / (1 - d.delay));
        if (localP <= 0) {
          _dummy.scale.setScalar(0); _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix(); mainRef.current.setMatrixAt(i, _dummy.matrix); continue;
        }
        const dist = d.speed * (localP - localP * localP * 0.45);
        const grav = -0.5 * localP * localP * scale;
        _dummy.position.set(d.dir.x * dist, d.dir.y * dist + grav, d.dir.z * dist);
        const fade = Math.max(0, 1 - localP * 1.15);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * fade));
        _dummy.updateMatrix(); mainRef.current.setMatrixAt(i, _dummy.matrix);
        _col.setHSL(d.hue, 1.0, 0.50 + (1 - localP) * 0.38);
        mainRef.current.setColorAt(i, _col);
      }
      mainRef.current.instanceMatrix.needsUpdate = true;
      if (mainRef.current.instanceColor) mainRef.current.instanceColor.needsUpdate = true;
    }

    // Corona embers (active 0 → 0.58)
    if (coronaRef.current) {
      const coronaEnd = 0.58;
      for (let i = 0; i < CORONA_COUNT; i++) {
        const d      = coronaEmbers[i];
        const localP = Math.max(0, (p - d.delay) / Math.max(0.001, coronaEnd - d.delay));
        if (localP <= 0 || p > coronaEnd) {
          _dummy.scale.setScalar(0); _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix(); coronaRef.current.setMatrixAt(i, _dummy.matrix); continue;
        }
        const dist = d.speed * localP * 0.55;
        _dummy.position.set(d.dir.x * dist, d.dir.y * dist + localP * localP * 0.35 * scale, d.dir.z * dist);
        const fade = Math.max(0, 1 - localP * 1.7);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * fade));
        _dummy.updateMatrix(); coronaRef.current.setMatrixAt(i, _dummy.matrix);
        _col.setHSL(d.hue, 1.0, 0.52 + localP * 0.28);
        coronaRef.current.setColorAt(i, _col);
      }
      coronaRef.current.instanceMatrix.needsUpdate = true;
      if (coronaRef.current.instanceColor) coronaRef.current.instanceColor.needsUpdate = true;
    }

    // Star-fragment shards (active 0.02 → 0.82)
    if (shardRef.current) {
      const shardEnd = 0.82;
      for (let i = 0; i < SHARD_COUNT; i++) {
        const o      = shards[i];
        const localP = Math.max(0, (p - o.delay) / (shardEnd - o.delay));
        if (localP <= 0 || p > shardEnd) {
          _dummy.scale.setScalar(0); _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix(); shardRef.current.setMatrixAt(i, _dummy.matrix); continue;
        }
        const eased = localP * (2 - localP);
        const dist  = o.speed * eased * 0.65;
        const grav  = -0.28 * localP * localP * scale;
        _dummy.position.set(o.dir.x * dist, o.dir.y * dist + grav, o.dir.z * dist);
        _dummy.setRotationFromAxisAngle(o.spinAxis, t * o.spinRate);
        const fade = Math.max(0, 1 - Math.max(0, localP - 0.72) / 0.28);
        _dummy.scale.setScalar(Math.max(0.0001, o.size * fade));
        _dummy.updateMatrix(); shardRef.current.setMatrixAt(i, _dummy.matrix);
        const brightness = 0.50 + (1 - localP) * 0.35;
        _col.setHSL(o.hue + localP * 0.02, 1.0, brightness);
        shardRef.current.setColorAt(i, _col);
      }
      shardRef.current.instanceMatrix.needsUpdate = true;
      if (shardRef.current.instanceColor) shardRef.current.instanceColor.needsUpdate = true;
    }

    // Residual sparkle drift (active 0.48+)
    if (sparkleRef.current) {
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const d      = sparkles[i];
        const localP = Math.max(0, (p - d.delay) / (1 - d.delay));
        if (localP <= 0 || p < 0.44) {
          _dummy.scale.setScalar(0); _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix(); sparkleRef.current.setMatrixAt(i, _dummy.matrix); continue;
        }
        const dist = d.speed * localP * 0.7;
        const grav = -1.4 * localP * localP * 0.4;
        _dummy.position.set(d.dir.x * dist, d.dir.y * dist + grav, d.dir.z * dist);
        const fade = Math.max(0, 1 - localP * 1.5);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * fade));
        _dummy.updateMatrix(); sparkleRef.current.setMatrixAt(i, _dummy.matrix);
        _col.setHSL(d.hue, 1.0, 0.65 + Math.sin(t * 12 + i) * 0.12);
        sparkleRef.current.setColorAt(i, _col);
      }
      sparkleRef.current.instanceMatrix.needsUpdate = true;
      if (sparkleRef.current.instanceColor) sparkleRef.current.instanceColor.needsUpdate = true;
    }

    // Flash core (0 → 0.18 in, fade to 0 by 0.65)
    if (flashRef.current) {
      const fl = p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.1) / 0.52);
      flashRef.current.scale.setScalar(scale * 1.1 * fl);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fl * 0.98;
    }

    // Shockwave ring (0 → 1, expands + fades)
    if (ringRef.current) {
      const ringScale = p * scale * 1.8;
      ringRef.current.scale.setScalar(Math.max(0.0001, ringScale));
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p) * 0.7);
    }

    // Point light
    if (lightRef.current) {
      const lp = Math.max(0, 1 - p * 1.2);
      lightRef.current.intensity = 60 * lp;
      lightRef.current.color.setHSL(starHue(0.5), 1.0, 0.65);
    }
  });

  return (
    <group>
      {/* Gold-white flash core */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#fff8c0"
          transparent opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Shockwave ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.04, 8, 64]} />
        <meshBasicMaterial
          color="#ffdd44"
          transparent opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main particles */}
      <instancedMesh ref={mainRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Corona embers */}
      <instancedMesh ref={coronaRef} args={[undefined, undefined, CORONA_COUNT]}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Star-fragment shards — HD octahedrons */}
      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_COUNT]}>
        <octahedronGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Residual sparkles */}
      <instancedMesh ref={sparkleRef} args={[undefined, undefined, SPARKLE_COUNT]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Pulsing point light */}
      <pointLight ref={lightRef} color="#ffdd44" intensity={60} distance={30} decay={2} />
    </group>
  );
}
