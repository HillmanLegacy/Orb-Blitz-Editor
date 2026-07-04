/**
 * FireExplosionVFX — defeat animation for the Fire Boss
 *
 * Layers (progress 0 → 1):
 *  0.00 – 0.50  Fire corona aura burst — 60 embers radiating outward (scaled-down boss aura)
 *  0.00 – 1.00  600 high-velocity fire particles (InstancedMesh, additive)
 *  0.00 – 0.80  16 mini fire-orb fragments — tiny versions of the boss, no hitboxes
 *  0.00 – 0.55  3 expanding shockwave rings (flattened torus, fading)
 *  0.10 – 0.70  Bright flash core
 *  0.50 – 1.00  Residual ember drift
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT   = 600;
const EMBER_COUNT      = 120;
const RING_COUNT       = 3;
const MINI_ORB_COUNT   = 16;   // mini-boss fragments — pure visual, no hitboxes
const CORONA_BURST_COUNT = 60; // scaled-down fire aura radiating at the start

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

// Mini-orb: larger, slower, looks like a tiny FireBoss sphere
interface MiniOrbDatum {
  dir:     THREE.Vector3;
  speed:   number;
  size:    number;
  delay:   number;
  hue:     number;    // fire palette: 0.0=red … 0.13=yellow
  spinRate: number;
}

// Corona burst: embers that radiate outward like the live boss aura
interface CoronaBurstDatum {
  angle:     number;  // horizontal spread angle
  elevation: number;  // vertical spread
  speed:     number;
  size:      number;
  delay:     number;
  hue:       number;
}

interface Props {
  progress: number;
  scale?:   number;
}

export function FireExplosionVFX({ progress, scale = 3.0 }: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // ── Mesh refs ──────────────────────────────────────────────────────────────
  const mainRef      = useRef<THREE.InstancedMesh>(null);
  const emberRef     = useRef<THREE.InstancedMesh>(null);
  const miniOrbRef   = useRef<THREE.InstancedMesh>(null);
  const coronaRef    = useRef<THREE.InstancedMesh>(null);
  const ringRefs     = useRef<(THREE.Mesh | null)[]>([]);
  const flashRef     = useRef<THREE.Mesh>(null);

  // ── Static particle data ───────────────────────────────────────────────────
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

  // Mini-orb fragments — 16 larger slow-moving spheres in fire palette.
  // They look like shattered copies of the FireBoss itself.
  const miniOrbs = useMemo<MiniOrbDatum[]>(() => {
    const list: MiniOrbDatum[] = [];
    for (let i = 0; i < MINI_ORB_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / MINI_ORB_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + seeded(42, i) * 1.5;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      list.push({
        dir,
        // Slower than main particles — they linger like real debris
        speed:    (0.4 + seeded(42, i * 5 + 1) * 0.7) * scale,
        // Noticeably larger: 0.25–0.42 of scale → visible as orbs, not dust
        size:     (0.25 + seeded(42, i * 5 + 2) * 0.17) * scale,
        delay:    seeded(42, i * 5 + 3) * 0.08,
        // Fire palette — stays in orange/red range to read as fire orbs
        hue:      seeded(42, i * 5 + 4) < 0.45 ? 0.0
                : seeded(42, i * 5 + 4) < 0.80 ? 0.06 : 0.12,
        // Each orb spins at a unique rate for visual life
        spinRate: (0.8 + seeded(42, i * 5) * 1.6) * (seeded(42, i + 77) > 0.5 ? 1 : -1),
      });
    }
    return list;
  }, [scale]);

  // Fire corona aura burst — 60 embers that radiate outward at the very start,
  // replicating the live FireBoss corona at reduced scale. Active 0 → 0.50.
  const coronaBurst = useMemo<CoronaBurstDatum[]>(() => {
    const list: CoronaBurstDatum[] = [];
    for (let i = 0; i < CORONA_BURST_COUNT; i++) {
      list.push({
        angle:     (i / CORONA_BURST_COUNT) * Math.PI * 2 + seeded(17, i) * 0.6,
        elevation: (seeded(17, i * 3 + 1) - 0.5) * Math.PI * 0.55,
        speed:     (0.5 + seeded(17, i * 3 + 2) * 0.9) * scale,
        size:      (0.04 + seeded(17, i * 3) * 0.08) * scale,
        delay:     seeded(17, i * 3 + 1) * 0.10,
        // Orange-to-yellow spread matching the live corona
        hue:       0.06 + seeded(17, i * 3 + 2) * 0.07,
      });
    }
    return list;
  }, [scale]);

  const ringDefs = useMemo(() => [
    { speed: 6.0, tube: 0.22, delay: 0.0,  tilt: 0 },
    { speed: 4.5, tube: 0.16, delay: 0.08, tilt: Math.PI / 6 },
    { speed: 3.2, tube: 0.12, delay: 0.16, tilt: -Math.PI / 5 },
  ], []);

  // ── Per-frame update ───────────────────────────────────────────────────────
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.getElapsedTime();

    // ── Main fire particles ────────────────────────────────────────────────
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

        const tp   = localP;
        const dist = d.speed * (tp - tp * tp * 0.5);
        const grav = -d.gravity * tp * tp * 0.5;

        _dummy.position.set(d.dir.x * dist, d.dir.y * dist + grav, d.dir.z * dist);
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

    // ── Fire corona aura burst (progress 0 → 0.55) ────────────────────────
    // Replicates the live FireBoss ember corona at the moment of death.
    if (coronaRef.current) {
      const coronaActive = p < 0.55;
      for (let i = 0; i < CORONA_BURST_COUNT; i++) {
        const c      = coronaBurst[i];
        const localP = Math.max(0, (p - c.delay) / Math.max(0.001, 0.55 - c.delay));

        if (!coronaActive || localP <= 0) {
          _dummy.scale.setScalar(0);
          _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix();
          coronaRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        // Embers radiate outward from the boss center
        const dist = c.speed * localP * 0.55;
        const cx   = Math.cos(c.angle) * Math.cos(c.elevation) * dist;
        const cy   = Math.sin(c.elevation) * dist + localP * localP * 0.4 * scale; // upward drift
        const cz   = Math.sin(c.angle) * Math.cos(c.elevation) * dist;

        _dummy.position.set(cx, cy, cz);
        const fade = Math.max(0, 1 - localP * 1.6);
        _dummy.scale.setScalar(c.size * fade);
        _dummy.updateMatrix();
        coronaRef.current.setMatrixAt(i, _dummy.matrix);

        // orange → yellow, same palette as the live corona
        color.setHSL(c.hue - localP * 0.04, 1.0, 0.52 + localP * 0.25);
        coronaRef.current.setColorAt(i, color);
      }
      coronaRef.current.instanceMatrix.needsUpdate = true;
      if (coronaRef.current.instanceColor) coronaRef.current.instanceColor.needsUpdate = true;
    }

    // ── Mini fire-orb fragments (progress 0 → 0.85) ───────────────────────
    // Larger, slower-moving spheres that look like shattered mini FireBoss copies.
    // Pure visual — no game logic or hitboxes.
    if (miniOrbRef.current) {
      for (let i = 0; i < MINI_ORB_COUNT; i++) {
        const o      = miniOrbs[i];
        const activeEnd = 0.85;
        const localP = Math.max(0, (p - o.delay) / (activeEnd - o.delay));

        if (localP <= 0 || p > activeEnd) {
          _dummy.scale.setScalar(0);
          _dummy.position.set(0, 0, 0);
          _dummy.updateMatrix();
          miniOrbRef.current.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        // Quadratic ease-out — starts fast, drifts to a stop
        const eased = localP * (2 - localP);
        const dist  = o.speed * eased * 0.65;
        const grav  = -0.35 * localP * localP * scale; // gentle fall

        _dummy.position.set(
          o.dir.x * dist,
          o.dir.y * dist + grav,
          o.dir.z * dist,
        );

        // Spin on Y gives each orb a sense of being its own entity
        _dummy.rotation.y = t * o.spinRate;
        _dummy.rotation.z = t * o.spinRate * 0.4;

        // Fade out in the last 30% of its lifetime
        const fade = Math.max(0, 1 - Math.max(0, localP - 0.70) / 0.30);
        _dummy.scale.setScalar(Math.max(0.001, o.size * fade));
        _dummy.updateMatrix();
        miniOrbRef.current.setMatrixAt(i, _dummy.matrix);

        // Fire color — cycles from orange-red at birth toward yellow-orange at peak
        // then dims to deep-red at extinction (matches the full-size boss color ramp)
        const brightness = 0.50 + (1 - localP) * 0.32;
        color.setHSL(o.hue + localP * 0.04, 1.0, brightness);
        miniOrbRef.current.setColorAt(i, color);
      }
      miniOrbRef.current.instanceMatrix.needsUpdate = true;
      if (miniOrbRef.current.instanceColor) miniOrbRef.current.instanceColor.needsUpdate = true;
    }

    // ── Ember drift (residual, after 50%) ──────────────────────────────────
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

        _dummy.position.set(d.dir.x * dist, d.dir.y * dist + grav, d.dir.z * dist);
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

    // ── Shockwave rings ────────────────────────────────────────────────────
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

    // ── Flash core ─────────────────────────────────────────────────────────
    if (flashRef.current) {
      const flashLocal = p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.1) / 0.55);
      flashRef.current.scale.setScalar(scale * 0.9 * flashLocal);
      const mat = flashRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = flashLocal * 0.95;
    }
  });

  return (
    <group>
      {/* Fire corona aura burst — scaled-down version of the live boss corona */}
      <instancedMesh ref={coronaRef} args={[undefined, undefined, CORONA_BURST_COUNT]}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

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

      {/* Mini fire-orb fragments — larger spheres that look like tiny FireBoss copies.
          Pure VFX — no game collision or damage, just visual debris. */}
      <instancedMesh ref={miniOrbRef} args={[undefined, undefined, MINI_ORB_COUNT]}>
        <sphereGeometry args={[1, 8, 6]} />
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
