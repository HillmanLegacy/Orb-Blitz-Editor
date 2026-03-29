import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SHARD_COUNT = 40;
const SPARK_COUNT = 24;
const RING_COUNT  = 3;

const _dummy = new THREE.Object3D();
const _zUp   = new THREE.Vector3(0, 1, 0);

function seededRand(seed: number, i: number) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

interface ShardDatum {
  dir: THREE.Vector3;
  quat: THREE.Quaternion;
  speed: number;
  delay: number;
}

interface SparkDatum {
  dir: THREE.Vector3;
  speed: number;
  delay: number;
  phase: number;
}

interface RingDatum {
  rotX: number;
  rotZ: number;
  expansionRate: number;
  delay: number;
}

interface Props {
  progress: number;
  color: string;
  glowColor?: string;
  scale?: number;
  seed?: number;
}

export function EnergyDissipationVFX({ progress, color, glowColor, scale = 1, seed = 0 }: Props) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const shardRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const coreRef  = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const gColor = glowColor ?? color;

  const shards = useMemo<ShardDatum[]>(() => {
    const list: ShardDatum[] = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / SHARD_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + seededRand(seed, i) * 1.2;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(_zUp, dir);
      list.push({
        dir,
        quat,
        speed: 0.65 + seededRand(seed, i * 3 + 1) * 0.7,
        delay: seededRand(seed, i * 3 + 2) * 0.18,
      });
    }
    return list;
  }, [seed]);

  const sparks = useMemo<SparkDatum[]>(() => {
    const list: SparkDatum[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const u   = seededRand(seed + 77, i * 3);
      const v   = seededRand(seed + 77, i * 3 + 1);
      const phi = Math.acos(2 * v - 1);
      const theta = 2 * Math.PI * u;
      list.push({
        dir: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        ).normalize(),
        speed: 0.4 + seededRand(seed + 77, i * 3 + 2) * 0.9,
        delay: 0.03 + seededRand(seed + 77, i) * 0.28,
        phase: seededRand(seed + 77, i * 9) * Math.PI * 2,
      });
    }
    return list;
  }, [seed]);

  const rings = useMemo<RingDatum[]>(() => [
    { rotX: Math.PI / 2,          rotZ: 0,             expansionRate: 4.5, delay: 0.0  },
    { rotX: Math.PI / 4,          rotZ: Math.PI / 6,   expansionRate: 2.8, delay: 0.05 },
    { rotX: Math.PI / 2 + 0.4,   rotZ: Math.PI / 3,   expansionRate: 3.5, delay: 0.1  },
  ], []);

  const shardGeo = useMemo(() => new THREE.CapsuleGeometry(0.18, 0.6, 3, 6), []);
  const sparkGeo = useMemo(() => new THREE.SphereGeometry(1, 4, 3), []);

  const shardMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, depthWrite: false }),
    [color],
  );
  const sparkMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: gColor, transparent: true, depthWrite: false }),
    [gColor],
  );

  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.getElapsedTime();
    const maxR = 3.2 * scale;

    if (shardRef.current) {
      for (let i = 0; i < SHARD_COUNT; i++) {
        const s  = shards[i];
        const lp = Math.max(0, (p - s.delay) / (1 - s.delay));
        if (lp <= 0) {
          _dummy.scale.setScalar(0.0001);
          _dummy.position.set(0, 0, 0);
        } else {
          const eased = 1 - Math.pow(1 - Math.min(lp, 1), 2.2);
          const dist      = eased * maxR * s.speed;
          const thickness = scale * 0.032 * (1 - lp * 0.72);
          const length    = scale * 0.18  * (1 - lp * 0.52);
          _dummy.position.copy(s.dir).multiplyScalar(Math.max(0, dist));
          _dummy.quaternion.copy(s.quat);
          _dummy.scale.set(
            Math.max(0.0001, thickness),
            Math.max(0.0001, length),
            Math.max(0.0001, thickness),
          );
        }
        _dummy.updateMatrix();
        shardRef.current.setMatrixAt(i, _dummy.matrix);
      }
      shardRef.current.instanceMatrix.needsUpdate = true;
      const mat = shardRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(color);
      mat.opacity = Math.max(0, 1.0 - p);
      mat.transparent = true;
    }

    if (sparkRef.current) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const s  = sparks[i];
        const lp = Math.max(0, (p - s.delay) / (1 - s.delay));
        if (lp <= 0) {
          _dummy.scale.setScalar(0.0001);
          _dummy.position.set(0, 0, 0);
        } else {
          const twinkle = (Math.sin(t * 9 + s.phase) + 1) * 0.5;
          const dist = lp * maxR * s.speed * 0.62;
          const sz   = scale * 0.038 * (1 - lp * 0.88) * (0.4 + twinkle * 0.6);
          _dummy.position.copy(s.dir).multiplyScalar(Math.max(0, dist));
          _dummy.scale.setScalar(Math.max(0.0001, sz));
        }
        _dummy.updateMatrix();
        sparkRef.current.setMatrixAt(i, _dummy.matrix);
      }
      sparkRef.current.instanceMatrix.needsUpdate = true;
      const mat = sparkRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(gColor);
      mat.opacity = Math.max(0, 1.0 - p * 1.1);
    }

    if (coreRef.current) {
      const flashP   = Math.min(1, p / 0.3);
      const grow     = flashP < 0.35 ? (0.8 + flashP * 3.5) : (2.0 - (flashP - 0.35) / 0.65 * 1.6);
      const flashOpacity = Math.max(0, (1 - flashP) * 1.15);
      coreRef.current.scale.setScalar(scale * Math.max(0.001, grow));
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = flashOpacity;
    }

    for (let ri = 0; ri < RING_COUNT; ri++) {
      const mesh = ringRefs.current[ri];
      if (!mesh) continue;
      const r  = rings[ri];
      const lp = Math.max(0, (p - r.delay) / (1 - r.delay));
      const ringScale = scale * (0.4 + lp * r.expansionRate);
      mesh.scale.setScalar(Math.max(0.001, ringScale));
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - lp * 1.8) * 0.75);
    }
  });

  return (
    <>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} depthWrite={false} />
      </mesh>

      {rings.map((r, i) => (
        <mesh
          key={i}
          ref={(el) => { ringRefs.current[i] = el; }}
          rotation={[r.rotX, 0, r.rotZ]}
        >
          <torusGeometry args={[1, 0.03, 6, 48]} />
          <meshBasicMaterial color={i === 1 ? gColor : color} transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ))}

      <instancedMesh ref={shardRef} args={[shardGeo, shardMat, SHARD_COUNT]} frustumCulled={false} />
      <instancedMesh ref={sparkRef} args={[sparkGeo, sparkMat, SPARK_COUNT]} frustumCulled={false} />
    </>
  );
}
