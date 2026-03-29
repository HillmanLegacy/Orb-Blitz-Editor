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
  coreColor = "#ffffff",
  glowColor = "#ffffff",
  isRainbow = false,
  rotationSpeedX = 0.8,
  rotationSpeedY = 1.2,
}: PlayerModelProps) {
  const modelGroupRef  = useRef<THREE.Group>(null);
  const outerGlow1Ref  = useRef<THREE.Mesh>(null);
  const outerGlow2Ref  = useRef<THREE.Mesh>(null);
  const innerGlowRef   = useRef<THREE.Mesh>(null);
  const pulseRingRef   = useRef<THREE.Mesh>(null);
  const materialsRef   = useRef<THREE.MeshBasicMaterial[]>([]);

  const fbx        = useLoader(FBXLoader, "/models/player.fbx");
  const orbPattern = useMemo(() => createOrbPattern(), []);

  // Parse skin colors once so useFrame isn't doing string→Color every frame
  const coreColorObj = useMemo(() => new THREE.Color(coreColor), [coreColor]);
  const glowColorObj = useMemo(() => new THREE.Color(glowColor), [glowColor]);

  useEffect(() => {
    if (!modelGroupRef.current) return;
    const cloned = fbx.clone(true);
    materialsRef.current = [];

    // Normalise size: fit model inside radius = scale
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
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
          color: coreColorObj.clone(),
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
  }, [fbx, orbPattern, scale, coreColorObj]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Rotate the model on both axes
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.x += delta * rotationSpeedX;
      modelGroupRef.current.rotation.y += delta * rotationSpeedY;
    }

    // Skin colour tint (rainbow cycles hue, others stay on skin hue)
    const pulseLight = 0.5 + Math.sin(time * 3.0) * 0.18;
    materialsRef.current.forEach((mat) => {
      if (isRainbow) {
        mat.color.setHSL((time * 0.18) % 1, 1.0, pulseLight);
      } else {
        const hsl = { h: 0, s: 0, l: 0 };
        coreColorObj.getHSL(hsl);
        mat.color.setHSL(hsl.h, Math.max(hsl.s, 0.5), pulseLight);
      }
    });

    const glowHSL = { h: 0, s: 0, l: 0 };
    glowColorObj.getHSL(glowHSL);
    const activeGlowColor = isRainbow
      ? new THREE.Color().setHSL((time * 0.18 + 0.2) % 1, 1.0, 0.6)
      : glowColorObj;

    // Outer soft glow — slow breathe
    if (outerGlow1Ref.current) {
      const s = scale * (2.6 + Math.sin(time * 1.4) * 0.15);
      outerGlow1Ref.current.scale.setScalar(s);
      const mat = outerGlow1Ref.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(activeGlowColor);
      mat.opacity = 0.10 + Math.sin(time * 1.4) * 0.03;
    }

    // Second glow layer — slightly faster
    if (outerGlow2Ref.current) {
      const s = scale * (2.0 + Math.sin(time * 2.2 + 1.0) * 0.12);
      outerGlow2Ref.current.scale.setScalar(s);
      const mat = outerGlow2Ref.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(activeGlowColor);
      mat.opacity = 0.18 + Math.sin(time * 2.2 + 1.0) * 0.06;
    }

    // Inner bright halo
    if (innerGlowRef.current) {
      const s = scale * (1.3 + Math.sin(time * 4.0 + 0.5) * 0.08);
      innerGlowRef.current.scale.setScalar(s);
      const mat = innerGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(activeGlowColor);
      mat.opacity = 0.30 + Math.sin(time * 4.0 + 0.5) * 0.12;
    }

    // Pulsing ring — expands outward and fades
    if (pulseRingRef.current) {
      const cycle = ((time * 0.9) % 1);
      const ringScale = scale * (1.1 + cycle * 1.8);
      pulseRingRef.current.scale.setScalar(ringScale);
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(activeGlowColor);
      mat.opacity = (1 - cycle) * 0.22;
    }
  });

  return (
    <group>
      {/* Outermost soft glow blob */}
      <mesh ref={outerGlow1Ref}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.10}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Second glow layer */}
      <mesh ref={outerGlow2Ref}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner bright halo — tight around model */}
      <mesh ref={innerGlowRef}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.30}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding pulse ring */}
      <mesh ref={pulseRingRef}>
        <ringGeometry args={[0.88, 1, 48]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3-D model — rotates independently */}
      <group ref={modelGroupRef} />
    </group>
  );
}
