import { motion } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

const levelColors: Record<number, { primary: string; secondary: string; name: string }> = {
  1: { primary: "#00ffff", secondary: "#0088ff", name: "Sky Realm" },
  2: { primary: "#ff00ff", secondary: "#8800ff", name: "Void Dimension" },
  3: { primary: "#ffff00", secondary: "#ff8800", name: "Solar Expanse" },
  4: { primary: "#00ff88", secondary: "#00aa44", name: "Forest Kingdom" },
  5: { primary: "#ff4488", secondary: "#cc0044", name: "Crystal Caves" },
  6: { primary: "#8888ff", secondary: "#4444cc", name: "Storm Peaks" },
  7: { primary: "#ff8844", secondary: "#cc4400", name: "Lava Fields" },
  8: { primary: "#44ffff", secondary: "#00cccc", name: "Ocean Depths" },
  9: { primary: "#ffff88", secondary: "#cccc00", name: "Star Core" },
};

const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  const worldBase = 15 + (world - 1) * 10;
  return worldBase + (sub - 1) * 5;
};

export function LevelComplete() {
  const { completedLevel, score } = useMagicOrb();
  
  const levelToShow = completedLevel || 1.1;
  const world = Math.floor(levelToShow);
  const subLevel = Math.round((levelToShow % 1) * 10);
  const colors = levelColors[world] || levelColors[1];
  const isBossDefeated = subLevel === 9;
  const orbGoal = getOrbGoal(world, subLevel);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: `radial-gradient(circle, ${colors.primary}40, ${colors.secondary}20, transparent)`,
        }}
      />
      
      <motion.div
        className="relative z-10 text-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
      >
        {isBossDefeated ? (
          <>
            <motion.h1
              className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 mb-4"
              animate={{
                textShadow: [
                  "0 0 20px #ffff00",
                  "0 0 40px #ff8800",
                  "0 0 20px #ffff00",
                ],
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              BOSS DEFEATED!
            </motion.h1>
            <p className="text-2xl text-white mb-2">{colors.name} Complete!</p>
          </>
        ) : (
          <>
            <motion.h1
              className="text-4xl font-bold text-white mb-2"
              style={{ textShadow: `0 0 20px ${colors.primary}` }}
            >
              LEVEL {world}.{subLevel} COMPLETE!
            </motion.h1>
            <p className="text-lg text-gray-300 mb-2">
              {orbGoal}/{orbGoal} orbs destroyed
            </p>
          </>
        )}
        
        <motion.p
          className="text-xl text-gray-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Score: {score}
        </motion.p>
        
        <motion.p
          className="text-lg text-cyan-400 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1] }}
          transition={{ delay: 1, duration: 1.5, repeat: Infinity }}
        >
          Next level starting...
        </motion.p>
      </motion.div>
    </div>
  );
}
