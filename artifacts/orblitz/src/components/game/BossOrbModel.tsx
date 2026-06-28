import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface BossOrbModelProps {
  scale?: number;
  healthPercent?: number;
}

export function BossOrbModel({ scale = 2.5, healthPercent = 1 }: BossOrbModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  const { scene: modelScene } = useGLTF("/models/boss_orb_1.glb");
  const { scene: texScene } = useGLTF("/models/boss_orb_1_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    // Extract first texture from texture GLB
    let orbTexture: THREE.Texture | null = null;
    texScene.traverse((child) => {
      if (orbTexture) return;
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const tex = (m as any).map ?? (m as any).emissiveMap ?? (m as any).baseColorTexture;
          if (tex) { orbTexture = tex; break; }
        }
      }
    });

    const cloned = modelScene.clone(true);
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
        const mat = new THREE.MeshBasicMaterial({
          map: orbTexture ?? undefined,
          color: new THREE.Color("#ffffff"),
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
    };
  }, [modelScene, texScene, scale]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.8;
      groupRef.current.rotation.x += delta * 0.3;
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

useGLTF.preload("/models/boss_orb_1.glb");
useGLTF.preload("/models/boss_orb_1_texture.glb");
