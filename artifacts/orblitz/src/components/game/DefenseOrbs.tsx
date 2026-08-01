import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";
import { useAudio } from "@/lib/stores/useAudio";
import { getSkinColors } from "./PlayerOrb";

// ── Constants ──────────────────────────────────────────────────────────────────
const ORBIT_R    = 2.2;
const HIT_R      = 0.8;
const BASE_SPD   = 1.2;    // rad/s normal rotation
const LOW_SPD    = 2.8;    // rad/s when ≤2 orbs remain
const BOB_AMP    = 0.12;
const BOB_FREQ   = 1.8;
const HALF_N     = 30;     // shards per pool (gold / blue)
const N_SHARDS   = HALF_N * 2;
const SHARD_LIFE = 0.55;
const SHOCK_LIFE = 0.42;
const REBAL_SPD  = 3.5;    // rad/s rebalance lerp

// ── Pooled module-level geometry ───────────────────────────────────────────────
const _shardGeo = new THREE.SphereGeometry(0.045, 4, 3);
const _shockGeo = new THREE.RingGeometry(0.8, 1.0, 48);
const _dummy    = new THREE.Object3D();

// ── Shard simulation state (x/y tracked here, not read back from GPU matrix) ──
type Shard = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
};
function makeShard(): Shard { return { x:0, y:0, vx:0, vy:0, life:0, maxLife:SHARD_LIFE }; }

// ── Per-orb visual state (keyed by orb id) ────────────────────────────────────
type OrbState = {
  angle:   number;        // current actual angle (managed here, not in store)
  targetA: number;        // rebalance target angle
  bobSeed: number;        // individual bob phase
  flash:   number;        // 0-1 white flash, decays each frame
  snapX:   number | null; // world-space intercept target X
  snapY:   number | null;
};

// ── Single defence orb mesh ────────────────────────────────────────────────────
function DefenseOrbMesh({
  stateRef,
  aliveCount,
  skinColors,
}: {
  stateRef:   React.MutableRefObject<OrbState>;
  aliveCount: number;
  skinColors: ReturnType<typeof getSkinColors>;
}) {
  const groupRef    = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const coreMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const shellMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef     = useRef<THREE.Mesh>(null);
  const ringMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const playerPos   = useMagicOrb(s => s.playerPosition);

  const isLow     = aliveCount <= 2;
  const pulseFreq = isLow ? 11 : 5;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t  = state.clock.getElapsedTime();
    const os = stateRef.current;
    const px = playerPos[0];
    const py = playerPos[1];
    const bob = Math.sin(t * BOB_FREQ + os.bobSeed) * BOB_AMP;

    let wx: number, wy: number;
    if (os.snapX !== null && os.snapY !== null) {
      const cx = px + Math.cos(os.angle) * ORBIT_R;
      const cy = py + Math.sin(os.angle) * ORBIT_R;
      wx = cx + (os.snapX - cx) * 0.35;
      wy = cy + (os.snapY - cy) * 0.35;
    } else {
      wx = px + Math.cos(os.angle) * ORBIT_R;
      wy = py + Math.sin(os.angle) * ORBIT_R + bob;
    }
    groupRef.current.position.set(wx, wy, 0);

    const fl    = os.flash;
    const pulse = 1 + Math.sin(t * pulseFreq) * (isLow ? 0.2 : 0.08);

    if (coreMeshRef.current) coreMeshRef.current.scale.setScalar(0.32 * pulse);
    if (coreMatRef.current) {
      coreMatRef.current.color.set(fl > 0 ? "#ffffff" : ((skinColors as any).core ?? "#ffffff"));
    }
    if (shellMatRef.current) {
      shellMatRef.current.opacity = 0.52 + Math.sin(t * pulseFreq) * 0.17 + fl * 0.35;
    }
    if (glowMatRef.current) {
      glowMatRef.current.opacity = 0.2 + Math.sin(t * 3.2) * 0.07 + fl * 0.25;
      groupRef.current.children[0]?.scale.setScalar(0.60 + Math.sin(t * 2.5) * 0.04);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (isLow ? 4.5 : 2.0);
    }
    if (ringMatRef.current) {
      ringMatRef.current.opacity = 0.25 + Math.sin(t * pulseFreq * 0.6) * 0.1;
    }

    if (fl > 0) stateRef.current.flash = Math.max(0, fl - 0.04);
  });

  const coreColor = (skinColors as any).core ?? "#ffffff";
  const isRainbow = (skinColors as any).isRainbow;

  return (
    <group ref={groupRef}>
      {/* Outer plasma glow — Plasma Blue */}
      <mesh scale={0.60}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color="#00E5FF"
          transparent opacity={0.20}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Energy shell — Electric Gold */}
      <mesh scale={0.44}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial
          ref={shellMatRef}
          color="#FFD700"
          transparent opacity={0.52}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* White-hot core */}
      <mesh ref={coreMeshRef} scale={0.32}>
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial ref={coreMatRef} color={coreColor} />
      </mesh>

      {/* Spinning energy ring */}
      <mesh ref={ringRef} scale={0.50}>
        <ringGeometry args={[0.65, 1, 14]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={isRainbow ? "#ffffff" : "#00E5FF"}
          transparent opacity={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Centre highlight */}
      <mesh scale={0.12} position={[0, 0, 0.01]}>
        <circleGeometry args={[1, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function DefenseOrbs() {
  const defenseOrbs       = useMagicOrb(s => s.defenseOrbs);
  const darkOrbs          = useMagicOrb(s => s.darkOrbs);
  const playerPosition    = useMagicOrb(s => s.playerPosition);
  const destroyDefenseOrb = useMagicOrb(s => s.destroyDefenseOrb);
  const markOrbDestroying = useMagicOrb(s => s.markOrbDestroying);
  const phase             = useMagicOrb(s => s.phase);
  const addScore          = useMagicOrb(s => s.addScore);
  const health            = useMagicOrb(s => s.health);
  const { equippedSkin }  = useShop();
  const { playHit }       = useAudio();

  const skinColors = useMemo(
    () => getSkinColors(equippedSkin, health),
    [equippedSkin, health],
  );

  // ── Per-orb state map ────────────────────────────────────────────────────────
  // Stored as plain mutable ref-objects (not React.useRef) so we can create them
  // inside useMemo without violating hooks rules.
  const orbStatesRef = useRef<Map<string, React.MutableRefObject<OrbState>>>(new Map());

  useMemo(() => {
    const live = new Set(defenseOrbs.map(o => o.id));
    for (const orb of defenseOrbs) {
      if (!orbStatesRef.current.has(orb.id)) {
        orbStatesRef.current.set(orb.id, {
          current: {
            angle:   orb.angle,
            targetA: orb.angle,
            bobSeed: Math.random() * Math.PI * 2,
            flash:   0,
            snapX:   null,
            snapY:   null,
          },
        });
      }
    }
    for (const id of Array.from(orbStatesRef.current.keys())) {
      if (!live.has(id)) orbStatesRef.current.delete(id);
    }
  }, [defenseOrbs]);

  // ── Tether lines (up to 5 between adjacent orbs) ─────────────────────────────
  const MAX_TETHERS = 5;
  const tethersRef = useRef<{ geo: THREE.BufferGeometry; line: THREE.Line }[]>([]);
  const tethersReady = useRef(false);

  useEffect(() => {
    for (let i = 0; i < MAX_TETHERS; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const mat = new THREE.LineBasicMaterial({
        color: "#00E5FF",
        transparent: true, opacity: 0.30,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      tethersRef.current[i] = { geo, line };
    }
    tethersReady.current = true;
    return () => { tethersRef.current.forEach(t => t.geo.dispose()); };
  }, []);

  // ── Particle pools (two InstancedMeshes: gold + blue) ─────────────────────────
  const [goldMat] = useState(() => new THREE.MeshBasicMaterial({
    color: "#FFD700", transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const [blueMat] = useState(() => new THREE.MeshBasicMaterial({
    color: "#00E5FF", transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const goldRef   = useRef<THREE.InstancedMesh>(null);
  const blueRef   = useRef<THREE.InstancedMesh>(null);
  const shardsRef = useRef<Shard[]>(Array.from({ length: N_SHARDS }, makeShard));

  // ── Shockwave ring ────────────────────────────────────────────────────────────
  const shockRef   = useRef<THREE.Mesh>(null);
  const shockState = useRef({ active: false, x: 0, y: 0, timer: 0 });

  // ── Spawn impact particles + shockwave ───────────────────────────────────────
  function triggerImpact(ix: number, iy: number) {
    const gm = goldRef.current;
    const bm = blueRef.current;
    for (let i = 0; i < N_SHARDS; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 4.5;
      const s   = shardsRef.current[i];
      s.x = ix; s.y = iy;
      s.vx = Math.cos(ang) * spd;
      s.vy = Math.sin(ang) * spd;
      s.life = s.maxLife = SHARD_LIFE;

      _dummy.position.set(ix, iy, 0.05);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      if (i < HALF_N) gm?.setMatrixAt(i,          _dummy.matrix);
      else            bm?.setMatrixAt(i - HALF_N,  _dummy.matrix);
    }
    if (gm) gm.instanceMatrix.needsUpdate = true;
    if (bm) bm.instanceMatrix.needsUpdate = true;
    goldMat.opacity = 1;
    blueMat.opacity = 1;

    shockState.current = { active: true, x: ix, y: iy, timer: SHOCK_LIFE };
  }

  // ── Main frame loop ───────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (phase !== "playing") return;

    const aliveOrbs = defenseOrbs;
    const n         = aliveOrbs.length;
    const px        = playerPosition[0];
    const py        = playerPosition[1];

    if (n === 0) {
      // Hide all tethers
      tethersRef.current.forEach(t => { t.line.visible = false; });
      return;
    }

    const spd = n <= 2 ? LOW_SPD : BASE_SPD;

    // ── Rotate + rebalance angles ────────────────────────────────────────────
    // Sort alive orbs by their current angle so target assignment is stable
    const sorted = aliveOrbs
      .map(o => ({ id: o.id, cur: orbStatesRef.current.get(o.id)?.current.angle ?? 0 }))
      .sort((a, b) => a.cur - b.cur);

    const baseAngle = sorted[0]?.cur ?? 0;
    sorted.forEach((entry, i) => {
      const st = orbStatesRef.current.get(entry.id);
      if (st) st.current.targetA = baseAngle + (i / n) * Math.PI * 2;
    });

    for (const orb of aliveOrbs) {
      const st = orbStatesRef.current.get(orb.id);
      if (!st) continue;
      const s = st.current;

      s.angle += delta * spd;

      // Lerp toward rebalance target
      let diff = s.targetA - s.angle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      s.angle += diff * Math.min(1, REBAL_SPD * delta);
    }

    // ── Collision detection ──────────────────────────────────────────────────
    outerLoop:
    for (const defOrb of aliveOrbs) {
      const st = orbStatesRef.current.get(defOrb.id);
      if (!st) continue;
      const s  = st.current;
      const ox = px + Math.cos(s.angle) * ORBIT_R;
      const oy = py + Math.sin(s.angle) * ORBIT_R;

      for (const dark of darkOrbs) {
        if (dark.destroying) continue;
        const dx   = ox - dark.position[0];
        const dy   = oy - dark.position[1];
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < HIT_R * 1.6) {
          s.snapX = dark.position[0];
          s.snapY = dark.position[1];
        }

        if (dist < HIT_R) {
          s.flash = 1.0;
          triggerImpact(
            (ox + dark.position[0]) * 0.5,
            (oy + dark.position[1]) * 0.5,
          );
          markOrbDestroying(dark.id);
          destroyDefenseOrb(defOrb.id);
          addScore(10);
          playHit();
          break outerLoop;
        }
      }
    }

    // ── Tethers ──────────────────────────────────────────────────────────────
    if (tethersReady.current) {
      for (let i = 0; i < MAX_TETHERS; i++) {
        const t = tethersRef.current[i];
        if (!t) continue;
        if (i < n) {
          const aId  = aliveOrbs[i].id;
          const bId  = aliveOrbs[(i + 1) % n].id;
          const aSt  = orbStatesRef.current.get(aId)?.current;
          const bSt  = orbStatesRef.current.get(bId)?.current;
          if (!aSt || !bSt) { t.line.visible = false; continue; }

          const ax = px + Math.cos(aSt.angle) * ORBIT_R;
          const ay = py + Math.sin(aSt.angle) * ORBIT_R;
          const bx = px + Math.cos(bSt.angle) * ORBIT_R;
          const by = py + Math.sin(bSt.angle) * ORBIT_R;

          const pos = t.geo.attributes.position as THREE.BufferAttribute;
          pos.setXYZ(0, ax, ay, 0);
          pos.setXYZ(1, bx, by, 0);
          pos.needsUpdate = true;
          t.line.visible  = true;

          const lmat    = t.line.material as THREE.LineBasicMaterial;
          lmat.opacity  = 0.22 + Math.sin(Date.now() * 0.003 + i * 1.3) * 0.1;
        } else {
          t.line.visible = false;
        }
      }
    }

    // ── Shard particles ──────────────────────────────────────────────────────
    const gm = goldRef.current;
    const bm = blueRef.current;
    let anyG = false, anyB = false;

    for (let i = 0; i < N_SHARDS; i++) {
      const s = shardsRef.current[i];

      if (s.life <= 0) {
        _dummy.position.set(0, 0, -999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        if (i < HALF_N) gm?.setMatrixAt(i, _dummy.matrix);
        else            bm?.setMatrixAt(i - HALF_N, _dummy.matrix);
        continue;
      }

      s.life -= delta;
      const t    = 1 - s.life / s.maxLife;
      const fade = Math.max(0, 1 - t * t);

      s.x  += s.vx * delta;
      s.y  += s.vy * delta;
      s.vx *= 0.88;
      s.vy *= 0.88;

      _dummy.position.set(s.x, s.y, 0.05);
      _dummy.scale.setScalar(fade);
      _dummy.updateMatrix();

      if (i < HALF_N) { gm?.setMatrixAt(i,         _dummy.matrix); anyG = true; }
      else             { bm?.setMatrixAt(i - HALF_N, _dummy.matrix); anyB = true; }
    }

    if (gm) gm.instanceMatrix.needsUpdate = true;
    if (bm) bm.instanceMatrix.needsUpdate = true;
    goldMat.opacity = anyG ? 1 : 0;
    blueMat.opacity = anyB ? 1 : 0;

    // ── Shockwave ring ────────────────────────────────────────────────────────
    const sw = shockState.current;
    if (sw.active && shockRef.current) {
      sw.timer -= delta;
      if (sw.timer <= 0) {
        sw.active = false;
        shockRef.current.visible = false;
      } else {
        const prog = 1 - sw.timer / SHOCK_LIFE;
        shockRef.current.visible = true;
        shockRef.current.position.set(sw.x, sw.y, 0.02);
        shockRef.current.scale.setScalar(0.5 + prog * 3.8);
        (shockRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.75;
      }
    }
  });

  const aliveCount = defenseOrbs.length;

  return (
    <>
      {/* Tether lines — imperatively updated in useFrame */}
      {tethersRef.current.map((t, i) => (
        <primitive key={`tether-${i}`} object={t.line} />
      ))}

      {/* Per-orb meshes */}
      {defenseOrbs.map(orb => {
        const stRef = orbStatesRef.current.get(orb.id);
        if (!stRef) return null;
        return (
          <DefenseOrbMesh
            key={orb.id}
            stateRef={stRef}
            aliveCount={aliveCount}
            skinColors={skinColors}
          />
        );
      })}

      {/* Gold shard pool (first HALF_N shards) */}
      <instancedMesh
        ref={goldRef}
        args={[_shardGeo, goldMat, HALF_N]}
        frustumCulled={false}
      />

      {/* Blue shard pool (second HALF_N shards) */}
      <instancedMesh
        ref={blueRef}
        args={[_shardGeo, blueMat, HALF_N]}
        frustumCulled={false}
      />

      {/* Expanding shockwave ring */}
      <mesh ref={shockRef} visible={false} frustumCulled={false}>
        <primitive object={_shockGeo} attach="geometry" />
        <meshBasicMaterial
          color="#FFD700"
          transparent opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}
