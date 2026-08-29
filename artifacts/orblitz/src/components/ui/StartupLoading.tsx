import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";

interface Props {
  onComplete: () => void;
}

const LOAD_DURATION = 2600;

const ORB_COLORS = ["#00ffff", "#ff00ff", "#ffff00", "#aa00ff", "#00ff88", "#ff8800"];

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
      {/* Ambient drifting orbs — no per-element blur (avoids 18 separate compositor layers) */}
      {ambientOrbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: orb.size * 3,
            height: orb.size * 3,
            background: `radial-gradient(circle, ${orb.color}99 0%, ${orb.color}33 45%, transparent 75%)`,
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
          background: "radial-gradient(ellipse, rgba(0,255,255,0.07) 0%, rgba(170,0,255,0.05) 40%, transparent 70%)",
        }}
      />

      {/* ORBLITZ logo */}
      <motion.h1
        className="relative z-10 font-black tracking-widest text-transparent bg-clip-text select-none"
        style={{
          fontSize: "clamp(3.5rem, 12vw, 7rem)",
          backgroundImage: "linear-gradient(135deg, #00ffff 0%, #aa00ff 40%, #ff00ff 70%, #ffff00 100%)",
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
        style={{ width: "clamp(180px, 40vw, 320px)", height: 1, background: "linear-gradient(90deg, transparent, #00ffff 40%, #ff00ff 60%, transparent)" }}
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
              background: "linear-gradient(90deg, #00ffff, #aa00ff, #ff00ff)",
            }}
            transition={{ duration: 0.05 }}
          />
        </div>
      </motion.div>

      <motion.p
        className="relative z-10 mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.28em]"
        style={{ color: "rgba(190, 240, 255, 0.55)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
      >
        Tap or click to continue
      </motion.p>
    </motion.div>
  );
}
