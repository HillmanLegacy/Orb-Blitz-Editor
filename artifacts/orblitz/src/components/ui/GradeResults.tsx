import { motion } from "framer-motion";
import type { GameplayGrade, GameplayResultSnapshot } from "@/game-runtime/GameplayGrades";

const GRADE_COLORS: Record<GameplayGrade, string> = {
  S: "#facc15",
  A: "#22d3ee",
  B: "#a78bfa",
  C: "#fb923c",
  D: "#fb7185",
};

function formatRawValue(id: string, value: number): string {
  if (id === "accuracy") return `${Math.round(value)}%`;
  if (id === "time") return `${value.toFixed(1)}s`;
  return String(Math.round(value));
}

export function GradeResults({ result }: { result: GameplayResultSnapshot | null }) {
  if (!result) return null;
  const gradeColor = GRADE_COLORS[result.overallGrade];

  return (
    <motion.section
      aria-label="Gameplay grade results"
      className="w-full rounded-2xl p-3 md:p-4"
      style={{
        background: "linear-gradient(145deg,rgba(0,255,255,0.07),rgba(170,0,255,0.08))",
        border: `1px solid ${gradeColor}44`,
        boxShadow: `0 0 24px ${gradeColor}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.35 }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="font-black uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.46)", fontSize: "0.58rem" }}>
            Gameplay grade
          </p>
          <p className="font-semibold" style={{ color: "rgba(255,255,255,0.62)", fontSize: "0.68rem" }}>
            Based on play, not score alone
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-black" style={{ color: gradeColor, fontSize: "2rem", lineHeight: 1, textShadow: `0 0 16px ${gradeColor}99` }}>
            {result.overallGrade}
          </span>
          <span className="font-black" style={{ color: gradeColor, fontSize: "0.72rem" }}>
            {result.overallScore}/100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {result.categories.map((category) => {
          const color = GRADE_COLORS[category.grade];
          return (
            <div key={category.id} className="rounded-xl px-2.5 py-2" style={{ background: "rgba(0,0,0,0.28)", border: `1px solid ${color}24` }}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.53rem" }}>
                  {category.label}
                </span>
                <span className="font-black" style={{ color, fontSize: "0.8rem" }}>{category.grade}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="font-black" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.85rem" }}>
                  {formatRawValue(category.id, category.rawValue)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.56rem" }}>
                  {Math.round(category.normalizedScore)}/100
                </span>
              </div>
              <p className="mt-1" style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.55rem", lineHeight: 1.25 }}>
                {category.rawLabel}
              </p>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}