import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

const FIELD_RADIUS    = 7.5;
const TOTAL_DUR       = 5.0;
const N_FIELD         = 360;
const SPARKS_PER      = 6;
const MAX_ENEMY_SLOTS = 20;
const N_SPARK_SLOTS   = MAX_ENEMY_SLOTS * SPARKS_PER;
const N_PULSE         = 64;
const PULSE_DUR       = 0.55;

const _pGeo     = new THREE.SphereGeometry(0.024, 4, 4);
const _sGeo     = new THREE.SphereGeometry(0.018, 4, 4);
const _pulseGeo = new THREE.SphereGeometry(0.036, 4, 4);
const _dummy    = new THREE.Object3D();

const _fSeeds = Array.from({ length: N_FIELD }, (_, i) => {
  const theta = Math.random() * Math.PI * 2;
  const r     = FIELD_RADIUS * 0.9 * Math.cbrt(Math.random());
  return {
    bx: r * Math.cos(theta),
    by: r * Math.sin(theta),
    bz: (Math.random() - 0.5) * 0.4,
    phase:   (i / N_FIELD) * Math.PI * 2,
    flickHz: 5 + Math.random() * 12,
    jAmt:    0.12 + Math.random() * 0.18,
    size:    1.0  + Math.random() * 0.6,
  };
});

const _pulseSeeds = Array.from({ length: N_PULSE }, (_, i) => ({
  dx:    Math.cos((i / N_PULSE) * Math.PI * 2),
  dy:    Math.sin((i / N_PULSE) * Math.PI * 2),
  dz:    (Math.random() - 0.5) * 0.1,
  speed: 0.85 + Math.random() * 0.25,
  size:  1.0  + Math.random() * 0.5,
}));

const _sSeedBase = Array.from({ length: SPARKS_PER }, (_, i) => ({
  angle0: (i / SPARKS_PER) * Math.PI * 2,
  r:      0.5 + (i % 3) * 0.2,
  speed:  3.5 + (i % 5) * 0.9,
}));

export function DistortField() {
  const { distortActive, distortTimer, playerPosition } = useMagicOrb();

  // Materials created once per mount — same pattern as HealAura
  const [fieldMat]  = useState(() => new THREE.MeshBasicMaterial({ color: "#00E5FF", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const [sparkMat]  = useState(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const [pulseMat]  = useState(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));

  // Dispose materials on unmount to prevent GPU VRAM leaks
  useEffect(() => () => { fieldMat.dispose(); sparkMat.dispose(); pulseMat.dispose(); }, [fieldMat, sparkMat, pulseMat]);

  const fieldRef      = useRef<THREE.InstancedMesh>(null);
  const sparkRef      = useRef<THREE.InstancedMesh>(null);
  const pulseRef      = useRef<THREE.InstancedMesh>(null);
  const pulseTimerRef = useRef(0);
  const pulseHidRef   = useRef(false);

  useEffect(() => {
    pulseTimerRef.current = PULSE_DUR;
    pulseHidRef.current   = false;
  }, []);

  useFrame((state, delta) => {
    if (!distortActive) return;

    const time       = state.clock.getElapsedTime();
    const age        = Math.max(0, TOTAL_DUR - distortTimer);
    const fadeIn     = Math.min(1, age / 0.3);
    const isUnstable = distortTimer < 0.5;
    const collapseT  = isUnstable ? 1 - distortTimer / 0.5 : 0;
    const speedMult  = isUnstable ? 1 + collapseT * 3 : 1;

    // ── Activation pulse ──────────────────────────────────────────────────────
    const pm = pulseRef.current;
    if (pm) {
      if (pulseTimerRef.current > 0) {
        pulseTimerRef.current = Math.max(0, pulseTimerRef.current - delta);
        const t     = 1 - pulseTimerRef.current / PULSE_DUR;
        const eased = 1 - Math.pow(1 - t, 2);
        for (let i = 0; i < N_PULSE; i++) {
          const s = _pulseSeeds[i];
          const r = eased * FIELD_RADIUS * s.speed;
          _dummy.position.set(s.dx * r, s.dy * r, s.dz);
          _dummy.scale.setScalar(s.size * Math.max(0, 1 - eased * 0.8));
          _dummy.updateMatrix();
          pm.setMatrixAt(i, _dummy.matrix);
        }
        pm.instanceMatrix.needsUpdate = true;
        pulseMat.opacity = Math.pow(1 - t, 1.2) * 1.2;
      } else if (!pulseHidRef.current) {
        _dummy.position.set(0, 0, -999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        for (let i = 0; i < N_PULSE; i++) pm.setMatrixAt(i, _dummy.matrix);
        pm.instanceMatrix.needsUpdate = true;
        pulseMat.opacity = 0;
        pulseHidRef.current = true;
      }
    }

    // ── Field particles ───────────────────────────────────────────────────────
    const fm = fieldRef.current;
    if (fm) {
      for (let i = 0; i < N_FIELD; i++) {
        const s    = _fSeeds[i];
        const jx   = s.jAmt * Math.sin(time * 24 * speedMult + s.phase * 3.1);
        const jy   = s.jAmt * Math.sin(time * 31 * speedMult + s.phase * 2.3);
        const nx   = s.bx + jx;
        const ny   = s.by + jy;
        const nz   = s.bz;
        const len  = Math.sqrt(nx * nx + ny * ny);
        const maxR = FIELD_RADIUS * 0.92;
        const sc   = len > maxR ? maxR / len : 1;
        _dummy.position.set(nx * sc, ny * sc, nz);
        const flick = Math.abs(Math.sin(time * s.flickHz * speedMult + s.phase));
        _dummy.scale.setScalar(s.size * fadeIn * Math.max(0.05, flick));
        _dummy.updateMatrix();
        fm.setMatrixAt(i, _dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
      fieldMat.opacity = 1;
    }

    // ── Enemy sparks ──────────────────────────────────────────────────────────
    const sm = sparkRef.current;
    if (sm) {
      const { darkOrbs, playerPosition: pPos } = useMagicOrb.getState();
      const px = pPos[0], py = pPos[1];
      const caught: { x: number; y: number }[] = [];
      for (const orb of darkOrbs) {
        if (!orb.frozen) continue;
        const dx = orb.position[0] - px, dy = orb.position[1] - py;
        if (dx * dx + dy * dy < FIELD_RADIUS * FIELD_RADIUS) {
          caught.push({ x: dx, y: dy });
          if (caught.length >= MAX_ENEMY_SLOTS) break;
        }
      }
      for (let e = 0; e < MAX_ENEMY_SLOTS; e++) {
        for (let k = 0; k < SPARKS_PER; k++) {
          const slot = e * SPARKS_PER + k;
          const ss   = _sSeedBase[k];
          if (e < caught.length) {
            const ang = ss.angle0 + time * ss.speed * speedMult;
            _dummy.position.set(caught[e].x + Math.cos(ang) * ss.r, caught[e].y + Math.sin(ang) * ss.r, 0.05);
            const sf = Math.abs(Math.sin(time * (8 + k * 3) * speedMult + e + k));
            _dummy.scale.setScalar(fadeIn * Math.max(0.1, sf));
          } else {
            _dummy.position.set(0, 0, -999);
            _dummy.scale.setScalar(0);
          }
          _dummy.updateMatrix();
          sm.setMatrixAt(slot, _dummy.matrix);
        }
      }
      sm.instanceMatrix.needsUpdate = true;
      sparkMat.opacity = 1;
    }
  });

  if (!distortActive) return null;

  return (
    <group position={playerPosition}>
      <instancedMesh ref={pulseRef} args={[_pulseGeo, pulseMat, N_PULSE]} frustumCulled={false} />
      <instancedMesh ref={fieldRef} args={[_pGeo,     fieldMat, N_FIELD]} frustumCulled={false} />
      <instancedMesh ref={sparkRef} args={[_sGeo,     sparkMat, N_SPARK_SLOTS]} frustumCulled={false} />
    </group>
  );
}
