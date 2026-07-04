import { useState, useEffect, useCallback, useMemo } from "react";
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
    case "idle":
      return { x: orb.startX, y: orb.startY, scale: 0,   opacity: 0    };
    case "flying":
      return { x: orb.startX * 0.08, y: orb.startY * 0.08, scale: 1,   opacity: 0.9  };
    case "converge":
      return { x: orb.convX,  y: orb.convY,  scale: 1.2,  opacity: 1.0  };
    case "flash":
      return { x: orb.convX * 1.6, y: orb.convY * 1.6, scale: 1.6, opacity: 1.0 };
    case "title":
    case "waiting":
    case "menu":
      return { x: orb.orbitX, y: orb.orbitY, scale: 0.8,  opacity: 0.5  };
    case "done":
      return { x: orb.orbitX * 1.4, y: orb.orbitY * 1.4, scale: 0, opacity: 0 };
  }
}

type BezierTuple = [number, number, number, number];

function getOrbTransition(phase: Phase, delay: number) {
  switch (phase) {
    case "flying":
      return { duration: 2.4, delay, ease: [0.16, 1, 0.3, 1] as BezierTuple };
    case "converge":
      return { duration: 0.65, ease: "easeOut" as const };
    case "flash":
      return { duration: 0.28, ease: "easeOut" as const };
    case "title":
      return { duration: 1.4, ease: [0.34, 1.26, 0.64, 1] as BezierTuple };
    case "done":
      return { duration: 0.6, ease: "easeIn" as const };
    default:
      return { duration: 0.3 };
  }
}

const DEV_SEQUENCE = ["O", "R", "B", "L", "I", "T", "Z"] as const;
const TITLE_LETTERS = ["O", "R", "B", "L", "I", "T", "Z"];

const MENU_BUTTONS = [
  {
    id: "play",
    label: "PLAY",
    icon: "▶",
    color: "#00ffcc",
    border: "rgba(0,255,204,0.55)",
    glow: "rgba(0,255,204,0.25)",
    bg: "rgba(0,255,204,0.08)",
    hoverBg: "rgba(0,255,204,0.18)",
  },
  {
    id: "howtoplay",
    label: "HOW TO PLAY",
    icon: "?",
    color: "#ffd700",
    border: "rgba(255,215,0,0.55)",
    glow: "rgba(255,215,0,0.2)",
    bg: "rgba(255,215,0,0.07)",
    hoverBg: "rgba(255,215,0,0.16)",
  },
  {
    id: "shop",
    label: "SHOP",
    icon: "★",
    color: "#ff9f1c",
    border: "rgba(255,159,28,0.55)",
    glow: "rgba(255,159,28,0.2)",
    bg: "rgba(255,159,28,0.07)",
    hoverBg: "rgba(255,159,28,0.16)",
  },
  {
    id: "inventory",
    label: "INVENTORY",
    icon: "⊞",
    color: "#bf7fff",
    border: "rgba(191,127,255,0.55)",
    glow: "rgba(191,127,255,0.2)",
    bg: "rgba(191,127,255,0.07)",
    hoverBg: "rgba(191,127,255,0.16)",
  },
  {
    id: "settings",
    label: "SETTINGS",
    icon: "⚙",
    color: "#94a3b8",
    border: "rgba(148,163,184,0.45)",
    glow: "rgba(148,163,184,0.15)",
    bg: "rgba(148,163,184,0.06)",
    hoverBg: "rgba(148,163,184,0.14)",
  },
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
  const [devFlash, setDevFlash] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const { playOrbWhoosh, playOrbConverge, playTitleReveal, startMenuMusic, playMenuSelect } = useAudio();
  const { openShop, openInventory, activateDevMode, coins: shopStars } = useShop();

  // Full intro sequence
  useEffect(() => {
    if (skipIntro) {
      try { startMenuMusic(); } catch {}
      onMenuReady?.();
      return;
    }
    try { startMenuMusic(); } catch {}

    const t0 = setTimeout(() => { setPhase("flying");   try { playOrbWhoosh();   } catch {} }, 150);
    const t1 = setTimeout(() => { setPhase("converge"); try { playOrbConverge(); } catch {} }, 2700);
    const t2 = setTimeout(() => { setPhase("flash"); },                                        3250);
    const t3 = setTimeout(() => { setPhase("title");    try { playTitleReveal(); } catch {} }, 3600);
    const t4 = setTimeout(() => { setPhase("waiting"); },                                      5100);

    return () => [t0, t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const handleTap = useCallback(() => {
    if (phase === "waiting") {
      setPhase("menu");
      onMenuReady?.();
    }
  }, [phase, onMenuReady]);

  const handleLetterClick = useCallback((letter: string, idx: number) => {
    const expected = DEV_SEQUENCE[devProgress];
    if (letter === expected && idx === devProgress) {
      const next = devProgress + 1;
      if (next === DEV_SEQUENCE.length) {
        activateDevMode();
        setDevFlash(true);
        setDevProgress(0);
        setTimeout(() => setDevFlash(false), 800);
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
      {/* Subtle grid / scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,255,0.015) 3px, rgba(0,255,255,0.015) 4px)",
          zIndex: 1,
        }}
      />

      {/* Orbs */}
      {orbDefs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width:       orb.size,
            height:      orb.size,
            left:        "50%",
            top:         "50%",
            marginLeft:  -orb.size / 2,
            marginTop:   -orb.size / 2,
            background:  `radial-gradient(circle at 38% 32%, ${orb.color}ff, ${orb.color}88 45%, transparent 75%)`,
            filter:      `blur(${orb.blur}px)`,
            boxShadow:   `0 0 ${orb.size * 1.2}px ${orb.color}55`,
            zIndex: 2,
          }}
          animate={getOrbTarget(orb, phase)}
          transition={getOrbTransition(phase, orb.delay)}
        />
      ))}

      {/* Convergence core glow */}
      <AnimatePresence>
        {(phase === "converge" || phase === "flash") && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 120, height: 120,
              left: "50%", top: "50%",
              marginLeft: -60, marginTop: -60,
              background: "radial-gradient(circle, #ffffff 0%, #00ffff 30%, #ff00ff 60%, transparent 80%)",
              filter: "blur(18px)",
              zIndex: 3,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={
              phase === "flash"
                ? { scale: [0.5, 2.8, 0.3], opacity: [0.8, 1, 0] }
                : { scale: 0.5, opacity: 0.6 }
            }
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: phase === "flash" ? 0.55 : 0.4, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Halo ring */}
      <AnimatePresence>
        {showTitle && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 580, height: 200,
              left: "50%", top: "50%",
              marginLeft: -290, marginTop: -100,
              boxShadow: "inset 0 0 0 1px rgba(0,255,255,0.07)",
              filter: "blur(1px)",
              zIndex: 3,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* ── Intro / waiting title (original centered position) ── */}
      <AnimatePresence>
        {(phase === "title" || phase === "waiting") && (
          <motion.div
            className="absolute z-10 text-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.65, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{
                fontSize: "clamp(3.5rem, 11vw, 7rem)",
                backgroundImage: "linear-gradient(135deg, #00ffff 0%, #aa00ff 45%, #ff00ff 75%, #ffff00 100%)",
              }}
              animate={{
                filter: [
                  "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                  "drop-shadow(0 0 28px rgba(255,0,255,0.6))  drop-shadow(0 0 56px rgba(0,255,255,0.3))",
                  "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                ],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              ORBLITZ
            </motion.h1>
            <motion.div
              className="mt-3 mx-auto"
              style={{
                height: 1,
                width: "clamp(160px, 36vw, 280px)",
                background: "linear-gradient(90deg, transparent, #00ffff 35%, #ff00ff 65%, transparent)",
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.65 }}
              transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Menu-phase title (top-anchored, interactive letters) ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute z-10 text-center"
            style={{ top: "clamp(24px, 7vh, 60px)", left: "50%", x: "-50%", zIndex: 10 }}
            initial={{ opacity: 0, scale: 0.82, y: -8 }}
            animate={{ opacity: 1, scale: 0.82, y: 0 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <motion.h1
              className="font-black tracking-widest flex items-center justify-center gap-0"
              style={{ fontSize: "clamp(3.5rem, 11vw, 7rem)" }}
              animate={{
                filter: devFlash
                  ? ["drop-shadow(0 0 24px #ffff00) drop-shadow(0 0 48px #ffaa00)"]
                  : [
                      "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                      "drop-shadow(0 0 28px rgba(255,0,255,0.6))  drop-shadow(0 0 56px rgba(0,255,255,0.3))",
                      "drop-shadow(0 0 18px rgba(0,255,255,0.55)) drop-shadow(0 0 36px rgba(255,0,255,0.25))",
                    ],
              }}
              transition={{ duration: devFlash ? 0.15 : 2.2, repeat: devFlash ? 0 : Infinity, ease: "easeInOut" }}
            >
              {TITLE_LETTERS.map((letter, idx) => (
                <motion.span
                  key={idx}
                  className="cursor-pointer"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #00ffff 0%, #aa00ff 45%, #ff00ff 75%, #ffff00 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    opacity: idx < devProgress ? 0.5 : 1,
                  }}
                  whileHover={{ scale: 1.15, y: -2 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={(e) => { e.stopPropagation(); handleLetterClick(letter, idx); }}
                >
                  {letter}
                </motion.span>
              ))}
            </motion.h1>
            <motion.div
              className="mt-2 mx-auto"
              style={{
                height: 1,
                width: "clamp(120px, 28vw, 220px)",
                background: "linear-gradient(90deg, transparent, #00ffff 35%, #ff00ff 65%, transparent)",
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.45 }}
              transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
            />
            {/* Shop stars badge */}
            <motion.div
              className="mt-2 flex items-center justify-center gap-1"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <span style={{ color: "#ffd700", fontSize: "0.85rem" }}>★</span>
              <span style={{ color: "#fde68a", fontSize: "0.85rem", fontWeight: 700 }}>{shopStars}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap to start */}
      <AnimatePresence>
        {showWaiting && (
          <motion.div
            className="absolute bottom-20 md:bottom-24 text-center z-10 pointer-events-none"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: [0, 0.9, 0.55, 0.9], y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <p
              className="text-lg md:text-xl font-semibold tracking-[0.22em] uppercase"
              style={{ color: "rgba(0,255,255,0.8)", textShadow: "0 0 18px rgba(0,255,255,0.45)" }}
            >
              Tap to Start
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ARCADE HD MENU BUTTONS ─── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute z-20 flex flex-col items-center gap-3 md:gap-4 w-full px-6"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -40%)",
            }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
              hidden:  { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
            }}
          >
            {MENU_BUTTONS.map((btn) => (
              <motion.button
                key={btn.id}
                className="relative w-full flex items-center justify-center gap-3 font-black uppercase tracking-widest overflow-hidden"
                style={{
                  maxWidth: "clamp(260px, 60vw, 380px)",
                  height: btn.id === "play" ? "clamp(52px, 7vw, 68px)" : "clamp(44px, 6vw, 58px)",
                  fontSize: btn.id === "play" ? "clamp(0.9rem, 2.8vw, 1.2rem)" : "clamp(0.72rem, 2.2vw, 0.95rem)",
                  borderRadius: 12,
                  border: `1.5px solid ${btn.border}`,
                  background: hoveredBtn === btn.id ? btn.hoverBg : btn.bg,
                  color: btn.color,
                  boxShadow: hoveredBtn === btn.id
                    ? `0 0 24px ${btn.glow}, 0 0 48px ${btn.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`
                    : `0 0 12px ${btn.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  backdropFilter: "blur(12px)",
                  letterSpacing: "0.18em",
                  cursor: "pointer",
                  transition: "background 0.18s, box-shadow 0.18s",
                  WebkitTapHighlightColor: "transparent",
                }}
                variants={{
                  hidden:  { opacity: 0, y: 32, scale: 0.88 },
                  visible: { opacity: 1, y: 0,  scale: 1,
                    transition: { type: "spring", stiffness: 340, damping: 28 } },
                }}
                whileTap={{ scale: 0.95 }}
                onHoverStart={() => setHoveredBtn(btn.id)}
                onHoverEnd={() => setHoveredBtn(null)}
                onClick={() => handleButton(btn.id)}
              >
                {/* Scanline shimmer */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(255,255,255,0.018) 5px, rgba(255,255,255,0.018) 6px)",
                    borderRadius: "inherit",
                  }}
                />
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{
                    width: 3,
                    borderRadius: "12px 0 0 12px",
                    background: btn.color,
                    opacity: hoveredBtn === btn.id ? 0.9 : 0.5,
                    transition: "opacity 0.18s",
                  }}
                />
                {/* Icon */}
                <span
                  style={{
                    fontSize: btn.id === "play" ? "1.25em" : "1.1em",
                    opacity: 0.9,
                    lineHeight: 1,
                    minWidth: "1.4em",
                    textAlign: "center",
                  }}
                >
                  {btn.icon}
                </span>
                {/* Label */}
                <span style={{ letterSpacing: "0.2em" }}>{btn.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
