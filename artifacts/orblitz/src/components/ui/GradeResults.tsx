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

export function GradeResults({ result, compact = false }: { result: GameplayResultSnapshot | null; compact?: boolean }) {
  const weaponReward = useMagicOrb((state) => state.lastWeaponProgression);
  const weaponProgression = useShop((state) => state.weaponProgression);
  const weaponProgress = weaponReward
    ? getWeaponProgress(weaponReward.weapon, weaponProgression[weaponReward.weapon])
    : null;
  if (!result) return null;
  const gradeColor = GRADE_COLORS[result.overallGrade];

  return (
    <motion.section
      aria-label="Gameplay grade results"
      className={`orblitz-grade-results w-full rounded-2xl ${compact ? "p-2" : "p-2.5 md:p-3"}`}
      style={{
        background: "linear-gradient(145deg,rgba(0,255,255,0.07),rgba(170,0,255,0.08))",
        border: `1px solid ${gradeColor}44`,
        boxShadow: `0 0 24px ${gradeColor}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.35 }}
    >
      <div className={`flex items-center justify-between gap-3 ${compact ? "mb-1" : "mb-2"}`}>
        <div>
          <p className="font-black uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.46)", fontSize: "0.58rem" }}>
            Gameplay grade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-black" style={{ color: gradeColor, fontSize: compact ? "1.65rem" : "2rem", lineHeight: 1, textShadow: `0 0 16px ${gradeColor}99` }}>
            {result.overallGrade}
          </span>
          <span className="font-black" style={{ color: gradeColor, fontSize: "0.72rem" }}>
            {result.overallScore}/100
          </span>
        </div>
      </div>

      <div className={`grid ${compact ? "grid-cols-4 gap-1" : "grid-cols-2 gap-1.5"}`}>
        {result.categories.map((category) => {
          const color = GRADE_COLORS[category.grade];
          return (
            <div key={category.id} className={`rounded-xl ${compact ? "px-1.5 py-1" : "px-2 py-1.5"}`} style={{ background: "rgba(0,0,0,0.28)", border: `1px solid ${color}24` }}>
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.58)", fontSize: "0.53rem" }}>
                  {category.label}
                </span>
                <span className="font-black" style={{ color, fontSize: "0.8rem" }}>{category.grade}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1 mt-1">
                <span className="font-black truncate" style={{ color: "rgba(255,255,255,0.9)", fontSize: compact ? "0.72rem" : "0.85rem" }}>
                  {formatRawValue(category.id, category.rawValue)}
                </span>
                <span className="flex-none" style={{ color: "rgba(255,255,255,0.38)", fontSize: compact ? "0.48rem" : "0.56rem" }}>
                  {Math.round(category.normalizedScore)}/100
                </span>
              </div>
              <p className="mt-1 truncate" title={category.rawLabel} style={{ color: "rgba(255,255,255,0.42)", fontSize: compact ? "0.46rem" : "0.55rem", lineHeight: 1.25 }}>
                {category.rawLabel}
              </p>
            </div>
          );
        })}
      </div>

      {weaponReward && weaponProgress && (
        <motion.div
          className={`${compact ? "mt-1.5 px-2 py-1.5" : "mt-2 px-2.5 py-2"} rounded-xl`}
          style={{
            background: weaponReward.leveledUp
              ? "linear-gradient(110deg,rgba(255,135,40,0.17),rgba(180,110,255,0.15))"
              : "rgba(0,0,0,0.26)",
            border: `1px solid ${weaponReward.leveledUp ? "#ffad4d66" : "rgba(255,255,255,0.1)"}`,
          }}
          aria-live="polite"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: weaponReward.leveledUp ? [0.98, 1.025, 1] : 1,
          }}
          transition={{
            opacity: { duration: 0.22 },
            y: { duration: 0.22 },
            scale: weaponReward.leveledUp
              ? { duration: 0.72, times: [0, 0.45, 1], ease: "easeOut" }
              : { duration: 0.22 },
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
            <motion.span
              className="font-black"
              style={{ color: weaponProgress.isMaxLevel ? "#facc15" : "#ffad4d", fontSize: "0.65rem" }}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {weaponProgress.isMaxLevel ? "MAX" : `${weaponProgress.xp}/${weaponProgress.nextThreshold} XP`}
            </motion.span>
          </div>
          <div style={{ height: 5, marginTop: compact ? 5 : 7, borderRadius: 4, overflow: "hidden", background: "rgba(0,0,0,0.45)" }}>
            <motion.div
              key={`${weaponReward.weapon}-${weaponReward.previousLevel}-${weaponReward.level}-${weaponReward.xpAwarded}-${weaponReward.xp}`}
              initial={{ width: `${Math.min(100, Math.max(0, weaponReward.previousProgressPercent))}%` }}
              animate={weaponReward.leveledUp
                ? {
                    width: [
                      `${Math.min(100, Math.max(0, weaponReward.previousProgressPercent))}%`,
                      "100%",
                      `${weaponReward.progressPercent}%`,
                    ],
                  }
                : { width: `${weaponReward.progressPercent}%` }}
              transition={weaponReward.leveledUp
                ? { duration: 1.35, times: [0, 0.52, 1], ease: "easeInOut" }
                : { duration: 0.85, ease: "easeOut" }}
              style={{
                height: "100%",
                borderRadius: 4,
                background: weaponReward.leveledUp
                  ? "linear-gradient(90deg,#ff8d36,#fff1a8,#b47cff)"
                  : "linear-gradient(90deg,#ff8d36,#ffd166,#b47cff)",
                boxShadow: weaponReward.leveledUp ? "0 0 12px rgba(255,196,107,0.9)" : "none",
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5" style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.42)" }}>
            <span>{weaponProgress.isMaxLevel ? "LEVEL CAP REACHED" : `${weaponProgress.xpRemaining} XP TO NEXT LEVEL`}</span>
            <span>LV {weaponProgress.level}</span>
          </div>
          {weaponReward.leveledUp && weaponReward.changes.length > 0 && (
            <div className={`mt-2 grid ${compact ? "grid-cols-2" : "grid-cols-1"} gap-1`}>
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
          {weaponReward.leveledUp && (
            <motion.div
              className="text-center font-black uppercase tracking-[0.24em]"
              style={{ color: "#ffe2a6", fontSize: "0.52rem", textShadow: "0 0 12px rgba(255,190,100,0.85)" }}
              initial={{ opacity: 0, letterSpacing: "0.08em" }}
              animate={{ opacity: [0, 1, 0.72], letterSpacing: ["0.08em", "0.3em", "0.24em"] }}
              transition={{ delay: 0.45, duration: 1.15, ease: "easeOut" }}
            >
              LEVEL UP — NEW POWER UNLOCKED
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}