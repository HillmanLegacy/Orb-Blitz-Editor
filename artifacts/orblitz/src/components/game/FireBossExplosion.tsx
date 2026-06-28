import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 800;

interface Particle {
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  colorIndex: number;
}

const FIRE_COLORS = [
  new THREE.Color("#ff2200"),
  new THREE.Color("#ff5500"),
  new THREE.Color("#ff8800"),
  new THREE.Color("#ffcc00"),
  new THREE.Color("#ffffff"),
  new THREE.Color("#ff3300"),
  new THREE.Color("#ff6600"),
];

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface FireBossExplosionProps {
  progress: number;
}

export function FireBossExplosion({ progress }: FireBossExplosionProps) {
  const pointsRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const initialized = useRef(false);

  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3.5 + Math.random() * 12;
      list.push({
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          (Math.random() - 0.5) * speed * 0.3,
        ),
        life: Math.random(),
        maxLife: 0.4 + Math.random() * 0.6,
        size: 0.04 + Math.random() * 0.14,
        colorIndex: Math.floor(Math.random() * FIRE_COLORS.length),
      });
    }
    return list;
  }, []);

  const geo = useMemo(() => new THREE.SphereGeometry(1, 4, 3), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ff6600",
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  }), []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    if (!initialized.current) {
      initialized.current = true;
      particles.forEach((p) => { p.life = 0; });
    }

    let allDead = true;
    particles.forEach((p, i) => {
      p.life += delta;
      const t = p.life / p.maxLife;

      if (t < 1) {
        allDead = false;
        const alpha = 1 - t * t;
        const gravity = -1.5 * p.life * p.life;

        _dummy.position.set(
          p.velocity.x * p.life,
          p.velocity.y * p.life + gravity,
          p.velocity.z * p.life,
        );
        const s = p.size * (1 - t * 0.5);
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        pointsRef.current!.setMatrixAt(i, _dummy.matrix);

        const c = FIRE_COLORS[p.colorIndex];
        _color.copy(c);
        _color.multiplyScalar(alpha * 2.0);
        pointsRef.current!.setColorAt(i, _color);
      } else {
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        pointsRef.current!.setMatrixAt(i, _dummy.matrix);
      }
    });

    pointsRef.current.instanceMatrix.needsUpdate = true;
    if (pointsRef.current.instanceColor) {
      pointsRef.current.instanceColor.needsUpdate = true;
    }

    if (ringRef.current) {
      const ringScale = 1 + progress * 14;
      ringRef.current.scale.set(ringScale, ringScale, 1);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - progress * 1.2);
    }
    if (innerRingRef.current) {
      const s2 = 1 + progress * 7;
      innerRingRef.current.scale.set(s2, s2, 1);
      (innerRingRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - progress * 1.0);
    }
  });

  return (
    <group>
      {/* Expanding shockwave rings */}
      <mesh ref={ringRef} position={[0, 0, 0.05]}>
        <ringGeometry args={[0.9, 1.0, 48]} />
        <meshBasicMaterial
          color="#ffaa00"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={innerRingRef} position={[0, 0, 0.04]}>
        <ringGeometry args={[0.7, 0.9, 48]} />
        <meshBasicMaterial
          color="#ff4400"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central flash */}
      <mesh position={[0, 0, 0.03]} scale={Math.max(0, (1 - progress * 3) * 4)}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={Math.max(0, 0.9 - progress * 4)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Fire particles */}
      <instancedMesh ref={pointsRef} args={[geo, mat, PARTICLE_COUNT]}>
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          vertexColors
        />
      </instancedMesh>

      {/* Secondary smoke puffs */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const r = progress * 5;
        const op = Math.max(0, 0.4 - progress * 0.5);
        return (
          <mesh key={i}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 0.02]}
            scale={0.3 + progress * 1.5}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial
              color="#ff4400"
              transparent
              opacity={op}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
