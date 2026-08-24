import { BossRuntime } from "./BossRuntime";
import { EnemyRuntime } from "./EnemyRuntime";
import { ParticleRuntime } from "./ParticleRuntime";
import { ProjectileSpawnEvents } from "./ProjectileSpawnEvents";
import { ProjectileRuntime } from "./ProjectileRuntime";
import { RuntimeClock } from "./RuntimeClock";
import { TrailRuntime } from "./TrailRuntime";
import { runtimeDiagnostics } from "./RuntimeDiagnostics";

/** Single owner for live, non-React gameplay data. */
export class GameRuntime {
  readonly clock = new RuntimeClock();
  readonly boss = new BossRuntime();
  readonly projectiles = new ProjectileRuntime();
  readonly enemies = new EnemyRuntime();
  readonly particles = new ParticleRuntime();
  readonly trails = new TrailRuntime();
  readonly projectileSpawns = new ProjectileSpawnEvents();

  reset(): void {
    this.clock.reset();
    this.boss.reset();
    this.projectiles.reset();
    this.enemies.reset();
    this.particles.reset();
    this.trails.reset();
    this.projectileSpawns.reset();
  }

  diagnosticsSnapshot() {
    return {
      timing: runtimeDiagnostics.snapshot(),
      renderQuality: runtimeDiagnostics.qualitySnapshot(),
      slots: {
        projectiles: { active: this.projectiles.active, capacity: this.projectiles.capacity },
        enemies: { active: this.enemies.active, capacity: this.enemies.capacity },
        particles: { active: this.particles.active, capacity: this.particles.capacity },
        trails: { active: this.trails.active, capacity: this.trails.capacity },
      },
    };
  }
}

export const gameRuntime = new GameRuntime();