import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface PlayerModelProps {
  scale: number;
  coreColor?: string;
  glowColor?: string;
  isRainbow?: boolean;
  rotationSpeedX?: number;
  rotationSpeedY?: number;
}

/** Grayscale swirl/ring pattern — tinted at render time by material.color */
function createOrbPattern(): THREE.DataTexture {
  const size = 512;
  const data = new Uint8Array(4 * size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx);

      const swirl1 = Math.sin(angle * 5 + dist * 14) * 0.5 + 0.5;
      const swirl2 = Math.sin(angle * 3 - dist * 9 + 1.8) * 0.5 + 0.5;
      const ring1  = Math.pow(Math.sin(dist * 16) * 0.5 + 0.5, 2);
      const ring2  = Math.pow(Math.cos(dist * 10 + 1.2) * 0.5 + 0.5, 1.5);
      const core   = Math.pow(Math.max(0, 1 - dist * 1.05), 1.2);

      const lum = Math.min(1, swirl1 * 0.25 + swirl2 * 0.2 + ring1 * 0.2 + ring2 * 0.15 + core * 0.85);
      const v   = Math.round(lum * 255);

      data[i + 0] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function PlayerModel({
  scale,
  rotationSpeedX = 0.8,
  rotationSpeedY = 1.2,
}: PlayerModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const materialsRef  = useRef<THREE.MeshBasicMaterial[]>([]);

  const fbx        = useLoader(FBXLoader, "/models/player.fbx");
  const orbPattern = useMemo(() => createOrbPattern(), []);

  useEffect(() => {
    if (!modelGroupRef.current) return;
    const cloned = fbx.clone(true);
    materialsRef.current = [];

    // Normalise size: fit model inside radius = scale
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
          map: orbPattern,
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
      orbPattern.dispose();
      materialsRef.current.forEach((m) => m.dispose());
    };
  }, [fbx, orbPattern, scale]);

  useFrame((_state, delta) => {
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.x += delta * rotationSpeedX;
      modelGroupRef.current.rotation.y += delta * rotationSpeedY;
    }
  });

  return <group ref={modelGroupRef} />;
}
