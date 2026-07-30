/**
 * MiniDiamondOrb — projectile fired by the Diamond Boss (level 6.9).
 * Same prismatic shimmer shell + mini orbiting shards, scaled to radius=1.
 * Parent group controls final rendered size.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Prismatic shimmer shader (identical palette to DiamondBoss) ───────────────

const shimmerVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vReflect;

  void main() {
    vUv     = uv;
    vNormal = normalMatrix * normal;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvp.xyz;
    vec3 wNorm = normalize(mat3(modelMatrix) * normal);
    vec3 wView = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
    vReflect   = reflect(-wView, wNorm);
    gl_Position = projectionMatrix * mvp;
  }
`;

const shimmerFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vReflect;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float hash1(float p) { return fract(sin(p) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0*l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h*6.0, 2.0) - 1.0));
    float m = l - c*0.5;
    vec3 rgb;
    if      (h < 1.0/6.0) rgb = vec3(c,x,0);
    else if (h < 2.0/6.0) rgb = vec3(x,c,0);
    else if (h < 3.0/6.0) rgb = vec3(0,c,x);
    else if (h < 4.0/6.0) rgb = vec3(0,x,c);
    else if (h < 5.0/6.0) rgb = vec3(x,0,c);
    else                   rgb = vec3(c,0,x);
    return rgb + m;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 2.2);

    float iriHue = fract(vReflect.x * 0.5 + vReflect.y * 0.3 + uTime * 0.04 + noise(vUv * 3.0) * 0.25);
    vec3 iriCol  = hsl2rgb(iriHue, 0.9, 0.65);

    vec2 sp1 = vUv * 14.0 + vec2( uTime * 0.11, -uTime * 0.07);
    vec2 sp2 = vUv * 22.0 + vec2(-uTime * 0.09,  uTime * 0.13);
    float n1 = noise(sp1);
    float n2 = noise(sp2);
    float flare1 = smoothstep(0.80, 1.00, n1) * smoothstep(0.82, 1.00, n2);
    float tick   = floor(uTime * 10.0);
    float cell   = floor(n1 * 32.0) + floor(n2 * 32.0) * 32.0;
    float flash  = hash1(cell + tick * 97.3) > 0.80 ? 1.0 : 0.0;
    float sparkle = flare1 * (0.6 + flash * 1.4);

    vec3 icyBase  = vec3(0.88, 0.94, 1.00);
    vec3 cyanTint = vec3(0.50, 0.85, 1.00);

    vec3 col = mix(icyBase, cyanTint, fresnel * 0.5);
    col = mix(col, iriCol, fresnel * 0.65 + 0.15);
    col += vec3(1.0) * sparkle * 3.0;
    col += vec3(1.0) * pow(fresnel, 1.5) * 0.9;

    float alpha = 0.25 + fresnel * 0.45 + sparkle * 0.30;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Mini orbiting shards ───────────────────────────────────────────────────────

const SHARD_COUNT = 8;

interface Shard {
  orbitRadius: number;
  orbitSpeed:  number;
  orbitPhase:  number;
  tiltAxis:    THREE.Vector3;
  tiltAngle:   number;
  spinSpeed:   number;
  scale:       number;
  hue:         number;
}

function fract(x: number) { return x - Math.floor(x); }

function MiniDiamondShards({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());

  const shards = useMemo<Shard[]>(() =>
    Array.from({ length: SHARD_COUNT }, (_, i) => ({
      orbitRadius: radius * (1.18 + Math.random() * 0.4),
      orbitSpeed:  0.8 + Math.random() * 1.4,
      orbitPhase:  (i / SHARD_COUNT) * Math.PI * 2,
      tiltAxis:    new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize(),
      tiltAngle: Math.random() * Math.PI,
      spinSpeed: 2.0 + Math.random() * 3.0,
      scale:     0.05 + Math.random() * 0.08,
      hue:       Math.random(),
    })), [radius]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    shards.forEach((s, i) => {
      const angle  = t * s.orbitSpeed + s.orbitPhase;
      const basePos = new THREE.Vector3(
        Math.cos(angle) * s.orbitRadius,
        Math.sin(angle) * s.orbitRadius * 0.5,
        Math.sin(angle * 1.3) * s.orbitRadius * 0.3
      );
      const qTilt = new THREE.Quaternion().setFromAxisAngle(s.tiltAxis, s.tiltAngle);
      basePos.applyQuaternion(qTilt);

      dummy.position.copy(basePos);
      dummy.rotation.set(t * s.spinSpeed, t * s.spinSpeed * 0.7, t * s.spinSpeed * 0.4);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      const shimmerHue = fract(s.hue + t * 0.12 + Math.sin(t * s.spinSpeed) * 0.15);
      colRef.current.setHSL(shimmerHue, 0.85, 0.75);
      meshRef.current!.setColorAt(i, colRef.current);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SHARD_COUNT]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        transparent
        opacity={0.88}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        roughness={0.0}
        metalness={1.0}
      />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface MiniDiamondOrbProps {
  radius?: number;
}

export function MiniDiamondOrb({ radius = 1 }: MiniDiamondOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.25;
  });

  return (
    <group ref={groupRef}>
      {/* Icy fill lights */}
      <pointLight color="#ffffff" intensity={3.5} distance={6} decay={2} position={[0, 0,  2]} />
      <pointLight color="#aaddff" intensity={3}   distance={6} decay={2} position={[0, 0, -2]} />
      {/* Prismatic shimmer shell */}
      <mesh scale={radius * 1.07}>
        <sphereGeometry args={[1, 36, 36]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={shimmerVert}
          fragmentShader={shimmerFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Opaque crystal-white core */}
      <mesh scale={radius * 0.90}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          color="#ddeeff"
          emissive="#aaddff"
          emissiveIntensity={0.4}
          roughness={0.05}
          metalness={0.9}
        />
      </mesh>
      {/* Orbiting mini shards */}
      <MiniDiamondShards radius={radius} />
    </group>
  );
}
