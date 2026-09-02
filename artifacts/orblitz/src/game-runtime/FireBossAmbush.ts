import type { EnemySpawnView } from "./EnemySpawnConfig";

export const FIRE_BOSS_AMBUSH_HEALTH_THRESHOLD = 25;
export const FIRE_BOSS_AMBUSH_MAX_USES = 1;
export const FIRE_BOSS_AMBUSH_INITIAL_DELAY = 3.5;
export const FIRE_BOSS_AMBUSH_REPOSITION_DURATION = 1.35;
export const FIRE_BOSS_AMBUSH_CHARGE_DURATION = 1.9;
export const FIRE_BOSS_AMBUSH_DASH_DURATION = 0.9;
export const FIRE_BOSS_AMBUSH_RECOVERY_DURATION = 0.55;
export const FIRE_BOSS_AMBUSH_IMPACT_DURATION = 1.15;
export const FIRE_BOSS_AMBUSH_REPOSITION_SPEED = 7.5;
export const FIRE_BOSS_AMBUSH_DASH_EDGE_PADDING = 1.8;
export const FIRE_BOSS_AMBUSH_PLAYER_CLEARANCE = 4.5;
export const FIRE_BOSS_AMBUSH_CORNER_CHANCE = 0.35;
export const FIRE_BOSS_AMBUSH_DASH_EXIT_DISTANCE = 5;

export type FireBossAmbushPhase =
  | "idle"
  | "repositioning"
  | "charging"
  | "dashing"
  | "recovery";

export type FireBossAmbushImpact = Readonly<{
  id: number;
  position: [number, number, number];
  timer: number;
  defeatsBoss: false;
}>;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function boundedRandom(random: () => number): number {
  return clamp01(random());
}

function edgeCoordinate(halfExtent: number, padding: number, lane: number): number {
  const usableExtent = Math.max(0, halfExtent - padding);
  return lane * usableExtent;
}

function getTargetForRoll(
  view: EnemySpawnView,
  random: () => number,
): [number, number] {
  const padding = Math.min(
    FIRE_BOSS_AMBUSH_DASH_EDGE_PADDING,
    view.halfWidth * 0.45,
    view.halfHeight * 0.45,
  );
  const lane = boundedRandom(random) * 2 - 1;

  if (boundedRandom(random) < FIRE_BOSS_AMBUSH_CORNER_CHANCE) {
    const corner = Math.floor(boundedRandom(random) * 4);
    const x = corner === 0 || corner === 3 ? 1 : -1;
    const y = corner === 0 || corner === 1 ? 1 : -1;
    return [
      view.centerX + edgeCoordinate(view.halfWidth, padding, x),
      view.centerY + edgeCoordinate(view.halfHeight, padding, y),
    ];
  }

  const side = Math.floor(boundedRandom(random) * 4);
  if (side === 0) {
    return [
      view.centerX - edgeCoordinate(view.halfWidth, padding, 1),
      view.centerY + edgeCoordinate(view.halfHeight, padding, lane),
    ];
  }
  if (side === 1) {
    return [
      view.centerX + edgeCoordinate(view.halfWidth, padding, 1),
      view.centerY + edgeCoordinate(view.halfHeight, padding, lane),
    ];
  }
  if (side === 2) {
    return [
      view.centerX + edgeCoordinate(view.halfWidth, padding, lane),
      view.centerY - edgeCoordinate(view.halfHeight, padding, 1),
    ];
  }
  return [
    view.centerX + edgeCoordinate(view.halfWidth, padding, lane),
    view.centerY + edgeCoordinate(view.halfHeight, padding, 1),
  ];
}

/**
 * Select an on-screen launch point, avoiding the player when the player is near
 * the chosen edge. The bounded retry keeps this deterministic and finite.
 */
export function getFireBossAmbushTarget(
  view: EnemySpawnView,
  random: () => number = Math.random,
  avoidPosition?: readonly [number, number],
): [number, number] {
  let candidate = getTargetForRoll(view, random);
  if (!avoidPosition) return candidate;

  for (let attempt = 0; attempt < 8; attempt++) {
    const distance = Math.hypot(
      candidate[0] - avoidPosition[0],
      candidate[1] - avoidPosition[1],
    );
    if (distance >= FIRE_BOSS_AMBUSH_PLAYER_CLEARANCE) return candidate;
    candidate = getTargetForRoll(view, random);
  }
  return candidate;
}

/** A quadratic ease-in makes the charge read as slow first, then urgent. */
export function getFireBossAmbushChargeProgress(
  elapsed: number,
  duration = FIRE_BOSS_AMBUSH_CHARGE_DURATION,
): number {
  const normalized = clamp01(elapsed / Math.max(0.001, duration));
  return normalized * normalized;
}

export function getFireBossAmbushChargeSpeedMultiplier(progress: number): number {
  return 0.35 + clamp01(progress) * 0.65;
}

export function getFireBossAmbushDashProgress(
  elapsed: number,
  duration = FIRE_BOSS_AMBUSH_DASH_DURATION,
): number {
  return clamp01(elapsed / Math.max(0.001, duration));
}

/**
 * Continue past the player's captured location so the dash visibly crosses the
 * player instead of stopping on top of them.
 */
export function getFireBossAmbushDashDestination(
  start: readonly [number, number],
  playerTarget: readonly [number, number],
  view: EnemySpawnView,
): [number, number] {
  let dx = playerTarget[0] - start[0];
  let dy = playerTarget[1] - start[1];
  let distance = Math.hypot(dx, dy);
  if (distance < 0.001) {
    dx = 0;
    dy = 1;
    distance = 1;
  }

  const directionX = dx / distance;
  const directionY = dy / distance;
  const exitDistance = Math.max(
    FIRE_BOSS_AMBUSH_DASH_EXIT_DISTANCE,
    view.halfWidth * 0.75,
    view.halfHeight * 0.75,
  );
  return [
    playerTarget[0] + directionX * exitDistance,
    playerTarget[1] + directionY * exitDistance,
  ];
}

export function canStartFireBossAmbush(
  health: number,
  uses: number,
  phase: FireBossAmbushPhase,
  cooldown: number,
): boolean {
  return (
    health <= FIRE_BOSS_AMBUSH_HEALTH_THRESHOLD &&
    uses < FIRE_BOSS_AMBUSH_MAX_USES &&
    phase === "idle" &&
    cooldown <= 0
  );
}

export function createFireBossAmbushImpact(
  id: number,
  position: readonly [number, number, number],
): FireBossAmbushImpact {
  return {
    id,
    position: [position[0], position[1], position[2]],
    timer: FIRE_BOSS_AMBUSH_IMPACT_DURATION,
    defeatsBoss: false,
  };
}

export function getFireBossAmbushImpactProgress(
  timer: number,
  duration = FIRE_BOSS_AMBUSH_IMPACT_DURATION,
): number {
  return 1 - clamp01(timer / Math.max(0.001, duration));
}