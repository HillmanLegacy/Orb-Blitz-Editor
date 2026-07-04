import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import "@fontsource/inter";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { GameScene } from "@/components/game/GameScene";
import { SoundManager } from "@/components/game/SoundManager";
import { ModeSelect } from "@/components/ui/ModeSelect";
import { GameUI } from "@/components/ui/GameUI";
import { GameOver } from "@/components/ui/GameOver";
import { Shop } from "@/components/ui/Shop";
import { PauseMenu } from "@/components/ui/PauseMenu";
import { Inventory } from "@/components/ui/Inventory";
import { HowToPlay } from "@/components/ui/HowToPlay";
import { LevelTransition } from "@/components/ui/LevelTransition";
import { LevelSelect } from "@/components/ui/LevelSelect";
import { StartupAnimation } from "@/components/ui/StartupAnimation";
import { StartupLoading } from "@/components/ui/StartupLoading";
import { Settings } from "@/components/ui/Settings";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ArcadeComplete } from "@/components/ui/ArcadeComplete";

function App() {
  const { phase } = useMagicOrb();
  const { addCoins, shopOpen, inventoryOpen } = useShop();
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStartupLoading, setShowStartupLoading] = useState(true);
  // Once the user taps through the intro, skip it for subsequent menu visits
  const [skipIntro, setSkipIntro] = useState(false);

  const handleStartupLoadingComplete = useCallback(() => {
    setShowStartupLoading(false);
  }, []);

  const handleMenuReady = useCallback(() => {
    setSkipIntro(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      fetch(`/api/verify-payment?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => { if (data.success && data.coins) addCoins(data.coins); })
        .catch(() => {})
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    }
  }, [addCoins]);

  const handleModeSelectArcade = () => {
    setShowModeSelect(false);
    setShowLevelSelect(true);
  };

  const handleShowLevelSelect = useCallback(() => {
    setShowLevelSelect(true);
  }, []);

  const handleShowMainMenu = useCallback(() => {
    setShowLevelSelect(false);
    setShowModeSelect(false);
    setShowHowToPlay(false);
    setShowSettings(false);
  }, []);

  useEffect(() => {
    if (phase === "menu" && !showLevelSelect) {
      setShowModeSelect(false);
    }
  }, [phase, showLevelSelect]);

  // Show the startup/menu screen when in menu phase and no overlay is active
  const showMenuScreen =
    phase === "menu" &&
    !showHowToPlay &&
    !showModeSelect &&
    !showLevelSelect &&
    !showSettings &&
    !shopOpen &&
    !inventoryOpen;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {showStartupLoading && <StartupLoading onComplete={handleStartupLoadingComplete} />}
      <GameScene />

      <AnimatePresence>
        {showMenuScreen && (
          <StartupAnimation
            key="startup"
            skipIntro={skipIntro}
            onShowModeSelect={() => setShowModeSelect(true)}
            onShowHowToPlay={() => setShowHowToPlay(true)}
            onShowSettings={() => setShowSettings(true)}
            onMenuReady={handleMenuReady}
          />
        )}
      </AnimatePresence>

      {phase === "menu" && showSettings && (
        <Settings onBack={() => setShowSettings(false)} />
      )}
      {phase === "menu" && showHowToPlay && (
        <HowToPlay onBack={() => setShowHowToPlay(false)} />
      )}
      {phase === "menu" && showModeSelect && (
        <ModeSelect onBack={() => setShowModeSelect(false)} onArcadeSelect={handleModeSelectArcade} />
      )}
      {phase === "menu" && showLevelSelect && (
        <LevelSelect onBack={() => {
          setShowLevelSelect(false);
          setShowModeSelect(true);
        }} />
      )}
      {(phase === "playing" || phase === "paused") && <GameUI />}
      {phase === "paused" && <PauseMenu />}
      {phase === "gameOver" && <GameOver onLevelSelect={handleShowLevelSelect} onMainMenu={handleShowMainMenu} />}
      {phase === "levelComplete" && <LevelTransition onLevelSelect={handleShowLevelSelect} onMainMenu={handleShowMainMenu} />}
      {phase === "arcadeComplete" && <ArcadeComplete />}

      <Shop />
      <Inventory />
      <SoundManager />
      <LoadingScreen />
    </div>
  );
}

export default App;
