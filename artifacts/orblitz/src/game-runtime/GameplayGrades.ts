import type { GameMode } from "@/lib/stores/useMagicOrb";

export type GameplayGrade = "S" | "A" | "B" | "C" | "D";
export type GradeCategoryId = "accuracy" | "damageControl" | "combatObjective" | "time";

export interface GameplayStats {
  mode: GameMode;
  arcadeLevel: number;
  shotsFired: number;
  hits: number;
  misses: number;
  enemiesDefeated: number;
  bossesDefeated: number;
  damageTaken: number;
  startingHealth: number;
  remainingHealth: number;
  elapsedSeconds: number;
  objectiveProgress: number;
  objectiveTarget: number;
  score: number;
  completed: boolean;
}

export interface GradeCategoryResult {
  id: GradeCategoryId;
  label: string;
  rawValue: number;
  rawLabel: string;
  normalizedScore: number;
  grade: GameplayGrade;
  explanation: string;
}

export interface GameplayResultSnapshot {
  mode: GameMode;
  arcadeLevel: number;
  completed: boolean;
  score: number;
  elapsedSeconds: number;
  overallScore: number;
  overallGrade: GameplayGrade;
  categories: GradeCategoryResult[];
  stats: GameplayStats;
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

export function gradeForScore(score: number): GameplayGrade {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

export function createInitialGameplayStats(
  mode: GameMode,
  startingHealth: number,
  arcadeLevel = 1.1,
): GameplayStats {
  return {
    mode,
    arcadeLevel,
    shotsFired: 0,
    hits: 0,
    misses: 0,
    enemiesDefeated: 0,
    bossesDefeated: 0,
    damageTaken: 0,
    startingHealth,
    remainingHealth: startingHealth,
    elapsedSeconds: 0,
    objectiveProgress: 0,
    objectiveTarget: 0,
    score: 0,
    completed: false,
  };
}

function getAccuracyCategory(stats: GameplayStats): GradeCategoryResult {
  const shots = Math.max(0, stats.shotsFired);
  const hits = Math.max(0, Math.min(shots, stats.hits));
  const accuracy = shots > 0 ? clampPercent((hits / shots) * 100) : 0;
  const rawLabel = shots > 0 ? `${hits}/${shots} admitted shots` : "No admitted shots";
  return {
    id: "accuracy",
    label: "Accuracy",
    rawValue: accuracy,
    rawLabel,
    normalizedScore: accuracy,
    grade: gradeForScore(accuracy),
    explanation: shots > 0
      ? `${Math.round(accuracy)}% of admitted shots connected.`
      : "No shots were admitted during this result.",
  };
}

function getDamageCategory(stats: GameplayStats): GradeCategoryResult {
  const startingHealth = Math.max(1, stats.startingHealth);
  const damageScore = clampPercent(100 - (Math.max(0, stats.damageTaken) / startingHealth) * 100);
  return {
    id: "damageControl",
    label: "Damage control",
    rawValue: Math.max(0, stats.damageTaken),
    rawLabel: `${Math.max(0, stats.damageTaken)} health lost`,
    normalizedScore: damageScore,
    grade: gradeForScore(damageScore),
    explanation: stats.damageTaken === 0
      ? "Untouched run: every starting health point was preserved."
      : `${Math.max(0, stats.damageTaken)} health point${stats.damageTaken === 1 ? "" : "s"} lost from ${startingHealth}.`,
  };
}

function getCombatCategory(stats: GameplayStats): GradeCategoryResult {
  if (stats.mode === "arcade") {
    const target = Math.max(0, stats.objectiveTarget);
    const progress = Math.max(0, stats.objectiveProgress);
    const normalizedScore = target > 0 ? clampPercent((progress / target) * 100) : 0;
    return {
      id: "combatObjective",
      label: "Level objective",
      rawValue: progress,
      rawLabel: target > 0 ? `${progress}/${target} objective progress` : "Objective unavailable",
      normalizedScore,
      grade: gradeForScore(normalizedScore),
      explanation: target > 0
        ? `${progress} of ${target} required targets were defeated.`
        : "This level did not expose an objective count.",
    };
  }

  const defeats = Math.max(0, stats.enemiesDefeated) + Math.max(0, stats.bossesDefeated) * 5;
  const normalizedScore = clampPercent((defeats / 20) * 100);
  return {
    id: "combatObjective",
    label: "Combat",
    rawValue: Math.max(0, stats.enemiesDefeated),
    rawLabel: `${Math.max(0, stats.enemiesDefeated)} enemies${stats.bossesDefeated > 0 ? `, ${stats.bossesDefeated} boss` : ""}`,
    normalizedScore,
    grade: gradeForScore(normalizedScore),
    explanation: stats.mode === "gauntlet"
      ? `${Math.max(0, stats.enemiesDefeated)} enemies and ${Math.max(0, stats.bossesDefeated)} bosses defeated.`
      : `${Math.max(0, stats.enemiesDefeated)} enemies defeated while surviving.`,
  };
}

function getTimeCategory(stats: GameplayStats): GradeCategoryResult {
  const elapsed = Math.max(0, stats.elapsedSeconds);
  if (stats.mode === "arcade") {
    const targetSeconds = Math.max(12, Math.max(1, stats.objectiveTarget) * 1.25);
    const normalizedScore = clampPercent(100 - Math.max(0, elapsed - targetSeconds) / targetSeconds * 100);
    return {
      id: "time",
      label: "Clear speed",
      rawValue: elapsed,
      rawLabel: `${elapsed.toFixed(1)}s to finish`,
      normalizedScore,
      grade: gradeForScore(normalizedScore),
      explanation: `Level clear speed is measured against a ${targetSeconds.toFixed(1)} second reference.`,
    };
  }

  const normalizedScore = clampPercent((elapsed / 60) * 100);
  return {
    id: "time",
    label: "Time survived",
    rawValue: elapsed,
    rawLabel: `${elapsed.toFixed(1)}s survived`,
    normalizedScore,
    grade: gradeForScore(normalizedScore),
    explanation: "Longer survival earns a stronger time grade, with 60 seconds reaching the top band.",
  };
}

export function evaluateGameplayGrade(input: GameplayStats): GameplayResultSnapshot {
  const stats: GameplayStats = {
    ...input,
    shotsFired: Math.max(0, Math.floor(input.shotsFired)),
    hits: Math.max(0, Math.floor(input.hits)),
    misses: Math.max(0, Math.floor(input.misses)),
    enemiesDefeated: Math.max(0, Math.floor(input.enemiesDefeated)),
    bossesDefeated: Math.max(0, Math.floor(input.bossesDefeated)),
    damageTaken: Math.max(0, Math.floor(input.damageTaken)),
    elapsedSeconds: Math.max(0, input.elapsedSeconds),
    objectiveProgress: Math.max(0, Math.floor(input.objectiveProgress)),
    objectiveTarget: Math.max(0, Math.floor(input.objectiveTarget)),
    score: Math.max(0, Math.floor(input.score)),
  };
  const categories = [
    getAccuracyCategory(stats),
    getDamageCategory(stats),
    getCombatCategory(stats),
    getTimeCategory(stats),
  ];
  const overallScore = Math.round(
    categories.reduce((total, category) => total + category.normalizedScore, 0) / categories.length,
  );
  const snapshot: GameplayResultSnapshot = {
    mode: stats.mode,
    arcadeLevel: stats.arcadeLevel,
    completed: stats.completed,
    score: stats.score,
    elapsedSeconds: stats.elapsedSeconds,
    overallScore,
    overallGrade: gradeForScore(overallScore),
    categories,
    stats,
  };
  Object.freeze(snapshot.stats);
  for (const category of snapshot.categories) Object.freeze(category);
  Object.freeze(snapshot.categories);
  return Object.freeze(snapshot);
}