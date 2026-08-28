export const STANDARD_ENEMY_DEFEAT_DURATION = 2;
export const ENEMY_DEFEAT_DURATION = STANDARD_ENEMY_DEFEAT_DURATION;

export function getEnemyDefeatProgress(destroyTimer: number | undefined): number {
  const remaining = Math.min(ENEMY_DEFEAT_DURATION, Math.max(0, destroyTimer ?? 0));
  return 1 - remaining / ENEMY_DEFEAT_DURATION;
}