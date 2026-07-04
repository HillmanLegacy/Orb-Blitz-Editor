import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ─── Types ────────────────────────────────────────────────────────────────────
type AnimPhase = "idle" | "flying" | "converge" | "flash" | "title" | "waiting" | "menu" | "done";
export type MenuState = "root" | "modes" | "guide" | "settings" | "worlds" | "levels";

interface StartupAnimationProps {
  skipIntro?: boolean;
  initialState?: MenuState;
  onMenuReady?: () => void;
}

// ─── Orb field constants (same as original) ───────────────────────────────────
const ORB_COLORS = ["#00ffff","#ff00ff","#ffff00","#aa00ff","#00ff88","#ff8800","#ffffff","#00aaff"];

interface OrbDef {
  startX: number; startY: number; convX: number; convY: number;
  orbitX: number; orbitY: number; size: number; blur: number;
  color: string; delay: number;
}

const ORB_COUNT = 30;
const orbDefs: OrbDef[] = Array.from({ length: ORB_COUNT }, (_, i) => {
  const sa = (i / ORB_COUNT) * Math.PI * 2 + (i % 3) * 0.25;
  const sd = 380 + (i % 5) * 55;
  const oa = (i / ORB_COUNT) * Math.PI * 2;
  return {
    startX: Math.cos(sa) * sd, startY: Math.sin(sa) * sd * 0.6,
    convX:  Math.cos(sa * 1.8) * 18, convY: Math.sin(sa * 1.8) * 14,
    orbitX: Math.cos(oa) * (255 + (i % 4) * 18),
    orbitY: Math.sin(oa) * (90  + (i % 3) * 12),
    size: 9 + (i % 5) * 5, blur: 3 + (i % 4) * 2,
    color: ORB_COLORS[i % ORB_COLORS.length], delay: i * 0.05,
  };
});

function getOrbTarget(orb: OrbDef, phase: AnimPhase) {
  switch (phase) {
    case "idle":    return { x: orb.startX, y: orb.startY, scale: 0,   opacity: 0   };
    case "flying":  return { x: orb.startX * 0.08, y: orb.startY * 0.08, scale: 1, opacity: 0.9 };
    case "converge":return { x: orb.convX,  y: orb.convY,  scale: 1.2, opacity: 1.0 };
    case "flash":   return { x: orb.convX * 1.6, y: orb.convY * 1.6, scale: 1.6, opacity: 1.0 };
    default:        return { x: orb.orbitX, y: orb.orbitY, scale: 0.8, opacity: 0.48 };
  }
}
type BezierTuple = [number, number, number, number];
function getOrbTransition(phase: AnimPhase, delay: number) {
  if (phase === "flying")  return { duration: 2.4, delay, ease: [0.16,1,0.3,1] as BezierTuple };
  if (phase === "converge")return { duration: 0.65, ease: "easeOut" as const };
  if (phase === "flash")   return { duration: 0.28, ease: "easeOut" as const };
  if (phase === "title")   return { duration: 1.4, ease: [0.34,1.26,0.64,1] as BezierTuple };
  if (phase === "done")    return { duration: 0.6, ease: "easeIn" as const };
  return { duration: 0.3 };
}

// ─── World palette (9 worlds, spans the title gradient arc) ──────────────────
const WORLD_COLORS = [
  "#00ffff","#22ddff","#6699ff","#8844ff","#cc22ff",
  "#ff00ff","#ff44aa","#ff7700","#ffcc00",
];
const WORLD_SHADOWS = WORLD_COLORS.map(c => c + "55");

// ─── Level helpers (from original LevelSelect) ────────────────────────────────
const getStoredProgress = (): number => {
  try {
    const s = localStorage.getItem("orblitz_arcade_progress");
    if (s) return (JSON.parse(s) as { highestLevel: number }).highestLevel;
  } catch {}
  return 1.1;
};
const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  return (15 + (world - 1) * 10) + (sub - 1) * 5;
};

// ─── Dev-mode easter egg ──────────────────────────────────────────────────────
const DEV_SEQUENCE = ["O","R","B","L","I","T","Z"] as const;
const TITLE_LETTERS = ["O","R","B","L","I","T","Z"];

// ─── Button row definitions ───────────────────────────────────────────────────
interface BtnDef {
  id: string; icon: string; label: string;
  color: string; shadow: string; action: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StartupAnimation({
  skipIntro = false,
  initialState = "root",
  onMenuReady,
}: StartupAnimationProps) {
  const [animPhase, setAnimPhase] = useState<AnimPhase>(skipIntro ? "menu" : "idle");
  const [menuState, setMenuState] = useState<MenuState>(skipIntro ? initialState : "root");
  const [selectedWorld, setSelectedWorld] = useState(1);
  const [devProgress, setDevProgress] = useState(0);
  const [devFlash, setDevFlash]       = useState(false);
  const [highestLevel, setHighestLevel] = useState(1.1);
  const [pressedBtn, setPressedBtn]   = useState<string | null>(null);

  const { playOrbWhoosh, playOrbConverge, playTitleReveal, startMenuMusic, playMenuSelect, isMuted, toggleMute } = useAudio();
  const { openShop, openInventory, activateDevMode, coins: shopStars, devMode } = useShop();
  const { setGameMode, startLoading } = useMagicOrb();

  // Reload progress when entering menu
  useEffect(() => {
    setHighestLevel(getStoredProgress());
  }, [menuState]);

  // Intro sequence
  useEffect(() => {
    try { startMenuMusic(); } catch {}
    if (skipIntro) { onMenuReady?.(); return; }
    const t0 = setTimeout(() => { setAnimPhase("flying");   try { playOrbWhoosh();   } catch {} }, 150);
    const t1 = setTimeout(() => { setAnimPhase("converge"); try { playOrbConverge(); } catch {} }, 2700);
    const t2 = setTimeout(() => { setAnimPhase("flash"); },                                        3250);
    const t3 = setTimeout(() => { setAnimPhase("title");    try { playTitleReveal(); } catch {} }, 3600);
    const t4 = setTimeout(() => { setAnimPhase("waiting"); },                                      5100);
    return () => [t0,t1,t2,t3,t4].forEach(clearTimeout);
  }, []);

  const handleTap = useCallback(() => {
    if (animPhase === "waiting") { setAnimPhase("menu"); onMenuReady?.(); }
  }, [animPhase, onMenuReady]);

  const handleLetterClick = useCallback((letter: string, idx: number) => {
    const expected = DEV_SEQUENCE[devProgress];
    if (letter === expected && idx === devProgress) {
      const next = devProgress + 1;
      if (next === DEV_SEQUENCE.length) {
        activateDevMode(); setDevFlash(true); setDevProgress(0);
        setTimeout(() => setDevFlash(false), 700);
      } else { setDevProgress(next); }
    } else { setDevProgress(letter === DEV_SEQUENCE[0] ? 1 : 0); }
  }, [devProgress, activateDevMode]);

  const btn = useCallback((id: string) => { try { playMenuSelect(); } catch {} }, [playMenuSelect]);

  const handleStartMode = useCallback((mode: string) => {
    btn(mode); setGameMode(mode as any); startLoading("entering");
  }, [btn, setGameMode, startLoading]);

  const isLevelUnlocked = (level: number) => devMode || level <= highestLevel + 0.01;
  const isBossLevel     = (level: number) => Math.round((level % 1) * 10) === 9;
  const isWorldUnlocked = (w: number)     => devMode || (w + 0.1) <= highestLevel + 0.01;

  // ── Button definitions per state ──────────────────────────────────────────
  const getPanelButtons = useCallback((): BtnDef[] => {
    const back = (label: string, action: () => void): BtnDef =>
      ({ id: "back", icon: "←", label, color: "#778", shadow: "rgba(119,119,136,0.2)", action });

    switch (menuState) {
      case "root": return [
        { id:"play",      icon:"▶", label:"PLAY",  color:"#00ffff", shadow:"rgba(0,255,255,0.45)",   action: () => { btn("play");      setMenuState("modes");    } },
        { id:"guide",     icon:"?", label:"GUIDE", color:"#8844ff", shadow:"rgba(136,68,255,0.4)",   action: () => { btn("guide");     setMenuState("guide");    } },
        { id:"shop",      icon:"★", label:"SHOP",  color:"#ff00ff", shadow:"rgba(255,0,255,0.4)",    action: () => { btn("shop");      openShop();               } },
        { id:"inventory", icon:"⊞", label:"GEAR",  color:"#ff7700", shadow:"rgba(255,119,0,0.4)",    action: () => { btn("inventory"); openInventory();          } },
        { id:"settings",  icon:"⚙", label:"OPTS",  color:"#ddcc00", shadow:"rgba(221,204,0,0.35)",   action: () => { btn("settings");  setMenuState("settings"); } },
      ];
      case "modes": return [
        { id:"survival",  icon:"⚡", label:"SURVIVE",  color:"#00ffff", shadow:"rgba(0,255,255,0.45)",  action: () => handleStartMode("survival")  },
        { id:"chill",     icon:"≋",  label:"CHILL",    color:"#8844ff", shadow:"rgba(136,68,255,0.4)",  action: () => handleStartMode("chill")     },
        { id:"arcade",    icon:"◆",  label:"ARCADE",   color:"#ff00ff", shadow:"rgba(255,0,255,0.4)",   action: () => { btn("arcade"); setMenuState("worlds"); } },
        { id:"gauntlet",  icon:"◎",  label:"GAUNTLET", color:"#ff7700", shadow:"rgba(255,119,0,0.4)",   action: () => handleStartMode("gauntlet")  },
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "guide": return [
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "settings": return [
        { id:"sound", icon: isMuted ? "○" : "♪", label: isMuted ? "MUTED" : "SOUND",
          color: isMuted ? "#556" : "#00ffff", shadow: isMuted ? "transparent" : "rgba(0,255,255,0.4)",
          action: () => { btn("sound"); toggleMute(); } },
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "worlds": return [
        back("BACK", () => { btn("back"); setMenuState("modes"); }),
      ];
      case "levels": return [
        back("WORLDS", () => { btn("back"); setMenuState("worlds"); }),
      ];
    }
  }, [menuState, isMuted, btn, openShop, openInventory, toggleMute, handleStartMode]);

  // ── Content panels ────────────────────────────────────────────────────────
  const renderContent = () => {
    const col = (c: string) => ({ color: c });

    if (menuState === "guide") return (
      <div className="space-y-3 pb-1 text-sm">
        <Section title="Controls" color="#00ffff">
          <Row label="Tap" val="Fire projectile" />
          <Row label="Hold" val="Rapid fire" />
          <Row label="Pause btn" val="Pause / abilities" />
        </Section>
        <Section title="Game Modes" color="#8844ff">
          <Row label="Survive" val="Classic — orbs accelerate over time" />
          <Row label="Chill" val="Relaxed — constant speed, no game over" />
          <Row label="Arcade" val="Level-based stages, epic boss fights" />
          <Row label="Gauntlet" val="Miss one shot and it's over" />
        </Section>
        <Section title="Power-Ups" color="#ff00ff">
          <Row label="⚡ Charge" val="Burst of energy" />
          <Row label="🛡 Shield" val="Block one hit" />
          <Row label="❤ Heal" val="Restore one health" />
          <Row label="↯ Distort" val="Freeze nearby orbs" />
          <Row label="★★ 2× Stars" val="Double coin drops" />
          <Row label="〰 Rapid" val="Fire rate boost" />
        </Section>
        <Section title="Tips" color="#ff7700">
          <Row label="Loadout" val="Equip weapons & defenses before playing" />
          <Row label="Shop" val="Spend stars on skins, trails, Magi-Orbs" />
          <Row label="Boss fights" val="Dodge orb barrages, target the shield first" />
        </Section>
      </div>
    );

    if (menuState === "settings") return (
      <div className="space-y-3 pb-1">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">Sound</p>
            <p className="text-white/50 text-xs mt-0.5">Toggle game audio</p>
          </div>
          <motion.button
            onClick={toggleMute}
            className="relative flex-none"
            style={{ width: 52, height: 30, borderRadius: 15,
              background: !isMuted ? "linear-gradient(90deg,#00ffff,#8844ff)" : "#334" }}
            whileTap={{ scale: 0.92 }}
          >
            <motion.div className="absolute top-[3px] w-6 h-6 rounded-full bg-white shadow"
              animate={{ left: !isMuted ? "calc(100% - 27px)" : 3 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="font-bold text-white text-sm mb-2">Controls</p>
          <Row label="Tap" val="Shoot" />
          <Row label="Hold" val="Rapid fire" />
          <Row label="Pause" val="Access menu / abilities" />
        </div>
      </div>
    );

    if (menuState === "worlds") return (
      <div>
        <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">Select World</p>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, i) => i + 1).map(w => {
            const unlocked = isWorldUnlocked(w);
            const wc = WORLD_COLORS[w - 1];
            const done = w + 0.9 <= highestLevel + 0.01;
            return (
              <motion.button key={w}
                onClick={() => { if (unlocked) { btn(`w${w}`); setSelectedWorld(w); setMenuState("levels"); } }}
                disabled={!unlocked}
                className="relative flex flex-col items-center justify-center aspect-square rounded-xl font-black"
                style={{
                  background: unlocked ? `linear-gradient(145deg, ${wc}22, ${wc}0a)` : "rgba(20,20,30,0.6)",
                  border: `1.5px solid ${unlocked ? wc + "66" : "#33355555"}`,
                  boxShadow: unlocked ? `0 0 12px ${wc}30` : "none",
                  color: unlocked ? wc : "#445",
                  cursor: unlocked ? "pointer" : "default",
                  fontSize: "clamp(0.9rem, 3vw, 1.3rem)",
                }}
                whileHover={unlocked ? { scale: 1.06 } : {}}
                whileTap={unlocked ? { scale: 0.92 } : {}}
              >
                {unlocked ? (
                  <>
                    <span>{w}</span>
                    <span style={{ fontSize: "0.45em", opacity: 0.65, letterSpacing: "0.1em", marginTop: 2 }}>WORLD</span>
                    {done && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: wc }} />}
                  </>
                ) : (
                  <span style={{ fontSize: "1.2em", opacity: 0.4 }}>🔒</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );

    if (menuState === "levels") {
      const wc = WORLD_COLORS[selectedWorld - 1];
      return (
        <div>
          <p className="text-center font-black mb-3" style={{ color: wc, fontSize: "clamp(0.75rem, 2.5vw, 1rem)", letterSpacing: "0.15em" }}>
            WORLD {selectedWorld}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => i + 1).map(sub => {
              const level = selectedWorld + sub / 10;
              const unlocked = isLevelUnlocked(level);
              const boss = isBossLevel(level);
              const completed = level <= highestLevel;
              const bc = boss ? "#ff4444" : wc;
              return (
                <motion.button key={sub}
                  onClick={() => { if (unlocked) { btn(`l${level}`); setGameMode("arcade"); startLoading("nextLevel", level); } }}
                  disabled={!unlocked}
                  className="relative flex flex-col items-center justify-center aspect-square rounded-xl font-bold"
                  style={{
                    background: unlocked ? `linear-gradient(145deg, ${bc}22, ${bc}0a)` : "rgba(20,20,30,0.6)",
                    border: `1.5px solid ${unlocked ? bc + "66" : "#333"}`,
                    boxShadow: unlocked ? `0 0 10px ${bc}28` : "none",
                    color: unlocked ? bc : "#445",
                    cursor: unlocked ? "pointer" : "default",
                    fontSize: "clamp(0.75rem, 2.5vw, 1rem)",
                  }}
                  whileHover={unlocked ? { scale: 1.07 } : {}}
                  whileTap={unlocked ? { scale: 0.9 } : {}}
                >
                  {unlocked ? (
                    <>
                      <span>{selectedWorld}.{sub}</span>
                      <span style={{ fontSize: "0.45em", opacity: 0.7, marginTop: 2, letterSpacing: "0.06em" }}>
                        {boss ? "BOSS" : `${getOrbGoal(selectedWorld, sub)} orbs`}
                      </span>
                      {completed && <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: bc }} />}
                    </>
                  ) : (
                    <span style={{ fontSize: "1.1em", opacity: 0.35 }}>🔒</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const showTitle   = animPhase === "title" || animPhase === "waiting" || animPhase === "menu";
  const showWaiting = animPhase === "waiting";
  const showMenu    = animPhase === "menu";
  const isContent   = showMenu && (menuState === "guide" || menuState === "settings" || menuState === "worlds" || menuState === "levels");
  const isClickable = animPhase === "waiting";
  const panelButtons = showMenu ? getPanelButtons() : [];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black select-none"
      style={{ cursor: isClickable ? "pointer" : "default" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      onClick={isClickable ? handleTap : undefined}
      onTouchStart={isClickable ? handleTap : undefined}
    >
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.011) 3px,rgba(0,255,255,0.011) 4px)",
      }} />

      {/* Orbs */}
      {orbDefs.map((orb, i) => (
        <motion.div key={i} className="absolute rounded-full pointer-events-none" style={{
          width: orb.size, height: orb.size,
          left: "50%", top: "50%",
          marginLeft: -orb.size / 2, marginTop: -orb.size / 2,
          background: `radial-gradient(circle at 38% 32%, ${orb.color}ff, ${orb.color}88 45%, transparent 75%)`,
          filter: `blur(${orb.blur}px)`,
          boxShadow: `0 0 ${orb.size * 1.2}px ${orb.color}44`,
          zIndex: 2,
        }}
          animate={getOrbTarget(orb, animPhase)}
          transition={getOrbTransition(animPhase, orb.delay)}
        />
      ))}

      {/* Convergence core */}
      <AnimatePresence>
        {(animPhase === "converge" || animPhase === "flash") && (
          <motion.div className="absolute rounded-full pointer-events-none" style={{
            width: 120, height: 120, left: "50%", top: "50%",
            marginLeft: -60, marginTop: -60,
            background: "radial-gradient(circle,#ffffff 0%,#00ffff 30%,#ff00ff 60%,transparent 80%)",
            filter: "blur(18px)", zIndex: 3,
          }}
            initial={{ scale: 0, opacity: 0 }}
            animate={animPhase === "flash" ? { scale: [0.5,2.8,0.3], opacity: [0.8,1,0] } : { scale: 0.5, opacity: 0.6 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: animPhase === "flash" ? 0.55 : 0.4, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Halo ring */}
      <AnimatePresence>
        {showTitle && (
          <motion.div className="absolute rounded-full pointer-events-none" style={{
            width: 580, height: 200, left: "50%", top: "50%",
            marginLeft: -290, marginTop: -100,
            boxShadow: "inset 0 0 0 1px rgba(0,255,255,0.06)", filter: "blur(1px)", zIndex: 3,
          }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* ── ORBLITZ TITLE — always stays centered ────────────────────────── */}
      <AnimatePresence>
        {showTitle && (
          <motion.div className="absolute z-10 text-center"
            initial={{ opacity: 0, scale: 0.65, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* Letters clickable in menu phase for dev-mode easter egg */}
            {showMenu ? (
              <motion.h1
                className="font-black tracking-widest flex items-center justify-center"
                style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)", lineHeight: 1 }}
                animate={{ filter: devFlash
                  ? "drop-shadow(0 0 30px #ffff00) drop-shadow(0 0 60px #ffaa00)"
                  : ["drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                     "drop-shadow(0 0 28px rgba(255,0,255,0.6)) drop-shadow(0 0 56px rgba(0,255,255,0.3))",
                     "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))"],
                }}
                transition={{ duration: devFlash ? 0.1 : 2.2, repeat: devFlash ? 0 : Infinity, ease: "easeInOut" }}
              >
                {TITLE_LETTERS.map((letter, idx) => (
                  <motion.span key={idx} className="cursor-pointer"
                    style={{
                      backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 45%,#ff00ff 75%,#ffff00 100%)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                      opacity: idx < devProgress ? 0.4 : 1,
                    }}
                    whileHover={{ scale: 1.14, y: -3 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); handleLetterClick(letter, idx); }}
                  >{letter}</motion.span>
                ))}
              </motion.h1>
            ) : (
              <motion.h1 className="font-black tracking-widest text-transparent bg-clip-text pointer-events-none"
                style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)", lineHeight: 1,
                  backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 45%,#ff00ff 75%,#ffff00 100%)" }}
                animate={{ filter: [
                  "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                  "drop-shadow(0 0 28px rgba(255,0,255,0.6)) drop-shadow(0 0 56px rgba(0,255,255,0.3))",
                  "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                ]}}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >ORBLITZ</motion.h1>
            )}

            {/* Underline */}
            <motion.div className="mt-3 mx-auto" style={{
              height: 1, width: "clamp(160px, 36vw, 280px)",
              background: "linear-gradient(90deg,transparent,#00ffff 35%,#ff00ff 65%,transparent)",
            }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.65 }}
              transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
            />

            {/* Stars badge — menu only */}
            <AnimatePresence>
              {showMenu && (
                <motion.div className="mt-2 flex items-center justify-center gap-1.5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <span style={{ color: "#ffd700", fontSize: "0.78rem" }}>★</span>
                  <span style={{ color: "#fde68a", fontSize: "0.78rem", fontWeight: 700 }}>{shopStars}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAP TO START ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWaiting && (
          <motion.div className="absolute bottom-20 md:bottom-24 text-center z-10 pointer-events-none"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: [0, 0.9, 0.55, 0.9], y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-lg md:text-xl font-semibold tracking-[0.22em] uppercase"
              style={{ color: "rgba(0,255,255,0.8)", textShadow: "0 0 18px rgba(0,255,255,0.45)" }}>
              Tap to Start
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM PANEL — morphs between button-only and full content ────── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col overflow-hidden"
            style={{ borderRadius: isContent ? "20px 20px 0 0" : 0 }}
            animate={{
              opacity: 1,
              y: 0,
              minHeight: isContent ? "clamp(300px,52vh,440px)" : 0,
              background: isContent ? "rgba(4,4,18,0.90)" : "transparent",
              borderTop: isContent ? "1px solid rgba(0,255,255,0.13)" : "1px solid transparent",
              backdropFilter: isContent ? "blur(24px)" : "none",
            }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            initial={{ opacity: 0, y: 20 }}
            exit={{ opacity: 0, y: 12 }}
          >
            {/* Scrollable content area */}
            <AnimatePresence mode="wait">
              {isContent && (
                <motion.div
                  key={menuState}
                  className="flex-1 overflow-y-auto px-4 pt-4 pb-1 min-h-0"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,255,255,0.2) transparent" }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  {renderContent()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Button row — morphs per state */}
            <div className="flex-none py-4 px-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={menuState}
                  className="flex flex-row items-stretch justify-center"
                  style={{ gap: "clamp(6px,1.8vw,16px)" }}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={{
                    visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
                    hidden:  { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
                  }}
                >
                  {panelButtons.map((b) => {
                    const isPress = pressedBtn === b.id;
                    return (
                      <motion.button key={b.id}
                        className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
                        style={{
                          minWidth: 0,
                          maxWidth: panelButtons.length === 1 ? "clamp(140px,36vw,220px)"
                                  : panelButtons.length === 2 ? "clamp(100px,24vw,160px)"
                                  : "clamp(56px,17vw,100px)",
                          height: "clamp(68px,12vw,96px)",
                          borderRadius: "clamp(10px,1.6vw,14px)",
                          border: `1.5px solid ${isPress ? b.color + "cc" : b.color + "55"}`,
                          background: isPress
                            ? `${b.color}20`
                            : `linear-gradient(160deg,${b.color}10 0%,${b.color}06 100%)`,
                          color: b.color,
                          boxShadow: isPress
                            ? `0 0 24px ${b.shadow}, 0 0 48px ${b.shadow}, inset 0 0 14px ${b.color}14`
                            : `0 0 12px ${b.shadow}, inset 0 1px 0 ${b.color}14`,
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                          transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
                        }}
                        variants={{
                          hidden:  { opacity: 0, y: 22, scale: 0.85 },
                          visible: { opacity: 1, y: 0, scale: 1,
                            transition: { type: "spring", stiffness: 360, damping: 26 } },
                        }}
                        whileTap={{ scale: 0.9 }}
                        onHoverStart={() => setPressedBtn(b.id)}
                        onHoverEnd={() => setPressedBtn(null)}
                        onPointerDown={() => setPressedBtn(b.id)}
                        onPointerUp={() => setPressedBtn(null)}
                        onPointerLeave={() => setPressedBtn(null)}
                        onClick={b.action}
                      >
                        {/* Top accent */}
                        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
                          height: 2,
                          background: `linear-gradient(90deg,transparent 8%,${b.color}88 50%,transparent 92%)`,
                          opacity: isPress ? 1 : 0.55, transition: "opacity 0.14s",
                        }} />
                        {/* Scanlines */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
                          borderRadius: "inherit",
                        }} />
                        {/* Icon */}
                        <span style={{
                          fontSize: "clamp(1.2rem,3.2vw,1.8rem)", lineHeight: 1,
                          marginBottom: "clamp(2px,0.6vw,5px)",
                          filter: `drop-shadow(0 0 5px ${b.color}88)`, display: "block",
                        }}>{b.icon}</span>
                        {/* Label */}
                        <span style={{
                          fontSize: "clamp(0.48rem,1.25vw,0.68rem)",
                          fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88,
                        }}>{b.label}</span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Small helpers for guide content ─────────────────────────────────────────
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white/[0.03] px-3 pt-2 pb-3" style={{ borderColor: color + "33" }}>
      <p className="font-black text-xs uppercase tracking-widest mb-2" style={{ color }}>{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-white/60 flex-none w-20 shrink-0 font-semibold">{label}</span>
      <span className="text-white/80">{val}</span>
    </div>
  );
}
