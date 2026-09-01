import { describe, expect, it } from "vitest";
import {
  INTRO_BOSS_DEFS,
  INTRO_BOSS_TYPES,
} from "../src/components/ui/StartupAnimation";
import { MAIN_BOSS_TYPES } from "../src/components/game/BossDefeatPalette";

describe("intro boss swarm", () => {
  it("includes every authored main boss exactly once", () => {
    const introTypes = INTRO_BOSS_DEFS.map(({ type }) => type);

    expect(introTypes).toEqual([...MAIN_BOSS_TYPES]);
    expect(INTRO_BOSS_TYPES).toEqual(MAIN_BOSS_TYPES);
    expect(new Set(introTypes).size).toBe(MAIN_BOSS_TYPES.length);
  });
});