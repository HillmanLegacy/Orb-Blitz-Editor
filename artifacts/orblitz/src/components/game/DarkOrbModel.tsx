import { useRef, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface DarkOrbModelProps {
  frozen?: boolean;
  opacity?: number;
}

const _shadowDummy = new THREE.Object3D();

export function DarkOrbModel({ frozen = false, opacity = 1 }: DarkOrbModelProps) {
  const bodyRef    = useRef<THREE.Group>(null);
  const innerRef   = useRef<THREE.Mesh>(null);
  const midRef     = useRef<THREE.Mesh>(null);
  const outerRef   = useRef<THREE.Mesh>(null);
  const ring1Ref   = useRef<THREE.Mesh>(null);
  const ring2Ref   = useRef<THREE.Mesh>(null);
  const ring3Ref   = useRef<THREE.Mesh>(null);
  const shadowPartRef = useRef<THREE.InstancedMesh>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  const fbx = useLoader(FBXLoader, "/models/player.fbx");

  const bodyColor  = frozen ? "#0a1a2a" : "#080010";
  const glowInner  = frozen ? "#224466" : "#3a0050";
  const glowMid    = frozen ? "#1a3355" : "#280038";
  const glowOuter  = frozen ? "#112244" : "#180025";
  const ringColor  = frozen ? "#3a6688" : "#660077";

  // Mount / update the cloned FBX body
  useEffect(() => {
    if (!bodyRef.current) return;

    const cloned = fbx.clone(true);
    materialsRef.current = [];

    const box = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    // Fit model to radius=1 in group-local space (parent group handles orb.size scaling)
    const normScale = maxDim > 0 ? 2 / maxDim : 1;
    cloned.scale.setScalar(normScale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(bodyColor),
        });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    while (bodyRef.current.children.length > 0) {
      bodyRef.current.remove(bodyRef.current.children[0]);
    }
    bodyRef.current.add(cloned);

    return () => {
      materialsRef.current.forEach((m) => m.dispose());
    };
  }, [fbx, bodyColor]);

  // Initialize shadow particle positions (24 particles in 3D orbits)
  useEffect(() => {
    if (!shadowPartRef.current) return;
    const mesh = shadowPartRef.current;
    const color = new THREE.Color(ringColor);
    for (let i = 0; i < 24; i++) {
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [ringColor]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const pulse = (Math.sin(t * 2.6) + 1) * 0.5;

    // Rotate model — slightly slower than player for menacing feel
    if (bodyRef.current) {
      bodyRef.current.rotation.x += delta * 0.55;
      bodyRef.current.rotation.y += delta * 0.85;
    }

    // Pulsate glow spheres
    if (innerRef.current) {
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = (0.28 + pulse * 0.20) * opacity;
    }
    if (midRef.current) {
      (midRef.current.material as THREE.MeshBasicMaterial).opacity = (0.14 + pulse * 0.10) * opacity;
    }
    if (outerRef.current) {
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = (0.06 + pulse * 0.05) * opacity;
    }

    // Rotate shadow rings independently
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 1.8;
      ring1Ref.current.rotation.x += delta * 0.4;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 1.3;
      ring2Ref.current.rotation.y += delta * 0.6;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.x -= delta * 0.9;
      ring3Ref.current.rotation.z += delta * 0.7;
    }

    // Animate 3D shadow particles
    if (shadowPartRef.current) {
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + t * (0.4 + (i % 3) * 0.15);
        const tiltX = ((i * 37) % 180) * (Math.PI / 180);
        const tiltZ = ((i * 61) % 360) * (Math.PI / 180);
        const r = 1.4 + Math.sin(t * 2 + i * 0.8) * 0.2;
        const x = r * Math.cos(angle) * Math.cos(tiltX);
        const y = r * Math.sin(angle);
        const z = r * Math.cos(angle) * Math.sin(tiltX) + Math.sin(tiltZ) * 0.3;
        const size = 0.03 + Math.sin(t * 3 + i) * 0.015;
        _shadowDummy.position.set(x, y, z);
        _shadowDummy.scale.setScalar(size);
        _shadowDummy.updateMatrix();
        shadowPartRef.current.setMatrixAt(i, _shadowDummy.matrix);
      }
      shadowPartRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* FBX dark orb body — rotates independently */}
      <group ref={bodyRef} />

      {/* 3D shadow glow — inner tight halo */}
      <mesh ref={innerRef} scale={1.15}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={glowInner} transparent opacity={0.35} depthWrite={false} />
      </mesh>

      {/* 3D shadow glow — mid corona */}
      <mesh ref={midRef} scale={1.5}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial color={glowMid} transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* 3D shadow glow — far bloom */}
      <mesh ref={outerRef} scale={2.0}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={glowOuter} transparent opacity={0.08} depthWrite={false} />
      </mesh>

      {/* Rotating 3D shadow rings */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.25, 0.045, 8, 40]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.45} depthWrite={false} />
      </mesh>

      <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 5, 0]}>
        <torusGeometry args={[1.45, 0.03, 6, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.30} depthWrite={false} />
      </mesh>

      <mesh ref={ring3Ref} rotation={[Math.PI / 6, -Math.PI / 4, Math.PI / 3]}>
        <torusGeometry args={[1.6, 0.022, 6, 28]} />
        <meshBasicMaterial color={glowInner} transparent opacity={0.20} depthWrite={false} />
      </mesh>

      {/* 3D swirling shadow particles */}
      <instancedMesh
        ref={shadowPartRef}
        args={[
          new THREE.SphereGeometry(1, 4, 3),
          new THREE.MeshBasicMaterial({ color: ringColor }),
          24,
        ]}
      />
    </>
  );
}
