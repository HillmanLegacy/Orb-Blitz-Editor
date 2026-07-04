/**
 * OrbSweepOverlay — canvas-based screen-wipe transition.
 *
 * Replaces the previous 64–80 framer-motion divs (each with filter:blur,
 * box-shadow, and radial-gradient) with a single <canvas> element driven by
 * requestAnimationFrame.
 *
 * Mobile perf gains vs the old DOM approach:
 *  • 1 compositor layer instead of 80+  (no per-element will-change/blur)
 *  • Zero CSS filter passes             (canvas radialGradient is free)
 *  • No framer-motion JS per element    (pure RAF loop)
 *  • No React re-renders during motion  (canvas is mutated imperatively)
 */

import { useRef, useEffect } from "react";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";

// ─── Palette ──────────────────────────────────────────────────────────────────
const SWEEP_COLORS = [
  "#00ffff", "#aa00ff", "#ff00ff", "#ffff00",
  "#00ff88", "#ff8800", "#ffffff", "#00aaff",
  "#ff4488", "#ff2244", "#ffaa00",
];

// ─── Deterministic seeded pseudo-random ───────────────────────────────────────
function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Orb definition (computed once at sweep start) ────────────────────────────
interface OrbDef {
  size:     number;
  yCenter:  number;
  delay:    number;   // seconds
  duration: number;   // seconds
  color:    string;   // hex
  xStart:   number;
  xEnd:     number;
}

function buildOrbs(mode: "fast" | "loading", W: number, H: number): OrbDef[] {
  const ROWS        = 8;
  const COUNT       = mode === "fast" ? 40 : 52;
  const MAX_STAGGER = mode === "fast" ? 0.32 : 1.72;   // seconds
  const DUR_BASE    = mode === "fast" ? 0.80 : 1.00;   // seconds
  const DUR_RANGE   = mode === "fast" ? 0.16 : 0.22;

  return Array.from({ length: COUNT }, (_, i) => {
    const r      = (s: number) => sr(i * 19 + s * 7);
    const row    = i % ROWS;
    const rowT   = row / (ROWS - 1);
    const size   = 140 + r(1) * 160;                  // 140–300 px

    const baseY  = rowT * (H + 280) - 140 - size / 2;
    const yCenter = baseY + (r(2) - 0.5) * 70 + size / 2;

    const delay    = Math.max(0, (i / COUNT) * MAX_STAGGER + (r(3) - 0.5) * 0.05);
    const duration = DUR_BASE + r(4) * DUR_RANGE;
    const color    = SWEEP_COLORS[Math.round(r(6) * (SWEEP_COLORS.length - 1))];

    const margin = size * 2.2 + 80;
    const xStart = -(size + margin);
    const xEnd   =   W + margin;

    return { size, yCenter, delay, duration, color, xStart, xEnd };
  });
}

// ─── Backdrop keyframe schedule ───────────────────────────────────────────────
// Returns 0-1 opacity for a given progress fraction through the total animation.
function backdropOpacity(progress: number, mode: "fast" | "loading"): number {
  // fast:    times [0, 0.20, 0.61, 0.83, 1.0]  → opacity [0, 1, 1, 0, 0]
  // loading: times [0, 0.15, 0.84, 0.97, 1.0]  → opacity [0, 1, 1, 0, 0]
  const times = mode === "fast"
    ? [0, 0.20, 0.61, 0.83, 1.0]
    : [0, 0.15, 0.84, 0.97, 1.0];
  const opacities = [0, 1, 1, 0, 0];

  for (let k = 0; k < times.length - 1; k++) {
    if (progress <= times[k + 1]) {
      const local = (progress - times[k]) / (times[k + 1] - times[k]);
      return opacities[k] + (opacities[k + 1] - opacities[k]) * local;
    }
  }
  return 0;
}

// ─── Parse hex → {r,g,b} once (used in radialGradient stops) ─────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────
function drawFrame(
  ctx:      CanvasRenderingContext2D,
  W:        number,
  H:        number,
  orbs:     OrbDef[],
  elapsed:  number,    // seconds since sweep started
  totalSec: number,
  mode:     "fast" | "loading",
): void {
  ctx.clearRect(0, 0, W, H);

  // ── Backdrop ────────────────────────────────────────────────────────────────
  const progress = Math.min(1, elapsed / totalSec);
  const bOpacity = backdropOpacity(progress, mode);
  if (bOpacity > 0) {
    ctx.fillStyle = `rgba(0,0,0,${bOpacity})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Orbs ────────────────────────────────────────────────────────────────────
  ctx.globalCompositeOperation = "lighter"; // additive blend — glowing accumulation
  for (const orb of orbs) {
    const orbElapsed = elapsed - orb.delay;
    if (orbElapsed < 0 || orbElapsed > orb.duration) continue;

    const t  = easeInOut(Math.min(1, orbElapsed / orb.duration));
    const cx = orb.xStart + (orb.xEnd - orb.xStart) * t;
    const cy = orb.yCenter;
    const r  = orb.size / 2;

    const { r: rr, g, b } = hexToRgb(orb.color);
    const grad = ctx.createRadialGradient(
      cx - r * 0.24, cy - r * 0.32, 0,   // offset highlight center
      cx,            cy,            r,
    );
    grad.addColorStop(0.00, `rgba(${rr},${g},${b},0.90)`);
    grad.addColorStop(0.22, `rgba(${rr},${g},${b},0.90)`);
    grad.addColorStop(0.42, `rgba(${rr},${g},${b},0.65)`);
    grad.addColorStop(0.60, `rgba(${rr},${g},${b},0.35)`);
    grad.addColorStop(0.76, `rgba(${rr},${g},${b},0.10)`);
    grad.addColorStop(1.00, `rgba(${rr},${g},${b},0.00)`);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function OrbSweepOverlay() {
  const { isActive, sweepKey, mode } = useOrbTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const orbs     = buildOrbs(mode, W, H);
    const totalSec = mode === "fast" ? 1.42 : 3.10;
    const start    = performance.now();

    function loop() {
      const elapsed = (performance.now() - start) / 1000;
      drawFrame(ctx!, W, H, orbs, elapsed, totalSec, mode);
      if (elapsed < totalSec) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        ctx!.clearRect(0, 0, W, H);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);

  // sweepKey changes every time a new sweep is triggered — that's our re-run signal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sweepKey]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        inset:          0,
        width:          "100%",
        height:         "100%",
        zIndex:         9999,
        pointerEvents: "none",
        // Single compositor layer — no filter, no will-change proliferation
      }}
    />
  );
}
