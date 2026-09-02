import { type PropsWithChildren, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_MODEL_ROTATION_SPEED } from "./PlayerSkinVisualConfig";

/**
 * Advances the same continuous clockwise Z-axis roll used by PlayerOrb.
 * The phase is kept outside the Three Euler angle so it never wraps.
 */
export function advanceClockwiseOrbSpin(
  spinRef: { current: number },
  object: THREE.Object3D,
  delta: number,
) {
  const presentationDelta = Math.min(Math.max(delta, 0), 0.05);
  spinRef.current += presentationDelta * PLAYER_MODEL_ROTATION_SPEED;
  object.rotation.z = spinRef.current;
}

export function ClockwiseOrbSpin({ children }: PropsWithChildren) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef(0);

  useFrame((_, delta) => {
    if (groupRef.current) {
      advanceClockwiseOrbSpin(spinRef, groupRef.current, delta);
    }
  });

  return <group ref={groupRef}>{children}</group>;
}