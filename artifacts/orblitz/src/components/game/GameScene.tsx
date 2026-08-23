import { lazy, Suspense, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, SMAA, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Background } from "./Background";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { gameRuntime } from "@/game-runtime/GameRuntime";

const GameplayScene = lazy(() => import("./GameplayScene"));

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
function RenderScheduler() {
  const { invalidate } = useThree();

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
          phase === "menu" || phase === "modeSelect" ? 15 :
          phase === "playing" ? 60 :
          30;
        schedule(fps);
      },
      { fireImmediately: true },
    );

    return () => {
      if (handle !== null) clearInterval(handle);
      unsubscribe();
    };
  }, [invalidate]);

  return null;
}

// ── Shader pre-compilation (prewarm) ─────────────────────────────────────────
// Compiles all GPU shader programs while the loading screen is visible so the
// first gameplay frame never stalls on shader compilation.
function ShaderPrewarm() {
  const { gl, scene, camera } = useThree();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Use idle callback so all Suspense'd meshes have had a chance to mount
    const run = () => (gl as THREE.WebGLRenderer).compile(scene, camera);
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(run, 300);
      return () => clearTimeout(id);
    }
  }, [gl, scene, camera]);

  return null;
}

// ── Camera smooth-follow + screen shake ───────────────────────────────────────
function CameraController() {
  const { camera } = useThree();
  const { boss, arcadeLevel, gameMode, playerPosition } = useMagicOrb();
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
// phase transitions (menu→loading→playing etc.), not on every frame. This means
// EffectComposer is rebuilt only a handful of times per session — acceptable.
// Heavy effects (SMAA, ChromaticAberration, full Bloom) are skipped in menus.
function PostProcessingWrapper() {
  const phase = useMagicOrb(s => s.phase);
  const isMenu = phase === "menu" || phase === "loading";
  return <PostProcessing isMenu={isMenu} />;
}

// IMPORTANT: PostProcessing itself must NOT call useMagicOrb(). The per-frame
// chromatic aberration offset is driven via getState() inside useFrame so that
// no Zustand subscription is created here — which would rebuild the pipeline.
function PostProcessing({ isMenu }: { isMenu: boolean }) {
  // Pre-allocated Vector2 — mutated each frame via getState() in useFrame.
  // Postprocessing reads it through the uniform reference on each render tick.
  const abOffset = useRef(new THREE.Vector2(0.0006, 0.0004));

  useFrame(() => {
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
        intensity={isMenu ? 0.18 : 0.62}
        luminanceThreshold={isMenu ? 0.5 : 0.28}
        luminanceSmoothing={0.82}
        mipmapBlur={!isMenu}
        radius={0.72}
      />
      {/* Pass the same Vector2 object every render — uniform stores the ref,
          so mutations in useFrame are reflected without re-mounting the effect.
          Do NOT pass a `ref` prop: in React 19 refs are regular props and get
          spread into the effect constructor causing unexpected behaviour. */}
      {!isMenu && <ChromaticAberration offset={abOffset.current} />}
      <Vignette eskil={false} offset={0.28} darkness={0.78} />
      {!isMenu && <SMAA />}
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
  if (phase !== "loading" && phase !== "playing") return null;
  return <GameplayScene />;
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
    };
    target.__orblitzRuntimeDiagnostics = () => gameRuntime.diagnosticsSnapshot();
    return () => { delete target.__orblitzRuntimeDiagnostics; };
  }, []);

  return null;
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export function GameScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
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
      }}
    >
      <Suspense fallback={null}>
        <RenderScheduler />
        <GameRuntimeLifecycle />
        <RendererSetup />
        <ShaderPrewarm />
        <CameraController />

        {/* Lightweight background — gameplay GPU systems mount below only when needed */}
        <Background />

        {/* Gameplay systems — unmounted outside gameplay loading/playing */}
        <GameplayGate />

        {/* Post-processing stack */}
        <PostProcessingWrapper />
      </Suspense>
    </Canvas>
  );
}
