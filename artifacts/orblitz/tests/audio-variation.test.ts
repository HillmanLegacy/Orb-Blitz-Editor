import { describe, expect, it } from "vitest";
import {
  createSfxVariationBank,
  SFX_VARIATION_PROFILES,
  type SfxVariationProfile,
} from "../src/lib/audio/SfxVariation";

function repeatingRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("SFX variation invariants", () => {
  it("does not repeat recent variants for the same cue", () => {
    const bank = createSfxVariationBank(repeatingRandom([0, 0.5]));
    const profile = SFX_VARIATION_PROFILES.projectile;
    const variants = Array.from({ length: 12 }, () => bank.next("shoot", profile).variant);

    for (let index = 1; index < variants.length; index++) {
      expect(variants[index]).not.toBe(variants[index - 1]);
    }
    for (let index = 2; index < variants.length; index++) {
      expect(variants[index]).not.toBe(variants[index - 2]);
    }
  });

  it("keeps every modulation inside the authored safety range", () => {
    const bank = createSfxVariationBank(repeatingRandom([0, 0, 0.999999, 0.999999, 0.5]));

    for (const profile of Object.values(SFX_VARIATION_PROFILES)) {
      for (let index = 0; index < profile.variants * 3; index++) {
        const variation = bank.next(`profile-${profile.variants}`, profile);
        const pitchLimit = Math.pow(2, (profile.pitchSemitones + 0.12) / 12);

        expect(variation.pitchRatio).toBeGreaterThanOrEqual(1 / pitchLimit);
        expect(variation.pitchRatio).toBeLessThanOrEqual(pitchLimit);
        expect(variation.filterRatio).toBeGreaterThanOrEqual(0.72);
        expect(variation.filterRatio).toBeLessThanOrEqual(1.3);
        expect(variation.gainRatio).toBeGreaterThanOrEqual(0.82);
        expect(variation.gainRatio).toBeLessThanOrEqual(1.18);
        expect(variation.durationRatio).toBeGreaterThanOrEqual(0.86);
        expect(variation.durationRatio).toBeLessThanOrEqual(1.16);
        expect(variation.texture).toBeGreaterThanOrEqual(0);
        expect(variation.texture).toBeLessThanOrEqual(1);
      }
    }
  });

  it("bounds cue history and clears it during lifecycle reset", () => {
    const bank = createSfxVariationBank(() => 0.4);
    const profile: SfxVariationProfile = {
      variants: 3,
      pitchSemitones: 1,
      filterSpread: 0.1,
      gainSpread: 0.1,
      durationSpread: 0.1,
      textureSpread: 0.1,
      historySize: 1,
    };

    for (let index = 0; index < 100; index++) {
      bank.next(`cue-${index}`, profile);
    }

    expect(bank.size()).toBeLessThanOrEqual(32);
    bank.reset();
    expect(bank.size()).toBe(0);
  });

  it("keeps variation histories independent across throttled cue categories", () => {
    const bank = createSfxVariationBank(repeatingRandom([0, 0.5, 0.9, 0.25]));
    const profile = SFX_VARIATION_PROFILES.impact;
    const firstHit = bank.next("hit", profile);
    const firstDestroy = bank.next("orb-destroy", profile);
    const secondHit = bank.next("hit", profile);

    expect(secondHit.variant).not.toBe(firstHit.variant);
    expect(firstDestroy).toMatchObject({
      pitchRatio: expect.any(Number),
      filterRatio: expect.any(Number),
      durationRatio: expect.any(Number),
    });
    expect(bank.size()).toBe(2);
  });
});