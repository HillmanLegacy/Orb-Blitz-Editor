import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { IS_MOBILE } from "@/lib/isMobile";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
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

// ── Camera smooth-follow ──────────────────────────────────────────────────────
function CameraController() {
  const { camera } = useThree();
  const { boss, arcadeLevel, gameMode, playerPosition } = useMagicOrb();
  const isBossLevel = gameMode === "arcade" && Math.round((arcadeLevel % 1) * 10) === 9;
  const targetZRef = useRef(10);
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);

  useEffect(() => {
    targetZRef.current = (boss !== null || isBossLevel) ? 16 : 10;
  }, [boss, isBossLevel]);

  useEffect(() => {
    targetXRef.current = playerPosition[0];
    targetYRef.current = playerPosition[1];
  }, [playerPosition]);

  // Use R3F's useFrame instead of a standalone rAF loop — stays in sync with
  // the renderer and stops automatically when the canvas is not rendering.
  useFrame(() => {
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
  });

  return null;
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
        <GameLogic />

        {/* Post-processing stack */}
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.35}
            luminanceSmoothing={0.75}
            mipmapBlur
            radius={0.6}
          />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
