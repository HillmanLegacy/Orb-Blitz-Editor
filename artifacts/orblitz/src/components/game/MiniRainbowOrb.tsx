/**
 * MiniRainbowOrb — projectile fired by the Rainbow Boss (level 7.9).
 * Same spectral aura shell + mini rotating rays, scaled to radius=1.
 * Parent group controls final rendered size.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Spectral aura shader (identical to RainbowBoss) ───────────────────────────

const rainbowVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vUv      = uv;
    vNormal  = normalMatrix * normal;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const rainbowFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  vec3 hue2rgb(float h) {
    float r = abs(h*6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h*6.0 - 2.0);
    float b = 2.0 - abs(h*6.0 - 4.0);
    return clamp(vec3(r,g,b), 0.0, 1.0);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 1.6);

    vec2 warp = vec2(
      noise(vUv * 2.5 + vec2( uTime * 0.07, 0.0)) - 0.5,
      noise(vUv * 2.5 + vec2(-0.3, uTime * 0.05)) - 0.5
    ) * 0.3;

    float bandU  = vUv.x + warp.x;
    float bandV  = vUv.y + warp.y;
    float hue1   = fract(bandU * 2.0 - uTime * 0.18);
    float hue2   = fract(bandU * 1.3 + bandV * 0.6 + uTime * 0.09 + 0.33);
    float hue3   = fract(bandV * 2.5 - bandU * 0.5 + uTime * 0.14 + 0.67);

    float mix1   = noise(vUv * 4.0 + vec2(uTime * 0.03, 0.0));
    float mix2   = noise(vUv * 3.0 + vec2(0.0, uTime * 0.04));
    vec3 spectral = mix(mix(hue2rgb(hue1), hue2rgb(hue2), mix1), hue2rgb(hue3), mix2 * 0.4);

    float n1 = noise(vUv * 16.0 + vec2(-uTime * 0.1, uTime * 0.07));
    float n2 = noise(vUv * 24.0 + vec2( uTime * 0.08,-uTime * 0.11));
    float sparkle = smoothstep(0.78, 1.0, n1 * n2 * 1.4);

    vec3 col = spectral * 1.3;
    col     += vec3(1.0) * sparkle * 2.5;
    col     += hue2rgb(fract(hue1 + 0.5)) * fresnel * 0.8;

    float alpha = 0.35 + fresnel * 0.40 + sparkle * 0.25;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Mini rays ─────────────────────────────────────────────────────────────────

const RAY_COUNT = 7;

function fract(x: number) { return x - Math.floor(x); }

function MiniRainbowRays({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const raysRef  = useRef<THREE.Mesh[]>([]);
  const mats     = useMemo(() =>
    Array.from({ length: RAY_COUNT }, (_, i) =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
        side:        THREE.DoubleSide,
        color:       new THREE.Color().setHSL(i / RAY_COUNT, 1, 0.6),
      })
    ), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.z = t * 0.3;
    groupRef.current.rotation.y = t * 0.18;

    raysRef.current.forEach((ray, i) => {
      if (!ray) return;
      mats[i].color.setHSL(fract(i / RAY_COUNT + t * 0.12), 1.0, 0.65);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.0 + (i / RAY_COUNT) * Math.PI * 2);
      mats[i].opacity = 0.12 + pulse * 0.28;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: RAY_COUNT }, (_, i) => {
        const angle  = (i / RAY_COUNT) * Math.PI * 2;
        const rayLen = radius * 1.1 + (i % 3) * radius * 0.12;
        const rayOff = radius * 0.9;
        return (
          <mesh
            key={i}
            ref={(el) => { if (el) raysRef.current[i] = el; }}
            material={mats[i]}
            position={[
              Math.cos(angle) * (rayOff + rayLen * 0.5),
              Math.sin(angle) * (rayOff + rayLen * 0.5),
              0,
            ]}
            rotation={[0, 0, angle + Math.PI * 0.5]}
          >
            <planeGeometry args={[0.05, rayLen, 1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface MiniRainbowOrbProps {
  radius?: number;
}

export function MiniRainbowOrb({ radius = 1 }: MiniRainbowOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.3;
    // Hue-cycling fill light
    if (lightRef.current) lightRef.current.color.setHSL(fract(state.clock.getElapsedTime() * 0.15), 1.0, 0.6);
  });

  return (
    <group ref={groupRef}>
      {/* Chromatic fill light */}
      <pointLight ref={lightRef} intensity={2.5} distance={5} decay={2} />
      {/* Spectral aura shell */}
      <mesh scale={radius * 1.08}>
        <sphereGeometry args={[1, 36, 36]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={rainbowVert}
          fragmentShader={rainbowFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Opaque rainbow-tinted core */}
      <mesh scale={radius * 0.90}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          color="#ffccee"
          emissive="#ffffff"
          emissiveIntensity={0.2}
          roughness={0.45}
          metalness={0.20}
        />
      </mesh>
      {/* Mini light rays */}
      <MiniRainbowRays radius={radius} />
    </group>
  );
}
