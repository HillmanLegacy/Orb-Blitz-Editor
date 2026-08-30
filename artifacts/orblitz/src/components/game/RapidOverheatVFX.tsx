import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { FlameAura } from "./FlameAura";

/**
 * Gameplay readout for Rapid Blaster heat. This intentionally remains mounted
 * with the core gameplay tree so the warning cannot disappear when decorative
 * VFX are reduced.
 */
export function RapidOverheatVFX() {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useMagicOrb((state) => state.phase);
  const heat = useMagicOrb((state) => state.rapidOverheat);
  const overheated = useMagicOrb((state) => state.rapidOverheatActive);
  const playerPosition = useMagicOrb((state) => state.playerPosition);
  const equippedWeapon = useShop((state) => state.equippedWeapon);

  const visible = equippedWeapon === "orbital_rapid_blaster"
    && phase === "playing"
    && heat > 0.5;

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.visible = visible;
    group.position.set(playerPosition[0], playerPosition[1], playerPosition[2] + 0.1);
    const pulse = 1 + Math.sin(clock.getElapsedTime() * (overheated ? 15 : 8)) * (overheated ? 0.12 : 0.05);
    group.scale.setScalar((0.7 + heat * 0.45) * pulse);
  });

  return (
    <group ref={groupRef} visible={false}>
      <FlameAura scale={0.95} />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.035, 6, 36]} />
        <meshBasicMaterial
          color={overheated ? "#ff321c" : "#ff9f2d"}
          transparent
          opacity={overheated ? 0.85 : 0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}