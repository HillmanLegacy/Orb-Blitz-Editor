import { motion } from "framer-motion";
import { useEffect, useState, useMemo, useRef } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";

const LOADING_DURATION = 2500;

// ─── Orb field (mirrors StartupAnimation ambient orbs) ───────────────────────
const ORB_COLORS = ["#00ffff","#ff00ff","#ffff00","#aa00ff","#00ff88","#ff8800","#ffffff","#00aaff"];

interface AmbientOrb { x: number; y: number; size: number; blur: number; color: string; dur: number; delay: number; }
const makeOrbs = (): AmbientOrb[] =>
  Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.3;
    const r = 200 + (i % 5) * 60;
    return {
      x: Math.cos(a) * r, y: Math.sin(a) * r * 0.55,
      size: 7 + (i % 5) * 4, blur: 4 + (i % 4) * 2,
      color: ORB_COLORS[i % ORB_COLORS.length],
      dur: 4 + (i % 5) * 0.8, delay: (i * 0.21) % 3,
    };
  });

// ─── Loading copy ─────────────────────────────────────────────────────────────
function getHeadline(loadingType: string | null, gameMode: string, pendingLevel: number | null, arcadeLevel: number): string {
  if (loadingType === "exiting" || loadingType === "exiting_to_menu") return "RETURNING TO MENU";
  if (loadingType === "nextLevel") {
    const lvl = pendingLevel ?? arcadeLevel;
    const w = Math.floor(lvl);
    const s = Math.round((lvl % 1) * 10);
    const isBoss = s === 9;
    return isBoss ? `BOSS BATTLE — WORLD ${w}` : `LEVEL ${w}.${s}`;
  }
  if (loadingType === "entering") {
    if (gameMode === "arcade")   return "ARCADE MODE";
    if (gameMode === "chill")    return "CHILL MODE";
    if (gameMode === "gauntlet") return "GAUNTLET MODE";
    return "SURVIVAL MODE";
  }
  return "LOADING";
}

function getSub(loadingType: string | null, gameMode: string, pendingLevel: number | null, arcadeLevel: number): string {
  if (loadingType === "exiting" || loadingType === "exiting_to_menu") return "Clearing the field…";
  if (loadingType === "nextLevel") {
    const lvl = pendingLevel ?? arcadeLevel;
    const isBoss = Math.round((lvl % 1) * 10) === 9;
    return isBoss ? "Prepare yourself!" : "Destroy all dark orbs!";
  }
  if (loadingType === "entering") {
    if (gameMode === "chill")    return "Relax and have fun.";
    if (gameMode === "gauntlet") return "Don't miss a single shot!";
    if (gameMode === "arcade")   return "Prepare for the challenge!";
    return "How long can you survive?";
  }
  return "";
}

// ─── Accent colour per loading context ───────────────────────────────────────
function getAccent(loadingType: string | null, gameMode: string, pendingLevel: number | null, arcadeLevel: number): string {
  if (loadingType === "exiting" || loadingType === "exiting_to_menu") return "#aa00ff";
  if (loadingType === "nextLevel") {
    const lvl = pendingLevel ?? arcadeLevel;
    const isBoss = Math.round((lvl % 1) * 10) === 9;
    return isBoss ? "#ff4400" : "#00ffff";
  }
  if (gameMode === "gauntlet") return "#ffff00";
  if (gameMode === "chill")    return "#aa00ff";
  if (gameMode === "arcade")   return "#00ffff";
  return "#00ffff";
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LoadingScreen() {
  const { phase, loadingType, finishLoading, gameMode, pendingLevel, arcadeLevel } = useMagicOrb();
  const { startGameMusic, startMenuMusic, stopMusic } = useAudio();

  const [progress,   setProgress]   = useState(0);
  const [isVisible,  setIsVisible]  = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const musicTransRef  = useRef(false);

  const orbs = useMemo(makeOrbs, []);

  // visibility & music
  useEffect(() => {
    if (phase === "loading") {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      setIsVisible(true);
      setProgress(0);
      if (!musicTransRef.current) {
        musicTransRef.current = true;
        if (loadingType === "entering" || loadingType === "nextLevel") {
          stopMusic(); setTimeout(() => { try { startGameMusic(); } catch {} }, 1200);
        } else if (loadingType === "exiting" || loadingType === "exiting_to_menu") {
          stopMusic(); setTimeout(() => { try { startMenuMusic(); } catch {} }, 1200);
        }
      }
    } else {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      setIsVisible(false);
      musicTransRef.current = false;
    }
  }, [phase, loadingType, startGameMusic, startMenuMusic, stopMusic]);

  // progress ticker
  useEffect(() => {
    if (phase !== "loading") return;
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min((elapsed / LOADING_DURATION) * 100, 100);
      setProgress(p);
      if (elapsed >= LOADING_DURATION) { clearInterval(iv); finishLoading(); setIsVisible(false); }
    }, 50);
    return () => clearInterval(iv);
  }, [phase, finishLoading]);

  if (!isVisible && phase !== "loading") return null;

  const isExiting = loadingType === "exiting" || loadingType === "exiting_to_menu";
  const headline  = getHeadline(loadingType, gameMode, pendingLevel ?? null, arcadeLevel);
  const sub       = getSub(loadingType, gameMode, pendingLevel ?? null, arcadeLevel);
  const accent    = getAccent(loadingType, gameMode, pendingLevel ?? null, arcadeLevel);
  const pct       = Math.round(progress);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black select-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 80% 55% at 50% 50%, ${accent}0e 0%, rgba(170,0,255,0.04) 50%, transparent 80%)`,
      }} />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.008) 3px,rgba(0,255,255,0.008) 4px)",
      }} />

      {/* Drifting orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: orb.size, height: orb.size,
            left: "50%", top: "50%",
            marginLeft: -orb.size / 2, marginTop: -orb.size / 2,
            background: `radial-gradient(circle at 38% 32%, ${orb.color}cc, ${orb.color}55 50%, transparent 75%)`,
            filter: `blur(${orb.blur}px)`,
          }}
          animate={{
            x: [orb.x * 0.9, orb.x * 1.07, orb.x * 0.94, orb.x * 0.9],
            y: [orb.y * 0.9, orb.y * 1.07, orb.y * 0.94, orb.y * 0.9],
            opacity: [0.18, 0.42, 0.22, 0.18],
          }}
          transition={{ duration: orb.dur, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ padding: "0 clamp(20px,6vw,48px)" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >

        {/* Spinning orb */}
        <motion.div
          className="relative mb-6"
          style={{ width: "clamp(52px,10vw,72px)", height: "clamp(52px,10vw,72px)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
        >
          {/* outer ring */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `conic-gradient(${accent} 0deg, #ff00ff 120deg, #aa00ff 240deg, ${accent} 360deg)`,
            filter: "blur(3px)", opacity: 0.7,
          }} />
          {/* inner dark core */}
          <div className="absolute inset-[3px] rounded-full" style={{ background: "#050510" }} />
          {/* centre dot */}
          <motion.div
            className="absolute inset-[28%] rounded-full"
            style={{ background: `radial-gradient(circle, ${accent} 0%, ${accent}44 100%)` }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* ORBLITZ logotype — shown on exit/enter, hidden on level load to keep it clean */}
        {isExiting && (
          <motion.p
            className="font-black tracking-widest text-transparent bg-clip-text mb-1"
            style={{
              fontSize: "clamp(2.2rem,8vw,3.5rem)", lineHeight: 1,
              backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 45%,#ff00ff 75%,#ffff00 100%)",
            }}
            animate={{ filter: [
              "drop-shadow(0 0 14px rgba(0,255,255,0.45)) drop-shadow(0 0 28px rgba(255,0,255,0.2))",
              "drop-shadow(0 0 22px rgba(255,0,255,0.55)) drop-shadow(0 0 44px rgba(0,255,255,0.25))",
              "drop-shadow(0 0 14px rgba(0,255,255,0.45)) drop-shadow(0 0 28px rgba(255,0,255,0.2))",
            ]}}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            ORBLITZ
          </motion.p>
        )}

        {/* Headline */}
        <motion.h1
          className="font-black tracking-widest text-transparent bg-clip-text"
          style={{
            fontSize: isExiting ? "clamp(0.8rem,2vw,1.1rem)" : "clamp(1.4rem,5vw,2.2rem)",
            lineHeight: 1.1, letterSpacing: "0.18em",
            backgroundImage: `linear-gradient(135deg,${accent} 0%,#ff00ff 60%,#aa00ff 100%)`,
            marginTop: isExiting ? "0.35em" : 0,
          }}
          animate={{ filter: [
            `drop-shadow(0 0 8px ${accent}88)`,
            `drop-shadow(0 0 16px ${accent}cc)`,
            `drop-shadow(0 0 8px ${accent}88)`,
          ]}}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {headline}
        </motion.h1>

        {/* Underline */}
        <div className="mt-2 mb-3 mx-auto" style={{
          height: 1, width: "clamp(100px,40%,200px)",
          background: `linear-gradient(90deg,transparent,${accent}55 40%,#ff00ff55 60%,transparent)`,
        }} />

        {/* Sub text */}
        {sub && (
          <p style={{ fontSize: "clamp(0.55rem,1.3vw,0.72rem)", color: "rgba(255,255,255,0.32)", letterSpacing: "0.2em", fontWeight: 600, marginBottom: "1rem" }}>
            {sub.toUpperCase()}
          </p>
        )}

        {/* Progress bar */}
        <div style={{ width: "clamp(180px,48vw,300px)" }}>
          <div className="rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.07)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg,${accent},#ff00ff,#aa00ff)`,
                boxShadow: `0 0 8px ${accent}88`,
              }}
              transition={{ duration: 0.05 }}
            />
          </div>
          <p className="text-center mt-2" style={{ fontSize: "clamp(0.44rem,1vw,0.56rem)", color: "rgba(255,255,255,0.18)", letterSpacing: "0.22em" }}>
            {pct}%
          </p>
        </div>

      </motion.div>
    </motion.div>
  );
}
