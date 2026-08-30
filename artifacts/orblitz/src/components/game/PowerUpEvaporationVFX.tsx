import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PowerUpType } from "@/lib/stores/useMagicOrb";
import {
  getGraphicsPreset,
  useGraphicsPreset,
  type GraphicsPreset,
} from "@/game-runtime/PerformanceToggles";
import { POWER_UP_DESTROY_DURATION } from "@/game-runtime/PowerUpRuntime";

export const POWER_UP_EVAPORATION_PROFILES: Record<GraphicsPreset, number> = {
  low: 10,
  standard: 16,
  high: 24,
};
export const POWER_UP_EVAPORATION_MAX_REMNANTS = POWER_UP_EVAPORATION_PROFILES.high;

export function getPowerUpEvaporationRemnantCount(preset: GraphicsPreset): number {
  return POWER_UP_EVAPORATION_PROFILES[preset];
}

/** Every destruction uses evaporation; shield additionally retains its formation cue. */
export function getPowerUpDestroyPresentation(type: PowerUpType): readonly ("evaporation" | "shieldFormation")[] {
  return type === "shield" ? ["evaporation", "shieldFormation"] : ["evaporation"];
}

export function isPowerUpEvaporationActive(destroying: boolean): boolean {
  return destroying;
}

type Remnant = Readonly<{
  x: number;
  y: number;
  z: number;
  lift: number;
  spin: number;
  size: number;
  tone: number;
  delay: number;
}>;

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const white = new THREE.Color("#ffffff");
const geometry = new THREE.IcosahedronGeometry(1, 0);

function seeded(seed: number, index: number): number {
  const value = Math.sin(seed * 157.31 + index * 263.17) * 43758.5453;
  return value - Math.floor(value);
}

function makeRemnants(id: string): Remnant[] {
  const seed = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return Array.from({ length: POWER_UP_EVAPORATION_MAX_REMNANTS }, (_, index) => {
    const azimuth = seeded(seed, index) * Math.PI * 2;
    const radius = 0.18 + seeded(seed, index + 19) * 0.6;
    return {
      x: Math.cos(azimuth) * radius,
      y: (seeded(seed, index + 37) - 0.2) * 0.36,
      z: Math.sin(azimuth) * radius * 0.7,
      lift: 0.55 + seeded(seed, index + 53) * 1.25,
      spin: (seeded(seed, index + 71) - 0.5) * 12,
      size: 0.06 + seeded(seed, index + 89) * 0.09,
      tone: seeded(seed, index + 107),
      delay: seeded(seed, index + 131) * 0.18,
    };
  });
}

export function PowerUpEvaporationVFX({
  id,
  startPos,
  primaryColor,
  accentColor,
}: {
  id: string;
  startPos: [number, number, number];
  primaryColor: string;
  accentColor: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bornRef = useRef<number | null>(null);
  const preset = useGraphicsPreset();
  const remnants = useMemo(() => makeRemnants(id), [id]);
  const primary = useMemo(() => new THREE.Color(primaryColor), [primaryColor]);
  const accent = useMemo(() => new THREE.Color(accentColor), [accentColor]);
  const [material] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();
    const mesh = meshRef.current;
    if (!mesh) return;
    const count = getPowerUpEvaporationRemnantCount(getGraphicsPreset() || preset);
    const age = clock.getElapsedTime() - bornRef.current;

    for (let index = 0; index < POWER_UP_EVAPORATION_MAX_REMNANTS; index++) {
      const remnant = remnants[index];
      const progress = Math.max(0, Math.min(1, (age - remnant.delay) / (POWER_UP_DESTROY_DURATION - remnant.delay)));
      if (index >= count || progress <= 0 || progress >= 1) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        continue;
      }
      const rise = progress * progress * remnant.lift;
      const spread = progress * (0.35 + remnant.tone * 0.45);
      const shrink = Math.max(0.001, remnant.size * (1 - progress));
      dummy.position.set(
        startPos[0] + remnant.x * spread,
        startPos[1] + remnant.y * spread + rise,
        startPos[2] + remnant.z * spread,
      );
      dummy.rotation.set(progress * remnant.spin, progress * remnant.spin * 0.7, progress * remnant.spin * 1.2);
      dummy.scale.setScalar(shrink);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.lerpColors(primary, accent, remnant.tone * 0.65 + progress * 0.35);
      color.lerp(white, progress * 0.18);
      mesh.setColorAt(index, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, POWER_UP_EVAPORATION_MAX_REMNANTS]} frustumCulled={false} />;
}