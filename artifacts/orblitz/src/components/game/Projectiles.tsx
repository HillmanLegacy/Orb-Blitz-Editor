import { useRef, useMemo, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, Projectile, Particle, ImpactEffect } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop, TrailEffect } from "@/lib/stores/useShop";
import { getSkinColors } from "./PlayerOrb";
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

// ── Per-skin orb style config ──────────────────────────────────────────────
interface OrbStyle {
  spinX: number; spinY: number; spinZ: number;
  pulseFreq: number; pulseAmp: number;
  shellOpacity: number;
  glowScale: number; glowOpacity: number;
  rings: { tiltX: number; tiltZ: number; speed: number; radius: number; tube: number; color: string }[];
  satellites: { count: number; dist: number; speed: number; color: string }[];
  mode: "normal" | "rainbow" | "aurora" | "void" | "electric" | "flame" | "crystal";
}

const ORB_STYLES: Record<string, OrbStyle> = {
  default:  { spinX:1.2, spinY:1.8, spinZ:0.4, pulseFreq:7,  pulseAmp:0.08, shellOpacity:0.35, glowScale:3.8, glowOpacity:0.09, rings:[], satellites:[], mode:"normal" },
  golden:   { spinX:0.6, spinY:1.0, spinZ:0.3, pulseFreq:4,  pulseAmp:0.10, shellOpacity:0.45, glowScale:4.2, glowOpacity:0.14, rings:[{tiltX:1.1,tiltZ:0.3,speed:2.5,radius:1.7,tube:0.055,color:"#ffdd88"}], satellites:[{count:3,dist:2.2,speed:4,color:"#ffe066"}], mode:"normal" },
  neon:     { spinX:2.5, spinY:1.5, spinZ:1.0, pulseFreq:14, pulseAmp:0.14, shellOpacity:0.50, glowScale:4.5, glowOpacity:0.16, rings:[{tiltX:0.4,tiltZ:1.2,speed:6,radius:1.6,tube:0.04,color:"#00ffff"},{tiltX:1.5,tiltZ:0.3,speed:-4,radius:1.9,tube:0.03,color:"#ff00ff"}], satellites:[], mode:"electric" },
  rainbow:  { spinX:1.0, spinY:2.0, spinZ:0.5, pulseFreq:10, pulseAmp:0.12, shellOpacity:0.40, glowScale:4.0, glowOpacity:0.12, rings:[], satellites:[{count:4,dist:2.0,speed:8,color:"#ffffff"}], mode:"rainbow" },
  crystal:  { spinX:0.8, spinY:1.4, spinZ:0.6, pulseFreq:5,  pulseAmp:0.07, shellOpacity:0.25, glowScale:3.5, glowOpacity:0.11, rings:[{tiltX:0.8,tiltZ:0.5,speed:1.5,radius:1.8,tube:0.04,color:"#eeffff"}], satellites:[], mode:"crystal" },
  void:     { spinX:0.5, spinY:0.8, spinZ:1.2, pulseFreq:3,  pulseAmp:0.12, shellOpacity:0.55, glowScale:3.2, glowOpacity:0.08, rings:[{tiltX:0.6,tiltZ:1.0,speed:-2,radius:1.6,tube:0.06,color:"#aa44ff"}], satellites:[{count:3,dist:1.8,speed:-3,color:"#660088"}], mode:"void" },
  plasma:   { spinX:3.0, spinY:1.0, spinZ:2.0, pulseFreq:16, pulseAmp:0.16, shellOpacity:0.50, glowScale:4.5, glowOpacity:0.18, rings:[{tiltX:1.0,tiltZ:0.4,speed:7,radius:1.5,tube:0.05,color:"#ff88ff"},{tiltX:0.3,tiltZ:1.3,speed:-5,radius:1.8,tube:0.035,color:"#ffffff"}], satellites:[], mode:"electric" },
  galaxy:   { spinX:1.5, spinY:2.5, spinZ:0.3, pulseFreq:6,  pulseAmp:0.09, shellOpacity:0.40, glowScale:4.0, glowOpacity:0.13, rings:[{tiltX:0.5,tiltZ:0.2,speed:3,radius:2.0,tube:0.05,color:"#8888ff"},{tiltX:1.2,tiltZ:0.8,speed:-2,radius:1.6,tube:0.035,color:"#aaddff"}], satellites:[{count:5,dist:2.3,speed:5,color:"#ffffff"}], mode:"normal" },
  phoenix:  { spinX:2.0, spinY:1.2, spinZ:0.8, pulseFreq:12, pulseAmp:0.13, shellOpacity:0.45, glowScale:4.5, glowOpacity:0.18, rings:[], satellites:[{count:4,dist:1.9,speed:6,color:"#ffcc44"}], mode:"flame" },
  shadow:   { spinX:0.4, spinY:0.7, spinZ:0.5, pulseFreq:3,  pulseAmp:0.06, shellOpacity:0.60, glowScale:2.8, glowOpacity:0.05, rings:[{tiltX:0.9,tiltZ:0.6,speed:-1.5,radius:1.7,tube:0.05,color:"#333355"}], satellites:[], mode:"void" },
  aurora:   { spinX:1.0, spinY:1.6, spinZ:0.4, pulseFreq:5,  pulseAmp:0.10, shellOpacity:0.38, glowScale:4.2, glowOpacity:0.14, rings:[{tiltX:0.7,tiltZ:0.3,speed:2,radius:1.8,tube:0.045,color:"#00ffcc"}], satellites:[{count:3,dist:2.1,speed:3,color:"#ff88cc"}], mode:"aurora" },
  diamond:  { spinX:1.2, spinY:2.0, spinZ:0.8, pulseFreq:8,  pulseAmp:0.09, shellOpacity:0.30, glowScale:4.0, glowOpacity:0.12, rings:[{tiltX:0.5,tiltZ:1.0,speed:3,radius:1.7,tube:0.04,color:"#ccffff"},{tiltX:1.3,tiltZ:0.2,speed:-2,radius:1.5,tube:0.03,color:"#ffffff"}], satellites:[], mode:"crystal" },
  inferno:  { spinX:2.5, spinY:1.0, spinZ:1.5, pulseFreq:14, pulseAmp:0.15, shellOpacity:0.45, glowScale:4.8, glowOpacity:0.20, rings:[], satellites:[{count:5,dist:2.0,speed:8,color:"#ff6600"}], mode:"flame" },
  frost:    { spinX:0.7, spinY:1.3, spinZ:0.5, pulseFreq:5,  pulseAmp:0.07, shellOpacity:0.30, glowScale:3.8, glowOpacity:0.11, rings:[{tiltX:1.0,tiltZ:0.5,speed:1.8,radius:1.9,tube:0.045,color:"#aaeeff"}], satellites:[{count:4,dist:2.2,speed:-2.5,color:"#ffffff"}], mode:"crystal" },
  toxic:    { spinX:1.8, spinY:1.0, spinZ:1.2, pulseFreq:11, pulseAmp:0.13, shellOpacity:0.45, glowScale:4.2, glowOpacity:0.15, rings:[{tiltX:0.6,tiltZ:0.8,speed:4,radius:1.6,tube:0.05,color:"#aaff44"}], satellites:[], mode:"electric" },
  electric: { spinX:4.0, spinY:2.0, spinZ:3.0, pulseFreq:18, pulseAmp:0.18, shellOpacity:0.50, glowScale:5.0, glowOpacity:0.22, rings:[{tiltX:0.3,tiltZ:1.5,speed:9,radius:1.5,tube:0.04,color:"#ffffff"},{tiltX:1.4,tiltZ:0.2,speed:-7,radius:1.8,tube:0.03,color:"#88ffff"}], satellites:[], mode:"electric" },
};

function ProjectileMesh({ projectile, time, trailType, skinColor, skinColors, equippedSkin }: {
  projectile: Projectile;
  time: number;
  trailType: TrailEffect;
  skinColor: string;
  skinColors: { core: string; glow: string; emissive: string; accent: string; particles: string[] };
  equippedSkin: string;
}) {
  const dirAngle     = Math.atan2(projectile.direction[1], projectile.direction[0]);
  const orbGroupRef  = useRef<THREE.Group>(null);
  const coreMatRef   = useRef<THREE.MeshBasicMaterial>(null);
  const shellMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const outerMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const spawnTime    = useRef(time);
  const spawnProgress = Math.min(1, (time - spawnTime.current) * 6);

  const style = ORB_STYLES[equippedSkin] ?? ORB_STYLES.default;
  const isCharged = projectile.isCharged;
  const baseScale = (isCharged ? 0.26 : 0.16) * (0.2 + spawnProgress * 0.8);

  useFrame(() => {
    const t = time;
    if (orbGroupRef.current) {
      orbGroupRef.current.rotation.x = t * style.spinX;
      orbGroupRef.current.rotation.y = t * style.spinY;
      orbGroupRef.current.rotation.z = t * style.spinZ;
    }

    const pulse = 1 + Math.sin(t * style.pulseFreq) * style.pulseAmp;

    // Color-cycling modes
    if (style.mode === "rainbow" && coreMatRef.current && shellMatRef.current) {
      const h = (t * 55) % 360;
      const c = new THREE.Color().setHSL(h / 360, 1.0, 0.6);
      coreMatRef.current.color.copy(c);
      shellMatRef.current.color.copy(c);
      if (outerMatRef.current) outerMatRef.current.color.copy(c);
    }
    if (style.mode === "aurora" && coreMatRef.current) {
      const h = 140 + Math.sin(t * 0.7) * 70;
      coreMatRef.current.color.setHSL(h / 360, 1.0, 0.55);
    }
    if (style.mode === "electric" && orbGroupRef.current) {
      const jitter = Math.sin(t * 40) * 0.03;
      orbGroupRef.current.scale.setScalar(baseScale * pulse * (1 + jitter));
    } else if (orbGroupRef.current) {
      orbGroupRef.current.scale.setScalar(baseScale * pulse);
    }
    if (style.mode === "flame" && outerMatRef.current) {
      outerMatRef.current.opacity = 0.12 + Math.abs(Math.sin(t * 8)) * 0.14;
    }
  });

  return (
    <group position={projectile.position}>
      {/* Trail */}
      {trailType !== "none" && spawnProgress >= 0.4 && (
        <MemoizedHDTrailEffect
          trailType={trailType}
          time={time}
          direction={projectile.direction}
          baseScale={baseScale}
          projectileColor={skinColor}
        />
      )}

      {/* Wide outer soft glow */}
      <mesh scale={baseScale * style.glowScale}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial ref={outerMatRef} color={skinColor} transparent opacity={style.glowOpacity} depthWrite={false} />
      </mesh>

      {/* Motion smear in travel direction */}
      <mesh
        position={[-projectile.direction[0] * baseScale * 0.9, -projectile.direction[1] * baseScale * 0.9, 0]}
        rotation={[0, 0, dirAngle]}
        scale={[baseScale * 2.2, baseScale * 0.7, baseScale * 0.7]}
      >
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color={skinColor} transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* Orbital rings */}
      {style.rings.map((r, ri) => (
        <group key={ri} rotation={[r.tiltX, 0, r.tiltZ + time * r.speed]}>
          <mesh>
            <torusGeometry args={[r.radius * baseScale, r.tube * baseScale, 6, 32]} />
            <meshBasicMaterial color={r.color} transparent opacity={0.7} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* Orbiting satellite dots */}
      {style.satellites.flatMap((sat, gi) =>
        Array.from({ length: sat.count }, (_, si) => {
          const ang = (si / sat.count) * Math.PI * 2 + time * sat.speed;
          const d   = sat.dist * baseScale;
          return (
            <mesh key={`${gi}-${si}`} position={[Math.cos(ang) * d, Math.sin(ang) * d, Math.sin(ang * 0.7) * d * 0.4]}>
              <sphereGeometry args={[baseScale * 0.18, 4, 3]} />
              <meshBasicMaterial color={sat.color} transparent opacity={0.9} depthWrite={false} />
            </mesh>
          );
        })
      )}

      {/* 3D Orb body — rotates to show depth */}
      <group ref={orbGroupRef}>
        {/* Cel outline (back-face scale-up) */}
        <mesh scale={1.22}>
          <icosahedronGeometry args={[baseScale, 1]} />
          <meshBasicMaterial color="#0a0a0a" side={THREE.BackSide} depthWrite={false} />
        </mesh>

        {/* Semi-transparent shell for translucent depth */}
        <mesh>
          <sphereGeometry args={[baseScale * 1.12, 10, 8]} />
          <meshBasicMaterial ref={shellMatRef} color={skinColors.glow} transparent opacity={style.shellOpacity} depthWrite={false} />
        </mesh>

        {/* Core faceted body */}
        <mesh>
          <icosahedronGeometry args={[baseScale, 1]} />
          <meshBasicMaterial ref={coreMatRef} color={skinColor} />
        </mesh>

        {/* Dark shadow hemisphere — faked ambient occlusion */}
        <mesh position={[0, -baseScale * 0.25, -baseScale * 0.15]} scale={[1, 0.6, 0.7]}>
          <sphereGeometry args={[baseScale * 0.95, 8, 6]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>

        {/* Specular highlight — upper-left bright dot */}
        <mesh position={[-baseScale * 0.28, baseScale * 0.28, baseScale * 0.6]}>
          <sphereGeometry args={[baseScale * 0.22, 5, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} />
        </mesh>

        {/* Secondary specular */}
        <mesh position={[-baseScale * 0.48, baseScale * 0.12, baseScale * 0.52]}>
          <sphereGeometry args={[baseScale * 0.10, 4, 3]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.65} depthWrite={false} />
        </mesh>

        {/* Inner emissive glow (void/shadow gets dark inner) */}
        <mesh>
          <sphereGeometry args={[baseScale * 0.58, 6, 5]} />
          <meshBasicMaterial
            color={style.mode === "void" ? "#000000" : "#ffffff"}
            transparent opacity={style.mode === "void" ? 0.5 : 0.30}
            depthWrite={false}
          />
        </mesh>

        {/* Equatorial band 1 — spins independently on Y */}
        <mesh rotation={[0, time * 4.5, Math.PI * 0.15]}>
          <torusGeometry args={[baseScale * 0.88, baseScale * 0.045, 5, 24]} />
          <meshBasicMaterial color={skinColors.accent} transparent opacity={0.65} depthWrite={false} />
        </mesh>

        {/* Equatorial band 2 — counter-rotation, different tilt */}
        <mesh rotation={[Math.PI * 0.55, -time * 3.2, 0]}>
          <torusGeometry args={[baseScale * 0.80, baseScale * 0.030, 5, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.40} depthWrite={false} />
        </mesh>

        {/* Hot core — tiny bright sphere at the very center */}
        <mesh>
          <sphereGeometry args={[baseScale * 0.28, 5, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.92} depthWrite={false} />
        </mesh>
      </group>

      {/* Charged shot: extra energy rings */}
      {isCharged && (
        <>
          <mesh scale={baseScale * 2.6} rotation={[Math.PI / 2, 0, time * 4]}>
            <torusGeometry args={[1, 0.08, 6, 28]} />
            <meshBasicMaterial color={skinColors.emissive} transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <mesh scale={baseScale * 3.1} rotation={[0.8, 0, -time * 3]}>
            <torusGeometry args={[1, 0.05, 6, 28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </>
      )}
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
