/**
 * MechaBoss — Level 8.9 boss.
 * GLB model with mecha texture + robotic visual layer:
 *   • Counter-rotating gear rings (outer clockwise, inner CCW)
 *   • Sweeping radar/scan beam
 *   • Circuit pulse lines radiating from core
 *   • Targeting reticle that tracks the player
 *   • Steel-blue oscillating fill light + rage red on low health
 */

import { useRef, useEffect } from "react";
import { useFrame }          from "@react-three/fiber";
import { useGLTF }           from "@react-three/drei";
import * as THREE            from "three";

// ── Helper ────────────────────────────────────────────────────────────────────
const fract = (x: number) => x - Math.floor(x);

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
      mat.color.setRGB(1, 0.1, 0.15 + anger * 0.15);
      mat.opacity = 0.15 + anger * 0.25;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <mesh ref={meshRef} scale={radius * 1.02}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ff1133" opacity={0} />
    </mesh>
  );
}

// ── Pulsing boss light ────────────────────────────────────────────────────────
function MechaLight({ healthPercent }: { healthPercent: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    if (healthPercent < 0.3) {
      const rage = Math.abs(Math.sin(t * 16));
      ref.current.intensity = 14 + rage * 10;
      ref.current.color.setRGB(1, 0.2 + rage * 0.1, 0.15);
    } else {
      ref.current.intensity = 10 + Math.sin(t * 2.2) * 2.5;
      ref.current.color.setRGB(0.25, 0.72, 1.0);
    }
  });
  return <pointLight ref={ref} color="#44bbff" intensity={10} distance={24} decay={2} />;
}

// ── Main component ────────────────────────────────────────────────────────────
export interface MechaBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function MechaBoss({ radius = 1.44, healthPercent = 1 }: MechaBossProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  const { scene: modelScene } = useGLTF("/models/boss_orb_8_mecha_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    // Extract baked texture from the GLB (same pattern as DiamondBoss / PlasmaBoss)
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
        if (orbTexture) orbTexture.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({
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

    // Slow mechanical rotation — like a turret tracking
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.55;

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        // Red hurt flash
        const flash = frac * osc;
        m.color.setRGB(1, 1 - flash * 0.9, 1 - flash * 0.9);
      } else if (healthPercent < 0.3) {
        // Orange-red rage pulse
        const anger = Math.abs(Math.sin(t * 14));
        m.color.setRGB(1, 0.55 - anger * 0.35, 0.5 - anger * 0.4);
      } else {
        m.color.setRGB(1, 1, 1);
      }
    });
  });

  return (
    <group>
      <MechaLight healthPercent={healthPercent} />

      {/* GLB model body */}
      <group ref={groupRef} />

      {/* Hurt / rage overlay */}
      <HurtOverlay radius={radius} healthPercent={healthPercent} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_8_mecha_texture.glb");
