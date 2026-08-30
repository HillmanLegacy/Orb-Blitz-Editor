import type {
  GameplayBossType,
  GameplayResultSnapshot,
} from "./GameplayGrades";

export type TrophyId =
  | "first_blood"
  | "deadeye"
  | "untouchable"
  | "boss_breaker"
  | "survivor"
  | "void_veteran"
  | "boss_circle"
  | "boss_star"
  | "boss_triangle"
  | "boss_trapezoid"
  | "boss_cube"
  | "boss_cloud"
  | "boss_arrow"
  | "boss_tentacle"
  | "boss_monster"
  | "enemies_10"
  | "enemies_50"
  | "enemies_100"
  | "enemies_250"
  | "enemies_500"
  | "shots_100"
  | "shots_500"
  | "shots_1000"
  | "shots_2500"
  | "shots_5000"
  | "hits_25"
  | "hits_100"
  | "hits_250"
  | "arcade_cadet"
  | "arcade_11"
  | "arcade_15"
  | "arcade_19"
  | "arcade_29"
  | "arcade_35"
  | "arcade_39"
  | "arcade_49"
  | "arcade_55"
  | "arcade_59"
  | "arcade_69"
  | "arcade_75"
  | "arcade_79"
  | "arcade_89"
  | "arcade_91"
  | "arcade_95"
  | "arcade_champion"
  | "missions_1"
  | "missions_10"
  | "score_1000"
  | "score_5000"
  | "score_10000";

export type TrophyCategory = "combat" | "mastery" | "survival" | "arcade";

export interface TrophyLifetimeStats {
  totalEnemiesDefeated: number;
  totalShotsFired: number;
  totalHits: number;
  totalCompletedResults: number;
  totalScore: number;
  bossTypesDefeated: Partial<Record<GameplayBossType, number>>;
  completedArcadeLevels: string[];
  processedResultKeys: string[];
}

export interface TrophyDefinition {
  id: TrophyId;
  name: string;
  title: string;
  description: string;
  lockedDescription: string;
  category: TrophyCategory;
  icon: string;
  color: string;
  isEarned: (result: GameplayResultSnapshot, lifetime: TrophyLifetimeStats) => boolean;
}

export interface TrophyProgressionState {
  unlockedTrophyIds: TrophyId[];
  selectedTitle: TrophyId | null;
  lifetimeStats: TrophyLifetimeStats;
}

export interface TrophyUnlock {
  id: TrophyId;
  name: string;
  title: string;
  description: string;
  category: TrophyCategory;
  icon: string;
  color: string;
}

const accuracyAtLeast = (result: GameplayResultSnapshot, minimum: number) => (
  result.stats.shotsFired >= 10
  && result.stats.hits / result.stats.shotsFired >= minimum
);

const arcadeLevelIs = (level: number) => (result: GameplayResultSnapshot) => (
  result.mode === "arcade"
  && result.completed
  && result.arcadeLevel.toFixed(1) === level.toFixed(1)
);

const totalAtLeast = (field: keyof Pick<TrophyLifetimeStats, "totalEnemiesDefeated" | "totalShotsFired" | "totalHits" | "totalCompletedResults" | "totalScore">, amount: number) => (
  _result: GameplayResultSnapshot,
  lifetime: TrophyLifetimeStats,
) => lifetime[field] >= amount;

const bossTypeDefeated = (bossType: GameplayBossType) => (
  _result: GameplayResultSnapshot,
  lifetime: TrophyLifetimeStats,
) => (lifetime.bossTypesDefeated[bossType] ?? 0) >= 1;

const bossTrophy = (
  id: TrophyId,
  name: string,
  title: string,
  bossType: GameplayBossType,
  description: string,
  color: string,
): TrophyDefinition => ({
  id,
  name,
  title,
  description,
  lockedDescription: description,
  category: "combat",
  icon: "◆",
  color,
  isEarned: bossTypeDefeated(bossType),
});

export const TROPHY_CATALOGUE: readonly TrophyDefinition[] = [
  {
    id: "first_blood",
    name: "FIRST SIGNAL",
    title: "ORBITAL INITIATE",
    description: "Defeat your first enemy.",
    lockedDescription: "Defeat 1 enemy.",
    category: "combat",
    icon: "✦",
    color: "#22d3ee",
    isEarned: (result) => result.stats.enemiesDefeated >= 1,
  },
  {
    id: "deadeye",
    name: "THE NEEDLE THREAD",
    title: "DEAD-EYE",
    description: "Finish a result with 90% accuracy.",
    lockedDescription: "Hit 9 of your first 10 shots in one result.",
    category: "mastery",
    icon: "◎",
    color: "#a78bfa",
    isEarned: (result) => accuracyAtLeast(result, 0.9),
  },
  {
    id: "untouchable",
    name: "NO SCRATCHES",
    title: "UNTOUCHABLE",
    description: "Complete a level or run without taking damage.",
    lockedDescription: "Complete 1 level or run with 0 damage.",
    category: "mastery",
    icon: "◇",
    color: "#fbbf24",
    isEarned: (result) => result.completed && result.stats.damageTaken === 0,
  },
  {
    id: "boss_breaker",
    name: "WHO'S THE BOSS?",
    title: "BOSS OF THE VOID",
    description: "Defeat a boss.",
    lockedDescription: "Defeat 1 boss.",
    category: "combat",
    icon: "◆",
    color: "#fb7185",
    isEarned: (result) => result.stats.bossesDefeated >= 1,
  },
  {
    id: "survivor",
    name: "LONG HAUL",
    title: "ENDURANCE PILOT",
    description: "Survive for 5 minutes.",
    lockedDescription: "Survive 5:00 in Survival mode.",
    category: "survival",
    icon: "◌",
    color: "#34d399",
    isEarned: (result) => result.mode === "survival" && result.stats.elapsedSeconds >= 300,
  },
  {
    id: "void_veteran",
    name: "THE TEN-MINUTE VOID",
    title: "VOID VETERAN",
    description: "Survive for 10 minutes.",
    lockedDescription: "Survive 10:00 in Survival mode.",
    category: "survival",
    icon: "◉",
    color: "#60a5fa",
    isEarned: (result) => result.mode === "survival" && result.stats.elapsedSeconds >= 600,
  },

  bossTrophy("boss_circle", "ASHES TO ASHES", "EMBER EATER", "circle", "Defeat the Fire World boss.", "#fb923c"),
  bossTrophy("boss_star", "STARSTRUCK", "STAR WARDEN", "star", "Defeat the World 2 boss.", "#facc15"),
  bossTrophy("boss_triangle", "THREE-SIDED THREAT", "TRIANGLE TACTICIAN", "triangle", "Defeat the World 3 boss.", "#f97316"),
  bossTrophy("boss_trapezoid", "ANGLE OF ATTACK", "TRAPEZOID TAMER", "trapezoid", "Defeat the World 4 boss.", "#f472b6"),
  bossTrophy("boss_cube", "CUBE ROOT", "CUBE CONQUEROR", "cube", "Defeat the World 5 boss.", "#38bdf8"),
  bossTrophy("boss_cloud", "CLOUD NINE", "CLOUD CUTTER", "cloud", "Defeat the World 6 boss.", "#c4b5fd"),
  bossTrophy("boss_arrow", "POINT TAKEN", "ARROW ALCHEMIST", "arrow", "Defeat the World 7 boss.", "#4ade80"),
  bossTrophy("boss_tentacle", "A TANGLE OF YOUR OWN", "TANGLEMASTER", "tentacle", "Defeat the World 8 boss.", "#a78bfa"),
  bossTrophy("boss_monster", "MONSTER MASH", "BEAST MODE", "monster", "Defeat the World 9 boss.", "#f43f5e"),

  {
    id: "enemies_10",
    name: "TEN DOWN",
    title: "WARM-UP ACT",
    description: "Defeat 10 enemies.",
    lockedDescription: "Defeat 10 enemies.",
    category: "combat",
    icon: "✧",
    color: "#22d3ee",
    isEarned: totalAtLeast("totalEnemiesDefeated", 10),
  },
  {
    id: "enemies_50",
    name: "HALF CENTURY",
    title: "ORB ORATOR",
    description: "Defeat 50 enemies.",
    lockedDescription: "Defeat 50 enemies.",
    category: "combat",
    icon: "✧",
    color: "#38bdf8",
    isEarned: totalAtLeast("totalEnemiesDefeated", 50),
  },
  {
    id: "enemies_100",
    name: "CENTURION",
    title: "ONE HUNDRED EYES",
    description: "Defeat 100 enemies.",
    lockedDescription: "Defeat 100 enemies.",
    category: "combat",
    icon: "✧",
    color: "#60a5fa",
    isEarned: totalAtLeast("totalEnemiesDefeated", 100),
  },
  {
    id: "enemies_250",
    name: "QUARTER KILL",
    title: "SWARM TAX COLLECTOR",
    description: "Defeat 250 enemies.",
    lockedDescription: "Defeat 250 enemies.",
    category: "combat",
    icon: "✧",
    color: "#818cf8",
    isEarned: totalAtLeast("totalEnemiesDefeated", 250),
  },
  {
    id: "enemies_500",
    name: "FIVE HUNDRED CLUB",
    title: "ORBITAL LEGEND",
    description: "Defeat 500 enemies.",
    lockedDescription: "Defeat 500 enemies.",
    category: "combat",
    icon: "✧",
    color: "#a78bfa",
    isEarned: totalAtLeast("totalEnemiesDefeated", 500),
  },

  {
    id: "shots_100",
    name: "TRIGGER HAPPY",
    title: "QUICK ON THE DRAW",
    description: "Fire 100 shots.",
    lockedDescription: "Fire 100 shots.",
    category: "mastery",
    icon: "➤",
    color: "#f97316",
    isEarned: totalAtLeast("totalShotsFired", 100),
  },
  {
    id: "shots_500",
    name: "FULL SEND",
    title: "VOLLEY VIRTUOSO",
    description: "Fire 500 shots.",
    lockedDescription: "Fire 500 shots.",
    category: "mastery",
    icon: "➤",
    color: "#fb923c",
    isEarned: totalAtLeast("totalShotsFired", 500),
  },
  {
    id: "shots_1000",
    name: "LASER LITANY",
    title: "THOUSAND-ROUND POET",
    description: "Fire 1,000 shots.",
    lockedDescription: "Fire 1,000 shots.",
    category: "mastery",
    icon: "➤",
    color: "#facc15",
    isEarned: totalAtLeast("totalShotsFired", 1000),
  },
  {
    id: "shots_2500",
    name: "SHOT CALLER",
    title: "VOLLEY ROYALTY",
    description: "Fire 2,500 shots.",
    lockedDescription: "Fire 2,500 shots.",
    category: "mastery",
    icon: "➤",
    color: "#fde047",
    isEarned: totalAtLeast("totalShotsFired", 2500),
  },
  {
    id: "shots_5000",
    name: "STORM OF LEAD",
    title: "AMMO ASTRONAUT",
    description: "Fire 5,000 shots.",
    lockedDescription: "Fire 5,000 shots.",
    category: "mastery",
    icon: "➤",
    color: "#fef08a",
    isEarned: totalAtLeast("totalShotsFired", 5000),
  },

  {
    id: "hits_25",
    name: "CONTACT SPORT",
    title: "HITMAKER",
    description: "Land 25 hits.",
    lockedDescription: "Land 25 hits.",
    category: "mastery",
    icon: "●",
    color: "#34d399",
    isEarned: totalAtLeast("totalHits", 25),
  },
  {
    id: "hits_100",
    name: "MADE CONTACT",
    title: "CENTURY CLUB",
    description: "Land 100 hits.",
    lockedDescription: "Land 100 hits.",
    category: "mastery",
    icon: "●",
    color: "#2dd4bf",
    isEarned: totalAtLeast("totalHits", 100),
  },
  {
    id: "hits_250",
    name: "MAGNETIC PERSONALITY",
    title: "IMPACT ARTIST",
    description: "Land 250 hits.",
    lockedDescription: "Land 250 hits.",
    category: "mastery",
    icon: "●",
    color: "#22d3ee",
    isEarned: totalAtLeast("totalHits", 250),
  },

  {
    id: "arcade_cadet",
    name: "INSERT COIN",
    title: "ARCADE CADET",
    description: "Complete your first Arcade level.",
    lockedDescription: "Complete any Arcade level.",
    category: "arcade",
    icon: "▣",
    color: "#f472b6",
    isEarned: (result) => result.mode === "arcade" && result.completed,
  },
  {
    id: "arcade_11",
    name: "BABY STEPS, BIG ORBS",
    title: "TUTORIAL TYRANT",
    description: "Clear Arcade level 1.1.",
    lockedDescription: "Clear Arcade level 1.1.",
    category: "arcade",
    icon: "▣",
    color: "#f9a8d4",
    isEarned: arcadeLevelIs(1.1),
  },
  {
    id: "arcade_15",
    name: "FIVE-BY-FIVE",
    title: "CHECKPOINT CHAMP",
    description: "Clear Arcade level 1.5.",
    lockedDescription: "Clear Arcade level 1.5.",
    category: "arcade",
    icon: "▣",
    color: "#f9a8d4",
    isEarned: arcadeLevelIs(1.5),
  },
  {
    id: "arcade_19",
    name: "FIRST FIREWALL",
    title: "EMBER DIPLOMAT",
    description: "Clear Arcade level 1.9.",
    lockedDescription: "Clear Arcade level 1.9.",
    category: "arcade",
    icon: "▣",
    color: "#fb7185",
    isEarned: arcadeLevelIs(1.9),
  },
  {
    id: "arcade_29",
    name: "BOSS RUSHER",
    title: "SECOND-WORLD SOVEREIGN",
    description: "Clear Arcade level 2.9.",
    lockedDescription: "Clear Arcade level 2.9.",
    category: "arcade",
    icon: "▣",
    color: "#fbbf24",
    isEarned: arcadeLevelIs(2.9),
  },
  {
    id: "arcade_35",
    name: "HALFWAY HERO",
    title: "MIDNIGHT MARAUDER",
    description: "Clear Arcade level 3.5.",
    lockedDescription: "Clear Arcade level 3.5.",
    category: "arcade",
    icon: "▣",
    color: "#fb923c",
    isEarned: arcadeLevelIs(3.5),
  },
  {
    id: "arcade_39",
    name: "FIREWALL",
    title: "FLAMEWALKER",
    description: "Clear Arcade level 3.9.",
    lockedDescription: "Clear Arcade level 3.9.",
    category: "arcade",
    icon: "▣",
    color: "#f97316",
    isEarned: arcadeLevelIs(3.9),
  },
  {
    id: "arcade_49",
    name: "DEEP SPACE",
    title: "FOURTH-DIMENSION PILOT",
    description: "Clear Arcade level 4.9.",
    lockedDescription: "Clear Arcade level 4.9.",
    category: "arcade",
    icon: "▣",
    color: "#c084fc",
    isEarned: arcadeLevelIs(4.9),
  },
  {
    id: "arcade_55",
    name: "SECOND WIND",
    title: "FIFTH-WORLD PHANTOM",
    description: "Clear Arcade level 5.5.",
    lockedDescription: "Clear Arcade level 5.5.",
    category: "arcade",
    icon: "▣",
    color: "#a78bfa",
    isEarned: arcadeLevelIs(5.5),
  },
  {
    id: "arcade_59",
    name: "CROWN APPROACH",
    title: "FIFTH-WORLD ROYALTY",
    description: "Clear Arcade level 5.9.",
    lockedDescription: "Clear Arcade level 5.9.",
    category: "arcade",
    icon: "▣",
    color: "#818cf8",
    isEarned: arcadeLevelIs(5.9),
  },
  {
    id: "arcade_69",
    name: "SIX OF THE BEST",
    title: "SIXTH-SENSE ACE",
    description: "Clear Arcade level 6.9.",
    lockedDescription: "Clear Arcade level 6.9.",
    category: "arcade",
    icon: "▣",
    color: "#60a5fa",
    isEarned: arcadeLevelIs(6.9),
  },
  {
    id: "arcade_75",
    name: "LUCKY SEVEN",
    title: "SEVENTH-HEAVEN PILOT",
    description: "Clear Arcade level 7.5.",
    lockedDescription: "Clear Arcade level 7.5.",
    category: "arcade",
    icon: "▣",
    color: "#38bdf8",
    isEarned: arcadeLevelIs(7.5),
  },
  {
    id: "arcade_79",
    name: "SEVENTH HEAVEN",
    title: "SEVEN-WORLD SPECTER",
    description: "Clear Arcade level 7.9.",
    lockedDescription: "Clear Arcade level 7.9.",
    category: "arcade",
    icon: "▣",
    color: "#22d3ee",
    isEarned: arcadeLevelIs(7.9),
  },
  {
    id: "arcade_89",
    name: "THE PENULTIMATE",
    title: "EIGHT-BIT EMPEROR",
    description: "Clear Arcade level 8.9.",
    lockedDescription: "Clear Arcade level 8.9.",
    category: "arcade",
    icon: "▣",
    color: "#2dd4bf",
    isEarned: arcadeLevelIs(8.9),
  },
  {
    id: "arcade_91",
    name: "LAST LIGHT",
    title: "NINTH-WORLD NAVIGATOR",
    description: "Clear Arcade level 9.1.",
    lockedDescription: "Clear Arcade level 9.1.",
    category: "arcade",
    icon: "▣",
    color: "#34d399",
    isEarned: arcadeLevelIs(9.1),
  },
  {
    id: "arcade_95",
    name: "NINTH INNING",
    title: "FINAL-FIFTH FLYER",
    description: "Clear Arcade level 9.5.",
    lockedDescription: "Clear Arcade level 9.5.",
    category: "arcade",
    icon: "▣",
    color: "#4ade80",
    isEarned: arcadeLevelIs(9.5),
  },
  {
    id: "arcade_champion",
    name: "CREDITS ROLL",
    title: "ARCADE CHAMPION",
    description: "Complete the full Arcade campaign at level 9.9.",
    lockedDescription: "Clear Arcade level 9.9.",
    category: "arcade",
    icon: "★",
    color: "#facc15",
    isEarned: (result) => result.mode === "arcade" && result.completed && result.arcadeLevel.toFixed(1) === "9.9",
  },

  {
    id: "missions_1",
    name: "OPENING CREDITS",
    title: "MISSION MAKER",
    description: "Complete 1 level or run.",
    lockedDescription: "Complete 1 level or run.",
    category: "mastery",
    icon: "◇",
    color: "#c084fc",
    isEarned: totalAtLeast("totalCompletedResults", 1),
  },
  {
    id: "missions_10",
    name: "REPEAT CUSTOMER",
    title: "TEN-TIME TRAVELER",
    description: "Complete 10 levels or runs.",
    lockedDescription: "Complete 10 levels or runs.",
    category: "mastery",
    icon: "◇",
    color: "#a855f7",
    isEarned: totalAtLeast("totalCompletedResults", 10),
  },
  {
    id: "score_1000",
    name: "FOUR DIGITS",
    title: "COMMA CLUB",
    description: "Score 1,000 points in one result.",
    lockedDescription: "Score 1,000 points in one result.",
    category: "mastery",
    icon: "$",
    color: "#fbbf24",
    isEarned: (result) => result.score >= 1000,
  },
  {
    id: "score_5000",
    name: "HIGH ROLLER",
    title: "FIVE-K PILOT",
    description: "Score 5,000 points in one result.",
    lockedDescription: "Score 5,000 points in one result.",
    category: "mastery",
    icon: "$",
    color: "#f59e0b",
    isEarned: (result) => result.score >= 5000,
  },
  {
    id: "score_10000",
    name: "SCORE TO SETTLE",
    title: "THE HOUSE ALWAYS LOSES",
    description: "Score 10,000 points in one result.",
    lockedDescription: "Score 10,000 points in one result.",
    category: "mastery",
    icon: "$",
    color: "#fde047",
    isEarned: (result) => result.score >= 10000,
  },
];

const TROPHY_BY_ID = new Map(TROPHY_CATALOGUE.map((trophy) => [trophy.id, trophy]));

export function getTrophyDefinition(id: TrophyId): TrophyDefinition {
  return TROPHY_BY_ID.get(id)!;
}

export function createInitialTrophyLifetimeStats(): TrophyLifetimeStats {
  return {
    totalEnemiesDefeated: 0,
    totalShotsFired: 0,
    totalHits: 0,
    totalCompletedResults: 0,
    totalScore: 0,
    bossTypesDefeated: {},
    completedArcadeLevels: [],
    processedResultKeys: [],
  };
}

export function createInitialTrophyProgression(): TrophyProgressionState {
  return {
    unlockedTrophyIds: [],
    selectedTitle: null,
    lifetimeStats: createInitialTrophyLifetimeStats(),
  };
}

const finiteNonNegative = (value: unknown) => (
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
);

export function normalizeTrophyProgression(raw: unknown): TrophyProgressionState {
  const initial = createInitialTrophyProgression();
  if (!raw || typeof raw !== "object") return initial;
  const source = raw as Record<string, unknown>;
  const unlocked = Array.isArray(source.unlockedTrophyIds)
    ? source.unlockedTrophyIds.filter((id): id is TrophyId => typeof id === "string" && TROPHY_BY_ID.has(id as TrophyId))
    : [];
  initial.unlockedTrophyIds = [...new Set(unlocked)];

  const lifetime = source.lifetimeStats && typeof source.lifetimeStats === "object"
    ? source.lifetimeStats as Record<string, unknown>
    : {};
  const rawBosses = lifetime.bossTypesDefeated && typeof lifetime.bossTypesDefeated === "object"
    ? lifetime.bossTypesDefeated as Record<string, unknown>
    : {};
  const bossTypesDefeated: Partial<Record<GameplayBossType, number>> = {};
  for (const bossType of ["bird", "star", "arrow", "triangle", "trapezoid", "cube", "cloud", "circle", "tentacle", "monster"] as GameplayBossType[]) {
    const count = finiteNonNegative(rawBosses[bossType]);
    if (count > 0) bossTypesDefeated[bossType] = Math.floor(count);
  }
  const completedArcadeLevels = Array.isArray(lifetime.completedArcadeLevels)
    ? [...new Set(lifetime.completedArcadeLevels.filter((level): level is string => typeof level === "string"))]
    : [];
  const processedResultKeys = Array.isArray(lifetime.processedResultKeys)
    ? [...new Set(lifetime.processedResultKeys.filter((key): key is string => typeof key === "string"))].slice(-256)
    : [];
  initial.lifetimeStats = {
    totalEnemiesDefeated: Math.floor(finiteNonNegative(lifetime.totalEnemiesDefeated)),
    totalShotsFired: Math.floor(finiteNonNegative(lifetime.totalShotsFired)),
    totalHits: Math.floor(finiteNonNegative(lifetime.totalHits)),
    totalCompletedResults: Math.floor(finiteNonNegative(lifetime.totalCompletedResults)),
    totalScore: Math.floor(finiteNonNegative(lifetime.totalScore)),
    bossTypesDefeated,
    completedArcadeLevels,
    processedResultKeys,
  };

  const selectedTitle = source.selectedTitle;
  initial.selectedTitle = typeof selectedTitle === "string"
    && TROPHY_BY_ID.has(selectedTitle as TrophyId)
    && initial.unlockedTrophyIds.includes(selectedTitle as TrophyId)
    ? selectedTitle as TrophyId
    : null;
  return initial;
}

export function createTrophyResultKey(result: GameplayResultSnapshot): string {
  const stats = result.stats;
  return [
    result.mode,
    result.arcadeLevel.toFixed(1),
    result.completed ? "complete" : "failed",
    result.score,
    result.elapsedSeconds.toFixed(2),
    stats.shotsFired,
    stats.hits,
    stats.enemiesDefeated,
    stats.bossesDefeated,
    JSON.stringify(Object.entries(stats.bossTypesDefeated ?? {}).sort(([a], [b]) => a.localeCompare(b))),
  ].join(":");
}

function advanceLifetimeStats(
  lifetime: TrophyLifetimeStats,
  result: GameplayResultSnapshot,
): TrophyLifetimeStats {
  const resultKey = createTrophyResultKey(result);
  if (lifetime.processedResultKeys.includes(resultKey)) return lifetime;
  const bossTypesDefeated = { ...lifetime.bossTypesDefeated };
  for (const [bossType, count] of Object.entries(result.stats.bossTypesDefeated ?? {})) {
    if (typeof count !== "number" || count <= 0) continue;
    const key = bossType as GameplayBossType;
    bossTypesDefeated[key] = (bossTypesDefeated[key] ?? 0) + Math.floor(count);
  }
  const completedArcadeLevels = [...lifetime.completedArcadeLevels];
  if (result.mode === "arcade" && result.completed) {
    const level = result.arcadeLevel.toFixed(1);
    if (!completedArcadeLevels.includes(level)) completedArcadeLevels.push(level);
  }
  return {
    totalEnemiesDefeated: lifetime.totalEnemiesDefeated + result.stats.enemiesDefeated,
    totalShotsFired: lifetime.totalShotsFired + result.stats.shotsFired,
    totalHits: lifetime.totalHits + result.stats.hits,
    totalCompletedResults: lifetime.totalCompletedResults + (result.completed ? 1 : 0),
    totalScore: lifetime.totalScore + result.score,
    bossTypesDefeated,
    completedArcadeLevels,
    processedResultKeys: [...lifetime.processedResultKeys, resultKey].slice(-256),
  };
}

export function evaluateTrophyCriteria(
  result: GameplayResultSnapshot,
  lifetime = createInitialTrophyLifetimeStats(),
): TrophyId[] {
  return TROPHY_CATALOGUE
    .filter((trophy) => trophy.isEarned(result, lifetime))
    .map((trophy) => trophy.id);
}

export function toTrophyUnlock(trophy: TrophyDefinition): TrophyUnlock {
  return {
    id: trophy.id,
    name: trophy.name,
    title: trophy.title,
    description: trophy.description,
    category: trophy.category,
    icon: trophy.icon,
    color: trophy.color,
  };
}

export function applyTrophyResult(
  state: TrophyProgressionState,
  result: GameplayResultSnapshot,
): { state: TrophyProgressionState; newlyUnlocked: TrophyUnlock[] } {
  const lifetimeStats = advanceLifetimeStats(state.lifetimeStats, result);
  const unlocked = new Set(state.unlockedTrophyIds);
  const newlyUnlocked = evaluateTrophyCriteria(result, lifetimeStats)
    .filter((id) => !unlocked.has(id))
    .map((id) => {
      unlocked.add(id);
      return toTrophyUnlock(getTrophyDefinition(id));
    });
  return {
    state: {
      unlockedTrophyIds: [...unlocked],
      selectedTitle: state.selectedTitle && unlocked.has(state.selectedTitle)
        ? state.selectedTitle
        : null,
      lifetimeStats,
    },
    newlyUnlocked,
  };
}