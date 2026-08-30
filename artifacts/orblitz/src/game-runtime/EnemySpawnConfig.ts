import type { OrbShape } from "@/lib/stores/useMagicOrb";

export const ENEMY_SPAWN_MARGIN = 1.5;
export const ENEMY_DESPAWN_MARGIN = 12;
export const BOSS_PROJECTILE_DESPAWN_X = 28;
export const BOSS_PROJECTILE_DESPAWN_Y = 18;
/** Chill deliberately admits one harmless ambient target roughly every six seconds. */
export const CHILL_AMBIENT_SPAWN_INTERVAL = 6;
export const CHILL_AMBIENT_MAX_ACTIVE = 8;
export const CHILL_AMBIENT_EDGE_PADDING = 1;

/**
 * Every non-boss visual that can be rendered and shot as a regular orb.
 * `launcher` is intentionally omitted: it is only an authored boss entity.
 */
export const CHILL_AMBIENT_SHAPES: readonly OrbShape[] = [
  "sphere", "cube", "tetrahedron", "octahedron", "dodecahedron",
  "circle", "star", "arrow", "triangle", "trapezoid", "lightning",
  "tentacle", "monster", "bird",
];

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

/** Select deterministically so a Chill admission cycles through all visual types. */
export function getChillAmbientShape(admission: number): OrbShape {
  return CHILL_AMBIENT_SHAPES[admission % CHILL_AMBIENT_SHAPES.length];
}

/** A player-independent heading for slow ambient Chill movement. */
export function getChillAmbientDirection(
  random: RandomSource = Math.random,
): [number, number, number] {
  const angle = Math.max(0, Math.min(0.999999, random())) * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle), 0];
}

/**
 * Retain Chill targets around the current camera with a gentle edge bounce.
 * Unlike hostile enemies, ambient targets are never pressure-despawned.
 */
export function bounceChillAmbientAtEdge(
  position: readonly [number, number, number],
  direction: readonly [number, number, number],
  view: EnemySpawnView,
): { position: [number, number, number]; direction: [number, number, number] } {
  const maxX = view.halfWidth + CHILL_AMBIENT_EDGE_PADDING;
  const maxY = view.halfHeight + CHILL_AMBIENT_EDGE_PADDING;
  let x = position[0];
  let y = position[1];
  let dx = direction[0];
  let dy = direction[1];

  if (x > view.centerX + maxX) { x = view.centerX + maxX; dx = -Math.abs(dx); }
  else if (x < view.centerX - maxX) { x = view.centerX - maxX; dx = Math.abs(dx); }
  if (y > view.centerY + maxY) { y = view.centerY + maxY; dy = -Math.abs(dy); }
  else if (y < view.centerY - maxY) { y = view.centerY - maxY; dy = Math.abs(dy); }

  return { position: [x, y, position[2]], direction: [dx, dy, direction[2]] };
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