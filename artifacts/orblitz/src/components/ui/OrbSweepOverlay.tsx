import { useEffect, useMemo } from "react";
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
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

// ─── Build orb data for each mode ────────────────────────────────────────────
//  fast:    56 orbs, stagger 0–300 ms  → full screen covered ≈ 350–700 ms
//  loading: 72 orbs, stagger 0–1700 ms → covers the full 2 500 ms loading window

interface OrbDef {
  id:       number;
  size:     number;   // px diameter
  yTop:     number;   // top edge, px (may be negative for bleed)
  delay:    number;   // animation-delay, ms
  duration: number;   // transit duration, ms
  color:    string;
  blur:     number;   // px
  xStart:   number;   // initial translateX (off-left)
  xEnd:     number;   // final  translateX (off-right)
}

function buildOrbs(
  mode: "fast" | "loading",
  screenW: number,
  screenH: number,
): OrbDef[] {
  const ROWS = 8;
  const COUNT = mode === "fast" ? 56 : 72;
  const MAX_STAGGER = mode === "fast" ? 300 : 1700;
  const DUR_BASE    = mode === "fast" ? 780 : 980;
  const DUR_RANGE   = mode === "fast" ? 180 : 240;

  return Array.from({ length: COUNT }, (_, i) => {
    const r = (s: number) => seededRand(i * 17 + s * 3);

    // Row assignment – evenly distribute for coverage, then add jitter
    const row  = i % ROWS;
    const rowT = row / (ROWS - 1); // 0..1
    const size = 120 + r(1) * 160; // 120–280 px

    const baseY = rowT * (screenH + 240) - 120 - size / 2;
    const yTop  = baseY + (r(2) - 0.5) * 80; // ±40 px jitter

    // Stagger: evenly space within the window + small random jitter
    const evenDelay  = (i / COUNT) * MAX_STAGGER;
    const delay      = Math.max(0, evenDelay + (r(3) - 0.5) * 60);

    const duration = DUR_BASE + r(4) * DUR_RANGE;
    const blur     = 18 + r(5) * 32; // 18–50 px
    const color    = SWEEP_COLORS[Math.round(r(6) * (SWEEP_COLORS.length - 1))];

    // Orb positioned at left:0; margins account for blur (≤50 px) + glow halo (≤size×1.8)
    // overflow:hidden on the container clips any residual bleed, but travel range is generous
    const margin = Math.ceil(size * 2 + 60);
    const xStart = -(size + margin);
    const xEnd   =   screenW + margin;

    return { id: i, size, yTop, delay: delay, duration, color, blur, xStart, xEnd };
  });
}

// ─── Single animated orb ─────────────────────────────────────────────────────
function SweepOrb({ orb }: { orb: OrbDef }) {
  const glow = orb.size * 0.55;
  return (
    <motion.div
      initial={{ x: orb.xStart }}
      animate={{ x: orb.xEnd }}
      transition={{
        duration:  orb.duration / 1000,
        delay:     orb.delay    / 1000,
        ease:      "easeInOut",
      }}
      style={{
        position:      "absolute",
        top:           orb.yTop,
        left:          0,
        width:         orb.size,
        height:        orb.size,
        borderRadius:  "50%",
        pointerEvents: "none",
        background: `radial-gradient(circle at 38% 32%,
          ${orb.color}ff 0%,
          ${orb.color}cc 28%,
          ${orb.color}66 55%,
          ${orb.color}22 75%,
          transparent  88%)`,
        filter:    `blur(${orb.blur}px)`,
        boxShadow: `0 0 ${glow}px ${orb.color}88, 0 0 ${glow * 1.8}px ${orb.color}44`,
        willChange: "transform",
      }}
    />
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
export function OrbSweepOverlay() {
  const { isActive, sweepKey, mode } = useOrbTransition();

  // Compute orb layout once per sweep (sweepKey changes each time)
  const orbs = useMemo(() => {
    if (!isActive) return [];
    const w = typeof window !== "undefined" ? window.innerWidth  : 390;
    const h = typeof window !== "undefined" ? window.innerHeight : 844;
    return buildOrbs(mode, w, h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweepKey, isActive]); // re-build on every new sweep

  // Prevent scroll/interaction while sweeping
  useEffect(() => {
    if (!isActive) return;
    const prev = document.body.style.pointerEvents;
    // overlay itself is pointer-events: none, so we only need to block
    // nothing extra here – the overlay sits above everything at z-9999
    return () => { document.body.style.pointerEvents = prev; };
  }, [isActive]);

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
      {orbs.map((orb) => (
        <SweepOrb key={orb.id} orb={orb} />
      ))}
    </div>
  );
}
