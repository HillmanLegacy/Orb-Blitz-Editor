import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── Constants ─────────────────────────────────────────────────────────────────
const FIELD_RADIUS    = 5;
const TOTAL_DUR       = 5.0;
const N_FIELD         = 220;
const SPARKS_PER      = 6;
const MAX_ENEMY_SLOTS = 20;
const N_SPARK_SLOTS   = MAX_ENEMY_SLOTS * SPARKS_PER;  // 120
const N_PULSE         = 64;
const PULSE_DUR       = 0.55;

// ── Shared geometry & materials ───────────────────────────────────────────────
const _pGeo      = new THREE.SphereGeometry(0.055, 4, 4);
const _sGeo      = new THREE.SphereGeometry(0.045, 4, 4);
const _pulseGeo  = new THREE.SphereGeometry(0.10,  4, 4);
const _dummy     = new THREE.Object3D();
const _fieldMat  = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true,
});
const _sparkMat  = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true,
});
const _pulseMat  = new THREE.MeshBasicMaterial({
  transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true,
});

// ── Field particle seeds ──────────────────────────────────────────────────────
const _fSeeds = Array.from({ length: N_FIELD }, (_, i) => {
  const u     = Math.random();
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = FIELD_RADIUS * 0.91 * Math.cbrt(u);
  return {
    bx:       r * Math.sin(phi) * Math.cos(theta),
    by:       r * Math.sin(phi) * Math.sin(theta),
    bz:       (Math.random() - 0.5) * 0.35,
    phase:    (i / N_FIELD) * Math.PI * 2 + Math.random(),
    flickHz:  7  + Math.random() * 16,
    jAmt:     0.10 + Math.random() * 0.20,
    driftAmt: 0.35 + Math.random() * 0.50,
    driftHz:  0.8 + Math.random() * 1.8,
    size:     0.75 + Math.random() * 0.55,
    colIdx:   i % 5,
  };
});

// ── Spark seeds ───────────────────────────────────────────────────────────────
const _sSeedBase = Array.from({ length: SPARKS_PER }, (_, i) => ({
  angle0: (i / SPARKS_PER) * Math.PI * 2,
  rScale: 0.5 + (i % 3) * 0.18,
  speed:  3.5 + (i % 5) * 0.9,
  phase:  (i / SPARKS_PER) * Math.PI,
}));

// ── Pulse burst seeds — ring of particles spread in XY, slight Z variation ────
const _pulseSeeds = Array.from({ length: N_PULSE }, (_, i) => {
  const theta = (i / N_PULSE) * Math.PI * 2;
  // Two concentric rings: inner 32 at r1, outer 32 at r2 speeds
  const isOuter = i >= N_PULSE / 2;
  return {
    dx:    Math.cos(theta),
    dy:    Math.sin(theta),
    dz:    (Math.random() - 0.5) * 0.15,
    speed: isOuter ? 1.0 + Math.random() * 0.15 : 0.75 + Math.random() * 0.15,
    size:  isOuter ? 0.8 + Math.random() * 0.4 : 1.0 + Math.random() * 0.5,
    colIdx: i % 5,
  };
});

// ── Colour palette ────────────────────────────────────────────────────────────
const _elec = [
  new THREE.Color("#FFFFFF"),
  new THREE.Color("#00E5FF"),
  new THREE.Color("#88CCFF"),
  new THREE.Color("#4499FF"),
  new THREE.Color("#CCFFFF"),
];
const _sparkCols = [new THREE.Color("#FFFFFF"), new THREE.Color("#00E5FF")];
const _tc = new THREE.Color();

// ── Component ─────────────────────────────────────────────────────────────────
export function DistortField() {
  const { distortActive, distortTimer, playerPosition } = useMagicOrb();

  const fieldRef      = useRef<THREE.InstancedMesh>(null);
  const sparkRef      = useRef<THREE.InstancedMesh>(null);
  const pulseRef      = useRef<THREE.InstancedMesh>(null);
  const pulseTimerRef = useRef(0);
  const pulseHidRef   = useRef(false); // true once we've zeroed out finished pulse

  // On mount: pre-initialise instanceColor on all three meshes so Three.js compiles
  // the shader WITH USE_INSTANCING_COLOR from the very first render.
  // Without this, the attribute is absent on first compile and colours never show.
  useEffect(() => {
    const black = new THREE.Color(0, 0, 0);

    const fm = fieldRef.current;
    if (fm) {
      for (let i = 0; i < N_FIELD; i++) fm.setColorAt(i, black);
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    }
    const sm = sparkRef.current;
    if (sm) {
      for (let i = 0; i < N_SPARK_SLOTS; i++) sm.setColorAt(i, black);
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
    const pm = pulseRef.current;
    if (pm) {
      for (let i = 0; i < N_PULSE; i++) pm.setColorAt(i, black);
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }

    pulseTimerRef.current = PULSE_DUR;
    pulseHidRef.current   = false;
  }, []);

  useFrame((state, delta) => {
    if (!distortActive) return;

    const time       = state.clock.getElapsedTime();
    const age        = Math.max(0, TOTAL_DUR - distortTimer);
    const fadeIn     = Math.min(1, age / 0.25);
    const isUnstable = distortTimer < 0.5;
    const collapseT  = isUnstable ? 1 - distortTimer / 0.5 : 0;
    const speedMult  = isUnstable ? 1 + collapseT * 3 : 1;

    // ── Activation pulse burst ─────────────────────────────────────────────────
    const pm = pulseRef.current;
    if (pm) {
      if (pulseTimerRef.current > 0) {
        pulseTimerRef.current = Math.max(0, pulseTimerRef.current - delta);
        const t      = 1 - pulseTimerRef.current / PULSE_DUR;          // 0→1
        const eased  = 1 - Math.pow(1 - t, 2.2);                       // ease-out

        for (let i = 0; i < N_PULSE; i++) {
          const s = _pulseSeeds[i];
          const r = eased * FIELD_RADIUS * s.speed;
          _dummy.position.set(s.dx * r, s.dy * r, s.dz);
          // Particles shrink as they expand outward
          _dummy.scale.setScalar(s.size * Math.max(0, 1 - eased * 0.75));
          _dummy.updateMatrix();
          pm.setMatrixAt(i, _dummy.matrix);
          // Bright at birth, fade as they reach boundary
          const fade = Math.pow(1 - t, 1.2);
          _tc.copy(_elec[s.colIdx]).multiplyScalar(fade * 1.4);
          pm.setColorAt(i, _tc);
        }
        pm.instanceMatrix.needsUpdate = true;
        if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
        pulseHidRef.current = false;
      } else if (!pulseHidRef.current) {
        // Hide all pulse instances once, then stop updating
        _dummy.position.set(0, 0, -999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        _tc.set(0, 0, 0);
        for (let i = 0; i < N_PULSE; i++) {
          pm.setMatrixAt(i, _dummy.matrix);
          pm.setColorAt(i, _tc);
        }
        pm.instanceMatrix.needsUpdate = true;
        if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
        pulseHidRef.current = true;
      }
    }

    // ── Field particles ───────────────────────────────────────────────────────
    const fm = fieldRef.current;
    if (fm) {
      for (let i = 0; i < N_FIELD; i++) {
        const s = _fSeeds[i];
        const drift = s.driftAmt * Math.sin(time * s.driftHz + s.phase);
        const jx = s.jAmt * Math.sin(time * 23.7 * speedMult + s.phase * 3.1);
        const jy = s.jAmt * Math.sin(time * 31.4 * speedMult + s.phase * 2.3);
        const jz = s.jAmt * 0.3 * Math.sin(time * 17.9 * speedMult + s.phase);

        const nx = s.bx + drift * Math.cos(s.phase) + jx;
        const ny = s.by + drift * Math.sin(s.phase) + jy;
        const nz = s.bz + jz;

        const len  = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const maxR = FIELD_RADIUS * 0.93;
        const sc   = len > maxR ? maxR / len : 1;
        _dummy.position.set(nx * sc, ny * sc, nz * sc);
        _dummy.scale.setScalar(s.size * (isUnstable ? 1 + collapseT * 0.4 : 1));
        _dummy.updateMatrix();
        fm.setMatrixAt(i, _dummy.matrix);

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
          const slot = e * SPARKS_PER + k;
          const ss   = _sSeedBase[k];

          if (e < caught.length) {
            const { x: ex, y: ey } = caught[e];
            const angle = ss.angle0 + time * ss.speed * speedMult + ss.phase;
            const r     = ss.rScale * (isUnstable ? 1 + collapseT * 0.5 : 1);
            _dummy.position.set(ex + Math.cos(angle) * r, ey + Math.sin(angle) * r, 0.05);
            const sf = Math.abs(Math.sin(time * (8 + k * 3) * speedMult + e * 1.3 + k));
            _dummy.scale.setScalar(fadeIn * Math.max(0.1, sf) * (0.7 + collapseT * 0.4));
            _dummy.updateMatrix();
            sm.setMatrixAt(slot, _dummy.matrix);
            _tc.copy(_sparkCols[k % 2]).multiplyScalar(fadeIn * (0.6 + sf * 0.4));
            sm.setColorAt(slot, _tc);
          } else {
            _dummy.position.set(0, 0, -999);
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

      {/* Activation pulse — bursts outward on field deploy */}
      <instancedMesh ref={pulseRef} args={[_pulseGeo, _pulseMat, N_PULSE]} frustumCulled={false} />

      {/* Electric particles filling the field volume */}
      <instancedMesh ref={fieldRef} args={[_pGeo, _fieldMat, N_FIELD]} frustumCulled={false} />

      {/* Electric sparks orbiting caught enemies */}
      <instancedMesh ref={sparkRef} args={[_sGeo, _sparkMat, N_SPARK_SLOTS]} frustumCulled={false} />

    </group>
  );
}
