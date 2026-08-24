/**
 * SubBlasterOrb — Orbital Autonomous Sub Blaster
 *
 * An automated drone that orbits the player, scans for targets, and fires
 * high-velocity energy bolts with AAA-feel FX (tether, muzzle pop, micro-recoil).
 *
 * Target priority:
 *   1. Boss bossProjectiles (closest incoming enemy bolt)
 *   2. Dark orbs (closest on-screen enemy)
 *   3. Boss entity itself
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import type { Projectile } from "@/lib/stores/useMagicOrb";

// ── Constants ────────────────────────────────────────────────────────────────
const ORBIT_RADIUS   = 2.0;
const ORBIT_SPEED    = 0.9;       // rad/s
const FIRE_INTERVAL  = 0.45;      // seconds between shots
const SCAN_INTERVAL  = 0.08;      // seconds between target scans
const DETECT_RANGE   = 6.5;       // units from player (mid-long screen range)
const ORB_SCALE      = 0.34;      // visual scale of the drone sphere
const RECOIL_DUR     = 0.10;      // seconds for squash pulse
const FLASH_DUR      = 0.08;      // seconds for muzzle flash
const TETHER_HW      = 0.035;     // ribbon half-width

let _subOrbProjCounter = 0;

// Shared geometries / materials (created once at module level)
const _droneCoreGeo  = new THREE.SphereGeometry(1, 10, 7);
const _droneGlowGeo  = new THREE.SphereGeometry(1, 8, 5);
const _droneFlashGeo = new THREE.SphereGeometry(1, 7, 5);

// ── Energy tether geometry (2-triangle ribbon, updated per frame) ────────────
const _tetherGeo = new THREE.BufferGeometry();
const _tetherPts = new Float32Array(4 * 3);  // 4 verts × xyz
const _tetherIdx = [0, 2, 1, 1, 2, 3];
_tetherGeo.setIndex(_tetherIdx);
_tetherGeo.setAttribute("position", new THREE.BufferAttribute(_tetherPts, 3));

const _tetherMat = new THREE.MeshBasicMaterial({
  color: "#22ffee",
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});

// ── Component ────────────────────────────────────────────────────────────────
export function SubBlasterOrb() {
  const { equippedSkin, equippedWeapon } = useShop();
  const isActive = equippedWeapon === "sub_blaster";

  // Orbit state — all hooks must come before any conditional return
  const orbitAngleRef   = useRef(Math.PI / 4);
  const orbPosRef       = useRef<[number, number]>([0, 0]);

  // Firing state
  const fireTimerRef    = useRef(0);
  const scanTimerRef    = useRef(0);
  const lockedTargetRef = useRef<[number, number] | null>(null);

  // FX state
  const recoilTimerRef  = useRef(0);
  const flashTimerRef   = useRef(0);
  const faceAngleRef    = useRef(0);   // current rendered face angle
  const targetAngleRef  = useRef(0);   // desired face angle toward target

  // Three.js refs
  const groupRef       = useRef<THREE.Group>(null);
  const coreRef        = useRef<THREE.Mesh>(null);
  const glowRef        = useRef<THREE.Mesh>(null);
  const flashRef       = useRef<THREE.Mesh>(null);
  const flashMatRef    = useRef(new THREE.MeshBasicMaterial({
    color: "#aaffff",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const tetherMeshRef  = useRef<THREE.Mesh>(null);
  const lightRef       = useRef<THREE.PointLight>(null);

  // Drone core material (tinted by skin but always cyan-ish)
  const droneCoreMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#44eeff",
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const droneGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#00ccff",
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useEffect(() => () => {
    droneCoreMat.dispose();
    droneGlowMat.dispose();
    flashMatRef.current.dispose();
  }, [droneCoreMat, droneGlowMat]);

  useFrame(({ clock }, delta) => {
    if (!isActive) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    const state = useMagicOrb.getState();
    const { playerPosition, darkOrbs, boss, phase, isDying } = state;

    if (phase !== "playing" || isDying) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;

    const [px, py] = playerPosition;
    const time = clock.getElapsedTime();

    // ── Advance orbit angle ───────────────────────────────────────────────
    orbitAngleRef.current += ORBIT_SPEED * delta;
    const oa = orbitAngleRef.current;
    const ox = px + Math.cos(oa) * ORBIT_RADIUS;
    const oy = py + Math.sin(oa) * ORBIT_RADIUS;
    orbPosRef.current = [ox, oy];

    // ── Target scanning (every SCAN_INTERVAL s) ───────────────────────────
    scanTimerRef.current -= delta;
    if (scanTimerRef.current <= 0) {
      scanTimerRef.current = SCAN_INTERVAL;
      let bestTarget: [number, number] | null = null;
      let bestDist = Infinity;

      // Priority 1 — boss projectiles (enemy bolts)
      if (boss && boss.bossProjectiles && boss.bossProjectiles.length > 0) {
        for (const bp of boss.bossProjectiles) {
          const d = Math.sqrt((bp.position[0] - px) ** 2 + (bp.position[1] - py) ** 2);
          if (d < DETECT_RANGE && d < bestDist) {
            bestDist = d;
            bestTarget = [bp.position[0], bp.position[1]];
          }
        }
      }

      // Priority 2 — dark orbs (enemies)
      if (!bestTarget) {
        for (const orb of darkOrbs) {
          if (orb.destroying) continue;
          if (Math.abs(orb.position[0]) > 13 || Math.abs(orb.position[1]) > 9) continue;
          const d = Math.sqrt((orb.position[0] - px) ** 2 + (orb.position[1] - py) ** 2);
          if (d < DETECT_RANGE && d < bestDist) {
            bestDist = d;
            bestTarget = [orb.position[0], orb.position[1]];
          }
        }
      }

      // Priority 3 — boss entity
      if (!bestTarget && boss && !boss.destroying) {
        const d = Math.sqrt((boss.position[0] - px) ** 2 + (boss.position[1] - py) ** 2);
        if (d < DETECT_RANGE) {
          bestTarget = [boss.position[0], boss.position[1]];
        }
      }

      lockedTargetRef.current = bestTarget;
    }

    // ── Face target (smooth rotation toward aim direction) ────────────────
    const tgt = lockedTargetRef.current;
    if (tgt) {
      targetAngleRef.current = Math.atan2(tgt[1] - oy, tgt[0] - ox);
    }
    // Lerp face angle toward target angle
    let dFace = targetAngleRef.current - faceAngleRef.current;
    if (dFace >  Math.PI) dFace -= 2 * Math.PI;
    if (dFace < -Math.PI) dFace += 2 * Math.PI;
    faceAngleRef.current += dFace * Math.min(1, 12 * delta);

    // ── Auto-fire ─────────────────────────────────────────────────────────
    fireTimerRef.current -= delta;
    if (tgt && fireTimerRef.current <= 0) {
      const dirX = tgt[0] - ox;
      const dirY = tgt[1] - oy;
      const len  = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len > 0.05) {
        const projectile: Projectile = {
          id: `sub-${_subOrbProjCounter++}-${Date.now()}`,
          position: [ox, oy, 0],
          direction: [dirX / len, dirY / len, 0],
          isCharged: false,
          size: 0.09,
          type: "subblaster",
          hitCount: 1,
          speed: 26.0,
          noMissTracking: true,
        };
        if (state.addProjectile(projectile)) {
          fireTimerRef.current = FIRE_INTERVAL;
          // Micro-recoil squash + muzzle flash
          recoilTimerRef.current = RECOIL_DUR;
          flashTimerRef.current  = FLASH_DUR;

          // Subtle background shake (lighter than player weapons)
          // Don't call triggerBackgroundShake — too heavy for auto-fire
        } else {
          // Retry shortly when saturation clears without presenting a phantom shot.
          fireTimerRef.current = 0.1;
        }
      } else {
        fireTimerRef.current = FIRE_INTERVAL;
      }
    }

    // ── Position the group at the orb location ────────────────────────────
    if (groupRef.current) {
      groupRef.current.position.set(ox, oy, 0.1);

      // Micro-recoil: squash the orb along its aim axis
      let sqX = 1, sqY = 1;
      if (recoilTimerRef.current > 0) {
        recoilTimerRef.current -= delta;
        const t   = Math.max(0, recoilTimerRef.current) / RECOIL_DUR;
        const sq  = 0.60 + t * 0.40; // squash toward 0.60 at peak
        // Apply squash along the fire direction
        const fa  = faceAngleRef.current;
        const cfx = Math.cos(fa), cfy = Math.sin(fa);
        // Decompose into parallel/perpendicular and reconstruct scale
        // Simplified: just use uniform squash pulse (orb is spherical)
        sqX = 0.70 + sq * 0.30;
        sqY = 1.30 - sq * 0.30;
      }
      // Gentle breathing pulse
      const pulse = 1 + Math.sin(time * 4.5) * 0.04;
      groupRef.current.scale.set(ORB_SCALE * sqX * pulse, ORB_SCALE * sqY * pulse, ORB_SCALE);
      groupRef.current.rotation.z = faceAngleRef.current;
    }

    // ── Muzzle flash opacity ──────────────────────────────────────────────
    if (flashRef.current) {
      if (flashTimerRef.current > 0) {
        flashTimerRef.current -= delta;
        const ft = Math.max(0, flashTimerRef.current) / FLASH_DUR;
        flashMatRef.current.opacity = ft * 0.90;
        flashRef.current.scale.setScalar(0.6 + (1 - ft) * 0.5);
      } else {
        flashMatRef.current.opacity = 0;
      }
    }

    // ── Point light pulse ─────────────────────────────────────────────────
    if (lightRef.current) {
      const baseI = 2.5;
      const extraI = recoilTimerRef.current > 0 ? 5.0 : 0;
      lightRef.current.intensity = baseI + extraI + Math.sin(time * 5) * 0.4;
      lightRef.current.position.set(ox, oy, 0.5);
    }

    // ── Energy tether ribbon (player center → orb) ────────────────────────
    const tdx = ox - px, tdy = oy - py;
    const tLen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const tnx  = -tdy / tLen, tny = tdx / tLen;  // perpendicular

    // Taper tether: wider at player, narrow at orb
    const hw0 = TETHER_HW, hw1 = TETHER_HW * 0.35;
    _tetherPts[0]  = px + tnx * hw0;  _tetherPts[1]  = py + tny * hw0;  _tetherPts[2]  = 0;
    _tetherPts[3]  = px - tnx * hw0;  _tetherPts[4]  = py - tny * hw0;  _tetherPts[5]  = 0;
    _tetherPts[6]  = ox + tnx * hw1;  _tetherPts[7]  = oy + tny * hw1;  _tetherPts[8]  = 0;
    _tetherPts[9]  = ox - tnx * hw1;  _tetherPts[10] = oy - tny * hw1;  _tetherPts[11] = 0;
    const posAttr = _tetherGeo.getAttribute("position") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    _tetherGeo.computeBoundingSphere();

    // Pulse tether opacity
    const tetherOp = 0.30 + Math.sin(time * 6) * 0.12;
    _tetherMat.opacity = tetherOp;
  });

  if (!isActive) return null;

  return (
    <>
      {/* Energy tether ribbon — rendered in world space */}
      <mesh geometry={_tetherGeo} material={_tetherMat} />

      {/* Point light (positioned in useFrame) */}
      <pointLight ref={lightRef} color="#22eeff" intensity={2.5} distance={5} decay={2} />

      {/* Drone group (positioned + scaled in useFrame) */}
      <group ref={groupRef}>
        {/* Core sphere */}
        <mesh ref={coreRef} geometry={_droneCoreGeo} material={droneCoreMat} />

        {/* Muzzle flash — born at the "front" of the orb (local +X) */}
        <mesh
          ref={flashRef}
          geometry={_droneFlashGeo}
          material={flashMatRef.current}
          position={[1.4, 0, 0]}
          scale={0.6}
        />

        {/* Inner bright hotspot */}
        <mesh geometry={_droneCoreGeo} scale={0.4}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.80}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  );
}
