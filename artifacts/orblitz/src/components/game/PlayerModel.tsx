import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface PlayerModelProps {
  scale: number;
  coreColor?: string;
  glowColor?: string;
  isRainbow?: boolean;
  rotationSpeedX?: number;
  rotationSpeedY?: number;
}

export function PlayerModel({
  scale,
  isRainbow = false,
  rotationSpeedX = 0.8,
  rotationSpeedY = 1.2,
}: PlayerModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshBasicMaterial[]>([]);

  const { scene: modelScene } = useGLTF("/models/player_orb.glb");
  const { scene: texScene }   = useGLTF("/models/player_orb_texture.glb");

  useEffect(() => {
    if (!modelGroupRef.current) return;

    // Extract the first texture found in the texture GLB
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

    // Normalize size: fit model inside radius = scale
    const box = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? (scale * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);

    // Centre on bounding-box midpoint
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

    while (modelGroupRef.current.children.length > 0) {
      modelGroupRef.current.remove(modelGroupRef.current.children[0]);
    }
    modelGroupRef.current.add(cloned);

    return () => {
      materialsRef.current.forEach((m) => m.dispose());
    };
  }, [modelScene, texScene, scale]);

  useFrame((state, delta) => {
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.x += delta * rotationSpeedX;
      modelGroupRef.current.rotation.y += delta * rotationSpeedY;
    }
    if (isRainbow) {
      const hue = (state.clock.getElapsedTime() * 0.18) % 1;
      materialsRef.current.forEach((m) => m.color.setHSL(hue, 1, 0.6));
    }
  });

  return <group ref={modelGroupRef} />;
}

useGLTF.preload("/models/player_orb.glb");
useGLTF.preload("/models/player_orb_texture.glb");
