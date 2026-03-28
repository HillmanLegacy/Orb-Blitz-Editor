import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface PlayerModelProps {
  scale: number;
  rotationSpeedX?: number;
  rotationSpeedY?: number;
}

export function PlayerModel({
  scale,
  rotationSpeedX = 0.8,
  rotationSpeedY = 1.2,
}: PlayerModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const fbx = useLoader(FBXLoader, "/models/player.fbx");

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * rotationSpeedX;
      groupRef.current.rotation.y += delta * rotationSpeedY;
    }
  });

  return (
    <group ref={groupRef} scale={scale * 0.012}>
      <primitive object={fbx} />
    </group>
  );
}
