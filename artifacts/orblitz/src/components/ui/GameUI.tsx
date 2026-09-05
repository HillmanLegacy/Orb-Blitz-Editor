import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { StarHUDIcon } from "./StarHUDIcon";
import { HealthBar } from "./HealthBar";

// ── Design primitives — matches main menu aesthetic ────────────────────────────
const SCANLINES = "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)";
const UI_TIMER_FREQUENCY = 20;

// Gameplay timers continue to advance at frame cadence in the store. The HUD only
// needs a smooth visual sample, so avoid re-rendering the full overlay for every
// sub-frame timer change while retaining 50 ms countdown accuracy.
const selectUiTimer = (value: number) =>
  value <= 0 ? 0 : Math.ceil(value * UI_TIMER_FREQUENCY) / UI_TIMER_FREQUENCY;

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
    score, hasShield, hasChargeBeam, chargeBeamTimer,
    gameTime, hasDistort, distortCooldown, distortMaxCooldown, distortActive,
    distortTimer, hasDoubleCoins, doubleCoinsTimer, hasRapidFire, rapidFireTimer,
    selectedWeapon, setSelectedWeapon, pauseGame, activateDistortField, gameMode,
    arcadeLevel, orbsDestroyedInLevel, orbsRequiredForLevel, hasBoss, bossHealth,
    bossMaxHealth, teletransferCooldown, teletransferMaxCooldown, pulseShieldCooldown,
    pulseShieldMaxCooldown, activatePulseShield, magiOrb2Active,
    magiOrb2Cooldown, magiOrb2MaxCooldown, activateMagiOrb2, magiOrb3Cooldown,
    magiOrb3MaxCooldown, activateMagiOrb3, magiOrb4Active, magiOrb4Cooldown,
    magiOrb4MaxCooldown, activateMagiOrb4, magiOrb5HP, magiOrb5MaxHP,
    magiOrb7Active, magiOrb7Cooldown, magiOrb7MaxCooldown, activateMagiOrb7,
    comboCount, comboTier, comboMeterProgress, comboTimeRemaining,
  } = useMagicOrb(useShallow((s) => ({
    score: s.score, hasShield: s.hasShield,
    hasChargeBeam: s.hasChargeBeam, chargeBeamTimer: selectUiTimer(s.chargeBeamTimer),
    gameTime: Math.floor(s.gameTime), hasDistort: s.hasDistort,
    distortCooldown: selectUiTimer(s.distortCooldown), distortMaxCooldown: s.distortMaxCooldown,
    distortActive: s.distortActive, distortTimer: selectUiTimer(s.distortTimer),
    hasDoubleCoins: s.hasDoubleCoins, doubleCoinsTimer: selectUiTimer(s.doubleCoinsTimer),
    hasRapidFire: s.hasRapidFire, rapidFireTimer: selectUiTimer(s.rapidFireTimer),
    selectedWeapon: s.selectedWeapon, setSelectedWeapon: s.setSelectedWeapon,
    pauseGame: s.pauseGame, activateDistortField: s.activateDistortField,
    gameMode: s.gameMode, arcadeLevel: s.arcadeLevel,
    orbsDestroyedInLevel: s.orbsDestroyedInLevel, orbsRequiredForLevel: s.orbsRequiredForLevel,
    hasBoss: s.boss !== null, bossHealth: s.boss?.health ?? 0, bossMaxHealth: s.boss?.maxHealth ?? 0,
    teletransferCooldown: selectUiTimer(s.teletransferCooldown),
    teletransferMaxCooldown: s.teletransferMaxCooldown,
    pulseShieldCooldown: selectUiTimer(s.pulseShieldCooldown),
    pulseShieldMaxCooldown: s.pulseShieldMaxCooldown, activatePulseShield: s.activatePulseShield,
    magiOrb2Active: s.magiOrb2Active,
    magiOrb2Cooldown: selectUiTimer(s.magiOrb2Cooldown), magiOrb2MaxCooldown: s.magiOrb2MaxCooldown,
    activateMagiOrb2: s.activateMagiOrb2, magiOrb3Cooldown: selectUiTimer(s.magiOrb3Cooldown),
    magiOrb3MaxCooldown: s.magiOrb3MaxCooldown, activateMagiOrb3: s.activateMagiOrb3,
    magiOrb4Active: s.magiOrb4Active, magiOrb4Cooldown: selectUiTimer(s.magiOrb4Cooldown),
    magiOrb4MaxCooldown: s.magiOrb4MaxCooldown, activateMagiOrb4: s.activateMagiOrb4,
    magiOrb5HP: s.magiOrb5HP, magiOrb5MaxHP: s.magiOrb5MaxHP,
    magiOrb7Active: s.magiOrb7Active, magiOrb7Cooldown: selectUiTimer(s.magiOrb7Cooldown),
    magiOrb7MaxCooldown: s.magiOrb7MaxCooldown, activateMagiOrb7: s.activateMagiOrb7,
     comboCount: s.combo.count, comboTier: s.combo.tier,
     comboMeterProgress: s.combo.meterProgress,
     comboTimeRemaining: selectUiTimer(s.combo.timeRemaining),
  })));
  const { toggleMute, isMuted, playUiClick } = useAudio(useShallow((s) => ({
    toggleMute: s.toggleMute, isMuted: s.isMuted, playUiClick: s.playUiClick,
  })));
  const { coins: shopStars, equippedWeapon, equippedDefenses, equippedMagiOrb } = useShop(useShallow((s) => ({
    coins: s.coins, equippedWeapon: s.equippedWeapon, equippedDefenses: s.equippedDefenses, equippedMagiOrb: s.equippedMagiOrb,
  })));

  const hasRapidBlaster = equippedWeapon === "orbital_rapid_blaster";
  const hasTeletransfer = equippedDefenses[0] === "orbital_teletransfer" || equippedDefenses[1] === "orbital_teletransfer";
  const hasDistortFieldDefense = equippedDefenses[0] === "distort_field" || equippedDefenses[1] === "distort_field";
  const hasPulseShield = equippedDefenses[0] === "pulse_shield" || equippedDefenses[1] === "pulse_shield";
  const hasSpatialRelocation = equippedDefenses[0] === "spatial_relocation" || equippedDefenses[1] === "spatial_relocation";
  
  const hasMagiOrb2 = equippedMagiOrb === "magi_orb_2";
  const hasMagiOrb3 = equippedMagiOrb === "magi_orb_3";
  const hasMagiOrb4 = equippedMagiOrb === "magi_orb_4";
  const hasMagiOrb5 = equippedMagiOrb === "magi_orb_5";
  const hasMagiOrb7 = equippedMagiOrb === "magi_orb_7";
  
  const boss = hasBoss ? { health: bossHealth, maxHealth: bossMaxHealth } : null;
  const isBossLevel = hasBoss;

  const distortCooldownPct    = hasDistort ? (1 - distortCooldown / distortMaxCooldown) * 100 : 0;
  const teletransferCooldownPct = hasTeletransfer ? (1 - teletransferCooldown / teletransferMaxCooldown) * 100 : 0;

  // ── Minute:second timer string ─────────────────────────────────────────────
  const timerStr = `${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, "0")}`;

  const soundColor = isMuted ? "#667788" : "#00ffff";
  const soundShadow = isMuted ? "rgba(100,110,130,0.2)" : "rgba(0,255,255,0.45)";

  return (
    <div className="fixed inset-0 pointer-events-none z-40 orblitz-game-hud">

      {/* ── TOP ROW ──────────────────────────────────────────────────────────── */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 flex justify-between items-start orblitz-hud-top">

        {/* LEFT: health + active power-up banners */}
        <div className="flex flex-col gap-2 pointer-events-auto orblitz-hud-left">

          {/* Health bar */}
          <HealthBar />

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
        <div className="flex flex-col items-end gap-1.5 md:gap-2 pointer-events-auto orblitz-hud-right">

          {/* Score */}
          <motion.div
            className="px-3 md:px-5 py-1.5 md:py-2.5 orblitz-score-card"
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
          <div className="orblitz-stars-card" style={{
            ...pnl("#ffd700", true),
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px 6px 6px",
            minWidth: 112,
          }}>
            <TA color="#ffd700" /><SL />
            {/* 3-D spinning star model */}
            <Suspense fallback={
              <div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.4rem", filter: "drop-shadow(0 0 6px #ffd700)" }}>★</div>
            }>
              <StarHUDIcon size={44} />
            </Suspense>
            {/* Counter */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em",
                             color: "#fde68a", opacity: 0.65, textTransform: "uppercase" }}>
                Stars
              </span>
              <motion.span
                key={shopStars}
                initial={{ scale: 1.35, color: "#ffffff" }}
                animate={{ scale: 1, color: "#ffd700" }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                style={{ fontSize: "1.35rem", fontWeight: 900, lineHeight: 1,
                         color: "#ffd700", textShadow: "0 0 12px #ffd70088" }}
              >
                {shopStars}
              </motion.span>
            </div>
          </div>

          {/* Timer */}
          <div className="px-2.5 md:px-3 py-1 orblitz-timer-card" style={pnl("#00ffff33".replace("33",""))}>
            <TA color="#00ffff" /><SL />
            <p className="text-xs md:text-sm font-bold tracking-widest" style={{ color: "rgba(0,255,255,0.65)", letterSpacing: "0.15em" }}>
              {timerStr}
            </p>
          </div>

          {/* Arcade level + boss */}
          {gameMode === "arcade" && (
            <motion.div
              className="px-3 py-2 min-w-[90px] orblitz-level-card"
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
                     <span className="orblitz-hud-alert-mark" aria-hidden="true" /> BOSS
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
            <div className="px-3 py-1.5 orblitz-mode-card" style={pnl("#00ffff")}>
              <TA color="#00ffff" /><SL />
              <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#00ffff", letterSpacing: "0.18em" }}>
                Chill Mode
              </p>
            </div>
          )}

          {/* Survival boss bar */}
          {gameMode === "survival" && isBossLevel && boss && (
            <motion.div
              className="px-3 py-2 orblitz-boss-card"
              style={pnl("#ff4466", true)}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <TA color="#ff4466" /><SL />
                <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#ff4466", letterSpacing: "0.15em" }}>
                 <span className="orblitz-hud-alert-mark" aria-hidden="true" /> SURVIVAL BOSS
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
                playUiClick();
                pauseGame();
                useOrbTransition.getState().pauseSweep();
              }}
              whileHover={{ scale: 1.06, y: -1 }}
              whileTap={{ scale: 0.93 }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 orblitz-hud-control"
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
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 orblitz-hud-control"
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

      {/* ── COMBO CHAIN ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {comboCount > 0 && (
          <motion.div
            key="combo-chain"
            role="status"
            aria-live="polite"
            className="absolute top-24 md:top-4 left-1/2 -translate-x-1/2 w-[min(13.5rem,calc(100vw-1.5rem))] pointer-events-none"
            initial={{ opacity: 0, y: -12, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          >
            <div className="px-3 py-2.5" style={pnl("#00ffff", true)}>
              <TA color="#00ffff" /><SL />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: "#7defff", opacity: 0.8 }}>
                    Combo
                  </p>
                  <p className="text-lg md:text-xl font-black leading-none" style={{
                    color: "#ffffff",
                    textShadow: "0 0 10px #00ffffaa",
                  }}>
                    {comboCount}×
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black tracking-[0.13em] uppercase" style={{ color: "#00ffff" }}>
                    {comboTier ?? "Building"}
                  </p>
                  <p className="text-[9px] font-bold tracking-widest" style={{ color: "#9bbbc4" }}>
                    {comboTimeRemaining.toFixed(2)}s
                  </p>
                </div>
              </div>
              <div
                className="relative mt-2 h-1.5 rounded-full overflow-hidden"
                role="progressbar"
                aria-label="Combo progression"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(comboMeterProgress * 100)}
                aria-valuetext={`${comboCount} combo${comboCount === 1 ? "" : "s"}; ${comboTimeRemaining.toFixed(2)} seconds remaining`}
                style={{ background: "rgba(0,255,255,0.12)", border: "1px solid #00ffff44" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${comboMeterProgress * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  style={{
                    background: "linear-gradient(90deg,#00aaff,#00ffff,#b8ffff)",
                    boxShadow: "0 0 10px #00ffffaa",
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ABILITY HOTBAR (bottom-left) ──────────────────────────────────────── */}
      {(hasDistort || hasDistortFieldDefense || hasTeletransfer || hasPulseShield ||
        hasMagiOrb2 || hasMagiOrb3 || hasMagiOrb4 || hasMagiOrb5 || hasMagiOrb7) && (
        <div className="absolute bottom-4 left-4 flex gap-2 md:gap-3 pointer-events-auto orblitz-ability-tray">

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
