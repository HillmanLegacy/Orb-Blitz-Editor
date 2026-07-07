/**
 * MiniStarOrb — projectile fired by the Star Boss (level 2.9).
 * Gold shader sphere + scaled-down sparkle corona.
 * No model loading — cheap enough for many simultaneous projectiles.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Star shader ────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv        = uv;
    vNormal    = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec2 q = vUv * 4.5 + vec2(uTime * 0.22, uTime * 0.12);
    float n1 = noise(q);
    float n2 = noise(q * 2.3 + 1.7);
    float n  = n1 * 0.65 + n2 * 0.35;

    // Sparkle flecks
    float sparkle = step(0.82, noise(q * 7.0 + uTime * 3.0));

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

function MiniSparkles({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());

  const sparkles = useRef<Sparkle[]>(
    Array.from({ length: MINI_SPARKLE_COUNT }, (_, i) => ({
      angle:      (i / MINI_SPARKLE_COUNT) * Math.PI * 2,
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, MINI_SPARKLE_COUNT]}>
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
}

export function MiniStarOrb({ radius = 1, healthPercent = 1 }: MiniStarOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 1.2;
      groupRef.current.rotation.z += delta * 0.6;
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#ffdd44" intensity={1.5} distance={4} decay={2} />
      <mesh>
        <sphereGeometry args={[radius, 28, 20]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      <MiniSparkles radius={radius} />
    </group>
  );
}
