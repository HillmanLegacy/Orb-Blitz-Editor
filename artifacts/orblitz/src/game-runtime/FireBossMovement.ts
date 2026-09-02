import type { EnemySpawnView } from "./EnemySpawnConfig";

export const FIRE_BOSS_NORMAL_PLAYER_CLEARANCE = 3.5;
const FIRE_BOSS_DEFAULT_EDGE_MARGIN = 1.25;
const FIRE_BOSS_AVOIDANCE_MARGIN = 0.9;
const FIRE_BOSS_AVOIDANCE_SAMPLES = 32;

export type FireBossMotionTuning = {
  maxSpeed: number;
  acceleration: number;
};

export type FireBossMotionStep = {
  position: [number, number];
  velocity: [number, number];
};

const distanceSquared = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Keep the Fire Boss's normal movement goal relative to where the player is
 * now, while keeping the goal inside the live perspective view.
 */
export function getFireBossPlayerRelativeTarget(
  view: EnemySpawnView,
  player: readonly [number, number],
  angle: number,
  distance: number,
  edgeMargin = FIRE_BOSS_DEFAULT_EDGE_MARGIN,
): [number, number] {
  const maxX = Math.max(0, view.halfWidth - edgeMargin);
  const maxY = Math.max(0, view.halfHeight - edgeMargin);
  return [
    clamp(
      player[0] + Math.cos(angle) * distance,
      view.centerX - maxX,
      view.centerX + maxX,
    ),
    clamp(
      player[1] + Math.sin(angle) * distance,
      view.centerY - maxY,
      view.centerY + maxY,
    ),
  ];
}

/**
 * Test the whole movement segment rather than only its endpoints. This is
 * intentionally independent of the collision system so normal boss steering
 * can prevent an intersecting path before runtime collision is reached.
 */
export function fireBossPathIntersectsPlayer(
  start: readonly [number, number],
  end: readonly [number, number],
  player: readonly [number, number],
  clearance: number = FIRE_BOSS_NORMAL_PLAYER_CLEARANCE,
): boolean {
  const segmentX = end[0] - start[0];
  const segmentY = end[1] - start[1];
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection = segmentLengthSquared > 0.000001
    ? clamp(
      ((player[0] - start[0]) * segmentX + (player[1] - start[1]) * segmentY) /
        segmentLengthSquared,
      0,
      1,
    )
    : 0;
  const closestX = start[0] + segmentX * projection;
  const closestY = start[1] + segmentY * projection;
  return distanceSquared(closestX, closestY, player[0], player[1]) <= clearance * clearance;
}

/**
 * Return a waypoint around the player's clearance circle when the direct
 * normal-movement route would cross it. A bounded angular search chooses the
 * shortest safe side, keeping the result deterministic for a given scene.
 */
export function getFireBossAvoidanceWaypoint(
  start: readonly [number, number],
  goal: readonly [number, number],
  player: readonly [number, number],
  clearance: number = FIRE_BOSS_NORMAL_PLAYER_CLEARANCE,
): [number, number] | null {
  if (!fireBossPathIntersectsPlayer(start, goal, player, clearance)) {
    return null;
  }

  const startDx = start[0] - player[0];
  const startDy = start[1] - player[1];
  const goalDx = goal[0] - player[0];
  const goalDy = goal[1] - player[1];
  const baseDx = Math.abs(startDx) + Math.abs(startDy) > 0.001 ? startDx : goalDx;
  const baseDy = Math.abs(startDx) + Math.abs(startDy) > 0.001 ? startDy : goalDy;
  const baseAngle = Math.atan2(baseDy, baseDx);
  const routeRadius = clearance + FIRE_BOSS_AVOIDANCE_MARGIN;

  let best: [number, number] | null = null;
  let bestLength = Number.POSITIVE_INFINITY;

  for (let index = 0; index < FIRE_BOSS_AVOIDANCE_SAMPLES; index++) {
    const angle = baseAngle + (index / FIRE_BOSS_AVOIDANCE_SAMPLES) * Math.PI * 2;
    const candidate: [number, number] = [
      player[0] + Math.cos(angle) * routeRadius,
      player[1] + Math.sin(angle) * routeRadius,
    ];

    if (
      fireBossPathIntersectsPlayer(start, candidate, player, clearance) ||
      fireBossPathIntersectsPlayer(candidate, goal, player, clearance)
    ) {
      continue;
    }

    const pathLength =
      Math.sqrt(distanceSquared(start[0], start[1], candidate[0], candidate[1])) +
      Math.sqrt(distanceSquared(candidate[0], candidate[1], goal[0], goal[1]));
    if (pathLength < bestLength) {
      best = candidate;
      bestLength = pathLength;
    }
  }

  if (best) return best;

  // If the player moved inside the clearance shell during a frame, move away
  // from them first. The next frame can then choose a normal detour.
  const fallbackLength = Math.hypot(baseDx, baseDy) || 1;
  return [
    player[0] + (baseDx / fallbackLength) * routeRadius,
    player[1] + (baseDy / fallbackLength) * routeRadius,
  ];
}

/**
 * Advance toward a goal with bounded acceleration and braking. Braking speed
 * is distance-aware, so phase handoffs preserve velocity without overshooting
 * or snapping to a new waypoint.
 */
export function stepFireBossMotion(
  current: readonly [number, number],
  velocity: readonly [number, number],
  goal: readonly [number, number],
  delta: number,
  tuning: FireBossMotionTuning,
): FireBossMotionStep {
  const dt = Math.max(0, Math.min(delta, 0.05));
  const dx = goal[0] - current[0];
  const dy = goal[1] - current[1];
  const distance = Math.hypot(dx, dy);
  const acceleration = Math.max(0.01, tuning.acceleration);
  const maxSpeed = Math.max(0, tuning.maxSpeed);
  const desiredSpeed = Math.min(maxSpeed, Math.sqrt(2 * acceleration * distance));
  const desiredVelocity: [number, number] = distance > 0.001
    ? [dx / distance * desiredSpeed, dy / distance * desiredSpeed]
    : [0, 0];

  const velocityDeltaX = desiredVelocity[0] - velocity[0];
  const velocityDeltaY = desiredVelocity[1] - velocity[1];
  const velocityDeltaLength = Math.hypot(velocityDeltaX, velocityDeltaY);
  const maxVelocityDelta = acceleration * dt;
  const changeScale = velocityDeltaLength > maxVelocityDelta
    ? maxVelocityDelta / velocityDeltaLength
    : 1;
  const nextVelocity: [number, number] = [
    velocity[0] + velocityDeltaX * changeScale,
    velocity[1] + velocityDeltaY * changeScale,
  ];

  let nextX = current[0] + nextVelocity[0] * dt;
  let nextY = current[1] + nextVelocity[1] * dt;
  if (distance > 0.001 && distanceSquared(current[0], current[1], nextX, nextY) > distance * distance) {
    nextX = goal[0];
    nextY = goal[1];
    nextVelocity[0] *= 0.25;
    nextVelocity[1] *= 0.25;
  }

  return {
    position: [nextX, nextY],
    velocity: nextVelocity,
  };
}