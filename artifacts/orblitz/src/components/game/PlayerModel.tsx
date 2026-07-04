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
  // Hold refs to cloned materials for rainbow tinting.
  // These are cloned per-instance so they are safe to mutate and dispose.
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  // player_orb_texture.glb contains the fully textured model — geometry AND
  // materials/textures already set up correctly by GLTFLoader (proper sRGB
  // colorspace, PBR roughness/metalness, etc.).  We clone that scene directly
  // so the texture is guaranteed to be present without any extraction dance.
  const { scene: texScene } = useGLTF("/models/player_orb_texture.glb");

  useEffect(() => {
    if (!modelGroupRef.current) return;

    // Deep-clone so each PlayerModel instance has independent transforms and
    // its own material copies (needed for per-instance rainbow tinting).
    const cloned = texScene.clone(true);
    materialsRef.current = [];

    // Normalize size: fit the model inside a sphere of radius = scale.
    const box = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? (scale * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);

    // Offset so the bounding-box midpoint sits at local origin.
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.set(
      -center.x * normScale,
      -center.y * normScale,
      -center.z * normScale,
    );

    // Collect cloned material refs for per-frame rainbow colour updates.
    cloned.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      // clone() gives us new geometry but SHARED materials — clone them too
      // so we can safely mutate color without affecting the GLTF cache.
      const rawMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clonedMats = rawMats.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        return c as THREE.MeshStandardMaterial;
      });
      mesh.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
      materialsRef.current.push(...clonedMats);
    });

    // Swap in the new sub-tree.
    while (modelGroupRef.current.children.length > 0) {
      modelGroupRef.current.remove(modelGroupRef.current.children[0]);
    }
    modelGroupRef.current.add(cloned);

    return () => {
      // Only dispose the PER-INSTANCE clones — never the GLTF cache originals.
      materialsRef.current.forEach((m) => m.dispose());
      materialsRef.current = [];
    };
  }, [texScene, scale]);

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

useGLTF.preload("/models/player_orb_texture.glb");
