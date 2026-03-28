import { useMagicOrb, Particle } from "@/lib/stores/useMagicOrb";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const CONFETTI_SHAPES = ["circle", "square", "triangle", "star", "diamond"] as const;
const SHIMMER_COLORS = ["#ffffff", "#ffccff", "#ccffff", "#ffffcc", "#ffddee"];

function ParticleMesh({ particle }: { particle: Particle }) {
  const lifeRatio = particle.life / particle.maxLife;
  const scale = 0.2 * lifeRatio;
  const opacity = Math.pow(lifeRatio, 0.4);
  
  const particleProps = useMemo(() => {
    const hash1 = particle.id.charCodeAt(particle.id.length - 1) || 0;
    const hash2 = particle.id.charCodeAt(particle.id.length - 2) || 0;
    const hash3 = particle.id.charCodeAt(0) || 0;
    const hash4 = particle.id.charCodeAt(1) || 0;
    const hash5 = particle.id.charCodeAt(2) || 0;
    
    return {
      shapeType: CONFETTI_SHAPES[hash1 % CONFETTI_SHAPES.length],
      rotation: hash2 * 0.1,
      spinSpeed: 3 + (hash3 % 7),
      spinDirection: hash4 % 2 === 0 ? 1 : -1,
      hasShimmer: hash3 % 3 === 0,
      shimmerSpeed: 6 + (hash4 % 8),
      shimmerColor: SHIMMER_COLORS[hash5 % SHIMMER_COLORS.length],
      wobbleFreq: 2 + (hash2 % 4),
      wobbleAmp: 0.02 + (hash1 % 5) * 0.01,
      sizeVariation: 0.8 + (hash3 % 5) * 0.1,
      trailOpacity: 0.3 + (hash4 % 4) * 0.1,
    };
  }, [particle.id]);
  
  const { shapeType, rotation, spinSpeed, spinDirection, hasShimmer, shimmerSpeed, shimmerColor, sizeVariation } = particleProps;
  
  const meshRef = useRef<THREE.Mesh>(null);
  const shimmerRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.z = time * spinSpeed * spinDirection + rotation;
    }
    if (shimmerRef.current && hasShimmer) {
      const shimmerPulse = Math.sin(time * shimmerSpeed) * 0.5 + 0.5;
      shimmerRef.current.scale.setScalar(1.2 + shimmerPulse * 0.4);
      (shimmerRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * shimmerPulse * 0.7;
    }
  });
  
  return (
    <group position={particle.position}>
      <mesh ref={meshRef} scale={scale * sizeVariation}>
        <mesh scale={1.2}>
          {shapeType === "circle" && <circleGeometry args={[1, 8]} />}
          {shapeType === "square" && <planeGeometry args={[1.6, 1.6]} />}
          {shapeType === "triangle" && <circleGeometry args={[1, 3]} />}
          {shapeType === "star" && <circleGeometry args={[1, 4]} />}
          {shapeType === "diamond" && <circleGeometry args={[1, 4]} />}
          <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.6} />
        </mesh>
        
        {shapeType === "circle" && <circleGeometry args={[1, 8]} />}
        {shapeType === "square" && <planeGeometry args={[1.4, 1.4]} />}
        {shapeType === "triangle" && <circleGeometry args={[0.9, 3]} />}
        {shapeType === "star" && <circleGeometry args={[0.9, 4]} />}
        {shapeType === "diamond" && <circleGeometry args={[0.9, 4]} />}
        <meshBasicMaterial color={particle.color} transparent opacity={opacity} />
      </mesh>
      
      {hasShimmer && (
        <mesh ref={shimmerRef} scale={scale * 0.6} position={[0, 0, 0.01]}>
          <circleGeometry args={[1, 6]} />
          <meshBasicMaterial 
            color={shimmerColor} 
            transparent 
            opacity={opacity * 0.5} 
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

export function Particles() {
  const { particles, updateParticles, phase } = useMagicOrb();
  
  useFrame((_, delta) => {
    if (phase !== "playing") return;
    if (particles.length === 0) return;
    
    const updatedParticles: Particle[] = [];
    
    for (const particle of particles) {
      const newLife = particle.life - delta;
      if (newLife <= 0) continue;
      
      const [x, y, z] = particle.position;
      const [vx, vy, vz] = particle.velocity;
      
      const damping = 0.94;
      const newVx = vx * damping;
      const newVy = (vy - 3 * delta) * damping;
      const newVz = vz * damping;
      
      updatedParticles.push({
        ...particle,
        position: [
          x + newVx * delta,
          y + newVy * delta,
          z + newVz * delta,
        ],
        velocity: [newVx, newVy, newVz],
        life: newLife,
      });
    }
    
    updateParticles(updatedParticles);
  });
  
  return (
    <>
      {particles.map((particle) => (
        <ParticleMesh key={particle.id} particle={particle} />
      ))}
    </>
  );
}
