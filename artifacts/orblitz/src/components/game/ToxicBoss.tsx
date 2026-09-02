/**
 * ToxicBoss — Level 4.9 boss.
 * Player-orb model + toxic texture + HD animated dripping droplet effects.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  getPlayerSkinVisualYaw,
  PLAYER_SKIN_MODEL_PATHS,
} from "./PlayerSkinVisualConfig";

// ── Falling droplet instances ──────────────────────────────────────────────────

export const TOXIC_DRIP_COUNT = 28;

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

function ToxicDroplets({ radius, count = TOXIC_DRIP_COUNT }: { radius: number; count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());
  const drops   = useRef<Drop[]>(
    Array.from({ length: count }, () => makeDrop(radius))
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
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
  ownsModelRotation?: boolean;
}

export interface ToxicOrbVisualProps extends ToxicBossProps {
  particleCount?: number;
  showParticles?: boolean;
  animatePresentationYaw?: boolean;
  internalRotationSpeed?: number;
}

export function createToxicBossMaterial(
  sourceMaterial: THREE.Material,
  fallbackTexture?: THREE.Texture | null,
): THREE.MeshBasicMaterial {
  const source = sourceMaterial as THREE.MeshBasicMaterial;
  const map = source.map ?? fallbackTexture ?? undefined;

  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  // Match FireBoss: display the authored map directly instead of letting
  // arcade-mode lighting multiply the texture into a dim PBR surface.
  return new THREE.MeshBasicMaterial({
    map,
    color: new THREE.Color("#ffffff"),
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
  });
}

export function ToxicOrbVisual({
  radius = 1.44,
  healthPercent = 1,
  particleCount = TOXIC_DRIP_COUNT,
  showParticles = true,
  animatePresentationYaw = false,
  internalRotationSpeed = 0,
}: ToxicOrbVisualProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshBasicMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  // The texture GLB contains the orb mesh WITH UV coords + full PBR material baked in.
  // Keep this path shared with the equipped Toxic player skin.
  const { scene: modelScene } = useGLTF(PLAYER_SKIN_MODEL_PATHS.toxic);

  useEffect(() => {
    if (!groupRef.current) return;

    // Extract the authored map so every cloned material uses the same texture,
    // even if the asset later gains multiple material groups.
    let orbTexture: THREE.Texture | null = null;
    modelScene.traverse((child) => {
      if (orbTexture) return;
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const tex = (mat as any).map ?? (mat as any).emissiveMap ?? (mat as any).aoMap;
          if (tex) {
            const texture = tex as THREE.Texture;
            orbTexture = texture;
            texture.needsUpdate = true;
            break;
          }
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
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clonedMaterials = sourceMaterials.map((sourceMaterial) =>
          createToxicBossMaterial(sourceMaterial, orbTexture),
        );
        mesh.material = clonedMaterials.length === 1 ? clonedMaterials[0] : clonedMaterials;
        materialsRef.current.push(...clonedMaterials);
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

    // Boss bodies use a slow continuous turn. Projectile/player instances can
    // instead opt into their established bounded presentation yaw or let their
    // stable parent own rotation.
    if (groupRef.current) {
      if (animatePresentationYaw) {
        groupRef.current.rotation.y = getPlayerSkinVisualYaw("toxic", state.clock.getElapsedTime());
      } else if (internalRotationSpeed !== 0) {
        groupRef.current.rotation.y += delta * internalRotationSpeed;
      }
    }

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        const flash = frac * osc;
        m.color.setRGB(1, 0.1 + flash * 0.2, 0.05 + flash * 0.2);
      } else if (healthPercent < 0.3) {
        const anger = Math.abs(Math.sin(t * 14));
        m.color.setRGB(0.2 + anger * 0.1, 0.8 + anger * 0.2, 0.02);
      } else {
        m.color.set("#ffffff");
      }
    });
  });

  return (
    <group>
      {/* Base model */}
      <group ref={groupRef} />
      {/* Falling droplet instances */}
      {showParticles && <ToxicDroplets radius={radius} count={particleCount} />}
    </group>
  );
}

export function ToxicBoss({
  radius = 1.44,
  healthPercent = 1,
  ownsModelRotation = false,
}: ToxicBossProps) {
  return (
    <ToxicOrbVisual
      radius={radius}
      healthPercent={healthPercent}
      internalRotationSpeed={ownsModelRotation ? 0 : 0.15}
    />
  );
}
