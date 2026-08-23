import type { EnemySource, RuntimePool, RuntimeSlot } from "./RuntimeTypes";

export type RuntimeEnemy = {
  id: string;
  slot: RuntimeSlot;
  position: [number, number, number];
  previousPosition: [number, number, number];
  direction: [number, number, number];
  speed: number;
  age: number;
};

/** Mutable transform state for normal and boss-spawned enemies. */
export class EnemyRuntime implements RuntimePool {
  readonly byId = new Map<string, RuntimeEnemy>();
  private readonly freeSlots: RuntimeSlot[] = [];
  private nextSlot = 0;
  private _active = 0;
  private _capacity = 0;

  get active(): number { return this._active; }
  get capacity(): number { return this._capacity; }

  getOrCreate(source: EnemySource & { id: string }): RuntimeEnemy {
    const existing = this.byId.get(source.id);
    if (existing) return existing;
    const slot = this.freeSlots.pop() ?? this.nextSlot++;
    const state: RuntimeEnemy = {
      id: source.id,
      slot,
      position: [source.position[0], source.position[1], source.position[2]],
      previousPosition: [source.position[0], source.position[1], source.position[2]],
      direction: source.direction
        ? [source.direction[0], source.direction[1], source.direction[2]]
        : [0, 0, 0],
      speed: source.speed,
      age: source.age ?? 0,
    };
    this.byId.set(source.id, state);
    this._active++;
    this._capacity = Math.max(this._capacity, this._active);
    return state;
  }

  get(id: string): RuntimeEnemy | undefined {
    return this.byId.get(id);
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