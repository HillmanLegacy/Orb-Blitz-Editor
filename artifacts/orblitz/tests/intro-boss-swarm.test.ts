import { describe, expect, it } from "vitest";
import {
  ARCADE_BOSS_INTRO_DEFS,
  ARCADE_BOSS_INTRO_TYPES,
} from "../src/components/ui/ArcadeBossIntroScene";
import { MAIN_BOSS_TYPES } from "../src/components/game/BossDefeatPalette";

describe("intro boss swarm", () => {
  it("includes every authored main boss exactly once", () => {
    const introTypes = ARCADE_BOSS_INTRO_DEFS.map(({ type }) => type);

    expect(introTypes).toEqual([...MAIN_BOSS_TYPES]);
    expect(ARCADE_BOSS_INTRO_TYPES).toEqual(MAIN_BOSS_TYPES);
    expect(new Set(introTypes).size).toBe(MAIN_BOSS_TYPES.length);
  });
});