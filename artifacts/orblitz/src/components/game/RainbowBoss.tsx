/**
 * RainbowBoss — Level 7.9 boss.
 * GLB model with rainbow texture + high-quality 3D rainbow light aura:
 *   • Animated spectral band shell — hue sweeps full spectrum in flowing waves
 *   • Prismatic light ray spokes that rotate and pulse in rainbow sequence
 *   • Six chromatic point lights orbiting the boss in a synchronized ring
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Rainbow aura shell shader ──────────────────────────────────────────────────
// Flowing spectral bands mapped onto the sphere surface, animated so the
// colours appear to wash across the orb like light through a prism.

const rainbowVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv         = uv;
    vNormal     = normalMatrix * normal;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvp    = modelViewMatrix * vec4(position, 1.0);
    vViewPos    = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const rainbowFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

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

    // ── Spectral band hue ─────────────────────────────────────────────────────
    // Driven by UV longitude + animated noise warp for organic flow
    vec2 warp = vec2(
      noise(vUv * 2.5 + vec2( uTime * 0.07,  0.0)) - 0.5,
      noise(vUv * 2.5 + vec2(-0.3, uTime * 0.05)) - 0.5
    ) * 0.3;

    float bandU = vUv.x + warp.x;
    float bandV = vUv.y + warp.y;

    // Primary hue band sweeping across the surface
    float hue1 = fract(bandU * 2.0 - uTime * 0.18);
    // Secondary slower band for depth
    float hue2 = fract(bandU * 1.3 + bandV * 0.6 + uTime * 0.09 + 0.33);
    // Tertiary wave that crosses
    float hue3 = fract(bandV * 2.5 - bandU * 0.5 + uTime * 0.14 + 0.67);

    vec3 col1 = hue2rgb(hue1);
    vec3 col2 = hue2rgb(hue2);
    vec3 col3 = hue2rgb(hue3);

    // Blend bands — use noise to vary the mix weights
    float mix1 = noise(vUv * 4.0 + vec2(uTime * 0.03, 0.0));
    float mix2 = noise(vUv * 3.0 + vec2(0.0, uTime * 0.04));
    vec3 spectral = mix(mix(col1, col2, mix1), col3, mix2 * 0.4);

    // ── Highlight sparkles ────────────────────────────────────────────────────
    float n1 = noise(vUv * 16.0 + vec2(-uTime * 0.1, uTime * 0.07));
    float n2 = noise(vUv * 24.0 + vec2( uTime * 0.08,-uTime * 0.11));
    float sparkle = smoothstep(0.78, 1.0, n1 * n2 * 1.4);

    // ── Compose ───────────────────────────────────────────────────────────────
    vec3 col = spectral * 1.3;                           // saturated spectral
    col     += vec3(1.0) * sparkle * 2.5;               // white sparkle pops
    col     += hue2rgb(fract(hue1 + 0.5)) * fresnel * 1.0; // complementary fresnel rim

    float alpha = 0.35 + fresnel * 0.40 + sparkle * 0.25;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Aura shell ─────────────────────────────────────────────────────────────────

function RainbowAuraShell({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.08}>
      <sphereGeometry args={[1, 64, 64]} />
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
  );
}
function fract(x: number) { return x - Math.floor(x); }

// ── Rainbow swirl particles ────────────────────────────────────────────────────
// Each particle orbits the boss in a tilted circular plane, creating a dense
// chromatic swirl cloud. Orbit axes are spread across 3-D so the swirl wraps
// the boss from every angle.

const PARTICLE_COUNT = 120;

// Reusable scratch vectors — allocated once, reused every frame.
const _u   = new THREE.Vector3();
const _v   = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _up  = new THREE.Vector3(0, 1, 0);
const _alt = new THREE.Vector3(1, 0, 0);

interface SwirlParticle {
  axis:      THREE.Vector3; // orbit axis (normalised)
  u:         THREE.Vector3; // orbit plane tangent 1
  v:         THREE.Vector3; // orbit plane tangent 2
  angle:     number;        // current angle on orbit (radians)
  speed:     number;        // rad / s  (sign gives CW / CCW)
  orbitR:    number;        // orbit radius
  hueOffset: number;        // 0–1 base hue
  size:      number;
}

function makeSwirlParticle(index: number, total: number, radius: number): SwirlParticle {
  // Distribute orbit axes evenly using golden angle on a sphere
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y      = 1 - (index / (total - 1)) * 2;
  const r      = Math.sqrt(Math.max(0, 1 - y * y));
  const theta  = golden * index;
  const axis   = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)).normalize();

  // Build two orthogonal vectors in the orbit plane
  const ref = Math.abs(axis.dot(_up)) < 0.9 ? _up : _alt;
  const u   = new THREE.Vector3().crossVectors(ref, axis).normalize();
  const v   = new THREE.Vector3().crossVectors(axis, u).normalize();

  // Orbit radius: tightly clustered just outside the boss surface
  const orbitR = radius * (1.05 + Math.random() * 0.65);

  // Alternate CW / CCW for a tangled-swirl look
  const speed = (0.8 + Math.random() * 1.6) * (index % 2 === 0 ? 1 : -1);

  return {
    axis, u, v,
    angle:     Math.random() * Math.PI * 2,
    speed,
    orbitR,
    hueOffset: index / total,
    size:      0.05 + Math.random() * 0.09,
  };
}

function RainbowParticles({ radius }: { radius: number }) {
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const colRef    = useRef(new THREE.Color());
  const particles = useRef<SwirlParticle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => makeSwirlParticle(i, PARTICLE_COUNT, radius))
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    particles.current.forEach((p, i) => {
      // Advance orbit angle
      p.angle += p.speed * delta;

      // World position on the orbit circle
      _u.copy(p.u).multiplyScalar(Math.cos(p.angle) * p.orbitR);
      _v.copy(p.v).multiplyScalar(Math.sin(p.angle) * p.orbitR);
      _pos.addVectors(_u, _v);

      // Gentle size pulse
      const sz = p.size * (0.75 + Math.sin(t * 2.5 + i) * 0.25);
      dummy.position.copy(_pos);
      dummy.scale.setScalar(sz);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Hue cycles slowly around the spectrum
      const hue = fract(p.hueOffset + t * 0.12);
      colRef.current.setHSL(hue, 1.0, 0.65);
      meshRef.current!.setColorAt(i, colRef.current);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

// ── Two hue-cycling fill lights (replaces the six orbiting lights) ────────────

function RainbowFillLights() {
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (a.current) a.current.color.setHSL(fract(t * 0.10),       1.0, 0.6);
    if (b.current) b.current.color.setHSL(fract(t * 0.10 + 0.5), 1.0, 0.6);
  });
  return (
    <>
      <pointLight ref={a} intensity={4} distance={12} decay={2} position={[0, 0,  3]} />
      <pointLight ref={b} intensity={4} distance={12} decay={2} position={[0, 0, -3]} />
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface RainbowBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function RainbowBoss({ radius = 1.44, healthPercent = 1 }: RainbowBossProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  const { scene: modelScene } = useGLTF("/models/boss_orb_7_rainbow_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    let orbTexture: THREE.Texture | null = null;
    modelScene.traverse((child) => {
      if (orbTexture) return;
      if ((child as THREE.Mesh).isMesh) {
        const m    = (child as THREE.Mesh).material;
        const mats = Array.isArray(m) ? m : [m];
        for (const mat of mats) {
          const tex = (mat as any).map;
          if (tex) { orbTexture = tex; orbTexture!.needsUpdate = true; break; }
        }
      }
    });

    const texture = orbTexture as THREE.Texture | null;
    if (texture) texture.colorSpace = THREE.SRGBColorSpace;

    const cloned = modelScene.clone(true);
    materialsRef.current = [];

    const box     = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim    = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? (radius * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat  = new THREE.MeshStandardMaterial({
          map:               orbTexture ?? undefined,
          emissive:          new THREE.Color("#ffffff"),
          emissiveIntensity: 0.15,
          roughness:         0.45,
          metalness:         0.20,
        });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    groupRef.current.add(cloned);

    return () => {
      materialsRef.current.forEach((m) => m.dispose());
      materialsRef.current = [];
    };
  }, [modelScene, radius]);

  useFrame((state, delta) => {
    if (healthPercent < prevHealthRef.current) hurtTimerRef.current = 0.15;
    prevHealthRef.current = healthPercent;
    hurtTimerRef.current  = Math.max(0, hurtTimerRef.current - delta);

    // Slow elegant rotation
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.3;

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        m.emissive.setRGB(1, 0.1, 0.05);
        m.emissiveIntensity = frac * osc * 2.5;
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 14));
        m.emissive.setHSL(fract(t * 0.5), 1.0, 0.5);
        m.emissiveIntensity = 0.4 + anger * 0.5;
      } else {
        // Slowly cycle the emissive hue with the rainbow
        m.emissive.setHSL(fract(t * 0.12), 0.9, 0.6);
        m.emissiveIntensity = 0.12 + Math.sin(t * 1.5) * 0.04;
      }
    });
  });

  return (
    <group>
      {/* Hue-cycling fill lights */}
      <RainbowFillLights />
      {/* Base model */}
      <group ref={groupRef} />
      {/* Spectral aura shell */}
      <RainbowAuraShell radius={radius} />
      {/* Rainbow light particles */}
      <RainbowParticles radius={radius} />
    </group>
  );
}
