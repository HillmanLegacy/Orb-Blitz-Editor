import type { GameplayResultSnapshot } from "./GameplayGrades";

export type TrophyId =
  | "first_blood"
  | "deadeye"
  | "untouchable"
  | "boss_breaker"
  | "survivor"
  | "void_veteran"
  | "arcade_cadet"
  | "arcade_champion";

export type TrophyCategory = "combat" | "mastery" | "survival" | "arcade";

export interface TrophyDefinition {
  id: TrophyId;
  name: string;
  title: string;
  description: string;
  lockedDescription: string;
  category: TrophyCategory;
  icon: string;
  color: string;
  isEarned: (result: GameplayResultSnapshot) => boolean;
}

export interface TrophyProgressionState {
  unlockedTrophyIds: TrophyId[];
  selectedTitle: TrophyId | null;
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

export const TROPHY_CATALOGUE: readonly TrophyDefinition[] = [
  {
    id: "first_blood",
    name: "FIRST SIGNAL",
    title: "ORBITAL INITIATE",
    description: "Defeat your first enemy.",
    lockedDescription: "Defeat an enemy in any mode.",
    category: "combat",
    icon: "✦",
    color: "#22d3ee",
    isEarned: (result) => result.stats.enemiesDefeated >= 1,
  },
  {
    id: "deadeye",
    name: "DEAD-EYE",
    title: "DEAD-EYE",
    description: "Finish a result with at least 90% accuracy.",
    lockedDescription: "Land at least 90% of 10 admitted shots in one result.",
    category: "mastery",
    icon: "◎",
    color: "#a78bfa",
    isEarned: (result) => accuracyAtLeast(result, 0.9),
  },
  {
    id: "untouchable",
    name: "UNTOUCHABLE",
    title: "UNTOUCHABLE",
    description: "Complete a level or run without taking damage.",
    lockedDescription: "Complete any level or run with zero damage taken.",
    category: "mastery",
    icon: "◇",
    color: "#fbbf24",
    isEarned: (result) => result.completed && result.stats.damageTaken === 0,
  },
  {
    id: "boss_breaker",
    name: "BOSS BREAKER",
    title: "BOSS BREAKER",
    description: "Defeat a boss.",
    lockedDescription: "Defeat a boss in Arcade, Survival, or Gauntlet.",
    category: "combat",
    icon: "◆",
    color: "#fb7185",
    isEarned: (result) => result.stats.bossesDefeated >= 1,
  },
  {
    id: "survivor",
    name: "LONG HAUL",
    title: "ENDURANCE PILOT",
    description: "Survive for five minutes.",
    lockedDescription: "Survive 5:00 in Survival mode.",
    category: "survival",
    icon: "◌",
    color: "#34d399",
    isEarned: (result) => result.mode === "survival" && result.stats.elapsedSeconds >= 300,
  },
  {
    id: "void_veteran",
    name: "VOID VETERAN",
    title: "VOID VETERAN",
    description: "Survive for ten minutes.",
    lockedDescription: "Survive 10:00 in Survival mode.",
    category: "survival",
    icon: "◉",
    color: "#60a5fa",
    isEarned: (result) => result.mode === "survival" && result.stats.elapsedSeconds >= 600,
  },
  {
    id: "arcade_cadet",
    name: "ARCADE CADET",
    title: "ARCADE CADET",
    description: "Complete your first Arcade level.",
    lockedDescription: "Complete any Arcade level.",
    category: "arcade",
    icon: "▣",
    color: "#f472b6",
    isEarned: (result) => result.mode === "arcade" && result.completed,
  },
  {
    id: "arcade_champion",
    name: "ARCADE CHAMPION",
    title: "ARCADE CHAMPION",
    description: "Complete the full nine-world Arcade campaign.",
    lockedDescription: "Complete Arcade level 9.9.",
    category: "arcade",
    icon: "★",
    color: "#facc15",
    isEarned: (result) => result.mode === "arcade" && result.completed && result.arcadeLevel >= 9.9,
  },
];

const TROPHY_BY_ID = new Map(TROPHY_CATALOGUE.map((trophy) => [trophy.id, trophy]));

export function getTrophyDefinition(id: TrophyId): TrophyDefinition {
  return TROPHY_BY_ID.get(id)!;
}

export function createInitialTrophyProgression(): TrophyProgressionState {
  return {
    unlockedTrophyIds: [],
    selectedTitle: null,
  };
}

export function normalizeTrophyProgression(raw: unknown): TrophyProgressionState {
  const initial = createInitialTrophyProgression();
  if (!raw || typeof raw !== "object") return initial;
  const source = raw as Record<string, unknown>;
  const unlocked = Array.isArray(source.unlockedTrophyIds)
    ? source.unlockedTrophyIds.filter((id): id is TrophyId => typeof id === "string" && TROPHY_BY_ID.has(id as TrophyId))
    : [];
  initial.unlockedTrophyIds = [...new Set(unlocked)];
  const selectedTitle = source.selectedTitle;
  initial.selectedTitle = typeof selectedTitle === "string"
    && TROPHY_BY_ID.has(selectedTitle as TrophyId)
    && initial.unlockedTrophyIds.includes(selectedTitle as TrophyId)
    ? selectedTitle as TrophyId
    : null;
  return initial;
}

export function evaluateTrophyCriteria(result: GameplayResultSnapshot): TrophyId[] {
  return TROPHY_CATALOGUE
    .filter((trophy) => trophy.isEarned(result))
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
  const unlocked = new Set(state.unlockedTrophyIds);
  const newlyUnlocked = evaluateTrophyCriteria(result)
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
    },
    newlyUnlocked,
  };
}