import type { ProjectileSource, RuntimePool, RuntimeSlot } from "./RuntimeTypes";
import { runtimeDiagnostics } from "./RuntimeDiagnostics";

/** Matches the shared instanced projectile renderer's maximum instance count. */
export const MAX_RUNTIME_PROJECTILES = 512;

export type RuntimeProjectile = {
  id: string;
  slot: RuntimeSlot;
  position: [number, number, number];
  previousPosition: [number, number, number];
  direction: [number, number, number];
  previousDirection: [number, number, number];
  spiralAngle?: number;
  previousSpiralAngle?: number;
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
  private readonly slots: RuntimeProjectile[];
  private _active = 0;

  constructor(private readonly maxSlots = MAX_RUNTIME_PROJECTILES) {
    this.slots = Array.from({ length: maxSlots }, (_, slot) => ({
      id: "",
      slot,
      position: [0, 0, 0],
      previousPosition: [0, 0, 0],
      direction: [0, 0, 0],
      previousDirection: [0, 0, 0],
    }));
    this.reset();
  }

  get active(): number {
    return this._active;
  }

  get capacity(): number {
    return this.maxSlots;
  }

  get(id: string): RuntimeProjectile | undefined {
    return this.byId.get(id);
  }

  getOrCreate(source: ProjectileSource & Partial<RuntimeProjectile> & { id: string }): RuntimeProjectile {
    const existing = this.byId.get(source.id);
    if (existing) return existing;

    const slot = this.freeSlots.pop();
    if (slot === undefined) {
      runtimeDiagnostics.noteProjectileOverflow();
      throw new Error(`Projectile runtime capacity (${this.maxSlots}) exceeded.`);
    }

    const state = this.slots[slot];
    state.id = source.id;
    state.position[0] = source.position[0];
    state.position[1] = source.position[1];
    state.position[2] = source.position[2];
    state.previousPosition[0] = source.position[0];
    state.previousPosition[1] = source.position[1];
    state.previousPosition[2] = source.position[2];
    state.direction[0] = source.direction[0];
    state.direction[1] = source.direction[1];
    state.direction[2] = source.direction[2];
    state.previousDirection[0] = source.direction[0];
    state.previousDirection[1] = source.direction[1];
    state.previousDirection[2] = source.direction[2];
    state.spiralAngle = source.spiralAngle;
    state.previousSpiralAngle = source.spiralAngle;
    state.spawnScale = source.spawnScale;
    state.spawnScaleTimer = source.spawnScaleTimer;
    state.subSphereAlive = source.subSphereAlive
      ? [source.subSphereAlive[0], source.subSphereAlive[1], source.subSphereAlive[2]]
      : undefined;
    state.travelTimer = source.travelTimer;
    state.hitCount = source.hitCount;
    this.byId.set(source.id, state);
    this._active++;
    return state;
  }

  release(id: string): void {
    const state = this.byId.get(id);
    if (!state) return;
    this.byId.delete(id);
    this.freeSlots.push(state.slot);
    state.id = "";
    state.spiralAngle = undefined;
    state.previousSpiralAngle = undefined;
    state.spawnScale = undefined;
    state.spawnScaleTimer = undefined;
    state.subSphereAlive = undefined;
    state.travelTimer = undefined;
    state.hitCount = undefined;
    this._active--;
  }

  reset(): void {
    this.byId.clear();
    this.freeSlots.length = 0;
    for (let slot = this.maxSlots - 1; slot >= 0; slot--) {
      const state = this.slots[slot];
      state.id = "";
      state.spiralAngle = undefined;
      state.previousSpiralAngle = undefined;
      state.spawnScale = undefined;
      state.spawnScaleTimer = undefined;
      state.subSphereAlive = undefined;
      state.travelTimer = undefined;
      state.hitCount = undefined;
      this.freeSlots.push(slot);
    }
    this._active = 0;
  }
}