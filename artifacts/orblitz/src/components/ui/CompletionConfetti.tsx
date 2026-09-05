import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

export type CompletionCelebrationVariant = "level" | "boss";

export const COMPLETION_CONFETTI_COUNTS = {
  level: 36,
  boss: 60,
} as const;

export const COMPLETION_CONFETTI_MAX_LIFETIME_SECONDS = 4;

interface CompletionConfettiPiece {
  color: string;
  left: string;
  width: number;
  height: number;
  drift: number;
  rotation: number;
  delay: number;
  duration: number;
  shape: "rect" | "circle";
}

const LEVEL_PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#00ff88", "#ffd166", "#ffffff"];
const BOSS_PALETTE = ["#fbbf24", "#ffe08a", "#f472b6", "#ff6b9d", "#a78bfa", "#ffffff"];

export function createCompletionConfettiPieces(
  variant: CompletionCelebrationVariant,
): CompletionConfettiPiece[] {
  const count = COMPLETION_CONFETTI_COUNTS[variant];
  const palette = variant === "boss" ? BOSS_PALETTE : LEVEL_PALETTE;

  return Array.from({ length: count }, (_, index) => ({
    color: palette[index % palette.length],
    left: `${(index * 37 + (variant === "boss" ? 3 : 11)) % 100}%`,
    width: 4 + ((index * 11) % 6),
    height: 7 + ((index * 13) % 10),
    drift: ((index * 31) % 180) - 90,
    rotation: ((index * 67) % 720) - 360,
    delay: 0.04 + ((index * 17) % 70) / 100,
    duration: 2.2 + ((index * 29) % 80) / 100,
    shape: index % 5 === 0 ? "circle" : "rect",
  }));
}

export function CompletionConfetti({ variant }: { variant: CompletionCelebrationVariant }) {
  const prefersReducedMotion = useReducedMotion();
  const pieces = useMemo(() => createCompletionConfettiPieces(variant), [variant]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-[1] overflow-hidden pointer-events-none"
    >
      {pieces.map((piece, index) => (
        <motion.div
          key={`${variant}-confetti-${index}`}
          className="absolute top-0"
          style={{
            left: piece.left,
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
            borderRadius: piece.shape === "circle" ? "999px" : "2px",
            boxShadow: `0 0 ${piece.width * 1.8}px ${piece.color}aa`,
            transformOrigin: "center",
          }}
          initial={prefersReducedMotion
            ? { opacity: 0.34, y: "12vh", rotate: piece.rotation * 0.08, scale: 0.9 }
            : { opacity: 0, y: "-8vh", rotate: 0, scale: 0.7 }}
          animate={prefersReducedMotion
            ? { opacity: 0.34, y: "18vh", rotate: piece.rotation * 0.08, scale: 1 }
            : {
                opacity: [0, 0.95, 0.9, 0],
                y: ["-8vh", "42vh", "108vh"],
                x: [0, piece.drift * 0.45, piece.drift],
                rotate: [0, piece.rotation * 0.55, piece.rotation],
                scale: [0.7, 1, 0.92],
              }}
          transition={prefersReducedMotion
            ? { duration: 0.01 }
            : {
                delay: piece.delay,
                duration: piece.duration,
                ease: "easeIn",
              }}
        />
      ))}
    </div>
  );
}