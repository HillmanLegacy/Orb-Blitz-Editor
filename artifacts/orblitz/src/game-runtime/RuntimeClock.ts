/** Shared, manually advanced game clock. */
export class RuntimeClock {
  elapsed = 0;
  delta = 0;
  frame = 0;
  paused = false;

  tick(deltaSeconds: number): number {
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0
      ? deltaSeconds
      : 0;
    this.delta = this.paused ? 0 : delta;
    if (!this.paused) this.elapsed += delta;
    this.frame++;
    return this.delta;
  }

  reset(): void {
    this.elapsed = 0;
    this.delta = 0;
    this.frame = 0;
    this.paused = false;
  }
}