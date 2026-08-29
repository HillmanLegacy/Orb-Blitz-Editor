import type { Projectile, ProjectileType } from "@/lib/stores/useMagicOrb";
import type { TrailEffect } from "@/lib/stores/useShop";

export const PLAYER_PROJECTILE_TYPES: readonly ProjectileType[] = [
  "normal",
  "rapidblaster",
  "scattershot",
  "spiral",
  "overcharged",
  "homing",
  "subblaster",
];

export const PLAYER_ORB_BASE_SCALE = 0.72;
export const PLAYER_ORB_MIN_SCALE = 0.432;
const OVERCHARGED_VISUAL_SCALE = 1.247;
const PROJECTILE_PLAYER_SCALE_RATIO = 0.5;

export function getPlayerOrbScale(health: number, maxHealth: number): number {
  const healthRatio = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 1;
  return PLAYER_ORB_MIN_SCALE +
    (PLAYER_ORB_BASE_SCALE - PLAYER_ORB_MIN_SCALE) * healthRatio;
}

export function getPlayerProjectileType(projectile: Pick<Projectile, "type">): ProjectileType {
  return projectile.type ?? "normal";
}

export function isPlayerProjectile(projectile: Pick<Projectile, "type">): boolean {
  return PLAYER_PROJECTILE_TYPES.includes(getPlayerProjectileType(projectile));
}

export function usesExactPlayerVisual(projectile: Pick<Projectile, "type">): boolean {
  return getPlayerProjectileType(projectile) === "normal";
}

export function shouldRenderParticleSwarmOverlay(
  projectile: Pick<Projectile, "type">,
  trail: TrailEffect,
): boolean {
  return isPlayerProjectile(projectile) && trail === "particle_swarm";
}

export function getPlayerProjectileVisualScale(
  projectile: Pick<Projectile, "type" | "isCharged">,
  spawnScale = 1,
  playerScale = PLAYER_ORB_BASE_SCALE,
): number {
  const type = getPlayerProjectileType(projectile);
  if (type === "overcharged") return OVERCHARGED_VISUAL_SCALE * spawnScale;
  return playerScale * PROJECTILE_PLAYER_SCALE_RATIO;
}