import { describe, expect, it } from "vitest";
import {
  createInitialGameplayStats,
  evaluateGameplayGrade,
  gradeForScore,
  type GameplayStats,
} from "../src/game-runtime/GameplayGrades";

function stats(overrides: Partial<GameplayStats> = {}): GameplayStats {
  return {
    ...createInitialGameplayStats("survival", 3),
    ...overrides,
  };
}

describe("gameplay grade engine", () => {
  it("uses the documented grade boundaries", () => {
    expect(gradeForScore(95)).toBe("S");
    expect(gradeForScore(85)).toBe("A");
    expect(gradeForScore(70)).toBe("B");
    expect(gradeForScore(50)).toBe("C");
    expect(gradeForScore(49.99)).toBe("D");
  });

  it("handles a zero-action run without NaN or inflated accuracy", () => {
    const result = evaluateGameplayGrade(stats({ elapsedSeconds: 8 }));
    const accuracy = result.categories.find((category) => category.id === "accuracy");
    expect(accuracy?.normalizedScore).toBe(0);
    expect(accuracy?.rawLabel).toBe("No admitted shots");
    expect(Number.isNaN(result.overallScore)).toBe(false);
    expect(result.overallGrade).toBe("D");
  });

  it("grades arcade objective progress and clear speed separately", () => {
    const result = evaluateGameplayGrade(stats({
      mode: "arcade",
      arcadeLevel: 2.4,
      shotsFired: 10,
      hits: 9,
      elapsedSeconds: 14,
      objectiveProgress: 20,
      objectiveTarget: 20,
      completed: true,
    }));
    expect(result.categories.find((category) => category.id === "combatObjective")?.normalizedScore).toBe(100);
    expect(result.categories.find((category) => category.id === "accuracy")?.normalizedScore).toBe(90);
    expect(result.categories.find((category) => category.id === "time")?.rawValue).toBe(14);
    expect(result.completed).toBe(true);
  });

  it("uses survival time and combat defeats for non-arcade results", () => {
    const result = evaluateGameplayGrade(stats({
      mode: "gauntlet",
      shotsFired: 4,
      hits: 2,
      misses: 2,
      enemiesDefeated: 10,
      bossesDefeated: 1,
      elapsedSeconds: 30,
    }));
    const combat = result.categories.find((category) => category.id === "combatObjective");
    const time = result.categories.find((category) => category.id === "time");
    expect(combat?.rawLabel).toContain("10 enemies");
    expect(combat?.normalizedScore).toBe(75);
    expect(time?.label).toBe("Time survived");
    expect(time?.normalizedScore).toBe(50);
  });

  it("returns a serializable immutable snapshot shape", () => {
    const input = stats({ shotsFired: 2, hits: 2, score: 240 });
    const result = evaluateGameplayGrade(input);
    const serialized = JSON.parse(JSON.stringify(result));
    expect(serialized).toEqual(result);
    input.score = 9999;
    expect(result.score).toBe(240);
  });
});