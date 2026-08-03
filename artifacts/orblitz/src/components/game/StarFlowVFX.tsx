/**
 * StarFlowVFX
 * - Stars float toward player, award a coin each on arrival.
 * - On each absorption: 8 tiny gold sparks burst from the player position
 *   and a point light pulses briefly for the warm gold glow.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_PARTICLES   = 700;
const HOME_SPEED      = 3.5;
const ABSORB_DIST_SQ  = 0.4 * 0.4;

const LIGHT_POOL      = 16;    // ambient float lights sampled across particles
const LIGHT_RANGE     = 2.8;
const LIGHT_INTENSITY = 2.2;

const SPARKS_PER_ABSORB = 8;
const MAX_SPARKS        = 128;  // 8 × 16 simultaneous absorptions comfortably
const SPARK_LIFE        = 0.28;
const SPARK_SPEED_MIN   = 1.8;
const SPARK_SPEED_MAX   = 4.0;
const SPARK_SIZE_MIN    = 0.04;
const SPARK_SIZE_MAX    = 0.09;

const ABSORB_LIGHT_PEAK  = 5.0;   // intensity at the moment of absorption
const ABSORB_LIGHT_DECAY = 18;    // how fast it falls off per second

// ─── Scratch ──────────────────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _offPos = new THREE.Vector3(0, 0, -999);

// ─── Types ────────────────────────────────────────────────────────────────────
interface StarParticle {
  px: number; py: number; pz: number;
  ry: number; vrY: number;
  age: number;
  size: number;
  coinsPerStar: number;
}

interface Spark {
  px: number; py: number; pz: number;
  vx: number; vy: number;
  life: number;
  size: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
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
    color: "#ffd700", emissive: "#ff9900", emissiveIntensity: 1.6,
    metalness: 0.65, roughness: 0.18,
  }), []);
  useEffect(() => () => { starMat.dispose(); }, [starMat]);

  // Spark material — brighter, additive feel
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ffe066",
    transparent: true,
    opacity: 1,
  }), []);
  useEffect(() => () => { sparkMat.dispose(); }, [sparkMat]);

  const particles       = useRef<StarParticle[]>([]);
  const sparks          = useRef<Spark[]>([]);
  const seenEvents      = useRef<Set<string>>(new Set());
  const meshRef         = useRef<THREE.InstancedMesh>(null);
  const sparkMeshRef    = useRef<THREE.InstancedMesh>(null);
  const lightRefs       = useRef<(THREE.PointLight | null)[]>(
    Array.from({ length: LIGHT_POOL }, () => null)
  );
  const absorbLightRef  = useRef<THREE.PointLight>(null);
  const absorbLightIntensity = useRef(0);

  useFrame((_, delta) => {
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = useMagicOrb.getState();
    const [ppx, ppy, ppz] = playerPosition;

    // ── Spawn stars ──────────────────────────────────────────────────────────
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

    // ── Update stars ─────────────────────────────────────────────────────────
    const mesh = meshRef.current;
    let live = 0;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.age += delta;

      const dx = ppx - p.px;
      const dy = ppy - p.py;

      if (dx * dx + dy * dy < ABSORB_DIST_SQ) {
        // ── Absorbed ── award coin + burst sparks + pulse light ─────────────
        useShop.getState().addCoins(p.coinsPerStar);

        // Spark burst at player position
        if (sparks.current.length + SPARKS_PER_ABSORB <= MAX_SPARKS) {
          for (let k = 0; k < SPARKS_PER_ABSORB; k++) {
            const angle = (k / SPARKS_PER_ABSORB) * Math.PI * 2 + Math.random() * 0.8;
            const spd   = SPARK_SPEED_MIN + Math.random() * (SPARK_SPEED_MAX - SPARK_SPEED_MIN);
            sparks.current.push({
              px: ppx + (Math.random() - 0.5) * 0.05,
              py: ppy + (Math.random() - 0.5) * 0.05,
              pz: ppz,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              life: SPARK_LIFE * (0.8 + Math.random() * 0.4),
              size: SPARK_SIZE_MIN + Math.random() * (SPARK_SIZE_MAX - SPARK_SIZE_MIN),
            });
          }
        }

        // Pulse the absorption light
        absorbLightIntensity.current = Math.min(
          ABSORB_LIGHT_PEAK,
          absorbLightIntensity.current + 1.2,
        );

        continue;
      }

      // Float toward player
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

    // ── Update sparks ────────────────────────────────────────────────────────
    const sparkMesh = sparkMeshRef.current;
    let liveSparks  = 0;

    for (let i = 0; i < sparks.current.length; i++) {
      const s = sparks.current[i];
      s.life -= delta;
      if (s.life <= 0) continue;
      s.px += s.vx * delta;
      s.py += s.vy * delta;
      // Drag
      s.vx *= 1 - 6 * delta;
      s.vy *= 1 - 6 * delta;
      if (liveSparks !== i) sparks.current[liveSparks] = s;
      liveSparks++;
    }
    sparks.current.length = liveSparks;

    // ── Decay absorption light ───────────────────────────────────────────────
    absorbLightIntensity.current = Math.max(
      0,
      absorbLightIntensity.current - ABSORB_LIGHT_DECAY * delta,
    );
    const al = absorbLightRef.current;
    if (al) {
      al.intensity = absorbLightIntensity.current;
      al.position.set(ppx, ppy, ppz + 0.5);
    }

    // ── Reposition float light pool ──────────────────────────────────────────
    const lights = lightRefs.current;
    if (live === 0) {
      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l];
        if (lt) lt.position.copy(_offPos);
      }
    } else {
      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l];
        if (!lt) continue;
        const idx = Math.floor((l / LIGHT_POOL) * live);
        const p   = particles.current[idx];
        lt.position.set(p.px, p.py, p.pz);
        lt.intensity = LIGHT_INTENSITY * Math.min(1, p.age / 0.2);
      }
    }

    // ── Render: star instances ────────────────────────────────────────────────
    if (mesh) {
      for (let i = 0; i < live; i++) {
        const p       = particles.current[i];
        const fadeIn  = Math.min(1, p.age / 0.12);
        const worldSz = p.size * normalScale * fadeIn;
        _dummy.position.set(p.px, p.py, p.pz);
        _dummy.rotation.set(0.3, p.ry, 0.2);
        _dummy.scale.setScalar(Math.max(1e-4, worldSz));
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      }
      _dummy.position.copy(_offPos);
      _dummy.scale.setScalar(1e-4);
      _dummy.updateMatrix();
      for (let i = live; i < MAX_PARTICLES; i++) mesh.setMatrixAt(i, _dummy.matrix);
      mesh.count = MAX_PARTICLES;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ── Render: spark instances ───────────────────────────────────────────────
    if (sparkMesh) {
      for (let i = 0; i < liveSparks; i++) {
        const s      = sparks.current[i];
        const t      = 1 - s.life / SPARK_LIFE;   // 0→1 over spark lifetime
        const fadeOut = 1 - t * t;                 // ease-out fade
        const worldSz = s.size * normalScale * fadeOut;
        _dummy.position.set(s.px, s.py, s.pz);
        _dummy.rotation.set(0, s.life * 8, 0.3);
        _dummy.scale.setScalar(Math.max(1e-4, worldSz));
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, _dummy.matrix);
      }
      _dummy.position.copy(_offPos);
      _dummy.scale.setScalar(1e-4);
      _dummy.updateMatrix();
      for (let i = liveSparks; i < MAX_SPARKS; i++) sparkMesh.setMatrixAt(i, _dummy.matrix);
      sparkMesh.count = MAX_SPARKS;
      sparkMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Floating star instances */}
      <instancedMesh
        ref={meshRef}
        args={[starGeo, starMat, MAX_PARTICLES]}
        renderOrder={10}
        frustumCulled={false}
      />

      {/* Absorption spark instances */}
      <instancedMesh
        ref={sparkMeshRef}
        args={[starGeo, sparkMat, MAX_SPARKS]}
        renderOrder={11}
        frustumCulled={false}
      />

      {/* Absorption point light — pulses at player position on each absorbed star */}
      <pointLight
        ref={absorbLightRef}
        color="#ffdd44"
        intensity={0}
        distance={3.5}
        decay={2}
        position={[0, 0, -999]}
      />

      {/* Float-light pool — tracks sampled particle positions */}
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
