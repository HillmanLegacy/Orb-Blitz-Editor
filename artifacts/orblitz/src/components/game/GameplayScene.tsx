import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";

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

function GameRuntimeCoordinator() {
  useFrame((_, delta) => {
    runtimeDiagnostics.beginFrame();
    gameRuntime.clock.tick(delta);
  }, -2);

  useFrame(() => {
    runtimeDiagnostics.endFrame();
  }, 100);

  return null;
}

/** Heavy gameplay module, loaded only when a run enters its loading phase. */
export default function GameplayScene() {
  return (
    <>
      <GameRuntimeCoordinator />
      <PlayerLight />
      <World1FireBackground />
      <PlayerOrb />
      <DarkOrbs />
      <Boss />
      <Projectiles />
      <PowerUps />
      <Particles />
      <LaserBeams />
      <DistortField />
      <SubBlasterOrb />
      <DefenseOrbs />
      <MagiOrbEffects />
      <ScreenEffects />
      <StarFlowVFX />
      <GameLogic />
    </>
  );
}