import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

export function ScreenEffects() {
  const vignetteRef = useRef<THREE.Mesh>(null);
  const bloomOverlay1Ref = useRef<THREE.Mesh>(null);
  const bloomOverlay2Ref = useRef<THREE.Mesh>(null);
  const colorGradeRef = useRef<THREE.Mesh>(null);
  const scanlineRef = useRef<THREE.Mesh>(null);
  
  const { phase, backgroundPulse, boss, arcadeLevel, gameMode, health, maxHealth, isDamaged } = useMagicOrb();
  
  const healthRatio = health / maxHealth;
  const isBossLevel = gameMode === "arcade" && Math.round((arcadeLevel % 1) * 10) === 9;
  const inBossFight = boss !== null || isBossLevel;
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (vignetteRef.current) {
      const mat = vignetteRef.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = 0.15;
      const damageBoost = isDamaged ? 0.25 : 0;
      const lowHealthBoost = healthRatio < 0.4 ? (0.4 - healthRatio) * 0.3 : 0;
      const pulse = Math.sin(time * 2) * 0.02;
      mat.opacity = baseOpacity + damageBoost + lowHealthBoost + pulse;
      mat.color.setHSL(isDamaged ? 0 : 0.9, 0.8, 0.15);
    }
    
    if (bloomOverlay1Ref.current) {
      const mat = bloomOverlay1Ref.current.material as THREE.MeshBasicMaterial;
      const baseBrightness = 0.02;
      const pulseEffect = backgroundPulse * 0.03;
      const bossIntensity = inBossFight ? 0.015 : 0;
      mat.opacity = baseBrightness + pulseEffect + bossIntensity;
      const hue = (time * 0.02) % 1;
      mat.color.setHSL(hue, 0.6, 0.7);
    }
    
    if (bloomOverlay2Ref.current) {
      const mat = bloomOverlay2Ref.current.material as THREE.MeshBasicMaterial;
      const baseBrightness = 0.015;
      const pulseEffect = backgroundPulse * 0.02;
      mat.opacity = baseBrightness + pulseEffect + Math.sin(time * 3) * 0.008;
      const hue = ((time * 0.02) + 0.5) % 1;
      mat.color.setHSL(hue, 0.5, 0.8);
    }
    
    if (colorGradeRef.current) {
      const mat = colorGradeRef.current.material as THREE.MeshBasicMaterial;
      const bossHue = inBossFight ? 0.05 : 0.8;
      const hue = bossHue + Math.sin(time * 0.5) * 0.05;
      mat.color.setHSL(hue, 0.3, 0.5);
      mat.opacity = 0.03 + (inBossFight ? 0.02 : 0);
    }
    
    if (scanlineRef.current) {
      scanlineRef.current.position.y = ((time * 0.5) % 2) - 1;
    }
  });
  
  if (phase !== "playing") return null;
  
  return (
    <group position={[0, 0, 8]}>
      <mesh ref={bloomOverlay1Ref} position={[0, 0, 0]}>
        <planeGeometry args={[30, 22]} />
        <meshBasicMaterial 
          color="#ff00ff" 
          transparent 
          opacity={0.02}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      
      <mesh ref={bloomOverlay2Ref} position={[0, 0, 0.01]}>
        <planeGeometry args={[30, 22]} />
        <meshBasicMaterial 
          color="#00ffff" 
          transparent 
          opacity={0.015}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      
      <mesh ref={colorGradeRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[30, 22]} />
        <meshBasicMaterial 
          color="#8800ff" 
          transparent 
          opacity={0.03}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      
      <mesh ref={vignetteRef} position={[0, 0, 0.03]}>
        <ringGeometry args={[8, 18, 64]} />
        <meshBasicMaterial 
          color="#1a0011" 
          transparent 
          opacity={0.15}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      
      {[0, 1, 2, 3].map((i) => (
        <mesh 
          key={`corner-${i}`}
          position={[
            (i % 2 === 0 ? -12 : 12),
            (i < 2 ? 9 : -9),
            0.035
          ]}
        >
          <circleGeometry args={[6, 16]} />
          <meshBasicMaterial 
            color="#000011" 
            transparent 
            opacity={0.25}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
      
      <mesh ref={scanlineRef} position={[0, 0, 0.04]}>
        <planeGeometry args={[30, 0.02]} />
        <meshBasicMaterial 
          color="#ffffff" 
          transparent 
          opacity={0.03}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
