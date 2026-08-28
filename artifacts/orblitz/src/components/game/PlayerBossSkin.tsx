import type { OrbSkin } from "../../lib/stores/useShop";
import { MiniCrystalOrb } from "./MiniCrystalOrb";
import { MiniDiamondOrb } from "./MiniDiamondOrb";
import { MiniFireOrb } from "./MiniFireOrb";
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
}

/**
 * Uses the same animated renderers as boss-spawned enemies. This keeps each
 * shop skin's procedural texture, internal motion, and rotation intact instead
 * of flattening the appearance into a single material colour.
 */
export function PlayerBossSkin({ skin, radius, healthPercent }: PlayerBossSkinProps) {
  switch (skin) {
    case "fire":
      return <MiniFireOrb radius={radius} healthPercent={healthPercent} showLight={false} />;
    case "star":
      return <MiniStarOrb radius={radius} healthPercent={healthPercent} showLight={false} />;
    case "crystal":
      return <MiniCrystalOrb radius={radius} showLight={false} />;
    case "toxic":
      return <MiniToxicOrb radius={radius} showLight={false} />;
    case "plasma":
      return <MiniPlasmaOrb radius={radius} showLight={false} />;
    case "diamond":
      return <MiniDiamondOrb radius={radius} showLight={false} />;
    case "rainbow":
      return <MiniRainbowOrb radius={radius} showLight={false} />;
    case "mecha":
      return <MiniMechaOrb radius={radius} showLight={false} />;
    case "monster":
      return <MiniMonsterOrb radius={radius} showLight={false} />;
  }
}