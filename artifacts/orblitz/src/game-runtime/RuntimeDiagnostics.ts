import type { WebGLRenderer } from "three";
import { performanceFeatureSnapshot } from "./PerformanceToggles";

type Timings = {
  frameMs: number;
  simulationMs: number;
  collisionMs: number;
  /** CPU callback time outside measured simulation; not a GPU render measurement. */
  cpuCallbackMs: number;
  storeWrites: number;
  projectileRenders: number;
  enemyRenders: number;
};

type FramePercentiles = {
  samples: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

type RendererStats = {
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
};

type RenderQualityDiagnostics = {
  tier: "high" | "medium" | "low";
  pixelRatio: number;
  transitionCount: number;
  lastTransitionReason: string;
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
    frameMs: 0, simulationMs: 0, collisionMs: 0, cpuCallbackMs: 0,
    storeWrites: 0, projectileRenders: 0, enemyRenders: 0,
  };
  private readonly frameHistory = new Float32Array(180);
  private frameHistorySize = 0;
  private frameHistoryCursor = 0;
  private readonly rendererStats: RendererStats = {
    drawCalls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
  };
  private readonly renderQuality: RenderQualityDiagnostics = {
    tier: "high",
    pixelRatio: 1,
    transitionCount: 0,
    lastTransitionReason: "initial",
  };

  beginFrame(): void {
    if (!this.enabled) return;
    this.frameStartedAt = performance.now();
    this.values.storeWrites = 0;
    this.values.projectileRenders = 0;
    this.values.enemyRenders = 0;
    this.values.simulationMs = 0;
    this.values.collisionMs = 0;
    this.values.cpuCallbackMs = 0;
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

  endFrame(renderer?: WebGLRenderer): void {
    if (!this.enabled) return;
    this.values.frameMs = performance.now() - this.frameStartedAt;
    this.values.cpuCallbackMs = Math.max(0, this.values.frameMs - this.values.simulationMs);
    this.frameHistory[this.frameHistoryCursor] = this.values.frameMs;
    this.frameHistoryCursor = (this.frameHistoryCursor + 1) % this.frameHistory.length;
    this.frameHistorySize = Math.min(this.frameHistorySize + 1, this.frameHistory.length);
    if (renderer) this.recordRenderer(renderer);
  }

  noteStoreWrite(): void { if (this.enabled) this.values.storeWrites++; }
  noteProjectileRender(): void { if (this.enabled) this.values.projectileRenders++; }
  noteEnemyRender(): void { if (this.enabled) this.values.enemyRenders++; }

  setRenderQuality(value: RenderQualityDiagnostics): void {
    if (!this.enabled) return;
    this.renderQuality.tier = value.tier;
    this.renderQuality.pixelRatio = value.pixelRatio;
    this.renderQuality.transitionCount = value.transitionCount;
    this.renderQuality.lastTransitionReason = value.lastTransitionReason;
  }

  private recordRenderer(renderer: WebGLRenderer): void {
    const render = renderer.info.render;
    const memory = renderer.info.memory;
    this.rendererStats.drawCalls = render.calls;
    this.rendererStats.triangles = render.triangles;
    this.rendererStats.points = render.points;
    this.rendererStats.lines = render.lines;
    this.rendererStats.geometries = memory.geometries;
    this.rendererStats.textures = memory.textures;
    this.rendererStats.programs = renderer.info.programs?.length ?? 0;
  }

  private framePercentiles(): FramePercentiles {
    if (this.frameHistorySize === 0) {
      return { samples: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
    }

    // Snapshot is development-only and invoked manually, so sorting a copy never
    // impacts the gameplay frame path.
    const values = Array.from(this.frameHistory.slice(0, this.frameHistorySize));
    values.sort((a, b) => a - b);
    const percentile = (fraction: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
    return {
      samples: values.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maxMs: values[values.length - 1],
    };
  }

  snapshot(): Readonly<Timings> & {
    framePercentiles: FramePercentiles;
    renderer: RendererStats;
    features: ReturnType<typeof performanceFeatureSnapshot>;
  } {
    return {
      ...this.values,
      framePercentiles: this.framePercentiles(),
      renderer: { ...this.rendererStats },
      features: performanceFeatureSnapshot(),
    };
  }

  qualitySnapshot(): Readonly<RenderQualityDiagnostics> {
    return this.renderQuality;
  }
}

export const runtimeDiagnostics = new RuntimeDiagnostics();