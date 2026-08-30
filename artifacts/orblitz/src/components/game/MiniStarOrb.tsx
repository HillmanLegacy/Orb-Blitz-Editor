/**
 * MiniStarOrb — projectile fired by the Star Boss (level 2.9).
 * Gold shader sphere + scaled-down sparkle corona.
 * No model loading — cheap enough for many simultaneous projectiles.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getPlayerSkinVisualYaw } from "./PlayerSkinVisualConfig";

// ── Star shader ────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vUv        = uv;
    vNormal    = normalMatrix * normal;
    vPos       = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPos;

  // 3-D hash + noise — no UV seam
  float hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash3(i),           hash3(i+vec3(1,0,0)), f.x),
          mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
          mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 q = vPos * 4.5 + vec3(uTime * 0.22, uTime * 0.12, uTime * 0.08);
    float n1 = noise3(q);
    float n2 = noise3(q * 2.3 + 1.7);
    float n  = n1 * 0.65 + n2 * 0.35;

    // Sparkle flecks
    float sparkle = step(0.82, noise3(q * 7.0 + uTime * 3.0));

    float limb = max(0.0, 1.0 - length(vNormal.xy) * 0.72);
    n = clamp(n * (0.5 + limb * 0.5) + n * 0.15, 0.0, 1.0);

    vec3 deep   = vec3(0.55, 0.28, 0.0);
    vec3 gold   = vec3(0.95, 0.68, 0.0);
    vec3 bright = vec3(1.0,  0.92, 0.3);
    vec3 white  = vec3(1.0,  1.0,  0.95);

    vec3 col;
    if      (n < 0.4) col = mix(deep,   gold,   n / 0.4);
    else if (n < 0.75) col = mix(gold,   bright, (n-0.4)/0.35);
    else               col = mix(bright, white,  (n-0.75)/0.25);

    col = mix(col, white, sparkle * 0.75);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Mini sparkle corona ────────────────────────────────────────────────────────

const MINI_SPARKLE_COUNT = 20;

interface Sparkle {
  angle: number;
  elevation: number;
  dist: number;
  life: number;
  maxLife: number;
  freq: number;
  phase: number;
  size: number;
  orbitSpeed: number;
}

function MiniSparkles({ radius, count = MINI_SPARKLE_COUNT }: { radius: number; count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());

  const sparkles = useRef<Sparkle[]>(
    Array.from({ length: count }, (_, i) => ({
      angle:      (i / count) * Math.PI * 2,
      elevation:  (Math.random() - 0.5) * Math.PI,
      dist:       radius * (0.9 + Math.random() * 0.55),
      life:       Math.random(),
      maxLife:    0.4 + Math.random() * 0.8,
      freq:       5 + Math.random() * 14,
      phase:      Math.random() * Math.PI * 2,
      size:       0.014 + Math.random() * 0.030,
      orbitSpeed: (Math.random() - 0.5) * 2.0,
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
        s.dist      = radius * (0.85 + Math.random() * 0.6);
        s.life      = s.maxLife;
      }
      s.angle += delta * s.orbitSpeed;

      const r = s.dist;
      dummy.position.set(
        Math.cos(s.angle) * Math.cos(s.elevation) * r,
        Math.sin(s.elevation) * r,
        Math.sin(s.angle) * Math.cos(s.elevation) * r,
      );
      const twinkle = Math.abs(Math.sin(t * s.freq + s.phase));
      const sz      = s.size * twinkle * Math.min(1, (s.life / s.maxLife) * 4);
      dummy.scale.setScalar(Math.max(0.0001, sz));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.13 - twinkle * 0.05, 1.0, 0.6 + twinkle * 0.4);
      meshRef.current!.setColorAt(i, col);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface MiniStarOrbProps {
  /** Local-space sphere radius. Parent group scale drives world size. */
  radius?: number;
  healthPercent?: number;
  particleCount?: number;
  showParticles?: boolean;
  showLight?: boolean;
  animatePresentationYaw?: boolean;
}

export function MiniStarOrb({ radius = 1, healthPercent = 1, particleCount = MINI_SPARKLE_COUNT, showParticles = true, showLight = true, animatePresentationYaw = true }: MiniStarOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    if (animatePresentationYaw && groupRef.current) {
      groupRef.current.rotation.set(0, getPlayerSkinVisualYaw("star", state.clock.getElapsedTime()), 0);
    }
  });

  return (
    <group ref={groupRef}>
      {showLight && <pointLight color="#ffdd44" intensity={1.5} distance={4} decay={2} />}
      <mesh>
        <sphereGeometry args={[radius, 28, 20]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      {showParticles && <MiniSparkles radius={radius} count={particleCount} />}
    </group>
  );
}
