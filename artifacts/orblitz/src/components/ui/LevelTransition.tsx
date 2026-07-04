import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconNext()      { return <svg {..._svg}><path d="M5 12 H19 M13 6 L19 12 L13 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconGear()      { return <svg {..._svg}><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.06" strokeDasharray="2 1.5"/></svg>; }
function IconLevels()    { return <svg {..._svg}><rect x="3" y="4" width="18" height="3" rx="1.5" fill="currentColor" fillOpacity="0.85"/><rect x="3" y="10.5" width="13" height="3" rx="1.5" fill="currentColor" fillOpacity="0.55"/><rect x="3" y="17" width="8" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3"/></svg>; }
function IconHome()      { return <svg {..._svg}><path d="M3 11 L12 3 L21 11 V20 C21 20.55 20.55 21 20 21 H15 V15 H9 V21 H4 C3.45 21 3 20.55 3 20 V11 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/></svg>; }

// ─── Shared button primitives ─────────────────────────────────────────────────
const ICON_SZ  = "clamp(1.2rem,3.2vw,1.8rem)";
const LABEL_SZ = "clamp(0.48rem,1.25vw,0.68rem)";
const BTN_H    = "clamp(64px,11vw,90px)";

function TopLine({ color }: { color: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
      height: 2, opacity: 0.55,
      background: `linear-gradient(90deg,transparent 8%,${color}88 50%,transparent 92%)`,
    }} />
  );
}
function Scanlines() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,0.012) 4px,rgba(255,255,255,0.012) 5px)",
      borderRadius: "inherit",
    }} />
  );
}

interface BtnDef { id: string; icon: React.ReactNode; label: string; color: string; shadow: string; action: () => void; }

function OrbBtn({ b, maxW, pressed, setPressed }: { b: BtnDef; maxW: string; pressed: boolean; setPressed: (v: boolean) => void }) {
  return (
    <motion.button
      className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
      style={{
        minWidth: 0, maxWidth: maxW, height: BTN_H,
        borderRadius: "clamp(10px,1.6vw,14px)",
        border: `1.5px solid ${pressed ? b.color + "cc" : b.color + "55"}`,
        background: pressed ? `${b.color}20` : `linear-gradient(160deg,${b.color}10 0%,${b.color}06 100%)`,
        color: b.color,
        boxShadow: pressed
          ? `0 0 24px ${b.shadow}, 0 0 48px ${b.shadow}, inset 0 0 14px ${b.color}14`
          : `0 0 12px ${b.shadow}, inset 0 1px 0 ${b.color}14`,
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        transition: "background 0.14s, box-shadow 0.14s, border-color 0.14s",
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
    >
      <TopLine color={b.color} />
      <Scanlines />
      <span style={{ fontSize: ICON_SZ, lineHeight: 1, marginBottom: "clamp(2px,0.6vw,5px)", filter: `drop-shadow(0 0 5px ${b.color}88)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {b.icon}
      </span>
      <span style={{ fontSize: LABEL_SZ, fontWeight: 800, letterSpacing: "0.13em", lineHeight: 1, opacity: 0.88 }}>
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

// ─── World colour palette ─────────────────────────────────────────────────────
const WORLD_COLORS: Record<number, { primary: string; secondary: string; name: string }> = {
  1: { primary: "#00ffff", secondary: "#0088ff", name: "Sky Realm" },
  2: { primary: "#ff00ff", secondary: "#8800ff", name: "Void Dimension" },
  3: { primary: "#ffff00", secondary: "#ff8800", name: "Solar Expanse" },
  4: { primary: "#00ff88", secondary: "#00aa44", name: "Forest Kingdom" },
  5: { primary: "#ff4488", secondary: "#cc0044", name: "Crystal Caves" },
  6: { primary: "#8888ff", secondary: "#4444cc", name: "Storm Peaks" },
  7: { primary: "#ff8844", secondary: "#cc4400", name: "Lava Fields" },
  8: { primary: "#44ffff", secondary: "#00cccc", name: "Ocean Depths" },
  9: { primary: "#ffff88", secondary: "#cccc00", name: "Star Core" },
};

const getOrbGoal = (world: number, sub: number): number => {
  if (sub === 9) return 1;
  return (15 + (world - 1) * 10) + (sub - 1) * 5;
};

// ─── Main component ───────────────────────────────────────────────────────────
interface LevelTransitionProps {
  onLevelSelect?: () => void;
  onMainMenu?: () => void;
}

export function LevelTransition({ onLevelSelect, onMainMenu }: LevelTransitionProps) {
  const { phase, arcadeLevel, startLoading, setPhase, score } = useMagicOrb();
  const { openInventory } = useShop();
  const { playLevelComplete, playMenuSelect } = useAudio();
  const [soundPlayed, setSoundPlayed] = useState(false);

  useEffect(() => {
    if (phase === "levelComplete" && !soundPlayed) {
      try { playLevelComplete(); } catch {}
      setSoundPlayed(true);
    } else if (phase !== "levelComplete") {
      setSoundPlayed(false);
    }
  }, [phase, playLevelComplete, soundPlayed]);

  if (phase !== "levelComplete") return null;

  const sfx = () => { try { playMenuSelect(); } catch {}; };

  const currentLevel  = Math.floor(arcadeLevel);
  const currentSub    = Math.round((arcadeLevel % 1) * 10);
  const nextSub       = currentSub >= 9 ? 1 : currentSub + 1;
  const nextWorld     = currentSub >= 9 ? currentLevel + 1 : currentLevel;
  const isBoss        = currentSub === 9;
  const colors        = WORLD_COLORS[currentLevel] || WORLD_COLORS[1];
  const primary       = isBoss ? "#ffff00" : colors.primary;
  const secondary     = isBoss ? "#ff8800" : colors.secondary;
  const nextOrbGoal   = getOrbGoal(nextWorld, nextSub);
  const isNextBoss    = nextSub === 9;

  const handleContinue = () => {
    sfx();
    const newLevel = currentSub >= 9
      ? currentLevel + 1 + 0.1
      : currentLevel + (currentSub + 1) / 10;
    startLoading("nextLevel", newLevel);
  };

  const handleLevelSelect = () => {
    sfx();
    if (onLevelSelect) { onLevelSelect(); setTimeout(() => setPhase("menu"), 0); }
  };

  const handleMainMenu = () => {
    sfx();
    if (onMainMenu) onMainMenu();
    useMagicOrb.getState().startLoading("exiting");
  };

  const buttons: BtnDef[] = [
    { id: "next",      icon: <IconNext />,   label: "NEXT",      color: primary,    shadow: `${primary}55`,              action: handleContinue  },
    { id: "inventory", icon: <IconGear />,   label: "GEAR",      color: "#aa00ff",  shadow: "rgba(170,0,255,0.4)",        action: () => { sfx(); openInventory(); } },
    ...(onLevelSelect
      ? [{ id: "levels", icon: <IconLevels />, label: "LEVELS",  color: "#ff00ff",  shadow: "rgba(255,0,255,0.4)",        action: handleLevelSelect }]
      : []),
    { id: "menu",      icon: <IconHome />,   label: "MENU",      color: "#667788",  shadow: "rgba(100,110,130,0.22)",     action: handleMainMenu  },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black pointer-events-auto select-none"
      style={{ padding: "clamp(12px,3vh,28px) clamp(12px,4vw,32px)" }}>

      {/* Radial world-colour glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          background: `radial-gradient(ellipse 75% 55% at 50% 50%, ${primary}18 0%, ${secondary}0a 55%, transparent 80%)`,
        }}
      />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.008) 3px,rgba(0,255,255,0.008) 4px)",
      }} />

      {/* Glass card */}
      <motion.div
        className="relative z-10 w-full flex flex-col items-center gap-3"
        style={{ maxWidth: "clamp(300px,90vw,440px)" }}
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      >

        {/* ── Title ── */}
        <div className="text-center">
          {isBoss ? (
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{ fontSize: "clamp(1.8rem,7vw,3rem)", lineHeight: 1, backgroundImage: "linear-gradient(135deg,#ffff00 0%,#ff8800 55%,#ff4400 100%)" }}
              animate={{ filter: [
                "drop-shadow(0 0 12px rgba(255,200,0,0.6)) drop-shadow(0 0 24px rgba(255,100,0,0.3))",
                "drop-shadow(0 0 22px rgba(255,220,0,0.85)) drop-shadow(0 0 44px rgba(255,150,0,0.5))",
                "drop-shadow(0 0 12px rgba(255,200,0,0.6)) drop-shadow(0 0 24px rgba(255,100,0,0.3))",
              ]}}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              BOSS DEFEATED!
            </motion.h1>
          ) : (
            <motion.h1
              className="font-black tracking-widest text-transparent bg-clip-text"
              style={{ fontSize: "clamp(1.5rem,5.5vw,2.4rem)", lineHeight: 1, backgroundImage: `linear-gradient(135deg,${primary} 0%,${secondary} 100%)` }}
              animate={{ filter: [
                `drop-shadow(0 0 10px ${primary}88)`,
                `drop-shadow(0 0 20px ${primary}cc)`,
                `drop-shadow(0 0 10px ${primary}88)`,
              ]}}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              LEVEL {currentLevel}.{currentSub} COMPLETE!
            </motion.h1>
          )}

          {isBoss && (
            <p className="font-bold mt-1" style={{ fontSize: "clamp(0.62rem,1.5vw,0.82rem)", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>
              {colors.name} Complete
            </p>
          )}

          {/* Underline */}
          <div className="mt-2 mx-auto" style={{
            height: 1, width: "clamp(120px,50%,220px)",
            background: `linear-gradient(90deg,transparent,${primary}55 40%,${secondary}55 60%,transparent)`,
            opacity: 0.6,
          }} />
        </div>

        {/* ── Score ── */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, type: "spring", stiffness: 280, damping: 22 }}
        >
          <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.35)", letterSpacing: "0.22em", fontWeight: 700 }}>SCORE</span>
          <div className="font-black text-transparent bg-clip-text"
            style={{ fontSize: "clamp(2.2rem,8vw,3.6rem)", lineHeight: 1.05, backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 50%,#ff00ff 100%)" }}>
            {score}
          </div>
        </motion.div>

        {/* ── Next level preview ── */}
        <AnimatePresence>
          <motion.div
            className="w-full rounded-2xl px-4 py-2.5 flex items-center justify-between"
            style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${primary}22` }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          >
            <div>
              <span style={{ fontSize: "clamp(0.44rem,1vw,0.56rem)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.18em", fontWeight: 700 }}>NEXT</span>
              <p className="font-black" style={{ fontSize: "clamp(0.75rem,1.8vw,1rem)", color: primary, letterSpacing: "0.06em" }}>
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
        <motion.div className="w-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <OrbButtonRow buttons={buttons} />
        </motion.div>

      </motion.div>
    </div>
  );
}
