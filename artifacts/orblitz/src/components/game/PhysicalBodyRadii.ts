import type { DarkOrb, Projectile } from "@/lib/stores/useMagicOrb";
import {
  getPlayerOrbScale,
  getPlayerProjectileType,
  getPlayerProjectileVisualScale,
  PLAYER_ORB_BASE_SCALE,
} from "./PlayerProjectileVisualConfig";

/** Gameplay bodies follow the authored core scales, not glow/trail VFX. */
export const BOSS_BODY_RADIUS = 1.44;
export const BOSS_ORB_BODY_RADIUS = 1.2;
export const POWER_UP_BODY_RADIUS = 0.72; // largest 0.4 icon extent × its 1.8 visual scale
export const SPIRAL_SUB_PROJECTILE_BODY_RADIUS = 0.324;

export function getPlayerOrbBodyRadius(health: number, maxHealth: number): number {
  return getPlayerOrbScale(health, maxHealth);
}

export function getStandardEnemyBodyRadius(orb: Pick<DarkOrb, "size" | "isBossOrb">): number {
  return orb.isBossOrb ? BOSS_ORB_BODY_RADIUS : Math.max(0, orb.size);
}

export function getPlayerProjectileBodyRadius(
  projectile: Pick<Projectile, "type" | "isCharged" | "size">,
  spawnScale = 1,
  playerScale = PLAYER_ORB_BASE_SCALE,
): number {
  if (getPlayerProjectileType(projectile) === "spiral") {
    return SPIRAL_SUB_PROJECTILE_BODY_RADIUS;
  }
  return getPlayerProjectileVisualScale(projectile, spawnScale, playerScale);
}

/** Combined sphere radius used by player projectiles against a standard enemy. */
export function getProjectileEnemyCollisionRadius(
  projectile: Pick<Projectile, "type" | "isCharged" | "size">,
  enemy: Pick<DarkOrb, "size" | "isBossOrb">,
  spawnScale = 1,
  playerScale = PLAYER_ORB_BASE_SCALE,
): number {
  return getPlayerProjectileBodyRadius(projectile, spawnScale, playerScale) + getStandardEnemyBodyRadius(enemy);
}

export function getBossImpactPosition(
  bossPosition: readonly [number, number, number],
  impactPosition: readonly [number, number, number],
  fallbackDirection: readonly [number, number, number],
): [number, number, number] {
  let x = impactPosition[0] - bossPosition[0];
  let y = impactPosition[1] - bossPosition[1];
  let z = impactPosition[2] - bossPosition[2];
  let length = Math.hypot(x, y, z);
  if (length < 1e-6) {
    [x, y, z] = fallbackDirection;
    length = Math.hypot(x, y, z) || 1;
  }
  return [
    bossPosition[0] + (x / length) * BOSS_BODY_RADIUS,
    bossPosition[1] + (y / length) * BOSS_BODY_RADIUS,
    bossPosition[2] + (z / length) * BOSS_BODY_RADIUS,
  ];
}