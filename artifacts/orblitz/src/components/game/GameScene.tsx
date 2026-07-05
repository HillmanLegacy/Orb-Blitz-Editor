import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { IS_MOBILE } from "@/lib/isMobile";
import { EffectComposer, Bloom, SMAA, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { PlayerOrb } from "./PlayerOrb";
import { DarkOrbs } from "./DarkOrbs";
import { Projectiles } from "./Projectiles";
import { PowerUps } from "./PowerUps";
import { Particles } from "./Particles";
import { GameLogic } from "./GameLogic";
import { Background } from "./Background";
import { LaserBeams } from "./LaserBeams";
import { DistortField } from "./DistortField";
import { Boss } from "./Boss";
import { DefenseOrbs } from "./DefenseOrbs";
import { MagiOrbEffects } from "./MagiOrbEffects";
import { ScreenEffects } from "./ScreenEffects";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── Renderer configuration ────────────────────────────────────────────────────
function RendererSetup() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping      = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  return null;
}

// ── Dynamic point light tethered to player position ───────────────────────────
function PlayerLight() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const pos = useMagicOrb.getState().playerPosition;
    lightRef.current.position.set(pos[0], pos[1], 1.5);
  });

  return (
    <pointLight
      ref={lightRef}
      intensity={4.5}
      distance={14}
      decay={2}
      color="#ffffff"
    />
  );
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
    targetZRef.current = (boss !== null || isBossLevel) ? 16 : 10;
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
    const storeShake = gs.phase === "playing" ? gs.backgroundShake : 0;
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
// IMPORTANT: do NOT call useMagicOrb() here. Every Zustand state change would
// cause EffectComposer to re-render and rebuild its WebGL effect pipeline,
// throwing a rendering error. Use getState() inside useFrame instead.
function PostProcessing() {
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
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.62}
        luminanceThreshold={0.28}
        luminanceSmoothing={0.82}
        mipmapBlur
        radius={0.72}
      />
      {/* Pass the same Vector2 object every render — uniform stores the ref,
          so mutations in useFrame are reflected without re-mounting the effect.
          Do NOT pass a `ref` prop: in React 19 refs are regular props and get
          spread into the effect constructor causing unexpected behaviour. */}
      <ChromaticAberration offset={abOffset.current} />
      <Vignette eskil={false} offset={0.28} darkness={0.78} />
      <SMAA />
    </EffectComposer>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export function GameScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 100 }}
      dpr={IS_MOBILE ? [1, 1.5] : [1, 2]}
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
        <RendererSetup />
        <CameraController />

        {/* Dynamic light tethered to the player */}
        <PlayerLight />

        {/* Game scene objects */}
        <Background />
        <PlayerOrb />
        <DarkOrbs />
        <Boss />
        <Projectiles />
        <PowerUps />
        <Particles />
        <LaserBeams />
        <DistortField />
        <DefenseOrbs />
        <MagiOrbEffects />
        <ScreenEffects />
        <GameLogic />

        {/* Post-processing stack */}
        <PostProcessing />
      </Suspense>
    </Canvas>
  );
}
