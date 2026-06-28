/**
 * FlameAura — "Flame Aura" cosmetic trail for the player orb.
 * Upward-flowing fire particles with additive blending.
 * Mount as a child inside the player orb group.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FLAME_COUNT = 55;

interface Ember {
  pos:     THREE.Vector3;
  vel:     THREE.Vector3;
  life:    number;
  maxLife: number;
  seed:    number;
  size:    number;
}

function randomEmber(scale: number): Ember {
  const angle  = Math.random() * Math.PI * 2;
  const spread = Math.random() * scale * 0.6;
  return {
    pos: new THREE.Vector3(
      Math.cos(angle) * spread,
      -scale * 0.55 + Math.random() * scale * 0.3,
      Math.sin(angle) * spread,
    ),
    vel: new THREE.Vector3(
      (Math.random() - 0.5) * 0.35,
      1.1 + Math.random() * 1.3,
      (Math.random() - 0.5) * 0.35,
    ),
    life:    Math.random(),
    maxLife: 0.55 + Math.random() * 0.55,
    seed:    Math.random() * Math.PI * 2,
    size:    0.055 + Math.random() * 0.085,
  };
}

interface FlameAuraProps {
  scale?: number;
}

export function FlameAura({ scale = 0.75 }: FlameAuraProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const col     = useMemo(() => new THREE.Color(), []);

  const embers = useRef<Ember[]>(
    Array.from({ length: FLAME_COUNT }, () => {
      const e = randomEmber(scale);
      e.life  = Math.random() * e.maxLife; // stagger start
      return e;
    })
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    embers.current.forEach((e, i) => {
      e.life -= delta;

      if (e.life <= 0) {
        const fresh = randomEmber(scale);
        Object.assign(e, fresh);
        e.life = e.maxLife; // full life on respawn
      } else {
        e.pos.addScaledVector(e.vel, delta);
        // Turbulence
        e.vel.x += Math.sin(t * 4 + e.seed) * 0.28 * delta;
        e.vel.y -= delta * 0.15; // gentle decel
        e.vel.z += Math.cos(t * 3.5 + e.seed) * 0.28 * delta;
      }

      const lifeRatio = Math.max(0, e.life / e.maxLife);
      const s = e.size * scale * lifeRatio;

      dummy.position.copy(e.pos);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Color: deep orange at birth → bright yellow → fading white tip
      // lifeRatio=1 (fresh spawn at bottom) is orange; lifeRatio=0 (top/old) is yellow→white
      const hue  = 0.06 - (1 - lifeRatio) * 0.055;   // 0.06 orange → ~0.115 yellow
      const light = 0.48 + (1 - lifeRatio) * 0.28;
      col.setHSL(Math.max(0, hue), 1.0, Math.min(0.9, light));
      meshRef.current!.setColorAt(i, col);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FLAME_COUNT]}>
      <sphereGeometry args={[1, 5, 4]} />
      <meshBasicMaterial
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
