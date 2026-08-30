import type { GameMode } from "@/lib/stores/useMagicOrb";

export const STANDARD_ENEMY_DEFEAT_DURATION = 2;
export const ENEMY_DEFEAT_DURATION = STANDARD_ENEMY_DEFEAT_DURATION;

/** Standard-enemy star rewards live here so mode balancing stays data-driven. */
export const STANDARD_ENEMY_STAR_REWARDS: Readonly<Record<GameMode, number>> = {
  survival: 5,
  chill: 1,
  arcade: 5,
  gauntlet: 5,
};
export const BOSS_ORB_STAR_REWARD = 5;

export function getEnemyStarRewardCount(
  gameMode: GameMode,
  isBossOrb = false,
): number {
  return isBossOrb ? BOSS_ORB_STAR_REWARD : STANDARD_ENEMY_STAR_REWARDS[gameMode];
}

export type EnemyDefeatRemovalDecision = Readonly<{
  destroyTimer: number;
  remove: boolean;
}>;

/**
 * Standard enemies retain their zero-timer terminal frame so their defeat VFX
 * can render completion. Bosses keep their existing immediate removal timing.
 */
export function getEnemyDefeatRemovalDecision(
  isBossOrb: boolean,
  destroyTimer: number | undefined,
  delta: number,
): EnemyDefeatRemovalDecision {
  const timer = Math.max(0, destroyTimer ?? 0);
  const nextTimer = Math.max(0, timer - Math.max(0, delta));
  if (isBossOrb) return { destroyTimer: nextTimer, remove: nextTimer <= 0 };

  // A timer that crosses zero is published for one frame. On the following
  // simulation frame the already-observed terminal state can be released.
  return {
    destroyTimer: nextTimer,
    remove: timer <= 0,
  };
}

export function getEnemyDefeatProgress(destroyTimer: number | undefined): number {
  const remaining = Math.min(ENEMY_DEFEAT_DURATION, Math.max(0, destroyTimer ?? 0));
  return 1 - remaining / ENEMY_DEFEAT_DURATION;
}