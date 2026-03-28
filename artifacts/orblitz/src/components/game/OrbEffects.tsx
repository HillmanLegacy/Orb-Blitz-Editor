import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

export function PlayerOrbParticles() {
  const { health, phase } = useMagicOrb();
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 40;
  
  const { positions, seeds } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const sd = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 0.5 + Math.random() * 0.3;
      
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      pos[i * 3 + 2] = Math.cos(phi) * r;
      
      sd[i * 3] = Math.random() * Math.PI * 2;
      sd[i * 3 + 1] = Math.random() * Math.PI * 2;
      sd[i * 3 + 2] = 0.3 + Math.random() * 0.4;
    }
    
    return { positions: pos, seeds: sd };
  }, []);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);
  
  useFrame((state) => {
    if (!particlesRef.current || phase !== "playing") return;
    
    const time = state.clock.getElapsedTime();
    const positionAttr = particlesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const posArray = positionAttr.array as Float32Array;
    
    const scale = 0.5 + (health / 3) * 0.5;
    
    for (let i = 0; i < particleCount; i++) {
      const baseX = positions[i * 3];
      const baseY = positions[i * 3 + 1];
      const baseZ = positions[i * 3 + 2];
      const seedX = seeds[i * 3];
      const seedY = seeds[i * 3 + 1];
      const amplitude = seeds[i * 3 + 2];
      
      posArray[i * 3] = (baseX + Math.sin(time * 2 + seedX) * amplitude * 0.2) * scale;
      posArray[i * 3 + 1] = (baseY + Math.cos(time * 1.5 + seedY) * amplitude * 0.2) * scale;
      posArray[i * 3 + 2] = (baseZ + Math.sin(time + seedX + seedY) * amplitude * 0.15) * scale;
    }
    
    positionAttr.needsUpdate = true;
  });
  
  const color = health === 3 ? "#00ffff" : health === 2 ? "#ffff00" : "#ff6600";
  
  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.08}
        transparent
        opacity={0.9}
        sizeAttenuation
      />
    </points>
  );
}

interface DarkTrailData {
  positions: Float32Array;
  writeIndex: number;
  count: number;
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  line: THREE.Line;
}

const MAX_DARK_TRAIL = 8;

export function DarkOrbTrails() {
  const { darkOrbs } = useMagicOrb();
  const trailsRef = useRef<Map<string, DarkTrailData>>(new Map());
  const groupRef = useRef<THREE.Group>(null);
  
  useEffect(() => {
    return () => {
      const trails = trailsRef.current;
      for (const trail of Array.from(trails.values())) {
        trail.geometry.dispose();
        trail.material.dispose();
      }
      trails.clear();
    };
  }, []);
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const trails = trailsRef.current;
    const currentIds = new Set(darkOrbs.map(o => o.id));
    
    for (const [id, trail] of Array.from(trails.entries())) {
      if (!currentIds.has(id)) {
        groupRef.current.remove(trail.line);
        trail.geometry.dispose();
        trail.material.dispose();
        trails.delete(id);
      }
    }
    
    for (const orb of darkOrbs) {
      let trail = trails.get(orb.id);
      
      if (!trail) {
        const positions = new Float32Array(MAX_DARK_TRAIL * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 0);
        
        const material = new THREE.LineBasicMaterial({ 
          color: "#660066", 
          transparent: true, 
          opacity: 0.5 
        });
        
        const line = new THREE.Line(geometry, material);
        groupRef.current.add(line);
        
        trail = {
          positions,
          writeIndex: 0,
          count: 0,
          geometry,
          material,
          line,
        };
        trails.set(orb.id, trail);
      }
      
      const idx = trail.writeIndex * 3;
      trail.positions[idx] = orb.position[0];
      trail.positions[idx + 1] = orb.position[1];
      trail.positions[idx + 2] = orb.position[2];
      
      trail.writeIndex = (trail.writeIndex + 1) % MAX_DARK_TRAIL;
      if (trail.count < MAX_DARK_TRAIL) {
        trail.count++;
      }
      
      const posAttr = trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      const renderPositions = posAttr.array as Float32Array;
      
      for (let i = 0; i < trail.count; i++) {
        const srcIdx = ((trail.writeIndex - trail.count + i + MAX_DARK_TRAIL) % MAX_DARK_TRAIL) * 3;
        const dstIdx = i * 3;
        renderPositions[dstIdx] = trail.positions[srcIdx];
        renderPositions[dstIdx + 1] = trail.positions[srcIdx + 1];
        renderPositions[dstIdx + 2] = trail.positions[srcIdx + 2];
      }
      
      posAttr.needsUpdate = true;
      trail.geometry.setDrawRange(0, trail.count);
    }
  });
  
  return <group ref={groupRef} />;
}
