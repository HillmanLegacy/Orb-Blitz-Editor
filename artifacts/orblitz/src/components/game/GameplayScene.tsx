import { useEffect, useRef, useState } from "react";
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
    gameRuntime.clock.tick(delta);
  }, -2);

  useFrame(() => {
    if (phase !== "playing") return;
    runtimeDiagnostics.endFrame(gl);
  }, 100);

  return null;
}

/** Gameplay module; core systems mount before optional visual systems. */
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
      {visualSystemsReady && vfxEnabled && (
        <>
          <World1FireBackground />
          <ProjectileTrails />
          <PowerUps />
          <Particles />
          <LaserBeams />
          <DistortField />
          <SubBlasterOrb />
          <DefenseOrbs />
          <MagiOrbEffects />
          <ScreenEffects />
          <StarFlowVFX />
        </>
      )}
    </>
  );
}