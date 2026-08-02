/**
 * StarFlowVFX
 * Spawns 3-D mini star models (star_pickup.glb) at kill positions.
 * Each star flies outward briefly, then homes toward the player.
 * On arrival, it calls addCoins(coinsPerStar) so the counter ticks up one
 * star at a time instead of all at once on the kill.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_PARTICLES   = 400;
const BURST_DUR       = 0.22;
const BASE_LIFE       = 1.35;
const LIFE_VARIANCE   = 0.30;
const BURST_SPEED_MIN = 3.0;
const BURST_SPEED_MAX = 6.8;
const HOME_ACCEL_BASE = 16;
const HOME_ACCEL_RAMP = 28;
const MAX_HOME_SPEED  = 30;
const ABSORB_DIST_SQ  = 0.28 * 0.28; // absorb when this close to player

// ─── Scratch objects ──────────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();

// ─── Particle state ───────────────────────────────────────────────────────────
interface StarParticle {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  ry: number; vrY: number;            // spin around Y axis
  life: number; maxLife: number;
  size: number;                        // world-space target size
  coinsPerStar: number;
}

export function StarFlowVFX() {
  // Load star model — suspended until ready (component is inside <Suspense>)
  const { scene } = useGLTF("/models/star_pickup.glb");

  // ── Extract geometry from the first mesh in the GLB ─────────────────────
  const [starGeo, normalScale] = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    scene.traverse((child) => {
      if (!geo && (child as THREE.Mesh).isMesh) {
        geo = (child as THREE.Mesh).geometry;
      }
    });
    if (!geo) return [new THREE.SphereGeometry(0.5, 6, 4), 1] as const;

    (geo as THREE.BufferGeometry).computeBoundingBox();
    const box = (geo as THREE.BufferGeometry).boundingBox!;
    const s = new THREE.Vector3();
    box.getSize(s);
    const maxDim = Math.max(s.x, s.y, s.z);
    // normalScale maps geo to a 1-unit bounding box
    return [geo as THREE.BufferGeometry, maxDim > 0 ? 1 / maxDim : 1] as const;
  }, [scene]);

  // ── Lush gold material shared across all instances ────────────────────────
  const starMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffd700",
    emissive: "#ff9900",
    emissiveIntensity: 1.4,   // high emissive → Bloom makes it glow like a hot star
    metalness: 0.65,
    roughness: 0.18,
  }), []);

  useEffect(() => () => { starMat.dispose(); }, [starMat]);

  // ─── Particle pool ────────────────────────────────────────────────────────
  const particles  = useRef<StarParticle[]>([]);
  const seenEvents = useRef<Set<string>>(new Set());

  useFrame((_, delta) => {
    const store = useMagicOrb.getState();
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = store;
    const [ppx, ppy] = playerPosition;

    // ── Spawn new particles from pending events ────────────────────────────
    for (const evt of starFlowEvents) {
      if (seenEvents.current.has(evt.id)) continue;
      seenEvents.current.add(evt.id);

      const [fx, fy, fz] = evt.fromPos;
      const coinsPerStar = evt.coinsPerStar ?? 1;

      for (let i = 0; i < evt.count; i++) {
        if (particles.current.length >= MAX_PARTICLES) break;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const spd   = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN);
        const life  = BASE_LIFE + (Math.random() - 0.5) * LIFE_VARIANCE;

        particles.current.push({
          px: fx + (Math.random() - 0.5) * 0.1,
          py: fy + (Math.random() - 0.5) * 0.1,
          pz: fz,
          vx: Math.sin(phi) * Math.cos(theta) * spd,
          vy: Math.sin(phi) * Math.sin(theta) * spd,
          vz: 0,
          ry:  Math.random() * Math.PI * 2,
          vrY: (Math.random() < 0.5 ? 1 : -1) * (4 + Math.random() * 6), // rad/s
          life,
          maxLife: life,
          size: 0.18 + Math.random() * 0.10,   // world-unit target radius
          coinsPerStar,
        });
      }

      removeStarFlowEvent(evt.id);
    }

    // ── Update + render ────────────────────────────────────────────────────
    const mesh = meshRef.current;
    let liveCount = 0;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.life -= delta;
      if (p.life <= 0) continue;

      // ── Absorption check: reached the player ──────────────────────────
      const dxP = ppx - p.px;
      const dyP = ppy - p.py;
      if (dxP * dxP + dyP * dyP < ABSORB_DIST_SQ) {
        useShop.getState().addCoins(p.coinsPerStar);
        continue; // absorbed — remove particle
      }

      // ── Physics ────────────────────────────────────────────────────────
      const elapsed   = p.maxLife - p.life;
      const lifeRatio = p.life / p.maxLife;

      if (elapsed > BURST_DUR) {
        const dx   = ppx - p.px;
        const dy   = ppy - p.py;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const acc  = (HOME_ACCEL_BASE + HOME_ACCEL_RAMP * (1 - lifeRatio)) * delta;
        p.vx += (dx / dist) * acc;
        p.vy += (dy / dist) * acc;
        const spd2 = p.vx * p.vx + p.vy * p.vy;
        if (spd2 > MAX_HOME_SPEED * MAX_HOME_SPEED) {
          const inv = MAX_HOME_SPEED / Math.sqrt(spd2);
          p.vx *= inv; p.vy *= inv;
        }
      }

      p.px += p.vx * delta;
      p.py += p.vy * delta;
      p.ry += p.vrY * delta;

      // ── Pack ──────────────────────────────────────────────────────────
      if (liveCount !== i) particles.current[liveCount] = p;
      liveCount++;
    }
    particles.current.length = liveCount;

    // ── Build instance matrices ───────────────────────────────────────────
    if (!mesh) return;

    const renderCount = Math.min(liveCount, MAX_PARTICLES);

    for (let i = 0; i < renderCount; i++) {
      const p = particles.current[i];
      const lifeRatio = p.life / p.maxLife;

      // Fade in over first 8%, fade out over last 20%
      const fadeIn  = Math.min(1, (p.maxLife - p.life) / (p.maxLife * 0.08));
      const fadeOut = lifeRatio < 0.20 ? lifeRatio / 0.20 : 1;
      const alpha   = fadeIn * fadeOut;

      // World-space scale: target size × normalScale × geometry normalizer
      const worldSz = p.size * normalScale * alpha;

      _dummy.position.set(p.px, p.py, p.pz);
      _dummy.rotation.set(0.3, p.ry, 0.2); // slight tilt so the star reads as 3-D
      _dummy.scale.setScalar(Math.max(1e-4, worldSz));
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    // Zero out unused slots
    _dummy.position.set(0, 0, -999);
    _dummy.scale.setScalar(1e-4);
    _dummy.updateMatrix();
    for (let i = renderCount; i < MAX_PARTICLES; i++) {
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    mesh.count = MAX_PARTICLES;
    mesh.instanceMatrix.needsUpdate = true;
  });

  const meshRef = useRef<THREE.InstancedMesh>(null);

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
