import { Component, Suspense, type ComponentType, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, SMAA, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Background } from "./Background";
import { AdaptiveRenderQuality, useRenderQuality } from "./AdaptiveRenderQuality";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { getGameplayGateMode } from "@/game-runtime/GameplayGateState";
import {
  getRendererWarmupGeneration,
  markRendererWarmupComplete,
  subscribeRendererWarmup,
} from "@/game-runtime/RendererWarmup";
import {
  getGraphicsPresetProfile,
  performanceFeatureSnapshot,
  setPerformanceFeatureEnabled,
  useGraphicsPreset,
  usePerformanceFeature,
  usePerformanceToggleVersion,
  type PerformanceFeature,
} from "@/game-runtime/PerformanceToggles";
import { ArcadeBossIntroScene, type IntroBossPhase } from "@/components/ui/ArcadeBossIntroScene";

const loadGameplayScene = () => import("./GameplayScene");
let loadedGameplayScene: ComponentType | null = null;

/** Start downloading the heavy gameplay chunk before the gameplay gate mounts. */
export function preloadGameplayScene(): Promise<void> {
  return loadGameplayScene().then(() => undefined);
}

// ── Renderer configuration ────────────────────────────────────────────────────
function RendererSetup() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping      = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  return null;
}

// ── FPS scheduler ─────────────────────────────────────────────────────────────
// Drives the canvas in `frameloop="demand"` mode so the render loop only fires
// when we explicitly schedule it.  This frees the JS thread for React event
// handling (hover states, clicks) when no rendering is needed.
//
//  • Menu / mode-select screens  → 15 fps  (background orbs animate lightly)
//  • Everything else             → 30 fps  (gameplay, transitions, pause, etc.)
//
// 30 fps gives each frame ~33 ms of budget — roughly 2× more headroom than
// 60 fps — so heavy scenes (many orbs, particles, effects) stutter less.
function RenderScheduler({ introBossPhase }: { introBossPhase?: IntroBossPhase | null }) {
  const { invalidate } = useThree();
  const preset = useGraphicsPreset();
  const profile = getGraphicsPresetProfile(preset);

  useEffect(() => {
    let handle: ReturnType<typeof setInterval> | null = null;

    const schedule = (fps: number) => {
      if (handle !== null) clearInterval(handle);
      handle = setInterval(invalidate, 1000 / fps);
    };

    // Fire immediately so the canvas starts rendering right away
    const unsubscribe = useMagicOrb.subscribe(
      (s) => s.phase,
      (phase) => {
        // Menu screens: 15 fps — frees the JS thread for button hover/click events.
        // Active gameplay: 60 fps — fluid fire shaders and particle animations need it.
        // Everything else (pause, transitions, game-over): 30 fps is plenty.
         const fps =
           introBossPhase ? profile.idleFps :
           phase === "menu" || phase === "modeSelect" ? profile.menuFps :
          phase === "playing" ? profile.gameplayFps :
          profile.idleFps;
        schedule(fps);
      },
      { fireImmediately: true },
    );

    return () => {
      if (handle !== null) clearInterval(handle);
      unsubscribe();
    };
  }, [invalidate, profile, introBossPhase]);

  return null;
}

/** Makes a development A/B toggle repaint the demand-driven canvas immediately. */
function PerformanceToggleInvalidator() {
  const { invalidate } = useThree();
  const version = usePerformanceToggleVersion();

  useEffect(() => {
    invalidate();
  }, [invalidate, version]);

  return null;
}

// ── Shader pre-compilation (prewarm) ─────────────────────────────────────────
// Compiles all GPU shader programs while the loading screen is visible so the
// first gameplay frame never stalls on shader compilation.
function ShaderPrewarm() {
  const { gl, scene, camera } = useThree();
  const phase = useMagicOrb(s => s.phase);
  const requestedGeneration = useSyncExternalStore(
    subscribeRendererWarmup,
    getRendererWarmupGeneration,
    getRendererWarmupGeneration,
  );
  const completedGeneration = useRef(0);

  useEffect(() => {
    if (
      phase !== "loading" ||
      requestedGeneration === 0 ||
      completedGeneration.current >= requestedGeneration
    ) return;

    // The request is emitted only after critical GLTF cache promises resolve.
    // Two paints let their Suspense branches commit before this compile pass.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(async () => {
        try {
          const renderer = gl as THREE.WebGLRenderer & {
            compileAsync?: (scene: THREE.Scene, camera: THREE.Camera) => Promise<void>;
          };
          if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
          else renderer.compile(scene, camera);
        } catch (error) {
          console.warn("[loading] renderer warmup unavailable", error);
        } finally {
          completedGeneration.current = requestedGeneration;
          markRendererWarmupComplete(requestedGeneration);
        }
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [gl, scene, camera, phase, requestedGeneration]);

  return null;
}

// ── Camera smooth-follow + screen shake ───────────────────────────────────────
function CameraController() {
  const { camera } = useThree();
  const boss = useMagicOrb(s => s.boss);
  const arcadeLevel = useMagicOrb(s => s.arcadeLevel);
  const gameMode = useMagicOrb(s => s.gameMode);
  const playerPosition = useMagicOrb(s => s.playerPosition);
  const isBossLevel = gameMode === "arcade" && Math.round((arcadeLevel % 1) * 10) === 9;

  const targetZRef = useRef(10);
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  // Local decay of shake — avoids subscribing to a Zustand slice that updates frequently
  const shakeRef   = useRef(0);

  useEffect(() => {
    targetZRef.current = 16;
  }, [boss, isBossLevel]);

  useEffect(() => {
    targetXRef.current = playerPosition[0];
    targetYRef.current = playerPosition[1];
  }, [playerPosition]);

  useFrame((_, delta) => {
    // ── Screen shake: take the larger of the store value vs local decay ───
    const gs = useMagicOrb.getState();
    // Only track store shake while actively playing — stale values must not
    // persist into pause, game-over, or menu screens.
    const storeShake = gs.phase === "playing" ? Math.max(gs.backgroundShake, gs.cameraOnlyShake) : 0;
    if (gs.phase !== "playing") {
      // Not in active play — snap ref to zero immediately so no residual shake leaks
      shakeRef.current = 0;
    } else if (storeShake > shakeRef.current) {
      shakeRef.current = storeShake;
    } else {
      shakeRef.current = Math.max(0, shakeRef.current - delta * 3.5);
    }
    const shake = shakeRef.current;

    // ── Smooth camera follow ──────────────────────────────────────────────
    const diffZ = targetZRef.current - camera.position.z;
    const diffX = targetXRef.current - camera.position.x;
    const diffY = targetYRef.current - camera.position.y;

    if (Math.abs(diffZ) > 0.05) {
      camera.position.z += diffZ * 0.05;
    } else {
      camera.position.z = targetZRef.current;
    }
    if (Math.abs(diffX) > 0.01) {
      camera.position.x += diffX * 0.08;
    } else {
      camera.position.x = targetXRef.current;
    }
    if (Math.abs(diffY) > 0.01) {
      camera.position.y += diffY * 0.08;
    } else {
      camera.position.y = targetYRef.current;
    }

    // ── Apply shake as random camera offset ───────────────────────────────
    // Offset is applied after smooth follow so it doesn't accumulate
    if (shake > 0.008) {
      const strength = shake * 0.28; // max ≈0.14 units at backgroundShake=0.5
      camera.position.x += (Math.random() - 0.5) * strength;
      camera.position.y += (Math.random() - 0.5) * strength;
    }
  });

  return null;
}

// ── Dynamic post-processing ───────────────────────────────────────────────────
// PostProcessingWrapper reads phase via a selector so it re-renders only on
// phase or adaptive-quality transitions, not on every frame. This means
// EffectComposer is rebuilt only a handful of times per session — acceptable.
// Heavy effects (SMAA, ChromaticAberration, full Bloom) are skipped in menus.
function PostProcessingWrapper() {
  const phase = useMagicOrb(s => s.phase);
  const quality = useRenderQuality();
  const preset = useGraphicsPreset();
  const profile = getGraphicsPresetProfile(preset);
  const postprocessingEnabled = usePerformanceFeature("postprocessing");
  if (!postprocessingEnabled) return null;
  const isMenu = phase === "menu" || phase === "loading";
  return <PostProcessing isMenu={isMenu} quality={quality} profile={profile} />;
}

// IMPORTANT: PostProcessing itself must NOT call useMagicOrb(). The per-frame
// chromatic aberration offset is driven via getState() inside useFrame so that
// no Zustand subscription is created here — which would rebuild the pipeline.
function PostProcessing({
  isMenu,
  quality,
  profile,
}: {
  isMenu: boolean;
  quality: "high" | "medium" | "low";
  profile: ReturnType<typeof getGraphicsPresetProfile>;
}) {
  // Pre-allocated Vector2 — mutated each frame via getState() in useFrame.
  // Postprocessing reads it through the uniform reference on each render tick.
  const abOffset = useRef(new THREE.Vector2(0.0006, 0.0004));

  useFrame(() => {
    if (isMenu || !profile.chromaticAberration) return;
    const s        = useMagicOrb.getState();
    // Only apply chromatic aberration while actively playing
    const shake    = s.phase === "playing" ? s.backgroundShake : 0;
    const isBoss   = s.boss !== null ||
      (s.gameMode === "arcade" && Math.round((s.arcadeLevel % 1) * 10) === 9);
    const boost    = isBoss ? 0.0004 : 0;
    abOffset.current.set(
      0.0006 + shake * 0.014 + boost,
      0.0004 + shake * 0.007 + boost * 0.5,
    );
  });

  return (
    <EffectComposer multisampling={0} depthBuffer={false} stencilBuffer={false}>
      <Bloom
        intensity={isMenu ? profile.bloomIntensity * 0.4 : profile.bloomIntensity}
        luminanceThreshold={isMenu ? 0.5 : 0.28}
        luminanceSmoothing={0.82}
        mipmapBlur={!isMenu && profile.bloomMipmap}
        radius={profile.bloomRadius}
      />
      {/* Pass the same Vector2 object every render — uniform stores the ref,
          so mutations in useFrame are reflected without re-mounting the effect.
          Do NOT pass a `ref` prop: in React 19 refs are regular props and get
          spread into the effect constructor causing unexpected behaviour. */}
      {isMenu || !profile.chromaticAberration ? <></> : <ChromaticAberration offset={abOffset.current} />}
      <Vignette eskil={false} offset={0.28} darkness={quality === "low" ? 0.66 : 0.78} />
      {isMenu || !profile.antialiasPass ? <></> : <SMAA />}
    </EffectComposer>
  );
}

// ── Gameplay systems — mounted only during gameplay loading/playing ────────────
// All heavy gameplay GPU allocations (InstancedMesh buffers, particle typed
// arrays, physics maps, useFrame loops) live here.  Keeping them unmounted
// outside loading and playing phases reclaims the majority of idle GPU + RAM.
// They mount during the gameplay loading phase, then stay mounted through play.
function GameplayGate() {
  const phase = useMagicOrb(s => s.phase);
  const [GameplayScene, setGameplayScene] = useState<ComponentType | null>(
    () => loadedGameplayScene,
  );
  const gameplayActive = phase === "loading" || phase === "playing";
  const gateMode = getGameplayGateMode(gameplayActive, GameplayScene !== null);

  useEffect(() => {
    if (!gameplayActive || GameplayScene) return;
    let cancelled = false;
    void loadGameplayScene().then((module) => {
      loadedGameplayScene = module.default;
      if (!cancelled) setGameplayScene(() => module.default);
    });
    return () => {
      cancelled = true;
    };
  }, [gameplayActive, GameplayScene]);

  // Allocate the scene while the transition is opaque so the first playable
  // frame does not compete with the gameplay chunk, instanced buffers, and
  // player model. GameLogic still refuses to simulate until `playing`.
  if (gateMode === "hidden") return null;
  if (gateMode === "chunk-loading" || !GameplayScene) return <GameplayLoadingPlayer />;
  const ResolvedGameplayScene = GameplayScene;
  return (
    <>
      <ResolvedGameplayScene />
      <ShaderPrewarm />
    </>
  );
}

/** Visible only while the gameplay JavaScript chunk is loading. */
function GameplayLoadingPlayer() {
  const playerPosition = useMagicOrb(s => s.playerPosition);

  return (
    <group position={playerPosition}>
      <pointLight color="#9dfaff" intensity={2.8} distance={7} decay={2} />
      <mesh scale={0.72}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial color="#d8faff" transparent opacity={0.96} />
      </mesh>
      <mesh scale={1.05}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial
          color="#26cfff"
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/** Clears live slots when a run is definitively over, without wiping a pause. */
function GameRuntimeLifecycle() {
  const phase = useMagicOrb(s => s.phase);

  useEffect(() => {
    if (
      phase === "menu" ||
      phase === "modeSelect" ||
      phase === "gameOver" ||
      phase === "levelComplete" ||
      phase === "arcadeComplete"
    ) {
      gameRuntime.reset();
    }
  }, [phase]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as Window & {
      __orblitzRuntimeDiagnostics?: () => ReturnType<typeof gameRuntime.diagnosticsSnapshot>;
      __orblitzPerformance?: {
        features: () => ReturnType<typeof performanceFeatureSnapshot>;
        setFeature: (feature: PerformanceFeature, enabled: boolean) => void;
      };
    };
    target.__orblitzRuntimeDiagnostics = () => gameRuntime.diagnosticsSnapshot();
    target.__orblitzPerformance = {
      features: performanceFeatureSnapshot,
      setFeature: setPerformanceFeatureEnabled,
    };
    return () => {
      delete target.__orblitzRuntimeDiagnostics;
      delete target.__orblitzPerformance;
    };
  }, []);

  return null;
}

function WebGLUnavailable() {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: "#e8f7ff",
        background: "radial-gradient(circle at top, #102a42, #030712 68%)",
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <p style={{ margin: "0 0 12px", fontWeight: 800, letterSpacing: "0.08em" }}>WEBGL REQUIRED</p>
        <p style={{ margin: 0, color: "rgba(232,247,255,0.76)", lineHeight: 1.55 }}>
          Orblitz needs WebGL graphics support. Enable hardware acceleration or try a supported browser and device.
        </p>
      </div>
    </div>
  );
}

class WebGLErrorBoundary extends Component<{ children: ReactNode }, { unavailable: boolean }> {
  state = { unavailable: false };

  static getDerivedStateFromError() {
    return { unavailable: true };
  }

  render() {
    return this.state.unavailable ? <WebGLUnavailable /> : this.props.children;
  }
}

function canCreateWebGLContext() {
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");
  try {
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export function GameScene({ introBossPhase = null }: { introBossPhase?: IntroBossPhase | null }) {
  const [webglAvailable] = useState(canCreateWebGLContext);
  const backgroundEnabled = usePerformanceFeature("background");
  const foregroundIntroBosses = introBossPhase === "title" || introBossPhase === "waiting";

  if (!webglAvailable) return <WebGLUnavailable />;

  return (
    <WebGLErrorBoundary>
      <Canvas
        fallback={<WebGLUnavailable />}
        camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 100 }}
        dpr={[0.75, 1.5]}
        frameloop="demand"
        gl={{
          powerPreference: "high-performance",
          antialias: false,
          stencil: false,
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          touchAction: "none",
          zIndex: foregroundIntroBosses ? 120 : undefined,
          mixBlendMode: foregroundIntroBosses ? "screen" : undefined,
          pointerEvents: foregroundIntroBosses ? "none" : "auto",
        }}
      >
        <Suspense fallback={null}>
          <RenderScheduler introBossPhase={introBossPhase} />
          <PerformanceToggleInvalidator />
          <AdaptiveRenderQuality />
          <GameRuntimeLifecycle />
          <RendererSetup />
          <CameraController />
          {introBossPhase && <ArcadeBossIntroScene phase={introBossPhase} />}

          {/* Lightweight background — gameplay GPU systems mount below only when needed */}
          {backgroundEnabled && <Background />}

          {/* Gameplay systems — unmounted outside gameplay loading/playing */}
          <GameplayGate />

          {/* Post-processing stack */}
          <PostProcessingWrapper />
        </Suspense>
      </Canvas>
    </WebGLErrorBoundary>
  );
}
