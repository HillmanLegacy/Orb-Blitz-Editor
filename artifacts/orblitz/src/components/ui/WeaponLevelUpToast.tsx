import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import type { WeaponLevelUpResult } from "@/game-runtime/WeaponProgression";

export const WEAPON_LEVEL_UP_TOAST_DURATION_MS = 4600;
export const MAX_WEAPON_LEVEL_UP_TOASTS = 6;

export function getWeaponLevelUpToastId(result: WeaponLevelUpResult): string {
  return [
    result.weapon,
    result.previousLevel,
    result.level,
    result.previousXp,
    result.xpAwarded,
    result.xp,
  ].join(":");
}

export function enqueueWeaponLevelUpToast(
  queue: WeaponLevelUpResult[],
  result: WeaponLevelUpResult,
  announcedIds: Set<string>,
): WeaponLevelUpResult[] {
  if (!result.leveledUp || result.level <= result.previousLevel) return queue;

  const id = getWeaponLevelUpToastId(result);
  if (announcedIds.has(id)) return queue;

  announcedIds.add(id);
  return [...queue, result].slice(-MAX_WEAPON_LEVEL_UP_TOASTS);
}

function LevelUpIcon() {
  return (
    <svg viewBox="0 0 32 32" width="1em" height="1em" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <circle cx="16" cy="16" r="5.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 2.8v6M16 23.2v6M2.8 16h6M23.2 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="m16 11.5 1.3 2.9 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1 3.2-.3L16 11.5Z" fill="currentColor" />
    </svg>
  );
}

export function WeaponLevelUpToast() {
  const phase = useMagicOrb((state) => state.phase);
  const progression = useMagicOrb((state) => state.lastWeaponProgression);
  const [queue, setQueue] = useState<WeaponLevelUpResult[]>([]);
  const announcedIds = useRef(new Set<string>());

  useEffect(() => {
    if (phase === "menu") {
      announcedIds.current.clear();
      setQueue([]);
      return;
    }

    // A new run/level clears the store result. Keep the current toast visible
    // through the loading sweep, but allow an identical level-up to announce
    // again in a later run.
    if (!progression) {
      if (phase === "loading" || phase === "playing") announcedIds.current.clear();
      return;
    }

    setQueue((current) =>
      enqueueWeaponLevelUpToast(current, progression, announcedIds.current),
    );
  }, [phase, progression]);

  useEffect(() => {
    if (queue.length === 0) return;
    const timeout = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, WEAPON_LEVEL_UP_TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [queue]);

  const isGameplaySurface =
    phase === "playing" ||
    phase === "paused" ||
    phase === "levelComplete" ||
    phase === "gameOver";
  const activeLevelUp = isGameplaySurface ? queue[0] : undefined;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed left-1/2 top-[clamp(4.75rem,12vh,8rem)] z-[70] w-[min(440px,calc(100vw-24px))] -translate-x-1/2"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {activeLevelUp && (
          <motion.div
            key={getWeaponLevelUpToastId(activeLevelUp)}
            role="status"
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(110deg,rgba(18,10,38,0.98),rgba(50,17,48,0.97) 55%,rgba(28,22,58,0.98))",
              border: "1px solid rgba(255,196,107,0.78)",
              boxShadow: "0 14px 38px rgba(0,0,0,0.48), 0 0 26px rgba(255,145,64,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
              backdropFilter: "blur(16px) saturate(1.4)",
            }}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
          >
            <div
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: "linear-gradient(180deg,#ffe7a3,#ff8d36,#b47cff)", boxShadow: "0 0 16px #ffad4d" }}
            />
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <motion.div
                className="flex h-12 w-12 flex-none items-center justify-center rounded-xl"
                style={{
                  color: "#ffe29a",
                  background: "linear-gradient(145deg,rgba(255,196,107,0.24),rgba(180,124,255,0.18))",
                  border: "1px solid rgba(255,210,130,0.55)",
                  fontSize: "1.85rem",
                  textShadow: "0 0 14px rgba(255,190,100,0.95)",
                }}
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1.08, 1] }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <LevelUpIcon />
              </motion.div>

              <div className="min-w-0 flex-1">
                <p
                  className="font-black uppercase"
                  style={{ color: "#ffe2a6", fontSize: "0.58rem", letterSpacing: "0.22em", textShadow: "0 0 10px rgba(255,190,100,0.55)" }}
                >
                  Weapon level up
                </p>
                <p
                  className="truncate font-black uppercase"
                  style={{ color: "#ffffff", fontSize: "0.84rem", letterSpacing: "0.08em" }}
                  title={activeLevelUp.displayName}
                >
                  {activeLevelUp.displayName}
                </p>
                <p
                  className="truncate"
                  style={{ color: "rgba(255,255,255,0.62)", fontSize: "0.6rem", letterSpacing: "0.08em" }}
                >
                  New power online · +{activeLevelUp.xpAwarded} XP
                </p>
              </div>

              <div
                className="flex-none rounded-lg px-2.5 py-1.5 text-center"
                style={{
                  color: "#1c102c",
                  background: "linear-gradient(135deg,#fff0b3,#ffad4d)",
                  boxShadow: "0 0 16px rgba(255,174,76,0.5)",
                }}
              >
                <span className="block font-black" style={{ fontSize: "0.52rem", letterSpacing: "0.16em" }}>LEVEL</span>
                <span className="block font-black" style={{ fontSize: "1.25rem", lineHeight: 1.05 }}> {activeLevelUp.level}</span>
              </div>
            </div>

            {activeLevelUp.changes.length > 0 && (
              <div
                className="mx-4 mb-3 grid grid-cols-1 gap-1 rounded-lg px-2.5 py-2 sm:mx-5 sm:grid-cols-2"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,210,130,0.16)" }}
              >
                {activeLevelUp.changes.slice(0, 2).map((change) => (
                  <div key={`${change.label}-${change.to}`} className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate" style={{ color: "rgba(255,255,255,0.52)", fontSize: "0.55rem" }}>{change.label}</span>
                    <span className="flex-none font-black" style={{ color: change.direction === "down" ? "#ffb09b" : "#b8ffd7", fontSize: "0.55rem" }}>
                      {change.from} → {change.to}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {queue.length > 1 && (
              <div
                className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 font-black"
                style={{ color: "#ffe2a6", background: "rgba(255,196,107,0.16)", fontSize: "0.5rem", letterSpacing: "0.08em" }}
              >
                +{queue.length - 1}
              </div>
            )}

            <motion.div
              className="h-0.5 origin-left"
              style={{ background: "linear-gradient(90deg,#ffad4d,#fff1a8,#b47cff)" }}
              initial={{ scaleX: 1, opacity: 0.9 }}
              animate={{ scaleX: 0, opacity: 0.28 }}
              transition={{ duration: WEAPON_LEVEL_UP_TOAST_DURATION_MS / 1000, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}