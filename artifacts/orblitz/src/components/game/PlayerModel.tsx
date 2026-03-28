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

      // Swirling energy bands
      const angle = Math.atan2(ny, nx);
      const swirl1 = Math.sin(angle * 6 + dist * 12) * 0.5 + 0.5;
      const swirl2 = Math.sin(angle * 3 - dist * 8 + 2.1) * 0.5 + 0.5;
      const swirl3 = Math.cos(angle * 9 + dist * 5 - 1.0) * 0.5 + 0.5;

      // Radial pulse rings
      const ring1 = Math.pow(Math.sin(dist * 18) * 0.5 + 0.5, 2);
      const ring2 = Math.pow(Math.cos(dist * 11 + 1.5) * 0.5 + 0.5, 1.5);

      // Core brightness - bright center fading outward
      const coreBrightness = Math.max(0, 1 - dist * 1.1);
      const coreGlow = Math.pow(coreBrightness, 1.5);

      // Combine layers
      const energy = swirl1 * 0.3 + swirl2 * 0.2 + swirl3 * 0.15 + ring1 * 0.2 + ring2 * 0.15;
      const brightness = Math.min(1, energy + coreGlow * 0.8);

      // Magic orb colour palette: deep violet core → electric cyan/magenta swirls → white hot center
      // R channel: magenta/pink energy
      const r = Math.min(255, Math.round(
        (swirl1 * 0.8 + ring1 * 0.4 + coreGlow * 1.0) * 220
      ));
      // G channel: subtle mid-tones for depth
      const g = Math.min(255, Math.round(
        (swirl3 * 0.3 + ring2 * 0.2 + coreGlow * 0.85) * 160
      ));
      // B channel: cyan/blue dominant
      const b = Math.min(255, Math.round(
        (swirl2 * 0.9 + swirl3 * 0.5 + ring1 * 0.3 + coreGlow * 1.0) * 255
      ));
      // Alpha: fully opaque but taper at edges
      const a = Math.min(255, Math.round(brightness * 255));

      data[i + 0] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createEmissiveTexture(): THREE.DataTexture {
  const size = 512;
  const data = new Uint8Array(4 * size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx);

      // Pulsing vein-like emissive pattern
      const vein1 = Math.pow(Math.max(0, Math.sin(angle * 8 + dist * 14) * 0.5 + 0.5), 3);
      const vein2 = Math.pow(Math.max(0, Math.cos(angle * 5 - dist * 9 + 1.0) * 0.5 + 0.5), 3);
      const coreEmit = Math.pow(Math.max(0, 1 - dist * 1.2), 2);

      const emit = Math.min(1, vein1 * 0.6 + vein2 * 0.4 + coreEmit * 0.9);

      data[i + 0] = Math.round(emit * 180);  // R — warm magenta
      data[i + 1] = Math.round(emit * 80);   // G
      data[i + 2] = Math.round(emit * 255);  // B — strong cyan/blue
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function PlayerModel({
  scale,
  rotationSpeedX = 0.8,
  rotationSpeedY = 1.2,
}: PlayerModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const fbx = useLoader(FBXLoader, "/models/player.fbx");

  const { orbTexture, emissiveTexture } = useMemo(() => ({
    orbTexture: createMagicOrbTexture(),
    emissiveTexture: createEmissiveTexture(),
  }), []);

  useEffect(() => {
    const cloned = fbx.clone(true);
    materialsRef.current = [];

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshStandardMaterial({
          map: orbTexture,
          emissiveMap: emissiveTexture,
          emissive: new THREE.Color(0.6, 0.2, 1.0),
          emissiveIntensity: 1.2,
          metalness: 0.3,
          roughness: 0.25,
          transparent: false,
        });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    // Replace the group children with the re-materialised clone
    if (groupRef.current) {
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      groupRef.current.add(cloned);
    }

    return () => {
      orbTexture.dispose();
      emissiveTexture.dispose();
      materialsRef.current.forEach((m) => m.dispose());
    };
  }, [fbx, orbTexture, emissiveTexture]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * rotationSpeedX;
      groupRef.current.rotation.y += delta * rotationSpeedY;
    }

    // Animate emissive intensity to pulse like a living orb
    const time = state.clock.getElapsedTime();
    const pulse = 1.0 + Math.sin(time * 3.5) * 0.4;
    materialsRef.current.forEach((mat) => {
      mat.emissiveIntensity = pulse;
      // Slowly shift the emissive hue through cyan → magenta → violet
      const hue = (time * 0.08) % 1;
      mat.emissive.setHSL(hue, 1.0, 0.55);
    });
  });

  return (
    <group ref={groupRef} scale={scale * 0.012}>
      {/* children are injected by the useEffect above */}
    </group>
  );
}
