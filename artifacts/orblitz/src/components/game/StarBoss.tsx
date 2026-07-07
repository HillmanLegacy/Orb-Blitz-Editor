/**
 * StarBoss — Level 2.9 boss.
 * Player-orb model + star texture + shimmering sparkle particle corona.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Sparkle particle corona ────────────────────────────────────────────────────

const SPARKLE_COUNT = 90;

interface Sparkle {
  angle: number;
  elevation: number;
  dist: number;
  life: number;
  maxLife: number;
  twinkleFreq: number;
  twinklePhase: number;
  size: number;
  orbitSpeed: number;
  isWhite: boolean;
}

function StarSparkles({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());

  const sparkles = useRef<Sparkle[]>(
    Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
      angle:       (i / SPARKLE_COUNT) * Math.PI * 2,
      elevation:   (Math.random() - 0.5) * Math.PI,
      dist:        radius * (0.82 + Math.random() * 0.70),
      life:        Math.random(),
      maxLife:     0.5 + Math.random() * 1.3,
      twinkleFreq: 4 + Math.random() * 12,
      twinklePhase:Math.random() * Math.PI * 2,
      size:        0.022 + Math.random() * 0.052,
      orbitSpeed:  (Math.random() - 0.5) * 1.4,
      isWhite:     Math.random() < 0.25,
    }))
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t   = state.clock.getElapsedTime();
    const col = colRef.current;

    sparkles.current.forEach((s, i) => {
      s.life -= delta;
      if (s.life <= 0) {
        s.angle      = Math.random() * Math.PI * 2;
        s.elevation  = (Math.random() - 0.5) * Math.PI;
        s.dist       = radius * (0.78 + Math.random() * 0.75);
        s.life       = s.maxLife;
        s.isWhite    = Math.random() < 0.25;
      }
      s.angle += delta * s.orbitSpeed;

      const r = s.dist;
      const x = Math.cos(s.angle) * Math.cos(s.elevation) * r;
      const y = Math.sin(s.elevation) * r;
      const z = Math.sin(s.angle) * Math.cos(s.elevation) * r;

      const twinkle   = Math.abs(Math.sin(t * s.twinkleFreq + s.twinklePhase));
      const lifeRatio = s.life / s.maxLife;
      const fadeIn    = Math.min(1, lifeRatio * 5);
      const sz        = s.size * twinkle * fadeIn;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(Math.max(0.0001, sz));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      if (s.isWhite) {
        col.setRGB(1, 1, 0.95);
      } else {
        // Gold-to-yellow shimmer
        col.setHSL(0.13 - twinkle * 0.04, 1.0, 0.65 + twinkle * 0.35);
      }
      meshRef.current!.setColorAt(i, col);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SPARKLE_COUNT]}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface StarBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function StarBoss({ radius = 1.44, healthPercent = 1 }: StarBossProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshStandardMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  // The texture GLB contains the orb mesh WITH UV coords + full PBR material baked in.
  // Using it directly avoids the no-UV problem of the bare model GLBs.
  const { scene: modelScene } = useGLTF("/models/boss_orb_2_star_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    const cloned = modelScene.clone(true);
    materialsRef.current = [];

    // Normalise to fit radius sphere
    const box     = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim    = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? (radius * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    // Grab the GLTFLoader-created MeshStandardMaterials (already have the texture +
    // UV-mapped geometry) and bolt on emissive so the hurt flash works.
    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial;
          std.emissive         = new THREE.Color("#ffcc44");
          std.emissiveIntensity = 0.25;
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
    // Hurt detection
    if (healthPercent < prevHealthRef.current) {
      hurtTimerRef.current = 0.15;
    }
    prevHealthRef.current = healthPercent;
    hurtTimerRef.current  = Math.max(0, hurtTimerRef.current - delta);

    // Slow spin
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
      groupRef.current.rotation.x += delta * 0.12;
    }

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        m.emissive.setRGB(1, 0.15, 0.15);
        m.emissiveIntensity = frac * osc * 2.5;
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 14));
        m.emissive.setRGB(1, 0.55 + anger * 0.2, 0);
        m.emissiveIntensity = 0.35 + anger * 0.45;
      } else {
        m.emissive.set("#ffcc44");
        m.emissiveIntensity = 0.22 + Math.sin(t * 1.8) * 0.06;
      }
    });
  });

  return (
    <group>
      {/* Warm gold fill light */}
      <pointLight color="#ffdd55" intensity={3.5} distance={8} decay={2} />
      {/* Model group (populated via useEffect) */}
      <group ref={groupRef} />
      {/* Sparkle corona */}
      <StarSparkles radius={radius} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_2_star_texture.glb");
