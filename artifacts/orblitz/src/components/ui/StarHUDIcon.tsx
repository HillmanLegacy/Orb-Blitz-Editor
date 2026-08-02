/**
 * StarHUDIcon
 * A small self-contained R3F Canvas that renders the star_pickup.glb model
 * spinning inside the HUD star counter panel.
 */
import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

function SpinningStarContent() {
  const { scene } = useGLTF("/models/star_pickup.glb");
  const groupRef = useRef<THREE.Group>(null);

  // Clone + normalize so the star fills the tiny viewport regardless of GLB scale
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const s = maxDim > 0 ? 1.7 / maxDim : 1;
    c.scale.setScalar(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    c.position.set(-center.x * s, -center.y * s, -center.z * s);
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
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <Canvas
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        {/* Warm gold key light */}
        <ambientLight intensity={1.0} color="#ffe4a0" />
        <pointLight position={[2, 3, 3]} color="#ffd700" intensity={5} />
        <pointLight position={[-2, -1, 2]} color="#ff9900" intensity={2} />
        <Suspense fallback={null}>
          <SpinningStarContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
