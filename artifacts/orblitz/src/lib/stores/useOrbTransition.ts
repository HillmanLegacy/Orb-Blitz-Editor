import { create } from "zustand";

// ─── Orb sweep transition store ───────────────────────────────────────────────
//
// Three modes
// ──────────
// "fast"    – pause / resume (≈1.4 s). Midpoint at 480 ms.
// "loading" – any loading transition (≈3.1 s). Midpoint at 550 ms — this is
//             when the screen is fully obscured and the state-change callback
//             (startLoading / etc.) fires.
//
// pauseSweep() is a special variant of "fast" that also manages pauseMenuVisible:
// the PauseMenu is suppressed during sweep-in so the frozen game frame is visible,
// then shown at the midpoint (while still hidden behind the backdrop) ready to
// be revealed as orbs exit.

type SweepMode = "fast" | "loading";

interface OrbTransitionState {
  isActive:         boolean;
  sweepKey:         number;
  mode:             SweepMode;
  isMidpointPassed: boolean;
  /** Controls PauseMenu render gate. False during pause sweep-in, true otherwise. */
  pauseMenuVisible: boolean;

  /** General fast sweep (resume, etc.). onMidpoint fires at 480 ms. */
  fastSweep: (onMidpoint: () => void) => void;

  /** Pause-specific fast sweep. Hides PauseMenu during sweep-in; reveals at midpoint. */
  pauseSweep: () => void;

  /** Loading sweep. Optional onMidpoint fires at 550 ms (backdrop fully opaque). */
  loadingSweep: (onMidpoint?: () => void) => void;

  _done: () => void;
}

export const useOrbTransition = create<OrbTransitionState>((set, get) => ({
  isActive:         false,
  sweepKey:         0,
  mode:             "fast",
  isMidpointPassed: false,
  pauseMenuVisible: true,

  fastSweep: (onMidpoint) => {
    if (get().isActive) return;
    set((s) => ({
      isActive: true, sweepKey: s.sweepKey + 1,
      mode: "fast", isMidpointPassed: false, pauseMenuVisible: true,
    }));
    // 480 ms: backdrop fully opaque; fire the state-change callback
    window.setTimeout(() => {
      onMidpoint();
      set({ isMidpointPassed: true });
    }, 480);
    // worst-case last orb: max stagger (330 ms) + max duration (960 ms) = 1 290 ms → pad
    window.setTimeout(() => get()._done(), 1420);
  },

  pauseSweep: () => {
    if (get().isActive) return;
    set((s) => ({
      isActive: true, sweepKey: s.sweepKey + 1,
      mode: "fast", isMidpointPassed: false,
      // Hide PauseMenu immediately so frozen game is the visible frame during sweep-in
      pauseMenuVisible: false,
    }));
    window.setTimeout(() => {
      // Reveal PauseMenu while still hidden under the opaque backdrop
      set({ isMidpointPassed: true, pauseMenuVisible: true });
    }, 480);
    window.setTimeout(() => get()._done(), 1420);
  },

  loadingSweep: (onMidpoint) => {
    if (get().isActive) return;
    set((s) => ({
      isActive: true, sweepKey: s.sweepKey + 1,
      mode: "loading", isMidpointPassed: false, pauseMenuVisible: true,
    }));
    // 550 ms: backdrop fully opaque (0.15 × 3 100 ms = 465 ms) + 85 ms buffer
    window.setTimeout(() => {
      onMidpoint?.();
      set({ isMidpointPassed: true });
    }, 550);
    // worst-case: max stagger (1 730 ms) + max duration (1 220 ms) = 2 950 ms → pad
    window.setTimeout(() => get()._done(), 3200);
  },

  _done: () => set({ isActive: false, isMidpointPassed: false, pauseMenuVisible: true }),
}));
