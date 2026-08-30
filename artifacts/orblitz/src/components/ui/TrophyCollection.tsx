import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useShop } from "@/lib/stores/useShop";
import {
  getTrophyDefinition,
  TROPHY_CATALOGUE,
  type TrophyCategory,
  type TrophyId,
} from "@/game-runtime/TrophyProgression";

const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  combat: "COMBAT",
  mastery: "MASTERY",
  survival: "SURVIVAL",
  arcade: "ARCADE",
};

const CATEGORY_COLORS: Record<TrophyCategory, string> = {
  combat: "#fb7185",
  mastery: "#a78bfa",
  survival: "#34d399",
  arcade: "#fbbf24",
};

export function TrophyCollection({ onExitComplete }: { onExitComplete?: () => void }) {
  const {
    trophiesOpen,
    closeTrophies,
    trophyProgression,
    setSelectedTitle,
  } = useShop();
  const { unlockedTrophyIds, selectedTitle } = trophyProgression;
  const selectedDefinition = useMemo(
    () => selectedTitle ? getTrophyDefinition(selectedTitle) : null,
    [selectedTitle],
  );

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {trophiesOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ padding: "clamp(10px, 2.5vw, 20px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            className="absolute inset-0 cursor-pointer"
            style={{ background: "rgba(0,0,8,0.86)", backdropFilter: "blur(9px)" }}
            onClick={closeTrophies}
            aria-label="Close trophy collection"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="orblitz-trophy-title"
            className="relative flex flex-col w-full overflow-hidden"
            style={{
              maxWidth: "min(760px, 100%)",
             height: "min(calc(100vh - 20px), 720px)",
             maxHeight: "calc(100vh - 20px)",
              background: "rgba(4,4,18,0.98)",
              border: "1px solid rgba(251,191,36,0.24)",
              borderRadius: "clamp(16px, 2.5vw, 24px)",
              boxShadow: "0 0 80px rgba(251,191,36,0.08), 0 28px 90px rgba(0,0,0,0.8)",
            }}
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
          >
            <div
              className="relative flex-none flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div>
                <p
                  id="orblitz-trophy-title"
                   className="font-black tracking-[0.18em] uppercase"
                  style={{
                    color: "#fbbf24",
                    textShadow: "0 0 12px rgba(251,191,36,0.38)",
                     fontSize: "clamp(0.85rem, 2.2vh, 1.1rem)",
                  }}
                >
                  TROPHY ARCHIVE
                </p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
                  {unlockedTrophyIds.length}/{TROPHY_CATALOGUE.length} MILESTONES RECORDED
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.86 }}
                onClick={closeTrophies}
                aria-label="Close trophy collection"
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 32,
                  height: 32,
                  color: "rgba(255,255,255,0.55)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                }}
              >
                ×
              </motion.button>
            </div>

             <div className="relative flex-1 min-h-0 overflow-hidden p-2.5">
              <div
                 className="mb-2 rounded-xl px-2.5 py-2"
                style={{
                  background: selectedDefinition
                    ? `linear-gradient(110deg,${selectedDefinition.color}18,rgba(167,139,250,0.1))`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedDefinition ? selectedDefinition.color + "44" : "rgba(255,255,255,0.09)"}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.56rem" }}>
                      EQUIPPED TITLE
                    </p>
                    <p className="truncate font-black" style={{ color: selectedDefinition?.color ?? "rgba(255,255,255,0.72)", fontSize: "0.92rem", letterSpacing: "0.08em" }}>
                      {selectedDefinition?.title ?? "NO TITLE SELECTED"}
                    </p>
                  </div>
                  {selectedDefinition && (
                    <button
                      onClick={() => setSelectedTitle(null)}
                      className="rounded-lg px-2.5 py-1.5 font-bold"
                      style={{ color: "rgba(255,255,255,0.48)", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)", fontSize: "0.55rem", letterSpacing: "0.1em", cursor: "pointer" }}
                    >
                      CLEAR
                    </button>
                  )}
                </div>
                 <p className="mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.53rem" }}>
                   Select an unlocked title to equip it.
                </p>
              </div>

               <div className="grid grid-cols-5 gap-1.5">
                {TROPHY_CATALOGUE.map((trophy) => {
                  const unlocked = unlockedTrophyIds.includes(trophy.id);
                  const selected = selectedTitle === trophy.id;
                  const categoryColor = CATEGORY_COLORS[trophy.category];
                  return (
                    <motion.button
                      key={trophy.id}
                      type="button"
                      whileHover={{ y: unlocked ? -2 : 0 }}
                      whileTap={{ scale: unlocked ? 0.98 : 1 }}
                      onClick={() => unlocked && setSelectedTitle(selected ? null : trophy.id)}
                      disabled={!unlocked}
                      aria-pressed={selected}
                       className="relative min-w-0 overflow-hidden rounded-lg p-1.5 text-left"
                      style={{
                         height: "clamp(31px, 6.2vh, 56px)",
                        background: selected
                          ? `linear-gradient(135deg,${trophy.color}20,rgba(255,255,255,0.04))`
                          : unlocked
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(255,255,255,0.025)",
                        border: `1px solid ${selected ? trophy.color + "88" : unlocked ? trophy.color + "38" : "rgba(255,255,255,0.08)"}`,
                        boxShadow: selected ? `0 0 18px ${trophy.color}20` : "none",
                        cursor: unlocked ? "pointer" : "default",
                        opacity: unlocked ? 1 : 0.72,
                      }}
                    >
                       <div
                         className="flex h-full min-w-0 items-center gap-1.5"
                         title={`${unlocked ? trophy.name : "Locked milestone"} — ${unlocked ? trophy.description : trophy.lockedDescription}${unlocked ? ` Title: ${trophy.title}` : ""}`}
                       >
                        <span
                           className="flex-none flex items-center justify-center rounded-md"
                          style={{
                             width: "clamp(20px, 3.4vh, 30px)",
                             height: "clamp(20px, 3.4vh, 30px)",
                            color: unlocked ? trophy.color : "rgba(255,255,255,0.22)",
                            background: unlocked ? `${trophy.color}18` : "rgba(0,0,0,0.2)",
                            border: `1px solid ${unlocked ? trophy.color + "45" : "rgba(255,255,255,0.1)"}`,
                             fontSize: "clamp(0.7rem, 2.1vh, 1rem)",
                          }}
                        >
                          {unlocked ? trophy.icon : "?"}
                        </span>
                         <span className="min-w-0 flex-1">
                           <span className="flex min-w-0 items-center justify-between gap-1">
                             <span className="truncate font-black tracking-[0.07em]" style={{ color: unlocked ? trophy.color : "rgba(255,255,255,0.4)", fontSize: "clamp(0.38rem, 0.82vw, 0.56rem)" }}>
                              {unlocked ? trophy.name : "LOCKED MILESTONE"}
                            </span>
                             <span className="flex-none rounded-full" aria-label={CATEGORY_LABELS[trophy.category]} style={{ width: 4, height: 4, background: categoryColor, boxShadow: `0 0 5px ${categoryColor}` }} />
                          </span>
                           <span className="mt-0.5 block truncate" style={{ color: unlocked ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.34)", fontSize: "clamp(0.36rem, 0.72vw, 0.5rem)", lineHeight: 1.1 }}>
                             {unlocked ? trophy.title : trophy.lockedDescription}
                          </span>
                        </span>
                      </div>
                      {selected && (
                        <span className="absolute right-2 bottom-2 font-black" style={{ color: trophy.color, fontSize: "0.48rem", letterSpacing: "0.12em" }}>
                          EQUIPPED
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}