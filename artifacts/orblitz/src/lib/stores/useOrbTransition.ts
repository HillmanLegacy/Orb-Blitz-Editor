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
type LoadingStage = "idle" | "code" | "models" | "renderer" | "ready" | "fallback";

let transitionTimers: number[] = [];
let transitionRun = 0;
let loadingSweepStartedAt = 0;
let gameplayRevealTimer: number | null = null;

function clearTransitionTimers() {
  transitionTimers.forEach((timer) => window.clearTimeout(timer));
  transitionTimers = [];
}

function clearGameplayReveal() {
  if (gameplayRevealTimer !== null) {
    window.clearTimeout(gameplayRevealTimer);
    gameplayRevealTimer = null;
  }
}

function scheduleTransition(run: number, delay: number, callback: () => void) {
  const timer = window.setTimeout(() => {
    transitionTimers = transitionTimers.filter((id) => id !== timer);
    if (run === transitionRun) callback();
  }, delay);
  transitionTimers.push(timer);
}

interface OrbTransitionState {
  isActive:         boolean;
  sweepKey:         number;
  mode:             SweepMode;
  isMidpointPassed: boolean;
  /** Controls PauseMenu render gate. False during pause sweep-in, true otherwise. */
  pauseMenuVisible: boolean;
  loadingReady: boolean;
  loadingCompleted: number;
  loadingTotal: number;
  loadingLabel: string;
  loadingStage: LoadingStage;
  /** Opaque curtain that remains above the first gameplay frame while it fades in. */
  loadingReveal: boolean;
  loadingRevealFading: boolean;

  /** General fast sweep (resume, etc.). onMidpoint fires at 480 ms. */
  fastSweep: (onMidpoint: () => void) => void;

  /** Pause-specific fast sweep. Hides PauseMenu during sweep-in; reveals at midpoint. */
  pauseSweep: () => void;

  /** Loading sweep. Optional onMidpoint fires at 550 ms (backdrop fully opaque). */
  loadingSweep: (onMidpoint?: () => void) => void;
  setLoadingProgress: (progress: {
    completed: number;
    total: number;
    label: string;
    stage: Exclude<LoadingStage, "idle">;
  }) => void;
  completeLoadingSweep: (revealGameplay?: boolean) => void;

  _done: () => void;
}

export const useOrbTransition = create<OrbTransitionState>((set, get) => ({
  isActive:         false,
  sweepKey:         0,
  mode:             "fast",
  isMidpointPassed: false,
  pauseMenuVisible: true,
  loadingReady: true,
  loadingCompleted: 0,
  loadingTotal: 0,
  loadingLabel: "",
  loadingStage: "idle",
  loadingReveal: false,
  loadingRevealFading: false,

  fastSweep: (onMidpoint) => {
    if (get().isActive) return;
    clearTransitionTimers();
    clearGameplayReveal();
    set({ loadingReveal: false, loadingRevealFading: false });
    const run = ++transitionRun;
    set((s) => ({
      isActive: true, sweepKey: s.sweepKey + 1,
      mode: "fast", isMidpointPassed: false, pauseMenuVisible: true,
    }));
    // 480 ms: backdrop fully opaque; fire the state-change callback
    scheduleTransition(run, 480, () => {
      onMidpoint();
      if (run === transitionRun) set({ isMidpointPassed: true });
    });
    // worst-case last orb: max stagger (330 ms) + max duration (960 ms) = 1 290 ms → pad
    scheduleTransition(run, 1420, () => get()._done());
  },

  pauseSweep: () => {
    if (get().isActive) return;
    clearTransitionTimers();
    clearGameplayReveal();
    set({ loadingReveal: false, loadingRevealFading: false });
    const run = ++transitionRun;
    set((s) => ({
      isActive: true, sweepKey: s.sweepKey + 1,
      mode: "fast", isMidpointPassed: false,
      // Hide PauseMenu immediately so frozen game is the visible frame during sweep-in
      pauseMenuVisible: false,
    }));
    scheduleTransition(run, 480, () => {
      // Reveal PauseMenu while still hidden under the opaque backdrop
      set({ isMidpointPassed: true, pauseMenuVisible: true });
    });
    scheduleTransition(run, 1420, () => get()._done());
  },

  loadingSweep: (onMidpoint) => {
    if (get().isActive) return;
    clearTransitionTimers();
    clearGameplayReveal();
    const run = ++transitionRun;
    loadingSweepStartedAt = performance.now();
    set((s) => ({
      isActive: true, sweepKey: s.sweepKey + 1,
      mode: "loading", isMidpointPassed: false, pauseMenuVisible: true,
      loadingReady: false, loadingCompleted: 0, loadingTotal: 0,
      loadingLabel: "Preparing arena", loadingStage: "code",
      loadingReveal: false, loadingRevealFading: false,
    }));
    // 550 ms: backdrop fully opaque (0.15 × 3 100 ms = 465 ms) + 85 ms buffer
    scheduleTransition(run, 550, () => {
      onMidpoint?.();
      if (run === transitionRun) set({ isMidpointPassed: true });
    });
    // worst-case: max stagger (1 730 ms) + max duration (1 220 ms) = 2 950 ms → pad
    scheduleTransition(run, 3200, () => {
      if (get().loadingReady) get()._done();
    });
  },

  setLoadingProgress: ({ completed, total, label, stage }) => {
    set({ loadingCompleted: completed, loadingTotal: total, loadingLabel: label, loadingStage: stage });
  },

  completeLoadingSweep: (revealGameplay = true) => {
    if (!get().isActive || get().mode !== "loading") return;
    set({
      loadingReady: true,
      loadingReveal: revealGameplay,
      loadingRevealFading: false,
    });
    if (revealGameplay) {
      const run = transitionRun;
      // Keep one fully-black painted frame between the phase switch and the
      // fade so the new gameplay canvas can never clip through the menu.
      window.requestAnimationFrame(() => {
        if (run === transitionRun) set({ loadingRevealFading: true });
      });
      if (gameplayRevealTimer !== null) window.clearTimeout(gameplayRevealTimer);
      gameplayRevealTimer = window.setTimeout(() => {
        if (run === transitionRun) {
          set({ loadingReveal: false, loadingRevealFading: false });
        }
        gameplayRevealTimer = null;
      }, 2100);
    }
    const elapsed = performance.now() - loadingSweepStartedAt;
    if (elapsed >= 3200) {
      const run = transitionRun;
      scheduleTransition(run, 360, () => get()._done());
    }
  },

  _done: () => {
    ++transitionRun;
    clearTransitionTimers();
    set({
      isActive: false,
      isMidpointPassed: false,
      pauseMenuVisible: true,
      loadingReady: true,
      loadingCompleted: 0,
      loadingTotal: 0,
      loadingLabel: "",
      loadingStage: "idle",
    });
  },
}));
