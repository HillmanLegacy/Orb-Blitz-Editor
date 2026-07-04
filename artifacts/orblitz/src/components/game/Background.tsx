import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Distant star field ────────────────────────────────────────────────────────
function StarField() {
  const starRefs = useRef<THREE.Mesh[]>([]);

  const stars = useMemo(() => Array.from({ length: 120 }, () => ({
    pos:   [(Math.random() - 0.5) * 90, (Math.random() - 0.5) * 65, -28 - Math.random() * 20] as [number, number, number],
    scale: 0.018 + Math.random() * 0.048,
    twink: 1.4 + Math.random() * 4.2,
    phase: Math.random() * Math.PI * 2,
  })), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    starRefs.current.forEach((mesh, i) => {
      if (!mesh || !stars[i]) return;
      const s     = stars[i];
      const twink = Math.sin(t * s.twink + s.phase) * 0.5 + 0.5;
      mesh.scale.setScalar(s.scale * (0.3 + twink * 0.7));
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + twink * 0.72;
    });
  });

  return (
    <>
      {stars.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) starRefs.current[i] = el; }}
          position={s.pos}
          scale={s.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Shooting-star orbs ────────────────────────────────────────────────────────
// High-density orbs that streak across the background, matching the palette
// and feel of the tap-to-start startup animation orbs.
const SHOOT_COLORS = [
  "#00ffff", "#ff00ff", "#ffff00", "#aa00ff",
  "#00ff88", "#ff8800", "#ffffff", "#00aaff",
];

const SHOOT_COUNT = 120;

// X bounds for the wide background plane (same range as star field).
const BX = 52;
const BY = 36;

interface ShootOrb {
  x: number; y: number; z: number;
  vx: number; vy: number;
  color: string;
  size: number;
  phase: number;
  twink: number;
}

function ShootingOrbs() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Static orb descriptors — velocity, colour, size, depth, twinkle phase.
  const orbs = useMemo<ShootOrb[]>(() => {
    return Array.from({ length: SHOOT_COUNT }, (_, i) => {
      // Shoot mostly horizontally (left⟷right) with gentle vertical drift.
      const dir    = Math.random() < 0.5 ? 1 : -1;
      const speed  = 9 + Math.random() * 16;
      const vAngle = (Math.random() - 0.5) * 0.35; // small off-axis angle
      return {
        // Scatter across the full background plane on first frame.
        x: (Math.random() - 0.5) * BX * 2,
        y: (Math.random() - 0.5) * BY * 2,
        z: -14 - Math.random() * 9,           // behind gameplay, in front of stars
        vx: Math.cos(vAngle) * speed * dir,
        vy: Math.sin(vAngle) * speed,
        color: SHOOT_COLORS[i % SHOOT_COLORS.length],
        size:  0.07 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        twink: 1.8 + Math.random() * 4.5,
      };
    });
  }, []);

  // Mutable live positions stored outside React so we avoid re-renders.
  const pos = useRef(orbs.map(o => ({ x: o.x, y: o.y })));

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < orbs.length; i++) {
      const p   = pos.current[i];
      const orb = orbs[i];

      p.x += orb.vx * delta;
      p.y += orb.vy * delta;

      // Wrap horizontally / vertically so orbs continuously stream across.
      if (p.x >  BX) p.x = -BX;
      if (p.x < -BX) p.x =  BX;
      if (p.y >  BY) p.y = -BY;
      if (p.y < -BY) p.y =  BY;

      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      mesh.position.x = p.x;
      mesh.position.y = p.y;

      // Pulsing glow — each orb breathes independently.
      const tw  = Math.sin(t * orb.twink + orb.phase) * 0.5 + 0.5;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + tw * 0.62;
      mesh.scale.setScalar(orb.size * (0.6 + tw * 0.4));
    }
  });

  return (
    <>
      {orbs.map((orb, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          position={[orb.x, orb.y, orb.z]}
          scale={orb.size}
        >
          {/* Low-poly sphere keeps draw cost minimal at this density */}
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial
            color={orb.color}
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function Background() {
  return (
    <>
      <color attach="background" args={[0, 0, 0]} />
      <StarField />
      <ShootingOrbs />
    </>
  );
}
