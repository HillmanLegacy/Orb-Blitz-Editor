import type { ParticleSource, RuntimePool, RuntimeSlot } from "./RuntimeTypes";

type RuntimeParticle = ParticleSource & { id: string; slot: RuntimeSlot; active: boolean };

/** Pool for future particle renderers; safe to use now for diagnostics/lifecycle. */
export class ParticleRuntime implements RuntimePool {
  private readonly byId = new Map<string, RuntimeParticle>();
  private readonly freeSlots: RuntimeSlot[] = [];
  private nextSlot = 0;
  private _active = 0;
  private _capacity = 0;

  get active(): number { return this._active; }
  get capacity(): number { return this._capacity; }

  spawn(source: ParticleSource & { id: string }): RuntimeParticle {
    const current = this.byId.get(source.id);
    if (current) return current;
    const slot = this.freeSlots.pop() ?? this.nextSlot++;
    const particle: RuntimeParticle = { ...source, slot, active: true };
    this.byId.set(source.id, particle);
    this._active++;
    this._capacity = Math.max(this._capacity, this._active);
    return particle;
  }

  release(id: string): void {
    const particle = this.byId.get(id);
    if (!particle) return;
    this.byId.delete(id);
    this.freeSlots.push(particle.slot);
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