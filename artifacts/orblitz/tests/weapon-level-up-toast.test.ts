import { describe, expect, it } from "vitest";
import type { WeaponLevelUpResult } from "../src/game-runtime/WeaponProgression";
import {
  enqueueWeaponLevelUpToast,
  getWeaponLevelUpToastId,
  MAX_WEAPON_LEVEL_UP_TOASTS,
} from "../src/components/ui/WeaponLevelUpToast";

function makeResult(overrides: Partial<WeaponLevelUpResult> = {}): WeaponLevelUpResult {
  return {
    weapon: "orbital_rapid_blaster",
    displayName: "Orbital Rapid Blaster",
    xpAwarded: 70,
    previousLevel: 1,
    level: 2,
    previousXp: 250,
    xp: 20,
    previousProgressPercent: 83,
    progressPercent: 7,
    nextThreshold: 480,
    xpRemaining: 460,
    leveledUp: true,
    changes: [],
    ...overrides,
  };
}

describe("weapon level-up toast queue", () => {
  it("uses the progression boundary values to identify one level-up", () => {
    const result = makeResult();
    expect(getWeaponLevelUpToastId(result)).toBe("orbital_rapid_blaster:1:2:250:70:20");
  });

  it("suppresses repeated store renders but accepts a later level-up", () => {
    const announcedIds = new Set<string>();
    const first = makeResult();
    const second = makeResult({ level: 3, previousLevel: 2, previousXp: 460, xp: 0 });

    let queue = enqueueWeaponLevelUpToast([], first, announcedIds);
    queue = enqueueWeaponLevelUpToast(queue, first, announcedIds);
    queue = enqueueWeaponLevelUpToast(queue, second, announcedIds);

    expect(queue).toHaveLength(2);
    expect(queue.map((entry) => entry.level)).toEqual([2, 3]);
  });

  it("ignores progress updates without a real level transition and bounds newer events", () => {
    const announcedIds = new Set<string>();
    let queue: WeaponLevelUpResult[] = [];
    const progressOnly = makeResult({ leveledUp: false });

    queue = enqueueWeaponLevelUpToast(queue, progressOnly, announcedIds);
    expect(queue).toHaveLength(0);

    for (let level = 1; level <= MAX_WEAPON_LEVEL_UP_TOASTS + 2; level += 1) {
      queue = enqueueWeaponLevelUpToast(queue, makeResult({
        previousLevel: level === 1 ? 1 : 2,
        level: level === 1 ? 2 : 3,
        previousXp: level * 10,
        xp: level,
      }), announcedIds);
    }

    expect(queue).toHaveLength(MAX_WEAPON_LEVEL_UP_TOASTS);
    expect(queue.at(-1)?.xp).toBe(MAX_WEAPON_LEVEL_UP_TOASTS + 2);
  });
});