import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function Background() {
  const starRefs = useRef<THREE.Mesh[]>([]);

  const stars = useMemo(() => Array.from({ length: 120 }, () => ({
    pos:   [(Math.random() - 0.5) * 90, (Math.random() - 0.5) * 65, -28 - Math.random() * 20] as [number, number, number],
    scale: 0.018 + Math.random() * 0.048,
    twink: 1.4 + Math.random() * 4.2,
    phase: Math.random() * Math.PI * 2,
  })), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    starRefs.current.forEach((mesh, i) => {
      if (!mesh || !stars[i]) return;
      const s     = stars[i];
      const twink = Math.sin(t * s.twink + s.phase) * 0.5 + 0.5;
      mesh.scale.setScalar(s.scale * (0.3 + twink * 0.7));
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + twink * 0.72;
    });
  });

  return (
    <>
      <color attach="background" args={[0, 0, 0]} />

      {stars.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) starRefs.current[i] = el; }}
          position={s.pos}
          scale={s.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
