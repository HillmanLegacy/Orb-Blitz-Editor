import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { useGraphicsPreset, setGraphicsPreset, type GraphicsPreset } from "@/game-runtime/PerformanceToggles";
import type { IntroBossPhase } from "./ArcadeBossIntroScene";

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconPlay()      { return <svg {..._svg}><path d="M6.5 3.8 20.5 12 6.5 20.2V3.8Z" fill="currentColor" opacity="0.92"/><path d="M10 8.2 16.5 12 10 15.8" stroke="#07111f" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/></svg>; }
function IconShop()      { return <svg {..._svg}><path d="m5.5 8 2.2-3h8.6l2.2 3-1.4 11h-10L5.5 8Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.13"/><path d="M5.5 8h13M9.2 8v3.2M14.8 8v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9.5 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconTrophy()    { return <svg {..._svg}><path d="M8 4h8v5.5a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><path d="M8 6H5.5A1.5 1.5 0 0 0 4 7.5v.4A3.1 3.1 0 0 0 7.1 11H8M16 6h2.5A1.5 1.5 0 0 1 20 7.5v.4a3.1 3.1 0 0 1-3.1 3.1H16M12 13v4M8.5 20h7M9 17h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconGear()      { return <svg {..._svg}><path d="m12 3 1.3 2.1 2.5.4.7 2.4 2.1 1.4-.9 2.4.9 2.4-2.1 1.4-.7 2.4-2.5.4L12 21l-1.3-2.1-2.5-.4-.7-2.4-2.1-1.4.9-2.4-.9-2.4 2.1-1.4.7-2.4 2.5-.4L12 3Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.12"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.3"/><path d="M12 8.3v1M12 14.7v1M8.3 12h1M14.7 12h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>; }
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
  onIntroPhaseChange?: (phase: IntroBossPhase | null) => void;
}

const EXPLOSION_RAYS = Array.from({ length: 12 }, (_, index) => ({
  rotation: index * 30,
  length: 90 + (index % 3) * 24,
}));

const TETROMINOES = [
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: "#5ad7ff", left: "8%", top: "18%", rotate: -12, scale: 1.2, duration: 9, delay: 0 },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#ff78c8", left: "84%", top: "22%", rotate: 16, scale: 1.05, duration: 11, delay: 0.8 },
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: "#ffd166", left: "16%", top: "72%", rotate: -8, scale: 1.1, duration: 10, delay: 1.5 },
  { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#8d7cff", left: "78%", top: "72%", rotate: 10, scale: 1.15, duration: 12, delay: 0.4 },
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#75e0a4", left: "3%", top: "48%", rotate: 7, scale: 0.82, duration: 13, delay: 2 },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]], color: "#ff8f70", left: "91%", top: "48%", rotate: -14, scale: 0.78, duration: 10, delay: 1.1 },
] as const;

// ─── World palette (9 worlds, spans the title gradient arc) ──────────────────
const WORLD_COLORS = [
  "#5ad7ff","#8d7cff","#ff78c8","#ff8f70","#ffd166",
  "#75e0a4","#ffad66","#a6a1ff","#6cd9d8",
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
  onIntroPhaseChange,
}: StartupAnimationProps) {
  const [animPhase, setAnimPhase] = useState<AnimPhase>(skipIntro ? "menu" : "idle");
  const [menuState, setMenuState] = useState<MenuState>(skipIntro ? initialState : "root");
  const [selectedWorld, setSelectedWorld] = useState(1);
  const [devProgress, setDevProgress] = useState(0);
  const [devFlash, setDevFlash]       = useState(false);
  const [highestLevel, setHighestLevel] = useState(1.1);
  const [pressedBtn, setPressedBtn]   = useState<string | null>(null);

  const { playOrbWhoosh, playOrbConverge, playTitleReveal, playLevelSelect, playTapToStart, isMuted, toggleMute, volume, setVolume, brightness, setBrightness, startMenuBgm, stopMenuBgm } = useAudio();
  const { openShop, openInventory, openTrophies, activateDevMode, coins: shopStars, devMode } = useShop();
  const { setGameMode, startLoading } = useMagicOrb();
  const graphicsPreset = useGraphicsPreset();

  // Reload progress when entering menu
  useEffect(() => {
    setHighestLevel(getStoredProgress());
  }, [menuState]);

  // Intro sequence
  useEffect(() => {
    if (skipIntro) { onMenuReady?.(); try { startMenuBgm(); } catch {} return; }
    const t0 = setTimeout(() => { setAnimPhase("flying");   try { playOrbWhoosh();   } catch {} }, 150);
    const t1 = setTimeout(() => { setAnimPhase("converge"); try { playOrbConverge(); } catch {} }, 2700);
    const t2 = setTimeout(() => { setAnimPhase("flash"); },                                        3250);
    const t3 = setTimeout(() => { setAnimPhase("title");    try { playTitleReveal(); } catch {} }, 3600);
    const t4 = setTimeout(() => { setAnimPhase("waiting"); try { startMenuBgm(); } catch {} },     5100);
    return () => [t0,t1,t2,t3,t4].forEach(clearTimeout);
  }, []);

  const handleTap = useCallback(() => {
    if (animPhase === "waiting") { try { playTapToStart(); } catch {} setAnimPhase("menu"); onMenuReady?.(); }
  }, [animPhase, onMenuReady, playTapToStart]);

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

  const btn = useCallback((id: string) => { try { playLevelSelect(); } catch {} }, [playLevelSelect]);

  const handleStartMode = useCallback((mode: string) => {
    btn(mode);
    try { stopMenuBgm(); } catch {}
    useOrbTransition.getState().loadingSweep(() => {
      setGameMode(mode as any);
      startLoading("entering");
    });
  }, [btn, setGameMode, startLoading, stopMenuBgm]);

  const isLevelUnlocked = (level: number) => devMode || level <= highestLevel + 0.01;
  const isBossLevel     = (level: number) => Math.round((level % 1) * 10) === 9;
  const isWorldUnlocked = (w: number)     => devMode || (w + 0.1) <= highestLevel + 0.01;

  // ── Button definitions per state ──────────────────────────────────────────
  const getPanelButtons = useCallback((): BtnDef[] => {
    const back = (label: string, action: () => void): BtnDef =>
      ({ id: "back", icon: <IconBack />, label, color: "#667788", shadow: "rgba(100,110,130,0.25)", action });

    switch (menuState) {
       case "root": return [
        { id:"play",      icon:<IconPlay />,     label:"LAUNCH",   color:"#a9a0ff", shadow:"rgba(169,160,255,0.34)", action: () => { btn("play");      setMenuState("modes");    } },
        { id:"shop",      icon:<IconShop />,     label:"MARKET",   color:"#ff9ebd", shadow:"rgba(255,158,189,0.34)", action: () => { btn("shop");      openShop();               } },
        { id:"inventory", icon:<IconGear />,     label:"LOADOUT",  color:"#c69cff", shadow:"rgba(198,156,255,0.34)", action: () => { btn("inventory"); openInventory();          } },
        { id:"trophies",  icon:<IconTrophy />,   label:"ARCHIVE",  color:"#ffd99a", shadow:"rgba(255,217,154,0.3)",  action: () => { btn("trophies"); openTrophies(); } },
        { id:"settings",  icon:<IconSettings />, label:"SYSTEMS",  color:"#b9d5ff", shadow:"rgba(185,213,255,0.3)",  action: () => { btn("settings");  setMenuState("settings"); } },
      ];
      case "modes": return [
        { id:"arcade",    icon:<IconArcade />,   label:"ARCADE",   color:"#ff9ebd", shadow:"rgba(255,158,189,0.34)", action: () => { btn("arcade"); setMenuState("worlds"); }  },
        { id:"chill",     icon:<IconChill />,    label:"CHILL",    color:"#b9a5ff", shadow:"rgba(185,165,255,0.34)", action: () => handleStartMode("chill")     },
        { id:"survival",  icon:<IconSurvive />,  label:"SURVIVAL", color:"#9fd9ff", shadow:"rgba(159,217,255,0.3)",  action: () => handleStartMode("survival")  },
        { id:"gauntlet",  icon:<IconGauntlet />, label:"GAUNTLET", color:"#ffd99a", shadow:"rgba(255,217,154,0.3)",  action: () => handleStartMode("gauntlet")  },
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
      <>
        {Array.from({ length: 9 }, (_, i) => i + 1).map(w => {
          const unlocked = isWorldUnlocked(w);
          const wc = WORLD_COLORS[w - 1];
          const done = w + 0.9 <= highestLevel + 0.01;
          return (
            <motion.button key={w}
              onClick={() => { if (unlocked) { btn(`w${w}`); setSelectedWorld(w); setMenuState("levels"); } }}
              disabled={!unlocked}
              className="relative flex flex-col items-center justify-center rounded-2xl font-black"
              style={{
                background: unlocked ? `linear-gradient(145deg, ${wc}22, ${wc}0a)` : "rgba(20,20,30,0.6)",
                border: `1.5px solid ${unlocked ? wc + "66" : "#33355555"}`,
                boxShadow: unlocked ? `0 0 18px ${wc}30` : "none",
                color: unlocked ? wc : "#445",
                cursor: unlocked ? "pointer" : "default",
                fontSize: "clamp(1rem, 3.5vw, 1.6rem)",
              }}
              whileHover={unlocked ? { scale: 1.05 } : {}}
              whileTap={unlocked ? { scale: 0.93 } : {}}
            >
              {unlocked ? (
                <>
                  <span>{w}</span>
                  <span style={{ fontSize: "0.4em", opacity: 0.65, letterSpacing: "0.12em", marginTop: 3 }}>WORLD</span>
                  {done && <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: wc }} />}
                </>
              ) : (
                <span style={{ fontSize: "1.2em", opacity: 0.4 }}>🔒</span>
              )}
            </motion.button>
          );
        })}
      </>
    );

    if (menuState === "levels") {
      const wc = WORLD_COLORS[selectedWorld - 1];
      return (
        <>
          {Array.from({ length: 9 }, (_, i) => i + 1).map(sub => {
            const level = selectedWorld + sub / 10;
            const unlocked = isLevelUnlocked(level);
            const boss = isBossLevel(level);
            const completed = level <= highestLevel;
            const bc = boss ? "#ff4444" : wc;
            return (
              <motion.button key={sub}
                onClick={() => { if (unlocked) { btn(`l${level}`); try { stopMenuBgm(); } catch {} useOrbTransition.getState().loadingSweep(() => { setGameMode("arcade"); startLoading("nextLevel", level); }); } }}
                disabled={!unlocked}
                className="relative flex flex-col items-center justify-center rounded-2xl font-bold"
                style={{
                  background: unlocked ? `linear-gradient(145deg, ${bc}22, ${bc}0a)` : "rgba(20,20,30,0.6)",
                  border: `1.5px solid ${unlocked ? bc + "66" : "#333"}`,
                  boxShadow: unlocked ? `0 0 14px ${bc}28` : "none",
                  color: unlocked ? bc : "#445",
                  cursor: unlocked ? "pointer" : "default",
                  fontSize: "clamp(0.85rem, 2.8vw, 1.2rem)",
                }}
                whileHover={unlocked ? { scale: 1.05 } : {}}
                whileTap={unlocked ? { scale: 0.93 } : {}}
              >
                {unlocked ? (
                  <>
                    <span>{selectedWorld}.{sub}</span>
                    <span style={{ fontSize: "0.42em", opacity: 0.7, marginTop: 3, letterSpacing: "0.08em" }}>
                      {boss ? "BOSS" : `${getOrbGoal(selectedWorld, sub)} orbs`}
                    </span>
                    {completed && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: bc }} />}
                  </>
                ) : (
                  <span style={{ fontSize: "1.1em", opacity: 0.35 }}>🔒</span>
                )}
              </motion.button>
            );
          })}
        </>
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
  const introPhase: IntroBossPhase | null =
    animPhase === "idle" || animPhase === "flying" || animPhase === "converge" || animPhase === "flash" ||
    animPhase === "title" || animPhase === "waiting"
      ? animPhase
      : null;

  useEffect(() => {
    onIntroPhaseChange?.(introPhase);
  }, [introPhase, onIntroPhaseChange]);

  useEffect(() => () => onIntroPhaseChange?.(null), [onIntroPhaseChange]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black select-none"
      style={{
        cursor: isClickable ? "pointer" : "default",
        backgroundColor: showMenu ? "rgba(3,5,18,0.97)" : "transparent",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      onClick={isClickable ? handleTap : undefined}
      onTouchStart={isClickable ? handleTap : undefined}
    >
      {/* ── CELESTIAL ATMOSPHERE ───────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{
        zIndex: 0,
        opacity: showMenu ? 1 : 0.12,
        transition: "opacity 0.45s ease",
        background: "radial-gradient(ellipse at 50% 42%, rgba(35,51,107,0.92) 0%, rgba(13,24,61,0.82) 37%, rgba(5,10,31,0.98) 83%), linear-gradient(135deg, #091737, #28144b 52%, #071d32)",
      }}>
        <div className="absolute inset-0" style={{
          opacity: 0.22,
          backgroundImage: "linear-gradient(rgba(118,216,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(118,216,255,0.28) 1px, transparent 1px)",
          backgroundSize: "clamp(26px, 3.7vw, 54px) clamp(26px, 3.7vw, 54px)",
          maskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
        }} />
        {TETROMINOES.map((piece, pieceIndex) => (
          <motion.div
            key={pieceIndex}
            className="absolute pointer-events-none"
            style={{
              left: piece.left, top: piece.top, opacity: 0.48, scale: piece.scale,
              display: "grid", gridTemplateColumns: "repeat(4, clamp(14px, 2vw, 28px))",
              gridAutoRows: "clamp(14px, 2vw, 28px)", transformOrigin: "center",
              filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.18))",
            }}
            animate={{ y: [0, -10, 0], rotate: [piece.rotate, piece.rotate + 4, piece.rotate] }}
            transition={{ duration: piece.duration, delay: piece.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            {piece.cells.map(([x, y], cellIndex) => (
              <div
                key={cellIndex}
                style={{
                  gridColumn: x + 1, gridRow: y + 1,
                  borderRadius: 4, border: "1px solid rgba(255,255,255,0.34)",
                  background: `linear-gradient(145deg, rgba(255,255,255,0.7), ${piece.color} 23%, ${piece.color}cc)`,
                  boxShadow: `inset 3px 3px 0 rgba(255,255,255,0.26), inset -3px -3px 0 rgba(0,0,0,0.12), 0 0 18px ${piece.color}55`,
                }}
              />
            ))}
          </motion.div>
        ))}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "min(65vw, 720px)", height: "min(42vw, 460px)",
            left: "7%", top: "8%",
            background: "radial-gradient(ellipse, rgba(76,157,255,0.28), rgba(76,157,255,0.07) 48%, transparent 72%)",
            filter: "blur(12px)",
          }}
          animate={{ x: ["-4%", "8%", "-4%"], y: ["2%", "-5%", "2%"], scale: [1, 1.08, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "min(54vw, 620px)", height: "min(45vw, 500px)",
            right: "-8%", bottom: "3%",
            background: "radial-gradient(ellipse, rgba(255,98,190,0.22), rgba(255,98,190,0.05) 52%, transparent 74%)",
            filter: "blur(14px)",
          }}
          animate={{ x: ["3%", "-7%", "3%"], y: ["-4%", "5%", "-4%"], scale: [1.05, 0.94, 1.05] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "min(34vw, 390px)", height: "min(34vw, 390px)",
            left: "50%", top: "45%", transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(255,209,102,0.12), rgba(120,107,255,0.07) 48%, transparent 72%)",
            filter: "blur(4px)",
          }}
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute"
          style={{
            width: "min(74vw, 760px)", height: "min(36vw, 360px)",
            left: "50%", top: "43%", marginLeft: "min(-37vw, -380px)", marginTop: "min(-18vw, -180px)",
            border: "1px solid rgba(118,216,255,0.24)", borderRadius: "50%",
            transform: "rotate(-12deg)",
            boxShadow: "0 0 80px rgba(73,171,255,0.14), inset 0 0 72px rgba(255,97,190,0.08)",
          }}
          animate={{ rotate: [0, 5, 0], scale: [1, 1.025, 1] }}
          transition={{ rotate: { duration: 18, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 7, repeat: Infinity, ease: "easeInOut" } }}
        />
        <div className="absolute left-[14%] top-[24%] h-2 w-2 rounded-sm" style={{ background: "#ffd166", boxShadow: "0 0 24px 7px rgba(255,209,102,0.35)" }} />
        <div className="absolute right-[18%] bottom-[28%] h-1.5 w-1.5 rounded-sm" style={{ background: "#ff78c8", boxShadow: "0 0 20px 6px rgba(255,120,200,0.34)" }} />
      </div>

      <div className="absolute left-6 top-6 z-[2] pointer-events-none" style={{
        color: "rgba(220,244,255,0.82)", fontSize: "clamp(0.48rem, 1vw, 0.64rem)",
        fontWeight: 900, letterSpacing: "0.14em", lineHeight: 1.7, fontFamily: "Arial Black, Impact, sans-serif",
      }}>
        <div>ORBLITZ ARCADE</div>
        <div style={{ color: "rgba(255,209,102,0.88)", letterSpacing: "0.1em" }}>Stack · play · repeat</div>
      </div>
      <div className="absolute right-6 top-6 z-[2] pointer-events-none text-right" style={{
        color: "rgba(220,244,255,0.7)", fontSize: "clamp(0.48rem, 1vw, 0.64rem)",
        fontWeight: 900, letterSpacing: "0.12em", lineHeight: 1.7, fontFamily: "Arial Black, Impact, sans-serif",
      }}>
        <div>9 WORLDS · 81 LEVELS</div>
        <div style={{ color: "rgba(255,120,200,0.84)", letterSpacing: "0.09em" }}>Ready when you are</div>
      </div>

      {/* Convergence core and detonation rays */}
      <AnimatePresence>
        {(animPhase === "converge" || animPhase === "flash") && (
          <>
            <motion.div className="absolute rounded-full pointer-events-none" style={{
              width: 120, height: 120, left: "50%", top: "50%",
              marginLeft: -60, marginTop: -60,
               background: "radial-gradient(circle,#fffafc 0%,#c8b6ff 30%,#ff9ebd 60%,transparent 80%)",
              filter: "blur(18px)", zIndex: 3,
            }}
              initial={{ scale: 0, opacity: 0 }}
              animate={animPhase === "flash" ? { scale: [0.5, 2.8, 0.3], opacity: [0.8, 1, 0] } : { scale: 0.5, opacity: 0.6 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: animPhase === "flash" ? 0.55 : 0.4, ease: "easeOut" }}
            />
            {EXPLOSION_RAYS.map((ray) => (
              <motion.div
                key={ray.rotation}
                className="absolute pointer-events-none"
                style={{
                  left: "50%",
                  top: "50%",
                  width: ray.length,
                  height: 2,
                  transformOrigin: "left center",
                  rotate: ray.rotation,
                   background: "linear-gradient(90deg,#fffafc,#c8b6ff,#ff9ebd,transparent)",
                   boxShadow: "0 0 8px rgba(255,158,189,0.75)",
                  zIndex: 3,
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={animPhase === "flash"
                  ? { scaleX: [0.2, 1.35, 0], opacity: [0, 1, 0] }
                  : { scaleX: 0.42, opacity: 0.42 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{
                  duration: animPhase === "flash" ? 0.55 : 0.4,
                  delay: animPhase === "flash" ? (ray.rotation % 60) / 900 : 0,
                  ease: "easeOut",
                }}
              />
            ))}
          </>
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
            transition={{ duration: 0.9, delay: animPhase === "title" ? 0.46 : 0, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <motion.p
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 0.7, letterSpacing: "0.28em" }}
              transition={{ duration: 0.7, delay: animPhase === "title" ? 0.34 : 0 }}
              style={{
                margin: "0 0 clamp(8px, 1.5vw, 16px)", color: "#b9efff",
                fontSize: "clamp(0.42rem, 1.15vw, 0.68rem)", fontWeight: 800,
                fontFamily: "Arial Black, Impact, sans-serif", textTransform: "uppercase",
              }}
            >
              {showWaiting ? "The board is yours now" : "A bright little arcade"}
            </motion.p>
            {/* Letters clickable in menu phase for dev-mode easter egg */}
            {showMenu ? (
              <motion.h1
                className="font-black tracking-widest flex items-center justify-center orb-title-glow"
                style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)", lineHeight: 1,
                  fontFamily: "Arial Black, Impact, sans-serif", fontWeight: 900, fontStyle: "normal",
                  letterSpacing: "0.075em", transform: "none",
                  WebkitTextStroke: "2px rgba(224,249,255,0.16)",
                  textShadow: "5px 5px 0 rgba(10,20,68,0.6), 0 0 28px rgba(90,215,255,0.28)",
                  filter: devFlash ? "drop-shadow(0 0 30px #ffff00) drop-shadow(0 0 60px #ffaa00)" : undefined,
                  transition: devFlash ? "filter 0.1s" : undefined,
                }}
              >
                {TITLE_LETTERS.map((letter, idx) => (
                  <motion.span key={idx} className="cursor-pointer"
                    style={{
                      backgroundImage: "linear-gradient(135deg,#5ad7ff 0%,#5ad7ff 16%,#ff78c8 16%,#ff78c8 32%,#ffd166 32%,#ffd166 48%,#75e0a4 48%,#75e0a4 64%,#a6a1ff 64%,#a6a1ff 82%,#ff8f70 82%,#ff8f70 100%)",
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
              <h1 className="font-black tracking-widest text-transparent bg-clip-text pointer-events-none orb-title-glow"
                style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)", lineHeight: 1,
                  fontFamily: "Arial Black, Impact, sans-serif", fontWeight: 900, fontStyle: "normal",
                  letterSpacing: "0.075em", transform: "none",
                  WebkitTextStroke: "2px rgba(224,249,255,0.16)",
                  textShadow: "5px 5px 0 rgba(10,20,68,0.6), 0 0 28px rgba(90,215,255,0.28)",
                  backgroundImage: "linear-gradient(135deg,#5ad7ff 0%,#5ad7ff 16%,#ff78c8 16%,#ff78c8 32%,#ffd166 32%,#ffd166 48%,#75e0a4 48%,#75e0a4 64%,#a6a1ff 64%,#a6a1ff 82%,#ff8f70 82%,#ff8f70 100%)" }}
              >ORBLITZ</h1>
            )}

            {/* Underline */}
            <motion.div className="mt-3 mx-auto" style={{
              height: "clamp(5px, 0.8vw, 8px)", width: "clamp(160px, 36vw, 280px)",
              borderRadius: 3,
              background: "linear-gradient(90deg,transparent 0%,#5ad7ff 18%,#ff78c8 18%,#ff78c8 36%,#ffd166 36%,#ffd166 54%,#75e0a4 54%,#75e0a4 72%,#a6a1ff 72%,#a6a1ff 88%,transparent 88%)",
              boxShadow: "0 4px 0 rgba(10,20,68,0.45), 0 0 16px rgba(90,215,255,0.4)",
            }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.65 }}
              transition={{ duration: 0.9, delay: animPhase === "title" ? 0.68 : 0.25, ease: "easeOut" }}
            />

            {showMenu && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 0.58, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  margin: "clamp(8px, 1.5vw, 14px) 0 0", color: "#b9efff",
                  fontSize: "clamp(0.44rem, 1.1vw, 0.64rem)", fontWeight: 800,
                  letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Arial Black, Impact, sans-serif",
                }}
              >
                Stack up a little fun
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STARS BADGE — separate element so title height never changes ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute z-10 flex items-center justify-center gap-1.5 pointer-events-none"
            style={{
              top: "calc(50% + clamp(48px, 8vw, 72px))", left: "50%", right: "auto",
              transform: "translateX(-50%)", padding: "5px 13px",
              border: "2px solid rgba(255,209,102,0.54)", borderRadius: 7,
              background: "rgba(255,209,102,0.16)", boxShadow: "3px 3px 0 rgba(10,20,68,0.52), 0 0 18px rgba(255,209,102,0.14)",
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ delay: 0.15 }}
          >
            <span style={{ color: "#ffd166", fontSize: "0.72rem" }}>★</span>
            <span style={{ color: "#fff1bd", fontSize: "0.66rem", fontWeight: 900, letterSpacing: "0.08em", fontFamily: "Arial Black, Impact, sans-serif" }}>{shopStars} STARS</span>
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
              style={{ color: "rgba(226,249,255,0.94)", textShadow: "3px 3px 0 rgba(10,20,68,0.7), 0 0 18px rgba(90,215,255,0.5)", fontSize: "clamp(0.72rem, 2vw, 1.05rem)", fontFamily: "Arial Black, Impact, sans-serif" }}>
              Press to Play
            </p>
            <p style={{ margin: "8px 0 0", color: "rgba(204,233,255,0.66)", fontSize: "clamp(0.4rem, 1vw, 0.58rem)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Arial Black, Impact, sans-serif" }}>
              Clear the board · chase the high score
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
                  volume={volume} setVolume={setVolume}
                  brightness={brightness} setBrightness={setBrightness}
                  graphicsPreset={graphicsPreset} setGraphicsPreset={setGraphicsPreset}
                  onBack={() => setMenuState("root")} btn={btn}
                />
              : <ButtonRow buttons={panelButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} />
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULL-SCREEN WORLDS / LEVELS POPUP ───────────────────────────── */}
      <AnimatePresence mode="wait">
        {showMenu && isContent && (
          <motion.div
            key={menuState}
            className="fixed inset-0 z-[150] flex flex-col"
            style={{ background: "rgba(4,4,18,0.97)", backdropFilter: "blur(24px)" }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex-none flex items-center justify-center" style={{ paddingTop: "clamp(28px, 5vh, 56px)", paddingBottom: "clamp(12px, 2vh, 24px)" }}>
              <p className="font-black tracking-widest uppercase" style={{
                color: menuState === "worlds" ? "#00ffff" : WORLD_COLORS[selectedWorld - 1],
                fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)",
                letterSpacing: "0.22em",
                textShadow: `0 0 18px ${menuState === "worlds" ? "rgba(0,255,255,0.5)" : `${WORLD_COLORS[selectedWorld - 1]}88`}`,
              }}>
                {menuState === "worlds" ? "Select World" : `World ${selectedWorld}`}
              </p>
            </div>

            {/* Grid */}
            <div className="flex-1 min-h-0 flex flex-col" style={{ padding: "0 clamp(16px, 4vw, 56px)" }}>
              <div className="grid grid-cols-3 gap-2 h-full" style={{ gridAutoRows: "1fr" }}>
                {renderContent()}
              </div>
            </div>

            {/* Back button — styled to match ButtonRow */}
            <div className="flex-none border-t flex justify-center" style={{ borderColor: "rgba(255,255,255,0.07)", padding: "clamp(10px, 2vh, 20px) clamp(16px, 4vw, 56px) clamp(16px, 3vh, 32px)" }}>
              <div style={{ width: "clamp(120px, 40vw, 200px)" }}>
                <ButtonRow buttons={panelButtons} pressedBtn={pressedBtn} setPressedBtn={setPressedBtn} compact />
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
              borderRadius: "clamp(6px, 1vw, 10px)",
              border: `2px solid ${isPress ? b.color : b.color + "aa"}`,
              background: isPress
                ? `linear-gradient(145deg, ${b.color}65, ${b.color}28)`
                : `linear-gradient(145deg, rgba(255,255,255,0.12), ${b.color}35 52%, ${b.color}18)`,
              color: b.color,
              boxShadow: isPress
                ? `3px 3px 0 rgba(10,20,68,0.58), 0 0 24px ${b.shadow}, inset 0 0 12px ${b.color}28`
                : `4px 5px 0 rgba(10,20,68,0.58), 0 0 14px ${b.shadow}, inset 2px 2px 0 rgba(255,255,255,0.14)`,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              backdropFilter: "blur(3px)",
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
            data-orblitz-modal-opener={b.id === "shop" || b.id === "inventory" ? b.id : undefined}
          >
            {/* Block highlight */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
              height: 5,
              background: `linear-gradient(90deg,${b.color}00 0%,${b.color}cc 22%,rgba(255,255,255,0.7) 48%,${b.color}22 78%,${b.color}00 100%)`,
              opacity: isPress ? 1 : 0.55, transition: "opacity 0.14s",
            }} />
            {/* Soft glass highlight */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08), transparent 45%, rgba(0,0,0,0.08))",
              borderRadius: "inherit",
            }} />
            {/* Icon */}
            <span style={{
              fontSize: iconSz, lineHeight: 1,
              marginBottom: compact ? "2px" : "clamp(2px,0.6vw,5px)",
              filter: `drop-shadow(2px 2px 0 rgba(10,20,68,0.4))`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{b.icon}</span>
            {/* Label */}
            <span style={{
              fontSize: labelSz, fontWeight: 900,
              letterSpacing: "0.08em", lineHeight: 1, opacity: 0.96,
              fontFamily: "Arial Black, Impact, sans-serif",
            }}>{b.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ─── Settings button row: sound toggle + brightness slider + back ─────────────
function SettingsButtonRow({ isMuted, toggleMute, volume, setVolume, brightness, setBrightness, graphicsPreset, setGraphicsPreset, onBack, btn }: {
  isMuted: boolean; toggleMute: () => void;
  volume: number; setVolume: (v: number) => void;
  brightness: number; setBrightness: (v: number) => void;
  graphicsPreset: GraphicsPreset; setGraphicsPreset: (preset: GraphicsPreset) => void;
  onBack: () => void; btn: (id: string) => void;
}) {
  const btnH  = "clamp(68px,12vw,96px)";
  const iconSz = "clamp(1.2rem,3.2vw,1.8rem)";
  const labelSz = "clamp(0.48rem,1.25vw,0.68rem)";
  const sc = isMuted ? "#8292ae" : "#5ad7ff";
  const ss = isMuted ? "rgba(130,146,174,0.22)" : "rgba(90,215,255,0.34)";
  const bPct = Math.round(((brightness - 0.2) / 1.8) * 100);
  const vPct = Math.round(volume * 100);

  const itemVariants = {
    hidden:  { opacity: 0, y: 16, scale: 0.86 },
    visible: { opacity: 1, y: 0,  scale: 1,
      transition: { type: "spring" as const, stiffness: 360, damping: 26 } },
  };

  const btnStyle = (color: string, shadow: string): React.CSSProperties => ({
    height: btnH, borderRadius: "clamp(6px,1vw,10px)",
    border: `2px solid ${color}aa`,
    background: `linear-gradient(145deg, rgba(255,255,255,0.12), ${color}35 54%, ${color}18)`,
    color, boxShadow: `4px 5px 0 rgba(10,20,68,0.58), 0 0 14px ${shadow}, inset 2px 2px 0 rgba(255,255,255,0.14)`,
    cursor: "pointer", WebkitTapHighlightColor: "transparent",
    backdropFilter: "blur(3px)",
    transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
    position: "relative" as const, overflow: "hidden" as const,
  });

  const TopLine = ({ color }: { color: string }) => (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
      height: 5, opacity: 0.7,
      background: `linear-gradient(90deg,${color}00 0%,${color}cc 22%,rgba(255,255,255,0.7) 48%,${color}22 78%,${color}00 100%)`,
    }} />
  );
  const Scanlines = () => (
    <div className="absolute inset-0 pointer-events-none" style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.08), transparent 42%, rgba(255,255,255,0.025))",
      borderRadius: "inherit",
    }} />
  );
  const presetOptions: { id: GraphicsPreset; label: string; detail: string; color: string }[] = [
    { id: "low", label: "LOW", detail: "0.8× · Efficient FX", color: "#5ad7ff" },
    { id: "standard", label: "STANDARD", detail: "1.0× · Balanced FX", color: "#a6a1ff" },
    { id: "high", label: "HIGH", detail: "1.4× · Maximum FX", color: "#ff78c8" },
  ];

  return (
    <>
      <style>{`.orb-bslider{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;border-radius:2px}.orb-bslider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#ffff00;box-shadow:0 0 6px rgba(255,255,0,0.85)}.orb-bslider::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#ffff00;box-shadow:0 0 6px rgba(255,255,0,0.85)}.orb-vslider{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;border-radius:2px}.orb-vslider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#00ffff;box-shadow:0 0 6px rgba(0,255,255,0.85)}.orb-vslider::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#00ffff;box-shadow:0 0 6px rgba(0,255,255,0.85)}`}</style>
      <div className="flex flex-col w-full" style={{ gap: "clamp(8px,1.5vw,14px)" }}>
        <motion.div
          className="relative flex flex-col items-center justify-center overflow-hidden w-full"
          style={{ ...btnStyle("#aa88ff", "rgba(170,136,255,0.38)"), height: "clamp(82px,14vw,108px)", cursor: "default", padding: "clamp(8px,1.5vw,14px)" }}
          initial={{ opacity: 0, y: 16, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 26 }}
        >
          <TopLine color="#aa88ff" /><Scanlines />
          <div className="flex items-center justify-between w-full" style={{ marginBottom: 7 }}>
            <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.16em", opacity: 0.9 }}>GRAPHICS</span>
            <span style={{ fontSize: "clamp(0.42rem,1vw,0.56rem)", color: "#cbbcff", letterSpacing: "0.1em", opacity: 0.65 }}>
              {presetOptions.find(option => option.id === graphicsPreset)?.detail.toUpperCase()}
            </span>
          </div>
          <div className="flex w-full" style={{ gap: "clamp(5px,1.2vw,10px)" }}>
            {presetOptions.map(option => {
              const selected = graphicsPreset === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { btn(`graphics-${option.id}`); setGraphicsPreset(option.id); }}
                  style={{
                    flex: 1, height: "clamp(30px,5vw,42px)", borderRadius: 8,
                    border: `1px solid ${selected ? option.color : option.color + "55"}`,
                    background: selected ? `${option.color}30` : "rgba(0,0,0,0.22)",
                    color: selected ? "#fff" : `${option.color}bb`,
                    boxShadow: selected ? `0 0 10px ${option.color}55, inset 0 0 10px ${option.color}18` : "none",
                    fontSize: "clamp(0.44rem,1.1vw,0.62rem)", fontWeight: 900, letterSpacing: "0.1em",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-row items-stretch justify-center w-full"
          style={{ gap: "clamp(6px,1.8vw,16px)" }}
          initial="hidden" animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
            hidden:  { transition: { staggerChildren: 0.03,  staggerDirection: -1 } },
          }}
        >
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
            BRIGHTNESS
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

        {/* VOLUME slider */}
        <motion.div
          className="relative flex flex-col items-center justify-center overflow-hidden flex-[2]"
          style={{ ...btnStyle("#00ffff", "rgba(0,255,255,0.38)"), minWidth: 0, cursor: "default",
            padding: "0 clamp(6px,1.5vw,14px)" }}
          variants={itemVariants}
        >
          <TopLine color="#00ffff" /><Scanlines />
          <span style={{ fontSize: iconSz, lineHeight: 1, marginBottom: 2, filter: "drop-shadow(0 0 5px #00ffff88)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isMuted ? <IconSoundOff /> : <IconSound />}
          </span>
          <span style={{ fontSize: labelSz, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88, marginBottom: 5 }}>
            VOLUME
          </span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            onClick={e => e.stopPropagation()}
            className="orb-vslider"
            style={{
              width: "100%", height: 4,
              background: `linear-gradient(90deg,#00ffff ${vPct}%,rgba(255,255,255,0.15) ${vPct}%)`,
            }}
          />
          <span style={{ fontSize: "clamp(0.38rem,1vw,0.5rem)", opacity: 0.4, marginTop: 3, letterSpacing: "0.1em" }}>
            {vPct}%
          </span>
        </motion.div>

        {/* MUTE / UNMUTE */}
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
            {isMuted ? "UNMUTE" : "MUTE"}
          </span>
        </motion.button>

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
      </div>
    </>
  );
}
