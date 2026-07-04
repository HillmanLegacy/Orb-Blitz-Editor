import { motion, AnimatePresence } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";

export function GameUI() {
  const { 
    health, 
    maxHealth, 
    score, 
    hasShield, 
    hasChargeBeam, 
    chargeBeamTimer, 
    gameTime,
    hasDistort,
    distortCooldown,
    distortMaxCooldown,
    distortActive,
    distortTimer,
    hasDoubleCoins,
    doubleCoinsTimer,
    hasRapidFire,
    rapidFireTimer,
    selectedWeapon,
    setSelectedWeapon,
    pauseGame,
    activateDistortField,
    gameMode,
    arcadeLevel,
    orbsDestroyedInLevel,
    orbsRequiredForLevel,
    boss,
    teletransferCooldown,
    teletransferMaxCooldown,
  } = useMagicOrb();
  const { toggleMute, isMuted, playPause, playMenuSelect } = useAudio();
  const { coins: shopStars, equippedWeapon, equippedDefenses, equippedMagiOrb } = useShop();

  const hasRapidBlaster = equippedWeapon === "orbital_rapid_blaster";
  const hasTeletransfer = equippedDefenses[0] === "orbital_teletransfer" || equippedDefenses[1] === "orbital_teletransfer";
  const hasDistortFieldDefense = equippedDefenses[0] === "distort_field" || equippedDefenses[1] === "distort_field";
  const hasPulseShield = equippedDefenses[0] === "pulse_shield" || equippedDefenses[1] === "pulse_shield";
  const hasSpatialRelocation = equippedDefenses[0] === "spatial_relocation" || equippedDefenses[1] === "spatial_relocation";
  
  const pulseShieldCooldown = useMagicOrb((s) => s.pulseShieldCooldown);
  const pulseShieldMaxCooldown = useMagicOrb((s) => s.pulseShieldMaxCooldown);
  const activatePulseShield = useMagicOrb((s) => s.activatePulseShield);
  const spatialRelocationCooldown = useMagicOrb((s) => s.spatialRelocationCooldown);
  const spatialRelocationMaxCooldown = useMagicOrb((s) => s.spatialRelocationMaxCooldown);
  const useSpatialRelocation = useMagicOrb((s) => s.useSpatialRelocation);
  
  const magiOrb2Active = useMagicOrb((s) => s.magiOrb2Active);
  const magiOrb2Cooldown = useMagicOrb((s) => s.magiOrb2Cooldown);
  const magiOrb2MaxCooldown = useMagicOrb((s) => s.magiOrb2MaxCooldown);
  const activateMagiOrb2 = useMagicOrb((s) => s.activateMagiOrb2);
  const magiOrb3Cooldown = useMagicOrb((s) => s.magiOrb3Cooldown);
  const magiOrb3MaxCooldown = useMagicOrb((s) => s.magiOrb3MaxCooldown);
  const activateMagiOrb3 = useMagicOrb((s) => s.activateMagiOrb3);
  const magiOrb4Active = useMagicOrb((s) => s.magiOrb4Active);
  const magiOrb4Cooldown = useMagicOrb((s) => s.magiOrb4Cooldown);
  const magiOrb4MaxCooldown = useMagicOrb((s) => s.magiOrb4MaxCooldown);
  const activateMagiOrb4 = useMagicOrb((s) => s.activateMagiOrb4);
  const magiOrb5HP = useMagicOrb((s) => s.magiOrb5HP);
  const magiOrb5MaxHP = useMagicOrb((s) => s.magiOrb5MaxHP);
  const magiOrb7Active = useMagicOrb((s) => s.magiOrb7Active);
  const magiOrb7Cooldown = useMagicOrb((s) => s.magiOrb7Cooldown);
  const magiOrb7MaxCooldown = useMagicOrb((s) => s.magiOrb7MaxCooldown);
  const activateMagiOrb7 = useMagicOrb((s) => s.activateMagiOrb7);
  
  const hasMagiOrb2 = equippedMagiOrb === "magi_orb_2";
  const hasMagiOrb3 = equippedMagiOrb === "magi_orb_3";
  const hasMagiOrb4 = equippedMagiOrb === "magi_orb_4";
  const hasMagiOrb5 = equippedMagiOrb === "magi_orb_5";
  const hasMagiOrb7 = equippedMagiOrb === "magi_orb_7";
  
  const isBossLevel = boss !== null;

  const healthOrbs = [];
  for (let i = 0; i < maxHealth; i++) {
    healthOrbs.push(
      <motion.div
        key={i}
        className={`w-5 h-5 md:w-7 md:h-7 lg:w-9 lg:h-9 rounded-full ${
          i < health 
            ? "bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-600 shadow-lg shadow-cyan-400/60 border border-cyan-200 md:border-2" 
            : "bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-600 md:border-2"
        }`}
        animate={i < health ? {
          boxShadow: ["0 0 8px #00ffff", "0 0 16px #00ffff", "0 0 8px #00ffff"],
          scale: [1, 1.05, 1],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    );
  }

  const distortCooldownPct = hasDistort ? (1 - distortCooldown / distortMaxCooldown) * 100 : 0;
  const teletransferCooldownPct = hasTeletransfer ? (1 - teletransferCooldown / teletransferMaxCooldown) * 100 : 0;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-2 md:gap-3 pointer-events-auto">
          <div className="flex gap-1.5 md:gap-2 bg-black/40 backdrop-blur-sm p-1.5 md:p-2 rounded-lg md:rounded-xl border border-white/10">
            {healthOrbs}
          </div>
          
          <AnimatePresence>
            {hasShield && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600/40 to-blue-400/40 px-4 py-2 rounded-xl border border-blue-400/50 backdrop-blur-sm shadow-lg shadow-blue-500/20"
              >
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-blue-200 text-sm font-semibold">Shield Active</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {hasChargeBeam && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/40 to-orange-400/40 px-4 py-2 rounded-xl border border-yellow-400/50 backdrop-blur-sm shadow-lg shadow-yellow-500/20"
              >
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-yellow-200 text-sm font-semibold">Charge Beam {Math.ceil(chargeBeamTimer)}s</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {distortActive && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600/40 to-teal-400/40 px-4 py-2 rounded-xl border border-cyan-400/50 backdrop-blur-sm shadow-lg shadow-cyan-500/20"
              >
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-200 text-sm font-semibold">Distort Field {Math.ceil(distortTimer)}s</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {hasDoubleCoins && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/40 to-amber-400/40 px-4 py-2 rounded-xl border border-yellow-400/50 backdrop-blur-sm shadow-lg shadow-yellow-500/20"
              >
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-yellow-200 text-sm font-semibold">2x Stars {Math.ceil(doubleCoinsTimer)}s</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {hasRapidFire && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600/40 to-orange-400/40 px-4 py-2 rounded-xl border border-red-400/50 backdrop-blur-sm shadow-lg shadow-red-500/20"
              >
                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                <span className="text-red-200 text-sm font-semibold">Rapid Fire {Math.ceil(rapidFireTimer)}s</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-end gap-1.5 md:gap-3 pointer-events-auto">
          <motion.div
            className="bg-black/50 backdrop-blur-md px-3 md:px-5 py-1.5 md:py-3 rounded-xl md:rounded-2xl border border-purple-400/30 shadow-lg shadow-purple-500/10"
            animate={{
              borderColor: ["rgba(168, 85, 247, 0.3)", "rgba(236, 72, 153, 0.4)", "rgba(168, 85, 247, 0.3)"],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <p className="text-[10px] md:text-xs text-purple-300 uppercase tracking-wider font-medium">Score</p>
            <p className="text-xl md:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
              {score}
            </p>
          </motion.div>

          <div className="flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-yellow-600/30 to-orange-500/30 px-2.5 md:px-4 py-1 md:py-2 rounded-lg md:rounded-xl border border-yellow-400/40 backdrop-blur-sm shadow-lg">
            <span className="text-yellow-300 text-sm md:text-lg">&#9733;</span>
            <span className="text-yellow-200 font-bold text-sm md:text-lg">{shopStars}</span>
          </div>

          <div className="bg-black/40 backdrop-blur-sm px-2.5 md:px-4 py-1 md:py-2 rounded-lg md:rounded-xl border border-white/10">
            <p className="text-xs md:text-sm text-gray-300 font-medium">
              {Math.floor(gameTime / 60)}:{String(Math.floor(gameTime % 60)).padStart(2, '0')}
            </p>
          </div>

          {gameMode === "arcade" && (
            <motion.div
              className="bg-gradient-to-r from-purple-600/40 to-pink-600/40 backdrop-blur-sm px-4 py-2 rounded-xl border border-purple-400/40 shadow-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <p className="text-purple-200 text-sm font-bold">
                Level {Math.floor(arcadeLevel)}.{Math.round((arcadeLevel % 1) * 10)}
              </p>
              {!isBossLevel && (
                <p className="text-purple-300/80 text-xs">
                  {orbsDestroyedInLevel}/{orbsRequiredForLevel} orbs
                </p>
              )}
              {isBossLevel && boss && (
                <div className="mt-1">
                  <p className="text-red-300 text-xs font-semibold">BOSS</p>
                  <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden mt-1">
                    <motion.div
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                      style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  </div>
                  <p className="text-red-200 text-xs mt-0.5">{boss.health}/{boss.maxHealth} HP</p>
                </div>
              )}
            </motion.div>
          )}

          {gameMode === "chill" && (
            <div className="bg-gradient-to-r from-cyan-600/30 to-teal-600/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-cyan-400/30">
              <p className="text-cyan-200 text-sm font-medium">Chill Mode</p>
            </div>
          )}

          {gameMode === "survival" && isBossLevel && boss && (
            <motion.div
              className="bg-gradient-to-r from-red-600/40 to-orange-600/40 backdrop-blur-sm px-4 py-2 rounded-xl border border-red-400/40 shadow-lg"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <p className="text-red-300 text-xs font-semibold">SURVIVAL BOSS</p>
              <div className="w-28 h-3 bg-gray-700 rounded-full overflow-hidden mt-1">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                  style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </div>
              <p className="text-red-200 text-xs mt-0.5">{boss.health}/{boss.maxHealth} HP</p>
            </motion.div>
          )}

          <div className="flex flex-col gap-2">
            <motion.button
              onClick={() => {
                playPause();
                pauseGame();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-purple-600/80 to-indigo-700/80 backdrop-blur-sm px-4 py-2.5 rounded-xl text-white border border-purple-400/30 hover:border-purple-400/50 transition-all shadow-lg shadow-purple-500/20 font-medium"
            >
              ⏸ Pause
            </motion.button>

            <motion.button
              onClick={toggleMute}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-gray-700/80 to-gray-800/80 backdrop-blur-sm px-4 py-2.5 rounded-xl text-gray-200 border border-white/10 hover:border-white/20 transition-all shadow-lg font-medium"
            >
              {isMuted ? "🔇" : "🔊"}
            </motion.button>
          </div>
        </div>
      </div>

      {(hasDistort || hasDistortFieldDefense || hasTeletransfer || hasPulseShield || hasMagiOrb2 || hasMagiOrb3 || hasMagiOrb4 || hasMagiOrb5 || hasMagiOrb7) && (
        <div className="absolute bottom-4 left-4 flex gap-3 pointer-events-auto">
          {hasDistort && (
            <motion.button
              onClick={() => {
                if (distortCooldown <= 0) {
                  activateDistortField();
                }
              }}
              disabled={distortCooldown > 0}
              whileHover={distortCooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={distortCooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                distortActive
                  ? "border-3 border-blue-400 shadow-blue-400/40"
                  : distortCooldown > 0
                    ? "border-2 border-gray-600/50 opacity-70"
                    : "border-2 border-gray-500/50 hover:border-blue-400/50"
              }`}
            >
              <div className={`absolute inset-0 ${distortActive ? "bg-gradient-to-br from-blue-600/60 to-blue-800/60" : "bg-gradient-to-br from-gray-700/60 to-gray-900/60"} backdrop-blur-sm`} />
              {distortCooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/70 to-blue-400/50"
                  style={{ height: `${distortCooldownPct}%` }}
                  initial={{ height: 0 }}
                  animate={{ height: `${distortCooldownPct}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-7 h-7 border-3 rounded-full ${distortActive || distortCooldown <= 0 ? "border-blue-300 shadow-lg shadow-blue-400/50" : "border-gray-500"}`} />
                <span className={`text-[11px] font-semibold mt-1 ${distortActive ? "text-blue-200" : "text-gray-400"}`}>
                  {distortCooldown > 0 ? `${Math.ceil(distortCooldown)}s` : "Distort"}
                </span>
              </div>
            </motion.button>
          )}

          {hasTeletransfer && (
            <motion.button
              onClick={() => setSelectedWeapon("teletransfer")}
              disabled={teletransferCooldown > 0}
              whileHover={teletransferCooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={teletransferCooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                selectedWeapon === "teletransfer"
                  ? "border-3 border-purple-400 shadow-purple-400/40"
                  : teletransferCooldown > 0
                    ? "border-2 border-gray-600/50 opacity-70"
                    : "border-2 border-gray-500/50 hover:border-purple-400/50"
              }`}
            >
              <div className={`absolute inset-0 ${selectedWeapon === "teletransfer" ? "bg-gradient-to-br from-purple-600/60 to-purple-800/60" : "bg-gradient-to-br from-gray-700/60 to-gray-900/60"} backdrop-blur-sm`} />
              {teletransferCooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-500/70 to-purple-400/50"
                  style={{ height: `${teletransferCooldownPct}%` }}
                  initial={{ height: 0 }}
                  animate={{ height: `${teletransferCooldownPct}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-5 h-5 ${selectedWeapon === "teletransfer" || teletransferCooldown <= 0 ? "text-purple-300" : "text-gray-500"}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 12h6v8l8-10h-6V2z" />
                  </svg>
                </div>
                <span className={`text-[11px] font-semibold mt-1 ${selectedWeapon === "teletransfer" ? "text-purple-200" : "text-gray-400"}`}>
                  {teletransferCooldown > 0 ? `${Math.ceil(teletransferCooldown)}s` : "Teleport"}
                </span>
              </div>
            </motion.button>
          )}

          {hasDistortFieldDefense && !hasDistort && (
            <motion.button
              onClick={() => {
                if (distortCooldown <= 0) {
                  activateDistortField();
                }
              }}
              disabled={distortCooldown > 0}
              whileHover={distortCooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={distortCooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                distortActive
                  ? "border-3 border-cyan-400 shadow-cyan-400/40"
                  : distortCooldown > 0
                    ? "border-2 border-gray-600/50 opacity-70"
                    : "border-2 border-gray-500/50 hover:border-cyan-400/50"
              }`}
            >
              <div className={`absolute inset-0 ${distortActive ? "bg-gradient-to-br from-cyan-600/60 to-cyan-800/60" : "bg-gradient-to-br from-gray-700/60 to-gray-900/60"} backdrop-blur-sm`} />
              {distortCooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500/70 to-cyan-400/50"
                  style={{ height: `${distortCooldownPct}%` }}
                  initial={{ height: 0 }}
                  animate={{ height: `${distortCooldownPct}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-7 h-7 border-3 rounded-full ${distortActive || distortCooldown <= 0 ? "border-cyan-300 shadow-lg shadow-cyan-400/50" : "border-gray-500"}`} />
                <span className={`text-[11px] font-semibold mt-1 ${distortActive ? "text-cyan-200" : "text-gray-400"}`}>
                  {distortCooldown > 0 ? `${Math.ceil(distortCooldown)}s` : "Distort"}
                </span>
              </div>
            </motion.button>
          )}

          {hasPulseShield && (
            <motion.button
              onClick={() => {
                if (pulseShieldCooldown <= 0) {
                  activatePulseShield();
                }
              }}
              disabled={pulseShieldCooldown > 0}
              whileHover={pulseShieldCooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={pulseShieldCooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                pulseShieldCooldown > 0
                  ? "border-2 border-gray-600/50 opacity-70"
                  : "border-2 border-gray-500/50 hover:border-pink-400/50"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700/60 to-gray-900/60 backdrop-blur-sm" />
              {pulseShieldCooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-pink-500/70 to-pink-400/50"
                  style={{ height: `${(1 - pulseShieldCooldown / pulseShieldMaxCooldown) * 100}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-6 h-6 rounded-full border-3 ${pulseShieldCooldown <= 0 ? "border-pink-400 shadow-lg shadow-pink-400/50" : "border-gray-500"} flex items-center justify-center`}>
                  <div className={`w-2 h-2 rounded-full ${pulseShieldCooldown <= 0 ? "bg-pink-300" : "bg-gray-500"}`} />
                </div>
                <span className={`text-[11px] font-semibold mt-1 ${pulseShieldCooldown > 0 ? "text-gray-500" : "text-gray-400"}`}>
                  {pulseShieldCooldown > 0 ? `${Math.ceil(pulseShieldCooldown)}s` : "Pulse"}
                </span>
              </div>
            </motion.button>
          )}
          
          
          {hasMagiOrb2 && (
            <motion.button
              onClick={() => {
                if (magiOrb2Cooldown <= 0) {
                  activateMagiOrb2();
                }
              }}
              disabled={magiOrb2Cooldown > 0}
              whileHover={magiOrb2Cooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={magiOrb2Cooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                magiOrb2Active
                  ? "border-3 border-indigo-400 shadow-indigo-400/40"
                  : magiOrb2Cooldown > 0
                    ? "border-2 border-gray-600/50 opacity-70"
                    : "border-2 border-gray-500/50 hover:border-indigo-400/50"
              }`}
            >
              <div className={`absolute inset-0 ${magiOrb2Active ? "bg-gradient-to-br from-indigo-600/60 to-indigo-800/60" : "bg-gradient-to-br from-gray-700/60 to-gray-900/60"} backdrop-blur-sm`} />
              {magiOrb2Cooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-500/70 to-indigo-400/50"
                  style={{ height: `${(1 - magiOrb2Cooldown / magiOrb2MaxCooldown) * 100}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-6 h-6 rounded-full border-2 border-dashed ${magiOrb2Active || magiOrb2Cooldown <= 0 ? "border-indigo-300" : "border-gray-500"}`} />
                <span className={`text-[10px] font-semibold mt-1 ${magiOrb2Active ? "text-indigo-200" : "text-gray-400"}`}>
                  {magiOrb2Cooldown > 0 ? `${Math.ceil(magiOrb2Cooldown)}s` : "Phase"}
                </span>
              </div>
            </motion.button>
          )}
          
          {hasMagiOrb3 && (
            <motion.button
              onClick={() => {
                if (magiOrb3Cooldown <= 0) {
                  activateMagiOrb3();
                }
              }}
              disabled={magiOrb3Cooldown > 0}
              whileHover={magiOrb3Cooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={magiOrb3Cooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                magiOrb3Cooldown > 0
                  ? "border-2 border-gray-600/50 opacity-70"
                  : "border-2 border-gray-500/50 hover:border-yellow-400/50"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700/60 to-gray-900/60 backdrop-blur-sm" />
              {magiOrb3Cooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-yellow-500/70 to-yellow-400/50"
                  style={{ height: `${(1 - magiOrb3Cooldown / magiOrb3MaxCooldown) * 100}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-5 h-5 ${magiOrb3Cooldown <= 0 ? "text-yellow-300" : "text-gray-500"}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="6" cy="6" r="2" />
                    <circle cx="18" cy="6" r="2" />
                    <circle cx="6" cy="18" r="2" />
                    <circle cx="18" cy="18" r="2" />
                  </svg>
                </div>
                <span className={`text-[10px] font-semibold mt-1 text-gray-400`}>
                  {magiOrb3Cooldown > 0 ? `${Math.ceil(magiOrb3Cooldown)}s` : "Homing"}
                </span>
              </div>
            </motion.button>
          )}
          
          {hasMagiOrb4 && (
            <motion.button
              onClick={() => {
                if (magiOrb4Cooldown <= 0) {
                  activateMagiOrb4(0);
                }
              }}
              disabled={magiOrb4Cooldown > 0}
              whileHover={magiOrb4Cooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={magiOrb4Cooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                magiOrb4Active
                  ? "border-3 border-orange-400 shadow-orange-400/40"
                  : magiOrb4Cooldown > 0
                    ? "border-2 border-gray-600/50 opacity-70"
                    : "border-2 border-gray-500/50 hover:border-orange-400/50"
              }`}
            >
              <div className={`absolute inset-0 ${magiOrb4Active ? "bg-gradient-to-br from-orange-600/60 to-orange-800/60" : "bg-gradient-to-br from-gray-700/60 to-gray-900/60"} backdrop-blur-sm`} />
              {magiOrb4Cooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-500/70 to-orange-400/50"
                  style={{ height: `${(1 - magiOrb4Cooldown / magiOrb4MaxCooldown) * 100}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-6 h-6 border-t-3 border-r-3 rounded-tr-full ${magiOrb4Active || magiOrb4Cooldown <= 0 ? "border-orange-300" : "border-gray-500"}`} />
                <span className={`text-[10px] font-semibold mt-1 ${magiOrb4Active ? "text-orange-200" : "text-gray-400"}`}>
                  {magiOrb4Cooldown > 0 ? `${Math.ceil(magiOrb4Cooldown)}s` : "Barrier"}
                </span>
              </div>
            </motion.button>
          )}
          
          {hasMagiOrb5 && (
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-xl border-2 border-cyan-400/50">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-700/60 to-cyan-900/60 backdrop-blur-sm" />
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-cyan-300 rounded-sm rotate-45" />
                <span className="text-[10px] font-semibold mt-1 text-cyan-200">
                  {magiOrb5HP}/{magiOrb5MaxHP} HP
                </span>
              </div>
            </div>
          )}
          
          {hasMagiOrb7 && (
            <motion.button
              onClick={() => {
                if (magiOrb7Cooldown <= 0) {
                  activateMagiOrb7();
                }
              }}
              disabled={magiOrb7Cooldown > 0}
              whileHover={magiOrb7Cooldown <= 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={magiOrb7Cooldown <= 0 ? { scale: 0.95 } : {}}
              className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all overflow-hidden shadow-xl ${
                magiOrb7Active
                  ? "border-3 border-teal-400 shadow-teal-400/40"
                  : magiOrb7Cooldown > 0
                    ? "border-2 border-gray-600/50 opacity-70"
                    : "border-2 border-gray-500/50 hover:border-teal-400/50"
              }`}
            >
              <div className={`absolute inset-0 ${magiOrb7Active ? "bg-gradient-to-br from-teal-600/60 to-teal-800/60" : "bg-gradient-to-br from-gray-700/60 to-gray-900/60"} backdrop-blur-sm`} />
              {magiOrb7Cooldown > 0 && (
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-teal-500/70 to-teal-400/50"
                  style={{ height: `${(1 - magiOrb7Cooldown / magiOrb7MaxCooldown) * 100}%` }}
                />
              )}
              <div className="relative flex flex-col items-center justify-center h-full">
                <div className={`w-6 h-6 rounded-full border-3 ${magiOrb7Active || magiOrb7Cooldown <= 0 ? "border-teal-300 animate-pulse" : "border-gray-500"}`} />
                <span className={`text-[10px] font-semibold mt-1 ${magiOrb7Active ? "text-teal-200" : "text-gray-400"}`}>
                  {magiOrb7Cooldown > 0 ? `${Math.ceil(magiOrb7Cooldown)}s` : "Slow"}
                </span>
              </div>
            </motion.button>
          )}
        </div>
      )}

    </div>
  );
}
