import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { getProjectileMotion } from "./ProjectilePhysics";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import type { RuntimeTrail } from "@/game-runtime/TrailRuntime";

interface TrailData {
  runtimeTrail: RuntimeTrail;
  geometry: THREE.BufferGeometry;
  material: THREE.LineBasicMaterial;
  line: THREE.Line;
}

const MAX_TRAIL_LENGTH = 12;

export function ProjectileTrails() {
  const projectiles = useMagicOrb(s => s.projectiles);
  const trailsRef = useRef<Map<string, TrailData>>(new Map());
  const groupRef = useRef<THREE.Group>(null);
  // Pre-allocated Set — cleared and refilled each frame instead of reallocating
  const currentIdsRef = useRef(new Set<string>());
  
  useEffect(() => {
    return () => {
      const trails = trailsRef.current;
      for (const trail of trails.values()) {
        trail.geometry.dispose();
        trail.material.dispose();
      }
      trails.clear();
      gameRuntime.trails.reset();
    };
  }, []);
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const trails = trailsRef.current;
    // Reuse the Set — avoids allocating a new Set + intermediate array each frame
    const currentIds = currentIdsRef.current;
    currentIds.clear();
    for (const p of projectiles) currentIds.add(p.id);
    
    for (const [id, trail] of trails) {
      if (!currentIds.has(id)) {
        groupRef.current.remove(trail.line);
        trail.geometry.dispose();
        trail.material.dispose();
        trails.delete(id);
        gameRuntime.trails.release(id);
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
        const runtimeTrail = gameRuntime.trails.getOrCreate(proj.id, MAX_TRAIL_LENGTH);
        trail = {
          runtimeTrail,
          geometry,
          material,
          line,
        };
        trails.set(proj.id, trail);
      }
      
      const history = trail.runtimeTrail;
      const idx = history.writeIndex * 3;
      const motion = getProjectileMotion(proj);
      history.positions[idx] = motion.position[0];
      history.positions[idx + 1] = motion.position[1];
      history.positions[idx + 2] = motion.position[2];
      
      history.writeIndex = (history.writeIndex + 1) % MAX_TRAIL_LENGTH;
      if (history.count < MAX_TRAIL_LENGTH) {
        history.count++;
      }
      
      const posAttr = trail.geometry.getAttribute("position") as THREE.BufferAttribute;
      const renderPositions = posAttr.array as Float32Array;
      
      for (let i = 0; i < history.count; i++) {
        const srcIdx = ((history.writeIndex - history.count + i + MAX_TRAIL_LENGTH) % MAX_TRAIL_LENGTH) * 3;
        const dstIdx = i * 3;
        renderPositions[dstIdx] = history.positions[srcIdx];
        renderPositions[dstIdx + 1] = history.positions[srcIdx + 1];
        renderPositions[dstIdx + 2] = history.positions[srcIdx + 2];
      }
      
      posAttr.needsUpdate = true;
      trail.geometry.setDrawRange(0, history.count);
    }
  });
  
  return <group ref={groupRef} />;
}
