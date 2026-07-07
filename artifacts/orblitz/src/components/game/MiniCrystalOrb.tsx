/**
 * MiniCrystalOrb — projectile fired by the Crystal Boss (level 3.9).
 * Prismatic Fresnel shader sphere with animated rainbow iridescence.
 * No model loading — cheap enough for many simultaneous projectiles.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Crystal shader ─────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vUv        = uv;
    vNormal    = normalMatrix * normal;
    vec4 mvp   = modelViewMatrix * vec4(position, 1.0);
    vViewPos   = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec3 n       = normalize(vNormal);
    vec3 v       = normalize(-vViewPos);
    float NdotV  = max(0.0, dot(n, v));
    float fresnel = pow(1.0 - NdotV, 2.8);

    // Animated prismatic rainbow
    float t1   = uTime * 0.5 + fresnel * 3.0 + vUv.y * 2.0;
    vec3 prism = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.333, 0.667) + t1));

    float t2    = uTime * 0.28 + vUv.x * 1.5 - fresnel * 1.2;
    vec3 prism2 = 0.5 + 0.5 * cos(6.28318 * (vec3(0.5, 0.167, 0.833) + t2));

    // Crystal base: clear ice-blue
    vec3 base = mix(vec3(0.75, 0.92, 1.0), vec3(1.0), 0.35);

    // Surface noise flecks (facet-like)
    float n1   = noise(vUv * 6.0 + uTime * 0.1);
    float facet = step(0.78, n1) * 0.4;

    vec3 col   = base * (0.4 + NdotV * 0.4);
    col        = mix(col, mix(prism, prism2, 0.45), fresnel * 0.85 + 0.12);
    col       += prism * fresnel * 0.35;
    col       += vec3(1.0) * facet;

    // Specular flash
    vec3 r   = reflect(-v, n);
    float sp = pow(max(0.0, r.z), 32.0);
    col     += vec3(0.9, 0.95, 1.0) * sp * 0.7;

    // Fast twinkle shimmer
    float shimmer = 0.5 + 0.5 * sin(uTime * 6.0 + vUv.x * 10.0 + vUv.y * 8.0);
    col += prism * shimmer * fresnel * 0.15;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Main component ─────────────────────────────────────────────────────────────

export interface MiniCrystalOrbProps {
  radius?: number;
  healthPercent?: number;
}

export function MiniCrystalOrb({ radius = 1 }: MiniCrystalOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.9;
      groupRef.current.rotation.x += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#88ddff" intensity={1.5} distance={4} decay={2} />
      <mesh>
        <sphereGeometry args={[radius, 28, 20]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
    </group>
  );
}
