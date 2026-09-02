import type { BossHitReaction } from "@/lib/stores/useMagicOrb";

export const BOSS_HIT_SHAKE_DURATION = 0.24;
export const BOSS_HIT_SHAKE_MAX_STRENGTH = 1.6;

export interface BossHitShakeState {
  elapsed: number;
  direction: [number, number];
  strength: number;
  phase: number;
}

export interface BossHitShakeTransform {
  offset: [number, number, number];
  rotationZ: number;
  scale: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function normalizeDirection(
  direction: readonly [number, number, number],
): [number, number] {
  const length = Math.hypot(direction[0], direction[1]);
  if (length < 1e-6) return [1, 0];
  return [direction[0] / length, direction[1] / length];
}

function getReactionStrength(damageStrength: number): number {
  return Math.min(BOSS_HIT_SHAKE_MAX_STRENGTH, 0.82 + Math.max(0, damageStrength) * 0.12);
}

function getShakeIntensity(state: BossHitShakeState): number {
  return clamp01(1 - state.elapsed / BOSS_HIT_SHAKE_DURATION);
}

/**
 * Starts a visual-only boss impact response. A live response contributes a
 * small amount of momentum to the next hit, but the cap keeps rapid fire from
 * turning into an unbounded displacement.
 */
export function createBossHitShakeState(
  reaction: BossHitReaction,
  previous: BossHitShakeState | null = null,
): BossHitShakeState {
  const carriedStrength = previous && getShakeIntensity(previous) > 0
    ? previous.strength * getShakeIntensity(previous) * 0.32
    : 0;

  return {
    elapsed: 0,
    direction: normalizeDirection(reaction.direction),
    strength: Math.min(
      BOSS_HIT_SHAKE_MAX_STRENGTH,
      getReactionStrength(reaction.strength) + carriedStrength,
    ),
    // The irrational-ish multiplier makes consecutive hits feel less mechanical
    // while remaining fully deterministic for tests and replay-like behavior.
    phase: (reaction.id * 2.399963229728653) % (Math.PI * 2),
  };
}

export function advanceBossHitShake(
  state: BossHitShakeState,
  delta: number,
): BossHitShakeState {
  return {
    ...state,
    elapsed: Math.min(
      BOSS_HIT_SHAKE_DURATION,
      state.elapsed + Math.max(0, Math.min(delta, 0.05)),
    ),
  };
}

export function getBossHitShakeTransform(
  state: BossHitShakeState,
): BossHitShakeTransform {
  const progress = clamp01(state.elapsed / BOSS_HIT_SHAKE_DURATION);
  const envelope = Math.pow(1 - progress, 2.15);
  const kickProgress = clamp01(progress * 1.7);
  const kick = Math.sin(kickProgress * Math.PI) * envelope;
  const tremor = Math.sin(progress * 26 + state.phase) * envelope;
  const lateralTremor = Math.cos(progress * 22 + state.phase * 1.37) * envelope;
  const [dx, dy] = state.direction;
  const perpendicularX = -dy;
  const perpendicularY = dx;
  const recoil = state.strength * (0.22 * kick + 0.035 * tremor);
  const lateral = state.strength * 0.075 * lateralTremor;

  return {
    offset: [
      dx * recoil + perpendicularX * lateral,
      dy * recoil + perpendicularY * lateral,
      0,
    ],
    rotationZ: state.strength * (0.095 * kick + 0.022 * tremor),
    // A compact squash on contact sells force without distorting authored models.
    scale: 1 - state.strength * 0.045 * kick + state.strength * 0.012 * tremor,
  };
}

export function isBossHitShakeActive(state: BossHitShakeState | null): boolean {
  return state !== null && state.elapsed < BOSS_HIT_SHAKE_DURATION;
}