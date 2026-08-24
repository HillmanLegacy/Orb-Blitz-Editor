import type { BossType, PowerUpType, ProjectileType } from "@/lib/stores/useMagicOrb";

type CounterMap = Record<string, number>;

export type BalanceTelemetrySnapshot = Readonly<{
  runId: number;
  events: number;
  projectilesByType: CounterMap;
  powerUpsByType: CounterMap;
  bossDamage: number;
  bossDefeats: number;
  enemySpawns: number;
  rewards: number;
  poolRejects: number;
}>;

/**
 * Development-only observation of balance signals. It is bounded, reset per
 * run, and never participates in simulation decisions.
 */
export class BalanceTelemetry {
  private readonly enabled = import.meta.env.DEV;
  private runId = 0;
  private events = 0;
  private bossDamage = 0;
  private bossDefeats = 0;
  private enemySpawns = 0;
  private rewards = 0;
  private poolRejects = 0;
  private readonly projectilesByType: CounterMap = {};
  private readonly powerUpsByType: CounterMap = {};

  beginRun(): void {
    if (!this.enabled) return;
    this.runId += 1;
    this.events = 0;
    this.bossDamage = 0;
    this.bossDefeats = 0;
    this.enemySpawns = 0;
    this.rewards = 0;
    this.poolRejects = 0;
    for (const counters of [this.projectilesByType, this.powerUpsByType]) {
      for (const key of Object.keys(counters)) delete counters[key];
    }
  }

  recordProjectile(type: ProjectileType | undefined): void {
    if (!this.enabled) return;
    this.events += 1;
    const key = type ?? "normal";
    this.projectilesByType[key] = (this.projectilesByType[key] ?? 0) + 1;
  }

  recordPowerUp(type: PowerUpType): void {
    if (!this.enabled) return;
    this.events += 1;
    this.powerUpsByType[type] = (this.powerUpsByType[type] ?? 0) + 1;
  }

  recordEnemySpawn(): void {
    if (this.enabled) {
      this.events += 1;
      this.enemySpawns += 1;
    }
  }

  recordBossDamage(amount: number, _bossType?: BossType): void {
    if (!this.enabled) return;
    this.events += 1;
    this.bossDamage += Math.max(0, amount);
  }

  recordBossDefeat(): void {
    if (this.enabled) {
      this.events += 1;
      this.bossDefeats += 1;
    }
  }

  recordReward(amount: number): void {
    if (this.enabled) {
      this.events += 1;
      this.rewards += Math.max(0, amount);
    }
  }

  recordPoolReject(): void {
    if (this.enabled) {
      this.events += 1;
      this.poolRejects += 1;
    }
  }

  snapshot(): BalanceTelemetrySnapshot {
    return {
      runId: this.runId,
      events: this.events,
      projectilesByType: { ...this.projectilesByType },
      powerUpsByType: { ...this.powerUpsByType },
      bossDamage: this.bossDamage,
      bossDefeats: this.bossDefeats,
      enemySpawns: this.enemySpawns,
      rewards: this.rewards,
      poolRejects: this.poolRejects,
    };
  }
}

export const balanceTelemetry = new BalanceTelemetry();