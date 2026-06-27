import { useRef, useMemo, memo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, Projectile, Particle, ImpactEffect } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop, TrailEffect } from "@/lib/stores/useShop";
import { getSkinColors, PlayerGlow } from "./PlayerOrb";
import { PlayerModel } from "./PlayerModel";
import { PlayerParticles } from "./PlayerParticles";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";

const sharedCircleGeo = new THREE.CircleGeometry(1, 32);
const sharedPlaneGeo = new THREE.PlaneGeometry(1, 1);
const sharedRingGeo = new THREE.RingGeometry(0.85, 1, 32);

const TRAIL_CONFIGS: Record<TrailEffect, { colors: string[]; shape: string; particleCount: number; spread: number; glow: boolean }> = {
  none: { colors: [], shape: "circle", particleCount: 0, spread: 0, glow: false },
  sparkle: { colors: ["#ffffff", "#ffff88", "#ffffcc", "#88ffff"], shape: "star", particleCount: 8, spread: 0.15, glow: true },
  fire: { colors: ["#ff4400", "#ff6600", "#ff8800", "#ffcc00", "#ffff00"], shape: "triangle", particleCount: 10, spread: 0.2, glow: true },
  ice: { colors: ["#88ddff", "#aaeeff", "#ccffff", "#ffffff", "#66ccff"], shape: "diamond", particleCount: 8, spread: 0.12, glow: true },
  cosmic: { colors: ["#ff00ff", "#8800ff", "#4400ff", "#0088ff", "#00ffff"], shape: "circle", particleCount: 12, spread: 0.18, glow: true },
  lightning: { colors: ["#ffff00", "#ffffff", "#88ffff", "#ffffaa"], shape: "bolt", particleCount: 10, spread: 0.25, glow: true },
  rainbow: { colors: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#00ffff", "#0088ff", "#ff00ff"], shape: "circle", particleCount: 14, spread: 0.2, glow: true },
  plasma: { colors: ["#ff00ff", "#ff44ff", "#ff88ff", "#ffffff", "#88ffff"], shape: "plasma", particleCount: 10, spread: 0.22, glow: true },
  shadow: { colors: ["#330033", "#440044", "#550055", "#220022", "#110011"], shape: "smoke", particleCount: 8, spread: 0.18, glow: false },
  stardust: { colors: ["#ffffff", "#ffccff", "#ccffff", "#ffffcc", "#ffddee"], shape: "star", particleCount: 16, spread: 0.2, glow: true },
  meteor: { colors: ["#ff4400", "#ff2200", "#ff6600", "#ff0000", "#ffaa00"], shape: "triangle", particleCount: 12, spread: 0.25, glow: true },
  spirit: { colors: ["#88ffff", "#aaddff", "#ccffff", "#ffffff", "#66ddff"], shape: "wisp", particleCount: 10, spread: 0.15, glow: true },
  neon: { colors: ["#00ff88", "#ff00ff", "#00ffff", "#ffff00", "#88ff00"], shape: "square", particleCount: 10, spread: 0.18, glow: true },
  sakura: { colors: ["#ffaacc", "#ff88aa", "#ffccdd", "#ffffff", "#ffbbdd"], shape: "petal", particleCount: 12, spread: 0.22, glow: true },
  galaxy: { colors: ["#0000ff", "#4400ff", "#8800ff", "#ff00ff", "#00ffff", "#ffffff"], shape: "star", particleCount: 14, spread: 0.2, glow: true },
};

interface TrailParticleData {
  offset: number;
  angle: number;
  size: number;
  colorIndex: number;
  wobble: number;
}

function HDTrailEffect({ 
  trailType, 
  time, 
  direction, 
  baseScale,
  projectileColor 
}: { 
  trailType: TrailEffect; 
  time: number; 
  direction: [number, number, number]; 
  baseScale: number;
  projectileColor: string;
}) {
  const config = TRAIL_CONFIGS[trailType];
  if (config.particleCount === 0) return null;
  
  const particles = useMemo<TrailParticleData[]>(() => {
    const result: TrailParticleData[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      result.push({
        offset: i * 0.18,
        angle: (Math.random() - 0.5) * config.spread * 2,
        size: 0.6 + Math.random() * 0.5,
        colorIndex: i % config.colors.length,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    return result;
  }, [config.particleCount, config.colors.length, config.spread]);
  
  const renderShape = (shape: string, scale: number, color: string, opacity: number, rotation: number) => {
    switch (shape) {
      case "star":
        return (
          <group>
            <mesh scale={scale * 1.3} rotation={[0, 0, rotation]}>
              <circleGeometry args={[1, 5]} />
              <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.5} />
            </mesh>
            <mesh scale={scale} rotation={[0, 0, rotation]}>
              <circleGeometry args={[1, 5]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      case "diamond":
        return (
          <group>
            <mesh scale={scale * 1.3} rotation={[0, 0, rotation + Math.PI / 4]}>
              <planeGeometry args={[1.2, 1.2]} />
              <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.5} />
            </mesh>
            <mesh scale={scale} rotation={[0, 0, rotation + Math.PI / 4]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      case "triangle":
        return (
          <group>
            <mesh scale={scale * 1.3} rotation={[0, 0, rotation]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.5} />
            </mesh>
            <mesh scale={scale} rotation={[0, 0, rotation]}>
              <circleGeometry args={[1, 3]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      case "bolt":
        return (
          <group>
            <mesh scale={[scale * 0.3, scale * 1.5, 1]} rotation={[0, 0, rotation]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      case "plasma":
        return (
          <group>
            <mesh scale={scale * 1.4}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.4} />
            </mesh>
            <mesh scale={scale * 1.1}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color={color} transparent opacity={opacity * 0.7} />
            </mesh>
            <mesh scale={scale * 0.7}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.9} />
            </mesh>
          </group>
        );
      case "smoke":
        return (
          <group>
            <mesh scale={scale * 1.6}>
              <circleGeometry args={[1, 10]} />
              <meshBasicMaterial color={color} transparent opacity={opacity * 0.5} />
            </mesh>
            <mesh scale={scale}>
              <circleGeometry args={[1, 10]} />
              <meshBasicMaterial color={color} transparent opacity={opacity * 0.7} />
            </mesh>
          </group>
        );
      case "wisp":
        return (
          <group>
            <mesh scale={[scale * 0.6, scale * 1.4, 1]} rotation={[0, 0, rotation]}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color={color} transparent opacity={opacity * 0.8} />
            </mesh>
            <mesh scale={scale * 0.5}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
            </mesh>
          </group>
        );
      case "petal":
        return (
          <group>
            <mesh scale={[scale * 0.5, scale, 1]} rotation={[0, 0, rotation]}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      case "square":
        return (
          <group>
            <mesh scale={scale * 1.2} rotation={[0, 0, rotation]}>
              <planeGeometry args={[1.2, 1.2]} />
              <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.5} />
            </mesh>
            <mesh scale={scale} rotation={[0, 0, rotation]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
      default:
        return (
          <group>
            <mesh scale={scale * 1.25}>
              <circleGeometry args={[1, 10]} />
              <meshBasicMaterial color="#000000" transparent opacity={opacity * 0.5} />
            </mesh>
            <mesh scale={scale}>
              <circleGeometry args={[1, 10]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
          </group>
        );
    }
  };
  
  return (
    <group>
      {config.glow && (
        <mesh 
          position={[-direction[0] * 0.3, -direction[1] * 0.3, -0.01]}
          scale={baseScale * 2.5}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial color={projectileColor} transparent opacity={0.15} />
        </mesh>
      )}
      
      {particles.map((p, i) => {
        const trailDist = (p.offset + 0.1) * 1.8;
        const wobbleX = Math.sin(time * 8 + p.wobble) * p.angle * 0.5;
        const wobbleY = Math.cos(time * 6 + p.wobble) * p.angle * 0.5;
        const fadeOut = Math.max(0.1, 1 - (i / config.particleCount) * 0.8);
        const sizeMultiplier = 1 - (i / config.particleCount) * 0.6;
        const color = config.colors[p.colorIndex];
        const particleScale = baseScale * 0.5 * p.size * sizeMultiplier;
        const rotation = time * 4 + p.wobble;
        
        return (
          <group
            key={i}
            position={[
              -direction[0] * trailDist + wobbleX,
              -direction[1] * trailDist + wobbleY,
              0,
            ]}
          >
            {renderShape(config.shape, particleScale, color, fadeOut * 0.85, rotation)}
          </group>
        );
      })}
    </group>
  );
}

const MemoizedHDTrailEffect = memo(HDTrailEffect);

function ProjectileMesh({ projectile, time, trailType, skinColor, skinColors }: {
  projectile: Projectile;
  time: number;
  trailType: TrailEffect;
  skinColor: string;
  skinColors: { core: string; glow: string; emissive: string; accent: string; particles: string[] };
  equippedSkin: string;
}) {
  const spawnTime     = useRef(time);
  const spawnProgress = Math.min(1, (time - spawnTime.current) * 6);
  const isCharged     = projectile.isCharged;
  const isRainbow     = (skinColors as any).isRainbow === true;

  // 1/5th of the player orb base scale (0.6)
  const projScale  = isCharged ? 0.18 : 0.12;
  const groupScale = 0.2 + spawnProgress * 0.8;

  return (
    <group position={projectile.position}>
      {/* Trail */}
      {trailType !== "none" && spawnProgress >= 0.4 && (
        <MemoizedHDTrailEffect
          trailType={trailType}
          time={time}
          direction={projectile.direction}
          baseScale={projScale * groupScale}
          projectileColor={skinColor}
        />
      )}

      {/* Mini player orb at 1/5th scale — FBX model + glow + particles, all skin-matched */}
      <group scale={groupScale}>
        <Suspense fallback={null}>
          <PlayerModel
            scale={projScale}
            rotationSpeedX={1.6}
            rotationSpeedY={2.4}
          />
        </Suspense>
        <PlayerGlow
          scale={projScale}
          coreColor={skinColors.core}
          glowColor={skinColors.glow}
          isRainbow={isRainbow}
        />
        <PlayerParticles
          scale={projScale}
          particleColors={[skinColors.core]}
          isRainbow={isRainbow}
        />

        {/* Charged: extra rings around the mini orb */}
        {isCharged && (
          <>
            <mesh rotation={[Math.PI / 2, 0, time * 4]}>
              <torusGeometry args={[projScale * 2.4, projScale * 0.08, 6, 28]} />
              <meshBasicMaterial color={skinColors.emissive} transparent opacity={0.65} depthWrite={false} />
            </mesh>
            <mesh rotation={[0.8, 0, -time * 3]}>
              <torusGeometry args={[projScale * 2.9, projScale * 0.05, 6, 28]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

function ImpactEffectMesh({ effect, skinColors }: {
  effect: ImpactEffect;
  time: number;
  skinColors: { particles: string[]; glow: string; core: string; emissive: string };
}) {
  const progress = 1 - effect.timer / effect.maxTimer;
  return (
    <group position={effect.position}>
      <EnergyDissipationVFX
        progress={progress}
        color={skinColors.core}
        glowColor={skinColors.glow}
        scale={0.38}
        seed={Math.round(effect.seed * 9999)}
      />
    </group>
  );
}

let impactIdCounter = 0;

export function Projectiles() {
  const { 
    projectiles, 
    updateProjectiles, 
    darkOrbs, 
    markOrbDestroying,
    powerUps,
    markPowerUpCollected,
    removePowerUp,
    activateShield,
    activateChargeBeam,
    heal,
    activateDoubleCoins,
    activateRapidFire,
    hasDoubleCoins,
    addScore, 
    addParticles,
    impactEffects,
    updateImpactEffects,
    addImpactEffect,
    phase,
    boss,
    damageBoss,
    incrementOrbsDestroyed,
    gameMode,
    addOrbDestroyStars,
    registerMissedShot,
    incrementGauntletOrbs,
  } = useMagicOrb();
  
  const { playHit, playSuccess, playSparkleExplosion } = useAudio();
  const { addCoins, equippedTrail, equippedSkin } = useShop();
  const clockRef = useRef(0);
  const projectileSpeed = 16.5;
  const hitRadius = 1.2;
  const hitOrbsThisFrame = useRef<Set<string>>(new Set());
  const hitPowerUpsThisFrame = useRef<Set<string>>(new Set());
  const projectileOrbHits = useRef<Map<string, Set<string>>>(new Map());
  const volleyHits = useRef<Set<string>>(new Set());
  const volleyProjectileCounts = useRef<Map<string, number>>(new Map());
  const volleyRemainingCounts = useRef<Map<string, number>>(new Map());
  
  const skinColors = useMemo(() => getSkinColors(equippedSkin, 3), [equippedSkin]);
  const projectileColor = skinColors.projectile;
  
  useFrame((state, delta) => {
    clockRef.current = state.clock.getElapsedTime();
    
    const {
      projectiles,
      darkOrbs,
      powerUps,
      impactEffects,
      phase,
      boss,
      hasDoubleCoins,
      gameMode,
      updateProjectiles,
      markOrbDestroying,
      markPowerUpCollected,
      removePowerUp,
      activateShield,
      activateChargeBeam,
      heal,
      activateDoubleCoins,
      activateRapidFire,
      addScore,
      addParticles,
      updateImpactEffects,
      addImpactEffect,
      damageBoss,
      incrementOrbsDestroyed,
      addOrbDestroyStars,
      registerMissedShot,
      incrementGauntletOrbs,
    } = useMagicOrb.getState();
    
    if (phase !== "playing") return;
    
    const updatedEffects = impactEffects
      .map(e => ({ ...e, timer: e.timer - delta }))
      .filter(e => e.timer > 0);
    updateImpactEffects(updatedEffects);
    
    if (projectiles.length === 0) return;
    
    const updatedProjectiles: Projectile[] = [];
    hitOrbsThisFrame.current.clear();
    hitPowerUpsThisFrame.current.clear();
    
    for (const orb of darkOrbs) {
      if (orb.destroying) {
        Array.from(projectileOrbHits.current.entries()).forEach(([projId, orbSet]) => {
          orbSet.delete(orb.id);
        });
      }
    }
    
    for (const proj of projectiles) {
      if (proj.volleyId && !volleyProjectileCounts.current.has(proj.volleyId)) {
        const volleySize = projectiles.filter(p => p.volleyId === proj.volleyId).length;
        volleyProjectileCounts.current.set(proj.volleyId, volleySize);
        volleyRemainingCounts.current.set(proj.volleyId, volleySize);
      }
      
      let [px, py, pz] = proj.position;
      let [dx, dy, dz] = proj.direction;
      
      if (proj.homing) {
        const homingBoundary = 12;
        const orbTargets = darkOrbs.filter(o => !o.destroying && Math.abs(o.position[0]) <= homingBoundary && Math.abs(o.position[1]) <= homingBoundary);
        
        let closestTarget: { position: [number, number, number] } | null = null;
        let closestDist = Infinity;
        
        for (const orb of orbTargets) {
          const d = Math.sqrt((orb.position[0] - px) ** 2 + (orb.position[1] - py) ** 2);
          if (d < closestDist) {
            closestDist = d;
            closestTarget = orb;
          }
        }
        
        if (boss && !boss.destroying && !boss.shieldActive) {
          const bossDist = Math.sqrt((boss.position[0] - px) ** 2 + (boss.position[1] - py) ** 2);
          if (bossDist < closestDist) {
            closestDist = bossDist;
            closestTarget = boss;
          }
        }
        
        if (closestTarget) {
          const targetDirX = closestTarget.position[0] - px;
          const targetDirY = closestTarget.position[1] - py;
          const len = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY);
          if (len > 0.1) {
            const homingStrength = 0.15;
            dx = dx * (1 - homingStrength) + (targetDirX / len) * homingStrength;
            dy = dy * (1 - homingStrength) + (targetDirY / len) * homingStrength;
            const newLen = Math.sqrt(dx * dx + dy * dy);
            if (newLen > 0.01) {
              dx /= newLen;
              dy /= newLen;
            }
          }
        }
      }
      
      let newSpiralAngle = proj.spiralAngle;
      if (newSpiralAngle !== undefined) {
        const spiralSpeed = 3;
        newSpiralAngle = newSpiralAngle + delta * spiralSpeed;
        dx = Math.cos(newSpiralAngle);
        dy = Math.sin(newSpiralAngle);
      }
      
      px += dx * projectileSpeed * delta;
      py += dy * projectileSpeed * delta;
      pz += dz * projectileSpeed * delta;
      
      if (proj.type === "spiral" && proj.createdAt) {
        const age = (Date.now() - proj.createdAt) / 1000;
        if (age > 3) {
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [px, py, pz],
            timer: 0.3,
            maxTimer: 0.3,
            seed: Math.random(),
          });
          if (proj.volleyId) {
            const remaining = (volleyRemainingCounts.current.get(proj.volleyId) || 1) - 1;
            volleyRemainingCounts.current.set(proj.volleyId, remaining);
            if (remaining <= 0 && !volleyHits.current.has(proj.volleyId) && !proj.noMissTracking) {
              registerMissedShot();
            }
            if (remaining <= 0) {
              volleyHits.current.delete(proj.volleyId);
              volleyRemainingCounts.current.delete(proj.volleyId);
              volleyProjectileCounts.current.delete(proj.volleyId);
            }
          }
          projectileOrbHits.current.delete(proj.id);
          continue;
        }
      }
      
      const screenBoundary = 13;
      if (Math.abs(px) > screenBoundary || Math.abs(py) > screenBoundary) {
        const projHasHit = projectileOrbHits.current.has(proj.id) && projectileOrbHits.current.get(proj.id)!.size > 0;
        
        if (proj.volleyId) {
          if (projHasHit) {
            volleyHits.current.add(proj.volleyId);
          }
          const remaining = (volleyRemainingCounts.current.get(proj.volleyId) || 1) - 1;
          volleyRemainingCounts.current.set(proj.volleyId, remaining);
          
          if (remaining <= 0) {
            if (!volleyHits.current.has(proj.volleyId) && !proj.noMissTracking) {
              registerMissedShot();
            }
            volleyHits.current.delete(proj.volleyId);
            volleyRemainingCounts.current.delete(proj.volleyId);
            volleyProjectileCounts.current.delete(proj.volleyId);
          }
        } else {
          const isPrimaryShot = proj.type === "normal" || proj.type === "homing" || proj.type === undefined;
          if (isPrimaryShot && !projHasHit && !proj.noMissTracking) {
            registerMissedShot();
          }
        }
        
        projectileOrbHits.current.delete(proj.id);
        continue;
      }
      
      let hitSomething = false;
      
      if (boss && !boss.destroying && !boss.shieldActive) {
        const [bx, by, bz] = boss.position;
        const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2 + (bz || 0 - pz) ** 2);
        const bossHitRadius = 2.5;
        
        if (dist < bossHitRadius) {
          hitSomething = true;
          const projHits = projectileOrbHits.current.get(proj.id) || new Set();
          projHits.add("boss");
          projectileOrbHits.current.set(proj.id, projHits);
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          const bossKilled = damageBoss();
          addScore(25);
          playHit();
          
          if (bossKilled) {
            playSparkleExplosion();
          }
          
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [bx, by, bz || 0],
            timer: 0.5,
            maxTimer: 0.5,
            seed: Math.random(),
          });
          
          
        }
      } else if (boss && boss.shieldActive) {
        const [bx, by, bz] = boss.position;
        const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2 + (bz || 0 - pz) ** 2);
        const shieldRadius = 3.5;
        
        if (dist < shieldRadius) {
          hitSomething = true;
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [px, py, pz],
            timer: 0.3,
            maxTimer: 0.3,
            seed: Math.random(),
          });
        }
      }
      
      for (const orb of darkOrbs) {
        if (hitOrbsThisFrame.current.has(orb.id) || orb.destroying) continue;
        
        const [ox, oy, oz] = orb.position;
        const orbScreenBoundary = 12;
        if (Math.abs(ox) > orbScreenBoundary || Math.abs(oy) > orbScreenBoundary) continue;
        
        const projHits = projectileOrbHits.current.get(proj.id) || new Set();
        if (proj.piercing && projHits.has(orb.id)) continue;
        const dist = Math.sqrt((px - ox) ** 2 + (py - oy) ** 2 + (pz - oz) ** 2);
        const bossOrbHitBonus = orb.isBossOrb ? 0.6 : 0;
        const effectiveRadius = (proj.isCharged ? hitRadius * 1.8 : hitRadius) + bossOrbHitBonus;
        
        if (dist < effectiveRadius) {
          hitOrbsThisFrame.current.add(orb.id);
          markOrbDestroying(orb.id);
          addScore(10);
          addOrbDestroyStars();
          incrementGauntletOrbs();
          const baseCoins = 1 + Math.floor(Math.random() * 3);
          addCoins(hasDoubleCoins ? baseCoins * 2 : baseCoins);
          playHit();
          
          if (gameMode === "arcade") {
            incrementOrbsDestroyed();
          }
          
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [ox, oy, oz],
            timer: 0.4,
            maxTimer: 0.4,
            seed: Math.random(),
          });
          
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          
          if (proj.piercing && proj.hitCount && proj.hitCount > 1) {
            proj.hitCount--;
            const projHits = projectileOrbHits.current.get(proj.id) || new Set();
            projHits.add(orb.id);
            projectileOrbHits.current.set(proj.id, projHits);
          } else {
            projectileOrbHits.current.delete(proj.id);
            hitSomething = true;
            break;
          }
        }
      }
      
      for (const powerUp of powerUps) {
        if (hitPowerUpsThisFrame.current.has(powerUp.id) || powerUp.collected) continue;
        
        const [pux, puy, puz] = powerUp.position;
        const dx2 = (px - pux) ** 2;
        const dy2 = (py - puy) ** 2;
        const dist = Math.sqrt(dx2 + dy2);
        
        if (dist < 1.5) {
          hitPowerUpsThisFrame.current.add(powerUp.id);
          removePowerUp(powerUp.id);
          hitSomething = true;
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          playSuccess();
          
          if (powerUp.type === "shield") {
            activateShield();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#00ffff", "#00ff00"]));
          } else if (powerUp.type === "chargeBeam") {
            activateChargeBeam();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#ffff00", "#ff6600"]));
          } else if (powerUp.type === "healing") {
            heal();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#00ff88", "#ffffff"]));
          } else if (powerUp.type === "doubleCoins") {
            activateDoubleCoins();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#ffd700", "#ffaa00"]));
          } else if (powerUp.type === "rapidFire") {
            activateRapidFire();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#ff4400", "#ff0000"]));
          }
          
          addScore(25);
          break;
        }
      }
      
      if (!hitSomething) {
        updatedProjectiles.push({ 
          ...proj, 
          position: [px, py, pz], 
          direction: [dx, dy, dz],
          hitCount: proj.hitCount,
          spiralAngle: newSpiralAngle,
        });
      } else {
        projectileOrbHits.current.delete(proj.id);
      }
    }
    
    for (const projId of Array.from(projectileOrbHits.current.keys())) {
      if (!updatedProjectiles.find(p => p.id === projId)) {
        projectileOrbHits.current.delete(projId);
      }
    }
    
    updateProjectiles(updatedProjectiles);
  });
  
  return (
    <>
      {projectiles.map((proj) => (
        <ProjectileMesh
          key={proj.id}
          projectile={proj}
          time={clockRef.current}
          trailType={equippedTrail}
          skinColor={projectileColor}
          skinColors={skinColors}
          equippedSkin={equippedSkin}
        />
      ))}
      {impactEffects.map((effect) => (
        <ImpactEffectMesh key={effect.id} effect={effect} time={clockRef.current} skinColors={skinColors} />
      ))}
    </>
  );
}

function createExplosionParticles(position: [number, number, number], customColors?: string[]): Particle[] {
  const particles: Particle[] = [];
  const colors = customColors || ["#ff00ff", "#00ffff", "#ffff00", "#ff6600", "#ffffff", "#ff3388"];
  
  for (let i = 0; i < 20; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 2.5 + Math.random() * 4;
    
    particles.push({
      id: `exp-${Date.now()}-${i}`,
      position: [...position],
      velocity: [
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ],
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
    });
  }
  
  return particles;
}

function createPowerUpParticles(position: [number, number, number], colors: string[]): Particle[] {
  const particles: Particle[] = [];
  
  for (let i = 0; i < 25; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 3.5 + Math.random() * 4.5;
    
    particles.push({
      id: `pup-${Date.now()}-${i}`,
      position: [...position],
      velocity: [
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ],
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.6 + Math.random() * 0.35,
      maxLife: 0.95,
    });
  }
  
  return particles;
}
