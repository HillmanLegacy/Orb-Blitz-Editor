/**
 * ToonImplosionVFX
 *
 * Phases (progress 0→1):
 *  0.00 – 0.75  Cel-outlined crystal shards + sparkle stars rush INWARD (ease-in³)
 *  0.00 – 0.70  Suction streams (thin cylinders) converge toward center
 *  0.50 – 0.75  Crush flash — low-poly sphere pops at center
 *  0.62 – 1.00  Void sphere — dark remnant shrinks away
 *  0.58 – 1.00  Three fat shockwave tori expand outward after the collapse
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SHARD_COUNT  = 22;
const STAR_COUNT   = 12;
const STREAM_COUNT = 10;

const _dummy = new THREE.Object3D();
const _q1    = new THREE.Quaternion();
const _yUp   = new THREE.Vector3(0, 1, 0);
const _OUTLINE = 1.30;

function sr(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

interface ShardDatum {
  dir:      THREE.Vector3;
  baseQuat: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  speed:    number;
  delay:    number;
  size:     number;
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

  const shardFillRef    = useRef<THREE.InstancedMesh>(null);
  const shardOutlineRef = useRef<THREE.InstancedMesh>(null);
  const starFillRef     = useRef<THREE.InstancedMesh>(null);
  const starOutlineRef  = useRef<THREE.InstancedMesh>(null);
  const streamFillRef   = useRef<THREE.InstancedMesh>(null);
  const streamOutRef    = useRef<THREE.InstancedMesh>(null);

  const crushRef    = useRef<THREE.Mesh>(null);
  const crushOutRef = useRef<THREE.Mesh>(null);
  const voidRef     = useRef<THREE.Mesh>(null);
  const voidOutRef  = useRef<THREE.Mesh>(null);
  const ringRefs    = useRef<(THREE.Mesh | null)[]>([]);

  const gColor = glowColor ?? color;

  // ── Data ─────────────────────────────────────────────────────────────────

  const shards = useMemo<ShardDatum[]>(() => {
    const list: ShardDatum[] = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / SHARD_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + sr(seed, i) * 1.5;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const baseQuat = new THREE.Quaternion().setFromUnitVectors(_yUp, dir);
      const spinAxis = new THREE.Vector3(
        sr(seed, i * 4)     * 2 - 1,
        sr(seed, i * 4 + 1) * 2 - 1,
        sr(seed, i * 4 + 2) * 2 - 1,
      ).normalize();
      list.push({
        dir, baseQuat, spinAxis,
        speed: 0.55 + sr(seed, i * 5 + 1) * 0.7,
        delay: sr(seed, i * 5 + 2) * 0.12,
        size:  0.13 + sr(seed, i * 5 + 3) * 0.11,
      });
    }
    return list;
  }, [seed]);

  const stars = useMemo<ShardDatum[]>(() => {
    const list: ShardDatum[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const phi   = Math.acos(2 * sr(seed + 33, i * 3 + 1) - 1);
      const theta = 2 * Math.PI * sr(seed + 33, i * 3);
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const spinAxis = new THREE.Vector3(
        sr(seed + 33, i * 4)     * 2 - 1,
        sr(seed + 33, i * 4 + 1) * 2 - 1,
        sr(seed + 33, i * 4 + 2) * 2 - 1,
      ).normalize();
      list.push({
        dir,
        baseQuat: new THREE.Quaternion().setFromUnitVectors(_yUp, dir),
        spinAxis,
        speed: 0.4 + sr(seed + 33, i * 5)     * 0.45,
        delay: sr(seed + 33, i)                * 0.10,
        size:  0.08 + sr(seed + 33, i * 3 + 5) * 0.07,
      });
    }
    return list;
  }, [seed]);

  const streamDirs = useMemo(
    () => Array.from({ length: STREAM_COUNT }, (_, i) => {
      const angle = (i / STREAM_COUNT) * Math.PI * 2 + sr(seed + 7, i) * 0.5;
      const pitch = (sr(seed + 7, i + 100) - 0.5) * Math.PI * 0.6;
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

  const shardGeo  = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);

  const starGeo = useMemo(() => {
    const g   = new THREE.OctahedronGeometry(1, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.35);
      pos.setX(i, pos.getX(i) * 1.25);
      pos.setZ(i, pos.getZ(i) * 1.25);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  const streamGeo = useMemo(() => new THREE.CylinderGeometry(0.045, 0.008, 1, 4, 1), []);

  const shardFill    = useMemo(() => new THREE.MeshBasicMaterial({ color,      transparent: true, depthWrite: false }), [color]);
  const shardOut     = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0a0a0a", transparent: true, depthWrite: false, side: THREE.BackSide }), []);
  const starFill     = useMemo(() => new THREE.MeshBasicMaterial({ color: gColor, transparent: true, depthWrite: false }), [gColor]);
  const starOut      = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0a0a0a", transparent: true, depthWrite: false, side: THREE.BackSide }), []);
  const streamFill   = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff",  transparent: true, depthWrite: false }), []);
  const streamOutMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0a0a0a", transparent: true, depthWrite: false, side: THREE.BackSide }), []);

  // ── Frame update ──────────────────────────────────────────────────────────

  useFrame((state) => {
    const p    = progressRef.current;
    const t    = state.clock.getElapsedTime();
    const maxR = 2.8 * scale;

    // HELPER: ease-in³ → particles accelerate toward center
    const easeIn = (lp: number) => Math.pow(Math.min(lp, 1), 3.2);

    // ── Crystal shards rushing INWARD ──────────────────────────────────────
    const shardOp = Math.max(0, 1 - Math.max(0, p - 0.55) / 0.22);
    for (let i = 0; i < SHARD_COUNT; i++) {
      const s  = shards[i];
      const lp = Math.max(0, (p - s.delay) / (0.78 - s.delay));
      if (lp <= 0) {
        _dummy.position.copy(s.dir).multiplyScalar(maxR * s.speed);
        _q1.setFromAxisAngle(s.spinAxis, t * 5 + i);
        _dummy.quaternion.copy(s.baseQuat).multiply(_q1);
        _dummy.scale.setScalar(scale * s.size);
      } else {
        const dist = (1 - easeIn(lp)) * maxR * s.speed;
        const sz   = scale * s.size * (0.5 + 0.5 * (1 - easeIn(lp)));
        _dummy.position.copy(s.dir).multiplyScalar(Math.max(0, dist));
        _q1.setFromAxisAngle(s.spinAxis, t * 5 + i);
        _dummy.quaternion.copy(s.baseQuat).multiply(_q1);
        _dummy.scale.setScalar(Math.max(0.0001, sz));
      }
      _dummy.updateMatrix();
      shardFillRef.current?.setMatrixAt(i, _dummy.matrix);
      if (shardOutlineRef.current) {
        _dummy.scale.multiplyScalar(_OUTLINE);
        _dummy.updateMatrix();
        shardOutlineRef.current.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (shardFillRef.current) {
      shardFillRef.current.instanceMatrix.needsUpdate = true;
      (shardFillRef.current.material as THREE.MeshBasicMaterial).color.set(color);
      (shardFillRef.current.material as THREE.MeshBasicMaterial).opacity = shardOp;
    }
    if (shardOutlineRef.current) {
      shardOutlineRef.current.instanceMatrix.needsUpdate = true;
      (shardOutlineRef.current.material as THREE.MeshBasicMaterial).opacity = shardOp;
    }

    // ── Sparkle stars rushing INWARD ───────────────────────────────────────
    const starOp = Math.max(0, 1 - Math.max(0, p - 0.50) / 0.25);
    for (let i = 0; i < STAR_COUNT; i++) {
      const s  = stars[i];
      const lp = Math.max(0, (p - s.delay) / (0.72 - s.delay));
      const dist = (1 - easeIn(lp)) * maxR * s.speed * 0.78;
      const sz   = scale * s.size * (0.5 + 0.5 * (1 - easeIn(Math.min(lp, 1))));
      _dummy.position.copy(s.dir).multiplyScalar(Math.max(0, dist));
      _q1.setFromAxisAngle(s.spinAxis, t * 10 + i * 1.6);
      _dummy.quaternion.copy(_q1);
      _dummy.scale.setScalar(Math.max(0.0001, sz));
      _dummy.updateMatrix();
      starFillRef.current?.setMatrixAt(i, _dummy.matrix);
      if (starOutlineRef.current) {
        _dummy.scale.multiplyScalar(_OUTLINE);
        _dummy.updateMatrix();
        starOutlineRef.current.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (starFillRef.current) {
      starFillRef.current.instanceMatrix.needsUpdate = true;
      (starFillRef.current.material as THREE.MeshBasicMaterial).color.set(gColor);
      (starFillRef.current.material as THREE.MeshBasicMaterial).opacity = starOp;
    }
    if (starOutlineRef.current) {
      starOutlineRef.current.instanceMatrix.needsUpdate = true;
      (starOutlineRef.current.material as THREE.MeshBasicMaterial).opacity = starOp;
    }

    // ── Suction streams ─────────────────────────────────────────────────────
    // Long thin cylinders with tip pointing toward center, shrinking as they arrive
    const streamProgress = Math.min(1, p / 0.65);
    const streamOp = Math.max(0, 1 - Math.max(0, p - 0.45) / 0.25);
    for (let i = 0; i < STREAM_COUNT; i++) {
      const dir    = streamDirs[i];
      const spd    = 0.55 + sr(seed + 7, i * 3) * 0.45;
      const lp     = easeIn(streamProgress * spd);
      const tipDist = (1 - lp) * maxR * 0.95;
      const len    = Math.max(0.0001, (1 - Math.pow(streamProgress * spd, 0.35)) * scale * 1.5);
      _dummy.position.copy(dir).multiplyScalar(tipDist + len * 0.5);
      _dummy.quaternion.setFromUnitVectors(_yUp, dir.clone().negate());
      _dummy.scale.set(scale * 0.07, len, scale * 0.07);
      _dummy.updateMatrix();
      streamFillRef.current?.setMatrixAt(i, _dummy.matrix);
      if (streamOutRef.current) {
        _dummy.scale.set(scale * 0.07 * _OUTLINE, len, scale * 0.07 * _OUTLINE);
        _dummy.updateMatrix();
        streamOutRef.current.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (streamFillRef.current) {
      streamFillRef.current.instanceMatrix.needsUpdate = true;
      (streamFillRef.current.material as THREE.MeshBasicMaterial).color.set("#ffffff");
      (streamFillRef.current.material as THREE.MeshBasicMaterial).opacity = streamOp;
    }
    if (streamOutRef.current) {
      streamOutRef.current.instanceMatrix.needsUpdate = true;
      (streamOutRef.current.material as THREE.MeshBasicMaterial).opacity = streamOp * 0.8;
    }

    // ── Crush flash (center implosion burst) ───────────────────────────────
    if (crushRef.current) {
      const cp  = Math.max(0, (p - 0.50) / 0.25);  // 0→1 over p 0.50–0.75
      const grow = cp < 0.4 ? (cp / 0.4) * 1.6 : (1.6 - ((cp - 0.4) / 0.6) * 1.6);
      const op   = cp < 0.4 ? cp / 0.4 : Math.max(0, 1 - (cp - 0.4) / 0.6);
      crushRef.current.scale.setScalar(scale * Math.max(0.001, grow));
      (crushRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.95;
      if (crushOutRef.current) {
        crushOutRef.current.scale.setScalar(scale * Math.max(0.001, grow) * 1.2);
        (crushOutRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.8;
      }
    }

    // ── Void remnant ───────────────────────────────────────────────────────
    if (voidRef.current) {
      const vp  = Math.max(0, (p - 0.62) / 0.38);  // 0→1 over p 0.62–1.0
      const sz  = scale * Math.max(0.001, 0.7 * (1 - vp));
      const op  = Math.max(0, 1 - vp * 1.1);
      voidRef.current.scale.setScalar(sz);
      (voidRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.85;
      if (voidOutRef.current) {
        voidOutRef.current.scale.setScalar(sz * 1.2);
        (voidOutRef.current.material as THREE.MeshBasicMaterial).opacity = op * 0.7;
      }
    }

    // ── Post-implosion shockwave rings ─────────────────────────────────────
    for (let ri = 0; ri < ringDefs.length; ri++) {
      const mesh = ringRefs.current[ri];
      if (!mesh) continue;
      const r  = ringDefs[ri];
      const lp = Math.max(0, (p - r.delay) / (1 - r.delay));
      mesh.scale.setScalar(Math.max(0.001, scale * (0.2 + lp * r.rate)));
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - lp * 1.6) * 0.95);
    }
  });

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Suction streams (behind shards) */}
      <instancedMesh ref={streamOutRef}   args={[streamGeo, streamOutMat, STREAM_COUNT]} frustumCulled={false} />
      <instancedMesh ref={streamFillRef}  args={[streamGeo, streamFill,   STREAM_COUNT]} frustumCulled={false} />

      {/* Crystal shards — outline then fill */}
      <instancedMesh ref={shardOutlineRef} args={[shardGeo, shardOut,  SHARD_COUNT]} frustumCulled={false} />
      <instancedMesh ref={shardFillRef}    args={[shardGeo, shardFill, SHARD_COUNT]} frustumCulled={false} />

      {/* Sparkle stars — outline then fill */}
      <instancedMesh ref={starOutlineRef} args={[starGeo, starOut,  STAR_COUNT]} frustumCulled={false} />
      <instancedMesh ref={starFillRef}    args={[starGeo, starFill, STAR_COUNT]} frustumCulled={false} />

      {/* Crush flash — outline then fill */}
      <mesh ref={crushOutRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#0a0a0a" transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh ref={crushRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Void remnant */}
      <mesh ref={voidOutRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#0a0a0a" transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
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
