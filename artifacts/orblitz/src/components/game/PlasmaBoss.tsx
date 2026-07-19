/**
 * PlasmaBoss — Level 5.9 boss.
 * GLB model with plasma texture + high-quality electric aura:
 *   • Animated arc/lightning GLSL shell (layered sinusoidal arcs + noise warp)
 *   • Instanced electric tendrils that shoot outward from the surface
 *   • Blue-violet-cyan point lights matching the plasma palette
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Electric arc shell shader ──────────────────────────────────────────────────
// Layered sinusoidal arcs over noise-warped UV space give the appearance of
// crackling plasma lightning wrapping around the surface.

const electricVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    vUv      = uv;
    vPos     = position;
    vNormal  = normalMatrix * normal;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const electricFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float hash1(float p) { return fract(sin(p) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  // Thin bright arc line: maximum at sin(x)==0 crossing
  float arcLine(float x, float sharpness) {
    return pow(1.0 - abs(sin(x)), sharpness);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 1.8);

    // Noise warp — makes arcs look organic, not grid-like
    vec2 q  = vUv * 3.5 + vec2(uTime * 0.04, uTime * 0.025);
    float warpX = noise(q) * 2.0 - 1.0;
    float warpY = noise(q + vec2(3.7, 1.9)) * 2.0 - 1.0;
    vec2 warped = vUv + vec2(warpX, warpY) * 0.18;

    // Arc layer 1 — wide arcs, slow drift
    float a1 = arcLine(warped.x * 12.0 + uTime * 1.8,  18.0)
             * arcLine(warped.y * 8.0  - uTime * 1.3,  14.0);

    // Arc layer 2 — finer arcs, cross-oriented
    float a2 = arcLine(warped.x * 20.0 - uTime * 2.7 + 1.1, 22.0)
             * arcLine(warped.y * 14.0 + uTime * 2.1 + 0.7, 18.0);

    // Arc layer 3 — diagonal web
    vec2 diag = vec2(warped.x + warped.y, warped.x - warped.y) * 0.707;
    float a3 = arcLine(diag.x * 16.0 + uTime * 3.1 + 2.0, 20.0)
             * arcLine(diag.y * 11.0 - uTime * 1.9 + 0.5, 16.0);

    float arcs = a1 * 1.0 + a2 * 0.75 + a3 * 0.55;

    // Random bright flash sparks (individual arcs flicker on/off)
    float sparkSlot = floor(uTime * 12.0);
    float sparkRand  = hash1(sparkSlot + floor(warped.x * 7.0) + floor(warped.y * 5.0) * 13.0);
    float spark = sparkRand > 0.82 ? a2 * 3.0 : 0.0;
    arcs += spark;

    // Plasma palette — electric blue / violet / cyan / white-core
    vec3 deep   = vec3(0.01, 0.00, 0.18);   // deep indigo
    vec3 mid    = vec3(0.05, 0.12, 0.82);   // electric blue
    vec3 bright = vec3(0.30, 0.55, 1.00);   // sky blue
    vec3 arcCol = vec3(0.80, 0.88, 1.00);   // near-white arc core

    // Noise-based base color
    float nBase = noise(vUv * 4.0 + vec2(-uTime*0.06, uTime*0.04));
    float nDetail = noise(vUv * 8.0 + vec2(uTime*0.10, -uTime*0.07));
    float t = nBase * 0.65 + nDetail * 0.35;

    vec3 col;
    if      (t < 0.35) col = mix(deep,   mid,    t / 0.35);
    else if (t < 0.65) col = mix(mid,    bright, (t-0.35)/0.30);
    else               col = mix(bright, arcCol, (t-0.65)/0.35);

    // Add arc brightness (additive white-blue)
    col += arcCol * clamp(arcs, 0.0, 2.0) * 1.8;

    // Violet fresnel rim
    col += vec3(0.55, 0.25, 1.00) * fresnel * 1.4;

    float alpha = 0.40 + fresnel * 0.35 + clamp(arcs, 0.0, 1.0) * 0.30;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Electric aura shell ────────────────────────────────────────────────────────

function ElectricAuraShell({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.06}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={electricVert}
        fragmentShader={electricFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── Electric tendrils ──────────────────────────────────────────────────────────
// Instanced thin cylinders that shoot outward from random surface points,
// flickering like real lightning discharge.

const TENDRIL_COUNT = 22;

interface Tendril {
  dir: THREE.Vector3;
  phase: number;
  speed: number;
  maxLen: number;
  hue: number; // 0-1 HSL hue in blue-violet range
}

function ElectricTendrils({ radius }: { radius: number }) {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const up       = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const colRef   = useRef(new THREE.Color());

  const tendrils = useMemo<Tendril[]>(() =>
    Array.from({ length: TENDRIL_COUNT }, (_, i) => {
      const theta = (i / TENDRIL_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const phi   = Math.acos(2 * Math.random() - 1);
      return {
        dir: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).normalize(),
        phase:  Math.random() * Math.PI * 2,
        speed:  2.5 + Math.random() * 4.0,
        maxLen: 0.25 + Math.random() * 0.55,
        hue:    0.60 + Math.random() * 0.10, // blue (0.60) to blue-violet (0.70)
      };
    }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    tendrils.forEach((td, i) => {
      // Non-uniform flickering: sharp on, fast off
      const raw    = Math.sin(t * td.speed + td.phase);
      const active = raw > 0.0 ? raw * raw : 0; // only positive phase, squared = sharp pulse
      const len    = active * td.maxLen;

      if (len < 0.005) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        return;
      }

      // Origin at surface, tip pointing outward
      const mid = td.dir.clone().multiplyScalar(radius + len * 0.5);
      dummy.position.copy(mid);
      dummy.quaternion.setFromUnitVectors(up, td.dir);
      dummy.scale.set(0.018 + active * 0.012, len, 0.018 + active * 0.012);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Bright white-blue at peak, dimmer blue at base
      colRef.current.setHSL(td.hue, 1.0, 0.45 + active * 0.45);
      meshRef.current!.setColorAt(i, colRef.current);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TENDRIL_COUNT]}>
      <cylinderGeometry args={[1, 0.2, 1, 4]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface PlasmaBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function PlasmaBoss({ radius = 1.44, healthPercent = 1 }: PlasmaBossProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  const { scene: modelScene } = useGLTF("/models/boss_orb_5_plasma_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    // Extract baked texture from the GLB
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
          emissive:          new THREE.Color("#2244cc"),
          emissiveIntensity: 0.35,
          roughness:         0.35,
          metalness:         0.55,
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

    // Medium rotation — plasma swirls
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.4;

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        m.emissive.setRGB(1, 0.1, 0.05);
        m.emissiveIntensity = frac * osc * 2.5;
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 16));
        m.emissive.setRGB(0.4 + anger * 0.2, 0.2, 1.0);
        m.emissiveIntensity = 0.5 + anger * 0.6;
      } else {
        m.emissive.set("#2244cc");
        m.emissiveIntensity = 0.35 + Math.sin(t * 2.1) * 0.08;
      }
    });
  });

  return (
    <group>
      {/* Multi-directional electric-blue & violet lights */}
      <pointLight color="#4488ff" intensity={5}   distance={14} decay={2} position={[0, 0,  3]} />
      <pointLight color="#4488ff" intensity={4.5} distance={14} decay={2} position={[0, 0, -3]} />
      <pointLight color="#aa44ff" intensity={4}   distance={14} decay={2} position={[3, 2,  0]} />
      <pointLight color="#aa44ff" intensity={4}   distance={14} decay={2} position={[-3, -2, 0]} />
      {/* Base model */}
      <group ref={groupRef} />
      {/* Electric arc shell */}
      <ElectricAuraShell radius={radius} />
      {/* Lightning tendrils */}
      <ElectricTendrils radius={radius} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_5_plasma_texture.glb");
