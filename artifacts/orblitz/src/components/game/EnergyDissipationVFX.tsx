/**
 * ToonImplosionVFX — dust/speck edition
 *
 * Phases (progress 0→1):
 *  0.00 – 0.80  120 tiny dust specks spiral inward (ease-in³, slight swirl)
 *  0.00 – 0.75   60 secondary micro-dust particles also rush inward
 *  0.00 – 0.65  Suction streams sweep inward (thin, hair-like)
 *  0.50 – 0.75  Crush flash at center
 *  0.62 – 1.00  Void remnant shrinks away
 *  0.58 – 1.00  Three fat shockwave tori expand outward
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SPECK_COUNT  = 120;
const DUST_COUNT   =  60;
const STREAM_COUNT =  12;

const _dummy = new THREE.Object3D();
const _q1    = new THREE.Quaternion();
const _yUp   = new THREE.Vector3(0, 1, 0);

function sr(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

interface SpeckDatum {
  dir:      THREE.Vector3;
  cross:    THREE.Vector3;   // perpendicular for swirl
  speed:    number;
  delay:    number;
  size:     number;
  swirlDir: number;          // +1 or -1
  phase:    number;
}

interface Props {
  progress:   number;
  color:      string;
  glowColor?: string;
  scale?:     number;
  seed?:      number;
}

export function EnergyDissipationVFX({ progress, color, glowColor, scale = 1, seed = 0 }: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const speckFillRef  = useRef<THREE.InstancedMesh>(null);
  const dustFillRef   = useRef<THREE.InstancedMesh>(null);
  const streamFillRef = useRef<THREE.InstancedMesh>(null);
  const streamOutRef  = useRef<THREE.InstancedMesh>(null);

  const crushRef    = useRef<THREE.Mesh>(null);
  const crushOutRef = useRef<THREE.Mesh>(null);
  const voidRef     = useRef<THREE.Mesh>(null);
  const voidOutRef  = useRef<THREE.Mesh>(null);
  const ringRefs    = useRef<(THREE.Mesh | null)[]>([]);

  const gColor = glowColor ?? color;

  // ── Particle data ─────────────────────────────────────────────────────────

  const specks = useMemo<SpeckDatum[]>(() => {
    const list: SpeckDatum[] = [];
    for (let i = 0; i < SPECK_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / SPECK_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + sr(seed, i) * 2.0;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      // perpendicular vector for swirl
      const up    = Math.abs(dir.y) < 0.9 ? _yUp : new THREE.Vector3(1, 0, 0);
      const cross = new THREE.Vector3().crossVectors(dir, up).normalize();
      list.push({
        dir, cross,
        speed:    0.45 + sr(seed, i * 6 + 1) * 0.7,
        delay:    sr(seed, i * 6 + 2) * 0.18,
        size:     0.022 + sr(seed, i * 6 + 3) * 0.022,
        swirlDir: sr(seed, i * 6 + 4) > 0.5 ? 1 : -1,
        phase:    sr(seed, i * 6 + 5) * Math.PI * 2,
      });
    }
    return list;
  }, [seed]);

  const dust = useMemo<SpeckDatum[]>(() => {
    const list: SpeckDatum[] = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      const phi   = Math.acos(2 * sr(seed + 41, i * 3 + 1) - 1);
      const theta = 2 * Math.PI * sr(seed + 41, i * 3);
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const up    = Math.abs(dir.y) < 0.9 ? _yUp : new THREE.Vector3(1, 0, 0);
      const cross = new THREE.Vector3().crossVectors(dir, up).normalize();
      list.push({
        dir, cross,
        speed:    0.35 + sr(seed + 41, i * 6 + 1) * 0.55,
        delay:    sr(seed + 41, i * 6 + 2) * 0.14,
        size:     0.011 + sr(seed + 41, i * 6 + 3) * 0.013,
        swirlDir: sr(seed + 41, i * 6 + 4) > 0.5 ? 1 : -1,
        phase:    sr(seed + 41, i * 6 + 5) * Math.PI * 2,
      });
    }
    return list;
  }, [seed]);

  const streamDirs = useMemo(
    () => Array.from({ length: STREAM_COUNT }, (_, i) => {
      const angle = (i / STREAM_COUNT) * Math.PI * 2 + sr(seed + 7, i) * 0.5;
      const pitch = (sr(seed + 7, i + 100) - 0.5) * Math.PI * 0.55;
      return new THREE.Vector3(
        Math.cos(angle) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(angle) * Math.cos(pitch),
      ).normalize();
    }),
    [seed],
  );

  const ringDefs = useMemo(() => [
    { rotX: Math.PI / 2, rotZ: 0,           rate: 4.0, delay: 0.58, tubeR: 0.11 },
    { rotX: Math.PI / 4, rotZ: Math.PI / 5, rate: 2.8, delay: 0.63, tubeR: 0.08 },
    { rotX: 0.9,         rotZ: Math.PI / 3, rate: 3.3, delay: 0.68, tubeR: 0.09 },
  ], []);

  // ── Geometries & materials ────────────────────────────────────────────────

  const speckGeo  = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  const streamGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.005, 1, 3, 1), []);

  const speckMat  = useMemo(() => new THREE.MeshBasicMaterial({ color,     transparent: true, depthWrite: false }), [color]);
  const dustMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: gColor, transparent: true, depthWrite: false }), [gColor]);
  const streamFillMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }), []);
  const streamOutMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: "#111111", transparent: true, depthWrite: false, side: THREE.BackSide }), []);

  // ── Frame update ──────────────────────────────────────────────────────────

  useFrame((state) => {
    const p    = progressRef.current;
    const t    = state.clock.getElapsedTime();
    const maxR = 2.6 * scale;

    const easeIn = (lp: number) => Math.pow(Math.min(lp, 1), 3.0);

    // ── Primary specks ────────────────────────────────────────────────────
    const speckOp = Math.max(0, 1 - Math.max(0, p - 0.60) / 0.22);
    if (speckFillRef.current) {
      for (let i = 0; i < SPECK_COUNT; i++) {
        const s  = specks[i];
        const lp = Math.max(0, (p - s.delay) / (0.82 - s.delay));
        const ei = easeIn(lp);
        const dist = (1 - ei) * maxR * s.speed;

        // Slight spiral as they rush in
        const swirl = s.swirlDir * (1 - ei) * 0.55 * Math.sin(t * 4 + s.phase);

        _dummy.position
          .copy(s.dir).multiplyScalar(Math.max(0, dist))
          .addScaledVector(s.cross, swirl * scale);

        _q1.setFromAxisAngle(s.dir, t * 6 + i);
        _dummy.quaternion.copy(_q1);
        _dummy.scale.setScalar(Math.max(0.0001, scale * s.size * (0.6 + 0.4 * (1 - ei))));
        _dummy.updateMatrix();
        speckFillRef.current.setMatrixAt(i, _dummy.matrix);
      }
      speckFillRef.current.instanceMatrix.needsUpdate = true;
      (speckFillRef.current.material as THREE.MeshBasicMaterial).color.set(color);
      (speckFillRef.current.material as THREE.MeshBasicMaterial).opacity = speckOp;
    }

    // ── Secondary micro-dust ──────────────────────────────────────────────
    const dustOp = Math.max(0, 1 - Math.max(0, p - 0.52) / 0.25);
    if (dustFillRef.current) {
      for (let i = 0; i < DUST_COUNT; i++) {
        const s  = dust[i];
        const lp = Math.max(0, (p - s.delay) / (0.76 - s.delay));
        const ei = easeIn(lp);
        const dist  = (1 - ei) * maxR * s.speed * 0.80;
        const swirl = s.swirlDir * (1 - ei) * 0.4 * Math.cos(t * 5 + s.phase);

        _dummy.position
          .copy(s.dir).multiplyScalar(Math.max(0, dist))
          .addScaledVector(s.cross, swirl * scale);

        _q1.setFromAxisAngle(s.dir, t * 8 + i * 1.3);
        _dummy.quaternion.copy(_q1);
        _dummy.scale.setScalar(Math.max(0.0001, scale * s.size * (0.5 + 0.5 * (1 - ei))));
        _dummy.updateMatrix();
        dustFillRef.current.setMatrixAt(i, _dummy.matrix);
      }
      dustFillRef.current.instanceMatrix.needsUpdate = true;
      (dustFillRef.current.material as THREE.MeshBasicMaterial).color.set(gColor);
      (dustFillRef.current.material as THREE.MeshBasicMaterial).opacity = dustOp;
    }

    // ── Suction streams ───────────────────────────────────────────────────
    const streamProgress = Math.min(1, p / 0.65);
    const streamOp = Math.max(0, 1 - Math.max(0, p - 0.42) / 0.28);
    if (streamFillRef.current || streamOutRef.current) {
      for (let i = 0; i < STREAM_COUNT; i++) {
        const dir    = streamDirs[i];
        const spd    = 0.5 + sr(seed + 7, i * 3) * 0.5;
        const lp     = easeIn(streamProgress * spd);
        const tipDist = (1 - lp) * maxR * 0.9;
        const len    = Math.max(0.0001, (1 - Math.pow(streamProgress * spd, 0.3)) * scale * 1.4);
        _dummy.position.copy(dir).multiplyScalar(tipDist + len * 0.5);
        _dummy.quaternion.setFromUnitVectors(_yUp, dir.clone().negate());
        _dummy.scale.set(scale * 0.06, len, scale * 0.06);
        _dummy.updateMatrix();
        streamFillRef.current?.setMatrixAt(i, _dummy.matrix);
        if (streamOutRef.current) {
          _dummy.scale.set(scale * 0.09, len, scale * 0.09);
          _dummy.updateMatrix();
          streamOutRef.current.setMatrixAt(i, _dummy.matrix);
        }
      }
      if (streamFillRef.current) {
        streamFillRef.current.instanceMatrix.needsUpdate = true;
        (streamFillRef.current.material as THREE.MeshBasicMaterial).opacity = streamOp;
      }
      if (streamOutRef.current) {
        streamOutRef.current.instanceMatrix.needsUpdate = true;
        (streamOutRef.current.material as THREE.MeshBasicMaterial).opacity = streamOp * 0.7;
      }
    }

    // ── Crush flash ───────────────────────────────────────────────────────
    if (crushRef.current) {
      const cp   = Math.max(0, (p - 0.50) / 0.25);
      const grow = cp < 0.4 ? (cp / 0.4) * 1.7 : Math.max(0, 1.7 - ((cp - 0.4) / 0.6) * 1.7);
      const op   = cp < 0.4 ? cp / 0.4 : Math.max(0, 1 - (cp - 0.4) / 0.6);
      crushRef.current.scale.setScalar(scale * Math.max(0.001, grow));
      (crushRef.current.material as THREE.MeshBasicMaterial).opacity = op;
      if (crushOutRef.current) {
        crushOutRef.current.scale.setScalar(scale * Math.max(0.001, grow) * 1.22);
        (crushOutRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.75;
      }
    }

    // ── Void remnant ──────────────────────────────────────────────────────
    if (voidRef.current) {
      const vp  = Math.max(0, (p - 0.62) / 0.38);
      const sz  = scale * Math.max(0.001, 0.65 * (1 - vp));
      const op  = Math.max(0, 1 - vp * 1.1);
      voidRef.current.scale.setScalar(sz);
      (voidRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.80;
      if (voidOutRef.current) {
        voidOutRef.current.scale.setScalar(sz * 1.2);
        (voidOutRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.65;
      }
    }

    // ── Shockwave rings ───────────────────────────────────────────────────
    for (let ri = 0; ri < ringDefs.length; ri++) {
      const mesh = ringRefs.current[ri];
      if (!mesh) continue;
      const r  = ringDefs[ri];
      const lp = Math.max(0, (p - r.delay) / (1 - r.delay));
      mesh.scale.setScalar(Math.max(0.001, scale * (0.18 + lp * r.rate)));
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - lp * 1.6) * 0.95);
    }
  });

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Suction streams */}
      <instancedMesh ref={streamOutRef}   args={[streamGeo, streamOutMat,  STREAM_COUNT]} frustumCulled={false} />
      <instancedMesh ref={streamFillRef}  args={[streamGeo, streamFillMat, STREAM_COUNT]} frustumCulled={false} />

      {/* Primary dust specks */}
      <instancedMesh ref={speckFillRef}  args={[speckGeo, speckMat, SPECK_COUNT]} frustumCulled={false} />

      {/* Secondary micro-dust */}
      <instancedMesh ref={dustFillRef}   args={[speckGeo, dustMat,  DUST_COUNT]}  frustumCulled={false} />

      {/* Crush flash */}
      <mesh ref={crushOutRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#111111" transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh ref={crushRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Void remnant */}
      <mesh ref={voidOutRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#111111" transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh ref={voidRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Post-implosion shockwave rings */}
      {ringDefs.map((r, i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el; }} rotation={[r.rotX, 0, r.rotZ]}>
          <torusGeometry args={[1, r.tubeR, 8, 44]} />
          <meshBasicMaterial
            color={i === 1 ? gColor : color}
            transparent opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
