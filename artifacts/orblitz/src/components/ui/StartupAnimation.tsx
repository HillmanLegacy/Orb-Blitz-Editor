import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconPlay()      { return <svg {..._svg}><path d="M7 4 L20 12 L7 20 Z" fill="currentColor" opacity="0.92"/></svg>; }
function IconShop()      { return <svg {..._svg}><path d="M6.5 7.5h11l-1.5 10h-8L6.5 7.5Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15"/><path d="M9.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>; }
function IconGear()      { return <svg {..._svg}><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.06" strokeDasharray="2 1.5"/></svg>; }
function IconSettings()  { return <svg {..._svg}><line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="7" r="2.2" fill="currentColor" fillOpacity="0.9"/><line x1="3" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="16" cy="14" r="2.2" fill="currentColor" fillOpacity="0.9"/></svg>; }
function IconSurvive()   { return <svg {..._svg}><circle cx="12" cy="12" r="2.8" fill="currentColor"/><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.2" opacity="0.55"/><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="0.8" opacity="0.25"/></svg>; }
function IconChill()     { return <svg {..._svg}><path d="M2 10 C5.5 7 7 13 10 10 S14.5 7 18 10 S21 13 22 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 15.5 C5.5 12.5 7 18.5 10 15.5 S14.5 12.5 18 15.5 S21 18.5 22 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/></svg>; }
function IconArcade()    { return <svg {..._svg}><rect x="4" y="14" width="16" height="7" rx="3" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1"/><path d="M12 14 L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15"/><circle cx="8" cy="17.5" r="1" fill="currentColor"/><circle cx="16" cy="17.5" r="1" fill="currentColor"/></svg>; }
function IconGauntlet()  { return <svg {..._svg}><path d="M12 3 L21 12 L12 21 L3 12 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.1"/><line x1="12" y1="7" x2="12" y2="17" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/><line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/><circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.9"/></svg>; }
function IconBack()      { return <svg {..._svg}><path d="M11 7 L6 12 L11 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12 H16 C18.2 12 20 13.8 20 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconSound()     { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.85"/><path d="M15 8 C17 9.5 17.5 11.5 17.5 12 S17 14.5 15 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M17.5 5.5 C20.5 7.5 21.5 9.8 21.5 12 S20.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconSoundOff()  { return <svg {..._svg}><path d="M4 9 H7 L12 5 V19 L7 15 H4 V9 Z" fill="currentColor" fillOpacity="0.5"/><line x1="16.5" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><line x1="22" y1="9" x2="16.5" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function IconBrightness(){ return <svg {..._svg}><circle cx="12" cy="12" r="3.8" fill="currentColor" fillOpacity="0.85"/><line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="4.93" y1="4.93" x2="7.07" y2="7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16.93" y1="16.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="19.07" y1="4.93" x2="16.93" y2="7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7.07" y1="16.93" x2="4.93" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }

// ─── Types ────────────────────────────────────────────────────────────────────
type AnimPhase = "idle" | "flying" | "converge" | "flash" | "title" | "waiting" | "menu" | "done";
export type MenuState = "root" | "modes" | "settings" | "worlds" | "levels";

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
  id: string; icon: React.ReactNode; label: string;
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

  const { playOrbWhoosh, playOrbConverge, playTitleReveal, startMenuMusic, playMenuSelect, isMuted, toggleMute, brightness, setBrightness } = useAudio();
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
    btn(mode);
    useOrbTransition.getState().loadingSweep(() => {
      setGameMode(mode as any);
      startLoading("entering");
    });
  }, [btn, setGameMode, startLoading]);

  const isLevelUnlocked = (level: number) => devMode || level <= highestLevel + 0.01;
  const isBossLevel     = (level: number) => Math.round((level % 1) * 10) === 9;
  const isWorldUnlocked = (w: number)     => devMode || (w + 0.1) <= highestLevel + 0.01;

  // ── Button definitions per state ──────────────────────────────────────────
  const getPanelButtons = useCallback((): BtnDef[] => {
    const back = (label: string, action: () => void): BtnDef =>
      ({ id: "back", icon: <IconBack />, label, color: "#667788", shadow: "rgba(100,110,130,0.25)", action });

    switch (menuState) {
      case "root": return [
        { id:"play",      icon:<IconPlay />,     label:"PLAY",  color:"#00ffff", shadow:"rgba(0,255,255,0.45)",  action: () => { btn("play");      setMenuState("modes");    } },
        { id:"shop",      icon:<IconShop />,     label:"SHOP",  color:"#ff00ff", shadow:"rgba(255,0,255,0.45)",  action: () => { btn("shop");      openShop();               } },
        { id:"inventory", icon:<IconGear />,     label:"GEAR",  color:"#aa00ff", shadow:"rgba(170,0,255,0.45)",  action: () => { btn("inventory"); openInventory();          } },
        { id:"settings",  icon:<IconSettings />, label:"OPTS",  color:"#ffff00", shadow:"rgba(255,255,0,0.4)",   action: () => { btn("settings");  setMenuState("settings"); } },
      ];
      case "modes": return [
        { id:"arcade",    icon:<IconArcade />,   label:"ARCADE",   color:"#ff00ff", shadow:"rgba(255,0,255,0.45)",  action: () => { btn("arcade"); setMenuState("worlds"); }  },
        { id:"chill",     icon:<IconChill />,    label:"CHILL",    color:"#aa00ff", shadow:"rgba(170,0,255,0.45)",  action: () => handleStartMode("chill")     },
        { id:"survival",  icon:<IconSurvive />,  label:"SURVIVAL", color:"#00ffff", shadow:"rgba(0,255,255,0.45)",  action: () => handleStartMode("survival")  },
        { id:"gauntlet",  icon:<IconGauntlet />, label:"GAUNTLET", color:"#ffff00", shadow:"rgba(255,255,0,0.4)",   action: () => handleStartMode("gauntlet")  },
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "settings": return [
        back("BACK", () => { btn("back"); setMenuState("root"); }),
      ];
      case "worlds": return [
        back("BACK", () => { btn("back"); setMenuState("modes"); }),
      ];
      case "levels": return [
        back("WORLDS", () => { btn("back"); setMenuState("worlds"); }),
      ];
    }
  }, [menuState, btn, openShop, openInventory, handleStartMode]);

  // ── Content panels ────────────────────────────────────────────────────────
  const renderContent = () => {
    if (menuState === "worlds") return (
      <div className="flex flex-col h-full">
        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2 text-center flex-none">Select World</p>
        <div className="grid grid-cols-3 gap-1.5 flex-1" style={{ gridAutoRows: "1fr" }}>
          {Array.from({ length: 9 }, (_, i) => i + 1).map(w => {
            const unlocked = isWorldUnlocked(w);
            const wc = WORLD_COLORS[w - 1];
            const done = w + 0.9 <= highestLevel + 0.01;
            return (
              <motion.button key={w}
                onClick={() => { if (unlocked) { btn(`w${w}`); setSelectedWorld(w); setMenuState("levels"); } }}
                disabled={!unlocked}
                className="relative flex flex-col items-center justify-center rounded-xl font-black"
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
        <div className="flex flex-col h-full">
          <p className="text-center font-black mb-2 flex-none" style={{ color: wc, fontSize: "clamp(0.65rem, 2vw, 0.85rem)", letterSpacing: "0.15em" }}>
            WORLD {selectedWorld}
          </p>
          <div className="grid grid-cols-3 gap-1.5 flex-1" style={{ gridAutoRows: "1fr" }}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map(sub => {
              const level = selectedWorld + sub / 10;
              const unlocked = isLevelUnlocked(level);
              const boss = isBossLevel(level);
              const completed = level <= highestLevel;
              const bc = boss ? "#ff4444" : wc;
              return (
                <motion.button key={sub}
                  onClick={() => { if (unlocked) { btn(`l${level}`); useOrbTransition.getState().loadingSweep(() => { setGameMode("arcade"); startLoading("nextLevel", level); }); } }}
                  disabled={!unlocked}
                  className="relative flex flex-col items-center justify-center rounded-xl font-bold"
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
  const isContent   = showMenu && (menuState === "worlds" || menuState === "levels");
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

      {/* ── ORBLITZ TITLE — pinned at viewport center, never moves ─────── */}
      <AnimatePresence>
        {showTitle && (
          <motion.div className="absolute z-10 text-center"
            style={{ top: "50%", left: 0, right: 0 }}
            initial={{ opacity: 0, scale: 0.65, y: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.8, y: "-50%" }}
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

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STARS BADGE — separate element so title height never changes ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute z-10 flex items-center justify-center gap-1.5 pointer-events-none"
            style={{ top: "calc(50% + clamp(44px, 8vw, 68px))", left: 0, right: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
          >
            <span style={{ color: "#ffd700", fontSize: "0.78rem" }}>★</span>
            <span style={{ color: "#fde68a", fontSize: "0.78rem", fontWeight: 700 }}>{shopStars}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAP TO START — stationary, pure opacity crossfade ───────────── */}
      <AnimatePresence>
        {showWaiting && (
          <motion.div
            className="absolute left-0 right-0 text-center z-10 pointer-events-none"
            style={{ bottom: "clamp(44px, 8vh, 80px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p className="text-lg md:text-xl font-semibold tracking-[0.22em] uppercase"
              style={{ color: "rgba(0,255,255,0.8)", textShadow: "0 0 18px rgba(0,255,255,0.45)" }}>
              Tap to Start
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BUTTON ROW (root / modes) — floats between title and bottom ── */}
      <AnimatePresence mode="wait">
        {showMenu && !isContent && (
          <motion.div
            key={menuState}
            className="absolute left-0 right-0 z-20"
            style={{
              top: "calc(50% + clamp(80px, 11vw, 108px))",
              padding: "0 clamp(10px, 3.5vw, 44px)",
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {menuState === "settings"
              ? <SettingsButtonRow
                  isMuted={isMuted} toggleMute={toggleMute}
                  brightness={brightness} setBrightness={setBrightness}
                  onBack={() => setMenuState("root")} btn={btn}
                />
              : <ButtonRow buttons={panelButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} />
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT PANEL (guide / settings / worlds / levels) ──────────── */}
      <AnimatePresence mode="wait">
        {showMenu && isContent && (
          <motion.div
            key={menuState}
            className="absolute left-0 right-0 z-20 flex flex-col"
            style={{
              top: (menuState === "worlds" || menuState === "levels")
                ? "calc(50% + clamp(56px, 7.5vw, 76px))"
                : "calc(50% + clamp(80px, 11vw, 108px))",
              bottom: (menuState === "worlds" || menuState === "levels")
                ? "clamp(6px, 1vh, 12px)"
                : "clamp(16px, 2.5vh, 32px)",
              padding: "0 clamp(10px, 3.5vw, 44px)",
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
          >
            <div className="flex-1 min-h-0 rounded-2xl flex flex-col overflow-hidden"
              style={{
                background: "rgba(4,4,18,0.88)",
                border: "1px solid rgba(0,255,255,0.13)",
                backdropFilter: "blur(24px)",
              }}
            >
              {/* Scrollable content */}
              <div
                className={`flex-1 px-4 pt-4 pb-2 min-h-0 ${(menuState === "worlds" || menuState === "levels") ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}
                style={(menuState === "worlds" || menuState === "levels") ? {} : { scrollbarWidth: "thin", scrollbarColor: "rgba(0,255,255,0.18) transparent" }}
              >
                {renderContent()}
              </div>
              {/* Navigation footer — slim back-link for grid states, compact buttons otherwise */}
              <div className="flex-none border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                {(menuState === "worlds" || menuState === "levels") ? (
                  <button
                    onClick={panelButtons[0]?.action}
                    className="w-full py-2 text-center text-xs font-bold tracking-widest uppercase"
                    style={{ color: "rgba(0,255,255,0.65)", letterSpacing: "0.18em" }}
                  >
                    ← {menuState === "levels" ? "WORLDS" : "BACK"}
                  </button>
                ) : (
                  <div className="px-4 py-3">
                    <ButtonRow buttons={panelButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} compact />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Reusable button row ──────────────────────────────────────────────────────
interface ButtonRowProps {
  buttons: BtnDef[];
  pressedBtn: string | null;
  setPressedBtn: (id: string | null) => void;
  compact?: boolean;
}
function ButtonRow({ buttons, pressedBtn, setPressedBtn, compact = false }: ButtonRowProps) {
  const btnH = compact ? "clamp(48px,8vw,64px)" : "clamp(68px,12vw,96px)";
  const iconSz = compact ? "clamp(1rem,2.5vw,1.4rem)" : "clamp(1.2rem,3.2vw,1.8rem)";
  const labelSz = compact ? "clamp(0.44rem,1.1vw,0.6rem)" : "clamp(0.48rem,1.25vw,0.68rem)";
  const maxW =
    buttons.length === 1 ? "clamp(120px,32vw,200px)" :
    buttons.length === 2 ? "clamp(90px,22vw,150px)" :
    "clamp(52px,17vw,100px)";

  return (
    <motion.div
      className="flex flex-row items-stretch justify-center w-full"
      style={{ gap: compact ? "clamp(5px,1.4vw,12px)" : "clamp(6px,1.8vw,16px)" }}
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
        hidden:  { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
      }}
    >
      {buttons.map((b) => {
        const isPress = pressedBtn === b.id;
        return (
          <motion.button
            key={b.id}
            className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
            style={{
              minWidth: 0, maxWidth: maxW,
              height: btnH,
              borderRadius: "clamp(10px,1.6vw,14px)",
              border: `1.5px solid ${isPress ? b.color + "cc" : b.color + "55"}`,
              background: isPress ? `${b.color}20` : `linear-gradient(160deg,${b.color}10 0%,${b.color}06 100%)`,
              color: b.color,
              boxShadow: isPress
                ? `0 0 24px ${b.shadow}, 0 0 48px ${b.shadow}, inset 0 0 14px ${b.color}14`
                : `0 0 12px ${b.shadow}, inset 0 1px 0 ${b.color}14`,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
            }}
            variants={{
              hidden:  { opacity: 0, y: 16, scale: 0.86 },
              visible: { opacity: 1, y: 0,  scale: 1,
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
            {/* Top accent line */}
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
              fontSize: iconSz, lineHeight: 1,
              marginBottom: compact ? "2px" : "clamp(2px,0.6vw,5px)",
              filter: `drop-shadow(0 0 5px ${b.color}88)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{b.icon}</span>
            {/* Label */}
            <span style={{
              fontSize: labelSz, fontWeight: 800,
              letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88,
            }}>{b.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ─── Settings button row: sound toggle + brightness slider + back ─────────────
function SettingsButtonRow({ isMuted, toggleMute, brightness, setBrightness, onBack, btn }: {
  isMuted: boolean; toggleMute: () => void;
  brightness: number; setBrightness: (v: number) => void;
  onBack: () => void; btn: (id: string) => void;
}) {
  const btnH  = "clamp(68px,12vw,96px)";
  const iconSz = "clamp(1.2rem,3.2vw,1.8rem)";
  const labelSz = "clamp(0.48rem,1.25vw,0.68rem)";
  const sc = isMuted ? "#667788" : "#00ffff";
  const ss = isMuted ? "rgba(100,110,130,0.2)" : "rgba(0,255,255,0.45)";
  const bPct = Math.round(((brightness - 0.2) / 1.8) * 100);

  const itemVariants = {
    hidden:  { opacity: 0, y: 16, scale: 0.86 },
    visible: { opacity: 1, y: 0,  scale: 1,
      transition: { type: "spring" as const, stiffness: 360, damping: 26 } },
  };

  const btnStyle = (color: string, shadow: string): React.CSSProperties => ({
    height: btnH, borderRadius: "clamp(10px,1.6vw,14px)",
    border: `1.5px solid ${color}55`,
    background: `linear-gradient(160deg,${color}10 0%,${color}06 100%)`,
    color, boxShadow: `0 0 12px ${shadow}, inset 0 1px 0 ${color}14`,
    cursor: "pointer", WebkitTapHighlightColor: "transparent",
    transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
    position: "relative" as const, overflow: "hidden" as const,
  });

  const TopLine = ({ color }: { color: string }) => (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
      height: 2, opacity: 0.55,
      background: `linear-gradient(90deg,transparent 8%,${color}88 50%,transparent 92%)`,
    }} />
  );
  const Scanlines = () => (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
      borderRadius: "inherit",
    }} />
  );

  return (
    <>
      <style>{`.orb-bslider{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;border-radius:2px}.orb-bslider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#ffff00;box-shadow:0 0 6px rgba(255,255,0,0.85)}.orb-bslider::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#ffff00;box-shadow:0 0 6px rgba(255,255,0,0.85)}`}</style>
      <motion.div
        className="flex flex-row items-stretch justify-center w-full"
        style={{ gap: "clamp(6px,1.8vw,16px)" }}
        initial="hidden" animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
          hidden:  { transition: { staggerChildren: 0.03,  staggerDirection: -1 } },
        }}
      >
        {/* SOUND toggle */}
        <motion.button
          className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
          style={{ ...btnStyle(sc, ss), minWidth: 0, maxWidth: "clamp(52px,17vw,100px)" }}
          variants={itemVariants} whileTap={{ scale: 0.9 }}
          onClick={() => { btn("sound"); toggleMute(); }}
        >
          <TopLine color={sc} /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: `drop-shadow(0 0 5px ${sc}88)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isMuted ? <IconSoundOff /> : <IconSound />}
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88 }}>
            {isMuted ? "MUTED" : "SOUND"}
          </span>
        </motion.button>

        {/* BRIGHTNESS slider */}
        <motion.div
          className="relative flex flex-col items-center justify-center overflow-hidden flex-[2]"
          style={{ ...btnStyle("#ffff00", "rgba(255,255,0,0.38)"), minWidth: 0, cursor: "default",
            padding: "0 clamp(6px,1.5vw,14px)" }}
          variants={itemVariants}
        >
          <TopLine color="#ffff00" /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: 2, filter: "drop-shadow(0 0 5px #ffff0088)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconBrightness />
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88, marginBottom: 5 }}>
            BRIGHT
          </span>
          <input
            type="range" min={0.2} max={2.0} step={0.05}
            value={brightness}
            onChange={e => setBrightness(Number(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="orb-bslider"
            style={{
              width: "100%", height: 4,
              background: `linear-gradient(90deg,#ffff00 ${bPct}%,rgba(255,255,255,0.15) ${bPct}%)`,
            }}
          />
          <span style={{ fontSize: "clamp(0.38rem,1vw,0.5rem)", opacity: 0.4, marginTop: 3, letterSpacing: "0.1em" }}>
            {bPct}%
          </span>
        </motion.div>

        {/* BACK */}
        <motion.button
          className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
          style={{ ...btnStyle("#667788", "rgba(100,110,130,0.2)"), minWidth: 0, maxWidth: "clamp(52px,17vw,100px)" }}
          variants={itemVariants} whileTap={{ scale: 0.9 }}
          onClick={() => { btn("back"); onBack(); }}
        >
          <TopLine color="#667788" /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: "drop-shadow(0 0 5px #66778888)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88 }}>
            BACK
          </span>
        </motion.button>
      </motion.div>
    </>
  );
}
