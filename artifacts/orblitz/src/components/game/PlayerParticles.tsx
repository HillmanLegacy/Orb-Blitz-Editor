import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 48;

interface Particle {
  radius: number;
  speed: number;
  phase: number;
  perp1: THREE.Vector3;
  perp2: THREE.Vector3;
  baseSize: number;
  pulseSpeed: number;
  pulsePhase: number;
}

interface PlayerParticlesProps {
  scale: number;
  particleColors: string[];
  isRainbow?: boolean;
}

const _dummy = new THREE.Object3D();

export function PlayerParticles({
  scale,
  particleColors,
  isRainbow = false,
}: PlayerParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const baseColor = particleColors[0] ?? "#ffffff";

  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const axis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();

      let ref = new THREE.Vector3(0, 1, 0);
      if (Math.abs(axis.dot(ref)) > 0.85) ref.set(1, 0, 0);
      const perp1 = new THREE.Vector3().crossVectors(axis, ref).normalize();
      const perp2 = new THREE.Vector3().crossVectors(axis, perp1).normalize();

      list.push({
        radius:     scale * (0.75 + Math.random() * 0.65),
        speed:      (0.55 + Math.random() * 1.35) * (Math.random() < 0.5 ? 1 : -1),
        phase:      Math.random() * Math.PI * 2,
        perp1,
        perp2,
        baseSize:   0.022 + Math.random() * 0.028,
        pulseSpeed: 2.5 + Math.random() * 3.5,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    return list;
  }, [scale]);

  // Single shared material — update its colour every frame, no instanceColor needed
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: baseColor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;

    // Keep material colour in sync every frame
    if (isRainbow) {
      mat.color.setHSL(time * 0.18 % 1, 1.0, 0.62);
    } else {
      mat.color.set(baseColor);
    }

    particles.forEach((p, i) => {
      const theta = time * p.speed + p.phase;
      const cosT  = Math.cos(theta);
      const sinT  = Math.sin(theta);

      _dummy.position.set(
        (p.perp1.x * cosT + p.perp2.x * sinT) * p.radius,
        (p.perp1.y * cosT + p.perp2.y * sinT) * p.radius,
        (p.perp1.z * cosT + p.perp2.z * sinT) * p.radius,
      );

      const pulse = p.baseSize * (0.55 + Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.45);
      _dummy.scale.setScalar(pulse);
      _dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, _dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PARTICLE_COUNT]}
    />
  );
}
