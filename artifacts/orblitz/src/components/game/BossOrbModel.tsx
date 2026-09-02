import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getPlayerSkinVisualYaw } from "./PlayerSkinVisualConfig";
import {
  createBossOrbTextureMaterial,
  findBossOrbTexture,
} from "./BossOrbTextureMaterial";

interface BossOrbModelProps {
  scale?: number;
  healthPercent?: number;
  /** Disable when PlayerOrb's visible-model parent owns the rotation. */
  animatePresentationYaw?: boolean;
}
export function BossOrbModel({ scale = 2.5, healthPercent = 1, animatePresentationYaw = true }: BossOrbModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  // The textured GLB contains the authoritative Fire Boss geometry, UVs, and
  // texture. Do not pair its texture with the older untextured base GLB: that
  // file uses a different flat source mesh.
  const { scene: textureScene } = useGLTF("/models/boss_orb_1_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    // Extract the authored map so every cloned material uses the exact shop
    // texture, even if the asset later gains multiple material groups.
    const orbTexture = findBossOrbTexture(textureScene);

    const cloned = textureScene.clone(true);
    materialsRef.current = [];

    // Normalize size to fit within scale radius
    const box = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? (scale * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clonedMaterials = sourceMaterials.map((sourceMaterial) =>
          createBossOrbTextureMaterial(sourceMaterial, orbTexture),
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
    };
  }, [textureScene, scale]);

  useFrame(({ clock }) => {
    if (animatePresentationYaw && groupRef.current) {
      groupRef.current.rotation.set(
        0,
        getPlayerSkinVisualYaw("fire", clock.getElapsedTime()),
        0,
      );
    }
    // Pulse red tint when low health
    if (healthPercent < 0.3) {
      const t = Date.now() * 0.008;
      const intensity = 0.5 + Math.sin(t) * 0.5;
      materialsRef.current.forEach((m) => {
        m.color.setRGB(1, 0.4 + intensity * 0.3, 0.4 + intensity * 0.3);
      });
    }
  });

  return <group ref={groupRef} />;
}
