/**
 * StarBossTeleportVFX — AAA-quality 3D teleport visual for the Star Boss.
 *
 * Driven entirely by a shared mutable ref — no React state, no re-renders.
 *
 * ── Departure (0 → 1, 0.55 s) ───────────────────────────────────────────────
 *   120 particles spiral-vortex inward (not just linear implosion)
 *   12 energy tendrils contracting toward center (LineSegments, updating buffer)
 *   Expanding pressure shockwave ring (boss "winds up")
 *   Contracting inner energy ring with counter-rotation
 *   Void singularity sphere growing at center
 *   Bright white implosion flash at end
 *
 * ── Arrival (0 → 1, 0.55 s) ─────────────────────────────────────────────────
 *   10 jagged dimensional rift cracks radiating from center (LineSegments)
 *   150 spiral burst particles with helical trajectories
 *   40 slow ember drift particles drifting upward like cinders
 *   Three staggered shockwave rings (immediate / +0.12s / +0.22s)
 *   Vertical light beam / materialisation column
 *   Bright arrival flash at the start
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Public interface (unchanged — Boss.tsx writes into this) ──────────────────

export interface StarTeleportVFXState {
  departurePos:      [number, number, number];
  departureProgress: number;
  arrivalPos:        [number, number, number];
  arrivalProgress:   number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEP_COUNT   = 120;  // vortex spiral implosion particles
const ARR_COUNT   = 150;  // helical burst particles
const EMB_COUNT   = 40;   // slow ember cinder drift
const TEND_COUNT  = 12;   // departure energy tendrils
const CRACK_COUNT = 10;   // arrival rift fracture cracks

const TWO_PI = Math.PI * 2;

// ── Module-level scratch objects (never re-created) ──────────────────────────

const _dummy = new THREE.Object3D();
const _col   = new THREE.Color();

// ── Utilities ────────────────────────────────────────────────────────────────

/** Seeded pseudo-random [0,1) — stable across renders */
function sr(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

function easeInCubic(t: number)  { return t * t * t; }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeOutExpo(t: number)  { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

/** Full HSL for a particle: deep amber → bright gold-white */
function goldHSL(t: number): [number, number, number] {
  return [0.083 + t * 0.057, 1.0, 0.45 + t * 0.35];
}

/** HSL that shifts from electric cyan-blue to warm gold */
function cyanToGoldHSL(p: number): [number, number, number] {
  return [0.55 - p * 0.44, 1.0, 0.65];
}

// ── Shared particle-data types ────────────────────────────────────────────────

interface VortexParticle {
  dir:         THREE.Vector3;
  startDist:   number;
  size:        number;
  delay:       number;
  hsl:         [number, number, number];
  spiralSpeed: number;
}

interface BurstParticle {
  dir:         THREE.Vector3;
  speed:       number;
  size:        number;
  delay:       number;
  hsl:         [number, number, number];
  spiralSpeed: number;
}

interface EmberParticle {
  x:     number;
  z:     number;
  speed: number;
  size:  number;
  delay: number;
  hsl:   [number, number, number];
}

// ── Departure VFX ─────────────────────────────────────────────────────────────

function DepartureVFX({
  vfxRef,
  scale,
}: {
  vfxRef: React.RefObject<StarTeleportVFXState>;
  scale:  number;
}) {
  const groupRef     = useRef<THREE.Group>(null);
  const vortexRef    = useRef<THREE.InstancedMesh>(null);
  const tendrilsRef  = useRef<THREE.LineSegments>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const voidRef      = useRef<THREE.Mesh>(null);
  const flashRef     = useRef<THREE.Mesh>(null);

  // Vortex spiral particles — Fibonacci sphere distribution
  const vortexParticles = useMemo<VortexParticle[]>(() => (
    Array.from({ length: DEP_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / DEP_COUNT);
      const theta = TWO_PI * (1 + Math.sqrt(5)) * i;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        startDist:   (0.8 + sr(11, i * 6)     * 1.2) * scale,
        size:        (0.03 + sr(11, i * 6 + 1) * 0.07) * scale,
        delay:       sr(11, i * 6 + 2) * 0.22,
        hsl:         goldHSL(sr(11, i * 6 + 3)),
        spiralSpeed: 1.5 + sr(11, i * 6 + 4) * 4.5, // 1.5–6 full rotations
      };
    })
  ), [scale]);

  // Energy tendril positions — TEND_COUNT lines, 2 vertices each = 6 floats/tendril
  const tendrilGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TEND_COUNT * 6), 3));
    return geo;
  }, []);

  const tendrilDirs = useMemo<THREE.Vector3[]>(() => (
    Array.from({ length: TEND_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / TEND_COUNT);
      const theta = TWO_PI * (1 + Math.sqrt(5)) * i;
      return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) * 0.6,  // slightly flatten vertically for visual spread
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
    })
  ), []);

  useFrame(() => {
    if (!vfxRef.current) return;
    const p = vfxRef.current.departureProgress;

    if (groupRef.current) {
      const [x, y, z] = vfxRef.current.departurePos;
      groupRef.current.position.set(x, y, z);
      groupRef.current.visible = p > 0;
    }
    if (p <= 0) return;

    // ── Vortex spiral particles ─────────────────────────────────────────────
    if (vortexRef.current) {
      for (let i = 0; i < DEP_COUNT; i++) {
        const d      = vortexParticles[i];
        const localP = Math.max(0, Math.min(1, (p - d.delay) / (1 - d.delay)));

        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          vortexRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        // Spiral inward: shrink radius while rotating around Y axis
        const radius     = d.startDist * (1 - easeInCubic(localP));
        const spinAngle  = localP * d.spiralSpeed * TWO_PI;
        const cosS = Math.cos(spinAngle);
        const sinS = Math.sin(spinAngle);
        // Rotate dir.x/dir.z by spinAngle, keep dir.y
        const rx = d.dir.x * cosS - d.dir.z * sinS;
        const ry = d.dir.y;
        const rz = d.dir.x * sinS + d.dir.z * cosS;

        _dummy.position.set(rx * radius, ry * radius, rz * radius);

        // Pulsing size: grows then shrinks fast as they implode
        const pulse = localP < 0.35
          ? localP / 0.35
          : Math.max(0, 1 - (localP - 0.35) / 0.65);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * pulse * 1.3));
        _dummy.rotation.set(spinAngle * 2.1, spinAngle * 1.4, spinAngle * 0.8);
        _dummy.updateMatrix();
        vortexRef.current.setMatrixAt(i, _dummy.matrix);

        const [h, s, l] = d.hsl;
        _col.setHSL(h, s, Math.min(0.95, l + easeInCubic(localP) * 0.25));
        vortexRef.current.setColorAt(i, _col);
      }
      vortexRef.current.instanceMatrix.needsUpdate = true;
      if (vortexRef.current.instanceColor) vortexRef.current.instanceColor.needsUpdate = true;
    }

    // ── Energy tendrils ─────────────────────────────────────────────────────
    if (tendrilsRef.current) {
      const posAttr = tendrilGeo.attributes.position as THREE.BufferAttribute;
      const arr     = posAttr.array as Float32Array;

      for (let i = 0; i < TEND_COUNT; i++) {
        const td = tendrilDirs[i];
        // Outer end retreats toward center as p increases (boss is absorbing energy)
        const maxLen  = (1.4 + sr(21, i) * 0.9) * scale;
        const outerP  = Math.max(0, 1 - easeInCubic(Math.min(1, p * 1.1)));
        const outerLen = maxLen * outerP;

        // Inner vertex — always at center
        arr[i * 6 + 0] = 0;
        arr[i * 6 + 1] = 0;
        arr[i * 6 + 2] = 0;
        // Outer vertex — contracts in
        arr[i * 6 + 3] = td.x * outerLen;
        arr[i * 6 + 4] = td.y * outerLen;
        arr[i * 6 + 5] = td.z * outerLen;
      }
      posAttr.needsUpdate = true;

      const mat = tendrilsRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, (1 - easeOutCubic(p)) * 0.92);
    }

    // ── Outer pressure ring (expands outward as boss winds up) ──────────────
    if (outerRingRef.current) {
      const rp = Math.min(1, p * 1.9);
      // This is the Star Boss absorption circle. Keep the rest of the
      // teleport VFX unchanged while reducing this ring by two-thirds.
      outerRingRef.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 0.8));
      (outerRingRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - rp) * 0.75);
    }

    // ── Inner contracting ring (counter-rotates, collapses inward) ──────────
    if (innerRingRef.current) {
      const rp = Math.min(1, p * 1.3);
      const s  = Math.max(0.0001, (1 - easeInCubic(rp)) * scale * 1.1);
      innerRingRef.current.scale.setScalar(s);
      innerRingRef.current.rotation.y = p * TWO_PI * -2.5;
      const op = rp < 0.45 ? rp / 0.45 : Math.max(0, 1 - (rp - 0.45) / 0.55);
      (innerRingRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.85;
    }

    // ── Void singularity at center ──────────────────────────────────────────
    if (voidRef.current) {
      const vp = Math.min(1, p * 1.6);
      voidRef.current.scale.setScalar(Math.max(0.0001, easeOutCubic(vp) * scale * 0.28));
      const op = p < 0.85 ? Math.min(0.95, vp * 0.88) : Math.max(0, (1 - p) / 0.15) * 0.88;
      (voidRef.current.material as THREE.MeshBasicMaterial).opacity = op;
    }

    // ── Implosion flash (sine-burst at the very end) ─────────────────────────
    if (flashRef.current) {
      const fl = p > 0.78 ? Math.sin(((p - 0.78) / 0.22) * Math.PI) : 0;
      flashRef.current.scale.setScalar(Math.max(0.0001, scale * 1.0 * fl));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fl * 0.97;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Vortex spiral particles */}
      <instancedMesh ref={vortexRef} args={[undefined, undefined, DEP_COUNT]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Energy tendrils (LineSegments with dynamic buffer) */}
      <lineSegments ref={tendrilsRef} geometry={tendrilGeo}>
        <lineBasicMaterial
          color="#ffcc44"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Outer pressure shockwave ring */}
      <mesh ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.045, 8, 64]} />
        <meshBasicMaterial color="#ffee88" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Inner contracting energy ring */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 3, 0.4, 0]}>
        <torusGeometry args={[1, 0.08, 8, 48]} />
        <meshBasicMaterial color="#ffaa22" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Void singularity */}
      <mesh ref={voidRef}>
        <sphereGeometry args={[1, 16, 12]} />
        {/* Not additive — it's a dark sphere that occludes */}
        <meshBasicMaterial color="#0a0008" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Implosion flash */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#fffef0" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Arrival VFX ───────────────────────────────────────────────────────────────

function ArrivalVFX({
  vfxRef,
  scale,
}: {
  vfxRef: React.RefObject<StarTeleportVFXState>;
  scale:  number;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const burstRef  = useRef<THREE.InstancedMesh>(null);
  const emberRef  = useRef<THREE.InstancedMesh>(null);
  const cracksRef = useRef<THREE.LineSegments>(null);
  const ring1Ref  = useRef<THREE.Mesh>(null);
  const ring2Ref  = useRef<THREE.Mesh>(null);
  const ring3Ref  = useRef<THREE.Mesh>(null);
  const beamRef   = useRef<THREE.Mesh>(null);
  const flashRef  = useRef<THREE.Mesh>(null);

  // Helical burst particles
  const burstParticles = useMemo<BurstParticle[]>(() => (
    Array.from({ length: ARR_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / ARR_COUNT);
      const theta = TWO_PI * (1 + Math.sqrt(5)) * i;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        speed:       (0.7 + sr(31, i * 6)     * 1.4) * scale,
        size:        (0.025 + sr(31, i * 6 + 1) * 0.075) * scale,
        delay:       sr(31, i * 6 + 2) * 0.18,
        hsl:         goldHSL(sr(31, i * 6 + 3)),
        spiralSpeed: 1.2 + sr(31, i * 6 + 4) * 3.8,
      };
    })
  ), [scale]);

  // Slow ember cinders drifting upward
  const emberParticles = useMemo<EmberParticle[]>(() => (
    Array.from({ length: EMB_COUNT }, (_, i) => {
      const angle  = (i / EMB_COUNT) * TWO_PI + sr(41, i) * 0.6;
      const radius = (0.15 + sr(41, i + 1) * 0.65) * scale;
      return {
        x:     Math.cos(angle) * radius,
        z:     Math.sin(angle) * radius,
        speed: (0.5 + sr(41, i + 2) * 0.7) * scale,
        size:  (0.02 + sr(41, i + 3) * 0.045) * scale,
        delay: 0.18 + sr(41, i + 4) * 0.45,
        hsl:   [0.075 + sr(41, i + 5) * 0.05, 1.0, 0.48 + sr(41, i + 6) * 0.22] as [number, number, number],
      };
    })
  ), [scale]);

  // Rift crack geometry — CRACK_COUNT cracks × 2 segments each × 4 vertices × 3 floats
  const crackGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // 2 LineSegments per crack = 4 vertices = 12 floats per crack
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CRACK_COUNT * 12), 3));
    return geo;
  }, []);

  const crackDirs = useMemo(() => (
    Array.from({ length: CRACK_COUNT }, (_, i) => {
      const angle = (i / CRACK_COUNT) * TWO_PI + sr(51, i) * 0.35;
      const elev  = (sr(51, i + 1) - 0.5) * 0.5;
      return {
        main:   new THREE.Vector3(Math.cos(angle), elev, Math.sin(angle)).normalize(),
        // Jagged mid-point offsets for fracture look
        jagX:   (sr(51, i + 2) - 0.5) * 0.55,
        jagY:   (sr(51, i + 3) - 0.5) * 0.25,
        jagZ:   (sr(51, i + 4) - 0.5) * 0.55,
        maxLen: (1.1 + sr(51, i + 5) * 1.2) * scale,
        delay:  sr(51, i + 6) * 0.1,
      };
    })
  ), [scale]);

  useFrame(() => {
    if (!vfxRef.current) return;
    const p = vfxRef.current.arrivalProgress;

    if (groupRef.current) {
      const [x, y, z] = vfxRef.current.arrivalPos;
      groupRef.current.position.set(x, y, z);
      groupRef.current.visible = p > 0;
    }
    if (p <= 0) return;

    // ── Arrival flash ───────────────────────────────────────────────────────
    if (flashRef.current) {
      const fl = p < 0.18 ? p / 0.18 : Math.max(0, 1 - (p - 0.18) / 0.38);
      flashRef.current.scale.setScalar(Math.max(0.0001, scale * 0.95 * fl));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fl * 0.98;
    }

    // ── Dimensional rift cracks ─────────────────────────────────────────────
    if (cracksRef.current) {
      const posAttr = crackGeo.attributes.position as THREE.BufferAttribute;
      const arr     = posAttr.array as Float32Array;

      for (let i = 0; i < CRACK_COUNT; i++) {
        const cd      = crackDirs[i];
        const localP  = Math.max(0, (p - cd.delay) / 0.28);
        const extP    = Math.min(1, localP);
        // Cracks extend fast, then fade slowly
        const fadeP   = p > 0.38 ? Math.max(0, 1 - (p - 0.38) / 0.28) : 1;
        const len     = cd.maxLen * extP * fadeP;
        const midLen  = len * 0.5;

        // Seg 1: center → jagged midpoint
        arr[i * 12 +  0] = 0;
        arr[i * 12 +  1] = 0;
        arr[i * 12 +  2] = 0;
        arr[i * 12 +  3] = cd.main.x * midLen + cd.jagX * len * 0.28;
        arr[i * 12 +  4] = cd.main.y * midLen + cd.jagY * len * 0.28;
        arr[i * 12 +  5] = cd.main.z * midLen + cd.jagZ * len * 0.28;

        // Seg 2: jagged midpoint → outer tip
        arr[i * 12 +  6] = cd.main.x * midLen + cd.jagX * len * 0.28;
        arr[i * 12 +  7] = cd.main.y * midLen + cd.jagY * len * 0.28;
        arr[i * 12 +  8] = cd.main.z * midLen + cd.jagZ * len * 0.28;
        arr[i * 12 +  9] = cd.main.x * len;
        arr[i * 12 + 10] = cd.main.y * len;
        arr[i * 12 + 11] = cd.main.z * len;
      }
      posAttr.needsUpdate = true;

      const mat = cracksRef.current.material as THREE.LineBasicMaterial;
      // Fade: flash in then fade out
      mat.opacity = p < 0.38
        ? Math.min(1, p / 0.1) * 0.88
        : Math.max(0, 1 - (p - 0.38) / 0.28) * 0.88;
      // Color shifts electric cyan → gold over the life of the effect
      const [ch, cs, cl] = cyanToGoldHSL(Math.min(1, p / 0.35));
      mat.color.setHSL(ch, cs, cl);
    }

    // ── Helical burst particles ─────────────────────────────────────────────
    if (burstRef.current) {
      for (let i = 0; i < ARR_COUNT; i++) {
        const d      = burstParticles[i];
        const localP = Math.max(0, Math.min(1, (p - d.delay) / (1 - d.delay)));

        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          burstRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        // Spiral outward: increasing radius + rotation
        const dist      = d.speed * (localP - localP * localP * 0.38);
        const spinAngle = localP * d.spiralSpeed * TWO_PI;
        const cosS = Math.cos(spinAngle);
        const sinS = Math.sin(spinAngle);
        const rx = d.dir.x * cosS - d.dir.z * sinS;
        const ry = d.dir.y;
        const rz = d.dir.x * sinS + d.dir.z * cosS;
        // Light gravity pull
        const grav = -0.22 * localP * localP * scale;

        _dummy.position.set(rx * dist, ry * dist + grav, rz * dist);
        const fade = Math.max(0, 1 - localP * 1.18);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * fade * (1 + easeOutExpo(localP) * 0.35)));
        _dummy.rotation.set(spinAngle * 2.0, spinAngle * 0.9, spinAngle * 1.5);
        _dummy.updateMatrix();
        burstRef.current.setMatrixAt(i, _dummy.matrix);

        const [h, s, l] = d.hsl;
        _col.setHSL(h, s, Math.max(0.3, l - localP * 0.12));
        burstRef.current.setColorAt(i, _col);
      }
      burstRef.current.instanceMatrix.needsUpdate = true;
      if (burstRef.current.instanceColor) burstRef.current.instanceColor.needsUpdate = true;
    }

    // ── Ember drift (slow cinders floating upward) ──────────────────────────
    if (emberRef.current) {
      for (let i = 0; i < EMB_COUNT; i++) {
        const e      = emberParticles[i];
        const localP = Math.max(0, Math.min(1, (p - e.delay) / (1 - e.delay)));

        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          emberRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        _dummy.position.set(e.x, localP * e.speed, e.z);
        const fade = Math.max(0, 1 - localP * 1.35);
        _dummy.scale.setScalar(Math.max(0.0001, e.size * fade));
        _dummy.updateMatrix();
        emberRef.current.setMatrixAt(i, _dummy.matrix);

        const [h, s, l] = e.hsl;
        _col.setHSL(h, s, l);
        emberRef.current.setColorAt(i, _col);
      }
      emberRef.current.instanceMatrix.needsUpdate = true;
      if (emberRef.current.instanceColor) emberRef.current.instanceColor.needsUpdate = true;
    }

    // ── Triple staggered shockwave rings ────────────────────────────────────
    // Ring 1 — immediate, thick, gold
    if (ring1Ref.current) {
      const rp = Math.min(1, p * 2.3);
      ring1Ref.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 2.1));
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - rp) * 0.92);
    }
    // Ring 2 — delayed +0.12 s, medium, warm
    if (ring2Ref.current) {
      const rp = Math.max(0, Math.min(1, (p - 0.12) * 2.0));
      ring2Ref.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 2.7));
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - rp) * 0.72);
    }
    // Ring 3 — delayed +0.22 s, slow, large, white
    if (ring3Ref.current) {
      const rp = Math.max(0, Math.min(1, (p - 0.22) * 1.55));
      ring3Ref.current.scale.setScalar(Math.max(0.0001, easeOutExpo(rp) * scale * 3.5));
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - rp) * 0.48);
    }

    // ── Vertical materialisation light beam ─────────────────────────────────
    if (beamRef.current) {
      const beamFade = p < 0.16 ? p / 0.16 : Math.max(0, 1 - (p - 0.16) / 0.42);
      beamRef.current.visible = beamFade > 0.005;
      (beamRef.current.material as THREE.MeshBasicMaterial).opacity = beamFade * 0.32;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Arrival flash */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#fffef0" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Dimensional rift cracks (LineSegments with dynamic buffer) */}
      <lineSegments ref={cracksRef} geometry={crackGeo}>
        <lineBasicMaterial
          color="#aaddff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Helical burst particles */}
      <instancedMesh ref={burstRef} args={[undefined, undefined, ARR_COUNT]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Ember drift (tetrahedra for visual variety) */}
      <instancedMesh ref={emberRef} args={[undefined, undefined, EMB_COUNT]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Shockwave ring 1 — immediate, thick gold */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.065, 8, 64]} />
        <meshBasicMaterial color="#ffcc22" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Shockwave ring 2 — delayed, medium, warm */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.038, 8, 64]} />
        <meshBasicMaterial color="#ffee88" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Shockwave ring 3 — slow, large, white (tilted slightly for depth) */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 2.2, 0.35, 0]}>
        <torusGeometry args={[1, 0.022, 8, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Vertical materialisation beam (cone: narrow top, wide base) */}
      <mesh ref={beamRef} position={[0, 4 * scale, 0]}>
        <cylinderGeometry args={[0.04, 0.55 * scale, 8 * scale, 8, 1, true]} />
        <meshBasicMaterial
          color="#ffe888"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Public component ───────────────────────────────────────────────────────────

interface Props {
  vfxRef: React.RefObject<StarTeleportVFXState>;
  scale?: number;
}

export function StarBossTeleportVFX({ vfxRef, scale = 1.8 }: Props) {
  return (
    <>
      <DepartureVFX vfxRef={vfxRef} scale={scale} />
      <ArrivalVFX   vfxRef={vfxRef} scale={scale} />
    </>
  );
}
