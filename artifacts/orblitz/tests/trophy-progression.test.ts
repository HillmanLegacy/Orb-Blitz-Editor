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

  it("contains exactly 50 uniquely identified trophies", () => {
    const ids = TROPHY_CATALOGUE.map((trophy) => trophy.id);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
    expect(new Set(TROPHY_CATALOGUE.map((trophy) => trophy.name)).size).toBe(50);
    expect(new Set(TROPHY_CATALOGUE.map((trophy) => trophy.title)).size).toBe(50);
    expect(TROPHY_CATALOGUE.every((trophy) => trophy.name.length > 0 && trophy.title.length > 0 && trophy.lockedDescription.length > 0)).toBe(true);
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

  it("evaluates boss-specific and level-specific milestones", () => {
    const bossResult = makeResult({
      bossesDefeated: 1,
      bossTypesDefeated: { circle: 1 },
    });
    expect(applyTrophyResult(createInitialTrophyProgression(), bossResult).newlyUnlocked.map((trophy) => trophy.id)).toContain("boss_circle");
    const levelResult = makeResult({
      mode: "arcade",
      arcadeLevel: 1.9,
      objectiveTarget: 15,
      objectiveProgress: 15,
    }, true);
    expect(applyTrophyResult(createInitialTrophyProgression(), levelResult).newlyUnlocked.map((trophy) => trophy.id)).toEqual(
      expect.arrayContaining(["arcade_cadet", "arcade_19", "missions_1"]),
    );
  });

  it("builds general milestones from cumulative result boundaries", () => {
    const first = applyTrophyResult(
      createInitialTrophyProgression(),
      makeResult({ enemiesDefeated: 6, shotsFired: 60, hits: 25 }),
    );
    const second = applyTrophyResult(
      first.state,
      makeResult({ enemiesDefeated: 4, shotsFired: 40, hits: 0 }),
    );

    expect(second.state.lifetimeStats).toMatchObject({
      totalEnemiesDefeated: 10,
      totalShotsFired: 100,
      totalHits: 25,
    });
    expect(first.newlyUnlocked.map((trophy) => trophy.id)).toContain("hits_25");
    expect(second.newlyUnlocked.map((trophy) => trophy.id)).toEqual(
      expect.arrayContaining(["enemies_10", "shots_100"]),
    );
    const duplicate = applyTrophyResult(second.state, makeResult({ enemiesDefeated: 4, shotsFired: 40, hits: 0 }));
    expect(duplicate.state.lifetimeStats).toEqual(second.state.lifetimeStats);
    expect(duplicate.newlyUnlocked).toEqual([]);
  });

  it("unlocks each trophy once and returns presentation-safe payloads", () => {
    const result = makeResult({ shotsFired: 0, hits: 0, enemiesDefeated: 1 }, true);
    const first = applyTrophyResult(createInitialTrophyProgression(), result);
    const second = applyTrophyResult(first.state, result);

    expect(first.newlyUnlocked.map((trophy) => trophy.id)).toEqual(["first_blood", "untouchable", "missions_1"]);
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
    })).toEqual(expect.objectContaining({
      unlockedTrophyIds: ["deadeye"],
      selectedTitle: "deadeye",
      lifetimeStats: expect.objectContaining({
        totalEnemiesDefeated: 0,
        processedResultKeys: [],
      }),
    }));
    expect(normalizeTrophyProgression({
      unlockedTrophyIds: [],
      selectedTitle: "deadeye",
    }).selectedTitle).toBeNull();
  });

  it("updates the persisted collection through the store and guards locked titles", () => {
    useShop.setState({ trophyProgression: createInitialTrophyProgression() });
    const result = makeResult({ shotsFired: 0, hits: 0, enemiesDefeated: 1 }, true);
    const newlyUnlocked = useShop.getState().recordTrophyResult(result);

    expect(newlyUnlocked.map((trophy) => trophy.id)).toEqual(["first_blood", "untouchable", "missions_1"]);
    useShop.getState().setSelectedTitle("first_blood");
    expect(useShop.getState().trophyProgression.selectedTitle).toBe("first_blood");
    useShop.getState().setSelectedTitle("deadeye");
    expect(useShop.getState().trophyProgression.selectedTitle).toBe("first_blood");
  });
});