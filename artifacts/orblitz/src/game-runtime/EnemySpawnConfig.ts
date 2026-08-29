export const ENEMY_SPAWN_MARGIN = 1.5;
export const ENEMY_DESPAWN_MARGIN = 12;
export const BOSS_PROJECTILE_DESPAWN_X = 28;
export const BOSS_PROJECTILE_DESPAWN_Y = 18;

export type EnemySpawnView = {
  centerX: number;
  centerY: number;
  halfWidth: number;
  halfHeight: number;
};

export type RandomSource = () => number;

export type PerspectiveViewInput = {
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  planeZ: number;
  verticalFovDegrees: number;
  aspect: number;
};

export function getPerspectiveViewAtPlane(input: PerspectiveViewInput): EnemySpawnView {
  const depth = Math.max(1, Math.abs(input.cameraZ - input.planeZ));
  const halfHeight =
    Math.tan((input.verticalFovDegrees * Math.PI) / 360) * depth;
  return {
    centerX: input.cameraX,
    centerY: input.cameraY,
    halfWidth: halfHeight * Math.max(0.1, input.aspect),
    halfHeight,
  };
}

/**
 * Returns a point beyond one random edge of the camera's visible rectangle.
 * The lane stays inside the other axis so enemies enter from the perimeter
 * instead of appearing at arbitrary points in the playfield.
 */
export function getEnemySpawnPoint(
  view: EnemySpawnView,
  random: RandomSource = Math.random,
): [number, number] {
  const side = Math.floor(Math.max(0, Math.min(0.999999, random())) * 4);
  const lane = Math.max(0, Math.min(1, random())) * 2 - 1;
  const horizontalLane = lane * Math.max(0, view.halfHeight - ENEMY_SPAWN_MARGIN);
  const verticalLane = lane * Math.max(0, view.halfWidth - ENEMY_SPAWN_MARGIN);

  switch (side) {
    case 0:
      return [
        view.centerX - view.halfWidth - ENEMY_SPAWN_MARGIN,
        view.centerY + horizontalLane,
      ];
    case 1:
      return [
        view.centerX + view.halfWidth + ENEMY_SPAWN_MARGIN,
        view.centerY + horizontalLane,
      ];
    case 2:
      return [
        view.centerX + verticalLane,
        view.centerY - view.halfHeight - ENEMY_SPAWN_MARGIN,
      ];
    default:
      return [
        view.centerX + verticalLane,
        view.centerY + view.halfHeight + ENEMY_SPAWN_MARGIN,
      ];
  }
}

export function isOutsideEnemyDespawnBounds(
  position: readonly [number, number, number],
  view: EnemySpawnView,
): boolean {
  return (
    Math.abs(position[0] - view.centerX) > view.halfWidth + ENEMY_DESPAWN_MARGIN ||
    Math.abs(position[1] - view.centerY) > view.halfHeight + ENEMY_DESPAWN_MARGIN
  );
}

export function isOutsideBossProjectileDespawnBounds(
  position: readonly [number, number, number],
): boolean {
  return (
    Math.abs(position[0]) > BOSS_PROJECTILE_DESPAWN_X ||
    Math.abs(position[1]) > BOSS_PROJECTILE_DESPAWN_Y
  );
}