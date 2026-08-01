import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── Constants ─────────────────────────────────────────────────────────────────
const FIELD_RADIUS    = 5;
const TOTAL_DUR       = 5.0;
const N_FIELD         = 220;       // electric particles filling the field volume
const SPARKS_PER      = 6;         // sparks around each caught enemy
const MAX_ENEMY_SLOTS = 20;        // max enemies shown with sparks
const N_SPARK_SLOTS   = MAX_ENEMY_SLOTS * SPARKS_PER;  // 120

// ── Shared geometry & materials (module-level, never recreated) ───────────────
const _pGeo      = new THREE.SphereGeometry(0.055, 4, 4);
const _sGeo      = new THREE.SphereGeometry(0.045, 4, 4);
const _dummy     = new THREE.Object3D();
const _fieldMat  = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true,
});
const _sparkMat  = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true,
});

// ── Field particle seeds ──────────────────────────────────────────────────────
// Uniform-in-sphere: r = R * cbrt(u), direction from spherical coords
const _fSeeds = Array.from({ length: N_FIELD }, (_, i) => {
  const u     = Math.random();
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = FIELD_RADIUS * 0.91 * Math.cbrt(u);
  return {
    bx:       r * Math.sin(phi) * Math.cos(theta),
    by:       r * Math.sin(phi) * Math.sin(theta),
    bz:       (Math.random() - 0.5) * 0.35,  // small Z; game is 2D
    phase:    (i / N_FIELD) * Math.PI * 2 + Math.random(),
    flickHz:  7  + Math.random() * 16,        // fast flicker: 7–23 Hz
    jAmt:     0.10 + Math.random() * 0.20,    // high-freq jitter amplitude
    driftAmt: 0.35 + Math.random() * 0.50,    // low-freq drift amplitude
    driftHz:  0.8 + Math.random() * 1.8,
    size:     0.75 + Math.random() * 0.55,
    colIdx:   i % 5,
  };
});

// ── Spark seeds (per-spark-slot within one enemy) ─────────────────────────────
const _sSeedBase = Array.from({ length: SPARKS_PER }, (_, i) => ({
  angle0: (i / SPARKS_PER) * Math.PI * 2,
  rScale: 0.5 + (i % 3) * 0.18,
  speed:  3.5 + (i % 5) * 0.9,
  phase:  (i / SPARKS_PER) * Math.PI,
}));

// ── Electric colour palette ───────────────────────────────────────────────────
const _elec = [
  new THREE.Color("#FFFFFF"),   // white
  new THREE.Color("#00E5FF"),   // cyan
  new THREE.Color("#88CCFF"),   // light blue
  new THREE.Color("#4499FF"),   // electric blue
  new THREE.Color("#CCFFFF"),   // pale cyan
];
const _sparkCols = [
  new THREE.Color("#FFFFFF"),
  new THREE.Color("#00E5FF"),
];
const _tc = new THREE.Color();

// ── Component ─────────────────────────────────────────────────────────────────
export function DistortField() {
  const { distortActive, distortTimer, playerPosition } = useMagicOrb();

  const fieldRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    if (!distortActive) return;

    const time       = state.clock.getElapsedTime();
    const age        = Math.max(0, TOTAL_DUR - distortTimer);
    const fadeIn     = Math.min(1, age / 0.25);              // 0.25 s fade-in
    const isUnstable = distortTimer < 0.5;
    const collapseT  = isUnstable ? 1 - distortTimer / 0.5 : 0;
    const speedMult  = isUnstable ? 1 + collapseT * 3 : 1;

    // ── Field particles ───────────────────────────────────────────────────────
    const fm = fieldRef.current;
    if (fm) {
      for (let i = 0; i < N_FIELD; i++) {
        const s = _fSeeds[i];

        // Low-freq drift + high-freq electric jitter
        const drift = s.driftAmt * Math.sin(time * s.driftHz + s.phase);
        const jx = s.jAmt * Math.sin(time * 23.7 * speedMult + s.phase * 3.1);
        const jy = s.jAmt * Math.sin(time * 31.4 * speedMult + s.phase * 2.3);
        const jz = s.jAmt * 0.3 * Math.sin(time * 17.9 * speedMult + s.phase);

        const nx = s.bx + drift * Math.cos(s.phase) + jx;
        const ny = s.by + drift * Math.sin(s.phase) + jy;
        const nz = s.bz + jz;

        // Clamp to sphere
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const maxR = FIELD_RADIUS * 0.93;
        const scale = len > maxR ? maxR / len : 1;
        _dummy.position.set(nx * scale, ny * scale, nz * scale);
        _dummy.scale.setScalar(s.size * (isUnstable ? 1 + collapseT * 0.4 : 1));
        _dummy.updateMatrix();
        fm.setMatrixAt(i, _dummy.matrix);

        // Rapid flicker opacity
        const flick = Math.abs(Math.sin(time * s.flickHz * speedMult + s.phase));
        const alpha = fadeIn * Math.max(0.08, Math.pow(flick, 0.55));

        _tc.copy(_elec[s.colIdx]).multiplyScalar(alpha * (1 + collapseT * 0.5));
        fm.setColorAt(i, _tc);
      }
      fm.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    }

    // ── Enemy sparks ──────────────────────────────────────────────────────────
    const sm = sparkRef.current;
    if (sm) {
      const { darkOrbs, playerPosition: pPos } = useMagicOrb.getState();
      const px = pPos[0], py = pPos[1];

      // Collect frozen enemies within field radius
      const caught: Array<{ x: number; y: number }> = [];
      for (const orb of darkOrbs) {
        if (!orb.frozen) continue;
        const dx = orb.position[0] - px;
        const dy = orb.position[1] - py;
        if (dx * dx + dy * dy < FIELD_RADIUS * FIELD_RADIUS) {
          caught.push({ x: orb.position[0] - px, y: orb.position[1] - py });
          if (caught.length >= MAX_ENEMY_SLOTS) break;
        }
      }

      for (let e = 0; e < MAX_ENEMY_SLOTS; e++) {
        for (let k = 0; k < SPARKS_PER; k++) {
          const slot  = e * SPARKS_PER + k;
          const ss    = _sSeedBase[k];

          if (e < caught.length) {
            const { x: ex, y: ey } = caught[e];
            const angle = ss.angle0 + time * ss.speed * speedMult + ss.phase;
            const r     = ss.rScale * (isUnstable ? 1 + collapseT * 0.5 : 1);
            _dummy.position.set(
              ex + Math.cos(angle) * r,
              ey + Math.sin(angle) * r,
              0.05
            );
            // Flicker each spark individually
            const sf = Math.abs(Math.sin(time * (8 + k * 3) * speedMult + e * 1.3 + k));
            _dummy.scale.setScalar(fadeIn * Math.max(0.1, sf) * (0.7 + collapseT * 0.4));
            _dummy.updateMatrix();
            sm.setMatrixAt(slot, _dummy.matrix);
            _tc.copy(_sparkCols[k % 2]).multiplyScalar(fadeIn * (0.6 + sf * 0.4));
            sm.setColorAt(slot, _tc);
          } else {
            // Hide unused spark slots
            _dummy.position.set(0, 0, -100);
            _dummy.scale.setScalar(0);
            _dummy.updateMatrix();
            sm.setMatrixAt(slot, _dummy.matrix);
            _tc.set(0, 0, 0);
            sm.setColorAt(slot, _tc);
          }
        }
      }
      sm.instanceMatrix.needsUpdate = true;
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
  });

  if (!distortActive) return null;

  return (
    <group position={playerPosition}>

      {/* Electric particles filling the field volume */}
      <instancedMesh
        ref={fieldRef}
        args={[_pGeo, _fieldMat, N_FIELD]}
        frustumCulled={false}
      />

      {/* Electric sparks orbiting caught enemies */}
      <instancedMesh
        ref={sparkRef}
        args={[_sGeo, _sparkMat, N_SPARK_SLOTS]}
        frustumCulled={false}
      />

    </group>
  );
}
