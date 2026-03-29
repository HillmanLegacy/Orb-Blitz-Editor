import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 48;

interface Particle {
  radius: number;
  speed: number;     // radians / second (signed)
  phase: number;     // initial angle offset
  perp1: THREE.Vector3; // first basis vector of orbital plane
  perp2: THREE.Vector3; // second basis vector (perp to perp1 & axis)
  baseSize: number;
  pulseSpeed: number;
  pulsePhase: number;
  colorIndex: number;
}

interface PlayerParticlesProps {
  scale: number;
  particleColors: string[];
  isRainbow?: boolean;
}

// Reuse a single dummy Object3D for matrix computation
const _dummy = new THREE.Object3D();

export function PlayerParticles({
  scale,
  particleColors,
  isRainbow = false,
}: PlayerParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const colors = particleColors.length > 0 ? particleColors : ["#ffffff"];

  // Build per-particle data once (regenerate if scale or color count changes)
  const particles = useMemo<Particle[]>(() => {
    const list: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random axis for the orbital plane normal
      const axis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();

      // Two perpendicular vectors spanning the orbital plane
      let ref = new THREE.Vector3(0, 1, 0);
      if (Math.abs(axis.dot(ref)) > 0.85) ref.set(1, 0, 0);
      const perp1 = new THREE.Vector3().crossVectors(axis, ref).normalize();
      const perp2 = new THREE.Vector3().crossVectors(axis, perp1).normalize();

      list.push({
        radius: scale * (0.75 + Math.random() * 0.65),
        speed:  (0.55 + Math.random() * 1.35) * (Math.random() < 0.5 ? 1 : -1),
        phase:  Math.random() * Math.PI * 2,
        perp1,
        perp2,
        baseSize:   0.022 + Math.random() * 0.028,
        pulseSpeed: 2.5 + Math.random() * 3.5,
        pulsePhase: Math.random() * Math.PI * 2,
        colorIndex: i % colors.length,
      });
    }
    return list;
  }, [scale, colors.length]);

  // Set initial vertex colours
  useEffect(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      const c = new THREE.Color(colors[p.colorIndex]);
      meshRef.current!.setColorAt(i, c);
    });
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles, colors]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    let needColorUpdate = false;

    particles.forEach((p, i) => {
      const theta = time * p.speed + p.phase;
      const cosT  = Math.cos(theta);
      const sinT  = Math.sin(theta);

      // 3-D position on the tilted orbital ellipse
      _dummy.position.set(
        (p.perp1.x * cosT + p.perp2.x * sinT) * p.radius,
        (p.perp1.y * cosT + p.perp2.y * sinT) * p.radius,
        (p.perp1.z * cosT + p.perp2.z * sinT) * p.radius,
      );

      // Pulsating size
      const pulse = p.baseSize * (0.55 + Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.45);
      _dummy.scale.setScalar(pulse);
      _dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, _dummy.matrix);

      // Rainbow: cycle each particle through the hue wheel
      if (isRainbow) {
        const hue = ((time * 0.18 + i / PARTICLE_COUNT) % 1);
        meshRef.current!.setColorAt(i, new THREE.Color().setHSL(hue, 1.0, 0.62));
        needColorUpdate = true;
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (needColorUpdate && meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  // Geometry & material created once
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true }),
    [],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PARTICLE_COUNT]}
    />
  );
}
