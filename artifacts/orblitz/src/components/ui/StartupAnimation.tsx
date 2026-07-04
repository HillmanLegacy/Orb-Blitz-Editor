import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop } from "@/lib/stores/useShop";

type Phase = "idle" | "flying" | "converge" | "flash" | "title" | "waiting" | "menu" | "done";

interface StartupAnimationProps {
  skipIntro?: boolean;
  onShowModeSelect: () => void;
  onShowHowToPlay: () => void;
  onShowSettings: () => void;
  onMenuReady?: () => void;
}

const ORB_COLORS = ["#00ffff", "#ff00ff", "#ffff00", "#aa00ff", "#00ff88", "#ff8800", "#ffffff", "#00aaff"];

interface OrbDef {
  startX: number; startY: number;
  convX: number;  convY: number;
  orbitX: number; orbitY: number;
  size: number;   blur: number;
  color: string;  delay: number;
}

const ORB_COUNT = 30;
const orbDefs: OrbDef[] = Array.from({ length: ORB_COUNT }, (_, i) => {
  const startAngle = (i / ORB_COUNT) * Math.PI * 2 + (i % 3) * 0.25;
  const startDist  = 380 + (i % 5) * 55;
  const orbitAngle = (i / ORB_COUNT) * Math.PI * 2;
  return {
    startX:  Math.cos(startAngle) * startDist,
    startY:  Math.sin(startAngle) * startDist * 0.6,
    convX:   Math.cos(startAngle * 1.8) * 18,
    convY:   Math.sin(startAngle * 1.8) * 14,
    orbitX:  Math.cos(orbitAngle) * (255 + (i % 4) * 18),
    orbitY:  Math.sin(orbitAngle) * (90  + (i % 3) * 12),
    size:    9 + (i % 5) * 5,
    blur:    3 + (i % 4) * 2,
    color:   ORB_COLORS[i % ORB_COLORS.length],
    delay:   i * 0.05,
  };
});

function getOrbTarget(orb: OrbDef, phase: Phase) {
  switch (phase) {
    case "idle":    return { x: orb.startX, y: orb.startY, scale: 0,   opacity: 0   };
    case "flying":  return { x: orb.startX * 0.08, y: orb.startY * 0.08, scale: 1, opacity: 0.9 };
    case "converge":return { x: orb.convX,  y: orb.convY,  scale: 1.2, opacity: 1.0 };
    case "flash":   return { x: orb.convX * 1.6, y: orb.convY * 1.6, scale: 1.6, opacity: 1.0 };
    case "title": case "waiting": case "menu":
      return { x: orb.orbitX, y: orb.orbitY, scale: 0.8, opacity: 0.5 };
    case "done":    return { x: orb.orbitX * 1.4, y: orb.orbitY * 1.4, scale: 0, opacity: 0 };
  }
}

type BezierTuple = [number, number, number, number];
function getOrbTransition(phase: Phase, delay: number) {
  switch (phase) {
    case "flying":  return { duration: 2.4, delay, ease: [0.16, 1, 0.3, 1] as BezierTuple };
    case "converge":return { duration: 0.65, ease: "easeOut" as const };
    case "flash":   return { duration: 0.28, ease: "easeOut" as const };
    case "title":   return { duration: 1.4, ease: [0.34, 1.26, 0.64, 1] as BezierTuple };
    case "done":    return { duration: 0.6, ease: "easeIn" as const };
    default:        return { duration: 0.3 };
  }
}

const DEV_SEQUENCE = ["O","R","B","L","I","T","Z"] as const;
const TITLE_LETTERS = ["O","R","B","L","I","T","Z"];

// 5 buttons, each picking a colour from the title gradient arc
const MENU_BUTTONS = [
  { id: "play",      icon: "▶",  label: "PLAY",  shortLabel: "PLAY",  color: "#00ffff", shadow: "rgba(0,255,255,0.45)"  },
  { id: "howtoplay", icon: "?",  label: "GUIDE", shortLabel: "GUIDE", color: "#8844ff", shadow: "rgba(136,68,255,0.4)"  },
  { id: "shop",      icon: "★",  label: "SHOP",  shortLabel: "SHOP",  color: "#ff00ff", shadow: "rgba(255,0,255,0.4)"   },
  { id: "inventory", icon: "⊞",  label: "GEAR",  shortLabel: "GEAR",  color: "#ff7700", shadow: "rgba(255,119,0,0.4)"   },
  { id: "settings",  icon: "⚙",  label: "OPTS",  shortLabel: "OPTS",  color: "#ddcc00", shadow: "rgba(221,204,0,0.35)"  },
] as const;

export function StartupAnimation({
  skipIntro = false,
  onShowModeSelect,
  onShowHowToPlay,
  onShowSettings,
  onMenuReady,
}: StartupAnimationProps) {
  const [phase, setPhase] = useState<Phase>(skipIntro ? "menu" : "idle");
  const [devProgress, setDevProgress] = useState(0);
  const [devFlash, setDevFlash]       = useState(false);
  const [pressedBtn, setPressedBtn]   = useState<string | null>(null);

  const { playOrbWhoosh, playOrbConverge, playTitleReveal, startMenuMusic, playMenuSelect } = useAudio();
  const { openShop, openInventory, activateDevMode, coins: shopStars } = useShop();

  useEffect(() => {
    try { startMenuMusic(); } catch {}
    if (skipIntro) { onMenuReady?.(); return; }

    const t0 = setTimeout(() => { setPhase("flying");   try { playOrbWhoosh();   } catch {} }, 150);
    const t1 = setTimeout(() => { setPhase("converge"); try { playOrbConverge(); } catch {} }, 2700);
    const t2 = setTimeout(() => { setPhase("flash"); },                                        3250);
    const t3 = setTimeout(() => { setPhase("title");    try { playTitleReveal(); } catch {} }, 3600);
    const t4 = setTimeout(() => { setPhase("waiting"); },                                      5100);
    return () => [t0, t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const handleTap = useCallback(() => {
    if (phase === "waiting") { setPhase("menu"); onMenuReady?.(); }
  }, [phase, onMenuReady]);

  const handleLetterClick = useCallback((letter: string, idx: number) => {
    const expected = DEV_SEQUENCE[devProgress];
    if (letter === expected && idx === devProgress) {
      const next = devProgress + 1;
      if (next === DEV_SEQUENCE.length) {
        activateDevMode();
        setDevFlash(true);
        setDevProgress(0);
        setTimeout(() => setDevFlash(false), 700);
      } else {
        setDevProgress(next);
      }
    } else {
      setDevProgress(letter === DEV_SEQUENCE[0] ? 1 : 0);
    }
  }, [devProgress, activateDevMode]);

  const handleButton = useCallback((id: string) => {
    try { playMenuSelect(); } catch {}
    switch (id) {
      case "play":      onShowModeSelect(); break;
      case "howtoplay": onShowHowToPlay();  break;
      case "shop":      openShop();         break;
      case "inventory": openInventory();    break;
      case "settings":  onShowSettings();   break;
    }
  }, [onShowModeSelect, onShowHowToPlay, onShowSettings, openShop, openInventory, playMenuSelect]);

  const showTitle   = phase === "title" || phase === "waiting" || phase === "menu";
  const showWaiting = phase === "waiting";
  const showMenu    = phase === "menu";
  const isClickable = phase === "waiting";

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
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,255,0.012) 3px, rgba(0,255,255,0.012) 4px)",
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
          animate={getOrbTarget(orb, phase)}
          transition={getOrbTransition(phase, orb.delay)}
        />
      ))}

      {/* Convergence core */}
      <AnimatePresence>
        {(phase === "converge" || phase === "flash") && (
          <motion.div className="absolute rounded-full pointer-events-none" style={{
            width: 120, height: 120, left: "50%", top: "50%",
            marginLeft: -60, marginTop: -60,
            background: "radial-gradient(circle, #ffffff 0%, #00ffff 30%, #ff00ff 60%, transparent 80%)",
            filter: "blur(18px)", zIndex: 3,
          }}
            initial={{ scale: 0, opacity: 0 }}
            animate={phase === "flash" ? { scale: [0.5, 2.8, 0.3], opacity: [0.8, 1, 0] } : { scale: 0.5, opacity: 0.6 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: phase === "flash" ? 0.55 : 0.4, ease: "easeOut" }}
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

      {/* ── ORBLITZ TITLE — stays centered, never moves ── */}
      <AnimatePresence>
        {showTitle && (
          <motion.div
            className="absolute z-10 text-center"
            initial={{ opacity: 0, scale: 0.65, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* In menu phase: letters are dev-mode clickable */}
            {showMenu ? (
              <motion.h1
                className="font-black tracking-widest flex items-center justify-center"
                style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)", lineHeight: 1 }}
                animate={{
                  filter: devFlash
                    ? "drop-shadow(0 0 30px #ffff00) drop-shadow(0 0 60px #ffaa00)"
                    : [
                        "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                        "drop-shadow(0 0 28px rgba(255,0,255,0.6))  drop-shadow(0 0 56px rgba(0,255,255,0.3))",
                        "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                      ],
                }}
                transition={{ duration: devFlash ? 0.1 : 2.2, repeat: devFlash ? 0 : Infinity, ease: "easeInOut" }}
              >
                {TITLE_LETTERS.map((letter, idx) => (
                  <motion.span key={idx}
                    className="cursor-pointer"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #00ffff 0%, #aa00ff 45%, #ff00ff 75%, #ffff00 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      opacity: idx < devProgress ? 0.45 : 1,
                    }}
                    whileHover={{ scale: 1.14, y: -3 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); handleLetterClick(letter, idx); }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.h1>
            ) : (
              <motion.h1
                className="font-black tracking-widest text-transparent bg-clip-text pointer-events-none"
                style={{
                  fontSize: "clamp(3.5rem, 11vw, 7rem)",
                  lineHeight: 1,
                  backgroundImage: "linear-gradient(135deg, #00ffff 0%, #aa00ff 45%, #ff00ff 75%, #ffff00 100%)",
                }}
                animate={{ filter: [
                  "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                  "drop-shadow(0 0 28px rgba(255,0,255,0.6))  drop-shadow(0 0 56px rgba(0,255,255,0.3))",
                  "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                ]}}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                ORBLITZ
              </motion.h1>
            )}

            {/* Underline rule */}
            <motion.div className="mt-3 mx-auto" style={{
              height: 1,
              width: "clamp(160px, 36vw, 280px)",
              background: "linear-gradient(90deg, transparent, #00ffff 35%, #ff00ff 65%, transparent)",
            }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.65 }}
              transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
            />

            {/* Stars badge — menu phase only */}
            <AnimatePresence>
              {showMenu && (
                <motion.div className="mt-2 flex items-center justify-center gap-1.5"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                >
                  <span style={{ color: "#ffd700", fontSize: "0.8rem", lineHeight: 1 }}>★</span>
                  <span style={{ color: "#fde68a", fontSize: "0.8rem", fontWeight: 700 }}>{shopStars}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAP TO START — exits when menu appears ── */}
      <AnimatePresence>
        {showWaiting && (
          <motion.div
            className="absolute bottom-20 md:bottom-24 text-center z-10 pointer-events-none"
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

      {/* ── HORIZONTAL MENU BUTTONS — appear below the title ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute z-20 flex flex-row items-stretch justify-center"
            style={{
              top: "50%",
              left: "50%",
              marginLeft: "-50vw",
              width: "100vw",
              marginTop: "clamp(72px, 10.5vw, 108px)",
              gap: "clamp(8px, 2vw, 18px)",
              padding: "0 clamp(12px, 4vw, 48px)",
            }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              visible: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } },
              hidden:  { transition: { staggerChildren: 0.04,  staggerDirection: -1 } },
            }}
          >
            {MENU_BUTTONS.map((btn) => {
              const isPressed = pressedBtn === btn.id;
              return (
                <motion.button
                  key={btn.id}
                  className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
                  style={{
                    minWidth: 0,
                    maxWidth: "clamp(64px, 18vw, 110px)",
                    height: "clamp(72px, 13vw, 104px)",
                    borderRadius: "clamp(10px, 1.8vw, 16px)",
                    border: `1.5px solid ${btn.color}66`,
                    background: isPressed
                      ? `${btn.color}22`
                      : `linear-gradient(160deg, ${btn.color}12 0%, ${btn.color}07 100%)`,
                    color: btn.color,
                    boxShadow: isPressed
                      ? `0 0 28px ${btn.shadow}, 0 0 56px ${btn.shadow}, inset 0 0 16px ${btn.color}18`
                      : `0 0 14px ${btn.shadow}, inset 0 1px 0 ${btn.color}18`,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    transition: "background 0.15s, box-shadow 0.15s, border-color 0.15s",
                    borderColor: isPressed ? `${btn.color}cc` : `${btn.color}66`,
                  }}
                  variants={{
                    hidden:  { opacity: 0, y: 28, scale: 0.84 },
                    visible: {
                      opacity: 1, y: 0, scale: 1,
                      transition: { type: "spring", stiffness: 360, damping: 26 },
                    },
                  }}
                  whileTap={{ scale: 0.91 }}
                  onHoverStart={() => setPressedBtn(btn.id)}
                  onHoverEnd={() => setPressedBtn(null)}
                  onTapStart={() => setPressedBtn(btn.id)}
                  onTap={() => { setPressedBtn(null); handleButton(btn.id); }}
                  onClick={() => handleButton(btn.id)}
                >
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
                    height: 2,
                    background: `linear-gradient(90deg, transparent 10%, ${btn.color}99 50%, transparent 90%)`,
                    opacity: isPressed ? 1 : 0.6,
                    transition: "opacity 0.15s",
                  }} />

                  {/* Scanline shimmer */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.014) 4px, rgba(255,255,255,0.014) 5px)",
                    borderRadius: "inherit",
                  }} />

                  {/* Icon */}
                  <span style={{
                    fontSize: "clamp(1.3rem, 3.5vw, 2rem)",
                    lineHeight: 1,
                    marginBottom: "clamp(3px, 0.7vw, 6px)",
                    filter: `drop-shadow(0 0 6px ${btn.color}99)`,
                    display: "block",
                  }}>
                    {btn.icon}
                  </span>

                  {/* Label */}
                  <span style={{
                    fontSize: "clamp(0.5rem, 1.35vw, 0.72rem)",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    lineHeight: 1,
                    opacity: 0.9,
                    fontFamily: "inherit",
                  }}>
                    {btn.shortLabel}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
