import { useMagicOrb, DarkOrb } from "@/lib/stores/useMagicOrb";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const PARTICLES_PER_ENEMY = 12;
const MAX_PARTICLES = 512;

const COLORS: Record<string, THREE.ColorRepresentation> = {
  circle: "#ff7a18",
  star: "#ffd34d",
  triangle: "#7de8ff",
  trapezoid: "#70ff75",
  cube: "#b28cff",
  lightning: "#cfe8ff",
  arrow: "#ff8ad8",
  tentacle: "#44ddff",
  monster: "#bf63ff",
};

function particleColor(orb: DarkOrb): THREE.ColorRepresentation {
  return COLORS[orb.shape] || "#ffffff";
}

/**
 * One pooled instanced particle mesh for all regular enemies.
 * Bosses are excluded so their authored particle systems remain unchanged.
 */
export function StandardEnemyParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const seedRef = useRef(new Map<string, number>());

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { darkOrbs, phase } = useMagicOrb.getState();
    if (phase !== "playing") {
      mesh.count = 0;
      return;
    }

    const t = state.clock.elapsedTime;
    let write = 0;

    for (const orb of darkOrbs) {
      if (orb.isBossOrb || orb.destroying || !orb.position || write >= MAX_PARTICLES) continue;
      const seed = seedRef.current.get(orb.id) ?? Math.random() * Math.PI * 2;
      seedRef.current.set(orb.id, seed);
      const [x, y, z] = orb.position;
      const radius = Math.max(0.22, orb.size * 0.9);

      for (let j = 0; j < PARTICLES_PER_ENEMY && write < MAX_PARTICLES; j++) {
        const phaseOffset = (j / PARTICLES_PER_ENEMY) * Math.PI * 2 + seed;
        const angle = phaseOffset + t * (0.7 + (j % 3) * 0.18);
        const orbit = radius * (1.05 + (j % 4) * 0.14);
        const bob = Math.sin(t * 1.8 + phaseOffset) * radius * 0.16;
        const px = x + Math.cos(angle) * orbit;
        const py = y + Math.sin(angle) * orbit * 0.72 + bob;
        const pz = z + Math.sin(angle) * radius * 0.12;
        const pulse = 0.045 + (0.018 * (0.5 + 0.5 * Math.sin(t * 3 + phaseOffset)));

        dummy.position.set(px, py, pz);
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        mesh.setMatrixAt(write, dummy.matrix);

        color.set(particleColor(orb));
        color.multiplyScalar(0.75 + 0.25 * Math.sin(t * 2 + phaseOffset));
        mesh.setColorAt(write, color);
        write++;
      }
    }

    mesh.count = write;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Remove stale seeds after enemies leave the scene.
    for (const id of seedRef.current.keys()) {
      if (!darkOrbs.some((orb) => orb.id === id)) seedRef.current.delete(id);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
}