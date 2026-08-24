import type { PowerUp, PowerUpType } from "@/lib/stores/useMagicOrb";

export const POWER_UP_DESTROY_DURATION = 0.72;
export const POWER_UP_HURT_DURATION = 0.10;
export const POWER_UP_COLLECT_DURATION = 0.4;

export type RuntimePowerUp = {
  readonly id: string;
  readonly type: PowerUpType;
  readonly velocity: [number, number, number];
  position: [number, number, number];
  collected: boolean;
  collectTimer: number;
  hurtTimer: number;
  destroying: boolean;
  destroyTimer: number;
};

export type PowerUpStatePatch = {
  hurtTimer?: number;
  destroying?: boolean;
  destroyTimer?: number;
  collected?: boolean;
  collectTimer?: number;
};

export type PowerUpRuntimeTick = {
  readonly stateChanges: Array<{ id: string; patch: PowerUpStatePatch }>;
  readonly removedIds: string[];
  readonly activations: Array<{ id: string; type: PowerUpType }>;
};

/**
 * Owns high-frequency pickup motion and animation timers.
 *
 * The store remains the source of structural pickup membership and gameplay
 * actions. This runtime intentionally does not replace the store array each
 * frame, so movement cannot fan out into React/Zustand subscribers.
 */
export class PowerUpRuntime {
  private readonly byId = new Map<string, RuntimePowerUp>();

  get active(): number {
    return this.byId.size;
  }

  get(id: string): RuntimePowerUp | undefined {
    return this.byId.get(id);
  }

  positionFor(powerUp: Pick<PowerUp, "id" | "position">): [number, number, number] {
    return this.byId.get(powerUp.id)?.position ?? powerUp.position;
  }

  reset(): void {
    this.byId.clear();
  }

  sync(powerUps: readonly PowerUp[]): void {
    const liveIds = new Set<string>();

    for (const powerUp of powerUps) {
      liveIds.add(powerUp.id);
      const existing = this.byId.get(powerUp.id);
      if (!existing) {
        this.byId.set(powerUp.id, {
          id: powerUp.id,
          type: powerUp.type,
          velocity: [...powerUp.velocity],
          position: [...powerUp.position],
          collected: Boolean(powerUp.collected),
          collectTimer: powerUp.collectTimer ?? 0,
          hurtTimer: powerUp.hurtTimer ?? 0,
          destroying: Boolean(powerUp.destroying),
          destroyTimer: powerUp.destroyTimer ?? POWER_UP_DESTROY_DURATION,
        });
        continue;
      }

      // Boolean transitions originate from authoritative store actions. Do not
      // copy countdown values back on every frame or runtime animation resets.
      if (Boolean(powerUp.collected) !== existing.collected) {
        existing.collected = Boolean(powerUp.collected);
        existing.collectTimer = powerUp.collectTimer ?? POWER_UP_COLLECT_DURATION;
      }
      if (Boolean(powerUp.destroying) !== existing.destroying) {
        existing.destroying = Boolean(powerUp.destroying);
        existing.destroyTimer = powerUp.destroyTimer ?? POWER_UP_DESTROY_DURATION;
      }
      if ((powerUp.hurtTimer ?? 0) > 0 && existing.hurtTimer <= 0) {
        existing.hurtTimer = powerUp.hurtTimer ?? POWER_UP_HURT_DURATION;
      }
    }

    for (const id of this.byId.keys()) {
      if (!liveIds.has(id)) this.byId.delete(id);
    }
  }

  tick(delta: number): PowerUpRuntimeTick {
    const result: PowerUpRuntimeTick = {
      stateChanges: [],
      removedIds: [],
      activations: [],
    };

    if (!Number.isFinite(delta) || delta <= 0) return result;

    const finishedIds = new Set<string>();

    for (const powerUp of this.byId.values()) {
      if (powerUp.collected) {
        powerUp.collectTimer -= delta;
        if (powerUp.collectTimer <= 0) {
          result.removedIds.push(powerUp.id);
          finishedIds.add(powerUp.id);
        }
        continue;
      }

      if (powerUp.destroying) {
        powerUp.destroyTimer -= delta;
        if (powerUp.destroyTimer <= 0) {
          result.activations.push({ id: powerUp.id, type: powerUp.type });
          finishedIds.add(powerUp.id);
        }
        continue;
      }

      if (powerUp.hurtTimer > 0) {
        powerUp.hurtTimer -= delta;
        if (powerUp.hurtTimer <= 0) {
          powerUp.hurtTimer = 0;
          powerUp.destroying = true;
          powerUp.destroyTimer = POWER_UP_DESTROY_DURATION;
          result.stateChanges.push({
            id: powerUp.id,
            patch: {
              hurtTimer: 0,
              destroying: true,
              destroyTimer: POWER_UP_DESTROY_DURATION,
            },
          });
        }
        continue;
      }

      powerUp.position[0] += powerUp.velocity[0] * delta;
      powerUp.position[1] += powerUp.velocity[1] * delta;
      powerUp.position[2] += powerUp.velocity[2] * delta;

      if (Math.abs(powerUp.position[0]) > 15 || Math.abs(powerUp.position[1]) > 10) {
        result.removedIds.push(powerUp.id);
        finishedIds.add(powerUp.id);
      }
    }

    for (const id of finishedIds) this.byId.delete(id);
    return result;
  }
}