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

// ── Prismatic light rays ───────────────────────────────────────────────────────
// Flat tapered planes radiating outward like light spokes from a prism,
// each cycling through a different hue offset.

const RAY_COUNT = 12;

function RainbowRays({ radius }: { radius: number }) {
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
    groupRef.current.rotation.z = t * 0.22;
    groupRef.current.rotation.y = t * 0.14;

    raysRef.current.forEach((ray, i) => {
      if (!ray) return;
      const mat = mats[i];
      // Hue cycles slowly — each ray has an offset
      mat.color.setHSL(fract(i / RAY_COUNT + t * 0.12), 1.0, 0.65);
      // Pulse opacity in a wave pattern
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + (i / RAY_COUNT) * Math.PI * 2);
      mat.opacity = 0.15 + pulse * 0.30;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: RAY_COUNT }, (_, i) => {
        const angle   = (i / RAY_COUNT) * Math.PI * 2;
        const rayLen  = radius * 1.2 + (i % 3) * radius * 0.15;
        const rayOff  = radius * 1.0; // starts at surface
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
            <planeGeometry args={[0.07 + (i % 4) * 0.015, rayLen, 1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
}

function fract(x: number) { return x - Math.floor(x); }

// ── Orbiting chromatic point lights ───────────────────────────────────────────
// Six lights on a ring, each a different pure hue, rotating around the boss
// so all six spectrum colours illuminate the model surface in sequence.

function RainbowLights({ radius }: { radius: number }) {
  const lightsRef = useRef<THREE.PointLight[]>([]);
  const HUE_COUNT = 6;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    lightsRef.current.forEach((light, i) => {
      if (!light) return;
      const angle = t * 0.55 + (i / HUE_COUNT) * Math.PI * 2;
      const r = radius * 1.5;
      light.position.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.5, Math.sin(angle * 0.7) * r * 0.4);
      // Hue cycles — each light locked to a different spectrum band
      light.color.setHSL(fract(i / HUE_COUNT + t * 0.08), 1.0, 0.6);
    });
  });

  return (
    <>
      {Array.from({ length: HUE_COUNT }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => { if (el) lightsRef.current[i] = el; }}
          intensity={3.5}
          distance={10}
          decay={2}
        />
      ))}
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

    if (orbTexture) orbTexture.colorSpace = THREE.SRGBColorSpace;

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
      {/* Six chromatic orbiting lights */}
      <RainbowLights radius={radius} />
      {/* Base model */}
      <group ref={groupRef} />
      {/* Spectral aura shell */}
      <RainbowAuraShell radius={radius} />
      {/* Prismatic light rays */}
      <RainbowRays radius={radius} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_7_rainbow_texture.glb");
