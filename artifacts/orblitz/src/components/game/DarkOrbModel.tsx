import { useRef, useEffect, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface DarkOrbModelProps {
  frozen?: boolean;
  opacity?: number;
}

const TENDRIL_COUNT    = 8;
const TENDRIL_SEGMENTS = 7;
const TOTAL_TENDRIL    = TENDRIL_COUNT * TENDRIL_SEGMENTS;

interface TendrilData {
  dir:    THREE.Vector3; // outward direction
  perp1:  THREE.Vector3; // primary wave axis
  perp2:  THREE.Vector3; // secondary wave axis
  speed:  number;        // wave frequency
  phase:  number;        // phase offset
  length: number;        // reach
  waveAmp: number;       // lateral deflection amplitude
}

const _dummy = new THREE.Object3D();

export function DarkOrbModel({ frozen = false, opacity = 1 }: DarkOrbModelProps) {
  const bodyRef      = useRef<THREE.Group>(null);
  const innerRef     = useRef<THREE.Mesh>(null);
  const midRef       = useRef<THREE.Mesh>(null);
  const outerRef     = useRef<THREE.Mesh>(null);
  const tendrilRef   = useRef<THREE.InstancedMesh>(null);
  const shadowPartRef = useRef<THREE.InstancedMesh>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  const fbx = useLoader(FBXLoader, "/models/player.fbx");

  const bodyColor = frozen ? "#0a1a2a" : "#0d0022";
  const glowInner = frozen ? "#224466" : "#8800cc";
  const glowMid   = frozen ? "#1a3355" : "#5500aa";
  const glowOuter = frozen ? "#112244" : "#330077";
  const tendrilColor = frozen ? "#4488aa" : "#dd00ff";

  // Pre-compute tendril geometry (directions, wave axes, params)
  const tendrils = useMemo<TendrilData[]>(() => {
    const list: TendrilData[] = [];
    for (let i = 0; i < TENDRIL_COUNT; i++) {
      // Distribute outward directions roughly evenly across the sphere
      const phi   = Math.acos(1 - 2 * (i + 0.5) / TENDRIL_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i; // golden angle
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();

      // Two vectors perpendicular to dir — for 2D waving
      let ref = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dir.dot(ref)) > 0.9) ref.set(1, 0, 0);
      const perp1 = new THREE.Vector3().crossVectors(dir, ref).normalize();
      const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();

      list.push({
        dir,
        perp1,
        perp2,
        speed:   0.9 + (i % 3) * 0.4,
        phase:   (i / TENDRIL_COUNT) * Math.PI * 2,
        length:  1.1 + (i % 4) * 0.15,
        waveAmp: 0.18 + (i % 5) * 0.04,
      });
    }
    return list;
  }, []);

  // Clone + apply dark material to the FBX body
  useEffect(() => {
    if (!bodyRef.current) return;
    const cloned = fbx.clone(true);
    materialsRef.current = [];

    const box = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? 2 / maxDim : 1;
    cloned.scale.setScalar(normScale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(bodyColor) });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    while (bodyRef.current.children.length > 0) {
      bodyRef.current.remove(bodyRef.current.children[0]);
    }
    bodyRef.current.add(cloned);
    return () => { materialsRef.current.forEach((m) => m.dispose()); };
  }, [fbx, bodyColor]);

  useFrame((state, delta) => {
    const t     = state.clock.getElapsedTime();
    const pulse = (Math.sin(t * 2.6) + 1) * 0.5;

    // Rotate model
    if (bodyRef.current) {
      bodyRef.current.rotation.x += delta * 0.55;
      bodyRef.current.rotation.y += delta * 0.85;
    }

    // Pulse glow spheres
    if (innerRef.current)
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = (0.42 + pulse * 0.28) * opacity;
    if (midRef.current)
      (midRef.current.material as THREE.MeshBasicMaterial).opacity = (0.22 + pulse * 0.16) * opacity;
    if (outerRef.current)
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = (0.10 + pulse * 0.08) * opacity;

    // Animate tendrils — waving in 3D space
    if (tendrilRef.current) {
      for (let ti = 0; ti < TENDRIL_COUNT; ti++) {
        const td = tendrils[ti];
        for (let si = 0; si < TENDRIL_SEGMENTS; si++) {
          const param = (si + 1) / TENDRIL_SEGMENTS;           // 0..1 along tendril
          const wavePhase = t * td.speed + td.phase + si * 0.5;
          const w1 = Math.sin(wavePhase)              * td.waveAmp * param;
          const w2 = Math.cos(wavePhase * 0.65 + 1.2) * td.waveAmp * param * 0.55;

          // 3D position: outward + 2D lateral waving in orbital plane
          _dummy.position
            .copy(td.dir).multiplyScalar(param * td.length)
            .addScaledVector(td.perp1, w1)
            .addScaledVector(td.perp2, w2);

          // Taper: thick at base (~0.065), thin at tip (~0.012)
          const segSize = 0.065 * (1 - param * 0.82);
          _dummy.scale.setScalar(segSize);
          _dummy.updateMatrix();
          tendrilRef.current.setMatrixAt(ti * TENDRIL_SEGMENTS + si, _dummy.matrix);
        }
      }
      tendrilRef.current.instanceMatrix.needsUpdate = true;
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
        _dummy.position.set(x, y, z);
        _dummy.scale.setScalar(size);
        _dummy.updateMatrix();
        shadowPartRef.current.setMatrixAt(i, _dummy.matrix);
      }
      shadowPartRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const tendrilGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  const tendrilMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tendrilColor, transparent: true, opacity: 0.88, depthWrite: false }),
    [tendrilColor],
  );

  const partGeo = useMemo(() => new THREE.SphereGeometry(1, 4, 3), []);
  const partMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tendrilColor }),
    [tendrilColor],
  );

  return (
    <>
      {/* FBX dark orb body */}
      <group ref={bodyRef} />

      {/* Volumetric shadow glow — 3 concentric spheres */}
      <mesh ref={innerRef} scale={1.15}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={glowInner} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={midRef} scale={1.5}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial color={glowMid} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh ref={outerRef} scale={2.0}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={glowOuter} transparent opacity={0.08} depthWrite={false} />
      </mesh>

      {/* 3D animated shadow tendrils (8 × 7 segments, one draw call) */}
      <instancedMesh ref={tendrilRef} args={[tendrilGeo, tendrilMat, TOTAL_TENDRIL]} />

      {/* 3D swirling shadow particles */}
      <instancedMesh ref={shadowPartRef} args={[partGeo, partMat, 24]} />
    </>
  );
}
