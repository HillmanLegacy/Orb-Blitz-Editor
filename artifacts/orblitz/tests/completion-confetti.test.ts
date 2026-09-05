import { describe, expect, it } from "vitest";
import {
  COMPLETION_CONFETTI_COUNTS,
  COMPLETION_CONFETTI_MAX_LIFETIME_SECONDS,
  createCompletionConfettiPieces,
} from "../src/components/ui/CompletionConfetti";

describe("completion confetti", () => {
  it("creates deterministic bounded normal and boss celebrations", () => {
    const levelPieces = createCompletionConfettiPieces("level");
    const bossPieces = createCompletionConfettiPieces("boss");

    expect(levelPieces).toHaveLength(COMPLETION_CONFETTI_COUNTS.level);
    expect(bossPieces).toHaveLength(COMPLETION_CONFETTI_COUNTS.boss);
    expect(createCompletionConfettiPieces("level")).toEqual(levelPieces);
    expect(createCompletionConfettiPieces("boss")).toEqual(bossPieces);
    expect(bossPieces.length).toBeGreaterThan(levelPieces.length);
  });

  it("keeps every piece inside the configured motion and size budgets", () => {
    for (const variant of ["level", "boss"] as const) {
      for (const piece of createCompletionConfettiPieces(variant)) {
        expect(piece.left).toMatch(/^(?:\d|[1-9]\d)%$/);
        expect(piece.width).toBeGreaterThanOrEqual(4);
        expect(piece.width).toBeLessThanOrEqual(9);
        expect(piece.height).toBeGreaterThanOrEqual(7);
        expect(piece.height).toBeLessThanOrEqual(16);
        expect(piece.delay + piece.duration).toBeLessThanOrEqual(
          COMPLETION_CONFETTI_MAX_LIFETIME_SECONDS,
        );
      }
    }
  });
});