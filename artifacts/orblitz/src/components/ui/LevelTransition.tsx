import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { GradeResults } from "./GradeResults";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconNext()   { return <svg {..._svg}><path d="M5 12 H19 M13 6 L19 12 L13 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconGear()   { return <svg {..._svg}><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.06" strokeDasharray="2 1.5"/></svg>; }
function IconLevels() { return <svg {..._svg}><rect x="3" y="4" width="18" height="3" rx="1.5" fill="currentColor" fillOpacity="0.85"/><rect x="3" y="10.5" width="13" height="3" rx="1.5" fill="currentColor" fillOpacity="0.55"/><rect x="3" y="17" width="8" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3"/></svg>; }
function IconHome()   { return <svg {..._svg}><path d="M3 11 L12 3 L21 11 V20 C21 20.55 20.55 21 20 21 H15 V15 H9 V21 H4 C3.45 21 3 20.55 3 20 V11 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/></svg>; }

// ─── Menu-theme palette ───────────────────────────────────────────────────────
const CYAN    = "#22d3ee";
const PURPLE  = "#a78bfa";
const PINK    = "#f472b6";
const GOLD    = "#fbbf24";

const ICON_SZ  = "clamp(1rem,min(3.2vw,4vh),1.65rem)";
const LABEL_SZ = "clamp(0.45rem,min(1.25vw,1.8vh),0.66rem)";
const BTN_H    = "clamp(48px,min(11vw,10vh),82px)";

// ─── Button primitives ────────────────────────────────────────────────────────
interface BtnDef { id: string; icon: React.ReactNode; label: string; color: string; shadow: string; action: () => void; }

function OrbBtn({ b, maxW, pressed, setPressed }: { b: BtnDef; maxW: string; pressed: boolean; setPressed: (v: boolean) => void }) {
  return (
    <motion.button
      className="orblitz-command-button orblitz-pause-command relative flex flex-col items-center justify-center overflow-hidden flex-1"
      style={{
        position: "relative", minWidth: 0, maxWidth: maxW, height: BTN_H,
        borderRadius: "clamp(8px, 1.1vw, 14px)",
        border: `1px solid ${pressed ? b.color : b.color + "aa"}`,
        background: pressed
          ? `linear-gradient(145deg, ${b.color}70, ${b.color}28 64%, rgba(7,12,38,0.92))`
          : `linear-gradient(145deg, rgba(220,252,255,0.14), ${b.color}2b 42%, rgba(7,12,38,0.9) 100%)`,
        color: b.color,
        boxShadow: pressed
          ? `2px 3px 0 rgba(3,7,26,0.78), 0 0 30px ${b.shadow}, inset 0 0 20px ${b.color}35`
          : `5px 7px 0 rgba(3,7,26,0.72), 0 0 18px ${b.shadow}, inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 rgba(0,0,0,0.42)`,
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        backdropFilter: "blur(8px)",
        transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s, transform 0.14s",
      }}
      variants={{
        hidden:  { opacity: 0, y: 16, scale: 0.86 },
        visible: { opacity: 1, y: 0,  scale: 1, transition: { type: "spring", stiffness: 360, damping: 26 } },
      }}
      whileTap={{ scale: 0.9 }}
      onHoverStart={() => setPressed(true)}
      onHoverEnd={() => setPressed(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={b.action}
      aria-label={b.label}
      data-active={pressed}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
        height: 3, opacity: pressed ? 1 : 0.72,
        background: `linear-gradient(90deg,${b.color}00 0%,${b.color}cc 20%,rgba(255,255,255,0.95) 50%,${b.color}22 80%,${b.color}00 100%)`,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(132deg, rgba(255,255,255,0.11), transparent 30%, transparent 58%, rgba(0,0,0,0.22))",
        borderRadius: "inherit",
      }} />
      <span style={{ fontSize: ICON_SZ, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: `drop-shadow(0 0 7px ${b.color}88) drop-shadow(2px 2px 0 rgba(3,7,26,0.55))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {b.icon}
      </span>
      <span style={{ fontSize: LABEL_SZ, fontWeight: 900, letterSpacing: "0.12em", lineHeight: 1, opacity: 0.96, fontFamily: "var(--font-display)" }}>
        {b.label}
      </span>
    </motion.button>
  );
}

function OrbButtonRow({ buttons }: { buttons: BtnDef[] }) {
  const [pressed, setPressed] = useState<string | null>(null);
  const maxW =
    buttons.length === 1 ? "clamp(120px,32vw,200px)" :
    buttons.length === 2 ? "clamp(90px,26vw,180px)" :
    buttons.length === 3 ? "clamp(68px,21vw,140px)" :
    "clamp(56px,17vw,110px)";
  return (
    <motion.div
      className="flex flex-row items-stretch justify-center w-full"
      style={{ gap: "clamp(6px,1.8vw,14px)" }}
      initial="hidden" animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        hidden:  { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
      }}
    >
      {buttons.map(b => (
        <OrbBtn key={b.id} b={b} maxW={maxW} pressed={pressed === b.id} setPressed={v => setPressed(v ? b.id : null)} />
      ))}
    </motion.div>
  );
}

const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  return (15 + (world - 1) * 10) + (sub - 1) * 5;
};

// ─── Floating orb data (static shape, no randomness in render) ────────────────
interface FloatingOrb { left: string; top: string; size: number; color: string; xOffset: number; yOffset: number; duration: number; }

// ─── Main component ───────────────────────────────────────────────────────────
interface LevelTransitionProps {
  onLevelSelect?: () => void;
  onMainMenu?: () => void;
}

export function LevelTransition({ onLevelSelect, onMainMenu }: LevelTransitionProps) {
  const { phase, arcadeLevel, startLoading, setPhase, score, lastResult } = useMagicOrb();
  const { openInventory } = useShop();
  const { playLevelComplete, playLevelSelect, stopMusic } = useAudio();
  const [soundPlayed, setSoundPlayed] = useState(false);

  useEffect(() => {
    if (phase === "levelComplete" && !soundPlayed) {
      try { playLevelComplete(); } catch {}
      setSoundPlayed(true);
    } else if (phase !== "levelComplete") {
      setSoundPlayed(false);
    }
  }, [phase, playLevelComplete, soundPlayed]);

  const floatingOrbs = useMemo<FloatingOrb[]>(() => {
    const colors = [CYAN, PURPLE, PINK, "#00ff88", "#ff8800"];
    return Array.from({ length: 24 }, (_, i) => ({
      left:     `${(i * 37 + 11) % 100}%`,
      top:      `${(i * 53 + 7)  % 100}%`,
      size:     40 + (i * 17) % 80,
      color:    colors[i % colors.length],
      xOffset:  ((i * 13) % 60) - 30,
      yOffset:  ((i * 19) % 60) - 30,
      duration: 3 + (i * 7) % 3,
    }));
  }, []);

  const sparkles = useMemo(() => {
    const pal = ["#ffffff", CYAN, PINK, GOLD, PURPLE, "#00ff88"];
    return Array.from({ length: 32 }, (_, i) => ({
      left:        `${(i * 53 + 5)  % 100}%`,
      top:         `${(i * 37 + 11) % 100}%`,
      size:        2 + (i * 3) % 4,
      color:       pal[i % pal.length],
      delay:       0.5 + (i * 0.072) % 1.2,
      duration:    1   + (i * 0.09)  % 1.5,
      repeatDelay: (i * 0.28) % 2,
    }));
  }, []);

  if (phase !== "levelComplete") return null;

  const sfx = () => { try { playLevelSelect(); } catch {}; };

  const currentLevel = Math.floor(arcadeLevel);
  const currentSub   = Math.round((arcadeLevel % 1) * 10);
  const nextSub      = currentSub >= 9 ? 1 : currentSub + 1;
  const nextWorld    = currentSub >= 9 ? currentLevel + 1 : currentLevel;
  const isBoss       = currentSub === 9;
  const nextOrbGoal  = getOrbGoal(nextWorld, nextSub);
  const isNextBoss   = nextSub === 9;

  const handleContinue = () => {
    sfx();
    const newLevel = currentSub >= 9
      ? currentLevel + 1 + 0.1
      : currentLevel + (currentSub + 1) / 10;
    useOrbTransition.getState().loadingSweep(() => {
      startLoading("nextLevel", newLevel);
    });
  };

  const handleLevelSelect = () => {
    sfx();
    useOrbTransition.getState().fastSweep(() => {
      if (onLevelSelect) onLevelSelect();
      setPhase("menu");
    });
  };

  const handleMainMenu = () => {
    sfx();
    stopMusic();
    if (onMainMenu) onMainMenu();
    useMagicOrb.getState().setPhase("menu");
  };

  const buttons: BtnDef[] = [
    { id: "next",      icon: <IconNext />,   label: "CONTINUE", color: CYAN,             shadow: `${CYAN}55`,                   action: handleContinue },
    { id: "inventory", icon: <IconGear />,   label: "GEAR",     color: PURPLE,           shadow: "rgba(167,139,250,0.4)",        action: () => { sfx(); openInventory(); } },
    ...(onLevelSelect
      ? [{ id: "levels", icon: <IconLevels />, label: "STAGES", color: PINK,              shadow: "rgba(244,114,182,0.4)",        action: handleLevelSelect }]
      : []),
    { id: "menu",      icon: <IconHome />,   label: "MENU",     color: "rgba(148,163,184,0.9)", shadow: "rgba(100,110,130,0.22)", action: handleMainMenu },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto pointer-events-auto select-none orblitz-pause-screen orblitz-result-screen ${isBoss ? "orblitz-boss-defeat-popup" : ""}`}
      style={{ padding: "clamp(8px,2vh,18px) clamp(10px,4vw,32px)", backgroundColor: "rgba(5,8,28,0.34)" }}
    >
      {/* Main-menu atmosphere carried into the level-complete state. */}
      <div className="absolute inset-0 pointer-events-none orblitz-result-atmosphere" style={{
        opacity: 0.9,
        background: "radial-gradient(ellipse at 50% 42%, rgba(67,22,134,0.3) 0%, rgba(9,70,105,0.18) 42%, transparent 80%), linear-gradient(135deg, rgba(4,17,57,0.16), rgba(60,8,72,0.18) 52%, rgba(0,42,60,0.16))",
      }} />

      {/* Cyan grid pattern */}
      <motion.div
        className="absolute inset-0 pointer-events-none orblitz-result-grid"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.07 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      />

      {/* Floating background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none orblitz-result-orbs">
        {floatingOrbs.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width:  orb.size,
              height: orb.size,
              left:   orb.left,
              top:    orb.top,
              background: `radial-gradient(circle, ${orb.color}30, ${orb.color}10, transparent)`,
            }}
            animate={{
              scale:   [0.8, 1.2, 0.8],
              opacity: [0.2, 0.5, 0.2],
              x:       [0, orb.xOffset, 0],
              y:       [0, orb.yOffset, 0],
            }}
            transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut", delay: i * 0.06 }}
          />
        ))}
      </div>

      {/* Decorative rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none orblitz-result-rings">
        {[
          { size: 220, color: isBoss ? GOLD   : CYAN,   thickness: 1.5 },
          { size: 340, color: isBoss ? PINK   : PURPLE, thickness: 1   },
          { size: 460, color: isBoss ? PURPLE : PINK,   thickness: 0.5 },
        ].map((ring, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{ width: ring.size, height: ring.size, borderColor: ring.color, borderWidth: ring.thickness }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.42, 0.18], scale: [0.4, 1.05, 1], rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ opacity: { delay: 0.15 + i * 0.1, duration: 0.7 }, scale: { delay: 0.15 + i * 0.1, duration: 0.7, ease: "easeOut" }, rotate: { duration: 20 + i * 5, repeat: Infinity, ease: "linear" } }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.45) 100%)" }}
      />

      {/* Scanlines */}
       <div className="absolute inset-0 pointer-events-none orblitz-result-scanlines" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.006) 3px,rgba(0,255,255,0.006) 4px)",
      }} />

      {/* Sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {sparkles.map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: s.left, top: s.top,
              width: s.size, height: s.size,
              backgroundColor: s.color,
              boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ delay: s.delay, duration: s.duration, repeat: Infinity, repeatDelay: s.repeatDelay }}
          />
        ))}
      </div>

      {/* Glass card */}
      <motion.div
        className="relative z-10 w-full flex flex-col items-center orblitz-result-card"
        style={{
          maxWidth: "clamp(320px,92vw,520px)",
          maxHeight: "calc(100dvh - 16px)",
          gap: "clamp(4px,1.15vh,9px)",
          padding: "clamp(10px,2.2vh,22px) clamp(14px,4vw,28px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          borderRadius: "clamp(16px,2.5vw,24px)",
          background: "linear-gradient(145deg, rgba(220,252,255,0.07), rgba(7,12,38,0.86) 42%, rgba(60,8,72,0.3))",
          border: `1px solid ${isBoss ? GOLD : CYAN}55`,
          boxShadow: `5px 7px 0 rgba(3,7,26,0.62), 0 0 48px ${isBoss ? GOLD : PURPLE}22, 0 0 90px rgba(34,211,238,0.09), inset 1px 1px 0 rgba(255,255,255,0.16)`,
          backdropFilter: "blur(24px)",
        }}
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
          height: 2, borderRadius: "inherit",
          background: `linear-gradient(90deg,transparent 5%,${isBoss ? GOLD : CYAN}88 40%,${isBoss ? PINK : PURPLE}88 60%,transparent 95%)`,
          opacity: 0.85,
        }} />

        {/* Card scanlines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
          borderRadius: "inherit",
        }} />

        {/* ── Title ── */}
          <div className="text-center orblitz-result-title">
          {isBoss ? (
            <>
              <motion.h1
                className="font-black tracking-widest text-transparent bg-clip-text"
                style={{
                fontSize: "clamp(1.45rem,min(7vw,6vh),3rem)", lineHeight: 1,
                  backgroundImage: `linear-gradient(135deg,${GOLD} 0%,${PINK} 55%,${PURPLE} 100%)`,
                }}
                animate={{ filter: [
                  `drop-shadow(0 0 12px ${GOLD}88) drop-shadow(0 0 24px ${PINK}44)`,
                  `drop-shadow(0 0 22px ${GOLD}cc) drop-shadow(0 0 44px ${PINK}66)`,
                  `drop-shadow(0 0 12px ${GOLD}88) drop-shadow(0 0 24px ${PINK}44)`,
                ]}}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                BOSS DEFEATED!
              </motion.h1>
            </>
          ) : (
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{
                fontSize: "clamp(1.25rem,min(5.5vw,5.5vh),2.4rem)", lineHeight: 1,
                backgroundImage: `linear-gradient(135deg,${CYAN} 0%,${PURPLE} 50%,${PINK} 100%)`,
              }}
              animate={{ filter: [
                `drop-shadow(0 0 10px ${CYAN}88)`,
                `drop-shadow(0 0 20px ${PURPLE}cc)`,
                `drop-shadow(0 0 10px ${PINK}88)`,
                `drop-shadow(0 0 10px ${CYAN}88)`,
              ]}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              LEVEL {currentLevel}.{currentSub} COMPLETE!
            </motion.h1>
          )}

          {/* Underline */}
          <div className="mt-2 mx-auto" style={{
            height: 1, width: "clamp(120px,50%,220px)",
            background: `linear-gradient(90deg,transparent,${CYAN}55 30%,${PURPLE}66 50%,${PINK}55 70%,transparent)`,
            opacity: 0.7,
          }} />
        </div>

        {/* ── Score ── */}
        <motion.div
          className="text-center orblitz-result-score"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, type: "spring", stiffness: 280, damping: 22 }}
        >
          <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.4)", letterSpacing: "0.22em", fontWeight: 700 }}>SCORE</span>
          <div
            className="font-black text-transparent bg-clip-text"
            style={{
               fontSize: "clamp(1.8rem,min(8vw,9vh),3.6rem)", lineHeight: 1.05,
              backgroundImage: `linear-gradient(135deg,${CYAN} 0%,${PURPLE} 50%,${PINK} 100%)`,
            }}
          >
            {score}
          </div>
        </motion.div>

        <GradeResults result={lastResult} compact />

        {/* ── Next level preview ── */}
        <AnimatePresence>
          <motion.div
            className="w-full rounded-2xl px-3 py-1.5 flex items-center justify-between"
            style={{
              background: "rgba(15,10,40,0.55)",
              border: `1px solid ${PURPLE}33`,
              backdropFilter: "blur(12px)",
            }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          >
            <div>
              <span style={{ fontSize: "clamp(0.44rem,1vw,0.56rem)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.18em", fontWeight: 700 }}>NEXT</span>
              <p className="font-black" style={{ fontSize: "clamp(0.75rem,1.8vw,1rem)", color: CYAN, letterSpacing: "0.06em" }}>
                {nextWorld}.{nextSub}
              </p>
            </div>
            <div className="text-right">
              <span style={{ fontSize: "clamp(0.44rem,1vw,0.56rem)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.14em", fontWeight: 700 }}>
                {isNextBoss ? "BOSS BATTLE" : "GOAL"}
              </span>
              <p className="font-bold" style={{ fontSize: "clamp(0.62rem,1.4vw,0.82rem)", color: "rgba(255,255,255,0.6)" }}>
                {isNextBoss ? "!!!" : `${nextOrbGoal} orbs`}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Button row ── */}
        <motion.div className="w-full orblitz-pause-deck orblitz-result-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <OrbButtonRow buttons={buttons} />
        </motion.div>
      </motion.div>
    </div>
  );
}
