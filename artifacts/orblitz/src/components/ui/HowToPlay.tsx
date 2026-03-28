import { motion } from "framer-motion";

interface HowToPlayProps {
  onBack: () => void;
}

export function HowToPlay({ onBack }: HowToPlayProps) {
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
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-6 text-center">
              How To Play
            </h1>

            <div className="space-y-4 text-sm">
              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-cyan-400 font-bold mb-2 text-lg">Controls</h3>
                <div className="text-gray-300 space-y-1">
                  <p><span className="text-white font-medium">Tap/Click:</span> Shoot projectiles toward that direction</p>
                  <p><span className="text-white font-medium">Hold:</span> Rapid-fire mode for continuous shooting</p>
                  <p><span className="text-white font-medium">Ability Buttons:</span> Activate equipped defenses and Magi-Orb powers</p>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-pink-400 font-bold mb-2 text-lg">Game Modes</h3>
                <div className="text-gray-300 space-y-2">
                  <p><span className="text-cyan-400 font-medium">Survival:</span> Endless mode with increasing difficulty</p>
                  <p><span className="text-teal-400 font-medium">Chill:</span> Relaxed play with no difficulty scaling</p>
                  <p><span className="text-pink-400 font-medium">Arcade:</span> 81 levels across 9 themed worlds with unique bosses</p>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-green-400 font-bold mb-2 text-lg">Objective</h3>
                <p className="text-gray-300">
                  Defend your magic orb by destroying incoming dark orbs! Collect power-ups to gain advantages. 
                  In Arcade mode, defeat bosses at level X.9 to unlock the next world and gain +1 max HP!
                </p>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-yellow-400 font-bold mb-2 text-lg">Power-Ups</h3>
                <div className="text-gray-300 space-y-1">
                  <p><span className="text-yellow-400 font-medium">Charge Beam:</span> Larger, powerful shots</p>
                  <p><span className="text-blue-400 font-medium">Shield:</span> Blocks one hit</p>
                  <p><span className="text-green-400 font-medium">Healing:</span> Shoot to restore 1 HP</p>
                  <p><span className="text-cyan-400 font-medium">Distort:</span> Freeze all enemies ability</p>
                  <p><span className="text-amber-400 font-medium">Double Stars:</span> 2x star earnings</p>
                  <p><span className="text-red-400 font-medium">Rapid Fire:</span> Faster shooting speed</p>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-purple-400 font-bold mb-2 text-lg">Loadout System</h3>
                <div className="text-gray-300 space-y-1">
                  <p><span className="text-pink-400 font-medium">Weapon (1 slot):</span> Choose your firing style - rapid, scatter, spiral, homing, or more</p>
                  <p><span className="text-blue-400 font-medium">Defense (2 slots):</span> Equip abilities like teleport, shields, healing, or armor</p>
                  <p><span className="text-yellow-400 font-medium">Magi-Orb (1 slot):</span> Powerful world mastery orbs with unique abilities</p>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-emerald-400 font-bold mb-2 text-lg">Earning Stars</h3>
                <p className="text-gray-300">
                  Destroy dark orbs to earn stars. Use stars in the shop to purchase weapons, 
                  defenses, Magi-Orbs, and cosmetics. Bosses award bonus stars!
                </p>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-purple-500/20">
                <h3 className="text-orange-400 font-bold mb-2 text-lg">Pro Tips</h3>
                <ul className="text-gray-300 list-disc list-inside space-y-1">
                  <li>Each world has unique enemy designs and behaviors</li>
                  <li>Your orb dims and shrinks as health decreases</li>
                  <li>Defense abilities have cooldowns - use them wisely</li>
                  <li>Magi-Orbs provide powerful passive and active abilities</li>
                  <li>Customize your look with skins, trails, and ring effects</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
