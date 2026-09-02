export type ProgressionWeapon =
  | "orbital_rapid_blaster"
  | "orbital_scattershot"
  | "spiral_shooter"
  | "overcharged_blaster"
  | "homing_launcher"
  | "sub_blaster";

export type WeaponLevel = 1 | 2 | 3;

export const PROGRESSION_WEAPONS: readonly ProgressionWeapon[] = [
  "orbital_rapid_blaster",
  "orbital_scattershot",
  "spiral_shooter",
  "overcharged_blaster",
  "homing_launcher",
  "sub_blaster",
];

export const WEAPON_PROGRESSION_VERSION = 2;

export interface WeaponXpProfile {
  /** XP required to advance from Lv1 to Lv2 and from Lv2 to Lv3. */
  levelRequirements: readonly [number, number];
  arcadeLevelXp: number;
  finishedRunXp: number;
}

/**
 * Pokémon-style progression tuning. XP is stored relative to the current
 * level; these awards are intentionally smaller than every first milestone.
 */
export const WEAPON_XP_PROFILES: Record<ProgressionWeapon, WeaponXpProfile> = {
  spiral_shooter: {
    levelRequirements: [240, 360],
    arcadeLevelXp: 80,
    finishedRunXp: 120,
  },
  orbital_rapid_blaster: {
    levelRequirements: [300, 480],
    arcadeLevelXp: 70,
    finishedRunXp: 105,
  },
  sub_blaster: {
    levelRequirements: [330, 540],
    arcadeLevelXp: 65,
    finishedRunXp: 100,
  },
  homing_launcher: {
    levelRequirements: [360, 600],
    arcadeLevelXp: 60,
    finishedRunXp: 95,
  },
  orbital_scattershot: {
    levelRequirements: [420, 720],
    arcadeLevelXp: 55,
    finishedRunXp: 90,
  },
  overcharged_blaster: {
    levelRequirements: [480, 840],
    arcadeLevelXp: 50,
    finishedRunXp: 80,
  },
};

/** Legacy cumulative values retained only to migrate existing saves safely. */
export const WEAPON_LEVEL_XP_THRESHOLDS: readonly number[] = [0, 100, 300];
/** @deprecated Use getWeaponXpAward(weapon, mode). */
export const WEAPON_XP_PER_ARCADE_LEVEL = 100;
/** @deprecated Use getWeaponXpAward(weapon, mode). */
export const WEAPON_XP_PER_FINISHED_RUN = 150;

export type SubBlasterTargetMode = "random-all" | "random-close-mid" | "priority";

export interface WeaponLevelConfig {
  level: WeaponLevel;
  fireInterval: number;
  projectileCount: number;
  projectileSize: number;
  projectileSpeed: number;
  explosionScale: number;
  spiralExplosion: boolean;
  homingTurnRateDegrees: number;
  aimVarianceDegrees: number;
  subBlasterTargetMode: SubBlasterTargetMode;
  subBlasterCloseRange: number;
  subBlasterMidRange: number;
  overheatSeconds: number | null;
  overheatPenaltySeconds: number;
  overheatCoolRate: number;
}

export interface WeaponProgressionRecord {
  xp: number;
  level: WeaponLevel;
}

export type WeaponProgressionState = Record<ProgressionWeapon, WeaponProgressionRecord>;

export interface WeaponLevelUpChange {
  label: string;
  from: string;
  to: string;
  direction: "up" | "down" | "new";
}

export interface WeaponLevelUpResult {
  weapon: ProgressionWeapon;
  displayName: string;
  xpAwarded: number;
  previousLevel: WeaponLevel;
  level: WeaponLevel;
  previousXp: number;
  xp: number;
  previousProgressPercent: number;
  progressPercent: number;
  nextThreshold: number | null;
  xpRemaining: number;
  leveledUp: boolean;
  changes: WeaponLevelUpChange[];
}

const BASELINE_FIRE_INTERVAL = {
  rapid: 1 / 6,
  scatter: 0.4,
  spiral: 0.5,
  overcharged: 1.5,
  homing: 0.333,
  sub: 0.45,
} as const;

const BASELINE_SPEED = {
  spiral: 16.5,
  overcharged: 5,
  homing: 16.5,
  sub: 26,
} as const;

const BASELINE_SIZE = {
  spiral: 0.15,
  overcharged: 1,
} as const;

const BASELINE_EXPLOSION_SCALE = 1;
const BASELINE_HOMING_TURN_RATE = 138;
const BASELINE_SUB_CLOSE_RANGE = 3.5;
const BASELINE_SUB_MID_RANGE = 6.5;

function rapidConfig(level: WeaponLevel): WeaponLevelConfig {
  const shotsPerSecond = level === 1 ? 4 : level === 2 ? 5 : 6;
  const overheatSeconds = level === 1 ? 6 : level === 2 ? 8 : 10;
  const heatBuildRate = 1 / overheatSeconds;
  return {
    level,
    fireInterval: 1 / shotsPerSecond,
    projectileCount: 1,
    projectileSize: 0.1,
    projectileSpeed: 22,
    explosionScale: BASELINE_EXPLOSION_SCALE,
    spiralExplosion: false,
    homingTurnRateDegrees: BASELINE_HOMING_TURN_RATE,
    aimVarianceDegrees: 2,
    subBlasterTargetMode: "priority",
    subBlasterCloseRange: BASELINE_SUB_CLOSE_RANGE,
    subBlasterMidRange: BASELINE_SUB_MID_RANGE,
    overheatSeconds,
    overheatPenaltySeconds: level === 1 ? 5 : level === 2 ? 4 : 2,
    overheatCoolRate: heatBuildRate * 0.6,
  };
}

function scatterConfig(level: WeaponLevel): WeaponLevelConfig {
  const fireRateMultiplier = level >= 2 ? 1.1 : 1;
  return {
    level,
    fireInterval: BASELINE_FIRE_INTERVAL.scatter / fireRateMultiplier,
    projectileCount: level === 1 ? 2 : level === 2 ? 3 : 5,
    projectileSize: 0.15,
    projectileSpeed: 20,
    explosionScale: BASELINE_EXPLOSION_SCALE,
    spiralExplosion: false,
    homingTurnRateDegrees: BASELINE_HOMING_TURN_RATE,
    aimVarianceDegrees: 0,
    subBlasterTargetMode: "priority",
    subBlasterCloseRange: BASELINE_SUB_CLOSE_RANGE,
    subBlasterMidRange: BASELINE_SUB_MID_RANGE,
    overheatSeconds: null,
    overheatPenaltySeconds: 0,
    overheatCoolRate: 0,
  };
}

function spiralConfig(level: WeaponLevel): WeaponLevelConfig {
  return {
    level,
    fireInterval: BASELINE_FIRE_INTERVAL.spiral,
    projectileCount: 1,
    projectileSize: level === 1 ? BASELINE_SIZE.spiral * 0.75 : BASELINE_SIZE.spiral,
    projectileSpeed: level === 1 ? BASELINE_SPEED.spiral * 0.6 : BASELINE_SPEED.spiral * 1.2,
    explosionScale: BASELINE_EXPLOSION_SCALE,
    spiralExplosion: level === 3,
    homingTurnRateDegrees: BASELINE_HOMING_TURN_RATE,
    aimVarianceDegrees: 0,
    subBlasterTargetMode: "priority",
    subBlasterCloseRange: BASELINE_SUB_CLOSE_RANGE,
    subBlasterMidRange: BASELINE_SUB_MID_RANGE,
    overheatSeconds: null,
    overheatPenaltySeconds: 0,
    overheatCoolRate: 0,
  };
}

function overchargedConfig(level: WeaponLevel): WeaponLevelConfig {
  return {
    level,
    fireInterval: 0.8,
    projectileCount: 1,
    projectileSize: BASELINE_SIZE.overcharged * (level === 1 ? 0.8 : level === 2 ? 1 : 1.2),
    projectileSpeed: BASELINE_SPEED.overcharged * (level === 1 ? 0.9 : level === 2 ? 1 : 1.1),
    explosionScale: BASELINE_EXPLOSION_SCALE * (level === 1 ? 0.8 : level === 2 ? 1 : 1.2),
    spiralExplosion: false,
    homingTurnRateDegrees: BASELINE_HOMING_TURN_RATE,
    aimVarianceDegrees: 0,
    subBlasterTargetMode: "priority",
    subBlasterCloseRange: BASELINE_SUB_CLOSE_RANGE,
    subBlasterMidRange: BASELINE_SUB_MID_RANGE,
    overheatSeconds: null,
    overheatPenaltySeconds: 0,
    overheatCoolRate: 0,
  };
}

function homingConfig(level: WeaponLevel): WeaponLevelConfig {
  return {
    level,
    fireInterval: level === 1 ? BASELINE_FIRE_INTERVAL.homing * 1.1 : BASELINE_FIRE_INTERVAL.homing,
    projectileCount: 1,
    projectileSize: 0.15,
    projectileSpeed: level === 1 ? BASELINE_SPEED.homing * 0.9 : BASELINE_SPEED.homing,
    explosionScale: BASELINE_EXPLOSION_SCALE,
    spiralExplosion: false,
    homingTurnRateDegrees: level === 1
      ? BASELINE_HOMING_TURN_RATE * 0.65
      : level === 2
        ? BASELINE_HOMING_TURN_RATE * 0.85
        : BASELINE_HOMING_TURN_RATE,
    aimVarianceDegrees: 0,
    subBlasterTargetMode: "priority",
    subBlasterCloseRange: BASELINE_SUB_CLOSE_RANGE,
    subBlasterMidRange: BASELINE_SUB_MID_RANGE,
    overheatSeconds: null,
    overheatPenaltySeconds: 0,
    overheatCoolRate: 0,
  };
}

function subBlasterConfig(level: WeaponLevel): WeaponLevelConfig {
  return {
    level,
    fireInterval: level === 1 ? 0.55 : level === 2 ? 0.5 : BASELINE_FIRE_INTERVAL.sub,
    projectileCount: 1,
    projectileSize: 0.09,
    projectileSpeed: level === 1 ? BASELINE_SPEED.sub * 0.9 : level === 2 ? BASELINE_SPEED.sub * 0.96 : BASELINE_SPEED.sub,
    explosionScale: BASELINE_EXPLOSION_SCALE,
    spiralExplosion: false,
    homingTurnRateDegrees: BASELINE_HOMING_TURN_RATE,
    aimVarianceDegrees: level === 1 ? 12 : level === 2 ? 6 : 0,
    subBlasterTargetMode: level === 1 ? "random-all" : level === 2 ? "random-close-mid" : "priority",
    subBlasterCloseRange: BASELINE_SUB_CLOSE_RANGE,
    subBlasterMidRange: BASELINE_SUB_MID_RANGE,
    overheatSeconds: null,
    overheatPenaltySeconds: 0,
    overheatCoolRate: 0,
  };
}

export const WEAPON_DISPLAY_NAMES: Record<ProgressionWeapon, string> = {
  orbital_rapid_blaster: "Orbital Rapid Blaster",
  orbital_scattershot: "Orbital Scattershot",
  spiral_shooter: "Orbital Spiral Blaster",
  overcharged_blaster: "Orbital Overcharged Blaster",
  homing_launcher: "Orbital Homing Blaster",
  sub_blaster: "Orbital Autonomous Sub Blaster",
};

export function isProgressionWeapon(value: string | null | undefined): value is ProgressionWeapon {
  return !!value && (PROGRESSION_WEAPONS as readonly string[]).includes(value);
}

function getLegacyWeaponLevelFromXp(xp: number): WeaponLevel {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  if (safeXp >= WEAPON_LEVEL_XP_THRESHOLDS[2]) return 3;
  if (safeXp >= WEAPON_LEVEL_XP_THRESHOLDS[1]) return 2;
  return 1;
}

function clampLegacyWeaponXp(xp: number): number {
  return Math.max(0, Math.min(WEAPON_LEVEL_XP_THRESHOLDS[2], Math.floor(Number.isFinite(xp) ? xp : 0)));
}

export function getWeaponLevelRequirement(
  weapon: ProgressionWeapon,
  level: WeaponLevel,
): number | null {
  return level < 3 ? WEAPON_XP_PROFILES[weapon].levelRequirements[level - 1] : null;
}

export function getWeaponLevelFromXp(
  weapon: ProgressionWeapon,
  xp: number,
): WeaponLevel {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const [levelTwoXp, levelThreeXp] = WEAPON_XP_PROFILES[weapon].levelRequirements;
  if (safeXp >= levelTwoXp + levelThreeXp) return 3;
  if (safeXp >= levelTwoXp) return 2;
  return 1;
}

function clampLevelRelativeXp(
  weapon: ProgressionWeapon,
  level: WeaponLevel,
  xp: number,
): number {
  const safeXp = Math.max(0, Number.isFinite(xp) ? Math.floor(xp) : 0);
  const requirement = getWeaponLevelRequirement(weapon, level);
  return requirement === null ? 0 : Math.min(requirement - 1, safeXp);
}

export function createInitialWeaponProgression(): WeaponProgressionState {
  return PROGRESSION_WEAPONS.reduce((state, weapon) => {
    state[weapon] = { xp: 0, level: 1 };
    return state;
  }, {} as WeaponProgressionState);
}

export function normalizeWeaponProgression(
  raw: unknown,
  version = 1,
): WeaponProgressionState {
  const initial = createInitialWeaponProgression();
  if (!raw || typeof raw !== "object") return initial;
  const source = raw as Record<string, unknown>;
  for (const weapon of PROGRESSION_WEAPONS) {
    const entry = source[weapon];
    if (!entry || typeof entry !== "object") continue;
    const rawEntry = entry as Record<string, unknown>;
    if (version >= WEAPON_PROGRESSION_VERSION) {
      const rawLevel = Number(rawEntry.level);
      const level: WeaponLevel = rawLevel === 3 ? 3 : rawLevel === 2 ? 2 : 1;
      initial[weapon] = {
        xp: clampLevelRelativeXp(weapon, level, Number(rawEntry.xp)),
        level,
      };
      continue;
    }

    // Existing saves used [0, 100, 300] cumulative XP. Preserve the earned
    // level and map its old within-level percentage into the new target.
    const legacyXp = clampLegacyWeaponXp(Number(rawEntry.xp));
    const legacyLevel = getLegacyWeaponLevelFromXp(legacyXp);
    if (legacyLevel === 3) {
      initial[weapon] = { xp: 0, level: 3 };
      continue;
    }
    const legacyStart = WEAPON_LEVEL_XP_THRESHOLDS[legacyLevel - 1];
    const legacyTarget = WEAPON_LEVEL_XP_THRESHOLDS[legacyLevel] - legacyStart;
    const levelTarget = getWeaponLevelRequirement(weapon, legacyLevel)!;
    const relativeProgress = Math.max(0, legacyXp - legacyStart) / legacyTarget;
    initial[weapon] = {
      xp: Math.min(levelTarget - 1, Math.floor(relativeProgress * levelTarget)),
      level: legacyLevel,
    };
  }
  return initial;
}

export function getWeaponConfig(weapon: ProgressionWeapon, level: WeaponLevel): WeaponLevelConfig {
  switch (weapon) {
    case "orbital_rapid_blaster": return rapidConfig(level);
    case "orbital_scattershot": return scatterConfig(level);
    case "spiral_shooter": return spiralConfig(level);
    case "overcharged_blaster": return overchargedConfig(level);
    case "homing_launcher": return homingConfig(level);
    case "sub_blaster": return subBlasterConfig(level);
  }
}

export function getWeaponProgress(weapon: ProgressionWeapon, record: WeaponProgressionRecord): {
  level: WeaponLevel;
  xp: number;
  currentThreshold: number | null;
  nextThreshold: number | null;
  xpRemaining: number;
  progressPercent: number;
  isMaxLevel: boolean;
} {
  const level: WeaponLevel = record.level === 3 ? 3 : record.level === 2 ? 2 : 1;
  const nextThreshold = getWeaponLevelRequirement(weapon, level);
  const xp = nextThreshold === null ? 0 : clampLevelRelativeXp(weapon, level, record.xp);
  return {
    level,
    xp,
    currentThreshold: nextThreshold,
    nextThreshold,
    xpRemaining: nextThreshold === null ? 0 : Math.max(0, nextThreshold - xp),
    progressPercent: nextThreshold === null ? 100 : Math.max(0, Math.min(100, (xp / nextThreshold) * 100)),
    isMaxLevel: level === 3,
  };
}

export function applyWeaponXp(
  weapon: ProgressionWeapon,
  record: WeaponProgressionRecord,
  amount: number,
): {
  record: WeaponProgressionRecord;
  previousLevel: WeaponLevel;
  previousXp: number;
  leveledUp: boolean;
} {
  const previousLevel: WeaponLevel = record.level === 3 ? 3 : record.level === 2 ? 2 : 1;
  const previousXp = previousLevel === 3
    ? 0
    : clampLevelRelativeXp(weapon, previousLevel, record.xp);
  let level = previousLevel;
  let xp = previousXp + Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));

  while (level < 3) {
    const requirement = getWeaponLevelRequirement(weapon, level)!;
    if (xp < requirement) break;
    xp -= requirement;
    level = (level + 1) as WeaponLevel;
  }
  if (level === 3) xp = 0;

  return {
    record: { xp: clampLevelRelativeXp(weapon, level, xp), level },
    previousLevel,
    previousXp,
    leveledUp: level > previousLevel,
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function compareChange(
  label: string,
  from: number,
  to: number,
  unit: string,
  lowerIsBetter = false,
): WeaponLevelUpChange | null {
  if (Math.abs(from - to) < 0.0001) return null;
  const direction = lowerIsBetter
    ? to < from ? "up" : "down"
    : to > from ? "up" : "down";
  return { label, from: `${formatNumber(from)}${unit}`, to: `${formatNumber(to)}${unit}`, direction };
}

export function getWeaponLevelUpChanges(
  weapon: ProgressionWeapon,
  fromLevel: WeaponLevel,
  toLevel: WeaponLevel,
): WeaponLevelUpChange[] {
  if (toLevel <= fromLevel) return [];
  const from = getWeaponConfig(weapon, fromLevel);
  const to = getWeaponConfig(weapon, toLevel);
  const changes: WeaponLevelUpChange[] = [];
  const add = (change: WeaponLevelUpChange | null) => { if (change) changes.push(change); };

  add(compareChange("Fire rate", 1 / from.fireInterval, 1 / to.fireInterval, " shots/s"));
  add(compareChange("Projectile count", from.projectileCount, to.projectileCount, " projectiles"));
  add(compareChange("Projectile size", from.projectileSize, to.projectileSize, "×"));
  add(compareChange("Projectile speed", from.projectileSpeed, to.projectileSpeed, " units/s"));
  add(compareChange("Explosion size", from.explosionScale, to.explosionScale, "×"));
  add(compareChange("Tracking", from.homingTurnRateDegrees, to.homingTurnRateDegrees, "°/s"));
  add(compareChange("Aim variance", from.aimVarianceDegrees, to.aimVarianceDegrees, "°", true));
  if (from.overheatSeconds !== to.overheatSeconds && from.overheatSeconds !== null && to.overheatSeconds !== null) {
    add(compareChange("Continuous fire before overheat", from.overheatSeconds, to.overheatSeconds, "s"));
  }
  if (from.overheatPenaltySeconds !== to.overheatPenaltySeconds) {
    add(compareChange("Overheat firing penalty", from.overheatPenaltySeconds, to.overheatPenaltySeconds, "s", true));
  }
  if (to.spiralExplosion && !from.spiralExplosion) {
    changes.push({ label: "Defeat explosion", from: "none", to: "skin-colored burst", direction: "new" });
  }
  if (from.subBlasterTargetMode !== to.subBlasterTargetMode) {
    changes.push({
      label: "Targeting",
      from: from.subBlasterTargetMode === "random-all" ? "random screen enemy" : from.subBlasterTargetMode === "random-close-mid" ? "random close/mid enemy" : "closest first",
      to: to.subBlasterTargetMode === "random-all" ? "random screen enemy" : to.subBlasterTargetMode === "random-close-mid" ? "random close/mid enemy" : "closest first",
      direction: "up",
    });
  }
  return changes;
}

export function getWeaponXpAward(
  weapon: ProgressionWeapon,
  mode: "survival" | "chill" | "arcade" | "gauntlet",
): number {
  const profile = WEAPON_XP_PROFILES[weapon];
  return mode === "arcade" ? profile.arcadeLevelXp : profile.finishedRunXp;
}