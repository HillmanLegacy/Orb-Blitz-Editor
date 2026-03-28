import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { getSkinColors } from "./PlayerOrb";

function DefenseOrbMesh({ angle, id }: { angle: number; id: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);
  const playerPosition = useMagicOrb((s) => s.playerPosition);
  const health = useMagicOrb((s) => s.health);
  const { equippedSkin } = useShop();
  
  const skinColors = useMemo(() => getSkinColors(equippedSkin, health), [equippedSkin, health]);
  const isRainbow = (skinColors as any).isRainbow;
  const isTransparent = (skinColors as any).transparent;
  
  const orbitRadius = 2;
  const x = playerPosition[0] + Math.cos(angle) * orbitRadius;
  const y = playerPosition[1] + Math.sin(angle) * orbitRadius;
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (coreRef.current) {
      const pulse = 1 + Math.sin(time * 6) * 0.08;
      coreRef.current.scale.setScalar(0.35 * pulse);
      
      if (isRainbow) {
        const mat = coreRef.current.material as THREE.MeshBasicMaterial;
        const hue = (time * 0.3) % 1;
        mat.color.setHSL(hue, 1, 0.5);
      }
    }
    
    if (innerRef.current) {
      innerRef.current.rotation.z = time * 2;
      if (isRainbow) {
        const mat = innerRef.current.material as THREE.MeshBasicMaterial;
        const hue = (time * 0.3 + 0.33) % 1;
        mat.color.setHSL(hue, 1, 0.6);
      }
    }
    
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 + Math.sin(time * 5) * 0.15;
      glowRef.current.scale.setScalar(0.5 + Math.sin(time * 4) * 0.05);
    }
    
    if (outerGlowRef.current) {
      const mat = outerGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(time * 3) * 0.08;
    }
  });
  
  return (
    <group position={[x, y, 0]}>
      {/* Outer glow - matches player */}
      <mesh ref={outerGlowRef} scale={0.55} position={[0, 0, -0.02]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color={skinColors.glow} transparent opacity={0.2} />
      </mesh>
      
      {/* Black outline */}
      <mesh scale={0.42} position={[0, 0, -0.01]}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      
      {/* Main core - matches player core */}
      <mesh ref={coreRef} scale={0.35}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial 
          color={skinColors.core} 
          transparent={isTransparent}
          opacity={isTransparent ? 0.85 : 1}
        />
      </mesh>
      
      {/* Inner highlight */}
      <mesh ref={innerRef} scale={0.22} position={[0, 0, 0.01]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial 
          color={skinColors.accent || skinColors.glow} 
          transparent 
          opacity={0.7}
        />
      </mesh>
      
      {/* Center glow */}
      <mesh ref={glowRef} scale={0.12} position={[0, 0, 0.02]}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
      
      {/* Particle ring effect */}
      {skinColors.particles.slice(0, 4).map((color, i) => {
        const pAngle = (i / 4) * Math.PI * 2;
        return (
          <mesh 
            key={i} 
            position={[Math.cos(pAngle) * 0.28, Math.sin(pAngle) * 0.28, 0.01]} 
            scale={0.04}
          >
            <circleGeometry args={[1, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

export function DefenseOrbs() {
  const defenseOrbs = useMagicOrb((s) => s.defenseOrbs);
  const darkOrbs = useMagicOrb((s) => s.darkOrbs);
  const playerPosition = useMagicOrb((s) => s.playerPosition);
  const markOrbDestroying = useMagicOrb((s) => s.markOrbDestroying);
  const destroyDefenseOrb = useMagicOrb((s) => s.destroyDefenseOrb);
  const updateDefenseOrbs = useMagicOrb((s) => s.updateDefenseOrbs);
  const phase = useMagicOrb((s) => s.phase);
  const addScore = useMagicOrb((s) => s.addScore);
  const addOrbDestroyStars = useMagicOrb((s) => s.addOrbDestroyStars);
  const { playHit } = useAudio();
  const { addCoins } = useShop();
  
  const orbitRadius = 2;
  const hitRadius = 0.8;
  
  useFrame((_, delta) => {
    if (phase !== "playing") return;
    
    updateDefenseOrbs(delta);
    
    for (const defOrb of defenseOrbs) {
      if (!defOrb.alive) continue;
      
      const defX = playerPosition[0] + Math.cos(defOrb.angle) * orbitRadius;
      const defY = playerPosition[1] + Math.sin(defOrb.angle) * orbitRadius;
      
      for (const darkOrb of darkOrbs) {
        if (darkOrb.destroying) continue;
        
        const dx = defX - darkOrb.position[0];
        const dy = defY - darkOrb.position[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < hitRadius) {
          markOrbDestroying(darkOrb.id);
          destroyDefenseOrb(defOrb.id);
          addScore(10);
          addOrbDestroyStars();
          addCoins(1);
          playHit();
          break;
        }
      }
    }
  });
  
  return (
    <>
      {defenseOrbs.filter(o => o.alive).map((orb) => (
        <DefenseOrbMesh key={orb.id} angle={orb.angle} id={orb.id} />
      ))}
    </>
  );
}
