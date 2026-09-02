import type { OrbSkin } from "../../lib/stores/useShop";
import { BossOrbModel } from "./BossOrbModel";
import { MiniCrystalOrb } from "./MiniCrystalOrb";
import { MiniDiamondOrb } from "./MiniDiamondOrb";
import { MiniMechaOrb } from "./MiniMechaOrb";
import { MiniMonsterOrb } from "./MiniMonsterOrb";
import { MiniPlasmaOrb } from "./MiniPlasmaOrb";
import { MiniRainbowOrb } from "./MiniRainbowOrb";
import { MiniStarOrb } from "./MiniStarOrb";
import { ToxicBoss } from "./ToxicBoss";

interface PlayerBossSkinProps {
  skin: Exclude<OrbSkin, "default">;
  radius: number;
  healthPercent: number;
  showEffects?: boolean;
  /** Set by PlayerOrb when its visible-model parent owns continuous yaw. */
  ownsModelRotation?: boolean;
}

/**
 * Uses the same animated renderers as boss-spawned enemies. This keeps each
 * shop skin's procedural texture and internal motion intact instead of
 * flattening the appearance into a single material colour. PlayerOrb owns the
 * shared model rotation, so these renderers must not write presentation yaw.
 */
export function PlayerBossSkin({
  skin,
  radius,
  healthPercent,
  showEffects = true,
  ownsModelRotation = false,
}: PlayerBossSkinProps) {
  switch (skin) {
    case "fire":
      // The shop Fire Boss Skin, the 1.9 boss, and player projectiles all use
      // the same authored texture from boss_orb_1_texture.glb.
      return <BossOrbModel scale={radius} healthPercent={healthPercent} animatePresentationYaw={!ownsModelRotation} />;
    case "star":
      return <MiniStarOrb radius={radius} healthPercent={healthPercent} showParticles={showEffects} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
    case "crystal":
      return <MiniCrystalOrb radius={radius} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
    case "toxic":
      return <ToxicBoss radius={radius} healthPercent={healthPercent} ownsModelRotation={ownsModelRotation} />;
    case "plasma":
      return <MiniPlasmaOrb radius={radius} showParticles={showEffects} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
    case "diamond":
      return <MiniDiamondOrb radius={radius} showParticles={showEffects} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
    case "rainbow":
      return <MiniRainbowOrb radius={radius} showParticles={showEffects} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
    case "mecha":
      return <MiniMechaOrb radius={radius} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
    case "monster":
      return <MiniMonsterOrb radius={radius} showParticles={showEffects} showLight={false} animatePresentationYaw={!ownsModelRotation} />;
  }
}