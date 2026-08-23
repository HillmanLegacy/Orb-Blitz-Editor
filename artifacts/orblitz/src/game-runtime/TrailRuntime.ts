import type { RuntimePool, RuntimeSlot } from "./RuntimeTypes";

export type RuntimeTrail = {
  id: string;
  slot: RuntimeSlot;
  positions: Float32Array;
  writeIndex: number;
  count: number;
};

/**
 * Reusable history buffers for trail renderers. Renderers own their Three
 * resources; this runtime owns only lightweight numeric history.
 */
export class TrailRuntime implements RuntimePool {
  private readonly byId = new Map<string, RuntimeTrail>();
  private readonly freeSlots: RuntimeSlot[] = [];
  private readonly recycled: RuntimeTrail[] = [];
  private nextSlot = 0;
  private _active = 0;
  private _capacity = 0;

  get active(): number { return this._active; }
  get capacity(): number { return this._capacity; }

  getOrCreate(id: string, pointCount: number): RuntimeTrail {
    const current = this.byId.get(id);
    if (current) return current;
    const requiredLength = pointCount * 3;
    const recycledIndex = this.recycled.findIndex((trail) => trail.positions.length === requiredLength);
    const reused = recycledIndex >= 0 ? this.recycled.splice(recycledIndex, 1)[0] : undefined;
    const trail: RuntimeTrail = reused ?? {
      id,
      slot: this.freeSlots.pop() ?? this.nextSlot++,
      positions: new Float32Array(requiredLength),
      writeIndex: 0,
      count: 0,
    };
    trail.id = id;
    trail.writeIndex = 0;
    trail.count = 0;
    this.byId.set(id, trail);
    this._active++;
    this._capacity = Math.max(this._capacity, this._active);
    return trail;
  }

  get(id: string): RuntimeTrail | undefined {
    return this.byId.get(id);
  }

  release(id: string): void {
    const trail = this.byId.get(id);
    if (!trail) return;
    this.byId.delete(id);
    this.freeSlots.push(trail.slot);
    this.recycled.push(trail);
    this._active--;
  }

  reset(): void {
    this.byId.clear();
    this.freeSlots.length = 0;
    this.recycled.length = 0;
    this.nextSlot = 0;
    this._active = 0;
    this._capacity = 0;
  }
}