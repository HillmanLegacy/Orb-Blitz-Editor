import type { ProjectileSource, RuntimePool, RuntimeSlot } from "./RuntimeTypes";

export type RuntimeProjectile = {
  id: string;
  slot: RuntimeSlot;
  position: [number, number, number];
  direction: [number, number, number];
  spiralAngle?: number;
  spawnScale?: number;
  spawnScaleTimer?: number;
  subSphereAlive?: [boolean, boolean, boolean];
  travelTimer?: number;
  hitCount?: number;
};

/**
 * Owns live projectile transform and animation data. Store projectiles are
 * structural records; callers must use this runtime for real-time motion.
 */
export class ProjectileRuntime implements RuntimePool {
  readonly byId = new Map<string, RuntimeProjectile>();
  private readonly freeSlots: RuntimeSlot[] = [];
  private nextSlot = 0;
  private _active = 0;
  private _capacity = 0;

  get active(): number {
    return this._active;
  }

  get capacity(): number {
    return this._capacity;
  }

  get(id: string): RuntimeProjectile | undefined {
    return this.byId.get(id);
  }

  getOrCreate(source: ProjectileSource & Partial<RuntimeProjectile> & { id: string }): RuntimeProjectile {
    const existing = this.byId.get(source.id);
    if (existing) return existing;

    const slot = this.freeSlots.pop() ?? this.nextSlot++;
    const state: RuntimeProjectile = {
      id: source.id,
      slot,
      position: [source.position[0], source.position[1], source.position[2]],
      direction: [source.direction[0], source.direction[1], source.direction[2]],
      spiralAngle: source.spiralAngle,
      spawnScale: source.spawnScale,
      spawnScaleTimer: source.spawnScaleTimer,
      subSphereAlive: source.subSphereAlive
        ? [source.subSphereAlive[0], source.subSphereAlive[1], source.subSphereAlive[2]]
        : undefined,
      travelTimer: source.travelTimer,
      hitCount: source.hitCount,
    };
    this.byId.set(source.id, state);
    this._active++;
    this._capacity = Math.max(this._capacity, this._active);
    return state;
  }

  release(id: string): void {
    const state = this.byId.get(id);
    if (!state) return;
    this.byId.delete(id);
    this.freeSlots.push(state.slot);
    this._active--;
  }

  reset(): void {
    this.byId.clear();
    this.freeSlots.length = 0;
    this.nextSlot = 0;
    this._active = 0;
    this._capacity = 0;
  }
}