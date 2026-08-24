import type { BossType } from "@/lib/stores/useMagicOrb";

export type AuthoredBossProgression = Readonly<{
  worldLevel: number;
  bossType: BossType;
  health: number;
}>;

/**
 * Authored progression is deliberately data-first. Keeping the current values
 * here makes difficulty changes reviewable without burying them in lifecycle
 * handlers, while the initial table preserves the existing game balance.
 */
export const AUTHORED_BOSS_PROGRESSION: readonly AuthoredBossProgression[] = [
  { worldLevel: 1, bossType: "circle", health: 100 },
  { worldLevel: 2, bossType: "star", health: 100 },
  { worldLevel: 3, bossType: "triangle", health: 100 },
  { worldLevel: 4, bossType: "trapezoid", health: 100 },
  { worldLevel: 5, bossType: "cube", health: 100 },
  { worldLevel: 6, bossType: "cloud", health: 100 },
  { worldLevel: 7, bossType: "arrow", health: 100 },
  { worldLevel: 8, bossType: "tentacle", health: 100 },
  { worldLevel: 9, bossType: "monster", health: 100 },
];

export function getAuthoredBossProgression(worldLevel: number): AuthoredBossProgression {
  return AUTHORED_BOSS_PROGRESSION.find((entry) => entry.worldLevel === worldLevel)
    ?? AUTHORED_BOSS_PROGRESSION[AUTHORED_BOSS_PROGRESSION.length - 1];
}

export function getArcadeRequiredOrbs(level: number): number {
  const worldLevel = Math.floor(level);
  const subLevel = Math.round((level % 1) * 10);
  if (subLevel === 9) return 1;
  return 15 + (worldLevel - 1) * 10 + (subLevel - 1) * 5;
}