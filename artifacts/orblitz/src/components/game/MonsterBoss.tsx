/**
 * MonsterBoss — Level 9.9 boss (Shadow Orb).
 * GLB model with baked texture + void fluid layering:
 *   • Fresnel void rim shader — cyan/indigo living energy rim
 *   • 500-particle curl-noise void cloud swirling on the surface
 *   • 64 ambient void-smoke particles drifting outward
 *   • Deep crimson rage flash on low health
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame }   from "@react-three/fiber";
import { useGLTF }    from "@react-three/drei";
import * as THREE     from "three";

// ── Fresnel void rim shader ────────────────────────────────────────────────────
// No UV seam — all noise sampled in 3-D local position space.

const rimVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vPos;
  void main() {
    vNormal  = normalMatrix * normal;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvp.xyz;
    vPos     = position;
    gl_Position = projectionMatrix * mvp;
  }
`;

const rimFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vPos;

  float hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash3(i),             hash3(i+vec3(1,0,0)), f.x),
          mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
          mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 2.2);

    // Turbulent void skin — slow roll
    vec3 p  = vPos * 3.0 + vec3(uTime * 0.15, uTime * 0.09, uTime * 0.12);
    float t1 = noise3(p);
    float t2 = noise3(p * 2.1 + 1.7);
    float turb = t1 * 0.6 + t2 * 0.4;

    // Flickering tendril sparks along the rim
    float spark = noise3(vPos * 6.5 + vec3(uTime * 0.9, -uTime * 0.6, uTime * 0.45));
    spark = pow(spark, 3.0) * fresnel * 2.2;

    vec3 voidDeep  = vec3(0.039, 0.000, 0.078);  // #0A0014
    vec3 shadow    = vec3(0.267, 0.000, 0.533);  // #440088
    vec3 vivid     = vec3(0.800, 0.333, 1.000);  // #CC55FF
    vec3 midPurple = vec3(0.150, 0.000, 0.420);  // shadow mid

    // Void body with faint turbulence
    vec3 col = mix(voidDeep, midPurple, turb * 0.38);
    // Fresnel rim: shadow → vivid purple at the edges
    col += mix(shadow, vivid, fresnel * fresnel) * fresnel * 2.2;
    // Bright vivid purple tendril flickers
    col += vivid * spark * 1.6;

    float alpha = clamp(fresnel * 0.88 + spark * 0.55, 0.0, 1.0);
    // Subtle dark body presence
    alpha = max(alpha, turb * 0.07);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Fresnel rim shell component ────────────────────────────────────────────────
function FresnelRimShell({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={radius * 1.045}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={rimVert}
        fragmentShader={rimFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── Void particle cloud ────────────────────────────────────────────────────────
// 500 instanced particles swirling on/near the surface via curl-like flow.

const VOID_PARTICLE_COUNT = 500;

interface VoidParticle {
  theta:   number;
  phi:     number;
  r:       number;
  speed:   number;
  phase:   number;
  life:    number;
  maxLife: number;
  size:    number;
  colorT:  number;
}

function VoidParticleCloud({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colBuf  = useRef(new THREE.Color());

  const particles = useRef<VoidParticle[]>(
    Array.from({ length: VOID_PARTICLE_COUNT }, () => ({
      theta:   Math.random() * Math.PI * 2,
      phi:     Math.acos(2 * Math.random() - 1),
      r:       0.92 + Math.random() * 0.18,
      speed:   0.3 + Math.random() * 0.7,
      phase:   Math.random() * Math.PI * 2,
      life:    Math.random(),
      maxLife: 0.8 + Math.random() * 1.6,
      size:    0.026 + Math.random() * 0.05,
      colorT:  Math.random(),
    }))
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    particles.current.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0) {
        p.theta  = Math.random() * Math.PI * 2;
        p.phi    = Math.acos(2 * Math.random() - 1);
        p.r      = 0.90 + Math.random() * 0.12;
        p.life   = p.maxLife;
        p.colorT = Math.random();
        p.size   = 0.026 + Math.random() * 0.05;
      }

      const lifeRatio = p.life / p.maxLife;

      // Curl-like analytical flow (divergence-free approximation)
      const cx   = Math.sin(p.phi) * Math.cos(p.theta);
      const cz   = Math.cos(p.phi);
      const ts   = t * 0.22 + p.phase;
      const dTheta = Math.sin(cz * 2.6 + ts) * p.speed;
      const dPhi   = Math.cos(cx * 1.9 + ts * 0.85) * p.speed * 0.55;

      p.theta += dTheta * delta;
      p.phi   += dPhi   * delta;
      p.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, p.phi));

      // Subtle radial breath
      const breathe = Math.sin(t * 1.5 + p.phase) * 0.055;
      const rNow    = p.r + breathe;

      const sinPhi = Math.sin(p.phi);
      dummy.position.set(
        Math.cos(p.theta) * sinPhi * rNow * radius,
        Math.sin(p.theta) * sinPhi * rNow * radius,
        Math.cos(p.phi)   * rNow  * radius,
      );
      const sz = p.size * Math.min(1, lifeRatio * 3) * (0.65 + lifeRatio * 0.35);
      dummy.scale.setScalar(Math.max(0.0001, sz));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Color: deep void → shadow purple → vivid bright purple
      const outerBias = Math.max(0, (rNow - 0.90) / 0.28);
      const ct = Math.max(p.colorT, outerBias) * lifeRatio;
      if (ct < 0.45) {
        colBuf.current.setRGB(0.05 + ct * 0.42, 0.0, 0.12 + ct * 0.62);
      } else {
        const f = (ct - 0.45) / 0.55;
        colBuf.current.setRGB(0.24 + f * 0.56, 0.0 + f * 0.30, 0.50 + f * 0.50);
      }
      meshRef.current!.setColorAt(i, colBuf.current);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, VOID_PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        transparent
        opacity={0.88}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ── Void smoke ─────────────────────────────────────────────────────────────────
// 64 slow dark-violet puffs that drift outward from the surface and fade.

const VOID_SMOKE_COUNT = 64;

interface SmokeParticle {
  theta:   number;
  phi:     number;
  r:       number;
  vr:      number;
  vTheta:  number;
  vPhi:    number;
  life:    number;
  maxLife: number;
  size:    number;
}

function VoidSmoke({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colBuf  = useRef(new THREE.Color());

  const smoke = useRef<SmokeParticle[]>(
    Array.from({ length: VOID_SMOKE_COUNT }, () => ({
      theta:   Math.random() * Math.PI * 2,
      phi:     Math.acos(2 * Math.random() - 1),
      r:       1.0 + Math.random() * 0.4,
      vr:      0.3 + Math.random() * 0.45,
      vTheta:  (Math.random() - 0.5) * 0.35,
      vPhi:    (Math.random() - 0.5) * 0.25,
      life:    Math.random(),
      maxLife: 1.2 + Math.random() * 0.8,
      size:    0.07 + Math.random() * 0.10,
    }))
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    smoke.current.forEach((s, i) => {
      s.life -= delta;
      if (s.life <= 0 || s.r > 2.4) {
        s.theta   = Math.random() * Math.PI * 2;
        s.phi     = Math.acos(2 * Math.random() - 1);
        s.r       = 1.0;
        s.vr      = 0.3 + Math.random() * 0.45;
        s.vTheta  = (Math.random() - 0.5) * 0.35;
        s.vPhi    = (Math.random() - 0.5) * 0.25;
        s.life    = s.maxLife;
        s.size    = 0.07 + Math.random() * 0.10;
      }

      s.r      += s.vr    * delta;
      s.theta  += s.vTheta * delta;
      s.phi    += s.vPhi   * delta;
      s.phi     = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi));

      const lifeRatio  = s.life / s.maxLife;
      const fadeByDist = Math.max(0, 1.0 - (s.r - 1.0) / 1.4);
      const alpha      = lifeRatio * fadeByDist;

      const sinPhi = Math.sin(s.phi);
      const rWorld = s.r * radius;
      dummy.position.set(
        Math.cos(s.theta) * sinPhi * rWorld,
        Math.sin(s.theta) * sinPhi * rWorld,
        Math.cos(s.phi)   * rWorld,
      );
      dummy.scale.setScalar(Math.max(0.0001, s.size * alpha));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      colBuf.current.setRGB(0.12 * alpha, 0.0, 0.35 * alpha);
      meshRef.current!.setColorAt(i, colBuf.current);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, VOID_SMOKE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        transparent
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ── Pulsing boss light ────────────────────────────────────────────────────────
function MonsterLight({ healthPercent }: { healthPercent: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    if (healthPercent < 0.3) {
      const rage = Math.abs(Math.sin(t * 18));
      ref.current.intensity = 16 + rage * 12;
      ref.current.color.setRGB(1, 0.05 + rage * 0.05, 0.0);
    } else {
      ref.current.intensity = 8 + Math.sin(t * 1.6) * 3;
      ref.current.color.setRGB(0.53, 0.0, 1.0);  // vivid shadowy purple
    }
  });
  return <pointLight ref={ref} color="#8800ff" intensity={8} distance={28} decay={2} />;
}

// ── Hurt / rage overlay ───────────────────────────────────────────────────────
function HurtOverlay({ radius, healthPercent }: { radius: number; healthPercent: number }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const hurtRef  = useRef(0);
  const prevRef  = useRef(healthPercent);

  useFrame((state, delta) => {
    if (healthPercent < prevRef.current) hurtRef.current = 0.18;
    prevRef.current = healthPercent;
    hurtRef.current = Math.max(0, hurtRef.current - delta);
    if (!meshRef.current) return;
    const mat  = meshRef.current.material as THREE.MeshBasicMaterial;
    const t    = state.clock.getElapsedTime();
    const frac = hurtRef.current / 0.18;
    if (frac > 0) {
      mat.color.setRGB(1, 0.05, 0.05);
      mat.opacity = frac * Math.abs(Math.sin(t * 55)) * 0.65;
    } else if (healthPercent < 0.3) {
      const anger = Math.abs(Math.sin(t * 13));
      mat.color.setRGB(1, 0.1, 0.05 + anger * 0.1);
      mat.opacity = 0.18 + anger * 0.3;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <mesh ref={meshRef} scale={radius * 1.02}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ff0022" opacity={0} />
    </mesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export interface MonsterBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function MonsterBoss({ radius = 1.44, healthPercent = 1 }: MonsterBossProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshBasicMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  const { scene: modelScene } = useGLTF("/models/boss_orb_9_shadow_texture.glb");

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
        const mat  = new THREE.MeshBasicMaterial({
          map:   orbTexture ?? undefined,
          color: new THREE.Color("#ffffff"),
        });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    while (groupRef.current.children.length > 0)
      groupRef.current.remove(groupRef.current.children[0]);
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

    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.rotation.y += delta * 0.35;
      groupRef.current.rotation.x  = Math.sin(t * 0.7) * 0.08;
    }

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        const flash = frac * osc;
        m.color.setRGB(1, 1 - flash * 0.95, 1 - flash * 0.95);
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 14));
        m.color.setRGB(1, 0.45 - anger * 0.4, 0.5 - anger * 0.45);
      } else {
        m.color.setRGB(1, 1, 1);
      }
    });
  });

  return (
    <group>
      {/* Void-blue ambient light */}
      <MonsterLight healthPercent={healthPercent} />

      {/* Ambient void smoke drifting outward */}
      <VoidSmoke radius={radius} />

      {/* GLB model — baked texture preserved */}
      <group ref={groupRef} />

      {/* Swirling void particle cloud on surface */}
      <VoidParticleCloud radius={radius} />

      {/* Fresnel cyan/indigo rim — outermost shell */}
      <FresnelRimShell radius={radius} />

      {/* Hurt / rage flash */}
      <HurtOverlay radius={radius} healthPercent={healthPercent} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_9_shadow_texture.glb");
