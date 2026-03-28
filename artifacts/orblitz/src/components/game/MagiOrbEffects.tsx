import { useRef, useMemo, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";

const sharedCircleGeo = new THREE.CircleGeometry(1, 32);
const sharedRingGeo = new THREE.RingGeometry(0.85, 1, 32);

export function MagiOrbEffects() {
  const { equippedMagiOrb } = useShop();
  const {
    playerPosition,
    magiOrb2Active,
    magiOrb4Active,
    magiOrb4Direction,
    magiOrb5HP,
    magiOrb5MaxHP,
    magiOrb8Position,
    magiOrb8HP,
    pulseShieldActive,
    pulseShieldTimer,
  } = useMagicOrb();

  const barrierRef = useRef<THREE.Group>(null);
  const cubeGroupRef = useRef<THREE.Group>(null);
  const alliedOrbRef = useRef<THREE.Group>(null);

  const hasMagiOrb4 = equippedMagiOrb === "magi_orb_4";
  const hasMagiOrb5 = equippedMagiOrb === "magi_orb_5";
  const hasMagiOrb8 = equippedMagiOrb === "magi_orb_8";

  const barrierArcPoints = useMemo(() => {
    const points: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const angle = (i / 48) * Math.PI / 2;
      points.push([Math.cos(angle) * 3.5, Math.sin(angle) * 3.5]);
    }
    return points;
  }, []);

  const cubeParticles = useMemo(() => 
    Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.3,
      offset: Math.random() * Math.PI * 2,
      size: 0.08 + Math.random() * 0.04,
    })), []
  );

  const alliedOrbParticles = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.4,
      offset: Math.random() * Math.PI * 2,
    })), []
  );

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (barrierRef.current && magiOrb4Active) {
      barrierRef.current.rotation.z = magiOrb4Direction;
      barrierRef.current.position.set(playerPosition[0], playerPosition[1], 0.1);
    }

    if (cubeGroupRef.current && hasMagiOrb5 && magiOrb5HP > 0) {
      cubeGroupRef.current.rotation.z = time * 0.3;
      cubeGroupRef.current.position.set(playerPosition[0], playerPosition[1], 0);
      const healthRatio = magiOrb5HP / magiOrb5MaxHP;
      cubeGroupRef.current.scale.setScalar(0.9 + healthRatio * 0.3);
    }

    if (alliedOrbRef.current && magiOrb8Position && magiOrb8HP > 0) {
      alliedOrbRef.current.position.set(magiOrb8Position[0], magiOrb8Position[1], 0);
    }
  });

  return (
    <>
      {/* Magi-Orb 4: HD Barrier Shield */}
      {hasMagiOrb4 && magiOrb4Active && (
        <group ref={barrierRef} position={[playerPosition[0], playerPosition[1], 0.1]}>
          {/* Main barrier fill with gradient layers */}
          {[0, 1, 2].map((layer) => (
            <mesh key={`barrier-layer-${layer}`} position={[0, 0, layer * 0.01]}>
              <shapeGeometry args={[(() => {
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                barrierArcPoints.forEach((p, i) => {
                  const radius = 3.5 - layer * 0.3;
                  const scale = radius / 3.5;
                  if (i === 0) shape.lineTo(p[0] * scale, p[1] * scale);
                  else shape.lineTo(p[0] * scale, p[1] * scale);
                });
                shape.lineTo(0, 0);
                return shape;
              })()]} />
              <meshBasicMaterial
                color={layer === 0 ? "#ff6600" : layer === 1 ? "#ff8800" : "#ffaa00"}
                transparent
                opacity={(0.5 - layer * 0.12)}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          
          {/* Outer glow arc */}
          {barrierArcPoints.map((point, i) => {
            if (i % 4 !== 0) return null;
            return (
              <mesh key={`arc-glow-${i}`} position={[point[0], point[1], 0.02]} scale={0.12}>
                <circleGeometry args={[1, 12]} />
                <meshBasicMaterial color="#ffcc00" transparent opacity={0.7} />
              </mesh>
            );
          })}
          
          {/* Energy particles along arc */}
          {barrierArcPoints.filter((_, i) => i % 6 === 0).map((point, i) => (
            <mesh key={`arc-particle-${i}`} position={[point[0] * 0.95, point[1] * 0.95, 0.03]} scale={0.06}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
            </mesh>
          ))}
          
          {/* Inner edge glow line */}
          {barrierArcPoints.map((point, i) => {
            if (i % 2 !== 0) return null;
            return (
              <mesh key={`inner-line-${i}`} position={[point[0] * 0.85, point[1] * 0.85, 0.01]} scale={0.04}>
                <circleGeometry args={[1, 6]} />
                <meshBasicMaterial color="#ffff88" transparent opacity={0.6} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Magi-Orb 5: HD Protective Cube */}
      {hasMagiOrb5 && magiOrb5HP > 0 && (
        <group ref={cubeGroupRef} position={[playerPosition[0], playerPosition[1], 0]}>
          {/* Outer hexagonal shield layers */}
          {[0, 1, 2].map((layer) => {
            const healthRatio = magiOrb5HP / magiOrb5MaxHP;
            return (
              <mesh key={`cube-layer-${layer}`} rotation={[0, 0, layer * Math.PI / 6]} scale={1.8 - layer * 0.25}>
                <ringGeometry args={[0.85, 1, 6]} />
                <meshBasicMaterial
                  color={layer === 0 ? "#00ffff" : layer === 1 ? "#00ccff" : "#0088ff"}
                  transparent
                  opacity={(0.5 + healthRatio * 0.3) * (1 - layer * 0.2)}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
          
          {/* Central core */}
          <mesh scale={0.6}>
            <circleGeometry args={[1, 6]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.4} />
          </mesh>
          
          {/* Inner glow */}
          <mesh scale={0.4}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#88ffff" transparent opacity={0.6} />
          </mesh>
          
          {/* Corner particles */}
          {cubeParticles.map((particle, i) => (
            <mesh 
              key={`cube-particle-${i}`} 
              position={[Math.cos(particle.angle) * 1.6, Math.sin(particle.angle) * 1.6, 0.01]}
              scale={particle.size}
            >
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
          ))}
          
          {/* HP indicator segments */}
          {Array.from({ length: magiOrb5MaxHP }).map((_, i) => {
            const segmentAngle = (i / magiOrb5MaxHP) * Math.PI * 2 - Math.PI / 2;
            const isActive = i < magiOrb5HP;
            return (
              <mesh 
                key={`hp-${i}`} 
                position={[Math.cos(segmentAngle) * 2.1, Math.sin(segmentAngle) * 2.1, 0.02]}
                scale={0.15}
              >
                <circleGeometry args={[1, 8]} />
                <meshBasicMaterial 
                  color={isActive ? "#00ff88" : "#333333"} 
                  transparent 
                  opacity={isActive ? 0.9 : 0.4} 
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Magi-Orb 8: HD Allied Orb */}
      {hasMagiOrb8 && magiOrb8Position && magiOrb8HP > 0 && (
        <group ref={alliedOrbRef} position={[magiOrb8Position[0], magiOrb8Position[1], 0]}>
          {/* Outer glow layers */}
          <mesh scale={0.7}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.15} />
          </mesh>
          <mesh scale={0.55}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#44ff44" transparent opacity={0.25} />
          </mesh>
          
          {/* Black outline */}
          <mesh scale={0.42} position={[0, 0, 0.01]}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          
          {/* Main core */}
          <mesh scale={0.35} position={[0, 0, 0.02]}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#88ff88" />
          </mesh>
          
          {/* Inner bright core */}
          <mesh scale={0.2} position={[0, 0, 0.03]}>
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color="#aaffaa" transparent opacity={0.9} />
          </mesh>
          
          {/* Highlight */}
          <mesh scale={0.1} position={[-0.08, 0.08, 0.04]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
          
          {/* Orbiting particles */}
          {alliedOrbParticles.map((particle, i) => (
            <mesh 
              key={`ally-particle-${i}`} 
              position={[Math.cos(particle.angle) * 0.5, Math.sin(particle.angle) * 0.5, 0.02]}
              scale={0.04}
            >
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color="#ccffcc" transparent opacity={0.8} />
            </mesh>
          ))}
          
          {/* HP indicators */}
          {Array.from({ length: 3 }).map((_, i) => {
            const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const isActive = i < magiOrb8HP;
            return (
              <mesh 
                key={`ally-hp-${i}`} 
                position={[Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0.03]}
                scale={0.06}
              >
                <circleGeometry args={[1, 8]} />
                <meshBasicMaterial 
                  color={isActive ? "#00ff88" : "#444444"} 
                  transparent 
                  opacity={isActive ? 0.9 : 0.5} 
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Pulse Shield Visual Effect */}
      {pulseShieldActive && (
        <group position={[playerPosition[0], playerPosition[1], 0.2]}>
          {/* Main expanding ring */}
          {[0, 1, 2].map((i) => {
            const progress = 1 - pulseShieldTimer / 0.5;
            const scale = 7 * (0.3 + progress * 0.7) - i * 0.5;
            const opacity = (1 - progress) * (0.8 - i * 0.2);
            return (
              <mesh key={`pulse-ring-${i}`} scale={scale} position={[0, 0, -i * 0.01]}>
                <ringGeometry args={[0.9, 1, 32]} />
                <meshBasicMaterial 
                  color={i === 0 ? "#00ffff" : i === 1 ? "#0088ff" : "#ffffff"} 
                  transparent 
                  opacity={opacity} 
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
          {/* Center flash */}
          <mesh scale={7 * (1 - pulseShieldTimer / 0.5) * 0.3}>
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial 
              color="#ffffff" 
              transparent 
              opacity={(pulseShieldTimer / 0.5) * 0.4} 
            />
          </mesh>
          {/* Outer glow */}
          <mesh scale={7 * 1.1}>
            <ringGeometry args={[0.95, 1.05, 32]} />
            <meshBasicMaterial 
              color="#00ccff" 
              transparent 
              opacity={(pulseShieldTimer / 0.5) * 0.3} 
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
    </>
  );
}
