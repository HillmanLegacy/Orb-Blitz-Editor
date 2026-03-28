import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";

interface LevelTransitionProps {
  onLevelSelect?: () => void;
  onMainMenu?: () => void;
}

export function LevelTransition({ onLevelSelect, onMainMenu }: LevelTransitionProps) {
  const { phase, arcadeLevel, startLoading, setPhase } = useMagicOrb();
  const { openInventory } = useShop();
  const { playLevelComplete, playMenuSelect } = useAudio();
  const [fadeOut, setFadeOut] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);

  useEffect(() => {
    if (phase === "levelComplete" && !soundPlayed) {
      playLevelComplete();
      setSoundPlayed(true);
    } else if (phase !== "levelComplete") {
      setSoundPlayed(false);
    }
  }, [phase, playLevelComplete, soundPlayed]);

  const handleButtonClick = (action: () => void) => {
    playMenuSelect();
    action();
  };

  const currentLevel = Math.floor(arcadeLevel);
  const currentSub = Math.round((arcadeLevel % 1) * 10);
  const nextSub = currentSub >= 9 ? 1 : currentSub + 1;
  const nextWorld = currentSub >= 9 ? currentLevel + 1 : currentLevel;

  useEffect(() => {
    if (phase !== "levelComplete") {
      setFadeOut(false);
    }
  }, [phase]);

  const handleContinue = () => {
    playMenuSelect();
    const newLevel = currentSub >= 9 
      ? currentLevel + 1 + 0.1 
      : currentLevel + (currentSub + 1) / 10;
    startLoading("nextLevel", newLevel);
  };

  const handleLevelSelect = () => {
    playMenuSelect();
    if (onLevelSelect) {
      onLevelSelect();
      setTimeout(() => setPhase("menu"), 0);
    }
  };

  const handleMainMenu = () => {
    playMenuSelect();
    if (onMainMenu) onMainMenu();
    const { startLoading } = useMagicOrb.getState();
    startLoading("exiting");
  };

  if (phase !== "levelComplete") return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />
      
      {fadeOut && (
        <motion.div
          className="fixed inset-0 bg-black z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
      )}

      <div className="min-h-full flex items-center justify-center py-8">
        <motion.div 
          className="relative z-10 text-center px-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: fadeOut ? 0 : 1, scale: fadeOut ? 0.9 : 1 }}
          transition={{ duration: 0.5 }}
        >
        <motion.h1
          className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400"
          animate={{
            textShadow: [
              "0 0 20px #00ff88",
              "0 0 40px #00ffff",
              "0 0 20px #00ff88",
            ],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          LEVEL COMPLETE!
        </motion.h1>
        
        <motion.p
          className="text-3xl md:text-4xl text-purple-200 mt-4 font-bold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Level {currentLevel}.{currentSub}
        </motion.p>

        <motion.div
          className="flex justify-center gap-2 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                repeat: Infinity,
              }}
            />
          ))}
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <p className="text-purple-300 text-lg mb-4">
            Next: Level {nextWorld}.{nextSub}
          </p>
          <p className="text-purple-400/80 text-sm mb-6">
            {nextSub === 9 ? "Boss Battle!" : `${15 + (nextWorld - 1) * 10 + (nextSub - 1) * 5} orbs to destroy`}
          </p>
          
          <div className="flex flex-col gap-3">
            <motion.button
              onClick={handleContinue}
              data-ui="true"
              className="px-12 py-4 text-2xl font-black text-white rounded-full bg-gradient-to-r from-green-500 via-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  "0 0 20px rgba(0, 255, 255, 0.3)",
                  "0 0 40px rgba(0, 255, 255, 0.5)",
                  "0 0 20px rgba(0, 255, 255, 0.3)",
                ],
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              CONTINUE
            </motion.button>

            <motion.button
              onClick={() => {
                playMenuSelect();
                openInventory();
              }}
              data-ui="true"
              className="px-8 py-3 text-lg font-bold text-yellow-300 rounded-full border-2 border-yellow-500/50 hover:bg-yellow-500/20 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              INVENTORY
            </motion.button>

            {onLevelSelect && (
              <motion.button
                onClick={handleLevelSelect}
                data-ui="true"
                className="px-8 py-3 text-lg font-bold text-cyan-300 rounded-full border-2 border-cyan-500/50 hover:bg-cyan-500/20 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                LEVEL SELECT
              </motion.button>
            )}

            <motion.button
              onClick={handleMainMenu}
              data-ui="true"
              className="px-8 py-3 text-lg font-bold text-purple-300 rounded-full border-2 border-purple-500/50 hover:bg-purple-500/20 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              MAIN MENU
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
      </div>
    </div>
  );
}
