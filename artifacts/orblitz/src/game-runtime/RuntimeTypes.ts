/**
 * Types shared by the allocation-free game runtime. They intentionally use
 * structural typing so store Projectile and DarkOrb values can be passed in
 * without making this runtime depend on a store implementation.
 */
export type Vec3Tuple = readonly [number, number, number];

export interface ProjectileSource {
  position: Vec3Tuple;
  direction: Vec3Tuple;
  speed?: number;
}

export interface EnemySource {
  position: Vec3Tuple;
  direction?: Vec3Tuple;
  speed: number;
  age?: number;
}

export interface TrailSource {
  position: Vec3Tuple;
  lifetime: number;
  width?: number;
}

export interface ParticleSource {
  position: Vec3Tuple;
  velocity: Vec3Tuple;
  lifetime: number;
  size?: number;
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
}

/** A slot is stable until it is released. Released slots may be reused. */
export type RuntimeSlot = number;

export interface RuntimePoolStats {
  readonly capacity: number;
  readonly active: number;
}

export interface RuntimePool extends RuntimePoolStats {
  reset(): void;
}