export const POWER_UP_MIN_SPAWN_INTERVAL = 20;
export const POWER_UP_MAX_SPAWN_INTERVAL = 32;

export type RandomSource = () => number;

export class PowerUpSpawnScheduler {
  private elapsed = 0;
  private nextInterval: number;

  constructor(private readonly random: RandomSource = Math.random) {
    this.nextInterval = this.randomInterval();
  }

  reset(): void {
    this.elapsed = 0;
    this.nextInterval = this.randomInterval();
  }

  tick(delta: number): boolean {
    if (!Number.isFinite(delta) || delta <= 0) return false;
    this.elapsed += delta;
    if (this.elapsed < this.nextInterval) return false;

    this.elapsed = 0;
    this.nextInterval = this.randomInterval();
    return true;
  }

  private randomInterval(): number {
    const sample = Math.max(0, Math.min(1, this.random()));
    return POWER_UP_MIN_SPAWN_INTERVAL +
      sample * (POWER_UP_MAX_SPAWN_INTERVAL - POWER_UP_MIN_SPAWN_INTERVAL);
  }
}