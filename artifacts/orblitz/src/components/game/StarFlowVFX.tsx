/**
 * StarFlowVFX — Zero-GC instanced star collection system.
 *
 * Performance contract:
 *  - All particle & spark data lives in module-level Float32Arrays allocated
 *    once at module load — no per-frame `new` calls, no GC pressure.
 *  - Stars use a single InstancedMesh draw call (GPU instancing).
 *  - Sparks use a second InstancedMesh draw call.
 *  - Point lights are assigned to the LIGHT_POOL nearest stars each frame
 *    using an O(n·LIGHT_POOL) partial-min scan — no sort, no allocation.
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

// Burst-phase: stars fly outward before homing
const BURST_DURATION  = 1.0;    // seconds of outward travel
const BURST_SPEED     = 6.0;    // units/s — uniform for all stars
const BURST_DRAG      = 8.0;    // exponential drag coefficient during burst
const HOME_PULL       = 3.0;    // proximity pull factor — higher = more speed-up near player

// Boss explosion-debris burst — chaotic scatter with wide speed range
const BOSS_BURST_SPEED_MIN = 4.0;
const BOSS_BURST_SPEED_MAX = 14.0;

const LIGHT_POOL      = 16;
const LIGHT_RANGE     = 2.8;
const LIGHT_INTENSITY = 2.2;

const SPARKS_PER_ABSORB = 8;
const MAX_SPARKS        = 128;
const SPARK_LIFE        = 0.28;
const SPARK_SPEED_MIN   = 1.8;
const SPARK_SPEED_MAX   = 4.0;
const SPARK_SIZE_MIN    = 0.04;
const SPARK_SIZE_MAX    = 0.09;

const ABSORB_LIGHT_PEAK  = 5.0;
const ABSORB_LIGHT_DECAY = 18;

// ─── Float32Array particle pool ───────────────────────────────────────────────
// Layout per particle (P_STRIDE floats):
//   [0] px  [1] py  [2] pz  [3] ry  [4] vrY  [5] age  [6] size  [7] coinsPerStar
//   [8] bvx  [9] bvy   (burst-phase velocity; zeroed out after BURST_DURATION)
const P_STRIDE = 10;
const _pPool   = new Float32Array(MAX_PARTICLES * P_STRIDE);

// ─── Float32Array spark pool ──────────────────────────────────────────────────
// Layout per spark (S_STRIDE floats):
//   [0] px  [1] py  [2] pz  [3] vx  [4] vy  [5] life  [6] size
const S_STRIDE = 7;
const _sPool   = new Float32Array(MAX_SPARKS * S_STRIDE);

// ─── Light-pool nearest-N scratch (reused each frame, no alloc) ──────────────
const _nearDist = new Float32Array(LIGHT_POOL);
const _nearIdx  = new Int32Array(LIGHT_POOL);

// ─── Render scratch ───────────────────────────────────────────────────────────
const _dummy   = new THREE.Object3D();
const _offPos  = new THREE.Vector3(0, 0, -999);

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

  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ffe066", transparent: true, opacity: 1,
  }), []);
  useEffect(() => () => { sparkMat.dispose(); }, [sparkMat]);

  // Live-count refs — pools themselves are module-level Float32Arrays
  const pLive  = useRef(0);
  const sLive  = useRef(0);
  const seenEvents       = useRef(new Set<string>());
  const meshRef          = useRef<THREE.InstancedMesh>(null);
  const sparkMeshRef     = useRef<THREE.InstancedMesh>(null);
  const lightRefs        = useRef<(THREE.PointLight | null)[]>(
    Array.from({ length: LIGHT_POOL }, () => null),
  );
  const absorbLightRef   = useRef<THREE.PointLight>(null);
  const absorbLightIntensity = useRef(0);

  // Reset pool live counts on unmount (avoids stale particles on remount)
  useEffect(() => () => {
    pLive.current = 0;
    sLive.current = 0;
    seenEvents.current.clear();
  }, []);

  useFrame((_, delta) => {
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = useMagicOrb.getState();
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
        if (pLive.current >= MAX_PARTICLES) break;
        const off = pLive.current * P_STRIDE;
        // Burst velocity: boss uses explosion-debris scatter; standard uses uniform radial ring
        let bvx: number, bvy: number;
        if (evt.isBoss) {
          // Explosion debris: fully random directions, wide speed range for scatter depth
          const angle = Math.random() * Math.PI * 2;
          const spd   = BOSS_BURST_SPEED_MIN + Math.random() * (BOSS_BURST_SPEED_MAX - BOSS_BURST_SPEED_MIN);
          bvx = Math.cos(angle) * spd;
          bvy = Math.sin(angle) * spd;
        } else {
          // Standard: evenly-distributed ring with slight jitter, uniform speed
          const angle = (i / evt.count) * Math.PI * 2 + Math.random() * 0.9;
          bvx = Math.cos(angle) * BURST_SPEED;
          bvy = Math.sin(angle) * BURST_SPEED;
        }
        _pPool[off + 0] = fx;                                             // px — spawn at origin
        _pPool[off + 1] = fy;                                             // py
        _pPool[off + 2] = fz;                                             // pz
        _pPool[off + 3] = Math.random() * Math.PI * 2;                   // ry
        _pPool[off + 4] = (Math.random() < 0.5 ? 1 : -1) * (2 + Math.random() * 3); // vrY
        _pPool[off + 5] = 0;                                              // age
        _pPool[off + 6] = 0.184 + Math.random() * 0.115;                  // size (+15%)
        _pPool[off + 7] = coinsPerStar;                                   // coinsPerStar
        _pPool[off + 8] = bvx;                                            // bvx
        _pPool[off + 9] = bvy;                                            // bvy
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
        useShop.getState().addCoins(_pPool[off + 7]); // coinsPerStar

        // Burst sparks at player position
        if (sLive.current + SPARKS_PER_ABSORB <= MAX_SPARKS) {
          for (let k = 0; k < SPARKS_PER_ABSORB; k++) {
            const angle = (k / SPARKS_PER_ABSORB) * Math.PI * 2 + Math.random() * 0.8;
            const spd   = SPARK_SPEED_MIN + Math.random() * (SPARK_SPEED_MAX - SPARK_SPEED_MIN);
            const soff  = sLive.current * S_STRIDE;
            _sPool[soff + 0] = ppx + (Math.random() - 0.5) * 0.05; // px
            _sPool[soff + 1] = ppy + (Math.random() - 0.5) * 0.05; // py
            _sPool[soff + 2] = ppz;                                  // pz
            _sPool[soff + 3] = Math.cos(angle) * spd;               // vx
            _sPool[soff + 4] = Math.sin(angle) * spd;               // vy
            _sPool[soff + 5] = SPARK_LIFE * (0.8 + Math.random() * 0.4); // life
            _sPool[soff + 6] = SPARK_SIZE_MIN + Math.random() * (SPARK_SIZE_MAX - SPARK_SIZE_MIN); // size
            sLive.current++;
          }
        }

        // Pulse the absorption light
        absorbLightIntensity.current = Math.min(
          ABSORB_LIGHT_PEAK,
          absorbLightIntensity.current + 1.2,
        );
        continue; // absorbed — don't compact into live slot
      }

      const age = _pPool[off + 5] + delta;
      _pPool[off + 5] = age;                   // age
      _pPool[off + 3] += _pPool[off + 4] * delta; // ry += vrY * delta

      if (age < BURST_DURATION) {
        // ── Burst phase: fly outward, decelerate ──────────────────────────────
        const drag = Math.exp(-BURST_DRAG * delta);
        _pPool[off + 8] *= drag;               // bvx decelerates
        _pPool[off + 9] *= drag;               // bvy decelerates
        _pPool[off + 0] += _pPool[off + 8] * delta; // px
        _pPool[off + 1] += _pPool[off + 9] * delta; // py
        _pPool[off + 2]  = ppz;
      } else {
        // ── Home phase: chase player, speed up as distance shrinks ────────────
        const dist = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        // Pull factor: asymptotic — smooth at range, snappy up close
        const speedMult = 1.0 + HOME_PULL / (dist + 0.5);
        const step = Math.min(HOME_SPEED * speedMult * delta, dist);
        _pPool[off + 0] += (dx / dist) * step; // px
        _pPool[off + 1] += (dy / dist) * step; // py
        _pPool[off + 2]  = ppz;
      }

      // Compact: pack alive particles toward front
      if (live !== i) {
        _pPool.copyWithin(live * P_STRIDE, off, off + P_STRIDE);
      }
      live++;
    }
    pLive.current = live;

    // ── Update sparks ────────────────────────────────────────────────────────
    let sLiveNext = 0;

    for (let i = 0; i < sLive.current; i++) {
      const off = i * S_STRIDE;
      _sPool[off + 5] -= delta; // life
      if (_sPool[off + 5] <= 0) continue;

      _sPool[off + 0] += _sPool[off + 3] * delta; // px += vx * dt
      _sPool[off + 1] += _sPool[off + 4] * delta; // py += vy * dt
      const drag = 1 - 6 * delta;
      _sPool[off + 3] *= drag;  // vx drag
      _sPool[off + 4] *= drag;  // vy drag

      if (sLiveNext !== i) {
        _sPool.copyWithin(sLiveNext * S_STRIDE, off, off + S_STRIDE);
      }
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

    // ── Assign float lights to nearest LIGHT_POOL stars ──────────────────────
    // O(n·LIGHT_POOL) partial-min scan — no sort, no allocation.
    const lights = lightRefs.current;
    if (live === 0) {
      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l]; if (lt) lt.position.copy(_offPos);
      }
    } else {
      // Initialise scratch buffers
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
          // Find new worst slot
          maxVal = 0;
          for (let l = 0; l < LIGHT_POOL; l++) {
            if (_nearDist[l] > maxVal) { maxVal = _nearDist[l]; maxSlot = l; }
          }
        }
      }

      for (let l = 0; l < LIGHT_POOL; l++) {
        const lt = lights[l]; if (!lt) continue;
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
        const fadeIn = Math.min(1, _pPool[off + 5] / 0.12); // age / 0.12s
        const worldSz = Math.max(1e-4, _pPool[off + 6] * normalScale * fadeIn);
        _dummy.position.set(_pPool[off + 0], _pPool[off + 1], _pPool[off + 2]);
        _dummy.rotation.set(0.3, _pPool[off + 3], 0.2);
        _dummy.scale.setScalar(worldSz);
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
    const sparkMesh = sparkMeshRef.current;
    if (sparkMesh) {
      for (let i = 0; i < sLiveNext; i++) {
        const off    = i * S_STRIDE;
        const t      = 1 - _sPool[off + 5] / SPARK_LIFE; // 0→1 over life
        const fadeOut = 1 - t * t;
        const worldSz = Math.max(1e-4, _sPool[off + 6] * normalScale * fadeOut);
        _dummy.position.set(_sPool[off + 0], _sPool[off + 1], _sPool[off + 2]);
        _dummy.rotation.set(0, _sPool[off + 5] * 8, 0.3);
        _dummy.scale.setScalar(worldSz);
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, _dummy.matrix);
      }
      _dummy.position.copy(_offPos);
      _dummy.scale.setScalar(1e-4);
      _dummy.updateMatrix();
      for (let i = sLiveNext; i < MAX_SPARKS; i++) sparkMesh.setMatrixAt(i, _dummy.matrix);
      sparkMesh.count = MAX_SPARKS;
      sparkMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Star instances */}
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

      {/* Absorption pulse light */}
      <pointLight
        ref={absorbLightRef}
        color="#ffdd44"
        intensity={0}
        distance={3.5}
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
        />
      ))}
    </>
  );
}

useGLTF.preload("/models/star_pickup.glb");
