/**
 * StarFlowVFX
 * Spawns 3-D mini star models at kill positions.
 * Each star immediately homes toward the player orb.
 * On arrival it calls addCoins(coinsPerStar) — counter ticks up one star at a time.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_PARTICLES  = 700;          // must exceed largest single burst (boss = 500)
const HOME_SPEED     = 14;           // world-units / s — constant homing speed
const ABSORB_DIST_SQ = 0.4 * 0.4;   // absorb when within 0.4 wu of player

// ─── Scratch ──────────────────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();

// ─── Particle ─────────────────────────────────────────────────────────────────
interface StarParticle {
  px: number; py: number; pz: number;
  ry: number; vrY: number;   // Y-axis spin
  age: number;               // seconds alive — drives fade-in
  size: number;              // world-space radius
  coinsPerStar: number;
}

export function StarFlowVFX() {
  const { scene } = useGLTF("/models/star_pickup.glb");

  // Extract first mesh geometry and compute a normalisation scale
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
    emissiveIntensity: 1.4,
    metalness: 0.65,
    roughness: 0.18,
  }), []);
  useEffect(() => () => { starMat.dispose(); }, [starMat]);

  const particles  = useRef<StarParticle[]>([]);
  const seenEvents = useRef<Set<string>>(new Set());
  const meshRef    = useRef<THREE.InstancedMesh>(null);

  useFrame((_, delta) => {
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = useMagicOrb.getState();
    const [ppx, ppy, ppz] = playerPosition;

    // ── Spawn ────────────────────────────────────────────────────────────────
    for (const evt of starFlowEvents) {
      if (seenEvents.current.has(evt.id)) continue;
      seenEvents.current.add(evt.id);
      const [fx, fy, fz] = evt.fromPos;
      const coinsPerStar  = evt.coinsPerStar ?? 1;
      // Larger counts (boss) get a wider spawn scatter so particles are visually distinct
      const spread = evt.count > 10 ? 3.5 : 1.2;
      for (let i = 0; i < evt.count; i++) {
        if (particles.current.length >= MAX_PARTICLES) break;
        particles.current.push({
          px: fx + (Math.random() - 0.5) * spread,
          py: fy + (Math.random() - 0.5) * spread,
          pz: fz,
          ry:  Math.random() * Math.PI * 2,
          vrY: (Math.random() < 0.5 ? 1 : -1) * (5 + Math.random() * 7),
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

      // Absorbed?
      const dx = ppx - p.px;
      const dy = ppy - p.py;
      if (dx * dx + dy * dy < ABSORB_DIST_SQ) {
        useShop.getState().addCoins(p.coinsPerStar);
        continue;
      }

      // Home straight toward player at constant speed
      const dist = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      const step = Math.min(HOME_SPEED * delta, dist);
      p.px += (dx / dist) * step;
      p.py += (dy / dist) * step;
      p.pz  = ppz; // match player Z plane
      p.ry += p.vrY * delta;

      if (live !== i) particles.current[live] = p;
      live++;
    }
    particles.current.length = live;

    // ── Render ───────────────────────────────────────────────────────────────
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

    // Hide unused slots
    _dummy.position.set(0, 0, -999);
    _dummy.scale.setScalar(1e-4);
    _dummy.updateMatrix();
    for (let i = live; i < MAX_PARTICLES; i++) mesh.setMatrixAt(i, _dummy.matrix);

    mesh.count = MAX_PARTICLES;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[starGeo, starMat, MAX_PARTICLES]}
      renderOrder={10}
      frustumCulled={false}
    />
  );
}

useGLTF.preload("/models/star_pickup.glb");
