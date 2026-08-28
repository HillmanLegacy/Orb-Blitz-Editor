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

const BASE_VISUAL_SCALE: Record<ProjectileType, number> = {
  normal: 0.144,
  rapidblaster: 0.11,
  scattershot: 0.13,
  spiral: 0.324,
  overcharged: 1.247,
  homing: 0.13,
  subblaster: 0.075,
};

export function getPlayerProjectileType(projectile: Pick<Projectile, "type">): ProjectileType {
  return projectile.type ?? "normal";
}

export function isPlayerProjectile(projectile: Pick<Projectile, "type">): boolean {
  return PLAYER_PROJECTILE_TYPES.includes(getPlayerProjectileType(projectile));
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
): number {
  const type = getPlayerProjectileType(projectile);
  const chargedMultiplier =
    projectile.isCharged &&
    (type === "normal" || type === "rapidblaster" || type === "scattershot" || type === "homing")
      ? 1.5
      : 1;
  const animatedScale = type === "overcharged" ? spawnScale : 1;
  return BASE_VISUAL_SCALE[type] * chargedMultiplier * animatedScale;
}