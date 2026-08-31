/**
 * MiniMechaOrb — projectile fired by the Level 8.9 Mecha Boss.
 * A scaled-down copy of the boss model using the same GLB + MeshBasicMaterial
 * so it is always fully lit regardless of scene lighting.
 */

import { useRef, useEffect } from "react";
import { useFrame }          from "@react-three/fiber";
import { useGLTF }           from "@react-three/drei";
import * as THREE            from "three";
import { getPlayerSkinVisualYaw } from "./PlayerSkinVisualConfig";
import { clonePlayerOrbMaterial } from "./PlayerOrbMaterial";

interface MiniMechaOrbProps {
  radius?: number;
  showLight?: boolean;
  animatePresentationYaw?: boolean;
}
export function MiniMechaOrb({ radius = 1, showLight = true, animatePresentationYaw = true }: MiniMechaOrbProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.Material[]>([]);

  const { scene: modelScene } = useGLTF("/models/boss_orb_8_mecha_texture.glb");

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
        const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const mat = clonePlayerOrbMaterial({
          baseMaterial: sourceMaterial,
          textureMaterial: sourceMaterial,
          coreColor: "#ffffff",
          glowColor: "#ffffff",
          tintColors: false,
        });
        const authoredMaterial = mat as THREE.MeshStandardMaterial;
        if (!authoredMaterial.map && orbTexture) authoredMaterial.map = orbTexture;
        authoredMaterial.needsUpdate = true;
        mesh.material = authoredMaterial;
        materialsRef.current.push(authoredMaterial);
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
    if (animatePresentationYaw && groupRef.current) {
      groupRef.current.rotation.set(0, getPlayerSkinVisualYaw("mecha", clock.getElapsedTime()), 0);
    }
  });

  return (
    <group>
      {showLight && <pointLight color="#44bbff" intensity={1.4} distance={4} decay={2} />}
      <group ref={groupRef} />
    </group>
  );
}
