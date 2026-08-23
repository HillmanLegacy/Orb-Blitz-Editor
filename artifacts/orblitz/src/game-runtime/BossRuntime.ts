export type RuntimeBoss = {
  id: string;
  position: [number, number, number];
  previousPosition: [number, number, number];
};

/** Live boss transform shared by rendering and swept collision. */
export class BossRuntime {
  private state: RuntimeBoss | null = null;

  beginFrame(id: string, position: [number, number, number]): RuntimeBoss {
    if (!this.state || this.state.id !== id) {
      this.state = {
        id,
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

  commit(id: string, position: [number, number, number]): void {
    if (!this.state || this.state.id !== id) {
      this.beginFrame(id, position);
      return;
    }
    this.state.position[0] = position[0];
    this.state.position[1] = position[1];
    this.state.position[2] = position[2];
  }

  get(id: string): RuntimeBoss | undefined {
    return this.state?.id === id ? this.state : undefined;
  }

  reset(): void {
    this.state = null;
  }
}