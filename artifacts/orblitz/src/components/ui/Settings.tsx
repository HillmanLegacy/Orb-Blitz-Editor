import { motion } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { isMuted, toggleMute } = useAudio();

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
      
      <div className="relative z-10 min-h-full flex items-center justify-center p-4 py-16">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-6 text-center">
              Settings
            </h1>

            <div className="space-y-4">
              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-lg">Sound</h3>
                  <p className="text-gray-400 text-sm">Toggle game audio</p>
                </div>
                <motion.button
                  onClick={toggleMute}
                  className={`w-16 h-9 rounded-full relative transition-colors ${
                    !isMuted ? "bg-gradient-to-r from-cyan-500 to-purple-500" : "bg-gray-700"
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-7 h-7 bg-white rounded-full absolute top-1"
                    animate={{ left: !isMuted ? "calc(100% - 32px)" : "4px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-white font-bold text-lg mb-2">Audio Status</h3>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${!isMuted ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-gray-300">{!isMuted ? "Sound Enabled" : "Sound Muted"}</span>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-white font-bold text-lg mb-2">Controls</h3>
                <div className="text-gray-300 text-sm space-y-1">
                  <p><span className="text-cyan-400">Tap:</span> Shoot projectile</p>
                  <p><span className="text-cyan-400">Hold:</span> Rapid fire</p>
                  <p><span className="text-cyan-400">Pause:</span> Access menu</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
