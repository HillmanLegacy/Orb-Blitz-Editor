import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, LaserBeam } from "@/lib/stores/useMagicOrb";

function LaserBeamMesh({ beam, time }: { beam: LaserBeam; time: number }) {
  const beamRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const progress = 1 - beam.timer / 0.5;
  
  const [sx, sy, sz] = beam.start;
  const [ex, ey, ez] = beam.end;
  
  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;
  const midZ = (sz + ez) / 2;
  
  const length = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2 + (ez - sz) ** 2);
  
  const direction = new THREE.Vector3(ex - sx, ey - sy, ez - sz).normalize();
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  
  useFrame(() => {
    const pulseTime = time * 50;
    
    if (beamRef.current) {
      const pulseWidth = 0.5 + Math.sin(pulseTime) * 0.15;
      beamRef.current.scale.set(pulseWidth, 1, pulseWidth);
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 * (1 - progress * 0.7);
    }
    if (glowRef.current) {
      const glowWidth = 1.2 + Math.sin(pulseTime * 0.8) * 0.3;
      glowRef.current.scale.set(glowWidth, 1, glowWidth);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 * (1 - progress * 0.5);
    }
    if (coreRef.current) {
      const coreWidth = 0.2 + Math.sin(pulseTime * 1.5) * 0.05;
      coreRef.current.scale.set(coreWidth, 1, coreWidth);
    }
  });
  
  const opacity = 1 - progress * 0.6;
  
  return (
    <group position={[midX, midY, midZ]} quaternion={quaternion}>
      <mesh ref={glowRef}>
        <cylinderGeometry args={[0.8, 0.8, length, 8]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.5 * opacity}
        />
      </mesh>
      
      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.5, 0.5, length, 8]} />
        <meshBasicMaterial
          color="#ff00ff"
          transparent
          opacity={0.9 * opacity}
        />
      </mesh>
      
      <mesh ref={coreRef}>
        <cylinderGeometry args={[0.2, 0.2, length, 6]} />
        <meshBasicMaterial
          color="#ff88ff"
          transparent
          opacity={opacity}
        />
      </mesh>
      
      {Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7;
        const posY = -length / 2 + length * t;
        const sparkle = Math.sin(time * 60 + i * 3) * 0.4 + 0.6;
        const angle = time * 15 + i * 0.5;
        const orbitRadius = 0.5;
        
        return (
          <mesh 
            key={i}
            position={[
              Math.cos(angle) * orbitRadius,
              posY,
              Math.sin(angle) * orbitRadius
            ]}
            scale={0.1 * sparkle * opacity}
          >
            <circleGeometry args={[1, 4]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}
      
      <mesh position={[0, -length / 2, 0]} scale={0.4 * opacity}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial
          color="#ff66ff"
          transparent
          opacity={0.8 * opacity}
        />
      </mesh>
      
      <mesh position={[0, length / 2, 0]} scale={0.6 * opacity}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.7 * opacity}
        />
      </mesh>
    </group>
  );
}

export function LaserBeams() {
  const { laserBeams } = useMagicOrb();
  const clockRef = useRef(0);
  
  useFrame((state) => {
    clockRef.current = state.clock.getElapsedTime();
  });
  
  return (
    <>
      {laserBeams.map((beam) => (
        <LaserBeamMesh key={beam.id} beam={beam} time={clockRef.current} />
      ))}
    </>
  );
}
