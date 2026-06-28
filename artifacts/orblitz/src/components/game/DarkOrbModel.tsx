import { useRef, useEffect, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface DarkOrbModelProps {
  frozen?: boolean;
  opacity?: number;
}

const TENDRIL_COUNT    = 12;
const TENDRIL_SEGMENTS = 8;
const TOTAL_TENDRIL    = TENDRIL_COUNT * TENDRIL_SEGMENTS;
const GAS_RING_COUNT   = 16;
const VORTEX_COUNT     = 30;

interface TendrilData {
  dir:     THREE.Vector3;
  perp1:   THREE.Vector3;
  perp2:   THREE.Vector3;
  speed:   number;
  phase:   number;
  length:  number;
  waveAmp: number;
}

const _dummy = new THREE.Object3D();

export function DarkOrbModel({ frozen = false, opacity = 1 }: DarkOrbModelProps) {
  const bodyRef   = useRef<THREE.Group>(null);
  const glow0Ref  = useRef<THREE.Mesh>(null);
  const glow1Ref  = useRef<THREE.Mesh>(null);
  const glow2Ref  = useRef<THREE.Mesh>(null);
  const glow3Ref  = useRef<THREE.Mesh>(null);
  const glow4Ref  = useRef<THREE.Mesh>(null);
  const glow5Ref  = useRef<THREE.Mesh>(null);
  const ring0Ref  = useRef<THREE.InstancedMesh>(null);
  const ring1Ref  = useRef<THREE.InstancedMesh>(null);
  const ring2Ref  = useRef<THREE.InstancedMesh>(null);
  const tendrilRef = useRef<THREE.InstancedMesh>(null);
  const vortexRef = useRef<THREE.InstancedMesh>(null);
  const lightRef  = useRef<THREE.PointLight>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);

  const fbx = useLoader(FBXLoader, "/models/player.fbx");

  const bodyColor  = frozen ? "#0a1522" : "#060010";
  const glowColor0 = frozen ? "#336699" : "#5500cc";
  const glowColor1 = frozen ? "#2a5588" : "#4400aa";
  const glowColor2 = frozen ? "#1f4477" : "#330088";
  const glowColor3 = frozen ? "#153366" : "#220066";
  const glowColor4 = frozen ? "#0d2244" : "#150044";
  const glowColor5 = frozen ? "#081833" : "#0a0033";
  const tendrilColor = frozen ? "#55aadd" : "#aa55ff";
  const ringColor0   = frozen ? "#77bbee" : "#cc66ff";
  const ringColor1   = frozen ? "#4499cc" : "#9933ee";
  const ringColor2   = frozen ? "#88ccff" : "#ee88ff";
  const vortexColor  = frozen ? "#99ddff" : "#cc88ff";
  const lightColor   = frozen ? "#4488cc" : "#8800ff";

  const glowRefs  = [glow0Ref, glow1Ref, glow2Ref, glow3Ref, glow4Ref, glow5Ref];
  const glowCfg = [
    { base: 0.55, wave: 0.15, baseScale: 1.00 },
    { base: 0.36, wave: 0.12, baseScale: 1.35 },
    { base: 0.22, wave: 0.08, baseScale: 1.72 },
    { base: 0.14, wave: 0.05, baseScale: 2.15 },
    { base: 0.08, wave: 0.03, baseScale: 2.70 },
    { base: 0.04, wave: 0.02, baseScale: 3.30 },
  ];

  const tendrils = useMemo<TendrilData[]>(() => {
    const list: TendrilData[] = [];
    for (let i = 0; i < TENDRIL_COUNT; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / TENDRIL_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const dir   = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ).normalize();
      let ref = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dir.dot(ref)) > 0.9) ref.set(1, 0, 0);
      const perp1 = new THREE.Vector3().crossVectors(dir, ref).normalize();
      const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
      list.push({
        dir, perp1, perp2,
        speed:   0.45 + (i % 3) * 0.28,
        phase:   (i / TENDRIL_COUNT) * Math.PI * 2,
        length:  1.35 + (i % 4) * 0.22,
        waveAmp: 0.28 + (i % 5) * 0.07,
      });
    }
    return list;
  }, []);

  useEffect(() => {
    if (!bodyRef.current) return;
    const cloned = fbx.clone(true);
    materialsRef.current = [];

    const box    = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim    = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? 2 / maxDim : 1;
    cloned.scale.setScalar(normScale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat  = new THREE.MeshBasicMaterial({
          color:       new THREE.Color(bodyColor),
          transparent: true,
          opacity:     0.65,
        });
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

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (bodyRef.current) {
      bodyRef.current.rotation.x += 0.004;
      bodyRef.current.rotation.y += 0.007;
    }

    glowRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const pulse   = (Math.sin(t * 1.7 + i * 0.75) + 1) * 0.5;
      const mat     = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity   = (glowCfg[i].base + pulse * glowCfg[i].wave) * opacity;
      const breathe = 1 + Math.sin(t * 0.55 + i * 1.15) * 0.045;
      ref.current.scale.setScalar(glowCfg[i].baseScale * breathe);
    });

    if (ring0Ref.current) {
      const a0 = t * 0.32;
      for (let i = 0; i < GAS_RING_COUNT; i++) {
        const ang = (i / GAS_RING_COUNT) * Math.PI * 2 + a0;
        const r   = 1.45 + Math.sin(t * 2.1 + i * 0.55) * 0.13;
        const sz  = 0.058 + Math.sin(t * 3.2 + i * 0.8) * 0.022;
        _dummy.position.set(Math.cos(ang) * r, Math.sin(ang) * r * 0.28, Math.sin(ang) * r * 0.96);
        _dummy.scale.setScalar(sz);
        _dummy.updateMatrix();
        ring0Ref.current.setMatrixAt(i, _dummy.matrix);
      }
      ring0Ref.current.instanceMatrix.needsUpdate = true;
    }

    if (ring1Ref.current) {
      const a1 = -t * 0.24;
      for (let i = 0; i < GAS_RING_COUNT; i++) {
        const ang = (i / GAS_RING_COUNT) * Math.PI * 2 + a1;
        const r   = 1.62 + Math.sin(t * 1.55 + i * 0.7) * 0.15;
        const sz  = 0.046 + Math.sin(t * 2.6 + i) * 0.016;
        const x   = Math.cos(ang) * r;
        const y   = Math.sin(ang) * r * Math.cos(Math.PI / 3);
        const z   = Math.sin(ang) * r * Math.sin(Math.PI / 3);
        _dummy.position.set(x, y, z);
        _dummy.scale.setScalar(sz);
        _dummy.updateMatrix();
        ring1Ref.current.setMatrixAt(i, _dummy.matrix);
      }
      ring1Ref.current.instanceMatrix.needsUpdate = true;
    }

    if (ring2Ref.current) {
      const a2 = t * 0.45;
      for (let i = 0; i < GAS_RING_COUNT; i++) {
        const ang = (i / GAS_RING_COUNT) * Math.PI * 2 + a2;
        const r   = 1.55 + Math.sin(t * 2.3 + i * 0.65) * 0.11;
        const sz  = 0.052 + Math.sin(t * 4.1 + i * 1.2) * 0.019;
        _dummy.position.set(Math.sin(ang) * r, Math.cos(ang) * r, 0);
        _dummy.scale.setScalar(sz);
        _dummy.updateMatrix();
        ring2Ref.current.setMatrixAt(i, _dummy.matrix);
      }
      ring2Ref.current.instanceMatrix.needsUpdate = true;
    }

    if (tendrilRef.current) {
      for (let ti = 0; ti < TENDRIL_COUNT; ti++) {
        const td = tendrils[ti];
        for (let si = 0; si < TENDRIL_SEGMENTS; si++) {
          const param     = (si + 1) / TENDRIL_SEGMENTS;
          const wavePhase = t * td.speed + td.phase + si * 0.5;
          const w1        = Math.sin(wavePhase)               * td.waveAmp * param;
          const w2        = Math.cos(wavePhase * 0.65 + 1.2)  * td.waveAmp * param * 0.55;

          _dummy.position
            .copy(td.dir).multiplyScalar(param * td.length)
            .addScaledVector(td.perp1, w1)
            .addScaledVector(td.perp2, w2);

          const segSize = 0.092 * (1 - param * 0.78);
          _dummy.scale.setScalar(segSize);
          _dummy.updateMatrix();
          tendrilRef.current.setMatrixAt(ti * TENDRIL_SEGMENTS + si, _dummy.matrix);
        }
      }
      tendrilRef.current.instanceMatrix.needsUpdate = true;
    }

    if (vortexRef.current) {
      for (let i = 0; i < VORTEX_COUNT; i++) {
        const ang  = (i / VORTEX_COUNT) * Math.PI * 2 + t * (0.65 + (i % 3) * 0.28);
        const tilt = ((i * 37) % 180) * (Math.PI / 180);
        const r    = 0.85 + Math.sin(t * 3.1 + i * 0.95) * 0.19;
        const x    = r * Math.cos(ang) * Math.cos(tilt);
        const y    = r * Math.sin(ang);
        const z    = r * Math.cos(ang) * Math.sin(tilt);
        const sz   = 0.026 + Math.sin(t * 4.2 + i) * 0.011;
        _dummy.position.set(x, y, z);
        _dummy.scale.setScalar(sz);
        _dummy.updateMatrix();
        vortexRef.current.setMatrixAt(i, _dummy.matrix);
      }
      vortexRef.current.instanceMatrix.needsUpdate = true;
    }

    if (lightRef.current) {
      const pulse = (Math.sin(t * 2.4) + 1) * 0.5;
      lightRef.current.intensity = (1.8 + pulse * 1.6) * opacity;
    }
  });

  const sphereGeo  = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  const instGeo    = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);

  const tendrilMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tendrilColor, transparent: true, opacity: 0.70, depthWrite: false }),
    [tendrilColor],
  );
  const ring0Mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ringColor0, transparent: true, opacity: 0.68, depthWrite: false }),
    [ringColor0],
  );
  const ring1Mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ringColor1, transparent: true, opacity: 0.55, depthWrite: false }),
    [ringColor1],
  );
  const ring2Mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ringColor2, transparent: true, opacity: 0.62, depthWrite: false }),
    [ringColor2],
  );
  const vortexMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: vortexColor, transparent: true, opacity: 0.82, depthWrite: false }),
    [vortexColor],
  );

  return (
    <>
      {/* FBX model body — dark purple-black, barely visible through gas */}
      <group ref={bodyRef} />

      {/* Pulsing purple point light */}
      <pointLight ref={lightRef} color={lightColor} intensity={2.5} distance={7} decay={2} />

      {/* 6-layer volumetric gas glow — innermost to outermost */}
      <mesh ref={glow0Ref}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={glowColor0} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={glow1Ref}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial color={glowColor1} transparent opacity={0.36} depthWrite={false} />
      </mesh>
      <mesh ref={glow2Ref}>
        <sphereGeometry args={[1, 12, 9]} />
        <meshBasicMaterial color={glowColor2} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh ref={glow3Ref}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={glowColor3} transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh ref={glow4Ref}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={glowColor4} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh ref={glow5Ref}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial color={glowColor5} transparent opacity={0.04} depthWrite={false} />
      </mesh>

      {/* Gas nebula rings — 3 planes at different angles */}
      <instancedMesh ref={ring0Ref} args={[instGeo, ring0Mat, GAS_RING_COUNT]} />
      <instancedMesh ref={ring1Ref} args={[instGeo, ring1Mat, GAS_RING_COUNT]} />
      <instancedMesh ref={ring2Ref} args={[instGeo, ring2Mat, GAS_RING_COUNT]} />

      {/* Wide gas tendrils */}
      <instancedMesh ref={tendrilRef} args={[instGeo, tendrilMat, TOTAL_TENDRIL]} />

      {/* Dense vortex particles close to core */}
      <instancedMesh ref={vortexRef} args={[instGeo, vortexMat, VORTEX_COUNT]} />
    </>
  );
}
