import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, PowerUp, PowerUpType } from "@/lib/stores/useMagicOrb";

function PowerUpMesh({ powerUp, time }: { powerUp: PowerUp; time: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const collectProgress = powerUp.collected ? 1 - (powerUp.collectTimer || 0) / 0.4 : 0;
  const opacity = powerUp.collected ? 1 - collectProgress : 1;
  const bobY = Math.sin(time * 4) * 0.15;
  const floatRotation = Math.sin(time * 2) * 0.1;
  const pulseScale = 1 + Math.sin(time * 6) * 0.1;
  
  const getColors = (type: PowerUpType) => {
    switch (type) {
      case "chargeBeam":
        return { primary: "#ffdd00", secondary: "#ffffff", glow: "#ffaa00", bg: "#ff8800" };
      case "shield":
        return { primary: "#00ddff", secondary: "#ffffff", glow: "#0099ff", bg: "#0066cc" };
      case "healing":
        return { primary: "#00ff77", secondary: "#ffffff", glow: "#00cc55", bg: "#008833" };
      case "doubleCoins":
        return { primary: "#ffd700", secondary: "#ffee88", glow: "#ffcc00", bg: "#cc9900" };
      case "rapidFire":
        return { primary: "#ff4422", secondary: "#ffaa88", glow: "#ff6600", bg: "#cc2200" };
      default:
        return { primary: "#ffffff", secondary: "#dddddd", glow: "#aaaaaa", bg: "#666666" };
    }
  };
  
  const colors = getColors(powerUp.type);
  
  const renderIcon = () => {
    const scale = 1.8;
    
    switch (powerUp.type) {
      case "chargeBeam":
        return (
          <group scale={scale}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.5, 0.12]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.01]}>
              <planeGeometry args={[0.4, 0.06]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.15, 0.15, 0.02]} scale={0.08}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.22, 0.08, 0.02]} scale={0.05}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity * 0.8} />
            </mesh>
            <mesh position={[-0.1, -0.1, 0.02]} scale={0.04}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.6} />
            </mesh>
          </group>
        );
        
      case "shield":
        return (
          <group scale={scale}>
            <mesh>
              <ringGeometry args={[0.18, 0.28, 16]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.21, 0.25, 16]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.8} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.02]} scale={0.12}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
            </mesh>
          </group>
        );
        
      case "healing":
        return (
          <group scale={scale}>
            <mesh>
              <planeGeometry args={[0.4, 0.14]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <mesh>
              <planeGeometry args={[0.14, 0.4]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.32, 0.08]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.9} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.08, 0.32]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.9} />
            </mesh>
          </group>
        );
        
      case "doubleCoins":
        return (
          <group scale={scale}>
            <mesh>
              <circleGeometry args={[0.22, 16]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <circleGeometry args={[0.17, 16]} />
              <meshBasicMaterial color={colors.bg} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <circleGeometry args={[0.13, 16]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[0.04, 0.16]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0.05, 0.03]}>
              <planeGeometry args={[0.1, 0.04]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, -0.05, 0.03]}>
              <planeGeometry args={[0.1, 0.04]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
            </mesh>
          </group>
        );
        
      case "rapidFire":
        return (
          <group scale={scale}>
            {[-1, 0, 1].map((i) => (
              <group key={i} position={[i * 0.1, 0, 0]}>
                <mesh position={[0, 0.05, 0]}>
                  <planeGeometry args={[0.08, 0.3]} />
                  <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
                </mesh>
                <mesh position={[0, 0.05, 0.01]}>
                  <planeGeometry args={[0.04, 0.24]} />
                  <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.8} />
                </mesh>
                <mesh position={[0, 0.22, 0.02]} scale={0.04}>
                  <circleGeometry args={[1, 4]} />
                  <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
                </mesh>
              </group>
            ))}
          </group>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <group 
      ref={groupRef}
      position={[powerUp.position[0], powerUp.position[1] + bobY, powerUp.position[2]]}
      rotation={[0, 0, floatRotation]}
      scale={powerUp.collected ? 1 + collectProgress * 2 : pulseScale}
    >
      {/* Point light centred on the power-up, colour-matched to its glow */}
      {!powerUp.collected && (
        <pointLight
          color={colors.glow}
          intensity={2.5}
          distance={5}
          decay={2}
        />
      )}

      <mesh scale={1.2} position={[0, 0, -0.05]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color={colors.glow} transparent opacity={0.3 * opacity} />
      </mesh>
      
      <mesh scale={1.0} position={[0, 0, -0.04]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color={colors.glow} transparent opacity={0.5 * opacity} />
      </mesh>
      
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#111122" transparent opacity={0.9 * opacity} />
      </mesh>
      
      <mesh position={[0, 0, -0.01]}>
        <ringGeometry args={[0.4, 0.48, 24]} />
        <meshBasicMaterial color={colors.primary} transparent opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
      
      {renderIcon()}
      
      {powerUp.collected && (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = collectProgress * 1.5;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.1]}
                scale={0.1 * (1 - collectProgress)}
              >
                <circleGeometry args={[1, 6]} />
                <meshBasicMaterial color={i % 2 === 0 ? colors.primary : colors.secondary} transparent opacity={1 - collectProgress} />
              </mesh>
            );
          })}
        </>
      )}
    </group>
  );
}

export function PowerUps() {
  const powerUps = useMagicOrb((s) => s.powerUps);
  const updatePowerUps = useMagicOrb((s) => s.updatePowerUps);
  const phase = useMagicOrb((s) => s.phase);
  const clockRef = useRef(0);
  
  useFrame((state, delta) => {
    clockRef.current = state.clock.getElapsedTime();
    
    if (phase !== "playing") return;
    
    const currentPowerUps = useMagicOrb.getState().powerUps;
    if (currentPowerUps.length === 0) return;
    
    const updatedPowerUps: PowerUp[] = [];
    
    for (const powerUp of currentPowerUps) {
      if (powerUp.collected) {
        const newTimer = (powerUp.collectTimer || 0) - delta;
        if (newTimer <= 0) {
          continue;
        }
        updatedPowerUps.push({ ...powerUp, collectTimer: newTimer });
        continue;
      }
      
      let [x, y, z] = powerUp.position;
      const [vx, vy, vz] = powerUp.velocity;
      
      x += vx * delta;
      y += vy * delta;
      z += vz * delta;
      
      if (Math.abs(x) > 15 || Math.abs(y) > 10) {
        continue;
      }
      
      updatedPowerUps.push({
        ...powerUp,
        position: [x, y, z],
      });
    }
    
    updatePowerUps(updatedPowerUps);
  });
  
  return (
    <>
      {powerUps.map((powerUp) => (
        <PowerUpMesh key={powerUp.id} powerUp={powerUp} time={clockRef.current} />
      ))}
    </>
  );
}
