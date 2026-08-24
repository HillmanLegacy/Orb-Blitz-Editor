import type { RuntimePool, RuntimeSlot } from "./RuntimeTypes";

export const MAX_RUNTIME_TRAILS = 128;
export const MAX_TRAIL_HISTORY_POINTS = 16;

export type RuntimeTrail = {
  id: string;
  slot: RuntimeSlot;
  positions: Float32Array;
  seeds: Float32Array;
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
  private readonly slots: RuntimeTrail[];
  private _active = 0;

  constructor(private readonly maxSlots = MAX_RUNTIME_TRAILS) {
    this.slots = Array.from({ length: maxSlots }, (_, slot) => ({
      id: "",
      slot,
      positions: new Float32Array(MAX_TRAIL_HISTORY_POINTS * 3),
      seeds: new Float32Array(MAX_TRAIL_HISTORY_POINTS),
      writeIndex: 0,
      count: 0,
    }));
    this.reset();
  }

  get active(): number { return this._active; }
  get capacity(): number { return this.maxSlots; }

  getOrCreate(id: string): RuntimeTrail | undefined {
    const current = this.byId.get(id);
    if (current) return current;
    const slot = this.freeSlots.pop();
    if (slot === undefined) return undefined;
    const trail = this.slots[slot];
    trail.id = id;
    trail.writeIndex = 0;
    trail.count = 0;
    this.byId.set(id, trail);
    this._active++;
    return trail;
  }

  get(id: string): RuntimeTrail | undefined {
    return this.byId.get(id);
  }

  entries(): IterableIterator<[string, RuntimeTrail]> {
    return this.byId.entries();
  }

  release(id: string): void {
    const trail = this.byId.get(id);
    if (!trail) return;
    this.byId.delete(id);
    this.freeSlots.push(trail.slot);
    trail.id = "";
    trail.writeIndex = 0;
    trail.count = 0;
    this._active--;
  }

  reset(): void {
    this.byId.clear();
    this.freeSlots.length = 0;
    for (let slot = this.maxSlots - 1; slot >= 0; slot--) {
      const trail = this.slots[slot];
      trail.id = "";
      trail.writeIndex = 0;
      trail.count = 0;
      this.freeSlots.push(slot);
    }
    this._active = 0;
  }
}