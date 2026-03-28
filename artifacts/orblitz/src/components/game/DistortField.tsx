import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { getSkinColors } from "./PlayerOrb";

export function DistortField() {
  const { distortActive, distortTimer, playerPosition, health } = useMagicOrb();
  const { equippedSkin } = useShop();
  const skinColors = getSkinColors(equippedSkin, health);
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);
  const ringRef3 = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!distortActive) return;
    
    const time = state.clock.getElapsedTime();
    const pulse = Math.sin(time * 8) * 0.1 + 1;
    const fadeOut = Math.min(1, distortTimer / 1);
    
    if (ringRef1.current) {
      ringRef1.current.rotation.x = time * 2;
      ringRef1.current.rotation.y = time * 1.5;
      ringRef1.current.scale.setScalar(2 * pulse);
      const mat = ringRef1.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 * fadeOut;
    }
    
    if (ringRef2.current) {
      ringRef2.current.rotation.x = -time * 1.8;
      ringRef2.current.rotation.z = time * 2.2;
      ringRef2.current.scale.setScalar(2.3 * pulse);
      const mat = ringRef2.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 * fadeOut;
    }
    
    if (ringRef3.current) {
      ringRef3.current.rotation.y = time * 2.5;
      ringRef3.current.rotation.z = -time * 1.3;
      ringRef3.current.scale.setScalar(2.6 * pulse);
      const mat = ringRef3.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 * fadeOut;
    }
    
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(3 * pulse);
      const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.1 * fadeOut;
    }
  });
  
  if (!distortActive) return null;
  
  const primaryColor = skinColors.glow;
  const secondaryColor = skinColors.core;
  const tertiaryColor = skinColors.emissive;
  
  return (
    <group position={playerPosition}>
      <mesh ref={sphereRef}>
        <circleGeometry args={[3, 24]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.2}
        />
      </mesh>
      
      <mesh scale={3.2}>
        <ringGeometry args={[0.95, 1, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef1} scale={3}>
        <ringGeometry args={[0.92, 0.98, 24]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      <mesh ref={ringRef2} scale={2.5}>
        <ringGeometry args={[0.9, 0.96, 24]} />
        <meshBasicMaterial
          color={secondaryColor}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      <mesh ref={ringRef3} scale={2}>
        <ringGeometry args={[0.88, 0.94, 24]} />
        <meshBasicMaterial
          color={tertiaryColor}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
