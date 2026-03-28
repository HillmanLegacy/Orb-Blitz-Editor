import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/lib/stores/useAudio";

interface StartupAnimationProps {
  onComplete: () => void;
}

export function StartupAnimation({ onComplete }: StartupAnimationProps) {
  const [phase, setPhase] = useState<"intro" | "orbs" | "title" | "waiting" | "transitioning" | "done">("intro");
  const { playIntro } = useAudio();

  const handleTapToStart = useCallback(() => {
    if (phase === "waiting") {
      playIntro();
      setPhase("done");
      onComplete();
    }
  }, [phase, onComplete, playIntro]);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase("orbs"), 800);
    const timer2 = setTimeout(() => setPhase("title"), 2000);
    const timer3 = setTimeout(() => setPhase("waiting"), 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden cursor-pointer"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0 }}
          onClick={handleTapToStart}
          onTouchStart={handleTapToStart}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ background: "linear-gradient(135deg, #000000 0%, #1a0033 50%, #000000 100%)" }}
            animate={{
              background: phase === "title" || phase === "waiting" || phase === "transitioning"
                ? "linear-gradient(135deg, #1a0044 0%, #330066 50%, #1a0044 100%)"
                : "linear-gradient(135deg, #000000 0%, #1a0033 50%, #000000 100%)",
            }}
            transition={{ duration: 1 }}
          />

          {(phase === "orbs" || phase === "title") && (
            <>
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 20 + Math.random() * 40,
                    height: 20 + Math.random() * 40,
                    background: `radial-gradient(circle, ${
                      i % 3 === 0 ? "#00ffff" : i % 3 === 1 ? "#ff00ff" : "#ffff00"
                    }, transparent)`,
                  }}
                  initial={{
                    x: (Math.random() - 0.5) * window.innerWidth * 2,
                    y: (Math.random() - 0.5) * window.innerHeight * 2,
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    x: 0,
                    y: 0,
                    opacity: [0, 0.8, 0],
                    scale: [0, 1.5, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.08,
                    ease: "easeOut",
                  }}
                />
              ))}
            </>
          )}

          <motion.div
            className="absolute w-40 h-40 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(0,255,255,0.6) 30%, rgba(255,0,255,0.3) 60%, transparent 80%)",
              filter: "blur(2px)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={
              phase === "intro"
                ? { scale: 0, opacity: 0 }
                : phase === "orbs"
                ? { scale: [0, 1.5, 1], opacity: [0, 1, 1] }
                : { scale: [1, 1.2, 0], opacity: [1, 1, 0] }
            }
            transition={{ duration: phase === "orbs" ? 1 : 0.8, ease: "easeOut" }}
          />

          {(phase === "orbs" || phase === "title") && (
            <motion.div
              className="absolute w-60 h-60 rounded-full"
              style={{
                background: "radial-gradient(circle, transparent 30%, rgba(0,255,255,0.2) 50%, transparent 70%)",
              }}
              initial={{ scale: 0, opacity: 0, rotate: 0 }}
              animate={{
                scale: phase === "orbs" ? [0, 2, 2.5] : [2.5, 3, 0],
                opacity: phase === "orbs" ? [0, 0.6, 0.4] : [0.4, 0.2, 0],
                rotate: 180,
              }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          )}

          {(phase === "title" || phase === "waiting" || phase === "transitioning") && (
            <motion.div
              className="relative z-10 text-center"
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ 
                opacity: phase === "transitioning" ? 1 : 1, 
                scale: phase === "transitioning" ? 0.7 : 1, 
                y: phase === "transitioning" ? -180 : 0 
              }}
              transition={{ duration: phase === "transitioning" ? 0.6 : 0.8, ease: "easeOut" }}
            >
              <motion.h1
                className="text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"
                animate={{
                  textShadow: [
                    "0 0 20px #00ffff, 0 0 40px #00ffff",
                    "0 0 40px #ff00ff, 0 0 80px #ff00ff",
                    "0 0 20px #00ffff, 0 0 40px #00ffff",
                  ],
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ORBLITZ
              </motion.h1>

              <motion.div
                className="mt-4 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              />

              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: i % 2 === 0 ? "#00ffff" : "#ff00ff",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: Math.cos((i / 8) * Math.PI * 2) * 150,
                    y: Math.sin((i / 8) * Math.PI * 2) * 80,
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.5 + i * 0.1,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          )}

          {phase === "intro" && (
            <motion.div
              className="absolute w-4 h-4 rounded-full bg-white"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 3, 1], opacity: [0, 1, 0.8] }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}

          {(phase === "waiting" || phase === "transitioning") && (
            <motion.div
              className="absolute bottom-20 text-center"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: phase === "transitioning" ? 0 : [0.5, 1, 0.5],
                y: phase === "transitioning" ? 50 : 0
              }}
              transition={{ duration: phase === "transitioning" ? 0.4 : 1.5, repeat: phase === "transitioning" ? 0 : Infinity }}
            >
              <p className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400">
                Tap To Start
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
