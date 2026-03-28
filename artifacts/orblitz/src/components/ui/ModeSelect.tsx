import { motion } from "framer-motion";
import { useMagicOrb, GameMode } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";

interface ModeSelectProps {
  onBack: () => void;
  onArcadeSelect?: () => void;
}

const modeInfo: Record<GameMode, { name: string; description: string; color: string; gradient: string }> = {
  survival: {
    name: "SURVIVAL",
    description: "Classic mode - survive as long as you can! Dark orbs get faster and spawn more frequently over time.",
    color: "#ff00ff",
    gradient: "from-purple-500 via-pink-500 to-red-500",
  },
  chill: {
    name: "CHILL",
    description: "Relaxed gameplay - slower orbs with no speed increase. Perfect for casual play.",
    color: "#00ffff",
    gradient: "from-cyan-500 via-teal-500 to-blue-500",
  },
  arcade: {
    name: "ARCADE",
    description: "Level-based adventure! Battle through themed stages and defeat epic bosses.",
    color: "#ffff00",
    gradient: "from-yellow-500 via-orange-500 to-red-500",
  },
  gauntlet: {
    name: "GAUNTLET",
    description: "Test your accuracy! Orbs spawn faster over time. Miss a single shot and it's game over!",
    color: "#ff4444",
    gradient: "from-red-500 via-orange-500 to-yellow-500",
  },
};

export function ModeSelect({ onBack, onArcadeSelect }: ModeSelectProps) {
  const { setGameMode, startLoading } = useMagicOrb();
  const { playMenuSelect } = useAudio();

  const handleSelectMode = (mode: GameMode) => {
    playMenuSelect();
    setGameMode(mode);
    if (mode === "arcade" && onArcadeSelect) {
      onArcadeSelect();
    } else if (mode === "arcade") {
      setGameMode(mode);
    } else {
      startLoading("entering");
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900" />
      
      <motion.button
        onClick={() => {
          playMenuSelect();
          onBack();
        }}
        className="fixed top-4 left-4 z-20 px-4 py-2 bg-gray-600/50 hover:bg-gray-600/70 rounded-full font-bold text-white text-sm transition-colors flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>←</span> BACK
      </motion.button>
      
      <div className="relative z-10 min-h-full flex items-center justify-center p-4 py-16">
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-6 text-center">
            SELECT MODE
          </h2>

          <div className="space-y-4">
            {(Object.keys(modeInfo) as GameMode[]).map((mode, i) => {
              const info = modeInfo[mode];
              return (
                <motion.button
                  key={mode}
                  onClick={() => handleSelectMode(mode)}
                  className="w-full p-4 rounded-xl bg-black/40 backdrop-blur-md border border-purple-500/30 text-left group hover:border-purple-400/60 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${info.gradient} mb-1`}>
                    {info.name}
                  </div>
                  <p className="text-gray-300 text-sm">{info.description}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
