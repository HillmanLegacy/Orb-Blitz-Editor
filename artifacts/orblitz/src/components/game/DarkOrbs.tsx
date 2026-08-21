import { useRef, useMemo, memo, Suspense, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, DarkOrb, BossType } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { playBossDefeatSound } from "@/lib/audio/SynthSounds";
import { DarkOrbModel } from "./DarkOrbModel";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";
import { FireExplosionVFX } from "./FireExplosionVFX";
import { StarSupernovaVFX } from "./StarSupernovaVFX";
import { CrystalCrackExplosionVFX } from "./CrystalCrackExplosionVFX";
import { MiniFireOrb } from "./MiniFireOrb";
import { MiniStarOrb } from "./MiniStarOrb";
import { MiniCrystalOrb } from "./MiniCrystalOrb";
import { MiniToxicOrb } from "./MiniToxicOrb";
import { MiniPlasmaOrb } from "./MiniPlasmaOrb";
import { MiniDiamondOrb } from "./MiniDiamondOrb";
import { MiniRainbowOrb } from "./MiniRainbowOrb";
import { MiniMechaOrb } from "./MiniMechaOrb";
import { MiniMonsterOrb } from "./MiniMonsterOrb";
import { StandardEnemyParticles } from "./StandardEnemyParticles";
import { addExplosionImpulse } from "./Background";

const DISTORT_FIELD_RADIUS    = 7.125;
const DISTORT_FIELD_RADIUS_SQ = DISTORT_FIELD_RADIUS * DISTORT_FIELD_RADIUS; // 50.77
const HURT_FLASH_DURATION     = 0.15;

// ── Module-level physics map — updated imperatively every frame, never via React ─
// Stores mutable position/direction/speed/age for each live orb by ID.
// Reading this inside useFrame is safe; it never triggers React renders.
const orbPhysicsMap = new Map<string, {
  position: [number, number, number];
  direction: [number, number, number];
  speed: number;
  age: number;
}>();

const BOSS_ORB_COLORS: Record<BossType, { primary: string; secondary: string; glow: string }> = {
  circle:    { primary: "#6a2a8a", secondary: "#aa44cc", glow: "#8844aa" },
  star:      { primary: "#2a4a8a", secondary: "#6699ff", glow: "#4488ff" },
  arrow:     { primary: "#8a5a2a", secondary: "#ff6622", glow: "#ff8844" },
  triangle:  { primary: "#2a6a4a", secondary: "#33cc66", glow: "#44ff88" },
  trapezoid: { primary: "#8a2a4a", secondary: "#cc4488", glow: "#ff4488" },
  cube:      { primary: "#4a4a8a", secondary: "#6666cc", glow: "#8888ff" },
  cloud:     { primary: "#5a5a6a", secondary: "#8899aa", glow: "#aaaacc" },
  tentacle:  { primary: "#2a6a6a", secondary: "#44ccaa", glow: "#44ffcc" },
  monster:   { primary: "#6a2a2a", secondary: "#ff4444", glow: "#ff4444" },
  bird:      { primary: "#4a6a2a", secondary: "#88cc44", glow: "#aaff44" },
};

// ── HD red hurt-flash overlay ─────────────────────────────────────────────────
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
      <meshBasicMaterial color="#ff1100" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

// ── Boss orb mesh — position/scale driven imperatively ────────────────────────
function BossOrbMesh({ orb }: { orb: DarkOrb }) {
  const bossType   = orb.bossType || "circle";
  const groupRef   = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const physics = orbPhysicsMap.get(orb.id);
    if (!physics) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.1;
    groupRef.current.position.set(physics.position[0], physics.position[1], physics.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });

  if (orb.destroying) {
    const destroyProgress = orb.destroying ? 1 - (orb.destroyTimer || 0) / 0.6 : 0;
    const colors = BOSS_ORB_COLORS[bossType] || BOSS_ORB_COLORS.circle;
    if (bossType === "circle")   return <group position={orb.position}><FireExplosionVFX progress={destroyProgress} scale={orb.size} /></group>;
    if (bossType === "star")     return <group position={orb.position}><StarSupernovaVFX progress={destroyProgress} scale={orb.size} /></group>;
    if (bossType === "triangle") return <group position={orb.position}><CrystalCrackExplosionVFX progress={destroyProgress} scale={orb.size} /></group>;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={destroyProgress} color={colors.primary} glowColor={colors.glow} scale={orb.size} seed={Math.round(orb.seed * 1000)} />
      </group>
    );
  }

  if (bossType === "circle")   return <group ref={groupRef} position={orb.position!}><pointLight color="#ff6600" intensity={2} distance={5} decay={2} /><MiniFireOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "star")     return <group ref={groupRef} position={orb.position!}><MiniStarOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "triangle") return <group ref={groupRef} position={orb.position!}><MiniCrystalOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "arrow")    return <group ref={groupRef} position={orb.position!}><MiniRainbowOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "cloud")    return <group ref={groupRef} position={orb.position!}><MiniDiamondOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "cube")     return <group ref={groupRef} position={orb.position!}><MiniPlasmaOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "tentacle") return <group ref={groupRef} position={orb.position!}><pointLight color="#33aaff" intensity={1.8} distance={5} decay={2} /><MiniMechaOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  if (bossType === "monster")  return <group ref={groupRef} position={orb.position!}><MiniMonsterOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
  // trapezoid / bird / default
  return <group ref={groupRef} position={orb.position!}><MiniToxicOrb />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

// ── Unified dark orb mesh — fully imperative, zero re-renders per frame ───────
function UnifiedDarkOrbMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);

  const eyeData = useMemo(() => ({
    count: 1 + Math.floor(orb.seed * 2),
    positions: Array.from({ length: 3 }, (_, i) => ({
      x:           (orb.seed * 100 + i * 37) % 1 * 0.4 - 0.2,
      y:           (orb.seed * 200 + i * 53) % 1 * 0.3 + 0.05,
      size:        0.08 + ((orb.seed * 300 + i * 71) % 1) * 0.06,
      blinkOffset: (orb.seed * 400 + i * 91) % 1 * Math.PI * 2,
    }))
  }), [orb.seed]);

  const monsterFeatures = useMemo(() => {
    const featureType = Math.floor(orb.seed * 6);
    return {
      type:          featureType,
      hornCount:     2 + Math.floor((orb.seed * 100) % 3),
      teethCount:    3 + Math.floor((orb.seed * 200) % 4),
      tentacleCount: 4 + Math.floor((orb.seed * 300) % 4),
      spineCount:    5 + Math.floor((orb.seed * 400) % 4),
    };
  }, [orb.seed]);

  // Feature element refs — sized exactly for the active type
  const featureCount = useMemo(() => {
    switch (monsterFeatures.type) {
      case 0: return monsterFeatures.hornCount;
      case 1: return monsterFeatures.teethCount;
      case 2: return monsterFeatures.tentacleCount;
      case 3: return monsterFeatures.spineCount;
      case 4: return 2;
      case 5: return 6;
      default: return 0;
    }
  }, [monsterFeatures]);

  const featureRefs    = useRef<(THREE.Group | THREE.Mesh | null)[]>(Array(featureCount).fill(null));
  const flameMat0Refs  = useRef<(THREE.MeshBasicMaterial | null)[]>(monsterFeatures.type === 5 ? Array(6).fill(null) : []);

  // Eye refs
  const eyeGroupRefs    = useRef<(THREE.Group | null)[]>(Array(eyeData.count).fill(null));
  const eyePupilRefs    = useRef<(THREE.Mesh  | null)[]>(Array(eyeData.count).fill(null));
  const eyeInnerRefs    = useRef<(THREE.Mesh  | null)[]>(Array(eyeData.count).fill(null));
  const eyeHighRefs     = useRef<(THREE.Mesh  | null)[]>(Array(eyeData.count).fill(null));

  const deathVariation = useMemo(() => {
    const seed        = orb.seed;
    const rng         = seed * 12345.6789;
    const particleCount    = 14 + Math.floor((rng % 1) * 10);
    const rotationOffset   = ((rng * 7) % 1) * Math.PI * 2;
    const speedVariation   = 0.5 + ((rng * 11) % 1) * 1.0;
    const sizeVariation    = 0.6 + ((rng * 13) % 1) * 0.8;
    const explosionStyle   = Math.floor((rng * 17) % 4);
    const defaultColors    = ["#660033","#440022","#880044","#ff00ff","#aa0066","#ffaaff"];
    const shimmerColors    = ["#ffffff","#ffccff","#ccffff","#ffffcc"];
    const getBossColors    = (bt: string) => {
      const c = BOSS_ORB_COLORS[bt as BossType] || BOSS_ORB_COLORS.circle;
      return [c.glow, c.primary, c.secondary, c.glow, c.primary];
    };
    const colors = orb.bossDefeatColor ? getBossColors(orb.bossDefeatColor) : defaultColors;
    return {
      particleCount, rotationOffset, speedVariation, sizeVariation, explosionStyle, colors, shimmerColors,
      particles: Array.from({ length: particleCount }, (_, i) => {
        const ps = (rng * (i+1) * 31.41592) % 1;
        const as = (rng * (i+1) * 47.12389) % 1;
        const ds = (rng * (i+1) * 61.80339) % 1;
        const ss = (rng * (i+1) * 73.09017) % 1;
        const dl = (rng * (i+1) * 89.44271) % 1;
        const spiralAmt = explosionStyle===0?0:(explosionStyle===1?0.5:explosionStyle===2?1.2:0.3);
        return {
          angleOffset: (as - 0.5) * 0.8,
          distVariation: 0.4 + ds * 1.2,
          sizeScale: 0.4 + ss * 1.0,
          color: colors[Math.floor(ps * colors.length)],
          shimmerColor: shimmerColors[Math.floor(dl * shimmerColors.length)],
          delay: dl * 0.2,
          spinSpeed: 2 + ps * 8,
          spinDirection: ps > 0.5 ? 1 : -1,
          spiralAmount: spiralAmt,
          wobbleFreq: 3 + as * 5,
          wobbleAmp: 0.1 + ds * 0.3,
          trailLength: 0.3 + ss * 0.5,
          isShimmer: ps > 0.7,
        };
      }),
      sparkles: Array.from({ length: 8 + Math.floor((rng * 23) % 6) }, (_, i) => ({
        angle:       ((rng*(i+1)*97)%1)*Math.PI*2,
        speed:       0.8 + ((rng*(i+1)*103)%1)*1.5,
        size:        0.03 + ((rng*(i+1)*109)%1)*0.08,
        delay:       ((rng*(i+1)*127)%1)*0.3,
        twinkleSpeed: 8 + ((rng*(i+1)*131)%1)*12,
      })),
    };
  }, [orb.seed, orb.bossDefeatColor]);

  // ── Imperative per-frame: position, scale, rotation, feature animations ──────
  useFrame((state) => {
    if (!groupRef.current) return;
    const physics = orbPhysicsMap.get(orb.id);
    if (!physics) return;

    const time = state.clock.elapsedTime;
    const [x, y, z] = physics.position;

    // Main group position / scale / wobble
    groupRef.current.position.set(x, y, z);
    const distFromCenter   = Math.sqrt(x * x + y * y);
    const approachIntensity = Math.max(0, 1 - distFromCenter / 12);
    const pulseScale = 1 + Math.sin(time * (3 + approachIntensity * 3)) * 0.06;
    const breathe    = 1 + Math.sin(time * 2 + orb.seed * 10) * 0.04;
    groupRef.current.scale.setScalar(orb.size * pulseScale * breathe);
    groupRef.current.rotation.z = Math.sin(time * 1.5 + orb.seed * 5) * 0.05;

    // Monster shape feature animations
    switch (monsterFeatures.type) {
      case 0: { // horns
        featureRefs.current.forEach((ref, i) => {
          if (!ref) return;
          const angle    = (i / monsterFeatures.hornCount) * Math.PI - Math.PI / 2;
          const hornWave = Math.sin(time * 2 + i) * 0.1;
          (ref as THREE.Group).position.set(Math.cos(angle) * 0.35, Math.sin(angle) * 0.35 + 0.2, 0.01);
          (ref as THREE.Group).rotation.z = angle + Math.PI / 2 + hornWave;
        });
        break;
      }
      case 1: { // teeth
        featureRefs.current.forEach((ref, i) => {
          if (!ref) return;
          (ref as THREE.Mesh).position.y = Math.sin(time * 5 + i) * 0.02;
        });
        break;
      }
      case 2: { // tentacles
        featureRefs.current.forEach((ref, i) => {
          if (!ref) return;
          const angle = (i / monsterFeatures.tentacleCount) * Math.PI * 2 + time * 0.5;
          const wave  = Math.sin(time * 3 + i * 0.8) * 0.15;
          const dist  = 0.45 + wave * 0.2;
          (ref as THREE.Group).position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, -0.01);
          (ref as THREE.Group).rotation.z = angle;
        });
        break;
      }
      case 3: { // spines
        featureRefs.current.forEach((ref, i) => {
          if (!ref) return;
          const angle     = (i / monsterFeatures.spineCount) * Math.PI * 2;
          const spineWave = Math.sin(time * 4 + i * 1.2) * 0.08;
          (ref as THREE.Mesh).position.set(
            Math.cos(angle) * (0.5 + spineWave),
            Math.sin(angle) * (0.5 + spineWave),
            0.01,
          );
        });
        break;
      }
      case 4: { // ears
        if (featureRefs.current[0]) (featureRefs.current[0] as THREE.Mesh).rotation.z = 0.4 + Math.sin(time * 2) * 0.15;
        if (featureRefs.current[1]) (featureRefs.current[1] as THREE.Mesh).rotation.z = -0.4 - Math.sin(time * 2) * 0.15;
        break;
      }
      case 5: { // flames
        featureRefs.current.forEach((ref, i) => {
          if (!ref) return;
          const angle     = (i / 6) * Math.PI * 2 + time * 0.8;
          const flameWave = 0.4 + Math.sin(time * 8 + i * 1.5) * 0.15;
          (ref as THREE.Mesh).position.set(Math.cos(angle) * flameWave, Math.sin(angle) * flameWave, -0.02);
          (ref as THREE.Mesh).scale.setScalar(0.08 + Math.sin(time * 6 + i) * 0.02);
          const mat = flameMat0Refs.current[i];
          if (mat) mat.opacity = (orb.frozen ? 0.55 : (0.55 + Math.sin(time * 5 + i) * 0.25));
        });
        break;
      }
    }

    // Eye animations
    eyeGroupRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const eye       = eyeData.positions[i];
      const blinkPhase = Math.sin(time * 0.5 + eye.blinkOffset);
      const eyeScale  = blinkPhase > 0.95 ? eye.size * 0.2 : eye.size;
      ref.scale.setScalar(eyeScale);
    });
    const pupilLookArr = eyeData.positions.map((_, i) => Math.sin(time * 0.8 + i) * 0.02);
    eyePupilRefs.current.forEach((ref, i) => { if (ref) ref.position.x = pupilLookArr[i]; });
    eyeInnerRefs.current.forEach((ref, i) => { if (ref) ref.position.x = pupilLookArr[i] + 0.01; });
    eyeHighRefs.current.forEach( (ref, i) => { if (ref) ref.position.x = pupilLookArr[i] + 0.01; });
  });

  const frozenTint = orb.frozen;

  if (orb.destroying) {
    const destroyProgress = 1 - (orb.destroyTimer || 0) / 0.6;
    const deathColor = orb.bossDefeatColor ? deathVariation.colors[0] : "#8800cc";
    const deathGlow  = orb.bossDefeatColor ? deathVariation.colors[1] : "#440066";
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={destroyProgress} color={deathColor} glowColor={deathGlow} scale={orb.size} seed={Math.round(orb.seed * 999)} />
      </group>
    );
  }

  // ── Static JSX structure — refs attached for imperative animation ─────────────
  const renderMonsterShape = () => {
    const { type, hornCount, teethCount, tentacleCount, spineCount } = monsterFeatures;
    switch (type) {
      case 0:
        return (
          <>
            {Array.from({ length: hornCount }).map((_, i) => {
              const angle = (i / hornCount) * Math.PI - Math.PI / 2;
              return (
                <group key={`horn-${i}`} ref={el => { featureRefs.current[i] = el; }}
                  position={[Math.cos(angle) * 0.35, Math.sin(angle) * 0.35 + 0.2, 0.01]}
                  rotation={[0, 0, angle + Math.PI / 2]}>
                  <mesh scale={[0.06, 0.25, 1]}>
                    <circleGeometry args={[1, 3]} />
                    <meshBasicMaterial color="#660055" transparent opacity={0.95} />
                  </mesh>
                  <mesh scale={[0.04, 0.22, 1]} position={[0, 0, 0.01]}>
                    <circleGeometry args={[1, 3]} />
                    <meshBasicMaterial color={frozenTint ? "#3366aa" : "#aa00aa"} transparent opacity={0.9} />
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
              return (
                <mesh key={`tooth-${i}`} ref={el => { featureRefs.current[i] = el; }}
                  position={[xPos, 0, 0]} scale={[0.05, 0.1 + Math.sin(i) * 0.03, 1]}>
                  <circleGeometry args={[1, 3]} />
                  <meshBasicMaterial color="#cccccc" transparent opacity={0.95} />
                </mesh>
              );
            })}
          </group>
        );
      case 2:
        return (
          <>
            {Array.from({ length: tentacleCount }).map((_, i) => {
              const angle0 = (i / tentacleCount) * Math.PI * 2;
              return (
                <group key={`tent-${i}`} ref={el => { featureRefs.current[i] = el; }}
                  position={[Math.cos(angle0) * 0.45, Math.sin(angle0) * 0.45, -0.01]}
                  rotation={[0, 0, angle0]}>
                  <mesh scale={[0.08, 0.35, 1]} position={[0, 0, 0]}>
                    <circleGeometry args={[1, 4]} />
                    <meshBasicMaterial color="#330044" transparent opacity={0.85} />
                  </mesh>
                  <mesh scale={[0.05, 0.30, 1]} position={[0, 0, 0.01]}>
                    <circleGeometry args={[1, 4]} />
                    <meshBasicMaterial color={frozenTint ? "#446688" : "#7700aa"} transparent opacity={0.9} />
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
              const angle0 = (i / spineCount) * Math.PI * 2;
              return (
                <mesh key={`spine-${i}`} ref={el => { featureRefs.current[i] = el; }}
                  position={[Math.cos(angle0) * 0.5, Math.sin(angle0) * 0.5, 0.01]}
                  rotation={[0, 0, angle0]} scale={[0.03, 0.15, 1]}>
                  <circleGeometry args={[1, 3]} />
                  <meshBasicMaterial color="#8800bb" transparent opacity={0.9} />
                </mesh>
              );
            })}
          </>
        );
      case 4:
        return (
          <>
            <mesh ref={el => { featureRefs.current[0] = el; }}
              position={[-0.35, 0.25, 0.01]} rotation={[0, 0, 0.4]} scale={[0.12, 0.2, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#1a0a1a" transparent opacity={0.95} />
            </mesh>
            <mesh ref={el => { featureRefs.current[1] = el; }}
              position={[0.35, 0.25, 0.01]} rotation={[0, 0, -0.4]} scale={[0.12, 0.2, 1]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#1a0a1a" transparent opacity={0.95} />
            </mesh>
          </>
        );
      case 5:
      default:
        return (
          <>
            {Array.from({ length: 6 }).map((_, i) => {
              const angle0 = (i / 6) * Math.PI * 2;
              return (
                <mesh key={`flame-${i}`} ref={el => { featureRefs.current[i] = el; }}
                  position={[Math.cos(angle0) * 0.4, Math.sin(angle0) * 0.4, -0.02]}
                  scale={0.08}>
                  <circleGeometry args={[1, 5]} />
                  <meshBasicMaterial
                    ref={el => { flameMat0Refs.current[i] = el; }}
                    color={frozenTint ? "#6688aa" : "#bb00cc"}
                    transparent
                    opacity={0.55}
                  />
                </mesh>
              );
            })}
          </>
        );
    }
  };

  const renderEyes = () => {
    const eyesToRender = eyeData.positions.slice(0, eyeData.count);
    return eyesToRender.map((eye, i) => (
      <group key={`eye-${i}`} ref={el => { eyeGroupRefs.current[i] = el; }}
        position={[eye.x, eye.y, 0.02]} scale={eye.size}>
        <mesh scale={1.3}>
          <circleGeometry args={[1, 8]} />
          <meshBasicMaterial color="#000000" transparent opacity={1} />
        </mesh>
        <mesh scale={1} position={[0, 0, 0.01]}>
          <circleGeometry args={[1, 8]} />
          <meshBasicMaterial color={frozenTint ? "#4488cc" : "#aa0000"} transparent opacity={1} />
        </mesh>
        <mesh ref={el => { eyePupilRefs.current[i] = el; }}
          scale={0.5} position={[0, 0, 0.02]}>
          <circleGeometry args={[1, 6]} />
          <meshBasicMaterial color={frozenTint ? "#88ccff" : "#ff2222"} transparent opacity={0.9} />
        </mesh>
        <mesh ref={el => { eyeHighRefs.current[i] = el; }}
          scale={0.2} position={[0.01, 0.01, 0.03]}>
          <circleGeometry args={[1, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      </group>
    ));
  };

  return (
    <group ref={groupRef} position={orb.position!}>
      <Suspense fallback={
        <mesh scale={1}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color={frozenTint ? "#224466" : "#0a0011"} transparent opacity={1} />
        </mesh>
      }>
        <DarkOrbModel frozen={!!frozenTint} opacity={1} />
      </Suspense>
      {renderMonsterShape()}
      {renderEyes()}
    </group>
  );
}

// ── World enemy meshes — all use groupRef + useFrame, no time prop ─────────────
function World1EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#ff4400" glowColor="#ffaa00" scale={orb.size} seed={Math.round(orb.seed * 999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniFireOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniFireOrb particleCount={20} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World2EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.5 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <StarSupernovaVFX progress={dp} scale={orb.size} />
        {dp > 0.80 && <group scale={orb.size}><MiniStarOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniStarOrb particleCount={10} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World3EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4.5 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <CrystalCrackExplosionVFX progress={dp} scale={orb.size} />
        {dp > 0.80 && <group scale={orb.size}><MiniCrystalOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniCrystalOrb showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World4EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#8a2a4a" glowColor="#ff4488" scale={orb.size} seed={Math.round(orb.seed*999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniToxicOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniToxicOrb particleCount={5} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World5EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#4a4a8a" glowColor="#8888ff" scale={orb.size} seed={Math.round(orb.seed*999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniPlasmaOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniPlasmaOrb particleCount={5} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World6EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#5a5a6a" glowColor="#aaaacc" scale={orb.size} seed={Math.round(orb.seed*999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniDiamondOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniDiamondOrb particleCount={4} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World7EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#8a5a2a" glowColor="#ff8844" scale={orb.size} seed={Math.round(orb.seed*999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniRainbowOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniRainbowOrb particleCount={18} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World8EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#2a6a6a" glowColor="#44ffcc" scale={orb.size} seed={Math.round(orb.seed*999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniMechaOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniMechaOrb showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

function World9EnemyMesh({ orb }: { orb: DarkOrb }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const p = orbPhysicsMap.get(orb.id);
    if (!p) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4 + orb.seed * 6) * 0.06;
    groupRef.current.position.set(p.position[0], p.position[1], p.position[2]);
    groupRef.current.scale.setScalar(orb.size * pulse);
  });
  if (orb.destroying) {
    const dp = (orb.destroyTimer || 0) / 0.6;
    return (
      <group position={orb.position}>
        <EnergyDissipationVFX progress={dp} color="#6a2a2a" glowColor="#ff4444" scale={orb.size} seed={Math.round(orb.seed*999)} />
        {dp > 0.80 && <group scale={orb.size}><MiniMonsterOrb /></group>}
      </group>
    );
  }
  return <group ref={groupRef} position={orb.position!}><MiniMonsterOrb particleCount={50} showParticles={false} showLight={false} />{(orb.hurtTimer||0)>0&&<FireHurtFlash hurtTimer={orb.hurtTimer||0}/>}</group>;
}

// ── Router: picks mesh component + drives frozen overlay imperatively ──────────
function OrbRouter({ orb, arcadeLevel, gameMode }: { orb: DarkOrb; arcadeLevel: number; gameMode: string }) {
  const overlayRef = useRef<THREE.Mesh>(null);

  // Keep frozen overlay at the orb's live position each frame
  useFrame(() => {
    if (!overlayRef.current || !orb.frozen) return;
    const p = orbPhysicsMap.get(orb.id);
    if (p) overlayRef.current.position.set(p.position[0], p.position[1], p.position[2]);
  });

  const worldMeshFromShape = (o: DarkOrb): React.ReactNode => {
    switch (o.shape) {
      case "circle":    return <World1EnemyMesh orb={o} />;
      case "star":      return <World2EnemyMesh orb={o} />;
      case "triangle":  return <World3EnemyMesh orb={o} />;
      case "trapezoid": return <World4EnemyMesh orb={o} />;
      case "cube":      return <World5EnemyMesh orb={o} />;
      case "lightning": return <World6EnemyMesh orb={o} />;
      case "arrow":     return <World7EnemyMesh orb={o} />;
      case "tentacle":  return <World8EnemyMesh orb={o} />;
      case "monster":   return <World9EnemyMesh orb={o} />;
      default:          return <UnifiedDarkOrbMesh orb={o} />;
    }
  };

  let mesh: React.ReactNode;
  if (orb.isBossOrb) {
    mesh = <BossOrbMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 1) {
    mesh = <World1EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 2) {
    mesh = <World2EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 3) {
    mesh = <World3EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 4) {
    mesh = <World4EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 5) {
    mesh = <World5EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 6) {
    mesh = <World6EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 7) {
    mesh = <World7EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 8) {
    mesh = <World8EnemyMesh orb={orb} />;
  } else if (gameMode === "arcade" && Math.floor(arcadeLevel) === 9) {
    mesh = <World9EnemyMesh orb={orb} />;
  } else if (gameMode === "chill" || gameMode === "survival") {
    mesh = worldMeshFromShape(orb);
  } else {
    mesh = <UnifiedDarkOrbMesh orb={orb} />;
  }

  if (!orb.frozen) return <>{mesh}</>;

  return (
    <>
      {mesh}
      {/* Frozen overlay — initial position from last structural-update snapshot,
          then driven imperatively by overlayRef useFrame above */}
      <mesh ref={overlayRef} position={orb.position} scale={orb.size * 1.08} renderOrder={1}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#1155bb" transparent opacity={0.55} depthWrite={false} depthTest={false} />
      </mesh>
    </>
  );
}

// ── Memo comparator: short-circuit unless structural state actually changed ────
function orbMemoEqual(
  prev: { orb: DarkOrb; arcadeLevel: number; gameMode: string },
  next: { orb: DarkOrb; arcadeLevel: number; gameMode: string },
): boolean {
  if (prev.arcadeLevel !== next.arcadeLevel) return false;
  if (prev.gameMode    !== next.gameMode)    return false;
  const po = prev.orb;
  const no = next.orb;
  if (po === no) return true;           // same reference → definitely unchanged
  if (po.id          !== no.id)          return false;
  if (po.frozen      !== no.frozen)      return false;
  if (po.destroying  !== no.destroying)  return false;
  if (po.destroyTimer !== no.destroyTimer) return false;
  if (po.hurtTimer   !== no.hurtTimer)   return false;
  return true;
}

const MemoizedDarkOrbMesh = memo(OrbRouter, orbMemoEqual);

// ── Main DarkOrbs component ───────────────────────────────────────────────────
export function DarkOrbs() {
  const { equippedSkin } = useShop();
  // Subscribe only to structural state — NOT to position
  const darkOrbs    = useMagicOrb((s) => s.darkOrbs);
  const arcadeLevel = useMagicOrb((s) => s.arcadeLevel);
  const gameMode    = useMagicOrb((s) => s.gameMode);

  const bossOrbDeathSoundedRef = useRef(new Set<string>());

  // Clean up physics map when component unmounts (e.g. game restart)
  useEffect(() => () => { orbPhysicsMap.clear(); }, []);

  useFrame((_, delta) => {
    const {
      darkOrbs: currentOrbs,
      updateDarkOrbs,
      projectiles,
      playerPosition,
      hasShield,
      takeDamage,
      consumeShield,
      addImpactEffect,
      distortActive,
      arcadeLevel: al,
      orbsDestroyedInLevel,
      orbsRequiredForLevel,
      completeLevel,
      addScore,
      gameMode: gm,
      phase,
      magiOrb4Active,
      magiOrb4Direction,
      addStarFlowEvent,
    } = useMagicOrb.getState();

    if (phase !== "playing") {
      if (orbPhysicsMap.size > 0 && currentOrbs.length === 0) orbPhysicsMap.clear();
      return;
    }
    if (currentOrbs.length === 0) return;

    const playerX = playerPosition[0];
    const playerY = playerPosition[1];

    let structuralChanged = false;
    const newOrbs: DarkOrb[] = [];

    for (const orb of currentOrbs) {
      // ── Initialize physics for newly spawned orbs ───────────────────────────
      if (!orbPhysicsMap.has(orb.id)) {
        if (!orb.position || !orb.direction) continue;
        orbPhysicsMap.set(orb.id, {
          position:  [orb.position[0],  orb.position[1],  orb.position[2]],
          direction: [orb.direction[0], orb.direction[1], orb.direction[2]],
          speed:     orb.speed,
          age:       orb.age ?? 0,
        });
      }

      // ── Destroying orbs: count down timer, then remove ──────────────────────
      if (orb.destroying) {
        if (orb.isBossOrb && !bossOrbDeathSoundedRef.current.has(orb.id)) {
          bossOrbDeathSoundedRef.current.add(orb.id);
          if (!useAudio.getState().isMuted) playBossDefeatSound(0.18);
        }
        const newTimer = (orb.destroyTimer || 0) - delta;
        if (newTimer <= 0) {
          bossOrbDeathSoundedRef.current.delete(orb.id);
          const phy = orbPhysicsMap.get(orb.id);
          if (phy) addExplosionImpulse(phy.position[0], phy.position[1], 10);
          else if (orb.position) addExplosionImpulse(orb.position[0], orb.position[1], 10);
          orbPhysicsMap.delete(orb.id);
          structuralChanged = true;
          continue; // remove from array
        }
        // destroyTimer change is structural (VFX progress depends on it)
        newOrbs.push({ ...orb, destroyTimer: newTimer });
        structuralChanged = true;
        continue;
      }

      if (orb.frozen && distortActive) {
        newOrbs.push(orb); // same reference → no change
        continue;
      }

      if (!orb.position || !orb.direction) continue;

      // ── Physics: read from map, compute movement, write back ────────────────
      const phy = orbPhysicsMap.get(orb.id)!;
      let [x, y, z]    = phy.position;
      let [dx, dy, dz] = phy.direction;
      const patPhase   = orb.patternPhase || 0;

      // Lazy-float speed ramp
      let currentSpeed = phy.speed;
      let newAge       = phy.age;
      if (orb.lazyFloat && orb.baseSpeed !== undefined) {
        newAge = phy.age + delta;
        const minMult  = orb.lazyMinMult  ?? 0.4;
        const maxMult  = orb.lazyMaxMult  ?? 2.0;
        const rampTime = orb.lazyRampTime ?? 12;
        const t        = Math.min(newAge / rampTime, 1);
        const smooth   = t * t * (3 - 2 * t);
        currentSpeed   = orb.baseSpeed * (minMult + (maxMult - minMult) * smooth);
      }

      const speed = orb.frozen ? currentSpeed * 0.1 : currentSpeed;

      // Always home toward player
      const toPX = playerX - x;
      const toPY = playerY - y;
      const distToP = Math.sqrt(toPX * toPX + toPY * toPY);
      if (distToP > 0.1) { dx = toPX / distToP; dy = toPY / distToP; }

      const t = _clockTime; // set below in a separate fast useFrame at priority -1
      switch (orb.pattern) {
        case "zigzag":         { const z2 = Math.sin(t * 4 + patPhase) * 2; x += dx * speed * delta; y += dy * speed * delta + z2 * delta; break; }
        case "spiral":         { const sa = t * 2 + patPhase; x += (dx * speed + Math.cos(sa) * 0.5) * delta; y += (dy * speed + Math.sin(sa) * 0.5) * delta; break; }
        case "wave":           { x += dx * speed * delta; y += dy * speed * delta + Math.sin(t * 3 + patPhase) * delta * 1.5; break; }
        case "orbit":          { const oa = t * 1.5 + patPhase; const ta = Math.atan2(-y, -x) + 0.3; x += Math.cos(ta) * speed * delta + Math.cos(oa) * 0.3 * delta; y += Math.sin(ta) * speed * delta + Math.sin(oa) * 0.3 * delta; break; }
        case "homing":         { x += dx * speed * delta; y += dy * speed * delta; break; }
        case "sine_horizontal":{ x += dx * speed * delta + Math.sin(t * 5 + patPhase) * 2 * delta; y += dy * speed * delta; break; }
        case "sine_vertical":  { x += dx * speed * delta; y += dy * speed * delta + Math.sin(t * 5 + patPhase) * 2 * delta; break; }
        case "figure8":        { const f8 = t * 2 + patPhase; x += dx * speed * delta + Math.sin(f8) * 1.5 * delta; y += dy * speed * delta + Math.sin(f8 * 2) * 0.8 * delta; break; }
        case "pendulum":       { const pa = Math.sin(t * 3 + patPhase) * 1.5; x += (dx * Math.cos(pa) - dy * Math.sin(pa)) * speed * delta; y += (dx * Math.sin(pa) + dy * Math.cos(pa)) * speed * delta; break; }
        case "burst":          { const bp = (t + patPhase) % 2; const bs = bp < 0.3 ? speed * 2.5 : speed * 0.5; x += dx * bs * delta; y += dy * bs * delta; break; }
        case "retreat":        { const dtp = Math.sqrt((playerX-x)**2+(playerY-y)**2); if (dtp < 3) { x -= dx*speed*0.5*delta; y -= dy*speed*0.5*delta; } else { x += dx*speed*delta; y += dy*speed*delta; } break; }
        default:               { x += dx * speed * delta; y += dy * speed * delta; break; }
      }

      // Cull out-of-bounds
      if (Math.abs(x) > 28 || Math.abs(y) > 18) {
        orbPhysicsMap.delete(orb.id);
        structuralChanged = true;
        continue;
      }

      // Barrier (magiOrb4) check
      if (magiOrb4Active) {
        const relX = x - playerX, relY = y - playerY;
        const dtp2sq = relX * relX + relY * relY;
        if (dtp2sq < 12.25 && dtp2sq > 0.25) { // 3.5²=12.25, 0.5²=0.25
          const orbAngle = Math.atan2(relY, relX);
          let angleDiff = orbAngle - magiOrb4Direction;
          while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (angleDiff >= 0 && angleDiff <= Math.PI / 2) {
            addImpactEffect({ id: `barrier-impact-${Date.now()}-${Math.random()}`, position: [x, y, 0], timer: 0.5, maxTimer: 0.5, seed: Math.random() });
            addScore(10);
            addStarFlowEvent([x, y, z], 5);
            if (gm === "arcade" && !orb.isBossOrb) {
              if (orbsDestroyedInLevel + 1 >= orbsRequiredForLevel) completeLevel();
            }
            // Write back position so VFX spawns at right place
            phy.position = [x, y, z];
            newOrbs.push({ ...orb, position: [x, y, z] as [number,number,number], direction: [dx,dy,dz] as [number,number,number], destroying: true, destroyTimer: 0.6 });
            structuralChanged = true;
            continue;
          }
        }
      }

      // Player collision
      const hitRadius = orb.isBossOrb ? 1.2 : orb.size * 0.8 + 0.5;
      const dxP = x - playerX, dyP = y - playerY;
      if (dxP * dxP + dyP * dyP < hitRadius * hitRadius) {
        addImpactEffect({ id: `impact-${Date.now()}-${Math.random()}`, position: [x, y, 0], timer: 0.5, maxTimer: 0.5, seed: Math.random() });
        if (hasShield) {
          consumeShield();
        } else {
          takeDamage();
        }
        phy.position = [x, y, z];
        newOrbs.push({ ...orb, position: [x, y, z] as [number,number,number], direction: [dx,dy,dz] as [number,number,number], destroying: true, destroyTimer: 0.6 });
        structuralChanged = true;
        continue;
      }

      // Distort field freeze
      const inDistortField = distortActive && (x * x + y * y < DISTORT_FIELD_RADIUS_SQ);

      // Projectile hit (skip if already hurting)
      let hit = false;
      if ((orb.hurtTimer || 0) <= 0) {
        const projHitR2 = (orb.size * 0.8 + 0.3) * (orb.size * 0.8 + 0.3); // hoisted out of inner loop
        for (const proj of projectiles) {
          const pdx = x - proj.position[0], pdy = y - proj.position[1];
          if (pdx * pdx + pdy * pdy < projHitR2) { hit = true; break; }
        }
      }

      if (hit) {
        addImpactEffect({ id: `impact-${Date.now()}-${Math.random()}`, position: [x, y, 0], timer: 0.5, maxTimer: 0.5, seed: Math.random() });
        addScore(10);
        addStarFlowEvent([x, y, z], 5);
        if (gm === "arcade" && !orb.isBossOrb) {
          if (orbsDestroyedInLevel + 1 >= orbsRequiredForLevel) completeLevel();
        }
        const isFireOrb = orb.shape === "circle" || orb.bossType === "circle";
        phy.position = [x, y, z];
        newOrbs.push({
          ...orb,
          position: [x, y, z] as [number,number,number],
          direction: [dx, dy, dz] as [number,number,number],
          ...(isFireOrb ? { hurtTimer: HURT_FLASH_DURATION } : { destroying: true, destroyTimer: 0.6 }),
        });
        structuralChanged = true;
        continue;
      }

      // Hurt-timer countdown → transition to destroying
      const newHurtTimer = Math.max(0, (orb.hurtTimer || 0) - delta);
      if ((orb.hurtTimer || 0) > 0 && newHurtTimer <= 0) {
        addStarFlowEvent([x, y, z], 5);
        phy.position = [x, y, z];
        newOrbs.push({ ...orb, position: [x, y, z] as [number,number,number], direction: [dx,dy,dz] as [number,number,number], hurtTimer: 0, destroying: true, destroyTimer: 0.6 });
        structuralChanged = true;
        continue;
      }

      // Detect structural changes before writing physics back
      const newFrozen     = inDistortField;
      const frozenChanged = newFrozen !== !!orb.frozen;
      const hurtChanged   = newHurtTimer !== (orb.hurtTimer || 0);
      const speedChanged  = orb.lazyFloat && (currentSpeed !== phy.speed);

      // Write updated physics back to the map (no Zustand involved)
      phy.position  = [x, y, z];
      phy.direction = [dx, dy, dz];
      phy.speed     = currentSpeed;
      phy.age       = newAge;

      if (frozenChanged || hurtChanged || speedChanged) {
        structuralChanged = true;
        newOrbs.push({
          ...orb,
          // Snapshot position for frozen overlay initial placement
          position:  [x, y, z] as [number,number,number],
          direction: [dx,dy,dz] as [number,number,number],
          frozen:    newFrozen,
          ...(hurtChanged  ? { hurtTimer: newHurtTimer }   : {}),
          ...(speedChanged ? { speed: currentSpeed, age: newAge } : {}),
        });
      } else {
        newOrbs.push(orb); // SAME reference — memo sees no change
      }
    }

    // Only write to Zustand when the array structure or structural fields changed
    if (structuralChanged) {
      updateDarkOrbs(newOrbs);
    }
  });

  return (
    <>
      {darkOrbs.map((orb) => (
        <MemoizedDarkOrbMesh key={orb.id} orb={orb} arcadeLevel={arcadeLevel} gameMode={gameMode} />
      ))}
      <StandardEnemyParticles />
    </>
  );
}

// ── Clock helper: one cheap useFrame at priority -1 writes the global time ────
// All pattern cases in the physics loop read `_clockTime` rather than
// calling state.clock.getElapsedTime() per-orb inside the same frame.
let _clockTime = 0;
export function DarkOrbsClock() {
  useFrame((state) => { _clockTime = state.clock.elapsedTime; }, -1);
  return null;
}
