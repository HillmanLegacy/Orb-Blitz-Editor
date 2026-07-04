import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const _svg = { viewBox: "0 0 24 24", fill: "none", width: "1em", height: "1em", style: { display: "block" } } as const;
function IconRetry()  { return <svg {..._svg}><path d="M4 12 C4 7.58 7.58 4 12 4 C14.76 4 17.2 5.33 18.73 7.39" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M20 12 C20 16.42 16.42 20 12 20 C9.24 20 6.8 18.67 5.27 16.61" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M18 4 L19.5 7.8 L15.7 7.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.7"/></svg>; }
function IconLevels() { return <svg {..._svg}><rect x="3" y="4" width="18" height="3" rx="1.5" fill="currentColor" fillOpacity="0.85"/><rect x="3" y="10.5" width="13" height="3" rx="1.5" fill="currentColor" fillOpacity="0.55"/><rect x="3" y="17" width="8" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3"/></svg>; }
function IconHome()   { return <svg {..._svg}><path d="M3 11 L12 3 L21 11 V20 C21 20.55 20.55 21 20 21 H15 V15 H9 V21 H4 C3.45 21 3 20.55 3 20 V11 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12"/></svg>; }

// ─── Shared button-row primitives (mirrors StartupAnimation's ButtonRow) ──────
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

function OrbBtn({ b, maxW, pressed, setPressed }: { b: BtnDef; maxW: string; pressed: boolean; setPressed: (v: boolean) => void; }) {
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
    "clamp(60px,19vw,120px)";
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

// ─── High score helpers ───────────────────────────────────────────────────────
interface HSEntry { name: string; score: number; date: string; }
const PROFANITY = ["fuck","shit","ass","bitch","damn","hell","crap","dick","cock","pussy","fag","slut","whore","nigger","nigga","retard","cunt","bastard","piss","bollocks","wanker","twat","arse","bloody","sex","porn","xxx","nude","naked","kill","murder","rape","nazi","hitler","terrorist","bomb","drug","cocaine","heroin","meth"];
function hasProfanity(t: string) {
  const c = t.toLowerCase().replace(/[^a-z]/g, "");
  const leet: Record<string,string> = { "0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","@":"a" };
  let d = t.toLowerCase();
  for (const [k,v] of Object.entries(leet)) d = d.split(k).join(v);
  d = d.replace(/[^a-z]/g, "");
  return PROFANITY.some(w => c.includes(w) || d.includes(w));
}
function loadScores(): HSEntry[] {
  try { const s = localStorage.getItem("orblitz_highscores"); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveScore(e: HSEntry) {
  try {
    const all = [...loadScores(), e].sort((a,b) => b.score - a.score).slice(0, 10);
    localStorage.setItem("orblitz_highscores", JSON.stringify(all));
  } catch {}
}

// ─── Name entry form ──────────────────────────────────────────────────────────
function NameEntry({ score, onDone }: { score: number; onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const t = name.trim();
    if (t.length < 2) { setError("At least 2 characters"); return; }
    if (t.length > 12) { setError("12 characters max"); return; }
    if (hasProfanity(t)) { setError("Please choose an appropriate name"); return; }
    saveScore({ name: t, score, date: new Date().toISOString() });
    onDone();
  };

  return (
    <motion.div
      className="w-full rounded-2xl p-4"
      style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)" }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-center font-black tracking-widest mb-3"
        style={{ fontSize: "clamp(0.55rem,1.4vw,0.72rem)", color: "#ffd700", letterSpacing: "0.2em" }}>
        NEW HIGH SCORE — ENTER YOUR NAME
      </p>
      <input
        type="text" value={name} onChange={e => { setName(e.target.value); setError(""); }}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Your name…" maxLength={12} autoFocus
        className="w-full px-3 py-2 rounded-xl text-white text-base font-bold placeholder-white/20 focus:outline-none mb-2"
        style={{ background: "rgba(0,0,0,0.55)", border: "1.5px solid rgba(255,215,0,0.35)", letterSpacing: "0.06em" }}
      />
      {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
      <div className="flex gap-2">
        <motion.button onClick={submit} whileTap={{ scale: 0.95 }}
          className="flex-1 py-2 rounded-xl font-black tracking-widest text-black"
          style={{ fontSize: "clamp(0.55rem,1.3vw,0.7rem)", letterSpacing: "0.16em", background: "linear-gradient(90deg,#ffd700,#ffaa00)" }}>
          SAVE
        </motion.button>
        <motion.button onClick={onDone} whileTap={{ scale: 0.95 }}
          className="px-4 py-2 rounded-xl font-bold"
          style={{ fontSize: "clamp(0.55rem,1.3vw,0.7rem)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}>
          SKIP
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
function Leaderboard({ highlight }: { highlight: number }) {
  const scores = loadScores();
  if (scores.length === 0) return null;
  const rankColor = (i: number) => i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(170,0,255,0.7)";
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,255,255,0.1)" }}>
      <p className="text-center font-black tracking-widest py-1.5"
        style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", letterSpacing: "0.22em", color: "rgba(0,255,255,0.5)", background: "rgba(0,255,255,0.04)", borderBottom: "1px solid rgba(0,255,255,0.08)" }}>
        LEADERBOARD
      </p>
      <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.04)" }}>
        {scores.slice(0, 5).map((e, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-1.5"
            style={{ background: e.score === highlight ? "rgba(0,255,255,0.06)" : "transparent" }}>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs" style={{ color: rankColor(i), minWidth: "1.2em" }}>#{i+1}</span>
              <span className="font-semibold text-white/80" style={{ fontSize: "clamp(0.6rem,1.4vw,0.78rem)" }}>{e.name}</span>
            </div>
            <span className="font-black" style={{ fontSize: "clamp(0.6rem,1.4vw,0.78rem)", color: e.score === highlight ? "#00ffff" : "rgba(0,255,255,0.55)" }}>{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2"
      style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${color}22` }}>
      <span style={{ fontSize: "clamp(0.48rem,1.1vw,0.6rem)", color: "rgba(255,255,255,0.38)", letterSpacing: "0.14em", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: "clamp(0.9rem,2.2vw,1.25rem)", color, fontWeight: 900, lineHeight: 1.2 }}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface GameOverProps { onLevelSelect?: () => void; onMainMenu?: () => void; }

export function GameOver({ onLevelSelect, onMainMenu }: GameOverProps) {
  const { score, highScore, startLoading, setPhase, gameTime, gameMode, arcadeLevel, phase, gauntletOrbsDestroyed } = useMagicOrb();
  const { playGameOver, playMenuSelect } = useAudio();

  const existingScores = loadScores();
  const minScore = existingScores.length > 0 ? Math.min(...existingScores.map(e => e.score)) : 0;
  const isTopScore = score > 0 && (existingScores.length < 10 || score > minScore);
  const isNewBest  = score === highScore && score > 0;

  const [showNameEntry, setShowNameEntry] = useState(isTopScore);
  const [nameSaved,     setNameSaved]     = useState(false);

  useEffect(() => {
    if (phase === "gameOver") { try { playGameOver(); } catch {} }
  }, [phase, playGameOver]);

  const sfx = () => { try { playMenuSelect(); } catch {} };

  const handlePlayAgain = () => {
    sfx();
    useOrbTransition.getState().loadingSweep(() => {
      if (gameMode === "arcade") startLoading("nextLevel", arcadeLevel);
      else startLoading("entering");
    });
  };
  const handleMainMenu = () => {
    sfx();
    useOrbTransition.getState().loadingSweep(() => {
      if (onMainMenu) onMainMenu();
      useMagicOrb.getState().startLoading("exiting");
    });
  };
  const handleLevelSelect = () => {
    sfx();
    useOrbTransition.getState().fastSweep(() => {
      setPhase("menu");
      if (onLevelSelect) onLevelSelect();
    });
  };

  const buttons: BtnDef[] = [
    { id: "retry", icon: <IconRetry />, label: "RETRY",     color: "#00ffff", shadow: "rgba(0,255,255,0.45)",  action: handlePlayAgain },
    ...(gameMode === "arcade" && onLevelSelect
      ? [{ id: "levels", icon: <IconLevels />, label: "LEVELS", color: "#aa00ff", shadow: "rgba(170,0,255,0.4)", action: handleLevelSelect }]
      : []),
    { id: "menu",  icon: <IconHome />,  label: "MENU",      color: "#667788", shadow: "rgba(100,110,130,0.22)", action: handleMainMenu  },
  ];

  // Title gradient: red-pink for impact, within the brand palette arc
  const titleGrad = gameMode === "gauntlet"
    ? "linear-gradient(135deg,#ff8844 0%,#ff00ff 60%,#ffff00 100%)"
    : "linear-gradient(135deg,#ff4466 0%,#ff00ff 55%,#aa00ff 100%)";

  const titleText = gameMode === "gauntlet" ? "GAUNTLET OVER" : "GAME OVER";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black pointer-events-auto select-none"
      style={{ padding: "clamp(12px,3vh,28px) clamp(12px,4vw,32px)" }}>

      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 55% at 50% 50%, rgba(170,0,255,0.08) 0%, rgba(255,0,128,0.05) 45%, transparent 75%)",
      }} />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.008) 3px,rgba(0,255,255,0.008) 4px)",
      }} />

      {/* Glass card */}
      <motion.div
        className="relative z-10 w-full flex flex-col items-center gap-3"
        style={{ maxWidth: "clamp(300px,90vw,440px)" }}
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Title */}
        <div className="text-center">
          <motion.h1
            className="font-black tracking-widest text-transparent bg-clip-text"
            style={{ fontSize: "clamp(2rem,8vw,3.5rem)", lineHeight: 1, backgroundImage: titleGrad }}
            animate={{ filter: [
              "drop-shadow(0 0 14px rgba(255,0,128,0.55)) drop-shadow(0 0 28px rgba(170,0,255,0.3))",
              "drop-shadow(0 0 22px rgba(255,0,255,0.65)) drop-shadow(0 0 44px rgba(255,0,128,0.35))",
              "drop-shadow(0 0 14px rgba(255,0,128,0.55)) drop-shadow(0 0 28px rgba(170,0,255,0.3))",
            ]}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {titleText}
          </motion.h1>

          {/* Underline */}
          <div className="mt-2 mx-auto" style={{
            height: 1, width: "clamp(120px,50%,220px)",
            background: "linear-gradient(90deg,transparent,#ff00ff 35%,#aa00ff 65%,transparent)",
            opacity: 0.55,
          }} />
        </div>

        {/* Score */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, type: "spring", stiffness: 280, damping: 22 }}
        >
          <span style={{ fontSize: "clamp(0.5rem,1.2vw,0.62rem)", color: "rgba(255,255,255,0.35)", letterSpacing: "0.22em", fontWeight: 700 }}>SCORE</span>
          <div className="font-black text-transparent bg-clip-text"
            style={{ fontSize: "clamp(2.4rem,9vw,4rem)", lineHeight: 1, backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 50%,#ff00ff 100%)" }}>
            {score}
          </div>
          {isNewBest && !showNameEntry && (
            <motion.span
              className="font-black tracking-widest"
              style={{ fontSize: "clamp(0.5rem,1.2vw,0.6rem)", color: "#ffd700", letterSpacing: "0.2em" }}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            >
              ★ NEW BEST ★
            </motion.span>
          )}
        </motion.div>

        {/* Stats row */}
        <AnimatePresence>
          {!showNameEntry && (
            <motion.div className="grid grid-cols-2 w-full gap-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.1 }}>
              {gameMode === "gauntlet" ? (
                <>
                  <StatCard label="TIME"         value={`${Math.floor(gameTime)}s`}      color="#00ffff" />
                  <StatCard label="ORBS SLAIN"   value={String(gauntletOrbsDestroyed)}   color="#ff00ff" />
                </>
              ) : (
                <>
                  <StatCard label="BEST"         value={String(highScore)}               color="#ffd700" />
                  <StatCard label="TIME"         value={`${Math.floor(gameTime)}s`}      color="#00ffff" />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name entry (top score) */}
        <AnimatePresence>
          {showNameEntry && !nameSaved && (
            <div className="w-full">
              <NameEntry score={score} onDone={() => { setShowNameEntry(false); setNameSaved(true); }} />
            </div>
          )}
        </AnimatePresence>

        {/* Leaderboard */}
        <AnimatePresence>
          {!showNameEntry && (
            <motion.div className="w-full"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.2 }}>
              <Leaderboard highlight={score} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button row */}
        <AnimatePresence>
          {!showNameEntry && (
            <motion.div className="w-full"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.28 }}>
              <OrbButtonRow buttons={buttons} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
