import { describe, expect, it } from "vitest";
import {
  COMBO_TIERS,
  COMBO_WINDOW_SECONDS,
  advanceCombo,
  createEmptyComboProgress,
  getComboMeterProgress,
  getComboTier,
  tickCombo,
} from "../src/game-runtime/ComboProgression";
import { useMagicOrb } from "../src/lib/stores/useMagicOrb";

describe("combo progression", () => {
  it("starts a chain and keeps the exact sustain boundary", () => {
    const empty = createEmptyComboProgress();
    const first = advanceCombo(empty, 10);
    const atBoundary = advanceCombo(first, 10 + COMBO_WINDOW_SECONDS);

    expect(first.count).toBe(1);
    expect(first.tier).toBeNull();
    expect(atBoundary.count).toBe(2);
    expect(atBoundary.tier).toBeNull();
  });

  it("resets only after the sustain window has elapsed", () => {
    const first = advanceCombo(createEmptyComboProgress(), 2);

    expect(tickCombo(first, 2 + COMBO_WINDOW_SECONDS)).toMatchObject({
      count: 1,
      timeRemaining: 0,
    });
    expect(tickCombo(first, 2 + COMBO_WINDOW_SECONDS + 0.001)).toEqual(createEmptyComboProgress());
    expect(advanceCombo(first, 2 + COMBO_WINDOW_SECONDS + 0.001).count).toBe(1);
  });

  it("uses every requested tier threshold and clamps the final meter", () => {
    expect(COMBO_WINDOW_SECONDS).toBe(0.75);
    expect(COMBO_TIERS.map((tier) => tier.threshold)).toEqual([3, 6, 10, 16, 25]);
    expect(COMBO_TIERS.map((tier) => getComboTier(tier.threshold))).toEqual([
      "Orbiter",
      "Orbtastic",
      "Orbnado",
      "Orblitterator",
      "Orbagedon",
    ]);
    expect(getComboMeterProgress(1)).toBeCloseTo(1 / 25);
    expect(getComboMeterProgress(25)).toBe(1);
    expect(getComboMeterProgress(99)).toBe(1);
  });

  it("resets combo state when a new game or level starts", () => {
    useMagicOrb.setState({
      combo: advanceCombo(createEmptyComboProgress(), 0),
      gameMode: "survival",
      phase: "menu",
    });

    useMagicOrb.getState().startGame();
    expect(useMagicOrb.getState().combo).toEqual(createEmptyComboProgress());

    useMagicOrb.setState({
      combo: advanceCombo(createEmptyComboProgress(), 3),
      gameMode: "arcade",
    });
    useMagicOrb.getState().startArcadeLevel(1.1);
    expect(useMagicOrb.getState().combo).toEqual(createEmptyComboProgress());
  });
});