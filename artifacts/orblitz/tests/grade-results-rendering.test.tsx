import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GradeResults } from "../src/components/ui/GradeResults";
import { createInitialGameplayStats, evaluateGameplayGrade } from "../src/game-runtime/GameplayGrades";

describe("GradeResults rendering", () => {
  it("renders nothing before a result snapshot exists", () => {
    expect(renderToStaticMarkup(<GradeResults result={null} />)).toBe("");
  });

  it("renders the overall grade and all category details", () => {
    const result = evaluateGameplayGrade(createInitialGameplayStats("survival", 3));
    const markup = renderToStaticMarkup(<GradeResults result={result} />);
    expect(markup).toContain("Gameplay grade");
    expect(markup).toContain("Accuracy");
    expect(markup).toContain("Damage control");
    expect(markup).toContain("Time survived");
    expect(markup).toContain("No admitted shots");
  });
});