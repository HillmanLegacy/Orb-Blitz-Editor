import { useRef, useMemo, memo, Suspense, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, DarkOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { playBossDefeatSound } from "@/lib/audio/SynthSounds";
import { DarkOrbModel } from "./DarkOrbModel";
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
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";
import { usePerformanceFeature } from "@/game-runtime/PerformanceToggles";
import { EnemyDefeatVFX } from "./EnemyDefeatVFX";
import { ENEMY_DEFEAT_DURATION } from "@/game-runtime/EnemyLifecycle";

const DISTORT_FIELD_RADIUS    = 7.125;
const DISTORT_FIELD_RADIUS_SQ = DISTORT_FIELD_RADIUS * DISTORT_FIELD_RADIUS; // 50.77
const HURT_FLASH_DURATION     = 0.15;

// Compatibility alias for world-specific renderers. The shared game runtime is
// the only owner of these mutable transforms.
const orbPhysicsMap = gameRuntime.enemies.byId;

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
    return null;
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
    eyePupilRefs.current.forEach((ref, i) => { if (ref) ref.position.x = Math.sin(time * 0.8 + i) * 0.02; });
    eyeInnerRefs.current.forEach((ref, i) => { if (ref) ref.position.x = Math.sin(time * 0.8 + i) * 0.02 + 0.01; });
    eyeHighRefs.current.forEach( (ref, i) => { if (ref) ref.position.x = Math.sin(time * 0.8 + i) * 0.02 + 0.01; });
  });

  const frozenTint = orb.frozen;

  if (orb.destroying) {
    return null;
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
    return null;
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
    return null;
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
    return null;
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
    return null;
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
    return null;
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
    return null;
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
    return null;
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
    return null;
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
    return null;
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

  if (!orb.frozen) {
    return <Suspense fallback={null}>{mesh}</Suspense>;
  }

  return (
    <>
      <Suspense fallback={null}>{mesh}</Suspense>
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
  // Subscribe only to structural state — NOT to position
  const darkOrbs    = useMagicOrb((s) => s.darkOrbs);
  const arcadeLevel = useMagicOrb((s) => s.arcadeLevel);
  const gameMode    = useMagicOrb((s) => s.gameMode);
  const showEnemyVisuals = usePerformanceFeature("enemyVisuals");

  const bossOrbDeathSoundedRef = useRef(new Set<string>());

  // Clean up physics map when component unmounts (e.g. game restart)
  useEffect(() => () => { gameRuntime.enemies.reset(); }, []);

  useFrame((_, delta) => {
    gameRuntime.pipeline.enter("enemies");
    const {
      darkOrbs: currentOrbs,
      updateDarkOrbs,
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
      magiOrb7Active,
      addStarFlowEvent,
    } = useMagicOrb.getState();

    if (phase !== "playing") {
      if (orbPhysicsMap.size > 0 && currentOrbs.length === 0) gameRuntime.enemies.reset();
      return;
    }
    if (currentOrbs.length === 0) return;
    runtimeDiagnostics.beginEnemySimulation();

    const playerX = playerPosition[0];
    const playerY = playerPosition[1];

    let structuralChanged = false;
    const newOrbs: DarkOrb[] = [];

    for (const orb of currentOrbs) {
      // ── Initialize physics for newly spawned orbs ───────────────────────────
      if (!orb.position || !orb.direction) continue;
      gameRuntime.enemies.getOrCreate(orb);

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
          gameRuntime.enemies.release(orb.id);
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
      phy.previousPosition[0] = x;
      phy.previousPosition[1] = y;
      phy.previousPosition[2] = z;
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

      // Magi-Orb VII is a runtime effect. Do not rewrite Zustand's structural
      // speed snapshot: doing so compounds on reactivation and misses new orbs.
      const speed = (orb.frozen ? currentSpeed * 0.1 : currentSpeed) *
        (magiOrb7Active ? 0.25 : 1);

      // Always home toward player
      const toPX = playerX - x;
      const toPY = playerY - y;
      const distToP = Math.sqrt(toPX * toPX + toPY * toPY);
      if (distToP > 0.1) { dx = toPX / distToP; dy = toPY / distToP; }

      const t = gameRuntime.clock.elapsed;
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
        gameRuntime.enemies.release(orb.id);
        structuralChanged = true;
        continue;
      }

      // Full-radius shield (magiOrb4) check. The old directional quarter arc
      // made the ability unreliable because enemies could enter from behind.
      if (magiOrb4Active) {
        const relX = x - playerX, relY = y - playerY;
        const dtp2sq = relX * relX + relY * relY;
        if (dtp2sq < 12.25 && dtp2sq > 0.25) { // 3.5²=12.25, 0.5²=0.25
          addImpactEffect({ id: `barrier-impact-${Date.now()}-${Math.random()}`, position: [x, y, 0], timer: 0.5, maxTimer: 0.5, seed: Math.random() });
          addScore(10);
          addStarFlowEvent([x, y, z], 5);
          if (gm === "arcade" && !orb.isBossOrb) {
            if (orbsDestroyedInLevel + 1 >= orbsRequiredForLevel) completeLevel();
          }
            // Write back position so VFX spawns at right place
            phy.position[0] = x; phy.position[1] = y; phy.position[2] = z;
            newOrbs.push({ ...orb, position: [x, y, z] as [number,number,number], direction: [dx,dy,dz] as [number,number,number], destroying: true, destroyTimer: ENEMY_DEFEAT_DURATION });
            structuralChanged = true;
            continue;
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
        phy.position[0] = x; phy.position[1] = y; phy.position[2] = z;
        newOrbs.push({ ...orb, position: [x, y, z] as [number,number,number], direction: [dx,dy,dz] as [number,number,number], destroying: true, destroyTimer: ENEMY_DEFEAT_DURATION });
        structuralChanged = true;
        continue;
      }

      // Distort field freeze
      const inDistortField = distortActive && (x * x + y * y < DISTORT_FIELD_RADIUS_SQ);

      // Hurt-timer countdown → transition to destroying
      const newHurtTimer = Math.max(0, (orb.hurtTimer || 0) - delta);
      if ((orb.hurtTimer || 0) > 0 && newHurtTimer <= 0) {
        addStarFlowEvent([x, y, z], 5);
        phy.position[0] = x; phy.position[1] = y; phy.position[2] = z;
        newOrbs.push({ ...orb, position: [x, y, z] as [number,number,number], direction: [dx,dy,dz] as [number,number,number], hurtTimer: 0, destroying: true, destroyTimer: ENEMY_DEFEAT_DURATION });
        structuralChanged = true;
        continue;
      }

      // Detect structural changes before writing physics back
      const newFrozen     = inDistortField;
      const frozenChanged = newFrozen !== !!orb.frozen;
      const hurtChanged   = newHurtTimer !== (orb.hurtTimer || 0);

      // Write updated physics back to the map (no Zustand involved)
      phy.position[0] = x; phy.position[1] = y; phy.position[2] = z;
      phy.direction[0] = dx; phy.direction[1] = dy; phy.direction[2] = dz;
      phy.speed     = currentSpeed;
      phy.age       = newAge;

      if (frozenChanged || hurtChanged) {
        structuralChanged = true;
        newOrbs.push({
          ...orb,
          // Snapshot position for frozen overlay initial placement
          position:  [x, y, z] as [number,number,number],
          direction: [dx,dy,dz] as [number,number,number],
          frozen:    newFrozen,
          ...(hurtChanged  ? { hurtTimer: newHurtTimer }   : {}),
        });
      } else {
        newOrbs.push(orb); // SAME reference — memo sees no change
      }
    }

    // Only write to Zustand when the array structure or structural fields changed
    if (structuralChanged) {
      updateDarkOrbs(newOrbs);
      runtimeDiagnostics.noteStoreWrite();
    }
    runtimeDiagnostics.endEnemySimulation();
  });

  runtimeDiagnostics.noteEnemyRender();
  return (
    <>
      {showEnemyVisuals && darkOrbs.map((orb) => (
        <MemoizedDarkOrbMesh key={orb.id} orb={orb} arcadeLevel={arcadeLevel} gameMode={gameMode} />
      ))}
      {showEnemyVisuals && <EnemyDefeatVFX />}
      {showEnemyVisuals && <StandardEnemyParticles />}
    </>
  );
}

