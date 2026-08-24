import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import "@fontsource/inter";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { preloadImminentGameAssets, preloadMenuAssets } from "@/lib/preloadAssets";
import { GameScene, preloadGameplayScene } from "@/components/game/GameScene";
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
  const phase = useMagicOrb(s => s.phase);
  const gameMode = useMagicOrb(s => s.gameMode);
  const pendingLevel = useMagicOrb(s => s.pendingLevel);
  const { addCoins, shopOpen, inventoryOpen } = useShop(useShallow(s => ({
    addCoins: s.addCoins,
    shopOpen: s.shopOpen,
    inventoryOpen: s.inventoryOpen,
  })));
  const brightness = useAudio(s => s.brightness);
  // Transition state — drives render gates for pause menu and menu screen
  const { isActive, isMidpointPassed, pauseMenuVisible } = useOrbTransition(useShallow(s => ({
    isActive: s.isActive,
    isMidpointPassed: s.isMidpointPassed,
    pauseMenuVisible: s.pauseMenuVisible,
  })));

  const [showStartupLoading, setShowStartupLoading] = useState(true);
  const [skipIntro, setSkipIntro] = useState(false);
  const [initialMenuState, setInitialMenuState] = useState<MenuState>("root");
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const musicFiredRef = useRef(false);
  const handleStartupLoadingComplete = useCallback(() => {
    setShowStartupLoading(false);
    // Menu sounds are small and immediately useful. Gameplay assets wait until
    // the player has chosen a mode/level, avoiding speculative music and boss
    // downloads during menu browsing.
    void preloadMenuAssets();
  }, []);
  const handleMenuReady = useCallback(() => { setSkipIntro(true); }, []);

  // Stripe payment callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      fetch(`/api/verify-payment?session_id=${sessionId}`)
        .then(async (response) => {
          const data = await response.json().catch(() => null) as { success?: boolean; coins?: number; error?: string } | null;
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || "Payment verification is temporarily unavailable.");
          }
          return data;
        })
        .then((data) => { if (data.coins) addCoins(data.coins); })
        .catch((error: unknown) => {
          console.error("Payment verification failed", error);
          setPaymentNotice("We could not verify that payment yet. Your purchase has not been applied.");
        })
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
      // Start the gameplay module and selected run's critical requests while
      // the transition is opaque. Neither request gates the transition.
      preloadGameplayScene();
      void preloadImminentGameAssets({ gameMode, level: pendingLevel });
    }

    const finishTimer = window.setTimeout(() => {
      useMagicOrb.getState().finishLoading();
    }, 1800);

    return () => window.clearTimeout(finishTimer);
  }, [gameMode, pendingLevel, phase]);

  const handleShowLevelSelect = useCallback(() => setInitialMenuState("worlds"), []);
  const handleShowMainMenu    = useCallback(() => setInitialMenuState("root"),   []);

  // When arcade completes, ensure returning to menu lands on the root screen
  // (not the world-select that was open when the run started).
  useEffect(() => {
    if (phase === "arcadeComplete") setInitialMenuState("root");
  }, [phase]);

  // Menu screen stays visible during loading sweep-in so the old frame is present
  // behind the orbs until the screen is fully hidden (midpoint at 550 ms).
  const showMenuScreen =
    ((phase === "menu") ||
     (phase === "loading" && isActive && !isMidpointPassed)) &&
    !shopOpen && !inventoryOpen;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", filter: `brightness(${brightness})` }}>
      {showStartupLoading && <StartupLoading onComplete={handleStartupLoadingComplete} />}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
      {phase === "paused" && pauseMenuVisible && <PauseMenu onMainMenu={handleShowMainMenu} />}

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

       {paymentNotice && (
         <div
           role="alert"
           style={{
             position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 10000,
             maxWidth: "min(92vw, 540px)", padding: "12px 16px", borderRadius: 12,
             color: "#ffe8e8", background: "rgba(95, 12, 20, 0.94)", border: "1px solid rgba(255, 122, 122, 0.65)",
             fontSize: 13, textAlign: "center",
           }}
         >
           {paymentNotice}
         </div>
       )}

      {/* Orb sweep transition – z-9999, above all UI */}
      <OrbSweepOverlay />
    </div>
  );
}

export default App;
