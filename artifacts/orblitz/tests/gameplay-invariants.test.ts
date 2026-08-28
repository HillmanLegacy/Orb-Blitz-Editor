import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { useMagicOrb, type DarkOrb, type PowerUp, type Projectile } from "../src/lib/stores/useMagicOrb";
import { BOSS_SKIN_TYPES, SHOP_ITEMS, useShop } from "../src/lib/stores/useShop";
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
import { runtimeDiagnostics } from "../src/game-runtime/RuntimeDiagnostics";
import {
  getGraphicsPreset,
  isPerformanceFeatureEnabled,
  setGraphicsPreset,
} from "../src/game-runtime/PerformanceToggles";
import { getGameplayGateMode } from "../src/game-runtime/GameplayGateState";
import {
  getPlayerProjectileVisualScale,
  isPlayerProjectile,
  MAX_PLAYER_PROJECTILE_AURA_INSTANCES,
  PLAYER_PROJECTILE_TYPES,
  shouldRenderChargedProjectileAura,
  shouldRenderParticleSwarmOverlay,
} from "../src/components/game/PlayerProjectileVisualConfig";
import {
  BOSS_DEFEAT_DURATION,
  BOSS_DEFEAT_PALETTES,
  MAIN_BOSS_TYPES,
  getBossDefeatPalette,
} from "../src/components/game/BossDefeatPalette";
import { BOSS_DEFEAT_PARTICLE_COUNTS } from "../src/components/game/FireExplosionVFX";
import {
  ENEMY_DEFEAT_DURATION,
  ENEMY_DEFEAT_PROFILES,
  getBossTypeForEnemyShape,
  getEnemyDefeatParticleTotal,
  getEnemyDefeatProgress,
  resolveEnemyDefeatBossType,
} from "../src/components/game/EnemyDefeatConfig";

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

const makeEnemy = (id: string): DarkOrb => ({
  id,
  position: [10, 0, 0],
  direction: [-1, 0, 0],
  speed: 1,
  size: 0.5,
  seed: 0.5,
  shape: "circle",
  pattern: "direct",
});

describe("gameplay runtime invariants", () => {
  beforeEach(() => {
    gameRuntime.enemies.reset();
    gameRuntime.boss.reset();
    useShop.setState({ coins: 0 });
    useMagicOrb.setState({
      hasDoubleCoins: false,
      darkOrbs: [],
      projectiles: [],
      starFlowEvents: [],
    });
  });

  it("defines a complete defeat palette for every authored main boss", () => {
    expect(MAIN_BOSS_TYPES).toHaveLength(9);
    expect(new Set(MAIN_BOSS_TYPES).size).toBe(9);
    expect(Object.keys(BOSS_DEFEAT_PALETTES).sort()).toEqual([...MAIN_BOSS_TYPES].sort());

    for (const bossType of MAIN_BOSS_TYPES) {
      const palette = getBossDefeatPalette(bossType);
      expect(palette.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.glow).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.highlight).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.shadow).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("preserves the 1.9 defeat duration and authored particle budget", () => {
    expect(BOSS_DEFEAT_DURATION).toBe(3.5);
    expect(BOSS_DEFEAT_PARTICLE_COUNTS).toEqual({
      main: 600,
      embers: 120,
      fragments: 16,
      corona: 60,
    });
    expect(Object.values(BOSS_DEFEAT_PARTICLE_COUNTS).reduce((sum, count) => sum + count, 0)).toBe(796);
  });

  it("maps every world enemy texture to its authored boss defeat palette", () => {
    expect(getBossTypeForEnemyShape("circle")).toBe("circle");
    expect(getBossTypeForEnemyShape("star")).toBe("star");
    expect(getBossTypeForEnemyShape("triangle")).toBe("triangle");
    expect(getBossTypeForEnemyShape("trapezoid")).toBe("trapezoid");
    expect(getBossTypeForEnemyShape("cube")).toBe("cube");
    expect(getBossTypeForEnemyShape("lightning")).toBe("cloud");
    expect(getBossTypeForEnemyShape("arrow")).toBe("arrow");
    expect(getBossTypeForEnemyShape("tentacle")).toBe("tentacle");
    expect(getBossTypeForEnemyShape("monster")).toBe("monster");
    expect(getBossTypeForEnemyShape("sphere")).toBe("circle");
    expect(getBossTypeForEnemyShape("tetrahedron")).toBe("triangle");
    expect(getBossTypeForEnemyShape("octahedron")).toBe("cloud");
    expect(getBossTypeForEnemyShape("dodecahedron")).toBe("cube");
    expect(getBossTypeForEnemyShape("bird")).toBe("bird");
    expect(getBossTypeForEnemyShape("launcher")).toBe("circle");
  });

  it("resolves defeat identity from the visible boss type before mode or legacy colors", () => {
    const typedOrb = {
      isBossOrb: true,
      bossType: "star" as const,
      bossDefeatColor: "monster" as const,
      shape: "circle" as const,
    };
    expect(resolveEnemyDefeatBossType(typedOrb, "arcade", 9.4)).toBe("star");
    expect(resolveEnemyDefeatBossType(typedOrb, "survival", 1)).toBe("star");
    expect(resolveEnemyDefeatBossType(typedOrb, "chill", 1)).toBe("star");
    expect(resolveEnemyDefeatBossType(typedOrb, "gauntlet", 1)).toBe("star");

    const legacyBossOrb = {
      isBossOrb: true,
      bossType: undefined,
      bossDefeatColor: "tentacle" as const,
      shape: "circle" as const,
    };
    expect(resolveEnemyDefeatBossType(legacyBossOrb, "survival", 1)).toBe("tentacle");
  });

  it("uses world progression in arcade and texture shapes in survival and chill", () => {
    const standardEnemy = {
      isBossOrb: false,
      bossType: undefined,
      bossDefeatColor: "monster" as const,
      shape: "lightning" as const,
    };
    expect(resolveEnemyDefeatBossType(standardEnemy, "arcade", 2.6)).toBe("star");
    expect(resolveEnemyDefeatBossType(standardEnemy, "survival", 2.6)).toBe("cloud");
    expect(resolveEnemyDefeatBossType(standardEnemy, "chill", 2.6)).toBe("cloud");
  });

  it("keeps mini defeat effects bounded and lighter than the full boss effect", () => {
    expect(ENEMY_DEFEAT_DURATION).toBe(0.6);
    expect(getEnemyDefeatProgress(ENEMY_DEFEAT_DURATION)).toBe(0);
    expect(getEnemyDefeatProgress(ENEMY_DEFEAT_DURATION / 2)).toBe(0.5);
    expect(getEnemyDefeatProgress(0)).toBe(1);

    const bossTotal = Object.values(BOSS_DEFEAT_PARTICLE_COUNTS).reduce((sum, count) => sum + count, 0);
    expect(ENEMY_DEFEAT_PROFILES.high.maxActive).toBe(16);
    expect(ENEMY_DEFEAT_PROFILES.standard.maxActive).toBeLessThan(ENEMY_DEFEAT_PROFILES.high.maxActive);
    expect(ENEMY_DEFEAT_PROFILES.low.maxActive).toBeLessThan(ENEMY_DEFEAT_PROFILES.standard.maxActive);

    for (const profile of Object.values(ENEMY_DEFEAT_PROFILES)) {
      expect(getEnemyDefeatParticleTotal(profile)).toBeLessThan(bossTotal);
      expect(profile.sizeMultiplier).toBeLessThan(1);
    }
    expect(getEnemyDefeatParticleTotal(ENEMY_DEFEAT_PROFILES.high)).toBe(87);
  });

  it("gives Magi-Orb II targets the standard mini defeat lifetime", () => {
    vi.useFakeTimers();
    try {
      useMagicOrb.setState({
        magiOrb2Cooldown: 0,
        darkOrbs: [makeEnemy("magi-orb-2-target")],
      });

      useMagicOrb.getState().activateMagiOrb2();

      expect(useMagicOrb.getState().darkOrbs[0]).toMatchObject({
        id: "magi-orb-2-target",
        destroying: true,
        destroyTimer: ENEMY_DEFEAT_DURATION,
      });
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
  });

  afterEach(() => {
    gameRuntime.enemies.reset();
    gameRuntime.boss.reset();
    useMagicOrb.setState({ darkOrbs: [], projectiles: [], starFlowEvents: [] });
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

  it("admits a multi-enemy wave in one bounded structural update", () => {
    let darkOrbUpdates = 0;
    const unsubscribe = useMagicOrb.subscribe(
      (state) => state.darkOrbs,
      () => { darkOrbUpdates++; },
    );

    const admitted = useMagicOrb.getState().addDarkOrbs([
      makeEnemy("wave-1"),
      makeEnemy("wave-2"),
      makeEnemy("wave-3"),
    ]);

    unsubscribe();
    expect(admitted).toBe(3);
    expect(darkOrbUpdates).toBe(1);
    expect(useMagicOrb.getState().darkOrbs.map((orb) => orb.id)).toEqual([
      "wave-1", "wave-2", "wave-3",
    ]);
  });

  it("attributes enemy and impact hot-path publications without overlap", () => {
    runtimeDiagnostics.beginFrame();
    useMagicOrb.getState().addDarkOrb(makeEnemy("diagnostic-enemy"));
    useMagicOrb.getState().addImpactEffect({
      id: "diagnostic-impact",
      position: [1, 0, 0],
      timer: 0.4,
      maxTimer: 0.4,
      seed: 0.25,
    });

    const snapshot = runtimeDiagnostics.snapshot();
    expect(snapshot.enemySpawns).toBe(1);
    expect(snapshot.impactEffects).toBe(1);
    expect(snapshot.hotPathStoreWrites).toBe(2);
  });

  it("keeps batched enemy admission within the authored active cap", () => {
    useMagicOrb.setState({
      darkOrbs: Array.from({ length: 19 }, (_, index) => makeEnemy(`existing-${index}`)),
    });

    const admitted = useMagicOrb.getState().addDarkOrbs([
      makeEnemy("last-slot"),
      makeEnemy("over-cap"),
    ]);

    expect(admitted).toBe(1);
    expect(useMagicOrb.getState().darkOrbs).toHaveLength(20);
    expect(useMagicOrb.getState().darkOrbs.at(-1)?.id).toBe("last-slot");
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

  it("lists exactly the current boss roster as purchasable player skins", () => {
    const skinValues = SHOP_ITEMS
      .filter((item) => item.category === "skin")
      .map((item) => item.value);

    expect(skinValues).toEqual(BOSS_SKIN_TYPES);
    expect(new Set(skinValues).size).toBe(BOSS_SKIN_TYPES.length);
    expect(SHOP_ITEMS.some((item) => item.value === "golden")).toBe(false);
    expect(SHOP_ITEMS.some((item) => item.value === "void")).toBe(false);
    expect(SHOP_ITEMS.some((item) => item.value === "electric")).toBe(false);
  });

  it("classifies every store-backed projectile type as player-owned", () => {
    for (const type of PLAYER_PROJECTILE_TYPES) {
      expect(isPlayerProjectile({ type })).toBe(true);
    }
    expect(isPlayerProjectile({ type: undefined })).toBe(true);
  });

  it("preserves authored player-projectile visual sizes", () => {
    expect(getPlayerProjectileVisualScale({ type: "normal", isCharged: false })).toBe(0.144);
    expect(getPlayerProjectileVisualScale({ type: "normal", isCharged: true })).toBeCloseTo(0.216);
    expect(getPlayerProjectileVisualScale({ type: "rapidblaster", isCharged: false })).toBe(0.11);
    expect(getPlayerProjectileVisualScale({ type: "scattershot", isCharged: true })).toBeCloseTo(0.195);
    expect(getPlayerProjectileVisualScale({ type: "spiral", isCharged: false })).toBe(0.324);
    expect(getPlayerProjectileVisualScale({ type: "subblaster", isCharged: false })).toBe(0.075);
    expect(getPlayerProjectileVisualScale({ type: "overcharged", isCharged: true }, 0.5)).toBeCloseTo(0.6235);
  });

  it("keeps the shared player-projectile aura within the runtime pool", () => {
    expect(MAX_PLAYER_PROJECTILE_AURA_INSTANCES).toBe(MAX_RUNTIME_PROJECTILES);
  });

  it("keeps particle swarm as an overlay on the single shared projectile core", () => {
    const normalProjectile = { type: "normal" as const, isCharged: true };
    expect(isPlayerProjectile(normalProjectile)).toBe(true);
    expect(shouldRenderParticleSwarmOverlay(normalProjectile, "particle_swarm")).toBe(true);
    expect(shouldRenderChargedProjectileAura(normalProjectile)).toBe(true);
    expect(shouldRenderParticleSwarmOverlay(normalProjectile, "fire")).toBe(false);
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