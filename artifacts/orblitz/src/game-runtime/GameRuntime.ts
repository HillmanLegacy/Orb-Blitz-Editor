import { BossRuntime } from "./BossRuntime";
import { BalanceTelemetry, balanceTelemetry } from "./BalanceTelemetry";
import { EnemyRuntime } from "./EnemyRuntime";
import { ParticleRuntime } from "./ParticleRuntime";
import { ProjectileSpawnEvents } from "./ProjectileSpawnEvents";
import { MAX_RUNTIME_PROJECTILES, ProjectileRuntime } from "./ProjectileRuntime";
import { PowerUpRuntime } from "./PowerUpRuntime";
import { PowerUpSpawnScheduler } from "./PowerUpSpawnScheduler";
import { RuntimeClock } from "./RuntimeClock";
import { TrailRuntime } from "./TrailRuntime";
import { runtimeDiagnostics } from "./RuntimeDiagnostics";
import { SimulationPipeline } from "./SimulationPipeline";

/** Single owner for live, non-React gameplay data. */
export class GameRuntime {
  readonly clock = new RuntimeClock();
  readonly boss = new BossRuntime();
  readonly projectiles = new ProjectileRuntime();
  readonly powerUps = new PowerUpRuntime();
  readonly powerUpSpawns = new PowerUpSpawnScheduler();
  readonly enemies = new EnemyRuntime();
  readonly particles = new ParticleRuntime();
  readonly trails = new TrailRuntime();
  readonly projectileSpawns = new ProjectileSpawnEvents();
  // Critical player-fire presentation has its own bounded bridge. Its capacity
  // matches simultaneous projectile admission, unlike optional weapon flashes.
  readonly playerProjectileBurstSpawns = new ProjectileSpawnEvents(MAX_RUNTIME_PROJECTILES);
  readonly balance: BalanceTelemetry = balanceTelemetry;
  readonly pipeline = new SimulationPipeline();
  resetVersion = 0;

  reset(): void {
    this.clock.reset();
    this.boss.reset();
    this.projectiles.reset();
    this.powerUps.reset();
    this.powerUpSpawns.reset();
    this.enemies.reset();
    this.particles.reset();
    this.trails.reset();
    this.projectileSpawns.reset();
    this.playerProjectileBurstSpawns.reset();
    this.resetVersion++;
  }

  diagnosticsSnapshot() {
    return {
      timing: runtimeDiagnostics.snapshot(),
      renderQuality: runtimeDiagnostics.qualitySnapshot(),
      slots: {
        projectiles: { active: this.projectiles.active, capacity: this.projectiles.capacity },
        powerUps: { active: this.powerUps.active },
        enemies: { active: this.enemies.active, capacity: this.enemies.capacity },
        particles: { active: this.particles.active, capacity: this.particles.capacity },
        trails: { active: this.trails.active, capacity: this.trails.capacity },
      },
      balance: this.balance.snapshot(),
      pipeline: this.pipeline.snapshot(),
    };
  }
}

export const gameRuntime = new GameRuntime();