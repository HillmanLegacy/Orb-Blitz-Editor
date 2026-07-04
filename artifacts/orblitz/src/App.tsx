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
  const [showStartupLoading, setShowStartupLoading] = useState(true);
  const [skipIntro, setSkipIntro] = useState(false);
  const [initialMenuState, setInitialMenuState] = useState<MenuState>("root");

  // Prevent music from being triggered twice per loading phase
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

  // ── Loading phase: orb sweep + music transition + finishLoading ───────────
  // Replaces LoadingScreen entirely – the orb sweep is the visual transition.
  useEffect(() => {
    if (phase !== "loading") {
      musicFiredRef.current = false;
      return;
    }

    // Kick off the orb sweep overlay (visual)
    useOrbTransition.getState().loadingSweep();

    // Music – stop current track, start the appropriate one after 1 200 ms.
    // Capture loadingType now (snapshot) so the callback uses the right value.
    const { loadingType } = useMagicOrb.getState();
    const { stopMusic, startGameMusic, startMenuMusic } = useAudio.getState();
    const goingIntoGame = loadingType === "entering" || loadingType === "nextLevel";
    stopMusic();
    const musicTimer = window.setTimeout(() => {
      // Guard: only start music if we're still in this loading phase
      if (useMagicOrb.getState().phase !== "loading") return;
      try { if (goingIntoGame) startGameMusic(); else startMenuMusic(); } catch {}
    }, 1200);

    // finishLoading after 2 500 ms – same window as the old LoadingScreen.
    // The orb sweep backdrop stays fully opaque until 2 604 ms so the scene
    // change is invisible; orbs then sweep out revealing the new scene.
    const finishTimer = window.setTimeout(() => {
      useMagicOrb.getState().finishLoading();
    }, 2500);

    return () => {
      window.clearTimeout(musicTimer);
      window.clearTimeout(finishTimer);
    };
  }, [phase]);

  // From GameOver/LevelTransition: jump straight to the level select world grid
  const handleShowLevelSelect = useCallback(() => setInitialMenuState("worlds"), []);

  // From GameOver/LevelTransition: return to root menu
  const handleShowMainMenu = useCallback(() => setInitialMenuState("root"), []);

  // Show the startup/menu screen when in menu phase and shop/inventory not open
  const showMenuScreen = phase === "menu" && !shopOpen && !inventoryOpen;

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
      {phase === "paused" && <PauseMenu />}
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
