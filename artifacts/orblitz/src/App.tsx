import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import "@fontsource/inter";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { GameScene } from "@/components/game/GameScene";
import { SoundManager } from "@/components/game/SoundManager";
import { GameUI } from "@/components/ui/GameUI";
import { GameOver } from "@/components/ui/GameOver";
import { Shop } from "@/components/ui/Shop";
import { PauseMenu } from "@/components/ui/PauseMenu";
import { Inventory } from "@/components/ui/Inventory";
import { LevelTransition } from "@/components/ui/LevelTransition";
import { StartupAnimation, type MenuState } from "@/components/ui/StartupAnimation";
import { StartupLoading } from "@/components/ui/StartupLoading";
import { ArcadeComplete } from "@/components/ui/ArcadeComplete";
import { OrbSweepOverlay } from "@/components/ui/OrbSweepOverlay";

function App() {
  const { phase } = useMagicOrb();
  const { addCoins, shopOpen, inventoryOpen } = useShop();
  const { brightness } = useAudio();
  // Transition state — drives render gates for pause menu and menu screen
  const { isActive, isMidpointPassed, pauseMenuVisible } = useOrbTransition();

  const [showStartupLoading, setShowStartupLoading] = useState(true);
  const [skipIntro, setSkipIntro] = useState(false);
  const [initialMenuState, setInitialMenuState] = useState<MenuState>("root");
  const musicFiredRef = useRef(false);

  const handleStartupLoadingComplete = useCallback(() => setShowStartupLoading(false), []);
  const handleMenuReady = useCallback(() => { setSkipIntro(true); }, []);

  // Stripe payment callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      fetch(`/api/verify-payment?session_id=${sessionId}`)
        .then(r => r.json())
        .then(d => { if (d.success && d.coins) addCoins(d.coins); })
        .catch(() => {})
        .finally(() => window.history.replaceState({}, "", window.location.pathname));
    }
  }, [addCoins]);

  // ── Loading phase: music transition + finishLoading ───────────────────────
  // The orb sweep (loadingSweep) is triggered from each call site at tap time.
  // startLoading() fires at the sweep midpoint (550 ms), so finishLoading needs
  // only 1 800 ms from here (total from tap ≈ 2 350 ms, within the opaque
  // backdrop window that ends at 2 604 ms).
  useEffect(() => {
    if (phase !== "loading") {
      musicFiredRef.current = false;
      return;
    }

    if (!musicFiredRef.current) {
      musicFiredRef.current = true;
      const { loadingType } = useMagicOrb.getState();
      const { stopMusic, startGameMusic, startMenuMusic } = useAudio.getState();
      const goingIntoGame = loadingType === "entering" || loadingType === "nextLevel";
      stopMusic();
      const musicTimer = window.setTimeout(() => {
        if (useMagicOrb.getState().phase !== "loading") return;
        try { if (goingIntoGame) startGameMusic(); else startMenuMusic(); } catch {}
      }, 1200);
      // musicTimer fires before finishLoading (1 200 ms < 1 800 ms) — no need to cancel
      void musicTimer;
    }

    const finishTimer = window.setTimeout(() => {
      useMagicOrb.getState().finishLoading();
    }, 1800);

    return () => window.clearTimeout(finishTimer);
  }, [phase]);

  const handleShowLevelSelect = useCallback(() => setInitialMenuState("worlds"), []);
  const handleShowMainMenu    = useCallback(() => setInitialMenuState("root"),   []);

  // Menu screen stays visible during loading sweep-in so the old frame is present
  // behind the orbs until the screen is fully hidden (midpoint at 550 ms).
  const showMenuScreen =
    ((phase === "menu") ||
     (phase === "loading" && isActive && !isMidpointPassed)) &&
    !shopOpen && !inventoryOpen;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {showStartupLoading && <StartupLoading onComplete={handleStartupLoadingComplete} />}
      <div style={{ position: "absolute", inset: 0, filter: `brightness(${brightness})`, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", width: "100%", height: "100%" }}>
          <GameScene />
        </div>
      </div>

      <AnimatePresence>
        {showMenuScreen && (
          <StartupAnimation
            key={`startup-${initialMenuState}`}
            skipIntro={skipIntro}
            initialState={initialMenuState}
            onMenuReady={handleMenuReady}
          />
        )}
      </AnimatePresence>

      {(phase === "playing" || phase === "paused") && <GameUI />}

      {/* PauseMenu is gated by pauseMenuVisible: during a pauseSweep() it is hidden
          so the frozen game frame is visible during sweep-in, then shown at midpoint
          (still covered by the backdrop) ready to be revealed as orbs exit. */}
      {phase === "paused" && pauseMenuVisible && <PauseMenu />}

      {phase === "gameOver" && (
        <GameOver onLevelSelect={handleShowLevelSelect} onMainMenu={handleShowMainMenu} />
      )}
      {phase === "levelComplete" && (
        <LevelTransition onLevelSelect={handleShowLevelSelect} onMainMenu={handleShowMainMenu} />
      )}
      {phase === "arcadeComplete" && <ArcadeComplete />}

      <Shop />
      <Inventory />
      <SoundManager />

      {/* Orb sweep transition – z-9999, above all UI */}
      <OrbSweepOverlay />
    </div>
  );
}

export default App;
