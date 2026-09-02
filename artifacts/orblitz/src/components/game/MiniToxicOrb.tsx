/**
 * MiniToxicOrb — compact Toxic renderer used by projectiles, player skins,
 * and regular World 4 enemies.
 *
 * The visual source is shared with ToxicBoss so every Toxic boss orb uses the
 * authored texture and the same droplet/light treatment. Callers can still
 * reduce particles/lights for high-count ordinary enemies.
 */

import { TOXIC_DRIP_COUNT, ToxicOrbVisual } from "./ToxicBoss";

export interface MiniToxicOrbProps {
  radius?: number;
  particleCount?: number;
  showParticles?: boolean;
  showLight?: boolean;
  animatePresentationYaw?: boolean;
}

export function MiniToxicOrb({
  radius = 1,
  particleCount = TOXIC_DRIP_COUNT,
  showParticles = true,
  showLight = true,
  animatePresentationYaw = true,
}: MiniToxicOrbProps) {
  return (
    <ToxicOrbVisual
      radius={radius}
      particleCount={particleCount}
      showParticles={showParticles}
      showLight={showLight}
      animatePresentationYaw={animatePresentationYaw}
    />
  );
}