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
  it("starts a chain and keeps the exact one-second boundary", () => {
    const empty = createEmptyComboProgress();
    const first = advanceCombo(empty, 10);
    const atBoundary = advanceCombo(first, 10 + COMBO_WINDOW_SECONDS);

    expect(first.count).toBe(1);
    expect(first.tier).toBeNull();
    expect(atBoundary.count).toBe(2);
    expect(atBoundary.tier).toBe("Orbiter");
  });

  it("resets only after the one-second window has elapsed", () => {
    const first = advanceCombo(createEmptyComboProgress(), 2);

    expect(tickCombo(first, 3)).toMatchObject({
      count: 1,
      timeRemaining: 0,
    });
    expect(tickCombo(first, 3.001)).toEqual(createEmptyComboProgress());
    expect(advanceCombo(first, 3.001).count).toBe(1);
  });

  it("uses every requested tier threshold and clamps the final meter", () => {
    expect(COMBO_TIERS.map((tier) => tier.threshold)).toEqual([2, 4, 7, 10, 15]);
    expect(COMBO_TIERS.map((tier) => getComboTier(tier.threshold))).toEqual([
      "Orbiter",
      "Orbtastic",
      "Orbnado",
      "Orblitterator",
      "Orbagedon",
    ]);
    expect(getComboMeterProgress(1)).toBeCloseTo(1 / 15);
    expect(getComboMeterProgress(15)).toBe(1);
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