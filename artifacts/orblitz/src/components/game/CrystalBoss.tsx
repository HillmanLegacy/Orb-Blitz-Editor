/**
 * CrystalBoss — Level 3.9 boss.
 * Player-orb model + crystal texture + prismatic Fresnel iridescence overlay.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Prismatic overlay shader ───────────────────────────────────────────────────

const crystalOverlayVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vUv       = uv;
    vNormal   = normalMatrix * normal;
    vec4 mvp  = modelViewMatrix * vec4(position, 1.0);
    vViewPos  = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const crystalOverlayFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vec3 n       = normalize(vNormal);
    vec3 v       = normalize(-vViewPos);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 2.2);

    // Animated prismatic rainbow — phase shifts along UV + time
    float t      = uTime * 0.35 + fresnel * 2.8 + vUv.y * 1.5;
    vec3 prism   = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.333, 0.667) + t));

    // Second, slower rainbow for depth
    float t2     = uTime * 0.18 + fresnel * 1.2 - vUv.x * 1.0;
    vec3 prism2  = 0.5 + 0.5 * cos(6.28318 * (vec3(0.5, 0.167, 0.833) + t2));

    vec3 col     = mix(prism, prism2, 0.4) * fresnel;

    // Soft internal glow (ice-blue core)
    float core   = pow(max(0.0, dot(n, v)), 3.0);
    col         += vec3(0.6, 0.85, 1.0) * core * 0.25;

    // Specular flare
    vec3 r       = reflect(-v, n);
    float spec   = pow(max(0.0, r.z), 24.0);
    col         += vec3(1.0) * spec * 0.6;

    // Pulsing shimmer
    float shimmer = 0.5 + 0.5 * sin(uTime * 3.5 + vUv.x * 8.0 + vUv.y * 6.0);
    col          += prism * shimmer * fresnel * 0.18;

    float alpha  = clamp(fresnel * 0.85 + core * 0.2 + spec * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

function CrystalOverlay({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.015}>
      <sphereGeometry args={[1, 48, 36]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={crystalOverlayVert}
        fragmentShader={crystalOverlayFrag}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface CrystalBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function CrystalBoss({ radius = 1.44, healthPercent = 1 }: CrystalBossProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshStandardMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  // The texture GLB contains the orb mesh WITH UV coords + full PBR material baked in.
  const { scene: modelScene } = useGLTF("/models/boss_orb_3_crystal_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

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
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial;
          std.emissive          = new THREE.Color("#88ccff");
          std.emissiveIntensity = 0.18;
          materialsRef.current.push(std);
        });
      }
    });

    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    groupRef.current.add(cloned);

    return () => {
      materialsRef.current = [];
    };
  }, [modelScene, radius]);

  useFrame((state, delta) => {
    if (healthPercent < prevHealthRef.current) hurtTimerRef.current = 0.15;
    prevHealthRef.current = healthPercent;
    hurtTimerRef.current  = Math.max(0, hurtTimerRef.current - delta);

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.28;
      groupRef.current.rotation.x += delta * 0.10;
    }

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        m.emissive.setRGB(1, 0.1, 0.1);
        m.emissiveIntensity = frac * osc * 2.5;
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 14));
        m.emissive.setRGB(0.6, 0.2 + anger * 0.5, 1.0);
        m.emissiveIntensity = 0.3 + anger * 0.4;
      } else {
        m.emissive.set("#88ccff");
        m.emissiveIntensity = 0.18 + Math.sin(t * 2.2) * 0.05;
      }
    });
  });

  return (
    <group>
      {/* Multi-directional cyan fill lights for full-model coverage */}
      <pointLight color="#88ddff" intensity={4}   distance={12} decay={2} position={[0, 0,  3]} />
      <pointLight color="#88ddff" intensity={3.5} distance={12} decay={2} position={[0, 0, -3]} />
      <pointLight color="#aaeeff" intensity={3}   distance={12} decay={2} position={[3, 2,  0]} />
      <pointLight color="#aaeeff" intensity={3}   distance={12} decay={2} position={[-3, -2, 0]} />
      <group ref={groupRef} />
      <CrystalOverlay radius={radius} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_3_crystal_texture.glb");
