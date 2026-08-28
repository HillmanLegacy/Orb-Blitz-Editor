import { AUTHORED_BOSS_PROGRESSION } from "@/game-runtime/BossProgression";
import {
  ENEMY_DEFEAT_DURATION,
  getEnemyDefeatProgress,
} from "@/game-runtime/EnemyLifecycle";
import type { BossType, DarkOrb, GameMode, OrbShape } from "@/lib/stores/useMagicOrb";

export { ENEMY_DEFEAT_DURATION, getEnemyDefeatProgress };
export const STANDARD_ENEMY_DEFEAT_SIZE_SCALE = 2;

export type EnemyDefeatQuality = "low" | "standard" | "high";

export type EnemyDefeatProfile = Readonly<{
  maxActive: number;
  main: number;
  embers: number;
  fragments: number;
  corona: number;
  sizeMultiplier: number;
  bossOrbSizeMultiplier: number;
}>;

export const ENEMY_DEFEAT_PROFILES: Record<EnemyDefeatQuality, EnemyDefeatProfile> = {
  high: {
    maxActive: 16,
    main: 64,
    embers: 12,
    fragments: 3,
    corona: 8,
    sizeMultiplier: 0.8 * STANDARD_ENEMY_DEFEAT_SIZE_SCALE,
    bossOrbSizeMultiplier: 0.8,
  },
  standard: {
    maxActive: 12,
    main: 48,
    embers: 8,
    fragments: 2,
    corona: 6,
    sizeMultiplier: 0.76 * STANDARD_ENEMY_DEFEAT_SIZE_SCALE,
    bossOrbSizeMultiplier: 0.76,
  },
  low: {
    maxActive: 8,
    main: 32,
    embers: 6,
    fragments: 2,
    corona: 4,
    sizeMultiplier: 0.72 * STANDARD_ENEMY_DEFEAT_SIZE_SCALE,
    bossOrbSizeMultiplier: 0.72,
  },
};

const SHAPE_BOSS_TYPE: Record<OrbShape, BossType> = {
  sphere: "circle",
  circle: "circle",
  star: "star",
  triangle: "triangle",
  tetrahedron: "triangle",
  trapezoid: "trapezoid",
  cube: "cube",
  octahedron: "cloud",
  dodecahedron: "cube",
  lightning: "cloud",
  arrow: "arrow",
  tentacle: "tentacle",
  monster: "monster",
  bird: "bird",
  launcher: "circle",
};

const WORLD_BOSS_TYPE = new Map(
  AUTHORED_BOSS_PROGRESSION.map((entry) => [entry.worldLevel, entry.bossType] as const),
);

export function getBossTypeForEnemyShape(shape: OrbShape): BossType {
  return SHAPE_BOSS_TYPE[shape];
}

export function resolveEnemyDefeatBossType(
  orb: Pick<DarkOrb, "isBossOrb" | "bossType" | "bossDefeatColor" | "shape">,
  gameMode: GameMode,
  arcadeLevel: number,
): BossType | null {
  if (orb.bossType) return orb.bossType;
  if (orb.isBossOrb && orb.bossDefeatColor) return orb.bossDefeatColor;
  if (gameMode === "arcade") {
    return WORLD_BOSS_TYPE.get(Math.floor(arcadeLevel)) ?? "monster";
  }
  return getBossTypeForEnemyShape(orb.shape);
}

export function getEnemyDefeatParticleTotal(profile: EnemyDefeatProfile): number {
  return profile.main + profile.embers + profile.fragments + profile.corona;
}