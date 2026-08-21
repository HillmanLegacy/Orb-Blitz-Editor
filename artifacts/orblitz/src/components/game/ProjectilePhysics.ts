import type { Projectile } from "@/lib/stores/useMagicOrb";

export type ProjectileMotion = {
  position: [number, number, number];
  direction: [number, number, number];
  spiralAngle?: number;
  spawnScale?: number;
  spawnScaleTimer?: number;
  subSphereAlive?: [boolean, boolean, boolean];
  travelTimer?: number;
};

export const projectilePhysicsMap = new Map<string, ProjectileMotion>();

export function motionFromProjectile(projectile: Projectile): ProjectileMotion {
  return {
    position: [...projectile.position] as [number, number, number],
    direction: [...projectile.direction] as [number, number, number],
    spiralAngle: projectile.spiralAngle,
    spawnScale: projectile.spawnScale,
    spawnScaleTimer: projectile.spawnScaleTimer,
    subSphereAlive: projectile.subSphereAlive
      ? [...projectile.subSphereAlive] as [boolean, boolean, boolean]
      : undefined,
    travelTimer: projectile.travelTimer,
  };
}

export function getProjectileMotion(projectile: Projectile): ProjectileMotion {
  let motion = projectilePhysicsMap.get(projectile.id);
  if (!motion) {
    motion = motionFromProjectile(projectile);
    projectilePhysicsMap.set(projectile.id, motion);
  }
  return motion;
}