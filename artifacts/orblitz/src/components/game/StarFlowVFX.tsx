/**
 * StarFlowVFX — Zero-GC instanced star collection system.
 *
 * Performance contract:
 *  - All particle and burst data lives in module-level Float32Arrays.
 *  - Stars use a single InstancedMesh draw call (GPU instancing).
 *  - Burst particles use a second InstancedMesh (additive, per-instance color).
 *  - Point lights are assigned to the LIGHT_POOL nearest stars each frame.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { getVisualBudget, useRenderQuality } from "./AdaptiveRenderQuality";

// ─── Star flow config ─────────────────────────────────────────────────────────
const MAX_PARTICLES   = 700;
const HOME_SPEED      = 3.5;
const ABSORB_DIST_SQ  = 0.4 * 0.4;

const BURST_DURATION  = 1.0;
const BURST_SPEED     = 6.0;
const BURST_DRAG      = 8.0;
const HOME_PULL       = 3.0;

const BOSS_BURST_SPEED_MIN = 8.0;
const BOSS_BURST_SPEED_MAX = 26.0;
const BOSS_BURST_DRAG      = 4.5;

const LIGHT_POOL      = 16;
const LIGHT_RANGE     = 2.8;
const LIGHT_INTENSITY = 2.2;

// ─── Absorption burst config ──────────────────────────────────────────────────
const SPARKS_PER_ABSORB  = 36;
const MAX_SPARKS         = 576;
const SPARK_LIFE         = 0.65;
const SPARK_SPEED_MIN    = 5.0;
const SPARK_SPEED_MAX    = 12.0;
const SPARK_SIZE_MIN     = 0.07;
const SPARK_SIZE_MAX     = 0.22;
const ABSORB_VFX_SCALE   = 1.0;

const ABSORB_LIGHT_PEAK  = 14.0;
const ABSORB_LIGHT_DECAY = 20;

// ─── Star particle pool ───────────────────────────────────────────────────────
// Layout (P_STRIDE floats):
//   [0]px [1]py [2]pz [3]ry [4]vrY [5]age [6]size [7]coinsPerStar
//   [8]bvx [9]bvy [10]boss
const P_STRIDE = 11;
const _pPool   = new Float32Array(MAX_PARTICLES * P_STRIDE);

// ─── Burst particle pool ──────────────────────────────────────────────────────
// Layout (S_STRIDE floats):
//   [0]px [1]py [2]pz [3]vx [4]vy [5]vz [6]life [7]size [8]colorIdx
const S_STRIDE = 9;
const _sPool   = new Float32Array(MAX_SPARKS * S_STRIDE);

// ─── Light-pool scratch ───────────────────────────────────────────────────────
const _nearDist = new Float32Array(LIGHT_POOL);
const _nearIdx  = new Int32Array(LIGHT_POOL);

// ─── Shared render scratch ────────────────────────────────────────────────────
const _dummy  = new THREE.Object3D();
const _offPos = new THREE.Vector3(0, 0, -999);
const _col    = new THREE.Color();

// ─── Burst colors: gold / orange-gold / white / bright-yellow ────────────────
const _burstColors = [
  new THREE.Color("#ffd700"),
  new THREE.Color("#ff9900"),
  new THREE.Color("#ffffff"),
  new THREE.Color("#ffee44"),
];

// ─── Module-level geometries (never mutated, safe to share) ──────────────────
const _sparkGeo = new THREE.SphereGeometry(1, 5, 3);

// ─── Component ────────────────────────────────────────────────────────────────
export function StarFlowVFX({ visualEnabled = true }: { visualEnabled?: boolean }) {
  const { scene } = useGLTF("/models/star_pickup.glb");
  const budget = getVisualBudget(useRenderQuality());

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

  // Burst particle material — additive, per-instance color
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => { sparkMat.dispose(); }, [sparkMat]);

  // Live counts
  const pLive  = useRef(0);
  const sLive  = useRef(0);

  const seenEvents       = useRef(new Set<string>());
  const meshRef          = useRef<THREE.InstancedMesh>(null);
  const sparkMeshRef     = useRef<THREE.InstancedMesh>(null);
  const lightRefs        = useRef<(THREE.PointLight | null)[]>(
    Array.from({ length: LIGHT_POOL }, () => null),
  );
  const absorbLightRef        = useRef<THREE.PointLight>(null);
  const absorbLightIntensity  = useRef(0);

  useEffect(() => () => {
    pLive.current = 0;
    sLive.current = 0;
    seenEvents.current.clear();
    absorbLightIntensity.current = 0;
  }, []);

  useFrame((_, delta) => {
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = useMagicOrb.getState();

    // The reward was already committed by addStarFlowEvent. When this visual
    // tier is disabled, discard only the presentation events rather than
    // allowing the queue to grow or delaying gameplay state.
    if (!visualEnabled) {
      for (const evt of starFlowEvents) removeStarFlowEvent(evt.id);
      return;
    }

    // These caps govern presentation buffers only. Reward payout has already
    // occurred, so discarding excess visual particles cannot change currency.
    pLive.current = Math.min(pLive.current, budget.rewardStars);
    sLive.current = Math.min(sLive.current, budget.rewardSparks);

    const ppx = playerPosition[0];
    const ppy = playerPosition[1];
    const ppz = playerPosition[2];

    // ── Spawn stars from store events ────────────────────────────────────────
    for (const evt of starFlowEvents) {
      if (seenEvents.current.has(evt.id)) continue;
      seenEvents.current.add(evt.id);

      const fx = evt.fromPos[0];
      const fy = evt.fromPos[1];
      const fz = evt.fromPos[2];
      const coinsPerStar = evt.coinsPerStar ?? 1;

      for (let i = 0; i < evt.count; i++) {
        if (pLive.current >= budget.rewardStars) break;
        const off = pLive.current * P_STRIDE;
        let bvx: number, bvy: number;
        if (evt.isBoss) {
          const angle = Math.random() * Math.PI * 2;
          const spd   = BOSS_BURST_SPEED_MIN + Math.random() * (BOSS_BURST_SPEED_MAX - BOSS_BURST_SPEED_MIN);
          bvx = Math.cos(angle) * spd;
          bvy = Math.sin(angle) * spd;
        } else {
          const angle = (i / evt.count) * Math.PI * 2 + Math.random() * 0.9;
          bvx = Math.cos(angle) * BURST_SPEED;
          bvy = Math.sin(angle) * BURST_SPEED;
        }
        _pPool[off + 0] = fx;
        _pPool[off + 1] = fy;
        _pPool[off + 2] = fz;
        _pPool[off + 3] = Math.random() * Math.PI * 2;
        _pPool[off + 4] = (Math.random() < 0.5 ? 1 : -1) * (2 + Math.random() * 3);
        _pPool[off + 5] = 0;
        _pPool[off + 6] = 0.184 + Math.random() * 0.115;
        _pPool[off + 7] = coinsPerStar;
        _pPool[off + 8] = bvx;
        _pPool[off + 9] = bvy;
        _pPool[off + 10] = evt.isBoss ? 1 : 0;
        pLive.current++;
      }
      removeStarFlowEvent(evt.id);
    }

    // ── Update stars ─────────────────────────────────────────────────────────
    let live = 0;

    for (let i = 0; i < pLive.current; i++) {
      const off = i * P_STRIDE;

      const dx = ppx - _pPool[off + 0];
      const dy = ppy - _pPool[off + 1];

      // Absorbed?
      if (dx * dx + dy * dy < ABSORB_DIST_SQ) {
        // ── AAA burst: 36 sphere particles in full 3D spread ─────────────────
        for (let k = 0; k < SPARKS_PER_ABSORB; k++) {
          if (sLive.current >= budget.rewardSparks) break;
          // Full sphere spread
          const phi   = Math.acos(2 * Math.random() - 1);
          const theta = Math.random() * Math.PI * 2;
          const spd   = (SPARK_SPEED_MIN + Math.random() * (SPARK_SPEED_MAX - SPARK_SPEED_MIN))
            * ABSORB_VFX_SCALE;
          const soff  = sLive.current * S_STRIDE;
          _sPool[soff + 0] = ppx + (Math.random() - 0.5) * 0.10 * ABSORB_VFX_SCALE;
          _sPool[soff + 1] = ppy + (Math.random() - 0.5) * 0.10 * ABSORB_VFX_SCALE;
          _sPool[soff + 2] = ppz;
          _sPool[soff + 3] = Math.sin(phi) * Math.cos(theta) * spd;   // vx
          _sPool[soff + 4] = Math.sin(phi) * Math.sin(theta) * spd;   // vy
          _sPool[soff + 5] = Math.cos(phi) * spd * 0.55;              // vz (partial Z)
          _sPool[soff + 6] = SPARK_LIFE * (0.65 + Math.random() * 0.35); // life
          _sPool[soff + 7] = (
            SPARK_SIZE_MIN + Math.random() * (SPARK_SIZE_MAX - SPARK_SIZE_MIN)
          ) * ABSORB_VFX_SCALE;
          _sPool[soff + 8] = Math.floor(Math.random() * 4);           // colorIdx
          sLive.current++;
        }

        // ── Absorption light flash ────────────────────────────────────────────
        absorbLightIntensity.current = Math.min(
          ABSORB_LIGHT_PEAK,
          absorbLightIntensity.current + ABSORB_LIGHT_PEAK * 0.6,
        );
        continue;
      }

      const age = _pPool[off + 5] + delta;
      _pPool[off + 5] = age;
      _pPool[off + 3] += _pPool[off + 4] * delta;

      if (age < BURST_DURATION) {
        const dragCoeff = _pPool[off + 10] > 0 ? BOSS_BURST_DRAG : BURST_DRAG;
        const drag = Math.exp(-dragCoeff * delta);
        _pPool[off + 8] *= drag;
        _pPool[off + 9] *= drag;
        _pPool[off + 0] += _pPool[off + 8] * delta;
        _pPool[off + 1] += _pPool[off + 9] * delta;
        _pPool[off + 2]  = ppz;
      } else {
        const dist = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        const speedMult = 1.0 + HOME_PULL / (dist + 0.5);
        const step = Math.min(HOME_SPEED * speedMult * delta, dist);
        _pPool[off + 0] += (dx / dist) * step;
        _pPool[off + 1] += (dy / dist) * step;
        _pPool[off + 2]  = ppz;
      }

      if (live !== i) _pPool.copyWithin(live * P_STRIDE, off, off + P_STRIDE);
      live++;
    }
    pLive.current = live;

    // ── Update burst particles ────────────────────────────────────────────────
    let sLiveNext = 0;

    for (let i = 0; i < sLive.current; i++) {
      const off = i * S_STRIDE;
      _sPool[off + 6] -= delta;   // life countdown
      if (_sPool[off + 6] <= 0) continue;

      const drag = Math.exp(-5.5 * delta);
      _sPool[off + 0] += _sPool[off + 3] * delta;  // px
      _sPool[off + 1] += _sPool[off + 4] * delta;  // py
      _sPool[off + 2] += _sPool[off + 5] * delta;  // pz
      _sPool[off + 3] *= drag;
      _sPool[off + 4] *= drag;
      _sPool[off + 5] *= drag;

      if (sLiveNext !== i) _sPool.copyWithin(sLiveNext * S_STRIDE, off, off + S_STRIDE);
      sLiveNext++;
    }
    sLive.current = sLiveNext;

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

    // ── Assign float lights to nearest visible stars ─────────────────────────
    const lights = lightRefs.current;
    if (live === 0) {
      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l]; if (lt) lt.position.copy(_offPos);
      }
    } else {
      _nearDist.fill(Infinity);
      _nearIdx.fill(-1);
      let maxSlot = 0;
      let maxVal  = Infinity;

      for (let i = 0; i < live; i++) {
        const off = i * P_STRIDE;
        const dx  = ppx - _pPool[off + 0];
        const dy  = ppy - _pPool[off + 1];
        const d2  = dx * dx + dy * dy;
        if (d2 < maxVal) {
          _nearDist[maxSlot] = d2;
          _nearIdx[maxSlot]  = i;
          maxVal = 0;
          for (let l = 0; l < budget.rewardLights; l++) {
            if (_nearDist[l] > maxVal) { maxVal = _nearDist[l]; maxSlot = l; }
          }
        }
      }

      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l]; if (!lt) continue;
        if (l >= budget.rewardLights) { lt.position.copy(_offPos); continue; }
        const idx = _nearIdx[l];
        if (idx < 0) { lt.position.copy(_offPos); continue; }
        const off = idx * P_STRIDE;
        lt.position.set(_pPool[off + 0], _pPool[off + 1], _pPool[off + 2]);
        lt.intensity = LIGHT_INTENSITY * Math.min(1, _pPool[off + 5] / 0.2);
      }
    }

    // ── Render: star instances ────────────────────────────────────────────────
    const mesh = meshRef.current;
    if (mesh) {
      for (let i = 0; i < live; i++) {
        const off    = i * P_STRIDE;
        const fadeIn = Math.min(1, _pPool[off + 5] / 0.12);
        const worldSz = Math.max(1e-4, _pPool[off + 6] * normalScale * fadeIn);
        _dummy.position.set(_pPool[off + 0], _pPool[off + 1], _pPool[off + 2]);
        _dummy.rotation.set(0.3, _pPool[off + 3], 0.2);
        _dummy.scale.setScalar(worldSz);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      }
      mesh.count = live;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ── Render: burst particle instances ─────────────────────────────────────
    const sparkMesh = sparkMeshRef.current;
    if (sparkMesh) {
      for (let i = 0; i < sLiveNext; i++) {
        const off     = i * S_STRIDE;
        // Size: start full, fade with sqrt for longer brightness
        const lifeFrac = _sPool[off + 6] / SPARK_LIFE;
        const worldSz  = Math.max(1e-4, _sPool[off + 7] * Math.pow(lifeFrac, 0.55));
        _dummy.position.set(_sPool[off + 0], _sPool[off + 1], _sPool[off + 2]);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(worldSz);
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, _dummy.matrix);
        // Per-instance color
        const ci = Math.min(3, Math.max(0, _sPool[off + 8] | 0));
        _col.copy(_burstColors[ci]).multiplyScalar(lifeFrac * 1.4 + 0.2);
        sparkMesh.setColorAt(i, _col);
      }
      sparkMesh.count = sLiveNext;
      sparkMesh.instanceMatrix.needsUpdate = true;
      if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
    }

  });

  if (!visualEnabled) return null;

  return (
    <>
      {/* Star instances */}
      <instancedMesh
        ref={meshRef}
        args={[starGeo, starMat, MAX_PARTICLES]}
        renderOrder={10}
        frustumCulled={false}
      />

      {/* Absorption burst particles */}
      <instancedMesh
        ref={sparkMeshRef}
        args={[_sparkGeo, sparkMat, MAX_SPARKS]}
        renderOrder={12}
        frustumCulled={false}
      />

      {/* Absorption flash light */}
      <pointLight
        ref={absorbLightRef}
        color="#ffd700"
        intensity={0}
        distance={5.5}
        decay={2}
        position={[0, 0, -999]}
      />

      {/* Float-light pool — tracks the nearest LIGHT_POOL stars */}
      {Array.from({ length: LIGHT_POOL }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => { lightRefs.current[i] = el; }}
          color="#ffcc44"
          intensity={0}
          distance={LIGHT_RANGE}
          decay={2}
          position={[0, 0, -999]}
          visible={i < budget.rewardLights}
        />
      ))}
    </>
  );
}
