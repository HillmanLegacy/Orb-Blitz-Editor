export const SIMULATION_STAGES = [
  "clock",
  "enemies",
  "boss",
  "projectiles",
  "run",
  "powerUps",
  "presentation",
] as const;

export type SimulationStage = typeof SIMULATION_STAGES[number];

/**
 * Documents and observes the existing gameplay-frame order without taking over
 * React Three Fiber scheduling. Systems keep their established callback
 * priorities; this coordinator makes that implicit dependency visible in dev
 * diagnostics and gives new systems one named place in the order.
 */
export class SimulationPipeline {
  private frame = 0;
  private readonly entered = new Set<SimulationStage>();
  private readonly order: SimulationStage[] = [];

  beginFrame(): void {
    this.frame += 1;
    this.entered.clear();
    this.order.length = 0;
  }

  enter(stage: SimulationStage): void {
    if (this.entered.has(stage)) return;
    this.entered.add(stage);
    this.order.push(stage);
  }

  snapshot(): Readonly<{ frame: number; order: readonly SimulationStage[] }> {
    return { frame: this.frame, order: [...this.order] };
  }
}