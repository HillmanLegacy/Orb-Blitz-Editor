import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

interface TrailData {
  positions: Float32Array;
  writeIndex: number;
  count: number;
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  line: THREE.Line;
}

const MAX_TRAIL_LENGTH = 12;

export function ProjectileTrails() {
  const { projectiles } = useMagicOrb();
  const trailsRef = useRef<Map<string, TrailData>>(new Map());
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
    const currentIds = new Set(projectiles.map(p => p.id));
    
    for (const [id, trail] of Array.from(trails.entries())) {
      if (!currentIds.has(id)) {
        groupRef.current.remove(trail.line);
        trail.geometry.dispose();
        trail.material.dispose();
        trails.delete(id);
      }
    }
    
    for (const proj of projectiles) {
      let trail = trails.get(proj.id);
      
      if (!trail) {
        const positions = new Float32Array(MAX_TRAIL_LENGTH * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 0);
        
        const color = proj.isCharged ? "#ffff00" : "#00ffff";
        const material = new THREE.LineBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: 0.7 
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
        trails.set(proj.id, trail);
      }
      
      const idx = trail.writeIndex * 3;
      trail.positions[idx] = proj.position[0];
      trail.positions[idx + 1] = proj.position[1];
      trail.positions[idx + 2] = proj.position[2];
      
      trail.writeIndex = (trail.writeIndex + 1) % MAX_TRAIL_LENGTH;
      if (trail.count < MAX_TRAIL_LENGTH) {
        trail.count++;
      }
      
      const posAttr = trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      const renderPositions = posAttr.array as Float32Array;
      
      for (let i = 0; i < trail.count; i++) {
        const srcIdx = ((trail.writeIndex - trail.count + i + MAX_TRAIL_LENGTH) % MAX_TRAIL_LENGTH) * 3;
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
