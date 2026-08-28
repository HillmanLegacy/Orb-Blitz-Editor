import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PlayerOrb } from "./PlayerOrb";
import { DarkOrbs } from "./DarkOrbs";
import { Projectiles } from "./Projectiles";
import { PowerUps } from "./PowerUps";
import { Particles } from "./Particles";
import { GameLogic } from "./GameLogic";
import { LaserBeams } from "./LaserBeams";
import { DistortField } from "./DistortField";
import { Boss } from "./Boss";
import { DefenseOrbs } from "./DefenseOrbs";
import { MagiOrbEffects } from "./MagiOrbEffects";
import { ScreenEffects } from "./ScreenEffects";
import { SubBlasterOrb } from "./SubBlasterOrb";
import { StarFlowVFX } from "./StarFlowVFX";
import { World1FireBackground } from "./World1FireBackground";
import { ProjectileTrails } from "./ProjectileTrails";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";
import { usePerformanceFeature } from "@/game-runtime/PerformanceToggles";

function PlayerLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  const phase = useMagicOrb((s) => s.phase);

  useFrame(() => {
    if (phase !== "playing" || !lightRef.current) return;
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

function GameRuntimeCoordinator() {
  const { gl } = useThree();
  const phase = useMagicOrb((s) => s.phase);

  useFrame((_, delta) => {
    if (phase !== "playing") return;
    runtimeDiagnostics.beginFrame();
    gameRuntime.pipeline.beginFrame();
    gameRuntime.pipeline.enter("clock");
    gameRuntime.clock.tick(delta);
  }, -2);

  useFrame(() => {
    if (phase !== "playing") return;
    runtimeDiagnostics.endFrame(gl);
  }, 100);

  return null;
}

/** Gameplay module; mechanics stay mounted independently from presentation. */
export default function GameplayScene() {
  const [visualSystemsReady, setVisualSystemsReady] = useState(false);
  const vfxEnabled = usePerformanceFeature("vfx");

  useEffect(() => {
    // Let the core player/gameplay tree paint once before allocating effect
    // systems. This is presentation-only and never gates simulation.
    const frame = requestAnimationFrame(() => setVisualSystemsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      <GameRuntimeCoordinator />
      <PlayerLight />
      <PlayerOrb />
      <DarkOrbs />
      <Boss />
      <Projectiles />
      <GameLogic />
      {/*
       * These systems own gameplay state in addition to their render trees. They
       * intentionally stay mounted at every visual quality level: disabling VFX
       * must never disable pickups, allied weapons, defensive collisions, or
       * rewards.
       */}
      <PowerUps />
      <SubBlasterOrb />
      <DefenseOrbs />
      {/* Magi-Orb VFX are a core ability readout, not optional decoration. */}
      <MagiOrbEffects />
      <Suspense fallback={null}>
        <StarFlowVFX visualEnabled={vfxEnabled} />
      </Suspense>
      <SimulationPresentationMarker />
      {visualSystemsReady && vfxEnabled && (
        <>
          <World1FireBackground />
          <ProjectileTrails />
          <Particles />
          <LaserBeams />
          <DistortField />
          <ScreenEffects />
        </>
      )}
    </>
  );
}

/** Records the boundary after simulation systems and before decorative effects. */
function SimulationPresentationMarker() {
  useFrame(() => {
    if (useMagicOrb.getState().phase === "playing") {
      gameRuntime.pipeline.enter("presentation");
    }
  });
  return null;
}