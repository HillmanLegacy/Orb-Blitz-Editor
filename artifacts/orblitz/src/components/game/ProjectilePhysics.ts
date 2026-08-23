import type { Projectile } from "@/lib/stores/useMagicOrb";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import type { RuntimeProjectile } from "@/game-runtime/ProjectileRuntime";

export type ProjectileMotion = RuntimeProjectile;

/**
 * Compatibility export for existing visual components. This is not a second
 * physics map: it is the runtime's authoritative live-motion registry.
 */
export const projectilePhysicsMap = gameRuntime.projectiles.byId;

export function motionFromProjectile(projectile: Projectile): ProjectileMotion {
  return gameRuntime.projectiles.getOrCreate({
    id: projectile.id,
    position: projectile.position,
    direction: projectile.direction,
    speed: projectile.speed,
    spiralAngle: projectile.spiralAngle,
    spawnScale: projectile.spawnScale,
    spawnScaleTimer: projectile.spawnScaleTimer,
    subSphereAlive: projectile.subSphereAlive
      ? [projectile.subSphereAlive[0], projectile.subSphereAlive[1], projectile.subSphereAlive[2]]
      : undefined,
    travelTimer: projectile.travelTimer,
    hitCount: projectile.hitCount,
  });
}

export function getProjectileMotion(projectile: Projectile): ProjectileMotion {
  return motionFromProjectile(projectile);
}

export function releaseProjectileMotion(id: string): void {
  gameRuntime.projectiles.release(id);
}

export function resetProjectileMotion(): void {
  gameRuntime.projectiles.reset();
}