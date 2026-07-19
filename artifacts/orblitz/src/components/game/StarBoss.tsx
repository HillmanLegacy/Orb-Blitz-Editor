/**
 * StarBoss — Level 2.9 boss.
 * Gaseous nebula form: multi-layer FBM noise cloud + sparkle corona.
 * No solid model — pure shader-based volumetric gas appearance.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Shared GLSL noise helpers ─────────────────────────────────────────────────

const NOISE_GLSL = /* glsl */ `
  float hashN(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float valueNoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hashN(i),             hashN(i+vec3(1,0,0)), f.x),
          mix(hashN(i+vec3(0,1,0)), hashN(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hashN(i+vec3(0,0,1)), hashN(i+vec3(1,0,1)), f.x),
          mix(hashN(i+vec3(0,1,1)), hashN(i+vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * valueNoise(p);
      p = p * 2.1 + vec3(31.4, 17.8, 43.2);
      a *= 0.5;
    }
    return v;
  }
`;

// ── Gas cloud layer shader ────────────────────────────────────────────────────

const gasVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  void main() {
    vUv      = uv;
    vNormal  = normalize(normalMatrix * normal);
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvp.xyz);
    gl_Position = projectionMatrix * mvp;
  }
`;

const gasFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColorA;   // inner hot colour
  uniform vec3  uColorB;   // outer cool colour
  uniform float uDensity;  // overall opacity multiplier
  uniform float uSpeed;    // turbulence animation speed

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    float NdotV = max(0.0, dot(n, v));

    // Fresnel — brighter at grazing angles (limb brightening like real nebulae)
    float fresnel = pow(1.0 - NdotV, 1.6);

    // Double-layer FBM turbulence animating in opposite directions
    vec3 pA = n * 2.8 + vec3(uTime * uSpeed * 0.17, uTime * uSpeed * 0.11, uTime * uSpeed * 0.09);
    vec3 pB = n * 1.6 + vec3(-uTime * uSpeed * 0.07, uTime * uSpeed * 0.13, -uTime * uSpeed * 0.15);
    float gasA = fbm(pA);
    float gasB = fbm(pB);
    float turb = gasA * 0.55 + gasB * 0.45;

    // Colour — hot core to cool wisps
    vec3 col = mix(uColorA, uColorB, turb);

    // Brighten high-density pockets
    col += uColorA * pow(turb, 2.5) * 0.6;

    // Specular-like hot spot
    float hotspot = pow(max(0.0, NdotV - 0.3) / 0.7, 4.0);
    col += uColorA * hotspot * 0.35;

    // Alpha: turbulence drives density; fresnel adds limb glow
    float alpha = (turb * 0.62 + fresnel * 0.52) * uDensity;

    // Punch holes so it never looks fully opaque — gaseous transparency
    float hole = fbm(n * 3.5 + vec3(uTime * 0.08));
    alpha *= 0.55 + hole * 0.55;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Single gas cloud layer ────────────────────────────────────────────────────

interface GasLayerProps {
  radius:  number;
  colorA:  string;
  colorB:  string;
  density: number;
  speed:   number;
}

function GasLayer({ radius, colorA, colorB, density, speed }: GasLayerProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uColorA:  { value: new THREE.Color(colorA) },
    uColorB:  { value: new THREE.Color(colorB) },
    uDensity: { value: density },
    uSpeed:   { value: speed },
  }), [colorA, colorB, density, speed]);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 64, 48]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={gasVert}
        fragmentShader={gasFrag}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Sparkle particle corona ───────────────────────────────────────────────────

const SPARKLE_COUNT = 110;

interface Sparkle {
  angle: number; elevation: number; dist: number;
  life: number; maxLife: number;
  twinkleFreq: number; twinklePhase: number;
  size: number; orbitSpeed: number; isWhite: boolean;
}

function StarSparkles({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());

  const sparkles = useRef<Sparkle[]>(
    Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
      angle:        (i / SPARKLE_COUNT) * Math.PI * 2,
      elevation:    (Math.random() - 0.5) * Math.PI,
      dist:         radius * (0.85 + Math.random() * 0.85),
      life:         Math.random(),
      maxLife:      0.5 + Math.random() * 1.5,
      twinkleFreq:  4 + Math.random() * 14,
      twinklePhase: Math.random() * Math.PI * 2,
      size:         0.024 + Math.random() * 0.055,
      orbitSpeed:   (Math.random() - 0.5) * 1.6,
      isWhite:      Math.random() < 0.22,
    }))
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t   = state.clock.getElapsedTime();
    const col = colRef.current;

    sparkles.current.forEach((s, i) => {
      s.life -= delta;
      if (s.life <= 0) {
        s.angle     = Math.random() * Math.PI * 2;
        s.elevation = (Math.random() - 0.5) * Math.PI;
        s.dist      = radius * (0.82 + Math.random() * 0.90);
        s.life      = s.maxLife;
        s.isWhite   = Math.random() < 0.22;
      }
      s.angle += delta * s.orbitSpeed;

      const r = s.dist;
      const x = Math.cos(s.angle) * Math.cos(s.elevation) * r;
      const y = Math.sin(s.elevation) * r;
      const z = Math.sin(s.angle) * Math.cos(s.elevation) * r;

      const twinkle   = Math.abs(Math.sin(t * s.twinkleFreq + s.twinklePhase));
      const lifeRatio = s.life / s.maxLife;
      const fadeIn    = Math.min(1, lifeRatio * 5);
      const sz        = s.size * twinkle * fadeIn;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(Math.max(0.0001, sz));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      if (s.isWhite) {
        col.setRGB(1, 0.98, 0.88);
      } else {
        col.setHSL(0.12 - twinkle * 0.04, 1.0, 0.62 + twinkle * 0.38);
      }
      meshRef.current!.setColorAt(i, col);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SPARKLE_COUNT]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Pulsing point light ───────────────────────────────────────────────────────

function PulsingLight({ healthPercent }: { healthPercent: number }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    const t = state.clock.getElapsedTime();
    // Breathe between 8–14 intensity; rage-flicker at low health
    if (healthPercent < 0.3) {
      const rage = 0.5 + 0.5 * Math.abs(Math.sin(t * 18));
      lightRef.current.intensity = 10 + rage * 8;
      lightRef.current.color.setRGB(1, 0.6 + rage * 0.3, 0.1);
    } else {
      lightRef.current.intensity = 10 + Math.sin(t * 2.1) * 2.5;
      lightRef.current.color.setRGB(1, 0.88, 0.35);
    }
  });

  return (
    <pointLight
      ref={lightRef}
      color="#ffdd55"
      intensity={10}
      distance={22}
      decay={2}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface StarBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function StarBoss({ radius = 1.44, healthPercent = 1 }: StarBossProps) {
  // Colour shifts toward angry orange-red at low health
  const coreA  = healthPercent < 0.3 ? "#ff8800" : "#ffe066";
  const coreB  = healthPercent < 0.3 ? "#ff4400" : "#ffaa22";
  const outerA = healthPercent < 0.3 ? "#ff6600" : "#ffcc44";
  const outerB = healthPercent < 0.3 ? "#ff2200" : "#cc8800";

  return (
    <group>
      {/* Single strong pulsing point light — casts gold light on nearby orbs */}
      <PulsingLight healthPercent={healthPercent} />

      {/* ── Dense inner core — tighter, brighter, slower turbulence ── */}
      <GasLayer
        radius={radius * 0.78}
        colorA={coreA}
        colorB={coreB}
        density={1.35}
        speed={0.7}
      />

      {/* ── Mid shell — main body of the nebula ── */}
      <GasLayer
        radius={radius}
        colorA={outerA}
        colorB={outerB}
        density={0.88}
        speed={1.0}
      />

      {/* ── Outer wisp halo — large, very transparent, additive glow ── */}
      <GasLayer
        radius={radius * 1.42}
        colorA={outerA}
        colorB="#664400"
        density={0.38}
        speed={1.35}
      />

      {/* ── Sparkle corona ── */}
      <StarSparkles radius={radius} />
    </group>
  );
}
