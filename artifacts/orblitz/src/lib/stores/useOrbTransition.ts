import { create } from "zustand";

// ─── Orb sweep transition store ───────────────────────────────────────────────
// Two modes:
//   "fast"    – pause / resume  (≈1 s total, midpoint fires at 480 ms)
//   "loading" – loading screen transitions (≈2.7 s, covers full loading window)

type SweepMode = "fast" | "loading";

interface OrbTransitionState {
  isActive:   boolean;
  sweepKey:   number;       // incremented per trigger → forces overlay remount
  mode:       SweepMode;
  onMidpoint: (() => void) | null;

  /** Fast sweep – pause / resume. onMidpoint fires at the covered midpoint. */
  fastSweep: (onMidpoint: () => void) => void;

  /** Loading sweep – covers the full 2 500 ms loading window. */
  loadingSweep: () => void;

  /** Called by the overlay when the animation is finished. */
  _done: () => void;
}

export const useOrbTransition = create<OrbTransitionState>((set, get) => ({
  isActive:   false,
  sweepKey:   0,
  mode:       "fast",
  onMidpoint: null,

  fastSweep: (onMidpoint) => {
    if (get().isActive) return;
    set((s) => ({ isActive: true, sweepKey: s.sweepKey + 1, mode: "fast", onMidpoint }));
    setTimeout(() => { get().onMidpoint?.(); }, 480);
    // worst-case: max stagger (330 ms) + max duration (960 ms) = 1290 ms → pad to 1420 ms
    setTimeout(() => { get()._done(); }, 1420);
  },

  loadingSweep: () => {
    if (get().isActive) return;
    set((s) => ({ isActive: true, sweepKey: s.sweepKey + 1, mode: "loading", onMidpoint: null }));
    // worst-case: max stagger (1730 ms) + max duration (1220 ms) = 2950 ms → pad to 3100 ms
    setTimeout(() => { get()._done(); }, 3100);
  },

  _done: () => set({ isActive: false, onMidpoint: null }),
}));
