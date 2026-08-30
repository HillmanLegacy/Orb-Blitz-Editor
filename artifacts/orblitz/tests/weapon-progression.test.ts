import { afterEach, describe, expect, it } from "vitest";
import {
  PROGRESSION_WEAPONS,
  applyWeaponXp,
  createInitialWeaponProgression,
  getWeaponConfig,
  getWeaponLevelFromXp,
  getWeaponProgress,
  normalizeWeaponProgression,
} from "../src/game-runtime/WeaponProgression";
import { useMagicOrb } from "../src/lib/stores/useMagicOrb";
import { useShop } from "../src/lib/stores/useShop";

describe("weapon progression", () => {
  const originalShopState = useShop.getState();
  const originalMagicOrbState = useMagicOrb.getState();

  afterEach(() => {
    useShop.setState({
      equippedWeapon: originalShopState.equippedWeapon,
      weaponProgression: originalShopState.weaponProgression,
    });
    useMagicOrb.setState({
      weaponUsed: originalMagicOrbState.weaponUsed,
      weaponXpAwarded: originalMagicOrbState.weaponXpAwarded,
      lastWeaponProgression: originalMagicOrbState.lastWeaponProgression,
      rapidOverheat: originalMagicOrbState.rapidOverheat,
      rapidOverheatPenaltyTimer: originalMagicOrbState.rapidOverheatPenaltyTimer,
      rapidOverheatActive: originalMagicOrbState.rapidOverheatActive,
      rapidBlasterLastShotTime: originalMagicOrbState.rapidBlasterLastShotTime,
      gameMode: originalMagicOrbState.gameMode,
      gameTime: originalMagicOrbState.gameTime,
      runStats: originalMagicOrbState.runStats,
    });
  });

  it("creates all six weapons at Lv1 and safely migrates malformed saves", () => {
    const initial = createInitialWeaponProgression();
    expect(Object.keys(initial)).toHaveLength(6);
    expect(PROGRESSION_WEAPONS.every((weapon) => initial[weapon].level === 1)).toBe(true);

    const migrated = normalizeWeaponProgression({
      orbital_rapid_blaster: { xp: 9999, level: 1 },
      homing_launcher: { xp: "not-a-number" },
      unknown_weapon: { xp: 300 },
    });
    expect(migrated.orbital_rapid_blaster).toEqual({ xp: 300, level: 3 });
    expect(migrated.homing_launcher).toEqual({ xp: 0, level: 1 });
    expect(migrated.sub_blaster).toEqual({ xp: 0, level: 1 });
  });

  it("caps XP and levels at Lv3 while preserving progress indicators", () => {
    expect(getWeaponLevelFromXp(0)).toBe(1);
    expect(getWeaponLevelFromXp(100)).toBe(2);
    expect(getWeaponLevelFromXp(300)).toBe(3);
    expect(applyWeaponXp({ xp: 250, level: 2 }, 100).record).toEqual({ xp: 300, level: 3 });
    expect(applyWeaponXp({ xp: 300, level: 3 }, 500).record).toEqual({ xp: 300, level: 3 });
    expect(getWeaponProgress({ xp: 300, level: 3 })).toMatchObject({
      level: 3,
      progressPercent: 100,
      isMaxLevel: true,
      nextThreshold: null,
    });
  });

  it("matches the Rapid Blaster continuous-fire limits exactly", () => {
    for (const level of [1, 2, 3] as const) {
      const config = getWeaponConfig("orbital_rapid_blaster", level);
      const shotsUntilOverheat = config.overheatSeconds! / config.fireInterval;
      const heatPerShot = config.fireInterval / config.overheatSeconds!;
      expect(shotsUntilOverheat * heatPerShot).toBeCloseTo(1, 8);
      expect(config.overheatCoolRate).toBeCloseTo(0.6 / config.overheatSeconds!, 8);
    }
  });

  it("applies the requested projectile and tracking tiers", () => {
    expect(getWeaponConfig("orbital_scattershot", 1).projectileCount).toBe(2);
    expect(getWeaponConfig("orbital_scattershot", 2).projectileCount).toBe(3);
    expect(getWeaponConfig("orbital_scattershot", 3).projectileCount).toBe(5);

    expect(getWeaponConfig("spiral_shooter", 3).spiralExplosion).toBe(true);
    expect(getWeaponConfig("spiral_shooter", 1).projectileSpeed).toBeLessThan(
      getWeaponConfig("spiral_shooter", 2).projectileSpeed,
    );

    expect(getWeaponConfig("overcharged_blaster", 1).explosionScale).toBe(0.8);
    expect(getWeaponConfig("overcharged_blaster", 2).explosionScale).toBe(1);
    expect(getWeaponConfig("overcharged_blaster", 3).explosionScale).toBe(1.2);

    expect(getWeaponConfig("homing_launcher", 1).homingTurnRateDegrees).toBeLessThan(
      getWeaponConfig("homing_launcher", 2).homingTurnRateDegrees,
    );
    expect(getWeaponConfig("homing_launcher", 2).homingTurnRateDegrees).toBeLessThan(
      getWeaponConfig("homing_launcher", 3).homingTurnRateDegrees,
    );
    expect(getWeaponConfig("sub_blaster", 1).aimVarianceDegrees).toBe(12);
    expect(getWeaponConfig("sub_blaster", 2).aimVarianceDegrees).toBe(6);
    expect(getWeaponConfig("sub_blaster", 3).aimVarianceDegrees).toBe(0);
    expect(getWeaponConfig("sub_blaster", 1).subBlasterTargetMode).toBe("random-all");
    expect(getWeaponConfig("sub_blaster", 2).subBlasterTargetMode).toBe("random-close-mid");
    expect(getWeaponConfig("sub_blaster", 3).subBlasterTargetMode).toBe("priority");
  });

  it("awards equipped weapon XP once at a result boundary", () => {
    useShop.setState({
      equippedWeapon: "orbital_rapid_blaster",
      weaponProgression: createInitialWeaponProgression(),
    });
    useMagicOrb.setState({
      gameMode: "arcade",
      gameTime: 10,
      weaponUsed: "orbital_rapid_blaster",
      weaponXpAwarded: false,
      lastWeaponProgression: null,
    });

    const first = useMagicOrb.getState().awardWeaponProgression();
    const second = useMagicOrb.getState().awardWeaponProgression();

    expect(first?.xpAwarded).toBe(100);
    expect(first?.previousLevel).toBe(1);
    expect(second).toBe(first);
    expect(useShop.getState().weaponProgression.orbital_rapid_blaster.xp).toBe(100);
  });

  it("reaches Rapid Blaster overheat after the configured continuous shot count", () => {
    useShop.setState({
      equippedWeapon: "orbital_rapid_blaster",
      weaponProgression: createInitialWeaponProgression(),
    });
    useMagicOrb.setState({
      rapidOverheat: 0,
      rapidOverheatPenaltyTimer: 0,
      rapidOverheatActive: false,
      gameTime: 12,
      runStats: originalMagicOrbState.runStats,
    });

    const config = getWeaponConfig("orbital_rapid_blaster", 1);
    const shots = config.overheatSeconds! / config.fireInterval;
    for (let index = 0; index < shots; index++) {
      useMagicOrb.getState().recordShot();
    }

    expect(useMagicOrb.getState().rapidOverheat).toBeCloseTo(1, 8);
    expect(useMagicOrb.getState().rapidOverheatActive).toBe(true);
    expect(useMagicOrb.getState().rapidOverheatPenaltyTimer).toBe(config.overheatPenaltySeconds);
  });
});