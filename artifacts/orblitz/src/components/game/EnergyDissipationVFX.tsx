import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SHARD_COUNT  = 22;
const STAR_COUNT   = 10;
const SPIKE_COUNT  = 10;

const _dummy = new THREE.Object3D();
const _q1    = new THREE.Quaternion();
const _yUp   = new THREE.Vector3(0, 1, 0);

const OUTLINE_SCALE = 1.32;

function seededRand(seed: number, i: number) {
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

interface StarDatum {
  dir:      THREE.Vector3;
  spinAxis: THREE.Vector3;
  speed:    number;
  delay:    number;
  size:     number;
}

interface Props {
  progress:  number;
  color:     string;
  glowColor?: string;
  scale?:    number;
  seed?:     number;
}

export function EnergyDissipationVFX({
  progress,
  color,
  glowColor,
  scale = 1,
  seed  = 0,
}: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const shardFillRef    = useRef<THREE.InstancedMesh>(null);
  const shardOutlineRef = useRef<THREE.InstancedMesh>(null);
  const starFillRef     = useRef<THREE.InstancedMesh>(null);
  const starOutlineRef  = useRef<THREE.InstancedMesh>(null);
  const spikeFillRef    = useRef<THREE.InstancedMesh>(null);
  const spikeOutlineRef = useRef<THREE.InstancedMesh>(null);
  const coreRef         = useRef<THREE.Mesh>(null);
  const coreOutRef      = useRef<THREE.Mesh>(null);
  const ringRefs        = useRef<(THREE.Mesh | null)[]>([]);

  const gColor = glowColor ?? color;

  const shards = useMemo<ShardDatum[]>(() => {
    const list: ShardDatum[] = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / SHARD_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + seededRand(seed, i) * 1.5;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const baseQuat = new THREE.Quaternion().setFromUnitVectors(_yUp, dir);
      const spinAxis = new THREE.Vector3(
        seededRand(seed, i * 4)     * 2 - 1,
        seededRand(seed, i * 4 + 1) * 2 - 1,
        seededRand(seed, i * 4 + 2) * 2 - 1,
      ).normalize();
      list.push({
        dir, baseQuat, spinAxis,
        speed: 0.6 + seededRand(seed, i * 5 + 1) * 0.8,
        delay: seededRand(seed, i * 5 + 2) * 0.18,
        size:  0.14 + seededRand(seed, i * 5 + 3) * 0.12,
      });
    }
    return list;
  }, [seed]);

  const stars = useMemo<StarDatum[]>(() => {
    const list: StarDatum[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const phi   = Math.acos(2 * seededRand(seed + 33, i * 3 + 1) - 1);
      const theta = 2 * Math.PI * seededRand(seed + 33, i * 3);
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const spinAxis = new THREE.Vector3(
        seededRand(seed + 33, i * 4)     * 2 - 1,
        seededRand(seed + 33, i * 4 + 1) * 2 - 1,
        seededRand(seed + 33, i * 4 + 2) * 2 - 1,
      ).normalize();
      list.push({
        dir, spinAxis,
        speed: 0.35 + seededRand(seed + 33, i * 5) * 0.5,
        delay: 0.04  + seededRand(seed + 33, i)     * 0.22,
        size:  0.09  + seededRand(seed + 33, i * 3 + 5) * 0.08,
      });
    }
    return list;
  }, [seed]);

  const spikeAngles = useMemo(
    () => Array.from({ length: SPIKE_COUNT }, (_, i) => (i / SPIKE_COUNT) * Math.PI * 2 + seededRand(seed + 7, i) * 0.4),
    [seed],
  );

  const ringDefs = useMemo(() => [
    { rotX: Math.PI / 2, rotZ: 0,           rate: 3.6, delay: 0.00, tubeR: 0.10 },
    { rotX: Math.PI / 4, rotZ: Math.PI / 5, rate: 2.4, delay: 0.07, tubeR: 0.08 },
    { rotX: 0.9,         rotZ: Math.PI / 3, rate: 2.9, delay: 0.14, tubeR: 0.09 },
  ], []);

  const shardGeo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);

  const starGeo = useMemo(() => {
    const g = new THREE.OctahedronGeometry(1, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.35);
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      if (r > 0.01) {
        pos.setX(i, x * 1.2);
        pos.setZ(i, z * 1.2);
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  const spikeGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.01, 1, 4, 1), []);

  const shardFillMat    = useMemo(() => new THREE.MeshBasicMaterial({ color,     transparent: true, depthWrite: false }), [color]);
  const shardOutlineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#111111", transparent: true, depthWrite: false, side: THREE.BackSide }), []);
  const starFillMat     = useMemo(() => new THREE.MeshBasicMaterial({ color: gColor, transparent: true, depthWrite: false }), [gColor]);
  const starOutlineMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: "#111111", transparent: true, depthWrite: false, side: THREE.BackSide }), []);
  const spikeFillMat    = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false }), []);
  const spikeOutlineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#111111", transparent: true, depthWrite: false, side: THREE.BackSide }), []);

  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.getElapsedTime();
    const maxR = 2.8 * scale;

    // ── CRYSTAL SHARDS ──────────────────────────────────────────────────────
    const shardOpacity = Math.max(0, 1.0 - p);
    for (let i = 0; i < SHARD_COUNT; i++) {
      const s  = shards[i];
      const lp = Math.max(0, (p - s.delay) / (1 - s.delay));
      if (lp <= 0) {
        _dummy.scale.setScalar(0.0001);
        _dummy.position.set(0, 0, 0);
        _dummy.quaternion.identity();
      } else {
        const eased = 1 - Math.pow(1 - Math.min(lp, 1), 2.2);
        const dist  = eased * maxR * s.speed;
        const sz    = scale * s.size * Math.max(0, 1 - lp * 0.55);
        _dummy.position.copy(s.dir).multiplyScalar(dist);
        _q1.setFromAxisAngle(s.spinAxis, t * 5 + i);
        _dummy.quaternion.copy(s.baseQuat).multiply(_q1);
        _dummy.scale.setScalar(Math.max(0.0001, sz));
      }
      _dummy.updateMatrix();
      shardFillRef.current?.setMatrixAt(i, _dummy.matrix);

      if (shardOutlineRef.current) {
        const origSz = _dummy.scale.x;
        _dummy.scale.setScalar(origSz * OUTLINE_SCALE);
        _dummy.updateMatrix();
        shardOutlineRef.current.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (shardFillRef.current) {
      shardFillRef.current.instanceMatrix.needsUpdate = true;
      (shardFillRef.current.material as THREE.MeshBasicMaterial).color.set(color);
      (shardFillRef.current.material as THREE.MeshBasicMaterial).opacity = shardOpacity;
    }
    if (shardOutlineRef.current) {
      shardOutlineRef.current.instanceMatrix.needsUpdate = true;
      (shardOutlineRef.current.material as THREE.MeshBasicMaterial).opacity = shardOpacity;
    }

    // ── SPARKLE STARS ───────────────────────────────────────────────────────
    const starOpacity = Math.max(0, 1.1 - p * 1.3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const s  = stars[i];
      const lp = Math.max(0, (p - s.delay) / (1 - s.delay));
      if (lp <= 0) {
        _dummy.scale.setScalar(0.0001);
        _dummy.position.set(0, 0, 0);
        _dummy.quaternion.identity();
      } else {
        const eased = 1 - Math.pow(1 - Math.min(lp, 1), 2.0);
        const dist  = eased * maxR * s.speed * 0.7;
        const sz    = scale * s.size * Math.max(0, 1 - lp * 0.65);
        _dummy.position.copy(s.dir).multiplyScalar(dist);
        _q1.setFromAxisAngle(s.spinAxis, t * 9 + i * 1.7);
        _dummy.quaternion.copy(_q1);
        _dummy.scale.setScalar(Math.max(0.0001, sz));
      }
      _dummy.updateMatrix();
      starFillRef.current?.setMatrixAt(i, _dummy.matrix);

      if (starOutlineRef.current) {
        const origSz = _dummy.scale.x;
        _dummy.scale.setScalar(origSz * OUTLINE_SCALE);
        _dummy.updateMatrix();
        starOutlineRef.current.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (starFillRef.current) {
      starFillRef.current.instanceMatrix.needsUpdate = true;
      (starFillRef.current.material as THREE.MeshBasicMaterial).color.set(gColor);
      (starFillRef.current.material as THREE.MeshBasicMaterial).opacity = starOpacity;
    }
    if (starOutlineRef.current) {
      starOutlineRef.current.instanceMatrix.needsUpdate = true;
      (starOutlineRef.current.material as THREE.MeshBasicMaterial).opacity = starOpacity;
    }

    // ── IMPACT SPIKES (cartoon radial lines) ────────────────────────────────
    const spikeLp   = Math.min(1, p / 0.45);
    const spikeOp   = Math.max(0, 1 - spikeLp * 1.8);
    const spikeMaxL = scale * 1.4;
    for (let i = 0; i < SPIKE_COUNT; i++) {
      const angle  = spikeAngles[i];
      const length = spikeLp * spikeMaxL * (0.7 + seededRand(seed + 5, i) * 0.6);
      const offset = length * 0.5 + scale * 0.2;
      _dummy.position.set(Math.cos(angle) * offset, Math.sin(angle) * offset, 0);
      _dummy.quaternion.setFromAxisAngle(_yUp, angle + Math.PI / 2);
      _dummy.scale.set(scale * 0.08, Math.max(0.0001, length), scale * 0.08);
      _dummy.updateMatrix();
      spikeFillRef.current?.setMatrixAt(i, _dummy.matrix);
      if (spikeOutlineRef.current) {
        _dummy.scale.set(scale * 0.08 * OUTLINE_SCALE, Math.max(0.0001, length), scale * 0.08 * OUTLINE_SCALE);
        _dummy.updateMatrix();
        spikeOutlineRef.current.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (spikeFillRef.current) {
      spikeFillRef.current.instanceMatrix.needsUpdate = true;
      (spikeFillRef.current.material as THREE.MeshBasicMaterial).opacity = spikeOp;
    }
    if (spikeOutlineRef.current) {
      spikeOutlineRef.current.instanceMatrix.needsUpdate = true;
      (spikeOutlineRef.current.material as THREE.MeshBasicMaterial).opacity = spikeOp;
    }

    // ── CORE FLASH ──────────────────────────────────────────────────────────
    if (coreRef.current) {
      const fp   = Math.min(1, p / 0.25);
      const grow = fp < 0.35
        ? (0.5 + fp * 4.5)
        : (2.1 - (fp - 0.35) / 0.65 * 1.9);
      const flashOp = Math.max(0, (1 - fp) * 1.15);
      coreRef.current.scale.setScalar(scale * Math.max(0.001, grow));
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = flashOp;
      if (coreOutRef.current) {
        coreOutRef.current.scale.setScalar(scale * Math.max(0.001, grow) * 1.18);
        (coreOutRef.current.material as THREE.MeshBasicMaterial).opacity = flashOp * 0.85;
      }
    }

    // ── FAT CARTOON RINGS ───────────────────────────────────────────────────
    for (let ri = 0; ri < ringDefs.length; ri++) {
      const mesh = ringRefs.current[ri];
      if (!mesh) continue;
      const r   = ringDefs[ri];
      const lp  = Math.max(0, (p - r.delay) / (1 - r.delay));
      const rsc = scale * (0.3 + lp * r.rate);
      mesh.scale.setScalar(Math.max(0.001, rsc));
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - lp * 1.6) * 0.95);
    }
  });

  return (
    <>
      {/* Core flash — outline then fill */}
      <mesh ref={coreOutRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#111111" transparent opacity={1} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} depthWrite={false} />
      </mesh>

      {/* Radial impact spikes — toon cartoon lines */}
      <instancedMesh ref={spikeOutlineRef} args={[spikeGeo, spikeOutlineMat, SPIKE_COUNT]} frustumCulled={false} />
      <instancedMesh ref={spikeFillRef}    args={[spikeGeo, spikeFillMat,    SPIKE_COUNT]} frustumCulled={false} />

      {/* Fat shockwave rings at different 3D tilts */}
      {ringDefs.map((r, i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el; }} rotation={[r.rotX, 0, r.rotZ]}>
          <torusGeometry args={[1, r.tubeR, 8, 44]} />
          <meshBasicMaterial
            color={i === 1 ? gColor : color}
            transparent opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Crystal octahedron shards — outline behind fill */}
      <instancedMesh ref={shardOutlineRef} args={[shardGeo, shardOutlineMat, SHARD_COUNT]} frustumCulled={false} />
      <instancedMesh ref={shardFillRef}    args={[shardGeo, shardFillMat,    SHARD_COUNT]} frustumCulled={false} />

      {/* Flat sparkle star shapes — outline behind fill */}
      <instancedMesh ref={starOutlineRef} args={[starGeo, starOutlineMat, STAR_COUNT]} frustumCulled={false} />
      <instancedMesh ref={starFillRef}    args={[starGeo, starFillMat,    STAR_COUNT]} frustumCulled={false} />
    </>
  );
}
