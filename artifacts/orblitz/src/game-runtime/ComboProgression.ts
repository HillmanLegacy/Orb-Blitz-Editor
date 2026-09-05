export const COMBO_WINDOW_SECONDS = 1;

export const COMBO_TIERS = [
  { name: "Orbiter", threshold: 2 },
  { name: "Orbtastic", threshold: 4 },
  { name: "Orbnado", threshold: 7 },
  { name: "Orblitterator", threshold: 10 },
  { name: "Orbagedon", threshold: 15 },
] as const;

export type ComboTierName = (typeof COMBO_TIERS)[number]["name"];

export interface ComboProgress {
  count: number;
  tier: ComboTierName | null;
  meterProgress: number;
  timeRemaining: number;
  lastDefeatAt: number | null;
}

export function createEmptyComboProgress(): ComboProgress {
  return {
    count: 0,
    tier: null,
    meterProgress: 0,
    timeRemaining: 0,
    lastDefeatAt: null,
  };
}

export function getComboTier(count: number): ComboTierName | null {
  for (let index = COMBO_TIERS.length - 1; index >= 0; index--) {
    if (count >= COMBO_TIERS[index].threshold) return COMBO_TIERS[index].name;
  }
  return null;
}

export function getComboMeterProgress(count: number): number {
  const finalThreshold = COMBO_TIERS[COMBO_TIERS.length - 1].threshold;
  return Math.max(0, Math.min(1, count / finalThreshold));
}

export function advanceCombo(progress: ComboProgress, now: number): ComboProgress {
  const elapsed = progress.lastDefeatAt === null ? Infinity : now - progress.lastDefeatAt;
  const continues = elapsed >= 0 && elapsed <= COMBO_WINDOW_SECONDS;
  const count = continues ? progress.count + 1 : 1;

  return {
    count,
    tier: getComboTier(count),
    meterProgress: getComboMeterProgress(count),
    timeRemaining: COMBO_WINDOW_SECONDS,
    lastDefeatAt: now,
  };
}

export function tickCombo(progress: ComboProgress, now: number): ComboProgress {
  if (progress.lastDefeatAt === null) return progress;

  const elapsed = now - progress.lastDefeatAt;
  if (elapsed > COMBO_WINDOW_SECONDS) return createEmptyComboProgress();

  return {
    ...progress,
    timeRemaining: Math.max(0, COMBO_WINDOW_SECONDS - Math.max(0, elapsed)),
  };
}