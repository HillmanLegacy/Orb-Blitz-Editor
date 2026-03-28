import { motion } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useState, useEffect } from "react";

interface LevelProgress {
  highestLevel: number;
}

const getStoredProgress = (): LevelProgress => {
  try {
    const stored = localStorage.getItem("orblitz_arcade_progress");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return { highestLevel: 1.1 };
};

export const saveProgress = (level: number) => {
  try {
    const current = getStoredProgress();
    if (level > current.highestLevel) {
      localStorage.setItem("orblitz_arcade_progress", JSON.stringify({
        highestLevel: level,
      }));
    }
  } catch {}
};

const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  const worldBase = 15 + (world - 1) * 10;
  return worldBase + (sub - 1) * 5;
};

interface LevelSelectProps {
  onBack: () => void;
}

export function LevelSelect({ onBack }: LevelSelectProps) {
  const { startLoading, setGameMode } = useMagicOrb();
  const [progress, setProgress] = useState<LevelProgress>({ highestLevel: 1.1 });

  useEffect(() => {
    setProgress(getStoredProgress());
  }, []);

  const handleSelectLevel = (level: number) => {
    setGameMode("arcade");
    startLoading("nextLevel", level);
  };

  const levels = [];
  for (let world = 1; world <= 9; world++) {
    for (let sub = 1; sub <= 9; sub++) {
      const level = world + sub / 10;
      levels.push(level);
    }
  }

  const isLevelUnlocked = (level: number) => {
    return level <= progress.highestLevel + 0.01;
  };

  const isBossLevel = (level: number) => {
    return Math.round((level % 1) * 10) === 9;
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />
      
      <motion.button
        onClick={onBack}
        className="fixed top-4 left-4 z-20 px-4 py-2 bg-gray-600/50 hover:bg-gray-600/70 rounded-full font-bold text-white text-sm transition-colors flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>←</span> BACK
      </motion.button>

      <motion.div
        className="relative z-10 text-center px-4 max-w-4xl w-full mx-auto py-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.h1
          className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 mb-8"
          animate={{
            textShadow: ["0 0 20px #ff00ff", "0 0 40px #00ffff", "0 0 20px #ff00ff"],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          SELECT LEVEL
        </motion.h1>

        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((world) => (
          <div key={world} className="mb-8">
            <h2 className="text-2xl font-bold text-purple-300 mb-4">
              World {world}
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-2xl mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((sub) => {
                const level = world + sub / 10;
                const unlocked = isLevelUnlocked(level);
                const isBoss = isBossLevel(level);
                const orbGoal = getOrbGoal(world, sub);

                return (
                  <motion.button
                    key={level}
                    onClick={() => unlocked && handleSelectLevel(level)}
                    disabled={!unlocked}
                    className={`relative aspect-square rounded-xl text-xl font-bold transition-all flex flex-col items-center justify-center ${
                      unlocked
                        ? isBoss
                          ? "bg-gradient-to-br from-red-600 to-orange-600 text-white border-2 border-red-400 shadow-lg shadow-red-500/30 hover:from-red-500 hover:to-orange-500"
                          : "bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-purple-400 shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-pink-500"
                        : "bg-gray-800 text-gray-600 border-2 border-gray-700 cursor-not-allowed"
                    }`}
                    whileHover={unlocked ? { scale: 1.1 } : {}}
                    whileTap={unlocked ? { scale: 0.95 } : {}}
                  >
                    <span>{world}.{sub}</span>
                    {isBoss && unlocked && (
                      <span className="text-[9px] font-medium text-red-200 mt-0.5">
                        BOSS
                      </span>
                    )}
                    {!isBoss && unlocked && (
                      <span className="text-[9px] font-normal text-white/60 mt-0.5">
                        {orbGoal} orbs
                      </span>
                    )}
                    {!unlocked && (
                      <span className="absolute inset-0 flex items-center justify-center text-3xl">
                        🔒
                      </span>
                    )}
                    {level <= progress.highestLevel && (
                      <motion.div
                        className="absolute top-1 right-1 w-3 h-3 rounded-full bg-green-400"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

      </motion.div>
    </div>
  );
}
