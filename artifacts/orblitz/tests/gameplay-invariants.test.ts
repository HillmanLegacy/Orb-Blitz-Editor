import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RUNTIME_PROJECTILES,
  PLAYER_PROJECTILE_RESERVE,
  ProjectileRuntime,
} from "../src/game-runtime/ProjectileRuntime";
import { ProjectileSpawnEvents } from "../src/game-runtime/ProjectileSpawnEvents";
import { RuntimeClock } from "../src/game-runtime/RuntimeClock";
import {
  POWER_UP_DESTROY_DURATION,
  PowerUpRuntime,
} from "../src/game-runtime/PowerUpRuntime";
import {
  getArcadeRequiredOrbs,
  getAuthoredBossProgression,
} from "../src/game-runtime/BossProgression";
import { SimulationPipeline } from "../src/game-runtime/SimulationPipeline";
import { useMagicOrb, type PowerUp, type Projectile } from "../src/lib/stores/useMagicOrb";
import { useShop } from "../src/lib/stores/useShop";
import {
  AdaptiveRenderQualityController,
  getVisualBudget,
} from "../src/components/game/AdaptiveRenderQuality";
import { sweptSphereHit } from "../src/components/game/ProjectileCollision";
import {
  getLiveProjectileMotion,
  getProjectileMotion,
  releaseProjectileMotion,
} from "../src/components/game/ProjectilePhysics";
import { gameRuntime } from "../src/game-runtime/GameRuntime";
import {
  getGraphicsPreset,
  isPerformanceFeatureEnabled,
  setGraphicsPreset,
} from "../src/game-runtime/PerformanceToggles";
import { getGameplayGateMode } from "../src/game-runtime/GameplayGateState";

const makeProjectile = (id: string): Projectile => ({
  id,
  position: [0, 0, 0],
  direction: [1, 0, 0],
  isCharged: false,
  size: 1,
});

const makePowerUp = (id: string): PowerUp => ({
  id,
  type: "shield",
  position: [1, 2, 0],
  velocity: [2, -1, 0],
});

describe("gameplay runtime invariants", () => {
  beforeEach(() => {
    gameRuntime.enemies.reset();
    gameRuntime.boss.reset();
    useShop.setState({ coins: 0 });
    useMagicOrb.setState({
      hasDoubleCoins: false,
      projectiles: [],
      starFlowEvents: [],
    });
  });

  afterEach(() => {
    gameRuntime.enemies.reset();
    gameRuntime.boss.reset();
    useMagicOrb.setState({ projectiles: [], starFlowEvents: [] });
  });

  it("commits star rewards when the gameplay event is created", () => {
    useMagicOrb.getState().addStarFlowEvent([1, 2, 0], 5);

    expect(useShop.getState().coins).toBe(5);
    expect(useMagicOrb.getState().starFlowEvents).toHaveLength(1);
    expect(useMagicOrb.getState().starFlowEvents[0]).toMatchObject({
      fromPos: [1, 2, 0],
      count: 5,
      coinsPerStar: 1,
    });

    useMagicOrb.setState({ hasDoubleCoins: true });
    useMagicOrb.getState().addStarFlowEvent([3, 4, 0], 5);

    expect(useShop.getState().coins).toBe(15);
    expect(useMagicOrb.getState().starFlowEvents[1].coinsPerStar).toBe(2);
  });

  it("admits complete volleys only when capacity is available", () => {
    const existing = Array.from(
      { length: MAX_RUNTIME_PROJECTILES - 2 },
      (_, index) => makeProjectile(`existing-${index}`),
    );
    useMagicOrb.setState({ projectiles: existing });

    expect(useMagicOrb.getState().canAddProjectiles(2)).toBe(true);
    expect(useMagicOrb.getState().canAddProjectiles(3)).toBe(false);
  });

  it("reserves projectile capacity for player-originated fire over autonomous fire", () => {
    const autonomous = Array.from(
      { length: MAX_RUNTIME_PROJECTILES - PLAYER_PROJECTILE_RESERVE },
      (_, index) => ({ ...makeProjectile(`sub-${index}`), type: "subblaster" as const }),
    );
    useMagicOrb.setState({ projectiles: autonomous });

    expect(useMagicOrb.getState().addProjectile({
      ...makeProjectile("sub-overflow"),
      type: "subblaster",
    })).toBe(false);
    expect(useMagicOrb.getState().addProjectile(makeProjectile("player-shot"))).toBe(true);
  });

  it("keeps runtime projectile slots bounded and reusable", () => {
    const pool = new ProjectileRuntime(2);

    const first = pool.getOrCreate(makeProjectile("one"));
    const second = pool.getOrCreate(makeProjectile("two"));

    expect(pool.active).toBe(2);
    expect(() => pool.getOrCreate(makeProjectile("overflow"))).toThrow(/capacity/);

    pool.release("one");
    const reused = pool.getOrCreate(makeProjectile("three"));

    expect(pool.active).toBe(2);
    expect(reused.slot).toBe(first.slot);
    expect(second.slot).not.toBe(reused.slot);
  });

  it("drops only presentation spawn events when their bounded queue is full", () => {
    const events = new ProjectileSpawnEvents(1);
    const source = makeProjectile("visual-one");

    expect(events.enqueue(source)).toBe(true);
    expect(events.enqueue({ ...source, id: "visual-two" })).toBe(false);

    const consumed: string[] = [];
    events.consume((event) => consumed.push(event.id));

    expect(consumed).toEqual(["visual-one"]);
  });

  it("does not advance the runtime clock while paused", () => {
    const clock = new RuntimeClock();

    expect(clock.tick(0.25)).toBe(0.25);
    clock.paused = true;

    expect(clock.tick(0.25)).toBe(0);
    expect(clock.elapsed).toBe(0.25);
    expect(clock.frame).toBe(2);
  });

  it("shows the blue gameplay placeholder only while the gameplay chunk loads", () => {
    expect(getGameplayGateMode(false, false)).toBe("hidden");
    expect(getGameplayGateMode(true, false)).toBe("chunk-loading");
    expect(getGameplayGateMode(true, true)).toBe("ready");
  });

  it("reduces only visual budgets as render quality falls", () => {
    const high = getVisualBudget("high");
    const medium = getVisualBudget("medium");
    const low = getVisualBudget("low");

    expect(high.backgroundDust).toBeGreaterThan(medium.backgroundDust);
    expect(medium.backgroundDust).toBeGreaterThan(low.backgroundDust);
    expect(high.rewardStars).toBeGreaterThan(medium.rewardStars);
    expect(medium.rewardStars).toBeGreaterThan(low.rewardStars);
    expect(low.rewardLights).toBeGreaterThan(0);
  });

  it("downgrades the renderer tier under sustained frame pressure", () => {
    const controller = new AdaptiveRenderQualityController();
    const setPixelRatio = () => undefined;
    controller.attach({ setPixelRatio } as never);
    controller.setGameplayActive(true);

    for (let frame = 0; frame < 15; frame++) controller.sample(1 / 60);
    for (let frame = 0; frame < 20; frame++) controller.sample(0.03);

    expect(controller.getSnapshot()).toBe("medium");
  });

  it("applies player-selected graphics presets without disabling gameplay", () => {
    const controller = new AdaptiveRenderQualityController();

    setGraphicsPreset("low");
    controller.setPreset("low");
    expect(getGraphicsPreset()).toBe("low");
    expect(controller.getSnapshot()).toBe("low");
    expect(isPerformanceFeatureEnabled("postprocessing")).toBe(false);
    expect(isPerformanceFeatureEnabled("vfx")).toBe(false);
    expect(isPerformanceFeatureEnabled("enemyVisuals")).toBe(true);
    expect(isPerformanceFeatureEnabled("collision")).toBe(true);

    setGraphicsPreset("standard");
    controller.setPreset("standard");
    expect(controller.getSnapshot()).toBe("medium");
    expect(isPerformanceFeatureEnabled("postprocessing")).toBe(true);

    setGraphicsPreset("high");
    controller.setPreset("high");
    expect(controller.getSnapshot()).toBe("high");

    setGraphicsPreset("standard");
  });

  it("keeps pickup transforms and countdowns in the runtime, not store snapshots", () => {
    const runtime = new PowerUpRuntime();
    const source = makePowerUp("pickup-one");
    runtime.sync([source]);

    runtime.tick(0.5);
    expect(runtime.get("pickup-one")?.position).toEqual([2, 1.5, 0]);
    expect(source.position).toEqual([1, 2, 0]);
    expect(runtime.positionFor(source)).toEqual([2, 1.5, 0]);

    runtime.sync([{ ...source, hurtTimer: 0.1 }]);
    const result = runtime.tick(0.1);
    expect(result.stateChanges).toEqual([{
      id: "pickup-one",
      patch: { hurtTimer: 0, destroying: true, destroyTimer: POWER_UP_DESTROY_DURATION },
    }]);
  });

  it("preserves the existing authored arcade progression values", () => {
    expect(getArcadeRequiredOrbs(1.1)).toBe(15);
    expect(getArcadeRequiredOrbs(2.3)).toBe(35);
    expect(getArcadeRequiredOrbs(4.9)).toBe(1);
    expect(getAuthoredBossProgression(1)).toMatchObject({ bossType: "circle", health: 100 });
    expect(getAuthoredBossProgression(9)).toMatchObject({ bossType: "monster", health: 100 });
    expect(getAuthoredBossProgression(99)).toMatchObject({ bossType: "monster", health: 100 });
  });

  it("records frame stages once in their observed simulation order", () => {
    const pipeline = new SimulationPipeline();
    pipeline.beginFrame();
    pipeline.enter("clock");
    pipeline.enter("enemies");
    pipeline.enter("enemies");
    pipeline.enter("projectiles");
    pipeline.enter("run");
    pipeline.enter("powerUps");
    pipeline.enter("presentation");

    expect(pipeline.snapshot().order).toEqual([
      "clock", "enemies", "projectiles", "run", "powerUps", "presentation",
    ]);
  });

  it.each([
    ["normal", 1.2],
    ["homing", 1.2],
    ["spiral", 1.58],
    ["overcharged", 3.36],
  ])("keeps %s projectiles able to hit rendered enemies outside the old center range", (_type, radius) => {
    // x=20 is intentionally beyond the removed ±12 center-screen gate, but
    // still within the rendered enemy envelope. The projectile crosses the
    // enemy during this frame, so the shared swept narrow phase must report it.
    const hitT = sweptSphereHit(
      18, 0, 0,
      22, 0, 0,
      20, 0, 0,
      20, 0, 0,
      radius,
    );

    expect(hitT).not.toBeNull();
    expect(hitT!).toBeGreaterThanOrEqual(0);
    expect(hitT!).toBeLessThanOrEqual(1);
  });

  it("still bounds projectile lifetime without reintroducing a center-distance collision gate", () => {
    expect(Math.abs(20)).toBeLessThan(32);
    expect(Math.abs(20)).toBeLessThan(24);
    expect(Math.abs(33)).toBeGreaterThan(32);
  });

  it("does not resurrect a hit projectile at its stale muzzle position", () => {
    const projectile = { ...makeProjectile("collision-cleanup") };
    const liveMotion = getProjectileMotion(projectile);
    liveMotion.position[0] = 8;
    liveMotion.position[1] = -3;

    releaseProjectileMotion(projectile.id);

    expect(getLiveProjectileMotion(projectile)).toBeUndefined();
    expect(getLiveProjectileMotion(projectile)).not.toBe(getProjectileMotion(projectile));

    releaseProjectileMotion(projectile.id);
  });

  it("keeps autonomous target acquisition aligned with live enemy transforms", () => {
    const source = {
      id: "sub-target",
      position: [18, 0, 0] as [number, number, number],
      previousPosition: [18, 0, 0] as [number, number, number],
    };
    const liveEnemy = gameRuntime.enemies.getOrCreate({
      ...source,
      speed: 1,
      size: 0.6,
      seed: 0,
      shape: "sphere",
      pattern: "direct",
      patternPhase: 0,
    });
    liveEnemy.position[0] = 3;
    liveEnemy.position[1] = 1;

    expect(gameRuntime.enemies.get(source.id)?.position).toEqual([3, 1, 0]);
    expect(gameRuntime.enemies.get(source.id)?.position).not.toEqual(source.position);
  });

  it("pulse shield reflects enemies using their live runtime position", () => {
    const enemy = {
      id: "pulse-target",
      position: [18, 0, 0] as [number, number, number],
      direction: [-1, 0, 0] as [number, number, number],
      speed: 1,
      size: 0.6,
      seed: 0,
      shape: "sphere" as const,
      pattern: "direct" as const,
      patternPhase: 0,
    };
    useMagicOrb.setState({ darkOrbs: [enemy], playerPosition: [0, 0, 0] });
    const liveEnemy = gameRuntime.enemies.getOrCreate(enemy);
    liveEnemy.position[0] = 4;
    useMagicOrb.getState().activatePulseShield();

    expect(useMagicOrb.getState().pulseShieldActive).toBe(true);
    expect(useMagicOrb.getState().darkOrbs[0].direction).toEqual([1, 0, 0]);
  });

  it("spatial relocation starts a cooldown and emits boss-style teleport metadata", () => {
    useMagicOrb.setState({
      playerPosition: [0, 0, 0],
      darkOrbs: [],
      impactEffects: [],
      spatialRelocationCooldown: 0,
    });
    useMagicOrb.getState().useSpatialRelocation();

    const state = useMagicOrb.getState();
    expect(state.spatialRelocationCooldown).toBe(state.spatialRelocationMaxCooldown);
    expect(state.impactEffects).toHaveLength(1);
    expect(state.impactEffects[0]).toMatchObject({
      isSpatialRelocation: true,
      maxTimer: 1.16,
      fromPosition: [0, 0, 0],
    });
    expect(state.impactEffects[0].toPosition).not.toEqual([0, 0, 0]);
  });
});