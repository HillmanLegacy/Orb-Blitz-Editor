import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import "@fontsource/inter";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { useOrbTransition } from "@/lib/stores/useOrbTransition";
import { prepareGameSection, preloadMenuAssets, warmNextGameSection } from "@/lib/preloadAssets";
import { GameScene, preloadGameplayScene } from "@/components/game/GameScene";
import { requestRendererWarmup } from "@/game-runtime/RendererWarmup";
import { SoundManager } from "@/components/game/SoundManager";
import { GameUI } from "@/components/ui/GameUI";
import { GameOver } from "@/components/ui/GameOver";
import { PauseMenu } from "@/components/ui/PauseMenu";
import { LevelTransition } from "@/components/ui/LevelTransition";
import { StartupAnimation, type MenuState } from "@/components/ui/StartupAnimation";
import type {
  IntroBossPhase,
  IntroBossPresentation,
} from "@/components/ui/ArcadeBossIntroScene";
import { ArcadeComplete } from "@/components/ui/ArcadeComplete";
import { OrbSweepOverlay } from "@/components/ui/OrbSweepOverlay";
import { AchievementToast } from "@/components/ui/AchievementToast";

// These screens contain large UI trees (and the shop can create an optional
// preview WebGL context). Keep them out of the initial menu/gameplay bundle and
// do not mount their stateful trees until the player asks to open one.
const loadShop = () => import("@/components/ui/Shop");
const loadInventory = () => import("@/components/ui/Inventory");
const loadTrophyCollection = () => import("@/components/ui/TrophyCollection");
const Shop = lazy(() => loadShop().then(({ Shop }) => ({ default: Shop })));
const Inventory = lazy(() => loadInventory().then(({ Inventory }) => ({ default: Inventory })));
const TrophyCollection = lazy(() => loadTrophyCollection().then(({ TrophyCollection }) => ({ default: TrophyCollection })));

function App() {
  const phase = useMagicOrb(s => s.phase);
  const gameMode = useMagicOrb(s => s.gameMode);
  const pendingLevel = useMagicOrb(s => s.pendingLevel);
  const arcadeLevel = useMagicOrb(s => s.arcadeLevel);
  const loadingType = useMagicOrb(s => s.loadingType);
  const { addCoins, shopOpen, inventoryOpen, trophiesOpen } = useShop(useShallow(s => ({
    addCoins: s.addCoins,
    shopOpen: s.shopOpen,
    inventoryOpen: s.inventoryOpen,
    trophiesOpen: s.trophiesOpen,
  })));
  const brightness = useAudio(s => s.brightness);
  // Transition state — drives render gates for pause menu and menu screen
  const { isActive, isMidpointPassed, pauseMenuVisible } = useOrbTransition(useShallow(s => ({
    isActive: s.isActive,
    isMidpointPassed: s.isMidpointPassed,
    pauseMenuVisible: s.pauseMenuVisible,
  })));

  // The active product is the menu. The old cinematic splash was a
  // time-gated dead end and is intentionally no longer part of startup.
  const [skipIntro, setSkipIntro] = useState(true);
  const [introBossPhase, setIntroBossPhase] = useState<IntroBossPhase | null>(null);
  const [introBossPresentation, setIntroBossPresentation] = useState<IntroBossPresentation>("menu");
  const [introSelectedWorld, setIntroSelectedWorld] = useState(1);
  const [initialMenuState, setInitialMenuState] = useState<MenuState>("root");
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [shopLayerVisible, setShopLayerVisible] = useState(false);
  const [inventoryLayerVisible, setInventoryLayerVisible] = useState(false);
  const [trophiesLayerVisible, setTrophiesLayerVisible] = useState(false);
  const loadingRunRef = useRef(0);
  const handleMenuReady = useCallback(() => { setSkipIntro(true); }, []);
  const handleIntroPhaseChange = useCallback((
    nextPhase: IntroBossPhase | null,
    menuState?: MenuState,
    selectedWorld?: number,
  ) => {
    setIntroBossPhase(nextPhase);
    if (selectedWorld !== undefined) setIntroSelectedWorld(selectedWorld);
    setIntroBossPresentation(
      menuState === "worlds" ? "worlds" : menuState === "levels" ? "levels" : "menu",
    );
  }, []);

  useEffect(() => {
    void preloadMenuAssets();
  }, []);

  // Fetch optional menu screens after the branded intro has handed control to
  // the player. Their component trees still stay unmounted until opened, but
  // the first MARKET/LOADOUT/ARCHIVE click no longer waits on a new chunk.
  useEffect(() => {
    if (!skipIntro) return;
    const prefetchTimer = window.setTimeout(() => {
      void Promise.all([loadShop(), loadInventory(), loadTrophyCollection()]);
    }, 350);
    return () => window.clearTimeout(prefetchTimer);
  }, [skipIntro]);

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

  // ── Loading phase: readiness-aware transition ──────────────────────────────
  // startLoading() fires once the sweep is opaque. Gameplay is revealed only
  // after the selected section's code, critical models, and bounded renderer
  // warmup have settled. The sweep holds if preparation exceeds its normal run.
  useEffect(() => {
    if (phase !== "loading") return;
    const run = ++loadingRunRef.current;
    let cancelled = false;
    const transition = useOrbTransition.getState();

    const complete = async () => {
      if (loadingType === "entering" || loadingType === "nextLevel") {
        await prepareGameSection({
          gameMode,
          level: pendingLevel,
          loadGameplayCode: preloadGameplayScene,
          warmRenderer: () => requestRendererWarmup(1800),
          onProgress: (progress) => {
            if (!cancelled && run === loadingRunRef.current) {
              useOrbTransition.getState().setLoadingProgress(progress);
            }
          },
        });
      } else {
        transition.setLoadingProgress({
          completed: 0,
          total: 1,
          label: loadingType === "exiting_to_menu" ? "Returning to command" : "Preparing level select",
          stage: "code",
        });
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        transition.setLoadingProgress({
          completed: 1,
          total: 1,
          label: "Ready",
          stage: "ready",
        });
      }

      if (cancelled || run !== loadingRunRef.current) return;
      useOrbTransition.getState().completeLoadingSweep(
        loadingType === "entering" || loadingType === "nextLevel",
      );
      useMagicOrb.getState().finishLoading();
    };

    void complete();
    return () => {
      cancelled = true;
    };
  }, [gameMode, loadingType, pendingLevel, phase]);

  // Once play is responsive, use idle time to prepare the current world's boss
  // (or the next world's model after a boss) without blocking simulation.
  useEffect(() => {
    if (phase !== "playing") return;
    return warmNextGameSection(gameMode, arcadeLevel);
  }, [arcadeLevel, gameMode, phase]);

  const handleShowLevelSelect = useCallback(() => setInitialMenuState("worlds"), []);
  const handleShowMainMenu    = useCallback(() => setInitialMenuState("root"),   []);

  useEffect(() => {
    if (shopOpen) setShopLayerVisible(true);
  }, [shopOpen]);

  useEffect(() => {
    if (inventoryOpen) setInventoryLayerVisible(true);
  }, [inventoryOpen]);

  useEffect(() => {
    if (trophiesOpen) setTrophiesLayerVisible(true);
  }, [trophiesOpen]);

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
    !shopOpen && !inventoryOpen && !trophiesOpen;

  return (
    <div className="orblitz-app-shell" style={{ width: "100vw", height: "100dvh", position: "relative", overflow: "hidden", filter: `brightness(${brightness})` }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", width: "100%", height: "100%" }}>
           <GameScene
             introBossPhase={introBossPhase}
             introBossPresentation={introBossPresentation}
        introSelectedWorld={introSelectedWorld}
           />
        </div>
      </div>

      <AnimatePresence>
        {showMenuScreen && (
          <StartupAnimation
            key={`startup-${initialMenuState}`}
            skipIntro={skipIntro}
            initialState={initialMenuState}
            onMenuReady={handleMenuReady}
            onIntroPhaseChange={handleIntroPhaseChange}
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

       <Suspense fallback={null}>
         {(shopOpen || shopLayerVisible) && (
           <Shop onExitComplete={() => setShopLayerVisible(false)} />
         )}
         {(inventoryOpen || inventoryLayerVisible) && (
           <Inventory onExitComplete={() => setInventoryLayerVisible(false)} />
         )}
          {(trophiesOpen || trophiesLayerVisible) && (
            <TrophyCollection onExitComplete={() => setTrophiesLayerVisible(false)} />
          )}
       </Suspense>
       <AchievementToast />
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
