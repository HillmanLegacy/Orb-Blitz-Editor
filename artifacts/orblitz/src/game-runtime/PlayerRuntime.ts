export type RuntimePlayer = {
  position: [number, number, number];
  previousPosition: [number, number, number];
};

/** Mutable player transform for relative-motion collision checks. */
export class PlayerRuntime {
  private state: RuntimePlayer | null = null;

  beginFrame(position: readonly [number, number, number]): RuntimePlayer {
    if (!this.state) {
      this.state = {
        position: [position[0], position[1], position[2]],
        previousPosition: [position[0], position[1], position[2]],
      };
      return this.state;
    }
    this.state.previousPosition[0] = this.state.position[0];
    this.state.previousPosition[1] = this.state.position[1];
    this.state.previousPosition[2] = this.state.position[2];
    this.state.position[0] = position[0];
    this.state.position[1] = position[1];
    this.state.position[2] = position[2];
    return this.state;
  }

  reset(): void { this.state = null; }
}