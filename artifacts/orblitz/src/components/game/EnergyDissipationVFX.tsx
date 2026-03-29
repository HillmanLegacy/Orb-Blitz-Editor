/**
 * ToonImplosionVFX — fully 3D edition
 *
 * Phases (progress 0→1):
 *  0.00 – 0.80  120 dust specks spiral inward  (SphereGeometry, ease-in³)
 *  0.00 – 0.75   60 secondary micro-dust       (same, slightly smaller)
 *  0.00 – 0.65  12 suction streams             (CylinderGeometry, 6-sided)
 *  0.50 – 0.80  Crush flash                    (IcosahedronGeometry, toon outlined)
 *  0.55 – 0.95  16 3D debris shards            (IcosahedronGeometry, fly outward + spin)
 *  0.62 – 1.00  Void remnant                   (IcosahedronGeometry, shrinks)
 *  0.58 – 1.00  Three fat shockwave tori       (spinning while expanding)
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SPECK_COUNT  = 120;
const DUST_COUNT   =  60;
const STREAM_COUNT =  12;
const DEBRIS_COUNT =  16;

const _dummy = new THREE.Object3D();
const _q1    = new THREE.Quaternion();
const _yUp   = new THREE.Vector3(0, 1, 0);

function sr(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

interface SpeckDatum {
  dir:      THREE.Vector3;
  cross:    THREE.Vector3;
  speed:    number;
  delay:    number;
  size:     number;
  swirlDir: number;
  phase:    number;
}

interface DebrisDatum {
  dir:      THREE.Vector3;
  spinAxis: THREE.Vector3;
  speed:    number;
  size:     number;
  delay:    number;
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

  const speckFillRef   = useRef<THREE.InstancedMesh>(null);
  const dustFillRef    = useRef<THREE.InstancedMesh>(null);
  const streamFillRef  = useRef<THREE.InstancedMesh>(null);
  const streamOutRef   = useRef<THREE.InstancedMesh>(null);
  const debrisFillRef  = useRef<THREE.InstancedMesh>(null);
  const debrisOutRef   = useRef<THREE.InstancedMesh>(null);

  const crushRef    = useRef<THREE.Mesh>(null);
  const crushOutRef = useRef<THREE.Mesh>(null);
  const voidRef     = useRef<THREE.Mesh>(null);
  const voidOutRef  = useRef<THREE.Mesh>(null);
  const ringRefs    = useRef<(THREE.Mesh | null)[]>([]);

  const gColor = glowColor ?? color;

  // ── Particle data ──────────────────────────────────────────────────────

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

  const debris = useMemo<DebrisDatum[]>(() => {
    const list: DebrisDatum[] = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / DEBRIS_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + sr(seed + 99, i) * 1.8;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const spinAxis = new THREE.Vector3(
        sr(seed + 99, i * 4 + 1) * 2 - 1,
        sr(seed + 99, i * 4 + 2) * 2 - 1,
        sr(seed + 99, i * 4 + 3) * 2 - 1,
      ).normalize();
      list.push({
        dir, spinAxis,
        speed: 0.6 + sr(seed + 99, i * 5 + 4) * 0.8,
        size:  0.09 + sr(seed + 99, i * 5)     * 0.11,
        delay: sr(seed + 99, i * 5 + 1)        * 0.08,
      });
    }
    return list;
  }, [seed]);

  const ringDefs = useMemo(() => [
    { rotX: Math.PI / 2, rotZ: 0,           spinX:  1.8, spinZ:  0.9, rate: 4.0, delay: 0.58, tubeR: 0.18 },
    { rotX: Math.PI / 4, rotZ: Math.PI / 5, spinX: -1.2, spinZ:  1.5, rate: 2.8, delay: 0.63, tubeR: 0.14 },
    { rotX: 0.9,         rotZ: Math.PI / 3, spinX:  0.7, spinZ: -2.0, rate: 3.3, delay: 0.68, tubeR: 0.16 },
  ], []);

  // ── Geometries & materials ─────────────────────────────────────────────

  const speckGeo  = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  // 6-sided cylinder so streams look like round rods, not flat triangles
  const streamGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.006, 1, 6, 1), []);
  // Faceted icosahedron for debris shards — clearly 3D at any angle
  const debrisGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);

  const speckMat      = useMemo(() => new THREE.MeshBasicMaterial({ color,     transparent: true, depthWrite: false }), [color]);
  const dustMat       = useMemo(() => new THREE.MeshBasicMaterial({ color: gColor, transparent: true, depthWrite: false }), [gColor]);
  const streamFillMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }), []);
  const streamOutMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0d0d0d", transparent: true, depthWrite: false, side: THREE.BackSide }), []);
  const debrisFillMat = useMemo(() => new THREE.MeshBasicMaterial({ color: gColor, transparent: true, depthWrite: false }), [gColor]);
  const debrisOutMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0d0d0d", transparent: true, depthWrite: false, side: THREE.BackSide }), []);

  // ── Frame update ───────────────────────────────────────────────────────

  useFrame((state) => {
    const p    = progressRef.current;
    const t    = state.clock.getElapsedTime();
    const maxR = 2.6 * scale;

    const easeIn  = (lp: number) => Math.pow(Math.min(lp, 1), 3.0);
    const easeOut = (lp: number) => 1 - Math.pow(1 - Math.min(lp, 1), 2.5);

    // ── Primary specks ──────────────────────────────────────────────────
    const speckOp = Math.max(0, 1 - Math.max(0, p - 0.60) / 0.22);
    if (speckFillRef.current) {
      for (let i = 0; i < SPECK_COUNT; i++) {
        const s  = specks[i];
        const lp = Math.max(0, (p - s.delay) / (0.82 - s.delay));
        const ei = easeIn(lp);
        const dist  = (1 - ei) * maxR * s.speed;
        const swirl = s.swirlDir * (1 - ei) * 0.55 * Math.sin(t * 4 + s.phase);
        _dummy.position.copy(s.dir).multiplyScalar(Math.max(0, dist)).addScaledVector(s.cross, swirl * scale);
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

    // ── Secondary micro-dust ────────────────────────────────────────────
    const dustOp = Math.max(0, 1 - Math.max(0, p - 0.52) / 0.25);
    if (dustFillRef.current) {
      for (let i = 0; i < DUST_COUNT; i++) {
        const s  = dust[i];
        const lp = Math.max(0, (p - s.delay) / (0.76 - s.delay));
        const ei = easeIn(lp);
        const dist  = (1 - ei) * maxR * s.speed * 0.80;
        const swirl = s.swirlDir * (1 - ei) * 0.4 * Math.cos(t * 5 + s.phase);
        _dummy.position.copy(s.dir).multiplyScalar(Math.max(0, dist)).addScaledVector(s.cross, swirl * scale);
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

    // ── Suction streams (6-sided cylinders) ─────────────────────────────
    const streamProgress = Math.min(1, p / 0.65);
    const streamOp = Math.max(0, 1 - Math.max(0, p - 0.42) / 0.28);
    if (streamFillRef.current || streamOutRef.current) {
      for (let i = 0; i < STREAM_COUNT; i++) {
        const dir     = streamDirs[i];
        const spd     = 0.5 + sr(seed + 7, i * 3) * 0.5;
        const lp      = easeIn(streamProgress * spd);
        const tipDist = (1 - lp) * maxR * 0.9;
        const len     = Math.max(0.0001, (1 - Math.pow(streamProgress * spd, 0.3)) * scale * 1.4);
        _dummy.position.copy(dir).multiplyScalar(tipDist + len * 0.5);
        _dummy.quaternion.setFromUnitVectors(_yUp, dir.clone().negate());
        _dummy.scale.set(scale * 0.07, len, scale * 0.07);
        _dummy.updateMatrix();
        streamFillRef.current?.setMatrixAt(i, _dummy.matrix);
        if (streamOutRef.current) {
          _dummy.scale.set(scale * 0.10, len, scale * 0.10);
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

    // ── 3D debris shards (fly outward from crush point) ─────────────────
    // appear at p=0.55, fly outward, spin hard, fade by p=0.95
    const debrisOp = p < 0.55 ? 0 : Math.max(0, 1 - Math.max(0, p - 0.65) / 0.32);
    if (debrisFillRef.current || debrisOutRef.current) {
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const d  = debris[i];
        const lp = Math.max(0, (p - 0.55 - d.delay) / (0.40 - d.delay));
        const dist = easeOut(lp) * scale * 2.0 * d.speed;
        const sz   = scale * d.size * (1.0 - lp * 0.5);
        _dummy.position.copy(d.dir).multiplyScalar(dist);
        // Hard spin on own axis
        _q1.setFromAxisAngle(d.spinAxis, t * 14 + i * 2.1);
        _dummy.quaternion.copy(_q1);
        _dummy.scale.setScalar(Math.max(0.0001, sz));
        _dummy.updateMatrix();
        debrisFillRef.current?.setMatrixAt(i, _dummy.matrix);
        if (debrisOutRef.current) {
          _dummy.scale.setScalar(Math.max(0.0001, sz * 1.28));
          _dummy.updateMatrix();
          debrisOutRef.current.setMatrixAt(i, _dummy.matrix);
        }
      }
      if (debrisFillRef.current) {
        debrisFillRef.current.instanceMatrix.needsUpdate = true;
        (debrisFillRef.current.material as THREE.MeshBasicMaterial).color.set(gColor);
        (debrisFillRef.current.material as THREE.MeshBasicMaterial).opacity = debrisOp * 0.95;
      }
      if (debrisOutRef.current) {
        debrisOutRef.current.instanceMatrix.needsUpdate = true;
        (debrisOutRef.current.material as THREE.MeshBasicMaterial).opacity = debrisOp * 0.85;
      }
    }

    // ── Crush flash (IcosahedronGeometry, no lighting needed) ───────────
    if (crushRef.current) {
      const cp   = Math.max(0, (p - 0.50) / 0.30);
      const grow = cp < 0.35 ? (cp / 0.35) * 2.0 : Math.max(0, 2.0 - ((cp - 0.35) / 0.65) * 2.0);
      const op   = cp < 0.35 ? cp / 0.35 : Math.max(0, 1 - (cp - 0.35) / 0.65);
      const sz   = scale * Math.max(0.001, grow);
      crushRef.current.scale.setScalar(sz);
      // spin the faceted crush so it reads as 3D
      crushRef.current.rotation.x = t * 3.5;
      crushRef.current.rotation.y = t * 2.2;
      (crushRef.current.material as THREE.MeshBasicMaterial).opacity = op;
      if (crushOutRef.current) {
        crushOutRef.current.scale.setScalar(sz * 1.24);
        crushOutRef.current.rotation.x = t * 3.5;
        crushOutRef.current.rotation.y = t * 2.2;
        (crushOutRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.80;
      }
    }

    // ── Void remnant (IcosahedronGeometry, spins while shrinking) ───────
    if (voidRef.current) {
      const vp  = Math.max(0, (p - 0.62) / 0.38);
      const sz  = scale * Math.max(0.001, 0.70 * (1 - vp));
      const op  = Math.max(0, 1 - vp * 1.1);
      voidRef.current.scale.setScalar(sz);
      voidRef.current.rotation.x = t * 1.8;
      voidRef.current.rotation.z = t * 2.4;
      (voidRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.82;
      if (voidOutRef.current) {
        voidOutRef.current.scale.setScalar(sz * 1.22);
        voidOutRef.current.rotation.x = t * 1.8;
        voidOutRef.current.rotation.z = t * 2.4;
        (voidOutRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.68;
      }
    }

    // ── Shockwave tori — spinning while expanding ────────────────────────
    for (let ri = 0; ri < ringDefs.length; ri++) {
      const mesh = ringRefs.current[ri];
      if (!mesh) continue;
      const r  = ringDefs[ri];
      const lp = Math.max(0, (p - r.delay) / (1 - r.delay));
      mesh.scale.setScalar(Math.max(0.001, scale * (0.18 + lp * r.rate)));
      // Spin continuously so the 3D torus tube is clearly visible
      mesh.rotation.x = r.rotX + t * r.spinX;
      mesh.rotation.z = r.rotZ + t * r.spinZ;
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - lp * 1.6) * 0.95);
    }
  });

  // ── JSX ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Suction streams — 6-sided cylinders with outline */}
      <instancedMesh ref={streamOutRef}   args={[streamGeo, streamOutMat,  STREAM_COUNT]} frustumCulled={false} />
      <instancedMesh ref={streamFillRef}  args={[streamGeo, streamFillMat, STREAM_COUNT]} frustumCulled={false} />

      {/* Primary dust specks */}
      <instancedMesh ref={speckFillRef}  args={[speckGeo, speckMat, SPECK_COUNT]} frustumCulled={false} />

      {/* Secondary micro-dust */}
      <instancedMesh ref={dustFillRef}   args={[speckGeo, dustMat,  DUST_COUNT]}  frustumCulled={false} />

      {/* 3D debris shards — IcosahedronGeometry with outline */}
      <instancedMesh ref={debrisOutRef}  args={[debrisGeo, debrisOutMat, DEBRIS_COUNT]} frustumCulled={false} />
      <instancedMesh ref={debrisFillRef} args={[debrisGeo, debrisFillMat, DEBRIS_COUNT]} frustumCulled={false} />

      {/* Crush flash — IcosahedronGeometry, spinning */}
      <mesh ref={crushOutRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#0d0d0d" transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh ref={crushRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Void remnant — IcosahedronGeometry, spinning while shrinking */}
      <mesh ref={voidOutRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#0d0d0d" transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh ref={voidRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Shockwave tori — fat tube, spinning so 3D nature is obvious */}
      {ringDefs.map((r, i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el; }}>
          <torusGeometry args={[1, r.tubeR, 12, 48]} />
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
