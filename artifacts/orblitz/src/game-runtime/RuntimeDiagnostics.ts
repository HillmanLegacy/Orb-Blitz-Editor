type Timings = {
  frameMs: number;
  simulationMs: number;
  collisionMs: number;
  renderMs: number;
  storeWrites: number;
  projectileRenders: number;
  enemyRenders: number;
};

/**
 * Development-only counters. This never uses React state and is compiled into
 * a no-op API in production through the same inexpensive guards.
 */
class RuntimeDiagnostics {
  private readonly enabled = import.meta.env.DEV;
  private frameStartedAt = 0;
  private simulationStartedAt = 0;
  private collisionStartedAt = 0;
  private readonly values: Timings = {
    frameMs: 0, simulationMs: 0, collisionMs: 0, renderMs: 0,
    storeWrites: 0, projectileRenders: 0, enemyRenders: 0,
  };

  beginFrame(): void {
    if (!this.enabled) return;
    this.frameStartedAt = performance.now();
    this.values.storeWrites = 0;
    this.values.projectileRenders = 0;
    this.values.enemyRenders = 0;
  }

  beginSimulation(): void {
    if (this.enabled) this.simulationStartedAt = performance.now();
  }

  endSimulation(): void {
    if (this.enabled) this.values.simulationMs = performance.now() - this.simulationStartedAt;
  }

  beginCollision(): void {
    if (this.enabled) this.collisionStartedAt = performance.now();
  }

  endCollision(): void {
    if (this.enabled) this.values.collisionMs = performance.now() - this.collisionStartedAt;
  }

  endFrame(): void {
    if (!this.enabled) return;
    this.values.frameMs = performance.now() - this.frameStartedAt;
    this.values.renderMs = Math.max(0, this.values.frameMs - this.values.simulationMs);
  }

  noteStoreWrite(): void { if (this.enabled) this.values.storeWrites++; }
  noteProjectileRender(): void { if (this.enabled) this.values.projectileRenders++; }
  noteEnemyRender(): void { if (this.enabled) this.values.enemyRenders++; }

  snapshot(): Readonly<Timings> {
    return this.values;
  }
}

export const runtimeDiagnostics = new RuntimeDiagnostics();