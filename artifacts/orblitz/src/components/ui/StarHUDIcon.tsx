/**
 * StarHUDIcon
 * Spinning star_pickup.glb rendered in a tiny Canvas.
 * Uses the same gold emissive material as StarFlowVFX, plus a CSS
 * drop-shadow filter to replicate the in-scene bloom glow.
 */
import { Suspense, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const GOLD_MAT = new THREE.MeshStandardMaterial({
  color:            "#ffd700",
  emissive:         "#ff9900",
  emissiveIntensity: 2.2,
  metalness:        0.65,
  roughness:        0.18,
});

function SpinningStarContent() {
  const { scene } = useGLTF("/models/star_pickup.glb");
  const groupRef  = useRef<THREE.Group>(null);

  // Clone, normalize size, and swap every mesh to the gold emissive material
  const cloned = useMemo(() => {
    const c   = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const sv  = new THREE.Vector3();
    box.getSize(sv);
    const maxDim = Math.max(sv.x, sv.y, sv.z);
    const s = maxDim > 0 ? 1.7 / maxDim : 1;
    c.scale.setScalar(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    c.position.set(-center.x * s, -center.y * s, -center.z * s);

    // Override all mesh materials → gold emissive
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = GOLD_MAT;
      }
    });

    return c;
  }, [scene]);

  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 1.6;
      groupRef.current.rotation.x = Math.sin(Date.now() * 0.0007) * 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

export function StarHUDIcon({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      width:    size,
      height:   size,
      flexShrink: 0,
      filter:   "drop-shadow(0 0 6px #ffd700cc) drop-shadow(0 0 12px #ff990088)",
    }}>
      <Canvas
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        {/* Warm ambient fill */}
        <ambientLight intensity={0.6} color="#ffe4a0" />
        {/* Front key — strong warm gold */}
        <pointLight position={[0, 0, 3]}  color="#ffd700" intensity={8} />
        {/* Rim lights for depth */}
        <pointLight position={[3, 2, 1]}  color="#ffcc44" intensity={4} />
        <pointLight position={[-2, -2, 2]} color="#ff9900" intensity={3} />
        <Suspense fallback={null}>
          <SpinningStarContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
