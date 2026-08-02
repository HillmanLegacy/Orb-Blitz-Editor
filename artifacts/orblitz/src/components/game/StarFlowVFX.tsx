/**
 * StarFlowVFX
 * HD yellow star particles that burst from a kill position and flow into the player.
 * Particle count equals the stars/coins awarded for that kill.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_PARTICLES   = 400;   // hard cap across all live events
const BURST_DUR       = 0.26;  // seconds of outward burst before homing starts
const BASE_LIFE       = 1.4;   // base particle lifetime (seconds)
const LIFE_VARIANCE   = 0.35;  // ± randomness on lifetime
const BURST_SPEED_MIN = 2.8;
const BURST_SPEED_MAX = 6.5;
const HOME_ACCEL_BASE = 14;    // pixels/s² toward player (grows as life runs out)
const HOME_ACCEL_RAMP = 24;    // extra acceleration at end of life
const MAX_HOME_SPEED  = 28;

// ─── Module-level scratch objects (no per-frame allocations) ──────────────────
const _dummy = new THREE.Object3D();
const _col   = new THREE.Color();

// ─── Particle data (plain arrays for speed) ────────────────────────────────────
interface Particle {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  life: number;    // remaining seconds
  maxLife: number;
  size: number;
  isBoss: boolean; // boss reward → brighter / larger
}

export function StarFlowVFX() {
  const meshRef     = useRef<THREE.InstancedMesh>(null);
  const particles   = useRef<Particle[]>([]);
  const seenEvents  = useRef<Set<string>>(new Set());

  useFrame((_, delta) => {
    const store = useMagicOrb.getState();
    const { starFlowEvents, removeStarFlowEvent, playerPosition } = store;
    const [ppx, ppy, ppz] = playerPosition;

    // ── Spawn particles for new events ────────────────────────────────────────
    for (const evt of starFlowEvents) {
      if (seenEvents.current.has(evt.id)) continue;
      seenEvents.current.add(evt.id);

      const [fx, fy, fz] = evt.fromPos;
      const isBoss = evt.count >= 30;
      // Stagger particles in a slight spread so they don't all look identical
      for (let i = 0; i < evt.count; i++) {
        if (particles.current.length >= MAX_PARTICLES) break;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const spd   = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN);
        const life  = BASE_LIFE + (Math.random() - 0.5) * LIFE_VARIANCE;
        particles.current.push({
          px: fx + (Math.random() - 0.5) * 0.15,
          py: fy + (Math.random() - 0.5) * 0.15,
          pz: fz,
          vx: Math.sin(phi) * Math.cos(theta) * spd,
          vy: Math.sin(phi) * Math.sin(theta) * spd,
          vz: 0,
          life,
          maxLife: life,
          size: isBoss
            ? 0.10 + Math.random() * 0.11
            : 0.065 + Math.random() * 0.075,
          isBoss,
        });
      }

      // Remove the event immediately — particles are now live in our local pool
      removeStarFlowEvent(evt.id);
    }

    // ── Update particles ───────────────────────────────────────────────────────
    const mesh = meshRef.current;
    let liveCount = 0;

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.life -= delta;
      if (p.life <= 0) continue;   // skip dead particles (compact below)

      const elapsed   = p.maxLife - p.life;
      const lifeRatio = p.life / p.maxLife;

      // ── Homing phase: attract toward player after burst ──────────────────
      if (elapsed > BURST_DUR) {
        const dx = ppx - p.px;
        const dy = ppy - p.py;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

        // Acceleration ramps up as particle ages → feels magnetic near player
        const accel = (HOME_ACCEL_BASE + HOME_ACCEL_RAMP * (1 - lifeRatio)) * delta;
        p.vx += (dx / dist) * accel;
        p.vy += (dy / dist) * accel;

        // Clamp speed so particles don't fly past the player
        const spd2 = p.vx * p.vx + p.vy * p.vy;
        const maxSpd = MAX_HOME_SPEED;
        if (spd2 > maxSpd * maxSpd) {
          const inv = maxSpd / Math.sqrt(spd2);
          p.vx *= inv;
          p.vy *= inv;
        }
      }

      p.px += p.vx * delta;
      p.py += p.vy * delta;
      // p.pz stays near 0

      // ── Pack alive particle into compact slot ─────────────────────────────
      if (liveCount !== i) particles.current[liveCount] = p;
      liveCount++;
    }
    particles.current.length = liveCount;

    // ── Render ─────────────────────────────────────────────────────────────────
    if (!mesh) return;

    const renderCount = Math.min(liveCount, MAX_PARTICLES);

    for (let i = 0; i < renderCount; i++) {
      const p = particles.current[i];
      const lifeRatio = p.life / p.maxLife;

      // Opacity: ramp in over first 10% of life, fade out over last 25%
      const fadeIn  = Math.min(1, (p.maxLife - p.life) / (p.maxLife * 0.1));
      const fadeOut = lifeRatio < 0.25 ? lifeRatio / 0.25 : 1;
      const alpha   = fadeIn * fadeOut;

      // Size: slightly larger when first burst, then contract
      const sizeScale = 1.0 + (1 - lifeRatio) * 0.6;
      const sz = p.size * sizeScale * alpha;

      _dummy.position.set(p.px, p.py, p.pz);
      _dummy.scale.setScalar(Math.max(0.001, sz));
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      // Color gradient: deep gold → bright yellow → near-white flash at player
      // lifeRatio 1 (fresh) → 0 (dead/reached player)
      const t   = 1 - lifeRatio;                          // 0=birth → 1=death
      const hue = 0.13 - t * 0.04;                        // 0.13 gold → 0.09 warm yellow
      const lit = 0.5  + t * 0.32;                        // brightens toward player
      const sat = 1.0  - t * 0.35;                        // desaturates to white flash
      _col.setHSL(Math.max(0.05, hue), Math.max(0, sat), Math.min(1, lit));
      // HDR over-brightening — additive blending makes this look like a hot star
      const boost = p.isBoss ? 2.8 : 2.2;
      _col.multiplyScalar(boost * alpha + 0.3);
      mesh.setColorAt(i, _col);
    }

    // Zero-out unused slots
    if (renderCount < MAX_PARTICLES) {
      _dummy.position.set(0, 0, -999);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      for (let i = renderCount; i < MAX_PARTICLES; i++) {
        mesh.setMatrixAt(i, _dummy.matrix);
      }
    }

    mesh.count = MAX_PARTICLES;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} renderOrder={10}>
      <sphereGeometry args={[1, 5, 4]} />
      <meshBasicMaterial
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexColors
      />
    </instancedMesh>
  );
}
