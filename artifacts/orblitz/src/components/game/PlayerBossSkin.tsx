import type { OrbSkin } from "../../lib/stores/useShop";
import { BossOrbModel } from "./BossOrbModel";
import { MiniCrystalOrb } from "./MiniCrystalOrb";
import { MiniDiamondOrb } from "./MiniDiamondOrb";
import { MiniMechaOrb } from "./MiniMechaOrb";
import { MiniMonsterOrb } from "./MiniMonsterOrb";
import { MiniPlasmaOrb } from "./MiniPlasmaOrb";
import { MiniRainbowOrb } from "./MiniRainbowOrb";
import { MiniStarOrb } from "./MiniStarOrb";
import { MiniToxicOrb } from "./MiniToxicOrb";

interface PlayerBossSkinProps {
  skin: Exclude<OrbSkin, "default">;
  radius: number;
  healthPercent: number;
  showEffects?: boolean;
}

/**
 * Uses the same animated renderers as boss-spawned enemies. This keeps each
 * shop skin's procedural texture, internal motion, and rotation intact instead
 * of flattening the appearance into a single material colour.
 */
export function PlayerBossSkin({
  skin,
  radius,
  healthPercent,
  showEffects = true,
}: PlayerBossSkinProps) {
  switch (skin) {
    case "fire":
      // The shop Fire Boss Skin, the 1.9 boss, and player projectiles all use
      // the same authored texture from boss_orb_1_texture.glb.
      return <BossOrbModel scale={radius} healthPercent={healthPercent} />;
    case "star":
      return <MiniStarOrb radius={radius} healthPercent={healthPercent} showParticles={showEffects} showLight={false} />;
    case "crystal":
      return <MiniCrystalOrb radius={radius} showLight={false} />;
    case "toxic":
      return <MiniToxicOrb radius={radius} showParticles={showEffects} showLight={false} />;
    case "plasma":
      return <MiniPlasmaOrb radius={radius} showParticles={showEffects} showLight={false} />;
    case "diamond":
      return <MiniDiamondOrb radius={radius} showParticles={showEffects} showLight={false} />;
    case "rainbow":
      return <MiniRainbowOrb radius={radius} showParticles={showEffects} showLight={false} />;
    case "mecha":
      return <MiniMechaOrb radius={radius} showLight={false} />;
    case "monster":
      return <MiniMonsterOrb radius={radius} showParticles={showEffects} showLight={false} />;
  }
}