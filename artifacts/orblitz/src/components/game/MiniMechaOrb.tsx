/**
 * MiniMechaOrb — projectile fired by the Level 8.9 Mecha Boss.
 * A scaled-down copy of the boss model using the same GLB + MeshBasicMaterial
 * so it is always fully lit regardless of scene lighting.
 */

import { useRef, useEffect } from "react";
import { useFrame }          from "@react-three/fiber";
import { useGLTF }           from "@react-three/drei";
import * as THREE            from "three";

interface MiniMechaOrbProps {
  radius?: number;
}

export function MiniMechaOrb({ radius = 1 }: MiniMechaOrbProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

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

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 1.8;
      groupRef.current.rotation.x += delta * 0.6;
    }
  });

  return (
    <group>
      <pointLight color="#44bbff" intensity={1.4} distance={4} decay={2} />
      <group ref={groupRef} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_8_mecha_texture.glb");
