/**
 * FireExplosionVFX — defeat animation for the Fire Boss
 *
 * Layers (progress 0 → 1):
 *  0.00 – 1.00  600 high-velocity fire particles (InstancedMesh, additive)
 *  0.00 – 0.55  3 expanding shockwave rings (flattened torus, fading)
 *  0.10 – 0.70  Bright flash core
 *  0.50 – 1.00  Residual ember drift
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT  = 600;
const EMBER_COUNT     = 120;
const RING_COUNT      = 3;

const _dummy = new THREE.Object3D();

function seeded(seed: number, i: number) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface ParticleDatum {
  dir:      THREE.Vector3;
  speed:    number;
  size:     number;
  delay:    number;
  gravity:  number;
  hue:      number;   // 0=red, 0.08=orange, 0.15=yellow
}

interface Props {
  progress: number;
  scale?:   number;
}

export function FireExplosionVFX({ progress, scale = 3.0 }: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // ── Particle mesh refs ───────────────────────────────────────────────────
  const mainRef  = useRef<THREE.InstancedMesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flashRef = useRef<THREE.Mesh>(null);

  // ── Static particle data ─────────────────────────────────────────────────
  const particles = useMemo<ParticleDatum[]>(() => {
    const list: ParticleDatum[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + seeded(7, i) * 2.0;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      list.push({
        dir,
        speed:   (0.8 + seeded(7, i * 4) * 2.2) * scale,
        size:    (0.03 + seeded(7, i * 4 + 1) * 0.07) * scale,
        delay:   seeded(7, i * 4 + 2) * 0.12,
        gravity: 0.6 + seeded(7, i * 4 + 3) * 0.8,
        hue:     seeded(7, i * 4 + 3) < 0.5 ? 0.0 : seeded(7, i * 4 + 3) < 0.8 ? 0.07 : 0.13,
      });
    }
    return list;
  }, [scale]);

  const embers = useMemo<ParticleDatum[]>(() => {
    const list: ParticleDatum[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      const phi   = Math.acos(2 * seeded(99, i * 3) - 1);
      const theta = 2 * Math.PI * seeded(99, i * 3 + 1);
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi) + 0.4,
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      list.push({
        dir,
        speed:   (0.3 + seeded(99, i * 4) * 0.6) * scale,
        size:    (0.02 + seeded(99, i * 4 + 1) * 0.04) * scale,
        delay:   0.45 + seeded(99, i * 4 + 2) * 0.15,
        gravity: 1.5 + seeded(99, i * 4 + 3) * 1.0,
        hue:     0.07 + seeded(99, i * 4 + 3) * 0.08,
      });
    }
    return list;
  }, [scale]);

  const ringDefs = useMemo(() => [
    { speed: 6.0, tube: 0.22, delay: 0.0,  tilt: 0 },
    { speed: 4.5, tube: 0.16, delay: 0.08, tilt: Math.PI / 6 },
    { speed: 3.2, tube: 0.12, delay: 0.16, tilt: -Math.PI / 5 },
  ], []);

  // ── Per-frame update ─────────────────────────────────────────────────────
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const p = progressRef.current;

    // ── Main fire particles ──────────────────────────────────────────────
    if (mainRef.current) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const d = particles[i];
        const localP = Math.max(0, (p - d.delay) / (1 - d.delay));
        if (localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix();
          mainRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        // Decelerate: quadratic ease-out
        const t   = localP;
        const dist = d.speed * (t - t * t * 0.5);
        // Arc down: gravity
        const grav = -d.gravity * t * t * 0.5;

        _dummy.position.set(
          d.dir.x * dist,
          d.dir.y * dist + grav,
          d.dir.z * dist,
        );
        const fade = Math.max(0, 1 - localP * 1.2);
        _dummy.scale.setScalar(d.size * fade);
        _dummy.updateMatrix();
        mainRef.current.setMatrixAt(i, _dummy.matrix);

        color.setHSL(d.hue, 1.0, 0.55 + (1 - localP) * 0.3);
        mainRef.current.setColorAt(i, color);
      }
      mainRef.current.instanceMatrix.needsUpdate = true;
      if (mainRef.current.instanceColor) mainRef.current.instanceColor.needsUpdate = true;
    }

    // ── Ember drift (residual, after 50%) ────────────────────────────────
    if (emberRef.current) {
      for (let i = 0; i < EMBER_COUNT; i++) {
        const d = embers[i];
        const localP = Math.max(0, (p - d.delay) / (1 - d.delay));
        if (localP <= 0 || p < 0.45) {
          _dummy.scale.setScalar(0);
          _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix();
          emberRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        const dist = d.speed * localP * 0.7;
        const grav = -d.gravity * localP * localP * 0.4;

        _dummy.position.set(
          d.dir.x * dist,
          d.dir.y * dist + grav,
          d.dir.z * dist,
        );
        const fade = Math.max(0, 1 - localP * 1.4);
        _dummy.scale.setScalar(d.size * fade);
        _dummy.updateMatrix();
        emberRef.current.setMatrixAt(i, _dummy.matrix);

        color.setHSL(d.hue, 1.0, 0.6);
        emberRef.current.setColorAt(i, color);
      }
      emberRef.current.instanceMatrix.needsUpdate = true;
      if (emberRef.current.instanceColor) emberRef.current.instanceColor.needsUpdate = true;
    }

    // ── Shockwave rings ──────────────────────────────────────────────────
    ringRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const def   = ringDefs[i];
      const local = Math.max(0, p - def.delay);
      const r     = local * def.speed * scale;
      const fade  = Math.max(0, 1 - local * 2.2);

      mesh.scale.set(r, 1, r);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = fade * 0.85;
      mesh.rotation.x = Math.PI / 2 + def.tilt;
    });

    // ── Flash core ───────────────────────────────────────────────────────
    if (flashRef.current) {
      const flashLocal = p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.1) / 0.55);
      flashRef.current.scale.setScalar(scale * 0.9 * flashLocal);
      const mat = flashRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = flashLocal * 0.95;
    }
  });

  return (
    <group>
      {/* Main fire burst */}
      <instancedMesh ref={mainRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 4, 3]} />
        <meshBasicMaterial
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Residual embers */}
      <instancedMesh ref={emberRef} args={[undefined, undefined, EMBER_COUNT]}>
        <sphereGeometry args={[1, 4, 3]} />
        <meshBasicMaterial
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Shockwave rings — flattened torus */}
      {ringDefs.map((def, i) => (
        <mesh
          key={i}
          ref={(el) => { ringRefs.current[i] = el; }}
          rotation={[Math.PI / 2 + def.tilt, 0, 0]}
        >
          <torusGeometry args={[1, def.tube, 8, 48]} />
          <meshBasicMaterial
            color="#ff5500"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Flash core */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#ffeeaa"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
