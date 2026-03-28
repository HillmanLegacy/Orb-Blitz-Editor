import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface PlayerModelProps {
  scale: number;
  rotationSpeedX?: number;
  rotationSpeedY?: number;
}

function createMagicOrbTexture(): THREE.DataTexture {
  const size = 512;
  const data = new Uint8Array(4 * size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx);

      // Swirling energy bands
      const swirl1 = Math.sin(angle * 6 + dist * 12) * 0.5 + 0.5;
      const swirl2 = Math.sin(angle * 3 - dist * 8 + 2.1) * 0.5 + 0.5;
      const swirl3 = Math.cos(angle * 9 + dist * 5 - 1.0) * 0.5 + 0.5;

      // Radial pulse rings
      const ring1 = Math.pow(Math.sin(dist * 18) * 0.5 + 0.5, 2);
      const ring2 = Math.pow(Math.cos(dist * 11 + 1.5) * 0.5 + 0.5, 1.5);

      // Bright hot centre
      const coreGlow = Math.pow(Math.max(0, 1 - dist * 1.1), 1.5);

      // R: magenta/pink energy
      const r = Math.min(255, Math.round((swirl1 * 0.8 + ring1 * 0.4 + coreGlow) * 220));
      // G: subtle mid-tones
      const g = Math.min(255, Math.round((swirl3 * 0.3 + ring2 * 0.2 + coreGlow * 0.85) * 160));
      // B: dominant cyan / blue
      const b = Math.min(255, Math.round((swirl2 * 0.9 + swirl3 * 0.5 + ring1 * 0.3 + coreGlow) * 255));

      const brightness = Math.min(1, (swirl1 + swirl2 + ring1 + ring2) * 0.25 + coreGlow * 0.6);
      data[i + 0] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.min(255, Math.round(brightness * 255));
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
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const fbx = useLoader(FBXLoader, "/models/player.fbx");

  const orbTexture = useMemo(() => createMagicOrbTexture(), []);

  useEffect(() => {
    const cloned = fbx.clone(true);
    materialsRef.current = [];

    // Auto-normalise: compute bounding box and scale so the model fits
    // inside a sphere of radius `scale` (matching the game's orb size)
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    // target diameter = scale * 2 (so radius = scale)
    const normScale = maxDim > 0 ? (scale * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);

    // Centre the model on its bounding box midpoint
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshBasicMaterial({
          map: orbTexture,
          color: new THREE.Color(0.9, 0.5, 1.0),
        });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    if (groupRef.current) {
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      groupRef.current.add(cloned);
    }

    return () => {
      orbTexture.dispose();
      materialsRef.current.forEach((m) => m.dispose());
    };
  }, [fbx, orbTexture, scale]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * rotationSpeedX;
      groupRef.current.rotation.y += delta * rotationSpeedY;
    }

    // Pulse colour: cyan → violet → magenta → back
    const time = state.clock.getElapsedTime();
    const hue = (time * 0.1) % 1;
    const pulse = 0.75 + Math.sin(time * 3.5) * 0.25;
    materialsRef.current.forEach((mat) => {
      mat.color.setHSL(hue, 1.0, pulse * 0.6);
    });
  });

  return (
    <group ref={groupRef}>
      {/* children injected by useEffect */}
    </group>
  );
}
