import { afterEach, describe, expect, it } from "vitest";
import {
  applyTrophyResult,
  createInitialTrophyProgression,
  evaluateTrophyCriteria,
  normalizeTrophyProgression,
  TROPHY_CATALOGUE,
} from "../src/game-runtime/TrophyProgression";
import {
  createInitialGameplayStats,
  evaluateGameplayGrade,
} from "../src/game-runtime/GameplayGrades";
import { useShop } from "../src/lib/stores/useShop";

function makeResult(
  patch: Partial<ReturnType<typeof createInitialGameplayStats>>,
  completed = false,
) {
  const stats = {
    ...createInitialGameplayStats("survival", 3),
    shotsFired: 10,
    hits: 9,
    ...patch,
    completed,
  };
  return evaluateGameplayGrade(stats);
}

describe("trophy progression", () => {
  const originalTrophyProgression = useShop.getState().trophyProgression;

  afterEach(() => {
    useShop.setState({ trophyProgression: originalTrophyProgression });
  });

  it("evaluates each initial milestone from immutable result data", () => {
    expect(evaluateTrophyCriteria(makeResult({ enemiesDefeated: 1 }))).toContain("first_blood");
    expect(evaluateTrophyCriteria(makeResult({ shotsFired: 10, hits: 9 }))).toContain("deadeye");
    expect(evaluateTrophyCriteria(makeResult({ damageTaken: 0 }, true))).toContain("untouchable");
    expect(evaluateTrophyCriteria(makeResult({ bossesDefeated: 1 }))).toContain("boss_breaker");
    expect(evaluateTrophyCriteria(makeResult({ elapsedSeconds: 300 }))).toContain("survivor");
    expect(evaluateTrophyCriteria(makeResult({ elapsedSeconds: 600 }))).toContain("void_veteran");
    expect(evaluateTrophyCriteria(makeResult({
      mode: "arcade",
      arcadeLevel: 1.1,
      objectiveTarget: 15,
      objectiveProgress: 15,
    }, true))).toContain("arcade_cadet");
    expect(evaluateTrophyCriteria(makeResult({
      mode: "arcade",
      arcadeLevel: 9.9,
      objectiveTarget: 1,
      objectiveProgress: 1,
    }, true))).toEqual(expect.arrayContaining(["arcade_cadet", "arcade_champion"]));
  });

  it("requires meaningful accuracy and completion states", () => {
    expect(evaluateTrophyCriteria(makeResult({ shotsFired: 9, hits: 9 }))).not.toContain("deadeye");
    expect(evaluateTrophyCriteria(makeResult({ shotsFired: 10, hits: 8 }))).not.toContain("deadeye");
    expect(evaluateTrophyCriteria(makeResult({ damageTaken: 0 }, false))).not.toContain("untouchable");
    expect(evaluateTrophyCriteria(makeResult({ mode: "chill", elapsedSeconds: 600 }))).not.toContain("void_veteran");
  });

  it("unlocks each trophy once and returns presentation-safe payloads", () => {
    const result = makeResult({ shotsFired: 0, hits: 0, enemiesDefeated: 1 }, true);
    const first = applyTrophyResult(createInitialTrophyProgression(), result);
    const second = applyTrophyResult(first.state, result);

    expect(first.newlyUnlocked.map((trophy) => trophy.id)).toEqual(["first_blood", "untouchable"]);
    expect(first.newlyUnlocked[0]).toMatchObject({
      name: TROPHY_CATALOGUE[0].name,
      title: TROPHY_CATALOGUE[0].title,
    });
    expect(second.newlyUnlocked).toEqual([]);
    expect(second.state.unlockedTrophyIds).toEqual(first.state.unlockedTrophyIds);
  });

  it("migrates invalid and duplicate collection state defensively", () => {
    expect(normalizeTrophyProgression({
      unlockedTrophyIds: ["deadeye", "deadeye", "missing", 42],
      selectedTitle: "deadeye",
    })).toEqual({
      unlockedTrophyIds: ["deadeye"],
      selectedTitle: "deadeye",
    });
    expect(normalizeTrophyProgression({
      unlockedTrophyIds: [],
      selectedTitle: "deadeye",
    }).selectedTitle).toBeNull();
  });

  it("updates the persisted collection through the store and guards locked titles", () => {
    useShop.setState({ trophyProgression: createInitialTrophyProgression() });
    const result = makeResult({ shotsFired: 0, hits: 0, enemiesDefeated: 1 }, true);
    const newlyUnlocked = useShop.getState().recordTrophyResult(result);

    expect(newlyUnlocked.map((trophy) => trophy.id)).toEqual(["first_blood", "untouchable"]);
    useShop.getState().setSelectedTitle("first_blood");
    expect(useShop.getState().trophyProgression.selectedTitle).toBe("first_blood");
    useShop.getState().setSelectedTitle("deadeye");
    expect(useShop.getState().trophyProgression.selectedTitle).toBe("first_blood");
  });
});