/**
 * MiniMonsterOrb — projectile fired by the Level 9.9 Shadow Boss.
 * Scaled-down void fluid effect: GLB texture + fresnel purple rim +
 * mini particle cloud + mini void smoke — matching MonsterBoss palette.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame }   from "@react-three/fiber";
import { useGLTF }    from "@react-three/drei";
import * as THREE     from "three";
import { getPlayerSkinVisualYaw } from "./PlayerSkinVisualConfig";

// ── Fresnel void rim shader (same GLSL as boss, reused) ───────────────────────
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

    vec3 p  = vPos * 3.0 + vec3(uTime * 0.15, uTime * 0.09, uTime * 0.12);
    float t1 = noise3(p);
    float t2 = noise3(p * 2.1 + 1.7);
    float turb = t1 * 0.6 + t2 * 0.4;

    float spark = noise3(vPos * 6.5 + vec3(uTime * 0.9, -uTime * 0.6, uTime * 0.45));
    spark = pow(spark, 3.0) * fresnel * 2.2;

    vec3 voidDeep  = vec3(0.039, 0.000, 0.078);
    vec3 shadow    = vec3(0.267, 0.000, 0.533);
    vec3 vivid     = vec3(0.800, 0.333, 1.000);
    vec3 midPurple = vec3(0.150, 0.000, 0.420);

    vec3 col = mix(voidDeep, midPurple, turb * 0.38);
    col += mix(shadow, vivid, fresnel * fresnel) * fresnel * 2.2;
    col += vivid * spark * 1.6;

    float alpha = clamp(fresnel * 0.88 + spark * 0.55, 0.0, 1.0);
    alpha = max(alpha, turb * 0.07);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Fresnel rim shell ─────────────────────────────────────────────────────────
function MiniFresnelRim({ radius }: { radius: number }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });
  return (
    <mesh scale={radius * 1.05}>
      <sphereGeometry args={[1, 32, 32]} />
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
// ── Mini void particle cloud ──────────────────────────────────────────────────
// 100 particles — same curl-noise swirl as boss, tuned for projectile scale.

const MINI_PARTICLE_COUNT = 100;

interface VoidParticle {
  theta: number; phi: number; r: number;
  speed: number; phase: number;
  life: number; maxLife: number;
  size: number; colorT: number;
}

function MiniVoidCloud({ radius, count = MINI_PARTICLE_COUNT }: { radius: number; count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colBuf  = useRef(new THREE.Color());

  const particles = useRef<VoidParticle[]>(
    Array.from({ length: count }, () => ({
      theta:   Math.random() * Math.PI * 2,
      phi:     Math.acos(2 * Math.random() - 1),
      r:       0.92 + Math.random() * 0.18,
      speed:   0.4 + Math.random() * 0.8,
      phase:   Math.random() * Math.PI * 2,
      life:    Math.random(),
      maxLife: 0.7 + Math.random() * 1.4,
      size:    0.022 + Math.random() * 0.044,
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
        p.size   = 0.022 + Math.random() * 0.044;
      }

      const lifeRatio = p.life / p.maxLife;
      const cx  = Math.sin(p.phi) * Math.cos(p.theta);
      const cz  = Math.cos(p.phi);
      const ts  = t * 0.28 + p.phase;
      p.theta  += Math.sin(cz * 2.6 + ts) * p.speed * delta;
      p.phi    += Math.cos(cx * 1.9 + ts * 0.85) * p.speed * 0.55 * delta;
      p.phi     = Math.max(0.05, Math.min(Math.PI - 0.05, p.phi));

      const rNow   = p.r + Math.sin(t * 1.5 + p.phase) * 0.055;
      const sinPhi = Math.sin(p.phi);
      dummy.position.set(
        Math.cos(p.theta) * sinPhi * rNow * radius,
        Math.sin(p.theta) * sinPhi * rNow * radius,
        Math.cos(p.phi)   * rNow  * radius,
      );
      dummy.scale.setScalar(Math.max(0.0001, p.size * Math.min(1, lifeRatio * 3) * (0.65 + lifeRatio * 0.35)));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Mini void smoke ───────────────────────────────────────────────────────────
const MINI_SMOKE_COUNT = 20;

interface SmokeParticle {
  theta: number; phi: number; r: number;
  vr: number; vTheta: number; vPhi: number;
  life: number; maxLife: number; size: number;
}

function MiniVoidSmoke({ radius, count = MINI_SMOKE_COUNT }: { radius: number; count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colBuf  = useRef(new THREE.Color());

  const smoke = useRef<SmokeParticle[]>(
    Array.from({ length: count }, () => ({
      theta:   Math.random() * Math.PI * 2,
      phi:     Math.acos(2 * Math.random() - 1),
      r:       1.0 + Math.random() * 0.3,
      vr:      0.35 + Math.random() * 0.45,
      vTheta:  (Math.random() - 0.5) * 0.35,
      vPhi:    (Math.random() - 0.5) * 0.25,
      life:    Math.random(),
      maxLife: 1.0 + Math.random() * 0.7,
      size:    0.055 + Math.random() * 0.085,
    }))
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    smoke.current.forEach((s, i) => {
      s.life -= delta;
      if (s.life <= 0 || s.r > 2.2) {
        s.theta  = Math.random() * Math.PI * 2;
        s.phi    = Math.acos(2 * Math.random() - 1);
        s.r      = 1.0;
        s.vr     = 0.35 + Math.random() * 0.45;
        s.vTheta = (Math.random() - 0.5) * 0.35;
        s.vPhi   = (Math.random() - 0.5) * 0.25;
        s.life   = s.maxLife;
        s.size   = 0.055 + Math.random() * 0.085;
      }
      s.r     += s.vr    * delta;
      s.theta += s.vTheta * delta;
      s.phi   += s.vPhi   * delta;
      s.phi    = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi));

      const lr    = s.life / s.maxLife;
      const fade  = lr * Math.max(0, 1.0 - (s.r - 1.0) / 1.2);
      const sinPhi = Math.sin(s.phi);
      const rw    = s.r * radius;
      dummy.position.set(Math.cos(s.theta) * sinPhi * rw, Math.sin(s.theta) * sinPhi * rw, Math.cos(s.phi) * rw);
      dummy.scale.setScalar(Math.max(0.0001, s.size * fade));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      colBuf.current.setRGB(0.12 * fade, 0.0, 0.35 * fade);
      meshRef.current!.setColorAt(i, colBuf.current);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface MiniMonsterOrbProps {
  radius?: number;
  particleCount?: number;
  showParticles?: boolean;
  showLight?: boolean;
}

export function MiniMonsterOrb({ radius = 1, particleCount = MINI_PARTICLE_COUNT, showParticles = true, showLight = true }: MiniMonsterOrbProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

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

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.set(
        0,
        getPlayerSkinVisualYaw("monster", clock.getElapsedTime()),
        0,
      );
    }
  });

  return (
    <group>
      {showLight && <pointLight color="#8800ff" intensity={1.8} distance={4.5} decay={2} />}
      {/* Ambient void smoke */}
      {showParticles && <MiniVoidSmoke
        radius={radius}
        count={Math.max(1, Math.floor(particleCount * MINI_SMOKE_COUNT / MINI_PARTICLE_COUNT))}
      />}
      {/* GLB texture body */}
      <group ref={groupRef} />
      {/* Swirling void particle cloud */}
      {showParticles && <MiniVoidCloud radius={radius} count={particleCount} />}
      {/* Fresnel purple rim */}
      <MiniFresnelRim radius={radius} />
    </group>
  );
}
