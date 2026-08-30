import { motion } from "framer-motion";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { GradeResults } from "./GradeResults";
import { useState, useEffect, useCallback } from "react";

// ── Orb field — identical constants to StartupAnimation ──────────────────────
const ORB_COLORS = ["#00ffff","#ff00ff","#ffff00","#aa00ff","#00ff88","#ff8800","#ffffff","#00aaff"];
const ORB_COUNT  = 30;

interface OrbDef {
  orbitX: number; orbitY: number;
  size: number; blur: number; color: string;
}

const orbDefs: OrbDef[] = Array.from({ length: ORB_COUNT }, (_, i) => {
  const oa = (i / ORB_COUNT) * Math.PI * 2;
  return {
    orbitX: Math.cos(oa) * (255 + (i % 4) * 18),
    orbitY: Math.sin(oa) * (90  + (i % 3) * 12),
    size:   9 + (i % 5) * 5,
    blur:   3 + (i % 4) * 2,
    color:  ORB_COLORS[i % ORB_COLORS.length],
  };
});

// ─────────────────────────────────────────────────────────────────────────────

export function ArcadeComplete() {
  const { score, gameTime, arcadeTotalOrbs, returnToMenu, lastResult } = useMagicOrb();
  const { stopMusic } = useAudio();
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCta(true), 2200);
    return () => clearTimeout(t);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTap = useCallback(() => {
    stopMusic();
    returnToMenu();
  }, [stopMusic, returnToMenu]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto cursor-pointer select-none"
      onClick={handleTap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Dark space background — matches main menu exactly */}
      <div className="absolute inset-0" style={{ background: "rgb(4, 4, 18)" }} />

      {/* Scanlines overlay — same as main menu */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        backgroundImage:
          "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,255,0.011) 3px,rgba(0,255,255,0.011) 4px)",
      }} />

      {/* Orbital orb field — same positions as StartupAnimation "done" phase */}
      {orbDefs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: orb.size, height: orb.size,
            left: "50%", top: "50%",
            marginLeft: -orb.size / 2, marginTop: -orb.size / 2,
            background: `radial-gradient(circle at 38% 32%, ${orb.color}ff, ${orb.color}88 45%, transparent 75%)`,
            filter: `blur(${orb.blur}px)`,
            boxShadow: `0 0 ${orb.size * 1.2}px ${orb.color}44`,
            zIndex: 2,
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{ x: orb.orbitX, y: orb.orbitY, scale: 0.8, opacity: 0.48 }}
          transition={{ duration: 1.1, delay: i * 0.03, ease: [0.34, 1.26, 0.64, 1] }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 text-center px-4 py-3 w-full max-w-lg mx-auto max-h-[calc(100dvh-16px)] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>

        {/* Title — ORBLITZ gradient + glow, identical animation */}
        <motion.div
          initial={{ scale: 0.65, opacity: 0, y: -16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", duration: 1.1, delay: 0.15 }}
        >
          <motion.h1
            className="font-black tracking-widest text-transparent bg-clip-text"
            style={{
              fontSize: "clamp(1.8rem, min(8vw, 7vh), 4rem)",
              lineHeight: 1.1,
              backgroundImage: "linear-gradient(135deg,#00ffff 0%,#aa00ff 45%,#ff00ff 75%,#ffff00 100%)",
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
            ARCADE<br />COMPLETE
          </motion.h1>

          {/* Underline — matches main menu title underline */}
          <motion.div className="mt-3 mx-auto" style={{
            height: 1,
            width: "clamp(160px, 36vw, 280px)",
            background: "linear-gradient(90deg,transparent,#00ffff 35%,#ff00ff 65%,transparent)",
          }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 0.65 }}
            transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
          />
        </motion.div>

        <motion.p
          className="font-bold uppercase mt-2 mb-3"
          style={{
            color: "rgba(0,255,255,0.6)",
            fontSize: "clamp(0.65rem, 1.8vw, 0.8rem)",
            letterSpacing: "0.24em",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          All 9 worlds conquered
        </motion.p>

        {/* Stats card — matches menu panel glassmorphism style */}
        <motion.div
          style={{
            background: "linear-gradient(160deg, rgba(0,255,255,0.055) 0%, rgba(170,0,255,0.035) 100%)",
            border: "1.5px solid rgba(0,255,255,0.16)",
            borderRadius: "clamp(12px, 2vw, 18px)",
            boxShadow: "0 0 32px rgba(0,255,255,0.07), inset 0 1px 0 rgba(0,255,255,0.06)",
            backdropFilter: "blur(12px)",
            padding: "clamp(12px, 2.5vh, 22px) clamp(18px, 4vw, 32px)",
          }}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <p
            className="font-black uppercase mb-3"
            style={{ color: "rgba(0,255,255,0.4)", fontSize: "0.65rem", letterSpacing: "0.28em" }}
          >
            Your Stats
          </p>

          <div className="space-y-2.5">
            {[
              { label: "Total Time",    value: formatTime(gameTime),             color: "#00ffff" },
              { label: "Final Score",   value: score.toLocaleString(),           color: "#ffff00" },
              { label: "Orbs Defeated", value: arcadeTotalOrbs.toLocaleString(), color: "#ff00ff" },
            ].map(({ label, value, color }, idx) => (
              <motion.div
                key={label}
                className="flex justify-between items-center"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1 + idx * 0.15 }}
              >
                <span style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "clamp(0.78rem, 2vw, 0.9rem)",
                }}>
                  {label}
                </span>
                <span style={{
                  color,
                  fontSize: "clamp(1.05rem, 3vw, 1.35rem)",
                  fontWeight: 900,
                  textShadow: `0 0 14px ${color}88`,
                }}>
                  {value}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <GradeResults result={lastResult} compact />

        {/* Tap CTA — identical style to main menu "Tap to Start" */}
        <motion.p
          className="mt-3 font-semibold uppercase"
          style={{
            color: "rgba(0,255,255,0.8)",
            textShadow: "0 0 18px rgba(0,255,255,0.45)",
            fontSize: "clamp(0.7rem, 1.8vw, 0.85rem)",
            letterSpacing: "0.22em",
          }}
          initial={{ opacity: 0 }}
          animate={showCta ? { opacity: [0, 0.85, 0.4, 0.85] } : { opacity: 0 }}
          transition={showCta
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }}
        >
          Tap anywhere to return to menu
        </motion.p>
      </div>
    </motion.div>
  );
}
