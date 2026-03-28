import { Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
import { useEffect, useRef } from "react";

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
  
  useEffect(() => {
    let animating = true;
    const animate = () => {
      if (!animating) return;
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
      
      requestAnimationFrame(animate);
    };
    animate();
    return () => { animating = false; };
  }, [camera]);
  
  return null;
}

export function GameScene() {
  return (
    <Canvas
      camera={{
        position: [0, 0, 10],
        fov: 60,
        near: 0.1,
        far: 100,
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
        <CameraController />
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
      </Suspense>
    </Canvas>
  );
}
