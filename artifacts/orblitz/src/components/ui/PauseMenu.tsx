import { motion } from "framer-motion";
import { useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";

export function PauseMenu() {
  const { phase, resumeGame, startLoading } = useMagicOrb();
  const { openShop, openInventory, shopOpen, inventoryOpen } = useShop();
  const { isMuted, toggleMute, playMenuSelect } = useAudio();
  const [showSettings, setShowSettings] = useState(false);

  const handleButtonClick = (action: () => void) => {
    playMenuSelect();
    action();
  };

  if (phase !== "paused" || shopOpen || inventoryOpen) return null;

  if (showSettings) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-b from-purple-800 to-indigo-900 p-8 rounded-2xl border border-purple-500/50 shadow-2xl shadow-purple-500/30 min-w-[280px]"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
        >
          <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400 mb-6">
            Settings
          </h2>

          <div className="space-y-4 mb-6">
            <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold">Sound</h3>
                <p className="text-gray-400 text-sm">Toggle audio</p>
              </div>
              <motion.button
                onClick={toggleMute}
                className={`w-14 h-8 rounded-full relative transition-colors ${
                  !isMuted ? "bg-gradient-to-r from-cyan-500 to-purple-500" : "bg-gray-700"
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="w-6 h-6 bg-white rounded-full absolute top-1"
                  animate={{ left: !isMuted ? "calc(100% - 28px)" : "4px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonClick(() => setShowSettings(false))}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30"
          >
            Back
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-violet-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-gradient-to-b from-purple-800 to-indigo-900 p-8 rounded-2xl border border-purple-500/50 shadow-2xl shadow-purple-500/30"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400 mb-8">
          Paused
        </h2>

        <div className="flex flex-col gap-4 min-w-[200px]">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonClick(resumeGame)}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow"
          >
            Resume
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonClick(openShop)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-shadow"
          >
            Shop
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonClick(openInventory)}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow"
          >
            Inventory
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonClick(() => setShowSettings(true))}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
          >
            Settings
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleButtonClick(() => startLoading("exiting_to_menu"))}
            className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold rounded-xl shadow-lg shadow-gray-500/30 hover:shadow-gray-500/50 transition-shadow mt-4"
          >
            Quit
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
