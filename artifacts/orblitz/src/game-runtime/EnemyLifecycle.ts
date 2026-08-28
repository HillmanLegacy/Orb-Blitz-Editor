export const ENEMY_DEFEAT_DURATION = 0.6;

export function getEnemyDefeatProgress(destroyTimer: number | undefined): number {
  const remaining = Math.min(ENEMY_DEFEAT_DURATION, Math.max(0, destroyTimer ?? 0));
  return 1 - remaining / ENEMY_DEFEAT_DURATION;
}