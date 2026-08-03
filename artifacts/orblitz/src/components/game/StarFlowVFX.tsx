/**
 * StarFlowVFX
 * Spawns 3-D mini star models at kill positions.
 * Each star floats slowly toward the player orb.
 * On arrival it calls addCoins(coinsPerStar) — counter ticks up one star at a time.
 * A pool of point lights samples across live particles to cast warm gold light on the scene.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_PARTICLES  = 700;
const HOME_SPEED     = 3.5;          // slow, satisfying float toward player
const ABSORB_DIST_SQ = 0.4 * 0.4;
const LIGHT_POOL     = 16;           // point lights shared across all particles
const LIGHT_RANGE    = 2.8;
const LIGHT_INTENSITY = 2.2;

// ─── Scratch ──────────────────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _off   = new THREE.Vector3(0, 0, -999);

// ─── Particle ─────────────────────────────────────────────────────────────────
interface StarParticle {
  px: number; py: number; pz: number;
  ry: number; vrY: number;
  age: number;
  size: number;
  coinsPerStar: number;
}

export function StarFlowVFX() {
  const { scene } = useGLTF("/models/star_pickup.glb");

  const [starGeo, normalScale] = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    scene.traverse((child) => {
      if (!geo && (child as THREE.Mesh).isMesh) geo = (child as THREE.Mesh).geometry;
    });
    if (!geo) return [new THREE.SphereGeometry(0.5, 6, 4), 1] as const;
    (geo as THREE.BufferGeometry).computeBoundingBox();
    const s = new THREE.Vector3();
    (geo as THREE.BufferGeometry).boundingBox!.getSize(s);
    const m = Math.max(s.x, s.y, s.z);
    return [geo as THREE.BufferGeometry, m > 0 ? 1 / m : 1] as const;
  }, [scene]);

  const starMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffd700",
    emissive: "#ff9900",
    emissiveIntensity: 1.6,
    metalness: 0.65,
    roughness: 0.18,
  }), []);
  useEffect(() => () => { starMat.dispose(); }, [starMat]);

  const particles  = useRef<StarParticle[]>([]);
  const seenEvents = useRef<Set<string>>(new Set());
  const meshRef    = useRef<THREE.InstancedMesh>(null);

  // Pool of point-light refs — repositioned each frame to sampled particle positions
  const lightRefs = useRef<(THREE.PointLight | null)[]>(
    Array.from({ length: LIGHT_POOL }, () => null)
  );

  useFrame((_, delta) => {
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = useMagicOrb.getState();
    const [ppx, ppy, ppz] = playerPosition;

    // ── Spawn ────────────────────────────────────────────────────────────────
    for (const evt of starFlowEvents) {
      if (seenEvents.current.has(evt.id)) continue;
      seenEvents.current.add(evt.id);
      const [fx, fy, fz] = evt.fromPos;
      const coinsPerStar  = evt.coinsPerStar ?? 1;
      const spread = evt.count > 10 ? 3.5 : 1.2;
      for (let i = 0; i < evt.count; i++) {
        if (particles.current.length >= MAX_PARTICLES) break;
        particles.current.push({
          px: fx + (Math.random() - 0.5) * spread,
          py: fy + (Math.random() - 0.5) * spread,
          pz: fz,
          ry:  Math.random() * Math.PI * 2,
          vrY: (Math.random() < 0.5 ? 1 : -1) * (2 + Math.random() * 3),
          age: 0,
          size: 0.16 + Math.random() * 0.10,
          coinsPerStar,
        });
      }
      removeStarFlowEvent(evt.id);
    }

    // ── Update ───────────────────────────────────────────────────────────────
    const mesh = meshRef.current;
    let live = 0;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.age += delta;

      const dx = ppx - p.px;
      const dy = ppy - p.py;
      if (dx * dx + dy * dy < ABSORB_DIST_SQ) {
        useShop.getState().addCoins(p.coinsPerStar);
        continue;
      }

      const dist = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const step = Math.min(HOME_SPEED * delta, dist);
      p.px += (dx / dist) * step;
      p.py += (dy / dist) * step;
      p.pz  = ppz;
      p.ry += p.vrY * delta;

      if (live !== i) particles.current[live] = p;
      live++;
    }
    particles.current.length = live;

    // ── Reposition point lights across live particles ─────────────────────
    const lights = lightRefs.current;
    if (live === 0) {
      // Park all lights off-screen
      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l];
        if (lt) lt.position.copy(_off);
      }
    } else {
      // Evenly sample LIGHT_POOL positions from the live particle array
      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l];
        if (!lt) continue;
        const idx = Math.floor((l / LIGHT_POOL) * live);
        const p   = particles.current[idx];
        lt.position.set(p.px, p.py, p.pz);
        // Fade intensity in with age so newly-spawned lights don't pop
        lt.intensity = LIGHT_INTENSITY * Math.min(1, p.age / 0.2);
      }
    }

    // ── Render instances ──────────────────────────────────────────────────
    if (!mesh) return;

    for (let i = 0; i < live; i++) {
      const p = particles.current[i];
      const fadeIn  = Math.min(1, p.age / 0.12);
      const worldSz = p.size * normalScale * fadeIn;

      _dummy.position.set(p.px, p.py, p.pz);
      _dummy.rotation.set(0.3, p.ry, 0.2);
      _dummy.scale.setScalar(Math.max(1e-4, worldSz));
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    _dummy.position.copy(_off);
    _dummy.scale.setScalar(1e-4);
    _dummy.updateMatrix();
    for (let i = live; i < MAX_PARTICLES; i++) mesh.setMatrixAt(i, _dummy.matrix);

    mesh.count = MAX_PARTICLES;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[starGeo, starMat, MAX_PARTICLES]}
        renderOrder={10}
        frustumCulled={false}
      />
      {/* Point-light pool — each light tracks a sampled particle position */}
      {Array.from({ length: LIGHT_POOL }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => { lightRefs.current[i] = el; }}
          color="#ffcc44"
          intensity={0}
          distance={LIGHT_RANGE}
          decay={2}
          position={[0, 0, -999]}
        />
      ))}
    </>
  );
}

useGLTF.preload("/models/star_pickup.glb");
