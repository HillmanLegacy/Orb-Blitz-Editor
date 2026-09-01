import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";

interface Props {
  onComplete: () => void;
}

const LOAD_DURATION = 2600;

const ORB_COLORS = ["#5ad7ff", "#ff78c8", "#ffd166", "#a6a1ff", "#75e0a4", "#ff8f70"];

export function StartupLoading({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const doneRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientOrbs = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const r = 130 + (i % 3) * 55;
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r * 0.6,
      size: 7 + (i % 4) * 4,
      color: ORB_COLORS[i % ORB_COLORS.length],
      duration: 3.5 + (i % 5) * 0.7,
      delay: (i * 0.18) % 2.5,
    };
  }), []);

  const complete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    setFadingOut(true);
    completionTimeoutRef.current = setTimeout(onComplete, 350);
  };

  const tryStartAudio = () => {
    if (!audioUnlocked) setAudioUnlocked(true);
    complete();
  };

  useEffect(() => {
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(1, elapsed / LOAD_DURATION);
      setProgress(p);
      if (p >= 1 && !doneRef.current) {
        complete();
      }
    }, 40);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      if (completionTimeoutRef.current !== null) clearTimeout(completionTimeoutRef.current);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black cursor-pointer select-none overflow-hidden"
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: 0.85, ease: "easeInOut" }}
      onClick={tryStartAudio}
      onTouchStart={tryStartAudio}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{
        background: "radial-gradient(ellipse at 50% 42%, rgba(35,51,107,0.92) 0%, rgba(13,24,61,0.82) 37%, rgba(5,10,31,0.98) 83%), linear-gradient(135deg, #091737, #28144b 52%, #071d32)",
      }}>
        <div className="absolute inset-0" style={{
          opacity: 0.22,
          backgroundImage: "linear-gradient(rgba(118,216,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(118,216,255,0.28) 1px, transparent 1px)",
          backgroundSize: "clamp(26px, 3.7vw, 54px) clamp(26px, 3.7vw, 54px)",
          maskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 48%, black 0%, transparent 76%)",
        }} />
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
        <motion.div className="absolute rounded-full" style={{
          width: "min(62vw, 700px)", height: "min(42vw, 460px)", left: "5%", top: "7%",
          background: "radial-gradient(ellipse, rgba(116,108,255,0.32), transparent 70%)", filter: "blur(14px)",
        }} animate={{ x: ["-4%", "8%", "-4%"], y: ["2%", "-5%", "2%"] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute rounded-full" style={{
          width: "min(54vw, 620px)", height: "min(45vw, 500px)", right: "-8%", bottom: "3%",
          background: "radial-gradient(ellipse, rgba(255,125,170,0.24), transparent 72%)", filter: "blur(14px)",
        }} animate={{ x: ["3%", "-7%", "3%"], y: ["-4%", "5%", "-4%"] }} transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <div className="absolute left-6 top-5 z-10 pointer-events-none" style={{
        color: "rgba(220,244,255,0.82)", fontSize: "clamp(0.48rem, 1vw, 0.64rem)",
        fontWeight: 900, letterSpacing: "0.14em", lineHeight: 1.7, fontFamily: "Arial Black, Impact, sans-serif",
      }}>
        <div>ORBLITZ ARCADE</div>
        <div style={{ color: "rgba(255,209,102,0.88)", letterSpacing: "0.1em" }}>Stack · play · repeat</div>
      </div>
      <div className="absolute right-6 top-5 z-10 pointer-events-none text-right" style={{
        color: "rgba(220,244,255,0.7)", fontSize: "clamp(0.48rem, 1vw, 0.64rem)",
        fontWeight: 900, letterSpacing: "0.12em", lineHeight: 1.7, fontFamily: "Arial Black, Impact, sans-serif",
      }}>
        <div>9 WORLDS · 81 LEVELS</div>
        <div style={{ color: "rgba(255,120,200,0.84)", letterSpacing: "0.09em" }}>Ready when you are</div>
      </div>

      {/* Ambient drifting orbs — no per-element blur (avoids 18 separate compositor layers) */}
      {ambientOrbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-sm pointer-events-none"
          style={{
            width: orb.size * 3,
            height: orb.size * 3,
            background: `linear-gradient(145deg, rgba(255,255,255,0.7), ${orb.color} 32%, ${orb.color}55)`,
            border: "1px solid rgba(255,255,255,0.25)",
            boxShadow: `0 0 18px ${orb.color}55`,
            left: "50%",
            top: "50%",
            marginLeft: -(orb.size * 3) / 2,
            marginTop: -(orb.size * 3) / 2,
            willChange: "transform, opacity",
          }}
          animate={{
            x: [orb.x * 0.88, orb.x * 1.06, orb.x * 0.92, orb.x * 0.88],
            y: [orb.y * 0.88, orb.y * 1.06, orb.y * 0.92, orb.y * 0.88],
            opacity: [0.22, 0.55, 0.28, 0.22],
          }}
          transition={{ duration: orb.duration, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Subtle radial glow behind logo — pure CSS gradient, no blur filter */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 560,
          height: 260,
          background: "radial-gradient(ellipse, rgba(90,215,255,0.12) 0%, rgba(255,120,200,0.08) 40%, transparent 70%)",
        }}
      />

      {/* ORBLITZ logo */}
      <motion.h1
        className="relative z-10 font-black tracking-widest text-transparent bg-clip-text select-none"
        style={{
          fontSize: "clamp(3.5rem, 12vw, 7rem)",
          fontFamily: "Arial Black, Impact, sans-serif",
          fontWeight: 900,
          fontStyle: "normal",
          letterSpacing: "0.075em",
          WebkitTextStroke: "2px rgba(224,249,255,0.16)",
          textShadow: "5px 5px 0 rgba(10,20,68,0.6), 0 0 28px rgba(90,215,255,0.28)",
          backgroundImage: "linear-gradient(135deg,#5ad7ff 0%,#5ad7ff 16%,#ff78c8 16%,#ff78c8 32%,#ffd166 32%,#ffd166 48%,#75e0a4 48%,#75e0a4 64%,#a6a1ff 64%,#a6a1ff 82%,#ff8f70 82%,#ff8f70 100%)",
        }}
        initial={{ opacity: 0, scale: 0.82, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
      >
        ORBLITZ
      </motion.h1>

      {/* Glow line under title */}
      <motion.div
        className="relative z-10 mt-3"
        style={{ width: "clamp(180px, 40vw, 320px)", height: "clamp(5px, 0.8vw, 8px)", borderRadius: 3, background: "linear-gradient(90deg,transparent 0%,#5ad7ff 18%,#ff78c8 18%,#ff78c8 36%,#ffd166 36%,#ffd166 54%,#75e0a4 54%,#75e0a4 72%,#a6a1ff 72%,#a6a1ff 88%,transparent 88%)", boxShadow: "0 4px 0 rgba(10,20,68,0.45), 0 0 16px rgba(90,215,255,0.4)" }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 0.7 }}
        transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
      />

      {/* Progress bar */}
      <motion.div
        className="relative z-10 mt-14"
        style={{ width: "clamp(200px, 45vw, 320px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #5ad7ff, #ff78c8, #ffd166, #75e0a4)",
            }}
            transition={{ duration: 0.05 }}
          />
        </div>
      </motion.div>

      <motion.p
        className="relative z-10 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.2em]"
        style={{ color: "rgba(220, 244, 255, 0.78)", fontFamily: "Arial Black, Impact, sans-serif", textShadow: "2px 2px 0 rgba(10,20,68,0.52)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
      >
        Tap or click to play
      </motion.p>
    </motion.div>
  );
}
