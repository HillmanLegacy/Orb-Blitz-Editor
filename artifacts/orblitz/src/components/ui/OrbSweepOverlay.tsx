import { useMemo } from "react";
import { motion } from "framer-motion";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";

// ─── Colour palette – matches the tap-to-start screen orbs ───────────────────
const SWEEP_COLORS = [
  "#00ffff", // cyan
  "#aa00ff", // violet
  "#ff00ff", // magenta
  "#ffff00", // yellow
  "#00ff88", // green
  "#ff8800", // orange
  "#ffffff", // white
  "#00aaff", // blue
  "#ff4488", // pink
  "#ff2244", // red
  "#ffaa00", // gold
];

// ─── Deterministic seeded pseudo-random (no Math.random in render) ────────────
function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

// ─── Orb data ─────────────────────────────────────────────────────────────────
interface OrbDef {
  id:       number;
  size:     number;
  yTop:     number;
  delay:    number;
  duration: number;
  color:    string;
  blur:     number;
  xStart:   number;
  xEnd:     number;
}

// fast:    64 orbs, stagger 0–320 ms
// loading: 80 orbs, stagger 0–1720 ms
function buildOrbs(mode: "fast" | "loading", W: number, H: number): OrbDef[] {
  const ROWS        = 8;
  const COUNT       = mode === "fast" ? 64 : 80;
  const MAX_STAGGER = mode === "fast" ? 320  : 1720;
  const DUR_BASE    = mode === "fast" ? 800  : 1000;
  const DUR_RANGE   = mode === "fast" ? 160  : 220;

  return Array.from({ length: COUNT }, (_, i) => {
    const r = (s: number) => sr(i * 19 + s * 7);

    const row   = i % ROWS;
    const rowT  = row / (ROWS - 1);
    const size  = 140 + r(1) * 160;                             // 140–300 px

    const baseY = rowT * (H + 280) - 140 - size / 2;
    const yTop  = baseY + (r(2) - 0.5) * 70;

    const evenDelay = (i / COUNT) * MAX_STAGGER;
    const delay     = Math.max(0, evenDelay + (r(3) - 0.5) * 50);
    const duration  = DUR_BASE + r(4) * DUR_RANGE;
    const blur      = 14 + r(5) * 28;                           // 14–42 px
    const color     = SWEEP_COLORS[Math.round(r(6) * (SWEEP_COLORS.length - 1))];

    // Travel well past viewport edges; blur/glow clipped by container overflow:hidden
    const margin = Math.ceil(size * 2.2 + 80);
    const xStart = -(size + margin);
    const xEnd   =   W + margin;

    return { id: i, size, yTop, delay, duration, color, blur, xStart, xEnd };
  });
}

// ─── Per-orb ──────────────────────────────────────────────────────────────────
function SweepOrb({ orb }: { orb: OrbDef }) {
  const glow = orb.size * 0.5;
  return (
    <motion.div
      initial={{ x: orb.xStart }}
      animate={{ x: orb.xEnd }}
      transition={{ duration: orb.duration / 1000, delay: orb.delay / 1000, ease: "easeInOut" }}
      style={{
        position:     "absolute",
        top:          orb.yTop,
        left:         0,
        width:        orb.size,
        height:       orb.size,
        borderRadius: "50%",
        // Larger solid core so overlapping orbs form an opaque mass
        background: `radial-gradient(circle at 38% 32%,
          ${orb.color}ff  0%,
          ${orb.color}ff 22%,
          ${orb.color}dd 42%,
          ${orb.color}99 60%,
          ${orb.color}44 76%,
          transparent    90%)`,
        filter:        `blur(${orb.blur}px)`,
        boxShadow:     `0 0 ${glow}px ${orb.color}99, 0 0 ${glow * 1.6}px ${orb.color}55`,
        willChange:    "transform",
      }}
    />
  );
}

// ─── Solid backdrop – the guarantee of 100 % opacity behind the orb wave ──────
// Fades in quickly as the first orbs enter, holds opaque while screens swap,
// then fades out as the last orbs exit.
function Backdrop({ mode }: { mode: "fast" | "loading" }) {
  // Keyframe opacity schedule as fractions of total animation duration
  // fast (1.42 s):    fade-in 0→280 ms, hold until 870 ms, fade-out by 1180 ms
  // loading (3.10 s): fade-in 0→480 ms, hold until 2350 ms, fade-out by 2980 ms
  // fast (1.42 s):    fade-in by 280 ms, hold until 870 ms, out by 1 180 ms
  // loading (3.10 s): fade-in by 465 ms, hold until 2 604 ms (past the 2 500 ms
  //                   finishLoading call), then fade-out by 3 007 ms
  const [times, totalSec] =
    mode === "fast"
      ? ([[0, 0.20, 0.61, 0.83, 1.0] as number[], 1.42])
      : ([[0, 0.15, 0.84, 0.97, 1.0] as number[], 3.10]);

  return (
    <motion.div
      style={{
        position:      "absolute",
        inset:          0,
        background:    "black",
        pointerEvents: "none",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0, 0] }}
      transition={{ duration: totalSec, times, ease: "easeInOut" }}
    />
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
export function OrbSweepOverlay() {
  const { isActive, sweepKey, mode } = useOrbTransition();

  const orbs = useMemo(() => {
    if (!isActive) return [];
    const W = typeof window !== "undefined" ? window.innerWidth  : 390;
    const H = typeof window !== "undefined" ? window.innerHeight : 844;
    return buildOrbs(mode, W, H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweepKey, isActive]);

  if (!isActive) return null;

  return (
    <div
      key={sweepKey}
      style={{
        position:      "fixed",
        inset:          0,
        zIndex:         9999,
        pointerEvents: "none",
        overflow:      "hidden",
      }}
    >
      {/* Solid black fill – guarantees zero bleed-through when screen swaps */}
      <Backdrop mode={mode} />

      {/* Colourful orb wave on top of the backdrop */}
      {orbs.map((orb) => <SweepOrb key={orb.id} orb={orb} />)}
    </div>
  );
}
