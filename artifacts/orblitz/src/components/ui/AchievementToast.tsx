import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import type { TrophyUnlock } from "@/game-runtime/TrophyProgression";

const TOAST_DURATION_MS = 5200;
const MAX_QUEUED_TOASTS = 12;

export function AchievementToast() {
  const phase = useMagicOrb((state) => state.phase);
  const lastTrophyUnlocks = useMagicOrb((state) => state.lastTrophyUnlocks);
  const [queue, setQueue] = useState<TrophyUnlock[]>([]);
  const announcedIds = useRef(new Set<string>());

  useEffect(() => {
    if (lastTrophyUnlocks.length === 0) return;

    const freshUnlocks = lastTrophyUnlocks.filter((trophy) => {
      if (announcedIds.current.has(trophy.id)) return false;
      announcedIds.current.add(trophy.id);
      return true;
    });

    if (freshUnlocks.length > 0) {
      setQueue((current) => [...current, ...freshUnlocks].slice(0, MAX_QUEUED_TOASTS));
    }
  }, [lastTrophyUnlocks]);

  useEffect(() => {
    if (phase === "playing" || phase === "loading") {
      setQueue([]);
    }
  }, [phase]);

  useEffect(() => {
    if (queue.length === 0) return;
    const timeout = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
    }, TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [queue]);

  const activeTrophy = queue[0];

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 left-4 z-[90] w-[min(390px,calc(100vw-32px))]"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {activeTrophy && (
          <motion.div
            key={activeTrophy.id}
            role="status"
            className="relative overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(105deg,rgba(9,11,28,0.98),rgba(28,12,47,0.97))",
              border: `1px solid ${activeTrophy.color}88`,
              boxShadow: `0 14px 36px rgba(0,0,0,0.48), 0 0 28px ${activeTrophy.color}22`,
              backdropFilter: "blur(16px)",
            }}
            initial={{ opacity: 0, x: -34, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
          >
            <div
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: activeTrophy.color, boxShadow: `0 0 14px ${activeTrophy.color}` }}
            />
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div
                className="flex h-12 w-12 flex-none items-center justify-center rounded-lg"
                style={{
                  color: activeTrophy.color,
                  background: `${activeTrophy.color}1c`,
                  border: `1px solid ${activeTrophy.color}66`,
                  fontSize: "1.5rem",
                  textShadow: `0 0 12px ${activeTrophy.color}`,
                }}
              >
                {activeTrophy.icon}
              </div>
              <div className="min-w-0">
                <p
                  className="font-black uppercase"
                  style={{
                    color: "rgba(255,255,255,0.48)",
                    fontSize: "0.53rem",
                    letterSpacing: "0.2em",
                  }}
                >
                  Achievement unlocked
                </p>
                <p
                  className="truncate font-black"
                  style={{
                    color: activeTrophy.color,
                    fontSize: "0.76rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  {activeTrophy.name}
                </p>
                <p
                  className="truncate"
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.06em",
                  }}
                >
                  Title unlocked · {activeTrophy.title}
                </p>
              </div>
            </div>
            <motion.div
              className="h-px origin-left"
              style={{ background: activeTrophy.color }}
              initial={{ scaleX: 1, opacity: 0.72 }}
              animate={{ scaleX: 0, opacity: 0.28 }}
              transition={{ duration: TOAST_DURATION_MS / 1000, ease: "linear" }}
            />
            {queue.length > 1 && (
              <div
                className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 font-black"
                style={{
                  color: activeTrophy.color,
                  background: `${activeTrophy.color}18`,
                  fontSize: "0.48rem",
                  letterSpacing: "0.08em",
                }}
              >
                +{queue.length - 1}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}