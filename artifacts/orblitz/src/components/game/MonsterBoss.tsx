/**
 * MonsterBoss — Level 9.9 boss (Shadow Orb).
 * Uses the uploaded GLB model + baked texture with:
 *   • Slow ominous rotation
 *   • Deep crimson pulse light that rages on low health
 *   • Red hurt flash overlay
 *   • Dark void glow ring
 */

import { useRef, useEffect } from "react";
import { useFrame }          from "@react-three/fiber";
import { useGLTF }           from "@react-three/drei";
import * as THREE            from "three";

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
      ref.current.color.setRGB(0.6, 0.05, 0.8);
    }
  });
  return <pointLight ref={ref} color="#880088" intensity={8} distance={28} decay={2} />;
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
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const t   = state.clock.getElapsedTime();
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

// ── Void glow ring ────────────────────────────────────────────────────────────
function VoidRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.18 + Math.abs(Math.sin(t * 1.1)) * 0.22;
    ref.current.rotation.z = t * 0.4;
  });
  return (
    <mesh ref={ref} scale={radius * 1.35} rotation={[Math.PI * 0.5, 0, 0]}>
      <ringGeometry args={[0.85, 1, 64]} />
      <meshBasicMaterial color="#cc00ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.2} side={THREE.DoubleSide} />
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
    if (orbTexture) orbTexture.colorSpace = THREE.SRGBColorSpace;

    const cloned = modelScene.clone(true);
    materialsRef.current = [];

    // Fit to radius
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

    // Slow ominous rotation — slightly wobbles
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
      <MonsterLight healthPercent={healthPercent} />

      {/* Void glow ring orbiting the boss */}
      <VoidRing radius={radius} />

      {/* GLB model body */}
      <group ref={groupRef} />

      {/* Hurt / rage overlay */}
      <HurtOverlay radius={radius} healthPercent={healthPercent} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_9_shadow_texture.glb");
