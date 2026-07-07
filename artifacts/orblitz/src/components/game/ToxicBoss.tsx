/**
 * ToxicBoss — Level 4.9 boss.
 * Player-orb model + toxic texture + HD animated dripping liquid effect.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Drip surface overlay shader ────────────────────────────────────────────────
// A sphere slightly larger than the model whose bottom vertices are displaced
// into animated drip shapes, giving the appearance of viscous liquid dripping.

const dripVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vDripAmt;

  void main() {
    vUv    = uv;
    vec3 pos = position;

    // Bottom-hemisphere drip displacement
    // bottomness: 0 at equator (y=0), 1 at south pole (y=-1)
    float bottomness = clamp(-pos.y, 0.0, 1.0);

    float angle = atan(pos.z, pos.x);

    float drip = 0.0;
    // 6 independently animated drip streams
    for (int i = 0; i < 6; i++) {
      float dripAngle  = float(i) * 1.0472; // 2π/6
      float angDiff    = abs(mod(angle - dripAngle + 3.14159, 6.28318) - 3.14159);
      float dripWidth  = smoothstep(0.38, 0.0, angDiff);
      float phase      = uTime * 1.1 + float(i) * 1.3;
      float dripLen    = (sin(phase) * 0.5 + 0.5) * (0.5 + 0.5 * sin(phase * 0.7));
      drip += dripWidth * dripLen * bottomness * bottomness;
    }

    // Bulge: extend vertex along its normal-ish direction (mostly downward)
    float bulge = drip * 0.45;
    pos += normal * bulge * 0.3;
    pos.y -= bulge * 0.8;

    vDripAmt  = clamp(drip, 0.0, 1.0);
    vNormal   = normalMatrix * normal;
    vec4 mvp  = modelViewMatrix * vec4(pos, 1.0);
    vViewPos  = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const dripFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vDripAmt;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);

    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 2.5);

    // Animated surface blobs
    vec2 q  = vUv * 2.5 + vec2(-uTime * 0.08, 0.0);
    float n1 = noise(q);
    float n2 = noise(q * 2.1 + vec2(1.7, 2.3));
    float blob = n1 * 0.6 + n2 * 0.4;

    // Toxic green palette
    vec3 toxicDeep   = vec3(0.02, 0.16, 0.01);
    vec3 toxicMid    = vec3(0.08, 0.52, 0.04);
    vec3 toxicBright = vec3(0.25, 0.90, 0.08);
    vec3 toxicGlow   = vec3(0.55, 1.00, 0.20);

    float t = blob;
    vec3 col;
    if      (t < 0.35) col = mix(toxicDeep,   toxicMid,    t / 0.35);
    else if (t < 0.65) col = mix(toxicMid,    toxicBright, (t-0.35)/0.30);
    else               col = mix(toxicBright, toxicGlow,   (t-0.65)/0.35);

    // Drip region: brighter yellow-green at the tip of each drip
    col = mix(col, toxicGlow * 1.3, vDripAmt * 0.5);

    // Wet specular
    vec3 r   = reflect(-v, n);
    float sp = pow(max(0.0, r.z), 40.0);
    col     += vec3(0.7, 1.0, 0.5) * sp * 0.65;

    // Fresnel rim
    col += toxicGlow * fresnel * 0.55;

    // Drip region is more opaque
    float baseAlpha = 0.55 + fresnel * 0.30 + vDripAmt * 0.35;
    gl_FragColor = vec4(col, clamp(baseAlpha, 0.0, 1.0));
  }
`;

function ToxicDripSurface({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.04}>
      {/* Higher segment count for smooth drip displacement */}
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={dripVert}
        fragmentShader={dripFrag}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── Falling droplet instances ──────────────────────────────────────────────────

const DRIP_COUNT = 28;

interface Drop {
  sx: number; sz: number; // surface XZ attachment point
  surfaceY: number;       // Y where the drip spawns (bottom hemisphere)
  posY: number;
  velY: number;
  size: number;
  life: number;
  maxLife: number;
}

function makeDrop(radius: number): Drop {
  const angle     = Math.random() * Math.PI * 2;
  const elevation = -(0.1 + Math.random() * 0.55) * Math.PI; // bottom hemisphere
  const r         = radius;
  return {
    sx:       Math.cos(angle) * Math.cos(elevation) * r,
    sz:       Math.sin(angle) * Math.cos(elevation) * r,
    surfaceY: Math.sin(elevation) * r,
    posY:     Math.sin(elevation) * r,
    velY:     -(0.3 + Math.random() * 0.8),
    size:     0.04 + Math.random() * 0.10,
    life:     Math.random(),
    maxLife:  0.9 + Math.random() * 1.0,
  };
}

function ToxicDroplets({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());
  const drops   = useRef<Drop[]>(
    Array.from({ length: DRIP_COUNT }, () => makeDrop(radius))
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const col = colRef.current;

    drops.current.forEach((d, i) => {
      d.life -= delta;
      if (d.life <= 0) {
        const fresh = makeDrop(radius);
        drops.current[i] = fresh;
        return;
      }

      // Gravity + increasing speed
      d.velY -= 3.5 * delta;
      d.posY += d.velY * delta;

      const lifeRatio = d.life / d.maxLife;
      const fadeOut   = lifeRatio < 0.2 ? lifeRatio / 0.2 : 1;

      // Stretch vertically as speed increases
      const stretch = 1 + Math.abs(d.velY) * 0.22;
      const sz      = d.size * fadeOut;

      dummy.position.set(d.sx, d.posY, d.sz);
      dummy.scale.set(sz / stretch, sz * stretch, sz / stretch);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Yellow-green brightest at start, darker as it falls
      col.setHSL(0.27 + lifeRatio * 0.04, 1.0, 0.35 + lifeRatio * 0.18);
      meshRef.current!.setColorAt(i, col);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DRIP_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface ToxicBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function ToxicBoss({ radius = 1.44, healthPercent = 1 }: ToxicBossProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshStandardMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  // The texture GLB contains the orb mesh WITH UV coords + full PBR material baked in.
  const { scene: modelScene } = useGLTF("/models/boss_orb_4_toxic_texture.glb");

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
          std.emissive          = new THREE.Color("#22aa08");
          std.emissiveIntensity = 0.3;
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

    // Very slow rot (liquid blobs don't spin fast)
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        m.emissive.setRGB(1, 0.1, 0.05);
        m.emissiveIntensity = frac * osc * 2.5;
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 14));
        m.emissive.setRGB(0.5 + anger * 0.2, 1.0, 0.0);
        m.emissiveIntensity = 0.4 + anger * 0.5;
      } else {
        m.emissive.set("#22aa08");
        m.emissiveIntensity = 0.3 + Math.sin(t * 1.5) * 0.07;
      }
    });
  });

  return (
    <group>
      {/* Multi-directional green fill lights for full-model coverage */}
      <pointLight color="#44ff22" intensity={4}   distance={12} decay={2} position={[0, 0,  3]} />
      <pointLight color="#44ff22" intensity={3.5} distance={12} decay={2} position={[0, 0, -3]} />
      <pointLight color="#66ff44" intensity={3}   distance={12} decay={2} position={[3, 2,  0]} />
      <pointLight color="#66ff44" intensity={3}   distance={12} decay={2} position={[-3, -2, 0]} />
      {/* Base model */}
      <group ref={groupRef} />
      {/* Drip surface shader overlay */}
      <ToxicDripSurface radius={radius} />
      {/* Falling droplet instances */}
      <ToxicDroplets radius={radius} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_4_toxic_texture.glb");
