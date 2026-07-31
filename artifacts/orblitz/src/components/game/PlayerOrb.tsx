import { useRef, useMemo, memo, Suspense, useEffect, useState } from "react";
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

// ── Heal Aura — 3D orbiting particle cloud (green), blooms from player center ──
// Particles start at near-zero radius (matching where teleport VFX just converged)
// and expand outward to their orbit radii — visually the teleport particles become
// this sustained cloud.
const _HEAL_DUR    = 1.5;
const _HEAL_N      = 22;
const _healGeo     = new THREE.SphereGeometry(1, 5, 4);
const _healDummy   = new THREE.Object3D();
const _healColor   = new THREE.Color();
const _healPal     = [
  new THREE.Color("#00ff77"), // bright green  — matches health icon primary
  new THREE.Color("#33ffaa"), // mint-green    — matches health icon secondary
  new THREE.Color("#aaffd4"), // pale seafoam  — white-tinted highlight
];

interface _HealWisp {
  orbitSpeed: number; phase: number;
  axisX: number; axisY: number;
  targetRadius: number; size: number; colorT: number;
}

function HealAura({ scale, healAnimTimer }: { scale: number; healAnimTimer: number }) {
  const wispRef = useRef<THREE.InstancedMesh>(null);

  // Fixed random layout so particles always orbit in stable 3D planes
  const wisps = useMemo<_HealWisp[]>(() =>
    Array.from({ length: _HEAL_N }, () => ({
      orbitSpeed:   (3.5 + Math.random() * 4.0) * (Math.random() < 0.5 ? 1 : -1),
      phase:        Math.random() * Math.PI * 2,
      axisX:        Math.random() * Math.PI,
      axisY:        Math.random() * Math.PI * 2,
      targetRadius: scale * (0.9 + Math.random() * 0.9),
      size:         0.016 + Math.random() * 0.022,
      colorT:       Math.random(),
    }))
  , [scale]);

  const [mat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    if (!wispRef.current) return;
    const t   = clock.getElapsedTime();
    const age = _HEAL_DUR - healAnimTimer;                    // 0 → 1.5 s

    // Bloom: particles expand from center to orbit radius over first 0.25 s
    const bloom    = Math.min(1, age / 0.25);
    const bloomEase = 1 - Math.pow(1 - bloom, 2);            // ease-out

    // Global alpha: quick fade-in, hold, fade out over last 0.4 s
    const fadeIn   = Math.min(1, age / 0.12);
    const fadeOut  = healAnimTimer > 0 ? Math.min(1, healAnimTimer / 0.4) : 0;
    mat.opacity    = fadeIn * fadeOut * 0.92;

    const im = wispRef.current;
    for (let i = 0; i < _HEAL_N; i++) {
      const w      = wisps[i];
      const r      = w.targetRadius * bloomEase;
      const theta  = t * w.orbitSpeed + w.phase;
      const cx     = Math.cos(w.axisX), sx = Math.sin(w.axisX);
      const cy     = Math.cos(w.axisY), sy = Math.sin(w.axisY);
      const cosT   = Math.cos(theta),   sinT = Math.sin(theta);

      _healDummy.position.set(
        r * (cosT * cy - sinT * sx * sy),
        r * (cosT * sy + sinT * sx * cy),
        r * (sinT * cx),
      );
      _healDummy.scale.setScalar(w.size * (0.55 + 0.45 * Math.sin(t * 8 + i)));
      _healDummy.updateMatrix();
      im.setMatrixAt(i, _healDummy.matrix);

      const ct = ((w.colorT + t * 0.11) % 1 + 1) % 1;
      if (ct < 0.5) _healColor.lerpColors(_healPal[0], _healPal[1], ct * 2);
      else           _healColor.lerpColors(_healPal[1], _healPal[2], (ct - 0.5) * 2);
      im.setColorAt(i, _healColor);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#00ff77" intensity={2.5} distance={5} decay={2} />
      <instancedMesh ref={wispRef} args={[_healGeo, mat, _HEAL_N]} frustumCulled={false} />
    </group>
  );
}

// ── Charge Gather Aura — tiny yellow particles stream inward → become the aura
// Particles converge TO the wisp orbit radius (not to 0) so they are already in
// position when ChargeBeamAura appears, making the handoff seamless.
const _GATHER_DUR   = 1.4;
const _GATHER_N     = 20; // matches _CBA_WISP_N closely for 1-to-1 visual handoff
const _gatherGeo    = new THREE.SphereGeometry(1, 4, 3); // same low-poly as CBA wisps
const _gatherDummy  = new THREE.Object3D();
const _gatherColor  = new THREE.Color();
const _gatherPal    = [
  new THREE.Color("#ffdd00"), // bright yellow  — same as _cbaPalette[0]
  new THREE.Color("#ffaa00"), // amber-gold     — same as _cbaPalette[1]
  new THREE.Color("#ffffff"), // white flash    — same as _cbaPalette[2]
];

// Target orbit radius matches the CBA wisp mid-range so particles land in the same band
const _GATHER_TARGET_R = 1.35; // ×scale  (CBA wisps are 1.1–1.95×scale)
const _GATHER_START_R  = 3.4;  // ×scale  (outside the aura)

interface _GatherParticle {
  orbitSpeed: number; phase: number;
  axisX: number; axisY: number;
  size: number; colorT: number;
}

function ChargeGatherAura({ scale, chargeGatherTimer }: { scale: number; chargeGatherTimer: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Match CBA wisp properties so the visual population looks identical
  const particles = useMemo<_GatherParticle[]>(() =>
    Array.from({ length: _GATHER_N }, () => ({
      orbitSpeed: (4.5 + Math.random() * 6.5) * (Math.random() < 0.5 ? 1 : -1),
      phase:      Math.random() * Math.PI * 2,
      axisX:      Math.random() * Math.PI,
      axisY:      Math.random() * Math.PI * 2,
      size:       0.016 + Math.random() * 0.022, // identical size range as CBA wisps
      colorT:     Math.random(),
    }))
  , []);

  const [mat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t        = clock.getElapsedTime();
    const progress = Math.max(0, 1 - chargeGatherTimer / _GATHER_DUR); // 0→1

    // Ease-in curve: slow start, accelerate toward player
    const ease = 1 - Math.pow(1 - progress, 2.2);

    // Converge from START_R toward TARGET_R (not 0) so they land at wisp orbit
    const startR  = scale * _GATHER_START_R;
    const targetR = scale * _GATHER_TARGET_R;
    const curR    = startR + (targetR - startR) * ease;

    // Alpha: ramp in fast, hold full brightness, fade in final 12% as aura takes over
    const rampUp   = Math.min(1, progress / 0.15);
    const rampDown = progress > 0.88 ? Math.max(0, 1 - (progress - 0.88) / 0.12) : 1;
    mat.opacity    = rampUp * rampDown * 0.95;

    const im = meshRef.current;
    for (let i = 0; i < _GATHER_N; i++) {
      const p     = particles[i];
      const theta = t * p.orbitSpeed + p.phase;
      const cx    = Math.cos(p.axisX), sx = Math.sin(p.axisX);
      const cy    = Math.cos(p.axisY), sy = Math.sin(p.axisY);
      const cosT  = Math.cos(theta),   sinT = Math.sin(theta);
      const px    = curR * (cosT * cy - sinT * sx * sy);
      const py    = curR * (cosT * sy + sinT * sx * cy);
      const pz    = curR * (sinT * cx);

      _gatherDummy.position.set(px, py, pz);
      // Same size animation as CBA wisps — continuous across the handoff
      _gatherDummy.scale.setScalar(p.size * (0.55 + 0.45 * Math.sin(t * 9 + i)));
      _gatherDummy.updateMatrix();
      im.setMatrixAt(i, _gatherDummy.matrix);

      // Same colour cycling as _cbaPalette — identical yellow/amber/white
      const ct = ((p.colorT + t * 0.13) % 1 + 1) % 1;
      if (ct < 0.5) _gatherColor.lerpColors(_gatherPal[0], _gatherPal[1], ct * 2);
      else           _gatherColor.lerpColors(_gatherPal[1], _gatherPal[2], (ct - 0.5) * 2);
      im.setColorAt(i, _gatherColor);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  // Once particles have settled at orbit radius, fade in the full aura so the
  // wisp population (identical size/colour/orbit-speed range) replaces them 1-to-1.
  const progress = Math.max(0, 1 - chargeGatherTimer / _GATHER_DUR);
  const auraFade = Math.max(0, (progress - 0.80) / 0.20);

  return (
    <group>
      <pointLight color="#ffcc00" intensity={progress * 3.5} distance={6} decay={2} />
      <instancedMesh ref={meshRef} args={[_gatherGeo, mat, _GATHER_N]} frustumCulled={false} />
      {auraFade > 0 && <ChargeBeamAura scale={scale} />}
    </group>
  );
}

// ── Charge Beam Aura — golden energy vortex ──────────────────────────────────
// Three counter-rotating rings + fast-orbiting golden wisps. Yellow/amber palette.
const _CBA_WISP_N   = 12;
const _cbaDummy     = new THREE.Object3D();
const _cbaColor     = new THREE.Color();
const _cbaPalette   = [
  new THREE.Color("#ffdd00"), // bright yellow
  new THREE.Color("#ffaa00"), // amber-gold
  new THREE.Color("#ffffff"), // white flash
];
const _cbaWispGeo   = new THREE.SphereGeometry(1, 4, 3);

interface _CBAWisp {
  orbitSpeed: number; phase: number;
  axisX: number; axisY: number;
  baseRadius: number; size: number; colorT: number;
}

function ChargeBeamAura({ scale }: { scale: number }) {
  const wispRef = useRef<THREE.InstancedMesh>(null);

  const wisps = useMemo<_CBAWisp[]>(() =>
    Array.from({ length: _CBA_WISP_N }, () => ({
      orbitSpeed: (4.5 + Math.random() * 6.5) * (Math.random() < 0.5 ? 1 : -1),
      phase:      Math.random() * Math.PI * 2,
      axisX:      Math.random() * Math.PI,
      axisY:      Math.random() * Math.PI * 2,
      baseRadius: scale * (1.1 + Math.random() * 0.85),
      size:       0.016 + Math.random() * 0.022,
      colorT:     Math.random(),
    }))
  , [scale]);

  const [wispMat] = useState(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  useEffect(() => () => { wispMat.dispose(); }, [wispMat]);

  useFrame(({ clock }) => {
    if (!wispRef.current) return;
    const t  = clock.getElapsedTime();
    const im = wispRef.current;
    for (let i = 0; i < _CBA_WISP_N; i++) {
      const w     = wisps[i];
      const theta = t * w.orbitSpeed + w.phase;
      const cx    = Math.cos(w.axisX), sx = Math.sin(w.axisX);
      const cy    = Math.cos(w.axisY), sy = Math.sin(w.axisY);
      const cosT  = Math.cos(theta),   sinT = Math.sin(theta);
      const px    = w.baseRadius * (cosT * cy - sinT * sx * sy);
      const py    = w.baseRadius * (cosT * sy + sinT * sx * cy);
      const pz    = w.baseRadius * (sinT * cx);
      _cbaDummy.position.set(px, py, pz);
      _cbaDummy.scale.setScalar(w.size * (0.55 + 0.45 * Math.sin(t * 9 + i)));
      _cbaDummy.updateMatrix();
      im.setMatrixAt(i, _cbaDummy.matrix);
      const ct = ((w.colorT + t * 0.13) % 1.0 + 1.0) % 1.0;
      if (ct < 0.5) _cbaColor.lerpColors(_cbaPalette[0], _cbaPalette[1], ct * 2);
      else           _cbaColor.lerpColors(_cbaPalette[1], _cbaPalette[2], (ct - 0.5) * 2);
      im.setColorAt(i, _cbaColor);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ffcc00" intensity={3.5} distance={6} decay={2} />
      <instancedMesh ref={wispRef} args={[_cbaWispGeo, wispMat, _CBA_WISP_N]} frustumCulled={false} />
    </group>
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

  // ── Overcharged fire: squash/stretch + recoil ─────────────────────────────
  const squashTimerRef        = useRef(0);          // counts down from 0.08 s
  const recoilVelRef          = useRef([0, 0]);     // velocity (world units/s)
  const recoilOffsetRef       = useRef([0, 0]);     // current offset applied to position
  const prevOcSignalCountRef  = useRef(0);

  // ── Rapid blaster fire: micro squash + recoil ─────────────────────────────
  const rbSquashTimerRef      = useRef(0);          // counts down from 0.04 s
  const rbRecoilVelRef        = useRef([0, 0]);
  const rbRecoilOffsetRef     = useRef([0, 0]);
  const prevRbSignalCountRef  = useRef(0);

  // ── Spiral blaster fire: pull-back + snap squash + recoil ─────────────────
  const sbSquashTimerRef      = useRef(0);          // counts down from 0.06 s
  const sbRecoilVelRef        = useRef([0, 0]);
  const sbRecoilOffsetRef     = useRef([0, 0]);
  const prevSbSignalCountRef  = useRef(0);

  // ── Scattershot fire: wide squash + heavy shotgun recoil ──────────────────
  const scSquashTimerRef      = useRef(0);          // counts down from 0.06 s
  const scRecoilVelRef        = useRef([0, 0]);
  const scRecoilOffsetRef     = useRef([0, 0]);
  const prevScSignalCountRef  = useRef(0);

  // ── Homing blaster fire: forward punch squash + moderate recoil ───────────
  const hmSquashTimerRef      = useRef(0);          // counts down from 0.10 s
  const hmRecoilVelRef        = useRef([0, 0]);
  const hmRecoilOffsetRef     = useRef([0, 0]);
  const prevHmSignalCountRef  = useRef(0);
  
  const { health, maxHealth, hasShield, hasChargeBeam, isDamaged, isDying, deathTimer, playerPosition, magiOrb2Active, healAnimTimer, chargeGatherTimer } = useMagicOrb();
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
  
  
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const pulseSpeed = hasChargeBeam ? 10 : 5;
    const pulseAmount = hasChargeBeam ? 0.08 : 0.04;
    
    const damageShake = isDamaged ? Math.sin(time * 60) * 0.12 : 0;
    const breatheScale = 1 + Math.sin(time * 1.5) * 0.02;
    const gentleWobble = Math.sin(time * 2.5) * 0.015;
    const floatY = Math.sin(time * 1.2) * 0.03;

    // ── Overcharged fire signal → squash + recoil ─────────────────────────
    const ocSig = useMagicOrb.getState().overchargedFireSignal;
    if (ocSig.count !== prevOcSignalCountRef.current) {
      prevOcSignalCountRef.current = ocSig.count;
      squashTimerRef.current = 0.08;
      const RECOIL = 2.2;
      recoilVelRef.current[0] = -ocSig.dirX * RECOIL;
      recoilVelRef.current[1] = -ocSig.dirY * RECOIL;
    }
    // Advance & damp OC recoil (exponential spring-back)
    const damp = Math.exp(-8 * delta);
    recoilOffsetRef.current[0] = (recoilOffsetRef.current[0] + recoilVelRef.current[0] * delta) * damp;
    recoilOffsetRef.current[1] = (recoilOffsetRef.current[1] + recoilVelRef.current[1] * delta) * damp;
    recoilVelRef.current[0] *= damp;
    recoilVelRef.current[1] *= damp;
    // Squash scale (0.7 × 1.3 for 0.08 s, then snap back)
    let sqX = 1, sqY = 1;
    if (squashTimerRef.current > 0) {
      squashTimerRef.current = Math.max(0, squashTimerRef.current - delta);
      sqX = 0.7; sqY = 1.3;
    }

    // ── Rapid blaster fire signal → micro squash + recoil ─────────────────
    const rbSig = useMagicOrb.getState().rapidBlasterFireSignal;
    if (rbSig.count !== prevRbSignalCountRef.current) {
      prevRbSignalCountRef.current = rbSig.count;
      rbSquashTimerRef.current = 0.04;
      const RB_RECOIL = 0.40;
      // Impulse: add to existing velocity so rapid shots accumulate a steady push
      rbRecoilVelRef.current[0] += -rbSig.dirX * RB_RECOIL;
      rbRecoilVelRef.current[1] += -rbSig.dirY * RB_RECOIL;
    }
    // Moderate damping (6) — decays quickly between shots but accumulates while held
    const rbDamp = Math.exp(-6 * delta);
    rbRecoilOffsetRef.current[0] = (rbRecoilOffsetRef.current[0] + rbRecoilVelRef.current[0] * delta) * rbDamp;
    rbRecoilOffsetRef.current[1] = (rbRecoilOffsetRef.current[1] + rbRecoilVelRef.current[1] * delta) * rbDamp;
    rbRecoilVelRef.current[0] *= rbDamp;
    rbRecoilVelRef.current[1] *= rbDamp;
    // Micro squash: (0.85, 1.15) for 0.04 s — lighter than OC
    if (rbSquashTimerRef.current > 0) {
      rbSquashTimerRef.current = Math.max(0, rbSquashTimerRef.current - delta);
      // Only apply if OC squash is not already active (OC takes precedence)
      if (squashTimerRef.current <= 0) {
        sqX = 0.85; sqY = 1.15;
      }
    }

    // ── Spiral blaster fire signal → pull-back snap squash + recoil ──────────
    const sbSig = useMagicOrb.getState().spiralBlasterFireSignal;
    if (sbSig.count !== prevSbSignalCountRef.current) {
      prevSbSignalCountRef.current = sbSig.count;
      sbSquashTimerRef.current = 0.06;
      const SB_RECOIL = 0.80;
      sbRecoilVelRef.current[0] = -sbSig.dirX * SB_RECOIL;
      sbRecoilVelRef.current[1] = -sbSig.dirY * SB_RECOIL;
    }
    // Moderate spring-back (damping 7)
    const sbDamp = Math.exp(-7 * delta);
    sbRecoilOffsetRef.current[0] = (sbRecoilOffsetRef.current[0] + sbRecoilVelRef.current[0] * delta) * sbDamp;
    sbRecoilOffsetRef.current[1] = (sbRecoilOffsetRef.current[1] + sbRecoilVelRef.current[1] * delta) * sbDamp;
    sbRecoilVelRef.current[0] *= sbDamp;
    sbRecoilVelRef.current[1] *= sbDamp;
    // Pull-back snap: X:1.2, Y:0.8 for 0.06 s — wide horizontal push inward
    if (sbSquashTimerRef.current > 0) {
      sbSquashTimerRef.current = Math.max(0, sbSquashTimerRef.current - delta);
      if (squashTimerRef.current <= 0 && rbSquashTimerRef.current <= 0) {
        sqX = 1.2; sqY = 0.8;
      }
    }

    // ── Homing blaster fire signal → forward punch squash + moderate recoil ───
    const hmSig = useMagicOrb.getState().homingFireSignal;
    if (hmSig.count !== prevHmSignalCountRef.current) {
      prevHmSignalCountRef.current = hmSig.count;
      hmSquashTimerRef.current = 0.10;
      const HM_RECOIL = 0.65;
      hmRecoilVelRef.current[0] = -hmSig.dirX * HM_RECOIL;
      hmRecoilVelRef.current[1] = -hmSig.dirY * HM_RECOIL;
    }
    // Higher damping (10) — recovers fully within 333 ms between shots
    const hmDamp = Math.exp(-10 * delta);
    hmRecoilOffsetRef.current[0] = (hmRecoilOffsetRef.current[0] + hmRecoilVelRef.current[0] * delta) * hmDamp;
    hmRecoilOffsetRef.current[1] = (hmRecoilOffsetRef.current[1] + hmRecoilVelRef.current[1] * delta) * hmDamp;
    hmRecoilVelRef.current[0] *= hmDamp;
    hmRecoilVelRef.current[1] *= hmDamp;
    // Forward-punch stretch: X:0.8, Y:1.2 for 0.10 s — orb elongates along fire axis
    if (hmSquashTimerRef.current > 0) {
      hmSquashTimerRef.current = Math.max(0, hmSquashTimerRef.current - delta);
      if (squashTimerRef.current <= 0 && rbSquashTimerRef.current <= 0 &&
          sbSquashTimerRef.current <= 0 && scSquashTimerRef.current <= 0) {
        sqX = 0.8; sqY = 1.2;
      }
    }

    // ── Scattershot fire signal → wide squash + heavy shotgun recoil ──────────
    const scSig = useMagicOrb.getState().scatterFireSignal;
    if (scSig.count !== prevScSignalCountRef.current) {
      prevScSignalCountRef.current = scSig.count;
      scSquashTimerRef.current = 0.06;
      const SC_RECOIL = 1.8;
      scRecoilVelRef.current[0] = -scSig.dirX * SC_RECOIL;
      scRecoilVelRef.current[1] = -scSig.dirY * SC_RECOIL;
    }
    const scDamp = Math.exp(-8 * delta);
    scRecoilOffsetRef.current[0] = (scRecoilOffsetRef.current[0] + scRecoilVelRef.current[0] * delta) * scDamp;
    scRecoilOffsetRef.current[1] = (scRecoilOffsetRef.current[1] + scRecoilVelRef.current[1] * delta) * scDamp;
    scRecoilVelRef.current[0] *= scDamp;
    scRecoilVelRef.current[1] *= scDamp;
    // Squash X:1.25, Y:0.75 — wide lateral energy pooling before release
    if (scSquashTimerRef.current > 0) {
      scSquashTimerRef.current = Math.max(0, scSquashTimerRef.current - delta);
      if (squashTimerRef.current <= 0 && rbSquashTimerRef.current <= 0 && sbSquashTimerRef.current <= 0) {
        sqX = 1.25; sqY = 0.75;
      }
    }

    // Combined recoil offset from all weapons
    const totalRecoilX = recoilOffsetRef.current[0] + rbRecoilOffsetRef.current[0] + sbRecoilOffsetRef.current[0] + scRecoilOffsetRef.current[0] + hmRecoilOffsetRef.current[0];
    const totalRecoilY = recoilOffsetRef.current[1] + rbRecoilOffsetRef.current[1] + sbRecoilOffsetRef.current[1] + scRecoilOffsetRef.current[1] + hmRecoilOffsetRef.current[1];

    if (groupRef.current && !isDying) {
      groupRef.current.rotation.z = gentleWobble;
      groupRef.current.position.x = playerPosition[0] + totalRecoilX;
      groupRef.current.position.y = playerPosition[1] + floatY + totalRecoilY;
      groupRef.current.scale.set(sqX, sqY, 1);
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
  
  const glowColor = hasChargeBeam ? "#ffcc00" : (isDamaged ? "#ff0000" : skinColors.glow);
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


      {/* Heal aura — expanding green rings + rising sparkles */}
      {healAnimTimer > 0 && <HealAura scale={scale} healAnimTimer={healAnimTimer} />}

      {/* Charge gather animation — streams inward then blossoms into ChargeBeamAura */}
      {chargeGatherTimer > 0 && <ChargeGatherAura scale={scale} chargeGatherTimer={chargeGatherTimer} />}

      {/* Charge beam aura — full arcane vortex (active after gather completes) */}
      {hasChargeBeam && (
        <>
          <PlayerParticles
            scale={scale}
            particleColors={["#ffdd00", "#ffffff", "#ffaa00"]}
            isRainbow={false}
          />
          <ChargeBeamAura scale={scale} />
        </>
      )}

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

    </group>
  );
}
