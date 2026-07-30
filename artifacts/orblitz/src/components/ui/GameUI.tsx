import { motion, AnimatePresence } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";

// ── Design primitives — matches main menu aesthetic ────────────────────────────
const SCANLINES = "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)";

/** Scanline texture overlay */
const SL = () => (
  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: SCANLINES, borderRadius: "inherit" }} />
);
/** Top accent gradient bar */
const TA = ({ color }: { color: string }) => (
  <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
    height: 2,
    background: `linear-gradient(90deg,transparent 8%,${color}88 50%,transparent 92%)`,
    opacity: 0.65,
  }} />
);

/** Menu-style panel base */
function pnl(color: string, glow = false): React.CSSProperties {
  return {
    position: "relative", overflow: "hidden",
    background: "rgba(4,4,18,0.88)",
    backdropFilter: "blur(12px) saturate(1.4)",
    border: `1.5px solid ${color}44`,
    boxShadow: glow ? `0 0 18px ${color}30` : `0 0 10px ${color}18`,
    borderRadius: 12,
  };
}

/** Ability hotbar button style */
function abtn(color: string, active: boolean, cd: boolean): React.CSSProperties {
  return {
    position: "relative", overflow: "hidden",
    background: active
      ? `linear-gradient(160deg,${color}22 0%,${color}0e 100%)`
      : `linear-gradient(160deg,${color}10 0%,${color}06 100%)`,
    backdropFilter: "blur(8px)",
    border: `1.5px solid ${active ? color + "cc" : cd ? color + "1e" : color + "55"}`,
    boxShadow: active
      ? `0 0 22px ${color}55, 0 0 44px ${color}22, inset 0 0 12px ${color}14`
      : `0 0 8px ${color}1a, inset 0 1px 0 ${color}14`,
    color, borderRadius: 12,
    opacity: cd && !active ? 0.62 : 1,
    cursor: cd ? "default" : "pointer",
    transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
    width: "4rem", height: "4rem",
  };
}

/** Small banner for active power-up notifications */
function PowerBanner({ color, dot, children }: { color: string; dot: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      className="flex items-center gap-2 px-3 py-1.5"
      style={pnl(color)}
    >
      <TA color={color} /><SL />
      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
      <span className="text-xs font-bold tracking-widest uppercase" style={{ color, letterSpacing: "0.13em" }}>
        {children}
      </span>
    </motion.div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const _s = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", display: "block" } as const;
const IconPause   = () => <svg {..._s}><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" fillOpacity="0.9"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" fillOpacity="0.9"/></svg>;
const IconSound   = () => <svg {..._s}><path d="M4 9H7L12 5V19L7 15H4V9Z" fill="currentColor" fillOpacity="0.85"/><path d="M15 8C17 9.5 17.5 11.5 17.5 12S17 14.5 15 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M17.5 5.5C20.5 7.5 21.5 9.8 21.5 12S20.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
const IconSoundOff= () => <svg {..._s}><path d="M4 9H7L12 5V19L7 15H4V9Z" fill="currentColor" fillOpacity="0.5"/><line x1="16.5" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="22" y1="9" x2="16.5" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
const IconTele    = () => <svg {..._s}><path d="M12 2L4 12H10V20L20 10H14V2Z" fill="currentColor" fillOpacity="0.9"/></svg>;
const IconDistort = () => <svg {..._s}><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5"/><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1" opacity="0.5"/><circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.8"/></svg>;
const IconPulse   = () => <svg {..._s}><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M12 4V8M12 16V20M4 12H8M16 12H20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/></svg>;
const IconPhase   = () => <svg {..._s}><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/><circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.7"/></svg>;
const IconHoming  = () => <svg {..._s}><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="6" cy="6" r="2" fill="currentColor" fillOpacity="0.7"/><circle cx="18" cy="6" r="2" fill="currentColor" fillOpacity="0.7"/><circle cx="6" cy="18" r="2" fill="currentColor" fillOpacity="0.7"/><circle cx="18" cy="18" r="2" fill="currentColor" fillOpacity="0.7"/></svg>;
const IconBarrier = () => <svg {..._s}><path d="M12 3L20 7V17L12 21L4 17V7L12 3Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1"/><circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.8"/></svg>;
const IconHP      = () => <svg {..._s}><path d="M12 20C12 20 4 13 4 8a4 4 0 018 0 4 4 0 018 0c0 5-8 12-8 12z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15"/><line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="12" y1="6" x2="12" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
const IconSlow    = () => <svg {..._s}><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;

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
  
  const pulseShieldCooldown    = useMagicOrb((s) => s.pulseShieldCooldown);
  const pulseShieldMaxCooldown = useMagicOrb((s) => s.pulseShieldMaxCooldown);
  const activatePulseShield    = useMagicOrb((s) => s.activatePulseShield);
  const spatialRelocationCooldown    = useMagicOrb((s) => s.spatialRelocationCooldown);
  const spatialRelocationMaxCooldown = useMagicOrb((s) => s.spatialRelocationMaxCooldown);
  const useSpatialRelocation         = useMagicOrb((s) => s.useSpatialRelocation);
  
  const magiOrb2Active      = useMagicOrb((s) => s.magiOrb2Active);
  const magiOrb2Cooldown    = useMagicOrb((s) => s.magiOrb2Cooldown);
  const magiOrb2MaxCooldown = useMagicOrb((s) => s.magiOrb2MaxCooldown);
  const activateMagiOrb2    = useMagicOrb((s) => s.activateMagiOrb2);
  const magiOrb3Cooldown    = useMagicOrb((s) => s.magiOrb3Cooldown);
  const magiOrb3MaxCooldown = useMagicOrb((s) => s.magiOrb3MaxCooldown);
  const activateMagiOrb3    = useMagicOrb((s) => s.activateMagiOrb3);
  const magiOrb4Active      = useMagicOrb((s) => s.magiOrb4Active);
  const magiOrb4Cooldown    = useMagicOrb((s) => s.magiOrb4Cooldown);
  const magiOrb4MaxCooldown = useMagicOrb((s) => s.magiOrb4MaxCooldown);
  const activateMagiOrb4    = useMagicOrb((s) => s.activateMagiOrb4);
  const magiOrb5HP          = useMagicOrb((s) => s.magiOrb5HP);
  const magiOrb5MaxHP       = useMagicOrb((s) => s.magiOrb5MaxHP);
  const magiOrb7Active      = useMagicOrb((s) => s.magiOrb7Active);
  const magiOrb7Cooldown    = useMagicOrb((s) => s.magiOrb7Cooldown);
  const magiOrb7MaxCooldown = useMagicOrb((s) => s.magiOrb7MaxCooldown);
  const activateMagiOrb7    = useMagicOrb((s) => s.activateMagiOrb7);
  
  const hasMagiOrb2 = equippedMagiOrb === "magi_orb_2";
  const hasMagiOrb3 = equippedMagiOrb === "magi_orb_3";
  const hasMagiOrb4 = equippedMagiOrb === "magi_orb_4";
  const hasMagiOrb5 = equippedMagiOrb === "magi_orb_5";
  const hasMagiOrb7 = equippedMagiOrb === "magi_orb_7";
  
  const isBossLevel = boss !== null;

  const distortCooldownPct    = hasDistort ? (1 - distortCooldown / distortMaxCooldown) * 100 : 0;
  const teletransferCooldownPct = hasTeletransfer ? (1 - teletransferCooldown / teletransferMaxCooldown) * 100 : 0;

  // ── Health orbs ──────────────────────────────────────────────────────────────
  const healthOrbs = [];
  for (let i = 0; i < maxHealth; i++) {
    const alive = i < health;
    healthOrbs.push(
      <motion.div
        key={i}
        className="w-5 h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 rounded-full"
        style={alive ? {
          background: "radial-gradient(circle at 35% 30%, #88ffff, #00ccff, #0077cc)",
          border: "1.5px solid #00ffff88",
          boxShadow: "0 0 8px #00ffff88, inset 0 0 4px #ffffff44",
        } : {
          background: "rgba(4,4,18,0.8)",
          border: "1.5px solid #00ffff18",
        }}
        animate={alive ? {
          boxShadow: [
            "0 0 6px #00ffff66, inset 0 0 4px #ffffff44",
            "0 0 14px #00ffff99, inset 0 0 6px #ffffff55",
            "0 0 6px #00ffff66, inset 0 0 4px #ffffff44",
          ],
        } : {}}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
    );
  }

  // ── Minute:second timer string ─────────────────────────────────────────────
  const timerStr = `${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, "0")}`;

  const soundColor = isMuted ? "#667788" : "#00ffff";
  const soundShadow = isMuted ? "rgba(100,110,130,0.2)" : "rgba(0,255,255,0.45)";

  return (
    <div className="fixed inset-0 pointer-events-none z-40">

      {/* ── TOP ROW ──────────────────────────────────────────────────────────── */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 flex justify-between items-start">

        {/* LEFT: health + active power-up banners */}
        <div className="flex flex-col gap-2 pointer-events-auto">

          {/* Health orbs */}
          <div className="flex gap-1.5 md:gap-2 px-2 py-1.5 md:px-2.5 md:py-2" style={pnl("#00ffff")}>
            <TA color="#00ffff" /><SL />
            {healthOrbs}
          </div>

          {/* Power-up banners */}
          <AnimatePresence>
            {hasShield && (
              <PowerBanner key="shield" color="#00aaff" dot="#44ccff">
                Shield Active
              </PowerBanner>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasChargeBeam && (
              <PowerBanner key="beam" color="#ffcc00" dot="#ffdd44">
                Charge Beam {Math.ceil(chargeBeamTimer)}s
              </PowerBanner>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {distortActive && (
              <PowerBanner key="distort" color="#00ffff" dot="#44ffff">
                Distort {Math.ceil(distortTimer)}s
              </PowerBanner>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasDoubleCoins && (
              <PowerBanner key="dcoins" color="#ffd700" dot="#ffd700">
                2× Stars {Math.ceil(doubleCoinsTimer)}s
              </PowerBanner>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasRapidFire && (
              <PowerBanner key="rapid" color="#ff4488" dot="#ff6699">
                Rapid Fire {Math.ceil(rapidFireTimer)}s
              </PowerBanner>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: score, stars, timer, mode info, controls */}
        <div className="flex flex-col items-end gap-1.5 md:gap-2 pointer-events-auto">

          {/* Score */}
          <motion.div
            className="px-3 md:px-5 py-1.5 md:py-2.5"
            style={pnl("#aa00ff", true)}
            animate={{ borderColor: ["#aa00ff44","#ff00ff44","#aa00ff44"] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <TA color="#aa00ff" /><SL />
            <p className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase opacity-70"
               style={{ color: "#cc44ff", letterSpacing: "0.2em" }}>Score</p>
            <p className="text-xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text"
               style={{ backgroundImage: "linear-gradient(90deg,#00ffff,#aa00ff,#ff00ff)" }}>
              {score}
            </p>
          </motion.div>

          {/* Stars */}
          <div className="flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5" style={pnl("#ffd700")}>
            <TA color="#ffd700" /><SL />
            <span style={{ color: "#ffd700", fontSize: "0.85rem", filter: "drop-shadow(0 0 4px #ffd70099)" }}>★</span>
            <span className="font-bold text-sm md:text-base" style={{ color: "#fde68a" }}>{shopStars}</span>
          </div>

          {/* Timer */}
          <div className="px-2.5 md:px-3 py-1" style={pnl("#00ffff33".replace("33",""))}>
            <TA color="#00ffff" /><SL />
            <p className="text-xs md:text-sm font-bold tracking-widest" style={{ color: "rgba(0,255,255,0.65)", letterSpacing: "0.15em" }}>
              {timerStr}
            </p>
          </div>

          {/* Arcade level + boss */}
          {gameMode === "arcade" && (
            <motion.div
              className="px-3 py-2 min-w-[90px]"
              style={pnl("#aa00ff")}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            >
              <TA color="#aa00ff" /><SL />
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: "#cc44ff", letterSpacing: "0.15em" }}>
                Level {Math.floor(arcadeLevel)}.{Math.round((arcadeLevel % 1) * 10)}
              </p>
              {!isBossLevel && (
                <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(170,100,255,0.65)" }}>
                  {orbsDestroyedInLevel}/{orbsRequiredForLevel} orbs
                </p>
              )}
              {isBossLevel && boss && (
                <div className="mt-1.5">
                  <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#ff4466", letterSpacing: "0.15em" }}>
                    ⚠ BOSS
                  </p>
                  <div className="mt-1 rounded-full overflow-hidden" style={{
                    width: 96, height: 6,
                    background: "rgba(4,4,18,0.8)",
                    border: "1px solid #ff446644",
                  }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        width: `${(boss.health / boss.maxHealth) * 100}%`,
                        background: "linear-gradient(90deg,#ff4466,#ff8844)",
                        boxShadow: "0 0 6px #ff446688",
                      }}
                      animate={{ opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "#ff8899" }}>
                    {boss.health}/{boss.maxHealth} HP
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Chill mode badge */}
          {gameMode === "chill" && (
            <div className="px-3 py-1.5" style={pnl("#00ffff")}>
              <TA color="#00ffff" /><SL />
              <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#00ffff", letterSpacing: "0.18em" }}>
                Chill Mode
              </p>
            </div>
          )}

          {/* Survival boss bar */}
          {gameMode === "survival" && isBossLevel && boss && (
            <motion.div
              className="px-3 py-2"
              style={pnl("#ff4466", true)}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <TA color="#ff4466" /><SL />
              <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#ff4466", letterSpacing: "0.15em" }}>
                ⚠ Survival Boss
              </p>
              <div className="mt-1.5 rounded-full overflow-hidden" style={{
                width: 104, height: 7,
                background: "rgba(4,4,18,0.8)",
                border: "1px solid #ff446644",
              }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${(boss.health / boss.maxHealth) * 100}%`,
                    background: "linear-gradient(90deg,#ff4466,#ff8844)",
                    boxShadow: "0 0 8px #ff446688",
                  }}
                  animate={{ opacity: [0.85, 1, 0.85] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "#ff8899" }}>
                {boss.health}/{boss.maxHealth} HP
              </p>
            </motion.div>
          )}

          {/* Pause + Mute — menu button style */}
          <div className="flex gap-1.5 md:gap-2">
            {/* Pause */}
            <motion.button
              onClick={() => {
                playPause();
                pauseGame();
                useOrbTransition.getState().pauseSweep();
              }}
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.93 }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2"
              style={{
                ...pnl("#00ffff"),
                cursor: "pointer",
                minWidth: 52,
              }}
            >
              <TA color="#00ffff" /><SL />
              <span style={{ color: "#00ffff", fontSize: "1rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #00ffff88)", display: "flex" }}>
                <IconPause />
              </span>
              <span style={{ color: "#00ffff", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.15em", lineHeight: 1, opacity: 0.8 }}>
                PAUSE
              </span>
            </motion.button>

            {/* Mute */}
            <motion.button
              onClick={toggleMute}
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.93 }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2"
              style={{
                ...pnl(soundColor),
                cursor: "pointer",
                minWidth: 52,
              }}
            >
              <TA color={soundColor} /><SL />
              <span style={{ color: soundColor, fontSize: "1rem", lineHeight: 1, filter: `drop-shadow(0 0 5px ${soundColor}88)`, display: "flex" }}>
                {isMuted ? <IconSoundOff /> : <IconSound />}
              </span>
              <span style={{ color: soundColor, fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.15em", lineHeight: 1, opacity: 0.8 }}>
                {isMuted ? "MUTED" : "SOUND"}
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── ABILITY HOTBAR (bottom-left) ──────────────────────────────────────── */}
      {(hasDistort || hasDistortFieldDefense || hasTeletransfer || hasPulseShield ||
        hasMagiOrb2 || hasMagiOrb3 || hasMagiOrb4 || hasMagiOrb5 || hasMagiOrb7) && (
        <div className="absolute bottom-4 left-4 flex gap-2 md:gap-3 pointer-events-auto">

          {/* Distort (from power-up) */}
          {hasDistort && (
            <motion.button
              onClick={() => { if (distortCooldown <= 0) activateDistortField(); }}
              disabled={distortCooldown > 0}
              whileHover={distortCooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={distortCooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#00aaff", distortActive, distortCooldown > 0)}
            >
              <TA color="#00aaff" /><SL />
              {distortCooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${distortCooldownPct}%`,
                  background: "linear-gradient(to top,#00aaff55,#00aaff28)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #00aaff88)", display: "flex" }}>
                  <IconDistort />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {distortCooldown > 0 ? `${Math.ceil(distortCooldown)}s` : "DISTORT"}
                </span>
              </div>
            </motion.button>
          )}

          {/* Teleport */}
          {hasTeletransfer && (
            <motion.button
              onClick={() => setSelectedWeapon("teletransfer")}
              disabled={teletransferCooldown > 0}
              whileHover={teletransferCooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={teletransferCooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#aa00ff", selectedWeapon === "teletransfer", teletransferCooldown > 0)}
            >
              <TA color="#aa00ff" /><SL />
              {teletransferCooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${teletransferCooldownPct}%`,
                  background: "linear-gradient(to top,#aa00ff55,#aa00ff28)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #aa00ff88)", display: "flex" }}>
                  <IconTele />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {teletransferCooldown > 0 ? `${Math.ceil(teletransferCooldown)}s` : "TELEPORT"}
                </span>
              </div>
            </motion.button>
          )}

          {/* Distort (from defense slot) */}
          {hasDistortFieldDefense && !hasDistort && (
            <motion.button
              onClick={() => { if (distortCooldown <= 0) activateDistortField(); }}
              disabled={distortCooldown > 0}
              whileHover={distortCooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={distortCooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#00ffcc", distortActive, distortCooldown > 0)}
            >
              <TA color="#00ffcc" /><SL />
              {distortCooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${distortCooldownPct}%`,
                  background: "linear-gradient(to top,#00ffcc55,#00ffcc28)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #00ffcc88)", display: "flex" }}>
                  <IconDistort />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {distortCooldown > 0 ? `${Math.ceil(distortCooldown)}s` : "DISTORT"}
                </span>
              </div>
            </motion.button>
          )}

          {/* Pulse Shield */}
          {hasPulseShield && (
            <motion.button
              onClick={() => { if (pulseShieldCooldown <= 0) activatePulseShield(); }}
              disabled={pulseShieldCooldown > 0}
              whileHover={pulseShieldCooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={pulseShieldCooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#ff00ff", false, pulseShieldCooldown > 0)}
            >
              <TA color="#ff00ff" /><SL />
              {pulseShieldCooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${(1 - pulseShieldCooldown / pulseShieldMaxCooldown) * 100}%`,
                  background: "linear-gradient(to top,#ff00ff55,#ff00ff28)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #ff00ff88)", display: "flex" }}>
                  <IconPulse />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {pulseShieldCooldown > 0 ? `${Math.ceil(pulseShieldCooldown)}s` : "PULSE"}
                </span>
              </div>
            </motion.button>
          )}

          {/* Phase (Orb 2) */}
          {hasMagiOrb2 && (
            <motion.button
              onClick={() => { if (magiOrb2Cooldown <= 0) activateMagiOrb2(); }}
              disabled={magiOrb2Cooldown > 0}
              whileHover={magiOrb2Cooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={magiOrb2Cooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#6644ff", magiOrb2Active, magiOrb2Cooldown > 0)}
            >
              <TA color="#6644ff" /><SL />
              {magiOrb2Cooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${(1 - magiOrb2Cooldown / magiOrb2MaxCooldown) * 100}%`,
                  background: "linear-gradient(to top,#6644ff55,#6644ff28)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #6644ff88)", display: "flex" }}>
                  <IconPhase />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {magiOrb2Cooldown > 0 ? `${Math.ceil(magiOrb2Cooldown)}s` : "PHASE"}
                </span>
              </div>
            </motion.button>
          )}

          {/* Homing (Orb 3) */}
          {hasMagiOrb3 && (
            <motion.button
              onClick={() => { if (magiOrb3Cooldown <= 0) activateMagiOrb3(); }}
              disabled={magiOrb3Cooldown > 0}
              whileHover={magiOrb3Cooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={magiOrb3Cooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#ffcc00", false, magiOrb3Cooldown > 0)}
            >
              <TA color="#ffcc00" /><SL />
              {magiOrb3Cooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${(1 - magiOrb3Cooldown / magiOrb3MaxCooldown) * 100}%`,
                  background: "linear-gradient(to top,#ffcc0055,#ffcc0028)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #ffcc0088)", display: "flex" }}>
                  <IconHoming />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {magiOrb3Cooldown > 0 ? `${Math.ceil(magiOrb3Cooldown)}s` : "HOMING"}
                </span>
              </div>
            </motion.button>
          )}

          {/* Barrier (Orb 4) */}
          {hasMagiOrb4 && (
            <motion.button
              onClick={() => { if (magiOrb4Cooldown <= 0) activateMagiOrb4(0); }}
              disabled={magiOrb4Cooldown > 0}
              whileHover={magiOrb4Cooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={magiOrb4Cooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#ff8800", magiOrb4Active, magiOrb4Cooldown > 0)}
            >
              <TA color="#ff8800" /><SL />
              {magiOrb4Cooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${(1 - magiOrb4Cooldown / magiOrb4MaxCooldown) * 100}%`,
                  background: "linear-gradient(to top,#ff880055,#ff880028)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #ff880088)", display: "flex" }}>
                  <IconBarrier />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {magiOrb4Cooldown > 0 ? `${Math.ceil(magiOrb4Cooldown)}s` : "BARRIER"}
                </span>
              </div>
            </motion.button>
          )}

          {/* HP display (Orb 5) — non-interactive */}
          {hasMagiOrb5 && (
            <div className="w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center gap-0.5"
              style={abtn("#00ffcc", false, false)}>
              <TA color="#00ffcc" /><SL />
              <span style={{ fontSize: "1.2rem", lineHeight: 1, color: "#00ffcc", filter: "drop-shadow(0 0 5px #00ffcc88)", display: "flex" }}>
                <IconHP />
              </span>
              <span style={{ color: "#00ffcc", fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1 }}>
                {magiOrb5HP}/{magiOrb5MaxHP} HP
              </span>
            </div>
          )}

          {/* Slow (Orb 7) */}
          {hasMagiOrb7 && (
            <motion.button
              onClick={() => { if (magiOrb7Cooldown <= 0) activateMagiOrb7(); }}
              disabled={magiOrb7Cooldown > 0}
              whileHover={magiOrb7Cooldown <= 0 ? { scale: 1.07, y: -2 } : {}}
              whileTap={magiOrb7Cooldown <= 0 ? { scale: 0.93 } : {}}
              className="w-16 h-16 md:w-20 md:h-20"
              style={abtn("#00ddaa", magiOrb7Active, magiOrb7Cooldown > 0)}
            >
              <TA color="#00ddaa" /><SL />
              {magiOrb7Cooldown > 0 && (
                <div className="absolute bottom-0 left-0 right-0" style={{
                  height: `${(1 - magiOrb7Cooldown / magiOrb7MaxCooldown) * 100}%`,
                  background: "linear-gradient(to top,#00ddaa55,#00ddaa28)",
                }} />
              )}
              <div className="relative flex flex-col items-center justify-center h-full gap-0.5">
                <span style={{ fontSize: "1.2rem", lineHeight: 1, filter: "drop-shadow(0 0 5px #00ddaa88)", display: "flex" }}>
                  <IconSlow />
                </span>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85 }}>
                  {magiOrb7Cooldown > 0 ? `${Math.ceil(magiOrb7Cooldown)}s` : "SLOW"}
                </span>
              </div>
            </motion.button>
          )}
        </div>
      )}

    </div>
  );
}
