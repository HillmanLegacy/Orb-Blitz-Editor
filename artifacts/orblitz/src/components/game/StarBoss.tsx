/**
 * StarBoss — Level 2.9 boss.
 * Same shader as MiniStarOrb projectiles, scaled to boss size.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MiniStarOrb } from "./MiniStarOrb";

// ── Hurt / rage overlay ───────────────────────────────────────────────────────

function HurtOverlay({ radius, healthPercent }: { radius: number; healthPercent: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hurtRef = useRef(0);
  const prevRef = useRef(healthPercent);

  useFrame((state, delta) => {
    if (healthPercent < prevRef.current) hurtRef.current = 0.18;
    prevRef.current = healthPercent;
    hurtRef.current = Math.max(0, hurtRef.current - delta);

    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const t = state.clock.getElapsedTime();
    const frac = hurtRef.current / 0.18;

    if (frac > 0) {
      // Hurt flash — red strobe
      mat.color.setRGB(1, 0.05, 0.05);
      mat.opacity = frac * Math.abs(Math.sin(t * 55)) * 0.65;
    } else if (healthPercent < 0.3) {
      // Rage pulse — orange tint
      const anger = Math.abs(Math.sin(t * 13));
      mat.color.setRGB(1, 0.35 + anger * 0.25, 0);
      mat.opacity = 0.18 + anger * 0.22;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <mesh ref={meshRef} scale={radius * 1.01}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#ff2200"
        opacity={0}
      />
    </mesh>
  );
}

// ── Pulsing boss point light ──────────────────────────────────────────────────

function BossLight({ healthPercent }: { healthPercent: number }) {
  const ref = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    if (healthPercent < 0.3) {
      const rage = Math.abs(Math.sin(t * 16));
      ref.current.intensity = 12 + rage * 8;
      ref.current.color.setRGB(1, 0.55 + rage * 0.25, 0.1);
    } else {
      ref.current.intensity = 11 + Math.sin(t * 2.3) * 2;
      ref.current.color.setRGB(1, 0.87, 0.27);
    }
  });

  return <pointLight ref={ref} color="#ffdd44" intensity={11} distance={22} decay={2} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export interface StarBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function StarBoss({ radius = 1.44, healthPercent = 1 }: StarBossProps) {
  return (
    <group>
      <BossLight healthPercent={healthPercent} />
      <MiniStarOrb radius={radius} healthPercent={healthPercent} />
      <HurtOverlay radius={radius} healthPercent={healthPercent} />
    </group>
  );
}
