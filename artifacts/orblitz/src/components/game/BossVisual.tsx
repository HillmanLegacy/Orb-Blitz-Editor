import type { ComponentType, Ref } from "react";
import type * as THREE from "three";
import { CrystalBoss } from "./CrystalBoss";
import { DiamondBoss } from "./DiamondBoss";
import { FireBoss } from "./FireBoss";
import { MechaBoss } from "./MechaBoss";
import { MonsterBoss } from "./MonsterBoss";
import { PlasmaBoss } from "./PlasmaBoss";
import { RainbowBoss } from "./RainbowBoss";
import { StarBoss } from "./StarBoss";
import { ToxicBoss } from "./ToxicBoss";
import type { MainBossType } from "./BossDefeatPalette";
import { ClockwiseOrbSpin } from "./OrbPresentationSpin";

export interface BossVisualProps {
  radius?: number;
  healthPercent?: number;
  presentationRef?: Ref<THREE.Group>;
}

type BossVisualComponent = ComponentType<BossVisualProps>;

/**
 * The single shape-to-renderer mapping shared by menu previews and live
 * arcade bosses. Each renderer owns the authoritative model/texture path.
 */
export const BOSS_VISUAL_COMPONENTS: Record<MainBossType, BossVisualComponent> = {
  circle: FireBoss,
  star: StarBoss,
  triangle: CrystalBoss,
  trapezoid: ToxicBoss,
  cube: PlasmaBoss,
  cloud: DiamondBoss,
  arrow: RainbowBoss,
  tentacle: MechaBoss,
  monster: MonsterBoss,
};

export function BossVisual({
  type,
  radius = 1.44,
  healthPercent = 1,
  presentationRef,
}: BossVisualProps & { type: MainBossType }) {
  const Renderer = BOSS_VISUAL_COMPONENTS[type];
  return (
    <group ref={presentationRef}>
      <ClockwiseOrbSpin>
        <Renderer radius={radius} healthPercent={healthPercent} />
      </ClockwiseOrbSpin>
    </group>
  );
}