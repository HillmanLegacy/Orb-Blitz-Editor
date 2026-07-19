import { useRef, useMemo, memo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, DarkOrb, Particle, BossType } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { DarkOrbModel } from "./DarkOrbModel";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";
import { MiniFireOrb } from "./MiniFireOrb";
import { MiniStarOrb } from "./MiniStarOrb";
import { MiniCrystalOrb } from "./MiniCrystalOrb";
import { MiniToxicOrb } from "./MiniToxicOrb";
import { MiniPlasmaOrb } from "./MiniPlasmaOrb";
import { MiniDiamondOrb } from "./MiniDiamondOrb";
import { MiniRainbowOrb } from "./MiniRainbowOrb";
import { MiniMechaOrb } from "./MiniMechaOrb";
import { addExplosionImpulse } from "./Background";

const DISTORT_FIELD_RADIUS  = 5;
const HURT_FLASH_DURATION   = 0.15;


const BOSS_ORB_COLORS: Record<BossType, { primary: string; secondary: string; glow: string }> = {
  circle: { primary: "#6a2a8a", secondary: "#aa44cc", glow: "#8844aa" },
  star: { primary: "#2a4a8a", secondary: "#6699ff", glow: "#4488ff" },
  arrow: { primary: "#8a5a2a", secondary: "#ff6622", glow: "#ff8844" },
  triangle: { primary: "#2a6a4a", secondary: "#33cc66", glow: "#44ff88" },
  trapezoid: { primary: "#8a2a4a", secondary: "#cc4488", glow: "#ff4488" },
  cube: { primary: "#4a4a8a", secondary: "#6666cc", glow: "#8888ff" },
  cloud: { primary: "#5a5a6a", secondary: "#8899aa", glow: "#aaaacc" },
  tentacle: { primary: "#2a6a6a", secondary: "#44ccaa", glow: "#44ffcc" },
  monster: { primary: "#6a2a2a", secondary: "#ff4444", glow: "#ff4444" },
  bird: { primary: "#4a6a2a", secondary: "#88cc44", glow: "#aaff44" },
};


// ── HD red hurt-flash overlay — mounted on fire orbs when hurtTimer > 0 ────────
function FireHurtFlash({ hurtTimer }: { hurtTimer: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const frac = Math.max(0, hurtTimer / HURT_FLASH_DURATION);
    const osc  = Math.abs(Math.sin(state.clock.elapsedTime * 50));
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = frac * osc * 0.88;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.08, 16, 12]} />
      <meshBasicMaterial
        color="#ff1100"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function BossOrbMesh({ orb, time }: { orb: DarkOrb; time: number }) {
  const bossType = orb.bossType || "circle";
  const colors = BOSS_ORB_COLORS[bossType] || BOSS_ORB_COLORS.circle;
  const destroyProgress = orb.destroying ? 1 - (orb.destroyTimer || 0) / 0.6 : 0;
  const opacity = orb.destroying ? 1 - destroyProgress : 1;
  const pulse = 1 + Math.sin(time * 6) * 0.1;
  const spin = time * 3;
  
  if (orb.destroying) {
    // Circle boss type = MiniFireOrb — uses the same fire explosion as world 1 enemies
    const isFireOrb = bossType === "circle";
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX
          progress={destroyProgress}
          color={isFireOrb ? "#ff4400" : colors.primary}
          glowColor={isFireOrb ? "#ffaa00" : colors.glow}
          scale={orb.size}
          seed={Math.round(orb.seed * 1000)}
        />
      </group>
    );
  }

  // ── Circle boss type: MiniFireOrb (identical look to Fire Boss) ──────────────
  if (bossType === "circle") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <pointLight color="#ff6600" intensity={2} distance={5} decay={2} />
        <MiniFireOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Star boss type: MiniStarOrb ───────────────────────────────────────────────
  if (bossType === "star") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <MiniStarOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Crystal boss type: MiniCrystalOrb ────────────────────────────────────────
  if (bossType === "triangle") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <MiniCrystalOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Rainbow boss type: MiniRainbowOrb (level 7.9) ───────────────────────────
  if (bossType === "arrow") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <MiniRainbowOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Diamond boss type: MiniDiamondOrb (level 6.9) ───────────────────────────
  if (bossType === "cloud") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <MiniDiamondOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Plasma boss type: MiniPlasmaOrb (level 5.9) ──────────────────────────────
  if (bossType === "cube") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <MiniPlasmaOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Mecha boss type: MiniMechaOrb (level 8.9) ───────────────────────────────
  if (bossType === "tentacle") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <pointLight color="#33aaff" intensity={1.8} distance={5} decay={2} />
        <MiniMechaOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  // ── Toxic boss type: MiniToxicOrb (level 4.9) ────────────────────────────────
  if (bossType === "trapezoid") {
    return (
      <group position={orb.position} scale={orb.size * pulse}>
        <MiniToxicOrb />
        {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
      </group>
    );
  }

  const renderShape = () => {
    switch (bossType) {
      case "star":
        return (
          <>
            {[0, 1, 2, 3, 4].map((i) => {
              const angle = (i / 5) * Math.PI * 2 - Math.PI / 2 + spin * 0.5;
              return (
                <mesh key={i} position={[Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, 0.01]} scale={0.2} rotation={[0, 0, angle]}>
                  <circleGeometry args={[1, 4]} />
                  <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.9} />
                </mesh>
              );
            })}
          </>
        );
      case "arrow":
        return (
          <mesh position={[0.3, 0, 0.01]} rotation={[0, 0, 0]} scale={[0.3, 0.2, 1]}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.9} />
          </mesh>
        );
      case "triangle":
        return (
          <mesh scale={0.6} rotation={[0, 0, spin * 0.3]}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.7} />
          </mesh>
        );
      case "cube":
        return (
          <mesh scale={0.5} rotation={[0, 0, spin * 0.2]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.8} />
          </mesh>
        );
      case "cloud":
        return (
          <>
            <mesh position={[-0.2, 0.1, 0.01]} scale={0.3}>
              <circleGeometry args={[1, 12]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.6} />
            </mesh>
            <mesh position={[0.2, 0.1, 0.01]} scale={0.25}>
              <circleGeometry args={[1, 12]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.5} />
            </mesh>
          </>
        );
      case "tentacle":
        return (
          <>
            {[0, 1, 2, 3].map((i) => {
              const angle = (i / 4) * Math.PI * 2 + spin;
              const wave = Math.sin(time * 5 + i) * 0.2;
              return (
                <mesh key={i} position={[Math.cos(angle) * (0.4 + wave), Math.sin(angle) * (0.4 + wave), 0.01]} rotation={[0, 0, angle]} scale={[0.08, 0.25, 1]}>
                  <circleGeometry args={[1, 4]} />
                  <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.8} />
                </mesh>
              );
            })}
          </>
        );
      case "monster":
        return (
          <>
            <mesh position={[-0.25, 0.2, 0.01]} rotation={[0, 0, 0.3]} scale={[0.08, 0.2, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.25, 0.2, 0.01]} rotation={[0, 0, -0.3]} scale={[0.08, 0.2, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, -0.2, 0.01]} scale={[0.25, 0.08, 1]}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color="#220000" transparent opacity={opacity * 0.9} />
            </mesh>
          </>
        );
      case "trapezoid":
        return (
          <mesh scale={[0.6, 0.4, 1]} position={[0, -0.1, 0.01]}>
            <circleGeometry args={[1, 4]} />
            <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.7} />
          </mesh>
        );
      default:
        return (
          <mesh scale={0.4} position={[0, 0, 0.01]}>
            <ringGeometry args={[0.5, 0.8, 12]} />
            <meshBasicMaterial color={colors.secondary} transparent opacity={opacity * 0.6} side={THREE.DoubleSide} />
          </mesh>
        );
    }
  };
  
  return (
    <group position={orb.position} scale={orb.size * pulse}>
      {/* Point light colour-matched to this boss-orb type */}
      <pointLight color={colors.glow} intensity={1.8} distance={5} decay={2} />
      <mesh scale={1.1} position={[0, 0, -0.01]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#0a0a0a" transparent opacity={opacity * 0.95} />
      </mesh>
      <mesh scale={1}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color={colors.primary} transparent opacity={opacity} />
      </mesh>
      {renderShape()}
      <mesh position={[-0.2, 0.1, 0.02]} scale={0.12}>
        <circleGeometry args={[1, 8]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={opacity * 0.8} />
      </mesh>
      <mesh position={[0.2, 0.1, 0.02]} scale={0.12}>
        <circleGeometry args={[1, 8]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={opacity * 0.8} />
      </mesh>
    </group>
  );
}

function UnifiedDarkOrbMesh({ orb, time }: { orb: DarkOrb; time: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const eyeData = useMemo(() => ({
    count: 1 + Math.floor(orb.seed * 2),
    positions: Array.from({ length: 3 }, (_, i) => ({
      x: (orb.seed * 100 + i * 37) % 1 * 0.4 - 0.2,
      y: (orb.seed * 200 + i * 53) % 1 * 0.3 + 0.05,
      size: 0.08 + ((orb.seed * 300 + i * 71) % 1) * 0.06,
      blinkOffset: (orb.seed * 400 + i * 91) % 1 * Math.PI * 2,
    }))
  }), [orb.seed]);
  
  const monsterFeatures = useMemo(() => {
    const featureType = Math.floor(orb.seed * 6);
    return {
      type: featureType,
      hornCount: 2 + Math.floor((orb.seed * 100) % 3),
      teethCount: 3 + Math.floor((orb.seed * 200) % 4),
      tentacleCount: 4 + Math.floor((orb.seed * 300) % 4),
      spineCount: 5 + Math.floor((orb.seed * 400) % 4),
    };
  }, [orb.seed]);
  
  const destroyProgress = orb.destroying ? 1 - (orb.destroyTimer || 0) / 0.6 : 0;
  const frozenTint = orb.frozen;
  
  const position = orb.position || [0, 0, 0];
  const [x, y] = position;
  const distFromCenter = Math.sqrt(x * x + y * y);
  const approachIntensity = Math.max(0, 1 - distFromCenter / 12);
  
  const pulseScale = 1 + Math.sin(time * (3 + approachIntensity * 3)) * 0.06;
  const breathe = 1 + Math.sin(time * 2 + orb.seed * 10) * 0.04;
  const wobble = Math.sin(time * 1.5 + orb.seed * 5) * 0.05;
  
  
  const opacity = orb.destroying ? 1 - destroyProgress : 1;
  
  const renderMonsterShape = () => {
    const { type, hornCount, teethCount, tentacleCount, spineCount } = monsterFeatures;
    
    switch (type) {
      case 0:
        return (
          <>
            {Array.from({ length: hornCount }).map((_, i) => {
              const angle = (i / hornCount) * Math.PI - Math.PI / 2;
              const hornWave = Math.sin(time * 2 + i) * 0.1;
              return (
                <group key={`horn-${i}`} position={[Math.cos(angle) * 0.35, Math.sin(angle) * 0.35 + 0.2, 0.01]} rotation={[0, 0, angle + Math.PI / 2 + hornWave]}>
                  <mesh scale={[0.06, 0.25, 1]}>
                    <circleGeometry args={[1, 3]} />
                    <meshBasicMaterial color="#660055" transparent opacity={opacity * 0.95} />
                  </mesh>
                  <mesh scale={[0.04, 0.22, 1]} position={[0, 0, 0.01]}>
                    <circleGeometry args={[1, 3]} />
                    <meshBasicMaterial color={frozenTint ? "#3366aa" : "#aa00aa"} transparent opacity={opacity * 0.9} />
                  </mesh>
                </group>
              );
            })}
          </>
        );
        
      case 1:
        return (
          <group position={[0, -0.35, 0.01]}>
            {Array.from({ length: teethCount }).map((_, i) => {
              const xPos = (i - (teethCount - 1) / 2) * 0.12;
              const teethPulse = Math.sin(time * 5 + i) * 0.02;
              return (
                <mesh key={`tooth-${i}`} position={[xPos, teethPulse, 0]} scale={[0.05, 0.1 + Math.sin(i) * 0.03, 1]}>
                  <circleGeometry args={[1, 3]} />
                  <meshBasicMaterial color="#cccccc" transparent opacity={opacity * 0.95} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 2:
        return (
          <>
            {Array.from({ length: tentacleCount }).map((_, i) => {
              const angle = (i / tentacleCount) * Math.PI * 2 + time * 0.5;
              const wave = Math.sin(time * 3 + i * 0.8) * 0.15;
              const dist = 0.45 + wave * 0.2;
              return (
                <group key={`tent-${i}`}>
                  <mesh position={[Math.cos(angle) * dist, Math.sin(angle) * dist, -0.01]} rotation={[0, 0, angle]} scale={[0.08, 0.35 + wave * 0.1, 1]}>
                    <circleGeometry args={[1, 4]} />
                    <meshBasicMaterial color="#330044" transparent opacity={opacity * 0.85} />
                  </mesh>
                  <mesh position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0]} rotation={[0, 0, angle]} scale={[0.05, 0.3 + wave * 0.08, 1]}>
                    <circleGeometry args={[1, 4]} />
                    <meshBasicMaterial color={frozenTint ? "#446688" : "#7700aa"} transparent opacity={opacity * 0.9} />
                  </mesh>
                </group>
              );
            })}
          </>
        );
        
      case 3:
        return (
          <>
            {Array.from({ length: spineCount }).map((_, i) => {
              const angle = (i / spineCount) * Math.PI * 2;
              const spineWave = Math.sin(time * 4 + i * 1.2) * 0.08;
              return (
                <mesh key={`spine-${i}`} position={[Math.cos(angle) * (0.5 + spineWave), Math.sin(angle) * (0.5 + spineWave), 0.01]} rotation={[0, 0, angle]} scale={[0.03, 0.15, 1]}>
                  <circleGeometry args={[1, 3]} />
                  <meshBasicMaterial color="#8800bb" transparent opacity={opacity * 0.9} />
                </mesh>
              );
            })}
          </>
        );
        
      case 4:
        const earAngle = Math.sin(time * 2) * 0.15;
        return (
          <>
            <mesh position={[-0.35, 0.25, 0.01]} rotation={[0, 0, 0.4 + earAngle]} scale={[0.12, 0.2, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#1a0a1a" transparent opacity={opacity * 0.95} />
            </mesh>
            <mesh position={[0.35, 0.25, 0.01]} rotation={[0, 0, -0.4 - earAngle]} scale={[0.12, 0.2, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#1a0a1a" transparent opacity={opacity * 0.95} />
            </mesh>
          </>
        );
        
      case 5:
      default:
        return (
          <>
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = (i / 6) * Math.PI * 2 + time * 0.8;
              const flameWave = 0.4 + Math.sin(time * 8 + i * 1.5) * 0.15;
              return (
                <mesh key={`flame-${i}`} position={[Math.cos(angle) * flameWave, Math.sin(angle) * flameWave, -0.02]} scale={0.08 + Math.sin(time * 6 + i) * 0.02}>
                  <circleGeometry args={[1, 5]} />
                  <meshBasicMaterial color={frozenTint ? "#6688aa" : "#bb00cc"} transparent opacity={opacity * (0.55 + Math.sin(time * 5 + i) * 0.25)} />
                </mesh>
              );
            })}
          </>
        );
    }
  };
  
  const renderEyes = () => {
    const eyesToRender = eyeData.positions.slice(0, eyeData.count);
    return eyesToRender.map((eye, i) => {
      const blinkPhase = Math.sin(time * 0.5 + eye.blinkOffset);
      const isBlinking = blinkPhase > 0.95;
      const eyeScale = isBlinking ? eye.size * 0.2 : eye.size;
      const pupilLook = Math.sin(time * 0.8 + i) * 0.02;
      
      return (
        <group key={`eye-${i}`} position={[eye.x, eye.y, 0.02]}>
          <mesh scale={eyeScale * 1.3}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color="#000000" transparent opacity={opacity} />
          </mesh>
          <mesh scale={eyeScale} position={[0, 0, 0.01]}>
            <circleGeometry args={[1, 8]} />
            <meshBasicMaterial color={frozenTint ? "#4488cc" : "#aa0000"} transparent opacity={opacity} />
          </mesh>
          <mesh scale={eyeScale * 0.5} position={[pupilLook, 0, 0.02]}>
            <circleGeometry args={[1, 6]} />
            <meshBasicMaterial color={frozenTint ? "#88ccff" : "#ff2222"} transparent opacity={opacity * 0.9} />
          </mesh>
          <mesh scale={eyeScale * 0.2} position={[pupilLook + 0.01, 0.01, 0.03]}>
            <circleGeometry args={[1, 4]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.8} />
          </mesh>
        </group>
      );
    });
  };
  
  const getBossDeathColors = (bossType: string): string[] => {
    const bossColors = BOSS_ORB_COLORS[bossType as BossType] || BOSS_ORB_COLORS.circle;
    return [bossColors.glow, bossColors.primary, bossColors.secondary, bossColors.glow, bossColors.primary];
  };
  
  const deathVariation = useMemo(() => {
    const seed = orb.seed;
    const randomSeed = seed * 12345.6789;
    const particleCount = 14 + Math.floor((randomSeed % 1) * 10);
    const rotationOffset = ((randomSeed * 7) % 1) * Math.PI * 2;
    const speedVariation = 0.5 + ((randomSeed * 11) % 1) * 1.0;
    const sizeVariation = 0.6 + ((randomSeed * 13) % 1) * 0.8;
    const explosionStyle = Math.floor((randomSeed * 17) % 4);
    const defaultColors = ["#660033", "#440022", "#880044", "#ff00ff", "#aa0066", "#ffaaff"];
    const shimmerColors = ["#ffffff", "#ffccff", "#ccffff", "#ffffcc"];
    const colors = orb.bossDefeatColor ? getBossDeathColors(orb.bossDefeatColor) : defaultColors;
    return {
      particleCount,
      rotationOffset,
      speedVariation,
      sizeVariation,
      explosionStyle,
      colors,
      shimmerColors,
      particles: Array.from({ length: particleCount }, (_, i) => {
        const particleSeed = (randomSeed * (i + 1) * 31.41592) % 1;
        const angleSeed = (randomSeed * (i + 1) * 47.12389) % 1;
        const distSeed = (randomSeed * (i + 1) * 61.80339) % 1;
        const sizeSeed = (randomSeed * (i + 1) * 73.09017) % 1;
        const delaySeed = (randomSeed * (i + 1) * 89.44271) % 1;
        const spinDirection = particleSeed > 0.5 ? 1 : -1;
        const spiralAmount = explosionStyle === 0 ? 0 : (explosionStyle === 1 ? 0.5 : explosionStyle === 2 ? 1.2 : 0.3);
        return {
          angleOffset: (angleSeed - 0.5) * 0.8,
          distVariation: 0.4 + distSeed * 1.2,
          sizeScale: 0.4 + sizeSeed * 1.0,
          color: colors[Math.floor(particleSeed * colors.length)],
          shimmerColor: shimmerColors[Math.floor(delaySeed * shimmerColors.length)],
          delay: delaySeed * 0.2,
          spinSpeed: 2 + particleSeed * 8,
          spinDirection,
          spiralAmount,
          wobbleFreq: 3 + angleSeed * 5,
          wobbleAmp: 0.1 + distSeed * 0.3,
          trailLength: 0.3 + sizeSeed * 0.5,
          isShimmer: particleSeed > 0.7,
        };
      }),
      sparkles: Array.from({ length: 8 + Math.floor((randomSeed * 23) % 6) }, (_, i) => ({
        angle: ((randomSeed * (i + 1) * 97) % 1) * Math.PI * 2,
        speed: 0.8 + ((randomSeed * (i + 1) * 103) % 1) * 1.5,
        size: 0.03 + ((randomSeed * (i + 1) * 109) % 1) * 0.08,
        delay: ((randomSeed * (i + 1) * 127) % 1) * 0.3,
        twinkleSpeed: 8 + ((randomSeed * (i + 1) * 131) % 1) * 12,
      })),
    };
  }, [orb.seed, orb.bossDefeatColor]);

  if (orb.destroying) {
    const deathColor = orb.bossDefeatColor
      ? deathVariation.colors[0]
      : "#8800cc";
    const deathGlow = orb.bossDefeatColor
      ? deathVariation.colors[1]
      : "#440066";
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX
          progress={destroyProgress}
          color={deathColor}
          glowColor={deathGlow}
          scale={orb.size}
          seed={Math.round(orb.seed * 999)}
        />
      </group>
    );
  }
  
  return (
    <group ref={groupRef} position={orb.position} scale={orb.size * pulseScale * breathe} rotation={[0, 0, wobble]}>
      {/* DarkOrbModel already contains its own pointLight — no duplicate here */}

      {/* 3D FBX model body with volumetric shadow glow + animated tendrils */}
      <Suspense fallback={
        <mesh scale={1}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color={frozenTint ? "#224466" : "#0a0011"} transparent opacity={opacity} />
        </mesh>
      }>
        <DarkOrbModel frozen={!!frozenTint} opacity={opacity} />
      </Suspense>

      {renderMonsterShape()}

      {renderEyes()}
    </group>
  );
}

// ── World 1 enemy: miniature Fire Boss — own component so hooks are stable ────
function World1EnemyMesh({ orb, time }: { orb: DarkOrb; time: number }) {
  // Reversed: animation plays from 1→0 (converging inward) instead of 0→1 (exploding out)
  const destroyProgress = orb.destroying ? (orb.destroyTimer || 0) / 0.6 : 0;
  const pulse = 1 + Math.sin(time * 4 + orb.seed * 6) * 0.06;

  if (orb.destroying) {
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX
          progress={destroyProgress}
          color="#ff4400"
          glowColor="#ffaa00"
          scale={orb.size}
          seed={Math.round(orb.seed * 999)}
        />
        {/* Keep orb visible until the crush flash (progress 0.80) covers it */}
        {destroyProgress > 0.80 && (
          <group scale={orb.size * pulse}>
            <MiniFireOrb />
          </group>
        )}
      </group>
    );
  }

  return (
    <group position={orb.position} scale={orb.size * pulse}>
      <pointLight color="#ff6600" intensity={1.6} distance={4.5} decay={2} />
      <MiniFireOrb />
      {(orb.hurtTimer || 0) > 0 && <FireHurtFlash hurtTimer={orb.hurtTimer || 0} />}
    </group>
  );
}

// ── Router: no hooks — purely selects which mesh component to render ──────────
function OrbRouter({ orb, time }: { orb: DarkOrb; time: number }) {
  if (orb.isBossOrb) return <BossOrbMesh orb={orb} time={time} />;

  const { arcadeLevel, gameMode } = useMagicOrb.getState();
  if (gameMode === "arcade" && Math.floor(arcadeLevel) === 1) {
    return <World1EnemyMesh orb={orb} time={time} />;
  }

  return <UnifiedDarkOrbMesh orb={orb} time={time} />;
}

const MemoizedDarkOrbMesh = memo(OrbRouter);

export function DarkOrbs() {
  const { equippedSkin } = useShop();
  const darkOrbs = useMagicOrb((s) => s.darkOrbs);
  const clockRef = useRef(0);
  
  useFrame((state, delta) => {
    clockRef.current = state.clock.getElapsedTime();
    
    const {
      darkOrbs,
      updateDarkOrbs,
      projectiles,
      boss,
      playerPosition,
      hasShield,
      takeDamage,
      consumeShield,
      addImpactEffect,
      distortActive,
      arcadeLevel,
      orbsDestroyedInLevel,
      orbsRequiredForLevel,
      completeLevel,
      addScore,
      gameMode,
      phase,
      magiOrb4Active,
      magiOrb4Direction,
    } = useMagicOrb.getState();
    
    if (phase !== "playing") return;
    if (darkOrbs.length === 0) return;
    
    const updatedOrbs: DarkOrb[] = [];
    const playerX = playerPosition[0];
    const playerY = playerPosition[1];
    
    for (const orb of darkOrbs) {
      if (orb.destroying) {
        const newTimer = (orb.destroyTimer || 0) - delta;
        if (newTimer <= 0) {
          // Trigger background particle blast at the orb's death position
          if (orb.position) {
            addExplosionImpulse(orb.position[0], orb.position[1], 10);
          }
          continue;
        }
        updatedOrbs.push({ ...orb, destroyTimer: newTimer });
        continue;
      }
      
      if (orb.frozen && distortActive) {
        updatedOrbs.push(orb);
        continue;
      }
      
      if (!orb.position || !orb.direction) {
        continue;
      }
      
      let [x, y, z] = orb.position;
      let [dx, dy, dz] = orb.direction;
      const phase = orb.patternPhase || 0;
      const speed = orb.frozen ? orb.speed * 0.1 : orb.speed;
      
      const toPX = playerX - x;
      const toPY = playerY - y;
      const distToP = Math.sqrt(toPX * toPX + toPY * toPY);
      if (distToP > 0.1) {
        dx = toPX / distToP;
        dy = toPY / distToP;
      }
      
      switch (orb.pattern) {
        case "zigzag": {
          const zigzag = Math.sin(clockRef.current * 4 + phase) * 2;
          x += dx * speed * delta;
          y += dy * speed * delta + zigzag * delta;
          break;
        }
        case "spiral": {
          const spiralAngle = clockRef.current * 2 + phase;
          const spiralRadius = 0.5;
          x += (dx * speed + Math.cos(spiralAngle) * spiralRadius) * delta;
          y += (dy * speed + Math.sin(spiralAngle) * spiralRadius) * delta;
          break;
        }
        case "wave": {
          x += dx * speed * delta;
          y += dy * speed * delta + Math.sin(clockRef.current * 3 + phase) * delta * 1.5;
          break;
        }
        case "orbit": {
          const orbitAngle = clockRef.current * 1.5 + phase;
          const orbitDist = Math.sqrt(x * x + y * y);
          const targetAngle = Math.atan2(-y, -x) + 0.3;
          x += Math.cos(targetAngle) * speed * delta + Math.cos(orbitAngle) * 0.3 * delta;
          y += Math.sin(targetAngle) * speed * delta + Math.sin(orbitAngle) * 0.3 * delta;
          break;
        }
        case "homing": {
          x += dx * speed * delta;
          y += dy * speed * delta;
          break;
        }
        case "sine_horizontal": {
          x += dx * speed * delta + Math.sin(clockRef.current * 5 + phase) * 2 * delta;
          y += dy * speed * delta;
          break;
        }
        case "sine_vertical": {
          x += dx * speed * delta;
          y += dy * speed * delta + Math.sin(clockRef.current * 5 + phase) * 2 * delta;
          break;
        }
        case "figure8": {
          const f8Time = clockRef.current * 2 + phase;
          x += dx * speed * delta + Math.sin(f8Time) * 1.5 * delta;
          y += dy * speed * delta + Math.sin(f8Time * 2) * 0.8 * delta;
          break;
        }
        case "pendulum": {
          const pendAngle = Math.sin(clockRef.current * 3 + phase) * 1.5;
          x += (dx * Math.cos(pendAngle) - dy * Math.sin(pendAngle)) * speed * delta;
          y += (dx * Math.sin(pendAngle) + dy * Math.cos(pendAngle)) * speed * delta;
          break;
        }
        case "burst": {
          const burstPhase = (clockRef.current + phase) % 2;
          const burstSpeed = burstPhase < 0.3 ? speed * 2.5 : speed * 0.5;
          x += dx * burstSpeed * delta;
          y += dy * burstSpeed * delta;
          break;
        }
        case "retreat": {
          const distToPlayer = Math.sqrt((playerX - x) ** 2 + (playerY - y) ** 2);
          if (distToPlayer < 3) {
            x -= dx * speed * 0.5 * delta;
            y -= dy * speed * 0.5 * delta;
          } else {
            x += dx * speed * delta;
            y += dy * speed * delta;
          }
          break;
        }
        case "direct":
        default: {
          x += dx * speed * delta;
          y += dy * speed * delta;
          break;
        }
      }
      
      if (Math.abs(x) > 18 || Math.abs(y) > 12) {
        continue;
      }
      
      if (magiOrb4Active) {
        const relX = x - playerX;
        const relY = y - playerY;
        const distToPlayer = Math.sqrt(relX * relX + relY * relY);
        if (distToPlayer < 3.5 && distToPlayer > 0.5) {
          const orbAngle = Math.atan2(relY, relX);
          let angleDiff = orbAngle - magiOrb4Direction;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (angleDiff >= 0 && angleDiff <= Math.PI / 2) {
            addImpactEffect({
              id: `barrier-impact-${Date.now()}-${Math.random()}`,
              position: [x, y, 0] as [number, number, number],
              timer: 0.5,
              maxTimer: 0.5,
              seed: Math.random(),
            });
            addScore(10);
            useShop.getState().addCoins(5);
            
            if (gameMode === "arcade" && !orb.isBossOrb) {
              const newDestroyed = orbsDestroyedInLevel + 1;
              if (newDestroyed >= orbsRequiredForLevel) {
                completeLevel();
              }
            }
            
            updatedOrbs.push({
              ...orb,
              position: [x, y, z] as [number, number, number],
              direction: [dx, dy, dz] as [number, number, number],
              destroying: true,
              destroyTimer: 0.6,
            });
            continue;
          }
        }
      }
      
      const distToPlayer = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
      const hitRadius = orb.isBossOrb ? 1.2 : orb.size * 0.8 + 0.5;
      
      if (distToPlayer < hitRadius) {
        if (hasShield) {
          consumeShield();
          addImpactEffect({
            id: `impact-${Date.now()}-${Math.random()}`,
            position: [x, y, 0] as [number, number, number],
            timer: 0.5,
            maxTimer: 0.5,
            seed: Math.random(),
          });
          updatedOrbs.push({
            ...orb,
            position: [x, y, z] as [number, number, number],
            direction: [dx, dy, dz] as [number, number, number],
            destroying: true,
            destroyTimer: 0.6,
          });
          continue;
        } else {
          takeDamage();
          addImpactEffect({
            id: `impact-${Date.now()}-${Math.random()}`,
            position: [x, y, 0] as [number, number, number],
            timer: 0.5,
            maxTimer: 0.5,
            seed: Math.random(),
          });
          
          updatedOrbs.push({
            ...orb,
            position: [x, y, z] as [number, number, number],
            direction: [dx, dy, dz] as [number, number, number],
            destroying: true,
            destroyTimer: 0.6,
          });
          continue;
        }
      }
      
      const centerX = 0;
      const centerY = 0;
      const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const inDistortField = distortActive && distToCenter < DISTORT_FIELD_RADIUS;
      
      // Projectile hit — suppressed while orb is already in the hurt-flash window
      // (prevents double-triggering; player/barrier collisions still fire above)
      let hit = false;
      if ((orb.hurtTimer || 0) <= 0) {
        for (const proj of projectiles) {
          const projDist = Math.sqrt(
            (x - proj.position[0]) ** 2 + (y - proj.position[1]) ** 2
          );
          if (projDist < orb.size * 0.8 + 0.3) {
            hit = true;
            break;
          }
        }
      }
      
      if (hit) {
        addImpactEffect({
          id: `impact-${Date.now()}-${Math.random()}`,
          position: [x, y, 0] as [number, number, number],
          timer: 0.5,
          maxTimer: 0.5,
          seed: Math.random(),
        });
        addScore(10);
        useShop.getState().addCoins(5);
        
        if (gameMode === "arcade" && !orb.isBossOrb) {
          const newDestroyed = orbsDestroyedInLevel + 1;
          if (newDestroyed >= orbsRequiredForLevel) {
            completeLevel();
          }
        }
        
        // Fire orbs are identified by shape or bossType === "circle" — both
        // route to MiniFireOrb visuals (World1EnemyMesh or BossOrbMesh circle).
        const isFireOrb = orb.shape === "circle" || orb.bossType === "circle";
        updatedOrbs.push({
          ...orb,
          position: [x, y, z] as [number, number, number],
          direction: [dx, dy, dz] as [number, number, number],
          ...(isFireOrb
            ? { hurtTimer: HURT_FLASH_DURATION }
            : { destroying: true, destroyTimer: 0.6 }),
        });
        continue;
      }
      
      // Decrement hurt timer; transition to destroying when the window expires
      const newHurtTimer = Math.max(0, (orb.hurtTimer || 0) - delta);
      if ((orb.hurtTimer || 0) > 0 && newHurtTimer <= 0) {
        updatedOrbs.push({ ...orb, position: [x, y, z], direction: [dx, dy, dz], hurtTimer: 0, destroying: true, destroyTimer: 0.6 });
      } else {
        updatedOrbs.push({
          ...orb,
          position: [x, y, z],
          direction: [dx, dy, dz],
          frozen: inDistortField,
          ...(newHurtTimer > 0 ? { hurtTimer: newHurtTimer } : {}),
        });
      }
    }
    
    updateDarkOrbs(updatedOrbs);
  });
  
  return (
    <>
      {darkOrbs.map((orb) => (
        <MemoizedDarkOrbMesh key={orb.id} orb={orb} time={clockRef.current} />
      ))}
    </>
  );
}
