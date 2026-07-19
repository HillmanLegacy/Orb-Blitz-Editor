/**
 * MiniMechaOrb — projectile fired by the Level 8.9 Mecha Boss.
 * Procedural mini-version of the Mecha Boss aesthetic:
 *   • Dark steel hexagonal body
 *   • Two counter-rotating micro gear arcs
 *   • A single scanning LED "eye"
 *   • Steel-blue / cyan glow
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface MiniMechaOrbProps {
  radius?: number;
}

export function MiniMechaOrb({ radius = 1 }: MiniMechaOrbProps) {
  const arcOutRef = useRef<THREE.Group>(null);
  const arcInRef  = useRef<THREE.Group>(null);
  const eyeRef    = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (arcOutRef.current) arcOutRef.current.rotation.z -= delta * 2.8;
    if (arcInRef.current)  arcInRef.current.rotation.z  += delta * 4.2;
    if (eyeRef.current) {
      const mat = eyeRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 + Math.abs(Math.sin(t * 6)) * 0.3;
    }
  });

  const r  = radius;
  const or = r * 1.22; // outer arc radius
  const ir = r * 0.88; // inner arc radius

  return (
    <group>
      {/* Steel-blue point light */}
      <pointLight color="#33aaff" intensity={1.6} distance={4.5} decay={2} />

      {/* Hex body */}
      <mesh>
        <circleGeometry args={[r, 6]} />
        <meshBasicMaterial color="#0d1a22" />
      </mesh>
      {/* Body highlight */}
      <mesh scale={r * 0.65} position={[0.06 * r, 0.06 * r, 0.005]}>
        <circleGeometry args={[1, 6]} />
        <meshBasicMaterial color="#223344" transparent opacity={0.5} />
      </mesh>

      {/* Outer arc — 3 visible segments of ~60° each */}
      <group ref={arcOutRef}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * or, Math.sin(a) * or, 0.01]} rotation={[0, 0, a + Math.PI / 2]}>
              <planeGeometry args={[0.06, 0.13]} />
              <meshBasicMaterial color="#33bbdd" transparent opacity={0.9} />
            </mesh>
          );
        })}
        {/* Thin track ring */}
        <mesh>
          <ringGeometry args={[or - 0.02, or + 0.01, 32]} />
          <meshBasicMaterial color="#224455" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Inner arc — 4 tiny segments */}
      <group ref={arcInRef}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * ir, Math.sin(a) * ir, 0.015]} rotation={[0, 0, a + Math.PI / 2]}>
              <planeGeometry args={[0.04, 0.09]} />
              <meshBasicMaterial color="#00ccff" transparent opacity={0.75} />
            </mesh>
          );
        })}
      </group>

      {/* Scanning LED eye */}
      <mesh ref={eyeRef} position={[0, r * 0.18, 0.02]}>
        <circleGeometry args={[r * 0.16, 8]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Eye glow ring */}
      <mesh position={[0, r * 0.18, 0.015]}>
        <ringGeometry args={[r * 0.16, r * 0.22, 8]} />
        <meshBasicMaterial color="#0088aa" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
