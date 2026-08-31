/**
 * FireAura — radial player aura using the same additive ember language as
 * FlameAura, but with particles burning outward in every direction around the
 * player instead of flowing along one axis.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FIRE_AURA_COUNT = 72;

interface FireEmber {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  seed: number;
  size: number;
}

function randomFireEmber(scale: number): FireEmber {
  const angle = Math.random() * Math.PI * 2;
  const outward = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
  const tangent = new THREE.Vector3(-outward.y, outward.x, 0);
  const radius = scale * (0.38 + Math.random() * 0.16);
  const speed = 0.85 + Math.random() * 1.1;

  return {
    pos: outward.multiplyScalar(radius).setZ((Math.random() - 0.5) * scale * 0.18),
    vel: outward.multiplyScalar(speed).add(
      tangent.multiplyScalar((Math.random() - 0.5) * 0.28),
    ).setZ((Math.random() - 0.5) * 0.16),
    life: Math.random(),
    maxLife: 0.7 + Math.random() * 0.6,
    seed: Math.random() * Math.PI * 2,
    size: 0.055 + Math.random() * 0.085,
  };
}

export function FireAura({ scale = 0.75 }: { scale?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const embers = useRef<FireEmber[]>(
    Array.from({ length: FIRE_AURA_COUNT }, () => {
      const ember = randomFireEmber(scale);
      ember.life = Math.random() * ember.maxLife;
      return ember;
    }),
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    embers.current.forEach((ember, index) => {
      ember.life -= delta;

      if (ember.life <= 0) {
        const fresh = randomFireEmber(scale);
        Object.assign(ember, fresh);
        ember.life = ember.maxLife;
      } else {
        ember.pos.addScaledVector(ember.vel, delta);
        const radius = Math.hypot(ember.pos.x, ember.pos.y) || 1;
        const tangentX = -ember.pos.y / radius;
        const tangentY = ember.pos.x / radius;
        const turbulence = Math.sin(time * 4.2 + ember.seed) * 0.24 * delta;
        ember.vel.x += tangentX * turbulence;
        ember.vel.y += tangentY * turbulence;
        ember.vel.z += Math.cos(time * 3.5 + ember.seed) * 0.18 * delta;
      }

      const lifeRatio = Math.max(0, ember.life / ember.maxLife);
      const particleScale = ember.size * scale * lifeRatio;

      dummy.position.copy(ember.pos);
      dummy.scale.setScalar(particleScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);

      // Match FlameAura: deep orange at birth, then brighten toward yellow-white.
      const hue = 0.06 - (1 - lifeRatio) * 0.055;
      const light = 0.48 + (1 - lifeRatio) * 0.28;
      color.setHSL(Math.max(0, hue), 1.0, Math.min(0.9, light));
      meshRef.current!.setColorAt(index, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff6600" intensity={1.1} distance={3.5} decay={2} />
      <instancedMesh ref={meshRef} args={[undefined, undefined, FIRE_AURA_COUNT]}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
