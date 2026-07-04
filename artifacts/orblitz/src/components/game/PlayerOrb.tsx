import { useRef, useMemo, memo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop, OrbSkin, RingStyle } from "@/lib/stores/useShop";
import { ToonOrbLayer, CelOutline, RayTracedGlow, AmbientOcclusionLayer, GlobalIlluminationBounce, ScreenSpaceReflection, CausticPattern } from "./ToonShaders";
import { PlayerModel } from "./PlayerModel";
import { PlayerParticles } from "./PlayerParticles";
import { FlameAura } from "./FlameAura";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";

const sharedCircleGeo = new THREE.CircleGeometry(1, 32);
const sharedCircleGeoLow = new THREE.CircleGeometry(1, 16);
const sharedCircleGeoHD = new THREE.CircleGeometry(1, 48);
const sharedRingGeo = new THREE.RingGeometry(0.85, 1, 48);
const sharedPlaneGeo = new THREE.PlaneGeometry(1, 1);

export const getSkinColors = (skin: OrbSkin, health: number) => {
  switch (skin) {
    case "golden":
      return { 
        core: "#ffd700", 
        glow: "#ffaa00", 
        emissive: "#ff8800",
        accent: "#fff4cc",
        projectile: "#ffd700",
        particles: ["#ffd700", "#ffaa00", "#ffffff", "#fff4cc"]
      };
    case "neon":
      return { 
        core: "#00ff88", 
        glow: "#00ffff", 
        emissive: "#ff00ff",
        accent: "#88ffff",
        projectile: "#00ff88",
        particles: ["#00ff88", "#00ffff", "#ff00ff", "#88ff88"]
      };
    case "rainbow":
      return { 
        core: "#ff00ff", 
        glow: "#00ffff", 
        emissive: "#ffff00", 
        isRainbow: true,
        accent: "#ffffff",
        projectile: "#ff00ff",
        particles: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#00ffff", "#ff00ff"]
      };
    case "crystal":
      return { 
        core: "#aaddff", 
        glow: "#ffffff", 
        emissive: "#88aaff", 
        transparent: true,
        accent: "#eeffff",
        projectile: "#88ddff",
        particles: ["#aaddff", "#ffffff", "#88ccff", "#ccffff"]
      };
    case "void":
      return { 
        core: "#440066", 
        glow: "#660088", 
        emissive: "#8800aa",
        accent: "#aa66cc",
        projectile: "#9933ff",
        particles: ["#440066", "#660088", "#8800aa", "#330044"]
      };
    case "plasma":
      return {
        core: "#ff44ff",
        glow: "#aa00ff",
        emissive: "#ff00aa",
        accent: "#ff88ff",
        projectile: "#ff44ff",
        particles: ["#ff44ff", "#aa00ff", "#ff00aa", "#ff88ff"]
      };
    case "galaxy":
      return {
        core: "#4400ff",
        glow: "#0088ff",
        emissive: "#8800ff",
        accent: "#88aaff",
        projectile: "#6644ff",
        particles: ["#4400ff", "#0088ff", "#8800ff", "#ffffff"]
      };
    case "phoenix":
      return {
        core: "#ff4400",
        glow: "#ff8800",
        emissive: "#ffcc00",
        accent: "#ffaa44",
        projectile: "#ff6600",
        particles: ["#ff4400", "#ff8800", "#ffcc00", "#ff0000"]
      };
    case "shadow":
      return {
        core: "#222233",
        glow: "#444466",
        emissive: "#666688",
        accent: "#8888aa",
        projectile: "#6666aa",
        particles: ["#222233", "#444466", "#666688", "#333344"]
      };
    case "aurora":
      return {
        core: "#00ffaa",
        glow: "#00aaff",
        emissive: "#ff00aa",
        accent: "#88ffcc",
        projectile: "#00ffcc",
        particles: ["#00ffaa", "#00aaff", "#ff00aa", "#88ffcc"]
      };
    case "diamond":
      return {
        core: "#ffffff",
        glow: "#aaddff",
        emissive: "#88aaff",
        accent: "#ffffff",
        projectile: "#aaddff",
        particles: ["#ffffff", "#aaddff", "#ccffff", "#88aaff"]
      };
    case "inferno":
      return {
        core: "#ff2200",
        glow: "#ff6600",
        emissive: "#ff0000",
        accent: "#ffaa00",
        projectile: "#ff4400",
        particles: ["#ff2200", "#ff6600", "#ff0000", "#ffaa00"]
      };
    case "frost":
      return {
        core: "#88ddff",
        glow: "#aaeeff",
        emissive: "#66ccff",
        accent: "#ffffff",
        projectile: "#88eeff",
        particles: ["#88ddff", "#aaeeff", "#ffffff", "#66ccff"]
      };
    case "toxic":
      return {
        core: "#88ff00",
        glow: "#aaff44",
        emissive: "#66cc00",
        accent: "#ccff88",
        projectile: "#88ff00",
        particles: ["#88ff00", "#aaff44", "#66cc00", "#ccff88"]
      };
    case "electric":
      return {
        core: "#ffff00",
        glow: "#88ffff",
        emissive: "#ffffff",
        accent: "#ffffaa",
        projectile: "#ffff44",
        particles: ["#ffff00", "#88ffff", "#ffffff", "#ffffaa"]
      };
    default:
      return { 
        core: "#ffffff", 
        glow: "#ccddff",
        emissive: "#aaccff",
        isLuminous: true,
        accent: "#ffffff",
        projectile: "#ffffff",
        particles: ["#ffffff", "#ccddff", "#aaccff", "#88aaff"]
      };
  }
};

interface RingConfig {
  count: number;
  colors: string[];
  spiral?: boolean;
  pulse?: boolean;
  orbit?: boolean;
  halo?: boolean;
  shield?: boolean;
  hex?: boolean;
  prism?: boolean;
  segments?: number;
  thickness?: number;
  glowIntensity?: number;
}

const getRingConfig = (style: RingStyle): RingConfig => {
  switch (style) {
    case "double":
      return { 
        count: 2, 
        colors: ["#ff00ff", "#00ffff"],
        segments: 64,
        thickness: 0.08,
        glowIntensity: 0.8
      };
    case "triple":
      return { 
        count: 3, 
        colors: ["#ff00ff", "#00ffff", "#ffff00"],
        segments: 64,
        thickness: 0.07,
        glowIntensity: 0.85
      };
    case "spiral":
      return { 
        count: 5, 
        colors: ["#ff00ff", "#00ffff", "#ffff00", "#ff6600", "#00ff88"], 
        spiral: true,
        segments: 48,
        thickness: 0.06,
        glowIntensity: 0.9
      };
    case "pulse":
      return { 
        count: 3, 
        colors: ["#00ffff", "#0088ff", "#00ccff"],
        pulse: true,
        segments: 64,
        thickness: 0.05,
        glowIntensity: 1.0
      };
    case "orbit":
      return { 
        count: 6, 
        colors: ["#ff00ff", "#00ffff", "#ffff00", "#ff6600", "#00ff88", "#ff0088"],
        orbit: true,
        segments: 32,
        thickness: 0.04,
        glowIntensity: 0.9
      };
    case "halo":
      return { 
        count: 2, 
        colors: ["#ffd700", "#fff8dc"],
        halo: true,
        segments: 96,
        thickness: 0.1,
        glowIntensity: 1.2
      };
    case "shield":
      return { 
        count: 1, 
        colors: ["#00ffff"],
        shield: true,
        segments: 6,
        thickness: 0.08,
        glowIntensity: 0.95
      };
    case "hex":
      return { 
        count: 3, 
        colors: ["#ff00ff", "#00ffff", "#ffff00"],
        hex: true,
        segments: 6,
        thickness: 0.06,
        glowIntensity: 0.85
      };
    case "prism":
      return { 
        count: 4, 
        colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
        prism: true,
        segments: 3,
        thickness: 0.07,
        glowIntensity: 1.1
      };
    case "none":
    case "default":
      return { count: 0, colors: [], segments: 0 };
    default:
      return { 
        count: 2, 
        colors: ["#ff00ff", "#00ffff"],
        segments: 64,
        thickness: 0.08,
        glowIntensity: 0.8
      };
  }
};

interface OrbParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  colorIndex: number;
  orbitTilt: number;
  phase: number;
}

interface EnergyRay {
  angle: number;
  length: number;
  speed: number;
  width: number;
  phase: number;
}

function EnergyWaves({ scale, glowColor, dimFactor }: { scale: number; glowColor: string; dimFactor: number }) {
  const wave1Ref = useRef<THREE.Mesh>(null);
  const wave2Ref = useRef<THREE.Mesh>(null);
  const wave3Ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    const animateWave = (ref: React.RefObject<THREE.Mesh | null>, offset: number) => {
      if (ref.current) {
        const cycle = ((time * 0.4 + offset) % 3) / 3;
        const waveScale = scale * (1.2 + cycle * 2);
        ref.current.scale.setScalar(waveScale);
        const mat = ref.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.15 * (1 - cycle) * dimFactor;
      }
    };
    
    animateWave(wave1Ref, 0);
    animateWave(wave2Ref, 1);
    animateWave(wave3Ref, 2);
  });
  
  return (
    <group position={[0, 0, -0.05]}>
      <mesh ref={wave1Ref}>
        <ringGeometry args={[0.95, 1, 32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wave2Ref}>
        <ringGeometry args={[0.95, 1, 32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wave3Ref}>
        <ringGeometry args={[0.95, 1, 32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function PlayerGlow({
  scale,
  coreColor,
  glowColor,
  isRainbow = false,
}: {
  scale: number;
  coreColor: string;
  glowColor: string;
  isRainbow?: boolean;
}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const midRef   = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const pulse = (Math.sin(t * 2.4) + 1) * 0.5; // 0..1

    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + pulse * 0.14;
      if (isRainbow) mat.color.setHSL(t * 0.15 % 1, 1, 0.6);
    }
    if (midRef.current) {
      const mat = midRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + pulse * 0.07;
      if (isRainbow) mat.color.setHSL((t * 0.15 + 0.33) % 1, 1, 0.6);
    }
    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.04 + pulse * 0.03;
      if (isRainbow) mat.color.setHSL((t * 0.15 + 0.66) % 1, 1, 0.6);
    }
  });

  return (
    <>
      {/* Inner glow — tight halo, core colour */}
      <mesh ref={innerRef} scale={scale * 1.15}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={coreColor} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* Mid glow — wider, glow colour */}
      <mesh ref={midRef} scale={scale * 1.45}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.11} depthWrite={false} />
      </mesh>
      {/* Outer glow — soft far corona */}
      <mesh ref={outerRef} scale={scale * 1.85}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.05} depthWrite={false} />
      </mesh>
    </>
  );
}

function ShieldEffect({ scale }: { scale: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.9;
    groupRef.current.rotation.x = t * 0.55;
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[scale * 2.5, 1]} />
        <meshBasicMaterial color="#001a1a" side={THREE.BackSide} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[scale * 2.5, 1]} />
        <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[scale * 2.5, 12, 10]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.05} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ChargeBeamEffect({ scale }: { scale: number }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (r1.current) r1.current.rotation.z = t * 3.0;
    if (r2.current) r2.current.rotation.z = -t * 2.2;
  });
  return (
    <>
      <mesh ref={r1}>
        <torusGeometry args={[scale * 1.9, scale * 0.04, 8, 32]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI * 0.35, 0, 0]}>
        <torusGeometry args={[scale * 2.1, scale * 0.03, 8, 28]} />
        <meshBasicMaterial color="#ffcc00" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </>
  );
}

export function PlayerOrb() {
  const coreRef = useRef<THREE.Mesh>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const particleRefs = useRef<THREE.Mesh[]>([]);
  const rayRefs = useRef<THREE.Mesh[]>([]);
  
  const { health, maxHealth, hasShield, hasChargeBeam, isDamaged, isDying, deathTimer, playerPosition, magiOrb2Active } = useMagicOrb();
  const { equippedSkin, equippedRing, equippedTrail } = useShop();
  
  const healthRatio = health / maxHealth;
  
  const scale = useMemo(() => {
    const baseScale = 0.72;
    const minScale = 0.432;
    return minScale + (baseScale - minScale) * healthRatio;
  }, [healthRatio]);
  
  const dimFactor = useMemo(() => {
    return 0.3 + healthRatio * 0.7;
  }, [healthRatio]);
  
  const skinColors = useMemo(() => getSkinColors(equippedSkin, health), [equippedSkin, health]);
  const ringConfig = useMemo(() => getRingConfig(equippedRing), [equippedRing]);
  
  const orbParticles = useMemo<OrbParticle[]>(() => {
    const particles: OrbParticle[] = [];
    for (let i = 0; i < 24; i++) {
      particles.push({
        angle: (i / 24) * Math.PI * 2,
        radius: 0.8 + Math.random() * 0.4,
        speed: 0.8 + Math.random() * 1.2,
        size: 0.04 + Math.random() * 0.06,
        colorIndex: Math.floor(Math.random() * 4),
        orbitTilt: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return particles;
  }, []);
  
  const energyRays = useMemo<EnergyRay[]>(() => {
    const rays: EnergyRay[] = [];
    for (let i = 0; i < 8; i++) {
      rays.push({
        angle: (i / 8) * Math.PI * 2,
        length: 0.4 + Math.random() * 0.3,
        speed: 0.5 + Math.random() * 0.5,
        width: 0.02 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return rays;
  }, []);
  
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const pulseSpeed = hasChargeBeam ? 10 : 5;
    const pulseAmount = hasChargeBeam ? 0.08 : 0.04;
    
    const damageShake = isDamaged ? Math.sin(time * 60) * 0.12 : 0;
    const breatheScale = 1 + Math.sin(time * 1.5) * 0.02;
    const gentleWobble = Math.sin(time * 2.5) * 0.015;
    const floatY = Math.sin(time * 1.2) * 0.03;
    
    if (groupRef.current && !isDying) {
      groupRef.current.rotation.z = gentleWobble;
      groupRef.current.position.y = playerPosition[1] + floatY;
    }
    
    if (coreRef.current && !isDying) {
      const coreScale = scale * breatheScale + Math.sin(time * pulseSpeed) * pulseAmount;
      coreRef.current.scale.setScalar(coreScale);
      coreRef.current.position.x = damageShake;
      
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      
      if ((skinColors as any).isRainbow) {
        const hue = (time * 0.2) % 1;
        mat.color.setHSL(hue, 0.9, 0.65);
      }
    }
    
    if (innerCoreRef.current && !isDying) {
      innerCoreRef.current.scale.setScalar(scale * 0.5 + Math.sin(time * pulseSpeed * 1.5) * 0.03);
      innerCoreRef.current.rotation.z = time * 0.5;
    }
    
    if (glowRef.current && !isDying) {
      const glowScale = scale * 1.6 + Math.sin(time * 4) * 0.1;
      glowRef.current.scale.setScalar(glowScale);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = isDamaged ? 0.7 : 0.35 + Math.sin(time * 6) * 0.1;
      mat.opacity = baseOpacity * dimFactor;
      
      if ((skinColors as any).isRainbow) {
        const hue = (time * 0.2 + 0.33) % 1;
        mat.color.setHSL(hue, 1, 0.55);
      }
    }
    
    if (outerGlowRef.current && !isDying) {
      const outerScale = scale * 2.2 + Math.sin(time * 3 + 1) * 0.15;
      outerGlowRef.current.scale.setScalar(outerScale);
      const mat = outerGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.15 + Math.sin(time * 4) * 0.05) * dimFactor;
      
      if ((skinColors as any).isRainbow) {
        const hue = (time * 0.2 + 0.66) % 1;
        mat.color.setHSL(hue, 1, 0.5);
      }
    }
    
    particleRefs.current.forEach((mesh, i) => {
      if (mesh && orbParticles[i]) {
        const p = orbParticles[i];
        const angle = p.angle + time * p.speed;
        const radiusMod = p.radius + Math.sin(time * 2 + p.phase) * 0.1;
        const x = Math.cos(angle) * radiusMod * scale;
        const y = Math.sin(angle) * radiusMod * scale + Math.sin(time * 3 + p.phase) * p.orbitTilt * scale;
        mesh.position.set(x, y, 0.02);
        
        const particleScale = p.size * (0.8 + Math.sin(time * 8 + p.phase) * 0.3);
        mesh.scale.setScalar(particleScale);
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.6 + Math.sin(time * 6 + p.phase) * 0.3) * dimFactor;
      }
    });
    
    rayRefs.current.forEach((mesh, i) => {
      if (mesh && energyRays[i]) {
        const r = energyRays[i];
        const angle = r.angle + time * r.speed;
        const lengthMod = r.length * (0.7 + Math.sin(time * 4 + r.phase) * 0.4);
        mesh.rotation.z = angle;
        mesh.scale.set(lengthMod * scale * 2, r.width * scale, 1);
        mesh.position.set(
          Math.cos(angle) * scale * 0.9 + Math.cos(angle) * lengthMod * scale * 0.5,
          Math.sin(angle) * scale * 0.9 + Math.sin(angle) * lengthMod * scale * 0.5,
          0.01
        );
        
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.4 + Math.sin(time * 5 + r.phase) * 0.25) * dimFactor;
      }
    });
    
    ringRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const direction = i % 2 === 0 ? 1 : -1;
        const speed = 2.5 - i * 0.3;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const glowIntensity = ringConfig.glowIntensity || 0.8;
        
        if (ringConfig.spiral) {
          mesh.rotation.z = time * speed * direction * 1.5;
          mesh.rotation.x = Math.sin(time * 0.9 + i * 0.6) * 0.8;
          mesh.rotation.y = Math.cos(time * 0.7 + i * 0.4) * 0.7;
          mat.opacity = (0.85 - i * 0.08) * dimFactor * glowIntensity;
        } else if (ringConfig.pulse) {
          const pulseScale = 1 + Math.sin(time * 4 + i * 0.8) * 0.15;
          mesh.scale.setScalar(pulseScale);
          mesh.rotation.z = time * 1.5 * direction;
          mat.opacity = (0.6 + Math.sin(time * 6 + i * 1.2) * 0.3) * dimFactor * glowIntensity;
        } else if (ringConfig.orbit) {
          const orbitAngle = time * (2 + i * 0.3) * direction;
          mesh.position.x = Math.cos(orbitAngle) * 0.2;
          mesh.position.y = Math.sin(orbitAngle) * 0.2;
          mesh.rotation.z = time * 3 * direction;
          mesh.rotation.x = Math.sin(time + i) * 0.4;
          mat.opacity = (0.7 + Math.sin(time * 4 + i) * 0.2) * dimFactor * glowIntensity;
        } else if (ringConfig.halo) {
          mesh.rotation.x = Math.PI / 2.5;
          mesh.rotation.z = time * 0.5;
          const haloGlow = 0.7 + Math.sin(time * 2) * 0.25;
          mat.opacity = haloGlow * dimFactor * glowIntensity;
        } else if (ringConfig.shield) {
          mesh.rotation.z = time * 0.8;
          const shieldPulse = 0.9 + Math.sin(time * 3) * 0.1;
          mesh.scale.setScalar(shieldPulse);
          mat.opacity = (0.65 + Math.sin(time * 5) * 0.2) * dimFactor * glowIntensity;
        } else if (ringConfig.hex) {
          mesh.rotation.z = time * 1.2 * direction;
          mesh.rotation.x = (Math.PI / 3) * i;
          mat.opacity = (0.7 + Math.sin(time * 3 + i * 0.7) * 0.2) * dimFactor * glowIntensity;
        } else if (ringConfig.prism) {
          mesh.rotation.z = time * 2 * direction;
          mesh.rotation.x = Math.sin(time * 1.5 + i * 0.5) * 0.5;
          mesh.rotation.y = Math.cos(time * 1.2 + i * 0.3) * 0.4;
          const hue = (time * 0.1 + i * 0.25) % 1;
          mat.color.setHSL(hue, 1, 0.6);
          mat.opacity = (0.8 + Math.sin(time * 4 + i) * 0.15) * dimFactor * glowIntensity;
        } else {
          mesh.rotation.z = time * speed * direction;
          mesh.rotation.x = (Math.PI / 2) + (i * Math.PI / (ringConfig.count + 1)) - Math.PI / 2;
          mat.opacity = (0.75 - i * 0.1) * dimFactor * glowIntensity;
        }
      }
    });
    
    if (shieldRef.current && hasShield) {
      shieldRef.current.rotation.y = time * 3.5;
      shieldRef.current.rotation.x = time * 2.5;
      const mat = shieldRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.45 + Math.sin(time * 12) * 0.2;
    }
  });
  
  const glowColor = hasChargeBeam ? "#ffff00" : (isDamaged ? "#ff0000" : skinColors.glow);
  const coreColor = isDamaged ? "#ff0000" : skinColors.core;
  const phaseOpacity = magiOrb2Active ? 0.3 : 1;
  const accentColor = skinColors.accent;
  const emissiveColor = skinColors.emissive;
  const isLuminous = (skinColors as any).isLuminous;
  
  if (isDying) {
    const progress = 1 - (deathTimer / 1.5);
    return (
      <group position={playerPosition}>
        <EnergyDissipationVFX
          progress={progress}
          color={coreColor}
          glowColor={glowColor}
          scale={scale}
          seed={7}
        />
      </group>
    );
  }
  
  return (
    <group ref={groupRef} position={playerPosition}>
      {/* 3D Player Character Model */}
      <Suspense fallback={
        <mesh scale={scale * 0.92}>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial color={coreColor} transparent opacity={0.9 * phaseOpacity} />
        </mesh>
      }>
        <PlayerModel
          scale={scale}
          coreColor={coreColor}
          glowColor={glowColor}
          isRainbow={(skinColors as any).isRainbow === true}
          rotationSpeedX={0.8}
          rotationSpeedY={1.2}
        />
      </Suspense>


      {/* Swirling 3-D particles — always match the orb core colour */}
      <PlayerParticles
        scale={scale}
        particleColors={[coreColor]}
        isRainbow={(skinColors as any).isRainbow === true}
      />

      {/* Flame Aura cosmetic trail */}
      {equippedTrail === "flame_aura" && <FlameAura scale={scale} />}

      {/* Hidden refs kept so useFrame doesn't throw on null checks */}
      <mesh ref={coreRef} visible={false}>
        <circleGeometry args={[1, 4]} />
        <meshBasicMaterial />
      </mesh>
      <mesh ref={innerCoreRef} visible={false}>
        <circleGeometry args={[1, 4]} />
        <meshBasicMaterial />
      </mesh>
      <mesh ref={glowRef} visible={false}>
        <circleGeometry args={[1, 4]} />
        <meshBasicMaterial />
      </mesh>
      <mesh ref={outerGlowRef} visible={false}>
        <circleGeometry args={[1, 4]} />
        <meshBasicMaterial />
      </mesh>


      {/* Shield power-up — rotating 3D wireframe icosahedron */}
      {hasShield && <ShieldEffect scale={scale} />}

      {/* Charge beam power-up indicator — spinning 3D torus rings */}
      {hasChargeBeam && <ChargeBeamEffect scale={scale} />}
    </group>
  );
}
