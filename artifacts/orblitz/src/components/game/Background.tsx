/**
 * Background.tsx
 *
 * Module-level mutable arrays (orb positions, dust state) are intentional:
 * Background is a singleton in the game scene — one instance ever mounts.
 * These globals let ShootingOrbs write and SpaceDust read without React
 * context overhead. They are NOT safe for multiple Background instances.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Shooting-orb constants ────────────────────────────────────────────────────
const SHOOT_COLORS = [
  "#00ffff", "#ff00ff", "#ffff00", "#aa00ff",
  "#00ff88", "#ff8800", "#ffffff", "#00aaff",
];
const SHOOT_COUNT = 120;
const BX = 52;
const BY = 36;

// ── Orb→Dust communication buffers ───────────────────────────────────────────
// ShootingOrbs writes these at useFrame priority -1 (before SpaceDust at 0).
const _orbPosX = new Float32Array(SHOOT_COUNT);
const _orbPosY = new Float32Array(SHOOT_COUNT);
const _orbVelX = new Float32Array(SHOOT_COUNT);
const _orbVelY = new Float32Array(SHOOT_COUNT);

// ── Spatial grid for O(1) neighbor lookup ────────────────────────────────────
// Cell size must be ≥ interaction radius (4.5) so a 3×3 cell sweep is sufficient.
const CELL      = 5;
const GX_MIN    = -62;
const GY_MIN    = -46;
const GW        = Math.ceil(124 / CELL); // 25 columns
const GH        = Math.ceil(92  / CELL); // 19 rows
const _gridCells: number[][] = Array.from({ length: GW * GH }, () => []);

function _buildGrid(): void {
  for (let c = 0; c < _gridCells.length; c++) _gridCells[c].length = 0;
  for (let j = 0; j < SHOOT_COUNT; j++) {
    const cx = Math.floor((_orbPosX[j] - GX_MIN) / CELL);
    const cy = Math.floor((_orbPosY[j] - GY_MIN) / CELL);
    if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) {
      _gridCells[cy * GW + cx].push(j);
    }
  }
}

// ── Space-dust particle data (flat typed arrays for tight inner loop) ─────────
const DUST_COUNT      = 5000;
const DUST_BX         = 56;
const DUST_BY         = 40;
const ORB_INTERACT_R2 = 20.25; // interaction radius² = 4.5²

const _bx  = new Float32Array(DUST_COUNT); // rest X
const _by  = new Float32Array(DUST_COUNT); // rest Y
const _x   = new Float32Array(DUST_COUNT); // current X
const _y   = new Float32Array(DUST_COUNT); // current Y
const _vx  = new Float32Array(DUST_COUNT);
const _vy  = new Float32Array(DUST_COUNT);
const _z   = new Float32Array(DUST_COUNT); // fixed depth per particle
const _sz  = new Float32Array(DUST_COUNT); // base scale
const _ph  = new Float32Array(DUST_COUNT); // twinkle phase
const _tw  = new Float32Array(DUST_COUNT); // twinkle speed

// One-time module-load initialisation
;(() => {
  for (let i = 0; i < DUST_COUNT; i++) {
    const bx = (Math.random() - 0.5) * DUST_BX * 2;
    const by = (Math.random() - 0.5) * DUST_BY * 2;
    _bx[i] = bx;   _by[i] = by;
    _x[i]  = bx;   _y[i]  = by;
    _vx[i] = 0;    _vy[i] = 0;
    _z[i]  = -10 - Math.random() * 14;       // interleave with orb/star layers
    _sz[i] = 0.008 + Math.random() * 0.028;  // very tiny
    _ph[i] = Math.random() * Math.PI * 2;
    _tw[i] = 0.6   + Math.random() * 3.2;
  }
})();

// Reused dummy object for instance matrix writes
const _dummy = new THREE.Object3D();

// ── Distant star field ────────────────────────────────────────────────────────
function StarField() {
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);

  const stars = useMemo(() => Array.from({ length: 120 }, () => ({
    pos:   [
      (Math.random() - 0.5) * 90,
      (Math.random() - 0.5) * 65,
      -28 - Math.random() * 20,
    ] as [number, number, number],
    scale: 0.018 + Math.random() * 0.048,
    twink: 1.4  + Math.random() * 4.2,
    phase: Math.random() * Math.PI * 2,
  })), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    starRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
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
          ref={(el) => { starRefs.current[i] = el; }}
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

  const orbs = useMemo<ShootOrb[]>(() => Array.from({ length: SHOOT_COUNT }, (_, i) => {
    const dir    = Math.random() < 0.5 ? 1 : -1;
    const speed  = 9 + Math.random() * 16;
    const vAngle = (Math.random() - 0.5) * 0.35;
    return {
      x: (Math.random() - 0.5) * BX * 2,
      y: (Math.random() - 0.5) * BY * 2,
      z: -14 - Math.random() * 9,
      vx: Math.cos(vAngle) * speed * dir,
      vy: Math.sin(vAngle) * speed,
      color: SHOOT_COLORS[i % SHOOT_COLORS.length],
      size:  0.14 + Math.random() * 0.44,
      phase: Math.random() * Math.PI * 2,
      twink: 1.8 + Math.random() * 4.5,
    };
  }), []);

  const pos = useRef(orbs.map(o => ({ x: o.x, y: o.y })));

  // ── Priority -1: runs BEFORE SpaceDust (priority 0) each frame ───────────
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < orbs.length; i++) {
      const p   = pos.current[i];
      const orb = orbs[i];

      p.x += orb.vx * delta;
      p.y += orb.vy * delta;

      if (p.x >  BX) p.x = -BX;
      if (p.x < -BX) p.x =  BX;
      if (p.y >  BY) p.y = -BY;
      if (p.y < -BY) p.y =  BY;

      // Publish into shared buffers — SpaceDust reads these at priority 0
      _orbPosX[i] = p.x;
      _orbPosY[i] = p.y;
      _orbVelX[i] = orb.vx;
      _orbVelY[i] = orb.vy;

      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      mesh.position.x = p.x;
      mesh.position.y = p.y;

      const tw  = Math.sin(t * orb.twink + orb.phase) * 0.5 + 0.5;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + tw * 0.62;
      mesh.scale.setScalar(orb.size * (0.6 + tw * 0.4));
    }
  }, -1); // ← explicit priority; lower = earlier

  return (
    <>
      {orbs.map((orb, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          position={[orb.x, orb.y, orb.z]}
          scale={orb.size}
        >
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

// ── Space dust ────────────────────────────────────────────────────────────────
// Runs at default priority 0 — after ShootingOrbs (priority -1) has already
// written the current-frame orb positions into _orbPosX/_orbPosY.
function SpaceDust() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 3, 2), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.68, 0.82, 1.0),  // cold blue-white
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t  = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    // Build spatial grid from this frame's (already-written) orb positions
    _buildGrid();

    for (let i = 0; i < DUST_COUNT; i++) {
      let ax = 0;
      let ay = 0;

      // ── Spatial-grid neighbour lookup ─────────────────────────────────────
      // Clamp particle to grid bounds before computing cell index
      const pcx = Math.floor((_x[i] - GX_MIN) / CELL);
      const pcy = Math.floor((_y[i] - GY_MIN) / CELL);

      for (let dcx = -1; dcx <= 1; dcx++) {
        const nx = pcx + dcx;
        if (nx < 0 || nx >= GW) continue;
        for (let dcy = -1; dcy <= 1; dcy++) {
          const ny = pcy + dcy;
          if (ny < 0 || ny >= GH) continue;
          const cell = _gridCells[ny * GW + nx];
          for (let ci = 0; ci < cell.length; ci++) {
            const j  = cell[ci];
            const dx = _x[i] - _orbPosX[j];
            const dy = _y[i] - _orbPosY[j];
            const d2 = dx * dx + dy * dy;
            if (d2 < ORB_INTERACT_R2 && d2 > 0.0001) {
              const inv = 1.0 / Math.sqrt(d2);
              const str = 1.0 - d2 / ORB_INTERACT_R2;
              // Radial push away from orb
              ax += dx * inv * str * 6.0;
              ay += dy * inv * str * 6.0;
              // Entrainment: pick up a fraction of orb's velocity (wake effect)
              ax += _orbVelX[j] * str * 0.06;
              ay += _orbVelY[j] * str * 0.06;
            }
          }
        }
      }

      // ── Spring back to rest position ──────────────────────────────────────
      ax += (_bx[i] - _x[i]) * 2.2;
      ay += (_by[i] - _y[i]) * 2.2;

      // ── Integrate velocity + position ─────────────────────────────────────
      _vx[i] += ax * dt;
      _vy[i] += ay * dt;

      // Overdamped so particles settle without oscillating
      const damp = Math.max(0, 1.0 - 7.5 * dt);
      _vx[i] *= damp;
      _vy[i] *= damp;

      _x[i] += _vx[i] * dt;
      _y[i] += _vy[i] * dt;

      // ── Write instance matrix ─────────────────────────────────────────────
      const twink = 0.35 + 0.65 * (Math.sin(t * _tw[i] + _ph[i]) * 0.5 + 0.5);
      _dummy.position.set(_x[i], _y[i], _z[i]);
      _dummy.scale.setScalar(_sz[i] * twink);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }); // default priority 0 — after ShootingOrbs at -1

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, DUST_COUNT]}
    />
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function Background() {
  return (
    <>
      <color attach="background" args={[0, 0, 0]} />
      <StarField />
      <SpaceDust />
      <ShootingOrbs />
    </>
  );
}
