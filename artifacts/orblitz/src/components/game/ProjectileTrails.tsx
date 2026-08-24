import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { getProjectileMotion } from "./ProjectilePhysics";
import { COSMETIC_TRAIL_CONFIGS } from "./ProjectileTrailConfig";

const MAX_PARTICLES_PER_PROJECTILE = 16;
const MAX_COSMETIC_TRAIL_PARTICLES = 2048;
const TRAIL_BASE_SCALE = 0.144;
const trailGeometry = new THREE.SphereGeometry(1, 5, 4);
const trailDummy = new THREE.Object3D();
const trailColor = new THREE.Color();

function seedFromId(id: string, index: number): number {
  let value = index * 0x9e3779b1;
  for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 0x85ebca6b);
  return ((value >>> 0) % 10_000) / 10_000;
}

/**
 * One instanced mesh renders all standard cosmetic trails. This replaces the
 * former 8–16 React meshes and frame callbacks per normal projectile while
 * retaining each equipped trail's palette, taper, wobble, and live direction.
 */
export function ProjectileTrails() {
  const projectiles = useMagicOrb(s => s.projectiles);
  const { equippedTrail } = useShop();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [material] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  }));

  useEffect(() => () => material.dispose(), [material]);

  const config = COSMETIC_TRAIL_CONFIGS[equippedTrail];
  const activeProjectiles = useMemo(
    () => projectiles.filter((projectile) => projectile.type === "normal" || !projectile.type),
    [projectiles],
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (config.particleCount === 0) {
      mesh.count = 0;
      return;
    }

    const time = clock.getElapsedTime();
    let instance = 0;
    for (const projectile of activeProjectiles) {
      const motion = getProjectileMotion(projectile);
      const [dx, dy] = motion.direction;
      const baseScale = projectile.isCharged ? 0.216 : TRAIL_BASE_SCALE;

      for (let i = 0; i < config.particleCount && instance < MAX_COSMETIC_TRAIL_PARTICLES; i++) {
        const seed = seedFromId(projectile.id, i);
        const trailDistance = i * 0.24;
        const wobblePhase = seed * Math.PI * 2;
        const wobbleX = Math.sin(time * 3.2 + wobblePhase) * config.spread * baseScale;
        const wobbleY = Math.cos(time * 2.7 + wobblePhase) * config.spread * baseScale;
        const wobbleZ = Math.sin(time * 4.1 + wobblePhase * 1.7) * config.spread * baseScale * 0.6;
        const taper = Math.max(0.05, 1 - i / config.particleCount);
        const particleScale = baseScale * 0.44 * (0.5 + seed * 0.65) * taper;
        const fade = Math.max(0.08, 1 - trailDistance * 1.8);

        trailDummy.position.set(
          motion.position[0] - dx * trailDistance + wobbleX,
          motion.position[1] - dy * trailDistance + wobbleY,
          motion.position[2] + wobbleZ,
        );
        trailDummy.scale.setScalar(particleScale);
        trailDummy.updateMatrix();
        mesh.setMatrixAt(instance, trailDummy.matrix);
        trailColor.set(config.colors[i % config.colors.length]).multiplyScalar(fade);
        mesh.setColorAt(instance, trailColor);
        instance++;
      }
    }

    mesh.count = instance;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[trailGeometry, material, MAX_COSMETIC_TRAIL_PARTICLES]}
      frustumCulled={false}
    />
  );
}