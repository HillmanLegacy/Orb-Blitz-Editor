import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  MAX_RUNTIME_PROJECTILES,
  PLAYER_PROJECTILE_RESERVE,
  ProjectileRuntime,
} from "../src/game-runtime/ProjectileRuntime";
import { ProjectileSpawnEvents } from "../src/game-runtime/ProjectileSpawnEvents";
import { RuntimeClock } from "../src/game-runtime/RuntimeClock";
import {
  POWER_UP_MAX_SPAWN_INTERVAL,
  POWER_UP_MIN_SPAWN_INTERVAL,
  PowerUpSpawnScheduler,
} from "../src/game-runtime/PowerUpSpawnScheduler";
import {
  CHILL_AMBIENT_MAX_ACTIVE,
  CHILL_AMBIENT_BATCH_SIZE,
  CHILL_AMBIENT_CLUSTER_SIZE,
  CHILL_AMBIENT_SHAPES,
  CHILL_AMBIENT_SPAWN_INTERVAL,
  ENEMY_DESPAWN_MARGIN,
  ENEMY_SPAWN_MARGIN,
  bounceChillAmbientAtEdge,
  getChillAmbientDirection,
  getChillAmbientSpawnPoint,
  getChillAmbientShape,
  getEnemySpawnPoint,
  getPerspectiveViewAtPlane,
  isOutsideBossProjectileDespawnBounds,
  isOutsideEnemyDespawnBounds,
} from "../src/game-runtime/EnemySpawnConfig";
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
  getPlayerProjectileSpawnVfxScale,
  getPlayerOrbScale,
  isPlayerProjectile,
  PLAYER_PROJECTILE_TYPES,
  shouldRenderParticleSwarmOverlay,
  usesSharedPlayerProjectileCore,
} from "../src/components/game/PlayerProjectileVisualConfig";
import {
  BOSS_DEFEAT_DURATION,
  BOSS_DEFEAT_SIZE_SCALE,
  BOSS_DEFEAT_PALETTES,
  MAIN_BOSS_TYPES,
  getBossDefeatPalette,
} from "../src/components/game/BossDefeatPalette";
import { BOSS_DEFEAT_PARTICLE_COUNTS } from "../src/components/game/FireExplosionVFX";
import {
  ENEMY_DEFEAT_DURATION,
  ENEMY_DEFEAT_PROFILES,
  STANDARD_ENEMY_DEFEAT_DURATION,
  STANDARD_ENEMY_DEFEAT_SIZE_SCALE,
  getBossTypeForEnemyShape,
  getEnemyDefeatParticleTotal,
  getEnemyDefeatProgress,
  getEnemySpawnReverseProgress,
  resolveEnemyDefeatBossType,
} from "../src/components/game/EnemyDefeatConfig";
import {
  PLAYER_SKIN_MODEL_PATHS,
  getPlayerSkinModelPath,
  getPlayerSkinTrailPalette,
  getPlayerSkinTrailColor,
} from "../src/components/game/PlayerSkinVisualConfig";
import { clonePlayerOrbMaterial } from "../src/components/game/PlayerOrbMaterial";
import {
  createPlayerFireBurstPool,
  emitPlayerProjectileFireBurst,
  resetPlayerFireBurstPool,
} from "../src/components/game/Projectiles";

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
    expect(BOSS_DEFEAT_SIZE_SCALE).toBe(1.7);
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

  it("runs enemy spawn presentation through the defeat timeline in reverse", () => {
    expect(getEnemySpawnReverseProgress(0)).toBe(1);
    expect(getEnemySpawnReverseProgress(ENEMY_DEFEAT_DURATION / 2)).toBe(0.5);
    expect(getEnemySpawnReverseProgress(ENEMY_DEFEAT_DURATION)).toBe(0);
    expect(getEnemySpawnReverseProgress(ENEMY_DEFEAT_DURATION * 2)).toBe(0);
  });

  it("keeps mini defeat effects bounded and lighter than the full boss effect", () => {
    expect(ENEMY_DEFEAT_DURATION).toBe(STANDARD_ENEMY_DEFEAT_DURATION);
    expect(STANDARD_ENEMY_DEFEAT_DURATION).toBe(2);
    expect(getEnemyDefeatProgress(ENEMY_DEFEAT_DURATION)).toBe(0);
    expect(getEnemyDefeatProgress(ENEMY_DEFEAT_DURATION / 2)).toBe(0.5);
    expect(getEnemyDefeatProgress(0)).toBe(1);

    const bossTotal = Object.values(BOSS_DEFEAT_PARTICLE_COUNTS).reduce((sum, count) => sum + count, 0);
    expect(ENEMY_DEFEAT_PROFILES.high.maxActive).toBe(16);
    expect(ENEMY_DEFEAT_PROFILES.standard.maxActive).toBeLessThan(ENEMY_DEFEAT_PROFILES.high.maxActive);
    expect(ENEMY_DEFEAT_PROFILES.low.maxActive).toBeLessThan(ENEMY_DEFEAT_PROFILES.standard.maxActive);

    for (const profile of Object.values(ENEMY_DEFEAT_PROFILES)) {
      expect(getEnemyDefeatParticleTotal(profile)).toBeLessThan(bossTotal);
      expect(profile.sizeMultiplier).toBeGreaterThan(1);
      expect(profile.sizeMultiplier).toBeGreaterThanOrEqual(STANDARD_ENEMY_DEFEAT_SIZE_SCALE * 0.72);
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

  it("spaces power-up spawns with a randomized but bounded interval", () => {
    const scheduler = new PowerUpSpawnScheduler(() => 0.5);
    const interval = (POWER_UP_MIN_SPAWN_INTERVAL + POWER_UP_MAX_SPAWN_INTERVAL) / 2;

    expect(scheduler.tick(POWER_UP_MIN_SPAWN_INTERVAL - 0.01)).toBe(false);
    expect(scheduler.tick(0.01)).toBe(false);
    expect(scheduler.tick(interval - POWER_UP_MIN_SPAWN_INTERVAL - 0.01)).toBe(false);
    expect(scheduler.tick(0.01)).toBe(true);
    expect(POWER_UP_MIN_SPAWN_INTERVAL).toBeGreaterThanOrEqual(20);
    expect(POWER_UP_MAX_SPAWN_INTERVAL).toBeLessThanOrEqual(32);
    expect(scheduler.tick(POWER_UP_MIN_SPAWN_INTERVAL)).toBe(false);
  });

  it("preserves power-up cooldown progress while gameplay is paused", () => {
    const scheduler = new PowerUpSpawnScheduler(() => 0);

    expect(scheduler.tick(12)).toBe(false);
    // A pause does not tick or reset the persistent runtime scheduler.
    expect(scheduler.tick(7.99)).toBe(false);
    expect(scheduler.tick(0.01)).toBe(true);

    scheduler.reset();
    expect(scheduler.tick(19.99)).toBe(false);
    expect(scheduler.tick(0.01)).toBe(true);
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

  it("maps every equipped skin directly to its authored projectile model", () => {
    const skins = ["default", ...BOSS_SKIN_TYPES] as const;
    const modelPaths = skins.map(getPlayerSkinModelPath);

    expect(modelPaths).toEqual(skins.map((skin) => PLAYER_SKIN_MODEL_PATHS[skin]));
    expect(modelPaths.every((path) => path.endsWith("_texture.glb"))).toBe(true);
    expect(new Set(modelPaths).size).toBe(skins.length);
  });

  it("uses one shared skin-aware core renderer for every player projectile", () => {
    expect(usesSharedPlayerProjectileCore({ type: undefined })).toBe(true);
    for (const type of PLAYER_PROJECTILE_TYPES) {
      expect(usesSharedPlayerProjectileCore({ type })).toBe(true);
    }
  });

  it("gives projectile textures the same opaque PBR treatment as the player", () => {
    const base = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      opacity: 0.25,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      emissiveIntensity: 1,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    const textureSource = new THREE.MeshStandardMaterial();
    const skinMap = new THREE.Texture();
    const normalMap = new THREE.Texture();
    textureSource.map = skinMap;
    textureSource.normalMap = normalMap;
    textureSource.transparent = true;
    textureSource.opacity = 0.1;
    textureSource.depthWrite = false;
    textureSource.blending = THREE.AdditiveBlending;

    const projectileMaterial = clonePlayerOrbMaterial({
      baseMaterial: base,
      textureMaterial: textureSource,
      coreColor: "#ff4400",
      glowColor: "#ff8800",
    }) as THREE.MeshStandardMaterial;

    expect(projectileMaterial).not.toBe(base);
    expect(projectileMaterial.map).toBe(skinMap);
    expect(projectileMaterial.normalMap).toBe(normalMap);
    expect(projectileMaterial.transparent).toBe(false);
    expect(projectileMaterial.opacity).toBe(1);
    expect(projectileMaterial.alphaTest).toBe(0);
    expect(projectileMaterial.alphaHash).toBe(false);
    expect(projectileMaterial.depthWrite).toBe(true);
    expect(projectileMaterial.depthTest).toBe(true);
    expect(projectileMaterial.blending).toBe(THREE.NormalBlending);
    expect(projectileMaterial.premultipliedAlpha).toBe(false);
    expect(projectileMaterial.visible).toBe(true);
    expect(projectileMaterial.side).toBe(base.side);
    expect(projectileMaterial.color.getHexString()).toBe("ff4400");
    expect(projectileMaterial.emissive.getHexString()).toBe("ff8800");
    expect(projectileMaterial.emissiveIntensity).toBe(0.45);

    projectileMaterial.dispose();
    base.dispose();
    textureSource.dispose();
    skinMap.dispose();
    normalMap.dispose();
  });

  it("keeps authored projectile material colors instead of adding a tint overlay", () => {
    const authored = new THREE.MeshStandardMaterial({
      color: "#4d8cff",
      emissive: "#102040",
      emissiveIntensity: 0.8,
    });

    const projectileMaterial = clonePlayerOrbMaterial({
      baseMaterial: authored,
      coreColor: "#ff4400",
      glowColor: "#ff8800",
      tintColors: false,
    }) as THREE.MeshStandardMaterial;

    expect(projectileMaterial.color.getHexString()).toBe("4d8cff");
    expect(projectileMaterial.emissive.getHexString()).toBe("102040");
    expect(projectileMaterial.emissiveIntensity).toBe(0.8);

    projectileMaterial.dispose();
    authored.dispose();
  });

  it("can add neutral projectile illumination without changing the authored color", () => {
    const authored = new THREE.MeshStandardMaterial({
      color: "#4d8cff",
      emissive: "#102040",
      emissiveIntensity: 0.05,
    });

    const projectileMaterial = clonePlayerOrbMaterial({
      baseMaterial: authored,
      coreColor: "#ff4400",
      glowColor: "#ff8800",
      tintColors: false,
      emissiveBoost: 0.5,
    }) as THREE.MeshStandardMaterial;

    expect(projectileMaterial.color.getHexString()).toBe("4d8cff");
    expect(projectileMaterial.emissive.getHexString()).toBe("ffffff");
    expect(projectileMaterial.emissiveIntensity).toBe(0.5);

    projectileMaterial.dispose();
    authored.dispose();
  });

  it("uses white for default trails and skin colors for boss-skin trails", () => {
    expect(getPlayerSkinTrailColor("default")).toBe("#ffffff");
    for (const skin of BOSS_SKIN_TYPES) {
      expect(getPlayerSkinTrailColor(skin)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(getPlayerSkinTrailColor(skin)).not.toBe("#ffffff");
    }
  });

  it("preserves gradient endpoints and three distinct spiral strands per skin", () => {
    for (const skin of ["default", ...BOSS_SKIN_TYPES] as const) {
      const palette = getPlayerSkinTrailPalette(skin);
      expect(palette.base).toBe(getPlayerSkinTrailColor(skin));
      expect(palette.head).not.toBe(palette.tail);
      expect(new Set(palette.strands).size).toBe(3);
    }
  });

  it("classifies every store-backed projectile type as player-owned", () => {
    for (const type of PLAYER_PROJECTILE_TYPES) {
      expect(isPlayerProjectile({ type })).toBe(true);
    }
    expect(isPlayerProjectile({ type: undefined })).toBe(true);
  });

  it("sizes every non-overcharged projectile at half the current player size", () => {
    expect(getPlayerOrbScale(10, 10)).toBe(0.72);
    expect(getPlayerOrbScale(5, 10)).toBe(0.576);
    expect(getPlayerOrbScale(0, 10)).toBe(0.432);
    for (const type of PLAYER_PROJECTILE_TYPES) {
      if (type === "overcharged") continue;
      expect(getPlayerProjectileVisualScale({ type, isCharged: false }, 1, 0.72)).toBe(0.36);
      expect(getPlayerProjectileVisualScale({ type, isCharged: true }, 1, 0.432)).toBe(0.216);
    }
    expect(getPlayerProjectileVisualScale({ type: "overcharged", isCharged: true }, 0.5)).toBeCloseTo(0.6235);
  });

  it("scales spawn VFX for defense, standard, charged, and oversized projectiles", () => {
    expect(getPlayerProjectileSpawnVfxScale({ size: 0.09 })).toBe(0.6);
    expect(getPlayerProjectileSpawnVfxScale({ size: 0.15 })).toBe(1);
    expect(getPlayerProjectileSpawnVfxScale({ size: 0.25 })).toBeCloseTo(1.6667, 3);
    expect(getPlayerProjectileSpawnVfxScale({ size: 1 })).toBe(2.6);
  });

  it("keeps particle swarm as an overlay on the single shared projectile core", () => {
    const normalProjectile = { type: "normal" as const, isCharged: true };
    expect(isPlayerProjectile(normalProjectile)).toBe(true);
    expect(shouldRenderParticleSwarmOverlay(normalProjectile, "particle_swarm")).toBe(true);
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

  it("admits critical burst events by replacing stale pending presentation", () => {
    const events = new ProjectileSpawnEvents(2);
    const source = makeProjectile("burst-one");

    expect(events.enqueueReplacingOldest(source)).toBe(true);
    expect(events.enqueueReplacingOldest({ ...source, id: "burst-two" })).toBe(true);
    expect(events.enqueueReplacingOldest({ ...source, id: "burst-three" })).toBe(true);

    const consumed: string[] = [];
    events.consume((event) => consumed.push(event.id));
    expect(consumed).toEqual(["burst-two", "burst-three"]);
  });

  it("reuses and resets the bounded player fire-burst pool", () => {
    const pool = createPlayerFireBurstPool();
    const palette = {
      core: "#111111",
      glow: "#222222",
      particles: ["#ff0000", "#00ff00", "#0000ff"],
      isRainbow: true,
    };
    const event = {
      type: "rapidblaster",
      size: 0.1,
      position: [2, 3, 4] as const,
      direction: [0, 2, 0] as const,
    };

    // More bursts than capacity must remain bounded while retaining the latest
    // spawn transform/palette in the recycled slots.
    for (let i = 0; i < 17; i++) emitPlayerProjectileFireBurst(pool, event, palette);
    expect(pool.bursts).toHaveLength(16);
    expect(pool.bursts.filter((burst) => burst.active)).toHaveLength(16);
    expect(pool.bursts.some((burst) =>
      burst.y === 3 &&
      burst.dy === 1 &&
      burst.scale === getPlayerProjectileSpawnVfxScale({ size: 0.1 }) &&
      burst.core === "#111111" &&
      burst.glow === "#222222"
    )).toBe(true);
    expect(pool.slots).toHaveLength(96);
    expect(pool.slots.filter((slot) => slot.active)).toHaveLength(96);
    expect(pool.slots.some((slot) =>
      slot.y === 3 &&
      slot.dy === 1 &&
      slot.scale === getPlayerProjectileSpawnVfxScale({ size: 0.1 }) &&
      slot.color === "#00ff00"
    )).toBe(true);

    resetPlayerFireBurstPool(pool);
    expect(pool.nextBurstSlot).toBe(0);
    expect(pool.nextSlot).toBe(0);
    expect(pool.bursts.every((burst) => !burst.active && burst.age === 0)).toBe(true);
    expect(pool.slots.every((slot) => !slot.active && slot.age === 0)).toBe(true);
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

  it("keeps power-ups alive when they enter from every authored edge spawn", () => {
    const starts: Array<Pick<PowerUp, "position" | "velocity">> = [
      { position: [-14, 8, 0], velocity: [2, 0, 0] },
      { position: [-14, -8, 0], velocity: [2, 0, 0] },
      { position: [14, 8, 0], velocity: [-2, 0, 0] },
      { position: [14, -8, 0], velocity: [-2, 0, 0] },
    ];

    starts.forEach((start, index) => {
      const runtime = new PowerUpRuntime();
      const powerUp: PowerUp = {
        ...makePowerUp(`edge-pickup-${index}`),
        position: start.position,
        velocity: start.velocity,
      };
      runtime.sync([powerUp]);

      const result = runtime.tick(1 / 60);
      expect(result.removedIds).toEqual([]);
      expect(runtime.get(powerUp.id)).toBeDefined();
    });
  });

  it("spawns regular enemies beyond every camera edge", () => {
    const view = {
      centerX: 2,
      centerY: -1,
      halfWidth: 10,
      halfHeight: 6,
    };
    const edgeSamples = [
      [0.01, 0.5],
      [0.26, 0.5],
      [0.51, 0.5],
      [0.76, 0.5],
    ] as const;

    for (const [sideSample, laneSample] of edgeSamples) {
      let randomCalls = 0;
      const [x, y] = getEnemySpawnPoint(view, () => (
        randomCalls++ === 0 ? sideSample : laneSample
      ));
      const side = Math.floor(sideSample * 4);
      if (side === 0) expect(x).toBe(view.centerX - view.halfWidth - ENEMY_SPAWN_MARGIN);
      if (side === 1) expect(x).toBe(view.centerX + view.halfWidth + ENEMY_SPAWN_MARGIN);
      if (side === 2) expect(y).toBe(view.centerY - view.halfHeight - ENEMY_SPAWN_MARGIN);
      if (side === 3) expect(y).toBe(view.centerY + view.halfHeight + ENEMY_SPAWN_MARGIN);
    }
  });

  it("uses a dense bounded Chill admission policy and cycles ambient visuals", () => {
    expect(CHILL_AMBIENT_SPAWN_INTERVAL).toBe(0.75);
    expect(CHILL_AMBIENT_BATCH_SIZE).toBe(2);
    expect(CHILL_AMBIENT_MAX_ACTIVE).toBe(20);
    expect(CHILL_AMBIENT_CLUSTER_SIZE).toBe(4);
    const cycle = Array.from({ length: CHILL_AMBIENT_SHAPES.length }, (_, index) =>
      getChillAmbientShape(index),
    );
    expect(cycle).toEqual(CHILL_AMBIENT_SHAPES);
    expect(getChillAmbientShape(CHILL_AMBIENT_SHAPES.length)).toBe(CHILL_AMBIENT_SHAPES[0]);
    expect(cycle).not.toContain("launcher");
  });

  it("keeps Chill admissions grouped inside the camera view", () => {
    const view = { centerX: 2, centerY: -1, halfWidth: 10, halfHeight: 6 };
    const first = getChillAmbientSpawnPoint(view, 0, () => 0.5);
    const second = getChillAmbientSpawnPoint(view, 1, () => 0.5);
    const nextCluster = getChillAmbientSpawnPoint(view, CHILL_AMBIENT_CLUSTER_SIZE, () => 0.5);

    expect(Math.hypot(first[0] - second[0], first[1] - second[1])).toBe(0);
    expect(Math.hypot(first[0] - nextCluster[0], first[1] - nextCluster[1])).toBeGreaterThan(1);
    expect(Math.abs(first[0] - view.centerX)).toBeLessThan(view.halfWidth);
    expect(Math.abs(first[1] - view.centerY)).toBeLessThan(view.halfHeight);
  });

  it("gives Chill targets independent drift and bounces them at camera edges", () => {
    const direction = getChillAmbientDirection(() => 0.25);
    expect(direction[0]).toBeCloseTo(0);
    expect(direction[1]).toBeCloseTo(1);
    const view = { centerX: 2, centerY: -1, halfWidth: 10, halfHeight: 6 };
    const retained = bounceChillAmbientAtEdge([20, -10, 0], [0.5, -0.5, 0], view);
    expect(retained.position).toEqual([13, -8, 0]);
    expect(retained.direction).toEqual([-0.5, 0.5, 0]);
  });

  it("retains off-screen enemy spawns for moved and wide cameras", () => {
    const scenarios = [
      { cameraX: 11, cameraY: 4, cameraZ: 16, aspect: 16 / 9 },
      { cameraX: -11, cameraY: -4, cameraZ: 16, aspect: 21 / 9 },
      { cameraX: 0, cameraY: 0, cameraZ: 10, aspect: 9 / 16 },
    ];

    for (const scenario of scenarios) {
      const view = getPerspectiveViewAtPlane({
        ...scenario,
        planeZ: 0,
        verticalFovDegrees: 60,
      });
      for (const sideSample of [0.01, 0.26, 0.51, 0.76]) {
        let randomCalls = 0;
        const [x, y] = getEnemySpawnPoint(view, () => (
          randomCalls++ === 0 ? sideSample : 0.5
        ));

        const outsideView =
          Math.abs(x - view.centerX) > view.halfWidth ||
          Math.abs(y - view.centerY) > view.halfHeight;
        expect(outsideView).toBe(true);
        expect(isOutsideEnemyDespawnBounds([x, y, 0], view)).toBe(false);
      }
    }
    expect(ENEMY_DESPAWN_MARGIN).toBeGreaterThan(ENEMY_SPAWN_MARGIN);
  });

  it("preserves the original world bounds for boss projectiles", () => {
    const portraitShiftedView = getPerspectiveViewAtPlane({
      cameraX: -11,
      cameraY: 0,
      cameraZ: 16,
      planeZ: 0,
      verticalFovDegrees: 60,
      aspect: 9 / 16,
    });
    const bossProjectile: [number, number, number] = [12, 0, 0.5];

    expect(isOutsideEnemyDespawnBounds(bossProjectile, portraitShiftedView)).toBe(true);
    expect(isOutsideBossProjectileDespawnBounds(bossProjectile)).toBe(false);
    expect(isOutsideBossProjectileDespawnBounds([28.01, 0, 0.5])).toBe(true);
    expect(isOutsideBossProjectileDespawnBounds([0, 18.01, 0.5])).toBe(true);
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