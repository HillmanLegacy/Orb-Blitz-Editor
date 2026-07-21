/**
 * StarBossTeleportVFX — star-themed 3D HD teleport visual for the Star Boss.
 *
 * Driven entirely by a shared mutable ref — no React state, no re-renders.
 * Both departure and arrival effects run concurrently via their own useFrame.
 *
 * Departure effect (0 → 1 over ~0.45 s):
 *   Gold star particles imploding inward + final white flash
 *
 * Arrival effect (0 → 1 over ~0.45 s):
 *   Gold star particles bursting outward + expanding sparkle ring + arrival flash
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface StarTeleportVFXState {
  /** Departure-effect world position */
  departurePos:      [number, number, number];
  /** 0 = inactive, 0→1 playing */
  departureProgress: number;
  /** Arrival-effect world position */
  arrivalPos:        [number, number, number];
  /** 0 = inactive, 0→1 playing */
  arrivalProgress:   number;
}

const DEP_COUNT = 80;   // departure implosion particles
const ARR_COUNT = 100;  // arrival burst particles

const _dummy = new THREE.Object3D();
const _col   = new THREE.Color();

function sr(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

// Star gold colour range: HSL 0.083 (amber) → 0.145 (near-white)
function goldHue(t: number) { return 0.083 + t * 0.062; }

interface PD {
  dir:   THREE.Vector3;
  speed: number;
  size:  number;
  delay: number;
  hue:   number;
}

// ── Departure component ────────────────────────────────────────────────────────

function DepartureVFX({
  vfxRef,
  scale,
}: {
  vfxRef: React.RefObject<StarTeleportVFXState>;
  scale:  number;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const flashRef  = useRef<THREE.Mesh>(null);

  const particles = useMemo<PD[]>(() => {
    // Particles start at a shell radius and implode inward
    return Array.from({ length: DEP_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / DEP_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        speed: (0.4 + sr(11, i * 4) * 0.9) * scale,
        size:  (0.04 + sr(11, i * 4 + 1) * 0.06) * scale,
        delay:  sr(11, i * 4 + 2) * 0.18,
        hue:   goldHue(sr(11, i * 4 + 3)),
      };
    });
  }, [scale]);

  useFrame(() => {
    if (!vfxRef.current) return;
    const p = vfxRef.current.departureProgress;

    // Position group at departure world pos
    if (groupRef.current) {
      const [x, y, z] = vfxRef.current.departurePos;
      groupRef.current.position.set(x, y, z);
      groupRef.current.visible = p > 0;
    }

    if (!meshRef.current) return;

    for (let i = 0; i < DEP_COUNT; i++) {
      const d      = particles[i];
      const localP = Math.max(0, (p - d.delay) / (1 - d.delay));
      if (localP <= 0 || p <= 0) {
        _dummy.scale.setScalar(0); _dummy.position.set(0, 0, 0);
        _dummy.updateMatrix(); meshRef.current.setMatrixAt(i, _dummy.matrix); continue;
      }
      // Implode: start far, rush inward
      const tEased  = 1 - Math.pow(1 - localP, 2); // ease-in
      const dist    = d.speed * (1 - tEased);        // shrinks to 0
      _dummy.position.set(d.dir.x * dist, d.dir.y * dist, d.dir.z * dist);
      const fade = Math.max(0, 1 - localP * 1.1);
      _dummy.scale.setScalar(Math.max(0.0001, d.size * fade));
      _dummy.updateMatrix(); meshRef.current.setMatrixAt(i, _dummy.matrix);
      _col.setHSL(d.hue, 1.0, 0.55 + (1 - localP) * 0.30);
      meshRef.current.setColorAt(i, _col);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    // Flash at the end
    if (flashRef.current) {
      const fl = p > 0.7 ? Math.max(0, 1 - (p - 0.7) / 0.3) * ((p - 0.7) / 0.3) * 4 : 0;
      flashRef.current.scale.setScalar(Math.max(0.0001, scale * 0.6 * fl));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fl * 0.9;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, DEP_COUNT]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#fffbe0" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Arrival component ──────────────────────────────────────────────────────────

function ArrivalVFX({
  vfxRef,
  scale,
}: {
  vfxRef: React.RefObject<StarTeleportVFXState>;
  scale:  number;
}) {
  const groupRef  = useRef<THREE.Group>(null);
  const burstRef  = useRef<THREE.InstancedMesh>(null);
  const ringRef   = useRef<THREE.Mesh>(null);
  const flashRef  = useRef<THREE.Mesh>(null);

  const particles = useMemo<PD[]>(() => {
    return Array.from({ length: ARR_COUNT }, (_, i) => {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / ARR_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      return {
        dir,
        speed: (0.5 + sr(31, i * 4) * 1.2) * scale,
        size:  (0.035 + sr(31, i * 4 + 1) * 0.065) * scale,
        delay:  sr(31, i * 4 + 2) * 0.12,
        hue:   goldHue(sr(31, i * 4 + 3)),
      };
    });
  }, [scale]);

  useFrame((state) => {
    if (!vfxRef.current) return;
    const p = vfxRef.current.arrivalProgress;

    if (groupRef.current) {
      const [x, y, z] = vfxRef.current.arrivalPos;
      groupRef.current.position.set(x, y, z);
      groupRef.current.visible = p > 0;
    }

    // Burst particles
    if (burstRef.current) {
      for (let i = 0; i < ARR_COUNT; i++) {
        const d      = particles[i];
        const localP = Math.max(0, (p - d.delay) / (1 - d.delay));
        if (localP <= 0 || p <= 0) {
          _dummy.scale.setScalar(0); _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix(); burstRef.current.setMatrixAt(i, _dummy.matrix); continue;
        }
        const dist = d.speed * (localP - localP * localP * 0.4);
        const grav = -0.3 * localP * localP * scale;
        _dummy.position.set(d.dir.x * dist, d.dir.y * dist + grav, d.dir.z * dist);
        const fade = Math.max(0, 1 - localP * 1.2);
        _dummy.scale.setScalar(Math.max(0.0001, d.size * fade));
        _dummy.updateMatrix(); burstRef.current.setMatrixAt(i, _dummy.matrix);
        _col.setHSL(d.hue, 1.0, 0.55 + (1 - localP) * 0.32);
        burstRef.current.setColorAt(i, _col);
      }
      burstRef.current.instanceMatrix.needsUpdate = true;
      if (burstRef.current.instanceColor) burstRef.current.instanceColor.needsUpdate = true;
    }

    // Expanding sparkle ring
    if (ringRef.current) {
      const ringScale = p * scale * 1.4;
      ringRef.current.scale.setScalar(Math.max(0.0001, ringScale));
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - p) * 0.85);
      // Slowly rotate around Y
      ringRef.current.rotation.y = state.clock.getElapsedTime() * 1.5;
    }

    // Arrival flash (bright at start, fades fast)
    if (flashRef.current) {
      const fl = p < 0.2 ? p / 0.2 : Math.max(0, 1 - (p - 0.2) / 0.4);
      flashRef.current.scale.setScalar(Math.max(0.0001, scale * 0.65 * fl));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fl * 0.95;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Burst particles */}
      <instancedMesh ref={burstRef} args={[undefined, undefined, ARR_COUNT]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      {/* Expanding gold ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.05, 8, 48]} />
        <meshBasicMaterial
          color="#ffdd44"
          transparent opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Arrival flash */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial
          color="#fffbe0"
          transparent opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
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
