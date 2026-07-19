/**
 * DiamondBoss — Level 6.9 boss.
 * GLB model with diamond texture + high-quality 3D shimmer/sparkle aura:
 *   • Prismatic facet shell — thin sphere with animated rainbow diffraction shader
 *   • Orbiting diamond shard instances catching directional light
 *   • Starburst sparkle points that flare on/off across the surface
 *   • Icy-white / cyan / prismatic point lights matching the diamond palette
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Prismatic shimmer shell shader ────────────────────────────────────────────
// Simulates light diffracting through a crystalline surface:
// • Iridescent bands that shift with view angle (thin-film interference)
// • Animated sparkle flares at high-frequency noise peaks
// • Clean icy-white base with rainbow hue sweep

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

    // World-space reflect direction for iridescent band shift
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

  // Convert HSL to RGB inline
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
    float ndotv  = max(0.0, dot(n, v));
    float fresnel = pow(1.0 - ndotv, 2.2);

    // ── Iridescent bands ──────────────────────────────────────────────────────
    // Hue driven by view-angle + reflected direction + time drift
    float iriHue = fract(vReflect.x * 0.5 + vReflect.y * 0.3 + uTime * 0.04 + noise(vUv * 3.0) * 0.25);
    vec3 iriCol  = hsl2rgb(iriHue, 0.9, 0.65);

    // ── Sparkle flares ────────────────────────────────────────────────────────
    // High-frequency noise peaks become bright point-like flares
    vec2 sp1 = vUv * 14.0 + vec2( uTime * 0.11, -uTime * 0.07);
    vec2 sp2 = vUv * 22.0 + vec2(-uTime * 0.09,  uTime * 0.13);
    float n1 = noise(sp1);
    float n2 = noise(sp2);
    // Starburst: only the very top of the noise peaks
    float flare1 = smoothstep(0.80, 1.00, n1) * smoothstep(0.82, 1.00, n2);
    // Random timed flashes — different cells pop on each 0.1s tick
    float tick   = floor(uTime * 10.0);
    float cell   = floor(n1 * 32.0) + floor(n2 * 32.0) * 32.0;
    float flash  = hash1(cell + tick * 97.3) > 0.80 ? 1.0 : 0.0;
    float sparkle = flare1 * (0.6 + flash * 1.4);

    // 4-pointed starburst shape — cross of two thin lines in screen UV
    vec2 centered = (vUv - 0.5) * 2.0;
    float arm1 = smoothstep(0.04, 0.0, abs(centered.x)) * smoothstep(0.6, 0.0, abs(centered.y));
    float arm2 = smoothstep(0.04, 0.0, abs(centered.y)) * smoothstep(0.6, 0.0, abs(centered.x));
    float arm3 = smoothstep(0.04, 0.0, abs(centered.x - centered.y) * 0.707) * smoothstep(0.5, 0.0, length(centered));
    float arm4 = smoothstep(0.04, 0.0, abs(centered.x + centered.y) * 0.707) * smoothstep(0.5, 0.0, length(centered));
    float star = (arm1 + arm2) * 0.5 + (arm3 + arm4) * 0.25;

    // ── Compose ───────────────────────────────────────────────────────────────
    // Base: icy white with subtle cyan tint
    vec3 icyBase = vec3(0.88, 0.94, 1.00);
    vec3 cyanTint = vec3(0.50, 0.85, 1.00);

    vec3 col = mix(icyBase, cyanTint, fresnel * 0.5);
    // Iridescent overlay — stronger at glancing angles
    col = mix(col, iriCol, fresnel * 0.65 + 0.15);
    // Sparkle flares (bright white)
    col += vec3(1.0, 1.0, 1.0) * sparkle * 3.0;
    // Starburst overlay at surface center
    col += vec3(1.0, 0.98, 0.95) * star * 0.8 * (0.5 + flash * 0.5);

    // Final fresnel rim — pure white edge
    col += vec3(1.0) * pow(fresnel, 1.5) * 0.9;

    float alpha = 0.25 + fresnel * 0.45 + sparkle * 0.30 + star * 0.15;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Shimmer shell ─────────────────────────────────────────────────────────────

function ShimmerShell({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.07}>
      <sphereGeometry args={[1, 64, 64]} />
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
  );
}

// ── Orbiting diamond shards ───────────────────────────────────────────────────
// Faceted octahedra that orbit the boss at varying speeds and radii,
// each catching light differently for that prismatic shard look.

const SHARD_COUNT = 18;

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

function DiamondShards({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());

  const shards = useMemo<Shard[]>(() =>
    Array.from({ length: SHARD_COUNT }, (_, i) => ({
      orbitRadius: radius * (1.15 + Math.random() * 0.45),
      orbitSpeed:  0.6 + Math.random() * 1.2,
      orbitPhase:  (i / SHARD_COUNT) * Math.PI * 2,
      tiltAxis:    new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize(),
      tiltAngle: Math.random() * Math.PI,
      spinSpeed: 1.5 + Math.random() * 2.5,
      scale:     0.06 + Math.random() * 0.12,
      hue:       Math.random(), // full rainbow spectrum for prismatic effect
    })), [radius]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    shards.forEach((s, i) => {
      const angle = t * s.orbitSpeed + s.orbitPhase;
      // Tilted orbit: rotate the orbital plane by tiltAxis/tiltAngle
      const basePos = new THREE.Vector3(
        Math.cos(angle) * s.orbitRadius,
        Math.sin(angle) * s.orbitRadius * 0.5,
        Math.sin(angle * 1.3) * s.orbitRadius * 0.3
      );
      // Apply tilt transform
      const qTilt = new THREE.Quaternion().setFromAxisAngle(s.tiltAxis, s.tiltAngle);
      basePos.applyQuaternion(qTilt);

      dummy.position.copy(basePos);
      dummy.rotation.set(t * s.spinSpeed, t * s.spinSpeed * 0.7, t * s.spinSpeed * 0.4);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Shimmer hue shifts over time like a prism catching light
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

function fract(x: number) { return x - Math.floor(x); }

// ── Main component ─────────────────────────────────────────────────────────────

export interface DiamondBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function DiamondBoss({ radius = 1.44, healthPercent = 1 }: DiamondBossProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  const { scene: modelScene } = useGLTF("/models/boss_orb_6_diamond_texture.glb");

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
          emissive:          new THREE.Color("#aaddff"),
          emissiveIntensity: 0.25,
          roughness:         0.05,
          metalness:         0.9,
          envMapIntensity:   1.5,
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

    // Slow elegant rotation — diamonds don't rush
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.25;

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        m.emissive.setRGB(1, 0.1, 0.05);
        m.emissiveIntensity = frac * osc * 2.5;
      } else if (healthPercent < 0.3) {
        // Angry: shift emissive to red-pink
        const anger = Math.abs(Math.sin(t * 14));
        m.emissive.setRGB(1.0, 0.3 + anger * 0.2, 0.5);
        m.emissiveIntensity = 0.4 + anger * 0.5;
      } else {
        // Gentle cyan-white shimmer pulse
        const pulse = Math.sin(t * 1.8) * 0.5 + 0.5;
        m.emissive.setHSL(0.55 + pulse * 0.08, 0.8, 0.72);
        m.emissiveIntensity = 0.20 + pulse * 0.12;
      }
    });
  });

  return (
    <group>
      {/* Icy-white and rainbow point lights for prismatic fill */}
      <pointLight color="#ffffff" intensity={6}   distance={14} decay={2} position={[0,  0,  3]} />
      <pointLight color="#aaddff" intensity={5}   distance={14} decay={2} position={[0,  0, -3]} />
      <pointLight color="#ffccee" intensity={4}   distance={14} decay={2} position={[3,  2,  0]} />
      <pointLight color="#ccffee" intensity={4}   distance={14} decay={2} position={[-3,-2,  0]} />
      <pointLight color="#eeccff" intensity={3.5} distance={10} decay={2} position={[0,  3, -2]} />
      {/* Base model */}
      <group ref={groupRef} />
      {/* Prismatic shimmer shell */}
      <ShimmerShell radius={radius} />
      {/* Orbiting diamond shards */}
      <DiamondShards radius={radius} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_6_diamond_texture.glb");
