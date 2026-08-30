export interface SfxVariationProfile {
  variants: number;
  pitchSemitones: number;
  filterSpread: number;
  gainSpread: number;
  durationSpread: number;
  textureSpread: number;
  historySize?: number;
}

export interface SfxVariation {
  variant: number;
  pitchRatio: number;
  filterRatio: number;
  gainRatio: number;
  durationRatio: number;
  texture: number;
}

export interface SfxVariationBank {
  next: (key: string, profile: SfxVariationProfile) => SfxVariation;
  reset: () => void;
  size: () => number;
}

export const SFX_VARIATION_PROFILES = {
  projectile: {
    variants: 5,
    pitchSemitones: 1.4,
    filterSpread: 0.12,
    gainSpread: 0.06,
    durationSpread: 0.06,
    textureSpread: 0.12,
    historySize: 2,
  },
  impact: {
    variants: 5,
    pitchSemitones: 2.2,
    filterSpread: 0.18,
    gainSpread: 0.08,
    durationSpread: 0.1,
    textureSpread: 0.18,
    historySize: 2,
  },
  reward: {
    variants: 6,
    pitchSemitones: 2.8,
    filterSpread: 0.2,
    gainSpread: 0.1,
    durationSpread: 0.1,
    textureSpread: 0.2,
    historySize: 3,
  },
  ability: {
    variants: 4,
    pitchSemitones: 1.6,
    filterSpread: 0.14,
    gainSpread: 0.07,
    durationSpread: 0.08,
    textureSpread: 0.14,
    historySize: 2,
  },
  ui: {
    variants: 4,
    pitchSemitones: 1.1,
    filterSpread: 0.1,
    gainSpread: 0.05,
    durationSpread: 0.05,
    textureSpread: 0.1,
    historySize: 2,
  },
} as const satisfies Record<string, SfxVariationProfile>;

const MAX_VARIATION_KEYS = 32;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const normalizedVariant = (variant: number, variants: number): number =>
  variants <= 1 ? 0.5 : variant / (variants - 1);

const spreadAround = (center: number, spread: number, random: () => number): number =>
  center + (random() - 0.5) * spread;

/**
 * Creates a bounded, independently testable variation selector.
 *
 * The variant index is intentionally separate from the continuous offsets:
 * recent indices prevent obvious repeats while the offsets keep adjacent
 * variations from sounding like discrete presets.
 */
export function createSfxVariationBank(random: () => number = Math.random): SfxVariationBank {
  const recent = new Map<string, number[]>();

  const reset = () => recent.clear();

  const next = (key: string, profile: SfxVariationProfile): SfxVariation => {
    const variants = Math.max(1, Math.floor(profile.variants));
    const historySize = Math.max(0, Math.min(variants - 1, Math.floor(profile.historySize ?? 1)));
    const previous = recent.get(key) ?? [];
    const candidates: number[] = [];

    for (let index = 0; index < variants; index++) {
      if (!previous.includes(index)) candidates.push(index);
    }

    const candidateIndex = Math.floor(clamp(random(), 0, 0.999999) * candidates.length);
    const variant = candidates[candidateIndex] ?? 0;
    const nextHistory = historySize === 0
      ? []
      : [...previous, variant].slice(-historySize);
    recent.delete(key);
    if (historySize > 0) recent.set(key, nextHistory);
    if (recent.size > MAX_VARIATION_KEYS) {
      const oldestKey = recent.keys().next().value;
      if (oldestKey !== undefined) recent.delete(oldestKey);
    }

    const position = normalizedVariant(variant, variants);
    const centered = position * 2 - 1;
    const jitter = (random() - 0.5) * 0.24;

    return {
      variant,
      pitchRatio: Math.pow(2, (centered * profile.pitchSemitones + jitter) / 12),
      filterRatio: clamp(1 + centered * profile.filterSpread + jitter * profile.filterSpread, 0.72, 1.3),
      gainRatio: clamp(1 + centered * profile.gainSpread + jitter * profile.gainSpread, 0.82, 1.18),
      durationRatio: clamp(1 + centered * profile.durationSpread + jitter * profile.durationSpread, 0.86, 1.16),
      texture: clamp(0.5 + centered * profile.textureSpread + jitter * profile.textureSpread, 0, 1),
    };
  };

  return { next, reset, size: () => recent.size };
}