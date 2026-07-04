import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import "@fontsource/inter";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
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
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ArcadeComplete } from "@/components/ui/ArcadeComplete";

function App() {
  const { phase } = useMagicOrb();
  const { addCoins, shopOpen, inventoryOpen } = useShop();
  const [showStartupLoading, setShowStartupLoading] = useState(true);
  const [skipIntro, setSkipIntro] = useState(false);
  // When coming from GameOver "Level Select", open directly into worlds
  const [initialMenuState, setInitialMenuState] = useState<MenuState>("root");

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

  // From GameOver/LevelTransition: jump straight to the level select world grid
  const handleShowLevelSelect = useCallback(() => setInitialMenuState("worlds"), []);

  // From GameOver/LevelTransition: return to root menu
  const handleShowMainMenu = useCallback(() => setInitialMenuState("root"), []);

  // Show the startup/menu screen when in menu phase and shop/inventory not open
  const showMenuScreen = phase === "menu" && !shopOpen && !inventoryOpen;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {showStartupLoading && <StartupLoading onComplete={handleStartupLoadingComplete} />}
      <GameScene />

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
      <LoadingScreen />
    </div>
  );
}

export default App;
