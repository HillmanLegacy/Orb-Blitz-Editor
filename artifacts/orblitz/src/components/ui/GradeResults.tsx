import { motion } from "framer-motion";
import type { GameplayGrade, GameplayResultSnapshot } from "@/game-runtime/GameplayGrades";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { getWeaponProgress } from "@/game-runtime/WeaponProgression";

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
  const weaponReward = useMagicOrb((state) => state.lastWeaponProgression);
  const weaponProgression = useShop((state) => state.weaponProgression);
  const weaponProgress = weaponReward ? getWeaponProgress(weaponProgression[weaponReward.weapon]) : null;
  if (!result) return null;
  const gradeColor = GRADE_COLORS[result.overallGrade];

  return (
    <motion.section
      aria-label="Gameplay grade results"
      className="orblitz-grade-results w-full rounded-2xl p-2.5 md:p-3"
      style={{
        background: "linear-gradient(145deg,rgba(0,255,255,0.07),rgba(170,0,255,0.08))",
        border: `1px solid ${gradeColor}44`,
        boxShadow: `0 0 24px ${gradeColor}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.35 }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
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

      <div className="grid grid-cols-2 gap-1.5">
        {result.categories.map((category) => {
          const color = GRADE_COLORS[category.grade];
          return (
            <div key={category.id} className="rounded-xl px-2 py-1.5" style={{ background: "rgba(0,0,0,0.28)", border: `1px solid ${color}24` }}>
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

      {weaponReward && weaponProgress && (
        <div
          className="mt-2 rounded-xl px-2.5 py-2"
          style={{
            background: weaponReward.leveledUp
              ? "linear-gradient(110deg,rgba(255,135,40,0.17),rgba(180,110,255,0.15))"
              : "rgba(0,0,0,0.26)",
            border: `1px solid ${weaponReward.leveledUp ? "#ffad4d66" : "rgba(255,255,255,0.1)"}`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-black uppercase tracking-[0.16em]" style={{ color: weaponReward.leveledUp ? "#ffc46b" : "rgba(255,255,255,0.55)", fontSize: "0.58rem" }}>
                {weaponReward.leveledUp ? `Weapon level up · Lv${weaponReward.level}` : "Weapon progression"}
              </p>
              <p className="font-semibold" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.68rem" }}>
                {weaponReward.displayName} · +{weaponReward.xpAwarded} XP
              </p>
            </div>
            <span className="font-black" style={{ color: weaponProgress.isMaxLevel ? "#facc15" : "#ffad4d", fontSize: "0.65rem" }}>
              {weaponProgress.isMaxLevel ? "MAX" : `${weaponProgress.xp}/${weaponProgress.nextThreshold} XP`}
            </span>
          </div>
          <div style={{ height: 5, marginTop: 7, borderRadius: 4, overflow: "hidden", background: "rgba(0,0,0,0.45)" }}>
            <div style={{ width: `${weaponProgress.progressPercent}%`, height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#ff8d36,#ffd166,#b47cff)" }} />
          </div>
          {weaponReward.leveledUp && weaponReward.changes.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-1">
              {weaponReward.changes.slice(0, 4).map((change) => (
                <div key={`${change.label}-${change.to}`} className="flex items-center justify-between gap-2" style={{ fontSize: "0.56rem" }}>
                  <span style={{ color: "rgba(255,255,255,0.48)" }}>{change.label}</span>
                  <span style={{ color: change.direction === "down" ? "#ff9b82" : "#9fffc6", fontWeight: 800 }}>
                    {change.from} → {change.to}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}