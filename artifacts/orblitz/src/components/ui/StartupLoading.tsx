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
  const { startMenuMusic } = useAudio();

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

  const tryStartAudio = () => {
    if (!audioUnlocked) {
      setAudioUnlocked(true);
      try { startMenuMusic(); } catch {}
    }
  };

  useEffect(() => {
    const startTime = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(1, elapsed / LOAD_DURATION);
      setProgress(p);
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(tick);
        setFadingOut(true);
        setTimeout(() => onComplete(), 850);
      }
    }, 40);
    return () => clearInterval(tick);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black cursor-pointer select-none overflow-hidden"
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: 0.85, ease: "easeInOut" }}
      onClick={tryStartAudio}
      onTouchStart={tryStartAudio}
    >
      {/* Ambient drifting orbs */}
      {ambientOrbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            filter: "blur(5px)",
            left: "50%",
            top: "50%",
            marginLeft: -orb.size / 2,
            marginTop: -orb.size / 2,
          }}
          animate={{
            x: [orb.x * 0.88, orb.x * 1.06, orb.x * 0.92, orb.x * 0.88],
            y: [orb.y * 0.88, orb.y * 1.06, orb.y * 0.92, orb.y * 0.88],
            opacity: [0.25, 0.6, 0.3, 0.25],
          }}
          transition={{ duration: orb.duration, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Subtle radial glow behind logo */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 420,
          height: 200,
          background: "radial-gradient(ellipse, rgba(0,255,255,0.04) 0%, rgba(170,0,255,0.03) 50%, transparent 70%)",
          filter: "blur(30px)",
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
        <motion.p
          className="text-center mt-3 text-xs tracking-[0.2em] uppercase"
          style={{ color: "rgba(255,255,255,0.22)" }}
          animate={{ opacity: [0.22, 0.45, 0.22] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {audioUnlocked ? "Loading…" : "Tap to enable audio"}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
