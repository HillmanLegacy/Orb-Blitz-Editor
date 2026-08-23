import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { getProjectileMotion } from "./ProjectilePhysics";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import type { RuntimeTrail } from "@/game-runtime/TrailRuntime";

const MAX_TRAIL_LENGTH = 12;
const VERTICES_PER_TRAIL = (MAX_TRAIL_LENGTH - 1) * 2;

type TrailBatch = {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  capacity: number;
};

function createBatch(): TrailBatch {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(0);
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  geometry.setDrawRange(0, 0);
  return { geometry, positions, capacity: 0 };
}

/**
 * Combines every trail of a colour into one LineSegments object.  A trail used
 * to allocate a geometry, material, scene child, and draw call of its own.
 * Pairing adjacent history points retains exactly the same line segments while
 * reducing active projectile trails to two draw calls.
 */
export function ProjectileTrails() {
  const projectiles = useMagicOrb(s => s.projectiles);
  const trailsRef = useRef<Map<string, RuntimeTrail>>(new Map());
  const currentIdsRef = useRef(new Set<string>());
  const cyanBatch = useMemo(createBatch, []);
  const chargedBatch = useMemo(createBatch, []);
  const cyanMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: "#00ffff", transparent: true, opacity: 0.7,
  }), []);
  const chargedMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: "#ffff00", transparent: true, opacity: 0.7,
  }), []);

  useEffect(() => () => {
    for (const id of trailsRef.current.keys()) gameRuntime.trails.release(id);
    trailsRef.current.clear();
    cyanBatch.geometry.dispose();
    chargedBatch.geometry.dispose();
    cyanMaterial.dispose();
    chargedMaterial.dispose();
    gameRuntime.trails.reset();
  }, [cyanBatch, chargedBatch, cyanMaterial, chargedMaterial]);

  useFrame(() => {
    const trails = trailsRef.current;
    const currentIds = currentIdsRef.current;
    currentIds.clear();
    for (const projectile of projectiles) currentIds.add(projectile.id);

    for (const id of trails.keys()) {
      if (!currentIds.has(id)) {
        trails.delete(id);
        gameRuntime.trails.release(id);
      }
    }

    const requiredCyan = projectiles.reduce(
      (count, projectile) => count + (projectile.isCharged ? 0 : VERTICES_PER_TRAIL), 0,
    );
    const requiredCharged = projectiles.length * VERTICES_PER_TRAIL - requiredCyan;
    for (const [batch, required] of [[cyanBatch, requiredCyan], [chargedBatch, requiredCharged]] as const) {
      if (required > batch.capacity) {
        batch.capacity = required;
        batch.positions = new Float32Array(required * 3);
        const attribute = new THREE.BufferAttribute(batch.positions, 3);
        attribute.setUsage(THREE.DynamicDrawUsage);
        batch.geometry.setAttribute("position", attribute);
      }
    }

    let cyanVertex = 0;
    let chargedVertex = 0;
    for (const projectile of projectiles) {
      let history = trails.get(projectile.id);
      if (!history) {
        history = gameRuntime.trails.getOrCreate(projectile.id, MAX_TRAIL_LENGTH);
        trails.set(projectile.id, history);
      }

      const writeOffset = history.writeIndex * 3;
      const motion = getProjectileMotion(projectile);
      history.positions[writeOffset] = motion.position[0];
      history.positions[writeOffset + 1] = motion.position[1];
      history.positions[writeOffset + 2] = motion.position[2];
      history.writeIndex = (history.writeIndex + 1) % MAX_TRAIL_LENGTH;
      history.count = Math.min(history.count + 1, MAX_TRAIL_LENGTH);

      const batch = projectile.isCharged ? chargedBatch : cyanBatch;
      let vertex = projectile.isCharged ? chargedVertex : cyanVertex;
      // LineSegments consumes point pairs, so adjacent history points are
      // duplicated rather than connecting separate projectile trails.
      for (let point = 1; point < history.count; point++) {
        const previous = ((history.writeIndex - history.count + point - 1 + MAX_TRAIL_LENGTH) % MAX_TRAIL_LENGTH) * 3;
        const next = ((history.writeIndex - history.count + point + MAX_TRAIL_LENGTH) % MAX_TRAIL_LENGTH) * 3;
        const destination = vertex * 3;
        batch.positions[destination] = history.positions[previous];
        batch.positions[destination + 1] = history.positions[previous + 1];
        batch.positions[destination + 2] = history.positions[previous + 2];
        batch.positions[destination + 3] = history.positions[next];
        batch.positions[destination + 4] = history.positions[next + 1];
        batch.positions[destination + 5] = history.positions[next + 2];
        vertex += 2;
      }
      if (projectile.isCharged) chargedVertex = vertex;
      else cyanVertex = vertex;
    }

    for (const [batch, vertices] of [[cyanBatch, cyanVertex], [chargedBatch, chargedVertex]] as const) {
      (batch.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      batch.geometry.setDrawRange(0, vertices);
    }
  });

  return (
    <group>
      <lineSegments geometry={cyanBatch.geometry} material={cyanMaterial} frustumCulled={false} />
      <lineSegments geometry={chargedBatch.geometry} material={chargedMaterial} frustumCulled={false} />
    </group>
  );
}
