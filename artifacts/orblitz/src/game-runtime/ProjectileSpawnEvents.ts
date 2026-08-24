import { runtimeDiagnostics } from "./RuntimeDiagnostics";

export const MAX_PROJECTILE_SPAWN_EVENTS = 64;

export type ProjectileSpawnEvent = {
  id: string;
  type: string | undefined;
  position: [number, number, number];
  direction: [number, number, number];
  volleyId: string | undefined;
};

type ProjectileSpawnSource = {
  id: string;
  type?: string;
  position: readonly [number, number, number];
  direction: readonly [number, number, number];
  volleyId?: string;
};

/**
 * A bounded bridge from successful structural spawns to presentation-only
 * effects. Effects consume this queue from the render loop without rescanning
 * every active projectile or relying on a React commit to observe a short shot.
 */
export class ProjectileSpawnEvents {
  private readonly events: ProjectileSpawnEvent[];
  private readIndex = 0;
  private writeIndex = 0;
  private count = 0;

  constructor(private readonly capacity = MAX_PROJECTILE_SPAWN_EVENTS) {
    this.events = Array.from({ length: capacity }, () => ({
      id: "",
      type: undefined,
      position: [0, 0, 0],
      direction: [0, 0, 0],
      volleyId: undefined,
    }));
  }

  enqueue(source: ProjectileSpawnSource): boolean {
    if (this.count >= this.capacity) {
      runtimeDiagnostics.noteSpawnEffectOverflow();
      return false;
    }

    const event = this.events[this.writeIndex];
    event.id = source.id;
    event.type = source.type;
    event.position[0] = source.position[0];
    event.position[1] = source.position[1];
    event.position[2] = source.position[2];
    event.direction[0] = source.direction[0];
    event.direction[1] = source.direction[1];
    event.direction[2] = source.direction[2];
    event.volleyId = source.volleyId;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.count++;
    return true;
  }

  consume(consumer: (event: Readonly<ProjectileSpawnEvent>) => void): void {
    while (this.count > 0) {
      consumer(this.events[this.readIndex]);
      this.readIndex = (this.readIndex + 1) % this.capacity;
      this.count--;
    }
  }

  reset(): void {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.count = 0;
  }
}