/**
 * CrystalCrackExplosionVFX — AAA defeat animation for the Crystal Boss (level 3.9).
 *
 * Driven by a `progress` prop (0 → 1 over 3.5 s, externally timed by Boss.tsx).
 *
 * Phases
 *  0.00 – 0.58  Crystal body (low-poly dodecahedron) tremors and darkens
 *  0.00 – 0.50  18 jagged crack lines extend outward from the boss surface
 *  0.42 – 0.65  Shatter flash (bright white-cyan sphere)
 *  0.50 – 1.00  22 crystal chunks fly outward, spin, arc with gravity
 *  0.50 – 0.92  100 crystal-dust particles burst then drift
 *  0.50 – 0.88  60 prismatic sparkles (additive, hue-shifting)
 *  0.52 – 1.00  3 staggered shockwave rings (cyan → aqua → white)
 *  0.50 – 1.00  Residual cyan point light fades out
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Constants ────────────────────────────────────────────────────────────────

const CHUNK_COUNT  = 22;
const DUST_COUNT   = 100;
const SPARK_COUNT  = 60;
const CRACK_COUNT  = 18;
const TWO_PI       = Math.PI * 2;

// ── Module-level scratch objects ─────────────────────────────────────────────

const _dummy = new THREE.Object3D();
const _q     = new THREE.Quaternion();
const _col   = new THREE.Color();
const _axis  = new THREE.Vector3();

// ── Utilities ────────────────────────────────────────────────────────────────

function sr(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeOutExpo(t: number)  { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

// ── Crystal colour palette — 7 distinct ice/cyan tones ──────────────────────

const PALETTE: [number, number, number][] = [
  [0.53, 0.90, 0.70], // ice blue
  [0.47, 1.00, 0.50], // pure cyan
  [0.50, 0.80, 0.82], // aqua-white
  [0.55, 1.00, 0.68], // electric blue
  [0.45, 0.70, 0.87], // pale teal
  [0.52, 1.00, 0.92], // near-white blue
  [0.49, 0.90, 0.58], // deep teal
];

// ── Static data types ────────────────────────────────────────────────────────

interface ChunkDatum {
  dir:      THREE.Vector3;
  spinAxis: THREE.Vector3;
  speed:    number;
  size:     number;
  delay:    number;
  hsl:      [number, number, number];
  spinRate: number;
}

interface DustDatum {
  dir:   THREE.Vector3;
  speed: number;
  size:  number;
  delay: number;
  hsl:   [number, number, number];
}

interface CrackDatum {
  main:   THREE.Vector3;
  jagX:   number;
  jagY:   number;
  jagZ:   number;
  maxLen: number;
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  progress: number;
  scale?:   number;
}

export function CrystalCrackExplosionVFX({ progress, scale = 1 }: Props) {
  // Use a ref so useFrame always sees the latest progress without stale closure
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const bodyGroupRef = useRef<THREE.Group>(null);
  const bodyMeshRef  = useRef<THREE.Mesh>(null);
  const cracksRef    = useRef<THREE.LineSegments>(null);
  const flashRef     = useRef<THREE.Mesh>(null);

  const chunksRef = useRef<THREE.InstancedMesh>(null);
  const dustRef   = useRef<THREE.InstancedMesh>(null);
  const sparkRef  = useRef<THREE.InstancedMesh>(null);

  const ring1Ref  = useRef<THREE.Mesh>(null);
  const ring2Ref  = useRef<THREE.Mesh>(null);
  const ring3Ref  = useRef<THREE.Mesh>(null);
  const lightRef  = useRef<THREE.PointLight>(null);

  // ── Static particle data (computed once per mount) ────────────────────────

  // Boss radius constant (matches CrystalBoss radius prop = 1.44, scaled)
  const BOSS_R = 1.44 * 0.65; // ~0.94 world units at scale=1

  const chunks = useMemo<ChunkDatum[]>(() => (
    Array.from({ length: CHUNK_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / CHUNK_COUNT);
      const theta = TWO_PI * (1 + Math.sqrt(5)) * i;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const spinAxis = new THREE.Vector3(
        sr(71, i * 4)     * 2 - 1,
        sr(71, i * 4 + 1) * 2 - 1,
        sr(71, i * 4 + 2) * 2 - 1,
      ).normalize();
      return {
        dir,
        spinAxis,
        speed:    (0.8 + sr(71, i * 6 + 3) * 1.5) * scale,
        size:     (0.13 + sr(71, i * 6 + 4) * 0.20) * scale,
        delay:    sr(71, i * 6 + 5) * 0.12,
        hsl:      PALETTE[i % PALETTE.length],
        spinRate: (2.5 + sr(71, i * 6) * 7) * (sr(71, i) > 0.5 ? 1 : -1),
      };
    })
  ), [scale]);

  const dusts = useMemo<DustDatum[]>(() => (
    Array.from({ length: DUST_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / DUST_COUNT);
      const theta = TWO_PI * (1 + Math.sqrt(5)) * i + sr(81, i) * 1.5;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        speed: (0.35 + sr(81, i * 5 + 1) * 1.2) * scale,
        size:  (0.014 + sr(81, i * 5 + 2) * 0.026) * scale,
        delay: sr(81, i * 5 + 3) * 0.22,
        hsl:   PALETTE[(i * 3) % PALETTE.length],
      };
    })
  ), [scale]);

  // Crack geometry — CRACK_COUNT × 2 segments = 4 vertices = 12 floats per crack
  const crackGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CRACK_COUNT * 12), 3));
    return geo;
  }, []);

  const crackData = useMemo<CrackDatum[]>(() => (
    Array.from({ length: CRACK_COUNT }, (_, i) => {
      const angle = (i / CRACK_COUNT) * TWO_PI + sr(61, i) * 0.45;
      const elev  = (sr(61, i + 1) - 0.5) * 0.75;
      return {
        main:   new THREE.Vector3(Math.cos(angle), elev, Math.sin(angle)).normalize(),
        jagX:   (sr(61, i + 2) - 0.5) * 0.65,
        jagY:   (sr(61, i + 3) - 0.5) * 0.30,
        jagZ:   (sr(61, i + 4) - 0.5) * 0.65,
        maxLen: (0.85 + sr(61, i + 5) * 0.90) * scale,
      };
    })
  ), [scale]);

  // ── Frame loop ────────────────────────────────────────────────────────────

  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.getElapsedTime();

    // ── 1. Crystal body + tremor (0 → 0.58) ─────────────────────────────────
    if (bodyGroupRef.current) {
      const bodyVisible = p < 0.60;
      bodyGroupRef.current.visible = bodyVisible;
      if (bodyVisible) {
        // Tremor amplitude grows with damage taken
        const tremorAmp = Math.min(p / 0.45, 1) * 0.25 * scale;
        bodyGroupRef.current.position.set(
          Math.sin(t * 47.0) * tremorAmp,
          Math.cos(t * 41.0) * tremorAmp,
          Math.sin(t * 31.0) * tremorAmp * 0.5,
        );
        if (bodyMeshRef.current) {
          const mat = bodyMeshRef.current.material as THREE.MeshBasicMaterial;
          // Ice-blue → darkens as cracks advance
          const darken = Math.min(1, p / 0.55);
          mat.color.setHSL(0.53, 0.85, Math.max(0.08, 0.68 - darken * 0.60));
          // Fade out right before the shatter flash peaks
          mat.opacity = Math.max(0, 1 - Math.max(0, (p - 0.44) / 0.16));
        }
      }
    }

    // ── 2. Crack lines (0 → 0.50) ───────────────────────────────────────────
    if (cracksRef.current) {
      const crackP  = Math.min(1, p / 0.50);
      const posAttr = crackGeo.attributes.position as THREE.BufferAttribute;
      const arr     = posAttr.array as Float32Array;
      const bossR   = BOSS_R * scale;

      for (let i = 0; i < CRACK_COUNT; i++) {
        const cd = crackData[i];
        // Cracks start at the boss surface and extend outward
        const startLen = bossR;
        const len      = bossR + cd.maxLen * easeOutCubic(crackP);
        const midLen   = (startLen + len) * 0.5;
        const jagScale = (len - startLen) * 0.32;

        // Seg 1: surface → jagged midpoint
        arr[i * 12 +  0] = cd.main.x * startLen;
        arr[i * 12 +  1] = cd.main.y * startLen;
        arr[i * 12 +  2] = cd.main.z * startLen;
        arr[i * 12 +  3] = cd.main.x * midLen + cd.jagX * jagScale;
        arr[i * 12 +  4] = cd.main.y * midLen + cd.jagY * jagScale;
        arr[i * 12 +  5] = cd.main.z * midLen + cd.jagZ * jagScale;

        // Seg 2: jagged midpoint → outer tip
        arr[i * 12 +  6] = cd.main.x * midLen + cd.jagX * jagScale;
        arr[i * 12 +  7] = cd.main.y * midLen + cd.jagY * jagScale;
        arr[i * 12 +  8] = cd.main.z * midLen + cd.jagZ * jagScale;
        arr[i * 12 +  9] = cd.main.x * len;
        arr[i * 12 + 10] = cd.main.y * len;
        arr[i * 12 + 11] = cd.main.z * len;
      }
      posAttr.needsUpdate = true;

      const crackMat = cracksRef.current.material as THREE.LineBasicMaterial;
      // Fade in fast, then fade out as body shatters
      crackMat.opacity = p < 0.46
        ? Math.min(1, crackP * 2.0) * 0.95
        : Math.max(0, 1 - (p - 0.46) / 0.14) * 0.95;
    }

    // ── 3. Shatter flash (0.42 → 0.65) ──────────────────────────────────────
    if (flashRef.current) {
      const inRange = p >= 0.42 && p <= 0.65;
      const fl = inRange ? Math.sin(((p - 0.42) / 0.23) * Math.PI) : 0;
      flashRef.current.scale.setScalar(Math.max(0.0001, scale * 1.35 * fl));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fl * 0.97;
    }

    // ── 4. Crystal chunks (0.50 → 1.0) ──────────────────────────────────────
    if (chunksRef.current) {
      for (let i = 0; i < CHUNK_COUNT; i++) {
        const c      = chunks[i];
        const localP = Math.max(0, Math.min(1, (p - 0.50 - c.delay) / 0.50));

        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          chunksRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        // Arc: burst outward with gravity pull-down
        const dist = c.speed * localP * (1 - localP * 0.32);
        const grav = -0.60 * localP * localP * scale;
        _dummy.position.set(
          c.dir.x * dist,
          c.dir.y * dist + grav,
          c.dir.z * dist,
        );

        // Spin on random axis
        _axis.copy(c.spinAxis);
        _q.setFromAxisAngle(_axis, localP * c.spinRate);
        _dummy.quaternion.copy(_q);

        // Shrink at end
        const sizeFade = localP > 0.80 ? Math.max(0, 1 - (localP - 0.80) / 0.20) : 1;
        _dummy.scale.setScalar(Math.max(0.0001, c.size * sizeFade));
        _dummy.updateMatrix();
        chunksRef.current.setMatrixAt(i, _dummy.matrix);

        const [h, s, l] = c.hsl;
        _col.setHSL(h, s, l);
        chunksRef.current.setColorAt(i, _col);
      }
      chunksRef.current.instanceMatrix.needsUpdate = true;
      if (chunksRef.current.instanceColor) chunksRef.current.instanceColor.needsUpdate = true;
    }

    // ── 5. Crystal dust (0.50 → 0.92) ────────────────────────────────────────
    if (dustRef.current) {
      for (let i = 0; i < DUST_COUNT; i++) {
        const d      = dusts[i];
        const localP = Math.max(0, Math.min(1, (p - 0.50 - d.delay) / 0.42));

        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          dustRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        const dist = d.speed * (localP - localP * localP * 0.42);
        const grav = -0.18 * localP * localP * scale;
        _dummy.position.set(
          d.dir.x * dist,
          d.dir.y * dist + grav,
          d.dir.z * dist,
        );
        _dummy.rotation.set(0, 0, 0);
        const fade = Math.max(0, 1 - localP * 1.08);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * fade));
        _dummy.updateMatrix();
        dustRef.current.setMatrixAt(i, _dummy.matrix);

        const [h, s, l] = d.hsl;
        _col.setHSL(h, s, Math.min(0.95, l + (1 - localP) * 0.12));
        dustRef.current.setColorAt(i, _col);
      }
      dustRef.current.instanceMatrix.needsUpdate = true;
      if (dustRef.current.instanceColor) dustRef.current.instanceColor.needsUpdate = true;
    }

    // ── 6. Prismatic sparkles (0.50 → 0.88) ─────────────────────────────────
    if (sparkRef.current) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const delay  = sr(91, i * 4 + 3) * 0.22;
        const localP = Math.max(0, Math.min(1, (p - 0.50 - delay) / 0.38));

        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          sparkRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        const phi   = Math.acos(1 - 2 * (i + 0.5) / SPARK_COUNT);
        const theta = TWO_PI * (1 + Math.sqrt(5)) * i;
        const speed = (1.1 + sr(91, i * 4 + 1) * 2.8) * scale;
        const dist  = speed * localP * (1 - localP * 0.5);
        _dummy.position.set(
          Math.sin(phi) * Math.cos(theta) * dist,
          Math.cos(phi) * dist,
          Math.sin(phi) * Math.sin(theta) * dist,
        );
        _dummy.rotation.set(0, 0, 0);
        const fade = Math.max(0, 1 - localP * 1.32);
        _dummy.scale.setScalar(Math.max(0.0001, (0.012 + sr(91, i * 4 + 2) * 0.028) * scale * fade));
        _dummy.updateMatrix();
        sparkRef.current.setMatrixAt(i, _dummy.matrix);

        // Prismatic hue cycles through the crystal spectrum
        const sparkHue = (0.47 + localP * 0.22 + i * 0.018) % 1.0;
        _col.setHSL(sparkHue, 1.0, 0.72 + fade * 0.22);
        sparkRef.current.setColorAt(i, _col);
      }
      sparkRef.current.instanceMatrix.needsUpdate = true;
      if (sparkRef.current.instanceColor) sparkRef.current.instanceColor.needsUpdate = true;
    }

    // ── 7. Staggered shockwave rings (0.52 → 1.0) ───────────────────────────
    if (ring1Ref.current) {
      const rp = Math.max(0, Math.min(1, (p - 0.52) * 2.3));
      ring1Ref.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 2.4));
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - rp) * 0.92);
    }
    if (ring2Ref.current) {
      const rp = Math.max(0, Math.min(1, (p - 0.62) * 1.95));
      ring2Ref.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 3.1));
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - rp) * 0.72);
    }
    if (ring3Ref.current) {
      const rp = Math.max(0, Math.min(1, (p - 0.72) * 1.55));
      ring3Ref.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 4.0));
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - rp) * 0.50);
    }

    // ── 8. Residual cyan glow (0.50 → 1.0) ──────────────────────────────────
    if (lightRef.current) {
      const lp = Math.max(0, (p - 0.50) / 0.50);
      lightRef.current.intensity = Math.max(0, (1 - lp) * 20);
    }
  });

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Cracking body — low-poly dodecahedron that tremors */}
      <group ref={bodyGroupRef}>
        <mesh ref={bodyMeshRef}>
          {/* Dodecahedron = 12 pentagonal faces → rocky/faceted crystal look */}
          <dodecahedronGeometry args={[BOSS_R * scale, 0]} />
          <meshBasicMaterial
            color="#bfedff"
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>

        {/* Crack lines: grow from surface outward */}
        <lineSegments ref={cracksRef} geometry={crackGeo}>
          <lineBasicMaterial
            color="#aaffee"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      </group>

      {/* Shatter flash */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#dfffff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Crystal chunks — solid dodecahedra in crystal palette colors */}
      <instancedMesh ref={chunksRef} args={[undefined, undefined, CHUNK_COUNT]}>
        <dodecahedronGeometry args={[1, 0]} />
        {/* Non-additive: chunks are solid opaque pieces */}
        <meshBasicMaterial transparent opacity={1} depthWrite={false} />
      </instancedMesh>

      {/* Crystal dust — small additive icosahedra */}
      <instancedMesh ref={dustRef} args={[undefined, undefined, DUST_COUNT]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Prismatic sparkles — tiny sphere dots */}
      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARK_COUNT]}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Shockwave ring 1 — immediate, thick, cyan */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.06, 8, 64]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Shockwave ring 2 — delayed, medium, aqua */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.038, 8, 64]} />
        <meshBasicMaterial color="#aaffee" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Shockwave ring 3 — slow, large, white (tilted for depth) */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 2.2, 0.35, 0]}>
        <torusGeometry args={[1, 0.022, 8, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Residual cyan glow light */}
      <pointLight ref={lightRef} color="#00ffcc" intensity={0} distance={28} decay={2} />
    </>
  );
}
