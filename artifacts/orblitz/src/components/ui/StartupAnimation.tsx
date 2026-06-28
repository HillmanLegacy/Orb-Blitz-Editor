import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";

type Phase = "idle" | "flying" | "converge" | "flash" | "title" | "waiting" | "done";

interface StartupAnimationProps {
  onComplete: () => void;
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
      return { x: orb.orbitX, y: orb.orbitY, scale: 0.8,  opacity: 0.6  };
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

export function StartupAnimation({ onComplete }: StartupAnimationProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const { playOrbWhoosh, playOrbConverge, playTitleReveal, startMenuMusic } = useAudio();

  useEffect(() => {
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
      setPhase("done");
      onComplete();
    }
  }, [phase, onComplete]);

  return (
    <>
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black cursor-pointer select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          onClick={handleTap}
          onTouchStart={handleTap}
        >
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
                boxShadow:   `0 0 ${orb.size * 1.2}px ${orb.color}66`,
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
                  width: 120,
                  height: 120,
                  left: "50%",
                  top: "50%",
                  marginLeft: -60,
                  marginTop: -60,
                  background: "radial-gradient(circle, #ffffff 0%, #00ffff 30%, #ff00ff 60%, transparent 80%)",
                  filter: "blur(18px)",
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

          {/* Soft halo ring behind title */}
          <AnimatePresence>
            {(phase === "title" || phase === "waiting") && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 580,
                  height: 200,
                  left: "50%",
                  top: "50%",
                  marginLeft: -290,
                  marginTop: -100,
                  background: "transparent",
                  boxShadow: "inset 0 0 0 1px rgba(0,255,255,0.07)",
                  filter: "blur(1px)",
                }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          {/* ORBLITZ title */}
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

                {/* Underline rule */}
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

          {/* Tap to start */}
          <AnimatePresence>
            {phase === "waiting" && (
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
        </motion.div>
    </>
  );
}
