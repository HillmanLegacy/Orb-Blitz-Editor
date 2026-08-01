import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useShop } from "@/lib/stores/useShop";

// ── Shared geometries (module-level, reused every frame) ──────────────────────
const sharedCircleGeo = new THREE.CircleGeometry(1, 32);
const sharedRingGeo   = new THREE.RingGeometry(0.85, 1, 32);

// Magi-Orb 2 exclusive
const _m2PartGeo  = new THREE.SphereGeometry(0.055, 4, 3);
const _m2DustGeo  = new THREE.SphereGeometry(0.032, 4, 3);
const _m2ShockGeo = new THREE.RingGeometry(0.85, 1.0, 48);
const _m2HexGeo   = new THREE.RingGeometry(0.82, 1.0, 6);
const _m2Dummy    = new THREE.Object3D();

// ── M2 VFX constants ──────────────────────────────────────────────────────────
const N_SA     = 150;   // magenta siphon pool
const N_SB     = 150;   // violet siphon pool
const N_DUST   = 80;
const P1_END   = 0.30;
const P2_START = 0.30;
const P2_END   = 0.90;
const P3_START = 0.90;
const P3_END   = 1.40;
const VFX_END  = 2.10;

type SiphonP = { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; active:boolean };
type DustP   = { x:number; y:number; vx:number; vy:number; life:number; maxLife:number };
const makeSP = (): SiphonP => ({ x:0, y:0, vx:0, vy:0, life:0, maxLife:1.2, active:false });
const makeDP = (): DustP   => ({ x:0, y:0, vx:0, vy:0, life:0, maxLife:1.0 });

export function MagiOrbEffects() {
  const { equippedMagiOrb } = useShop();
  const {
    playerPosition,
    magiOrb2Active,
    magiOrb2TargetPositions,
    boss,
    magiOrb4Active,
    magiOrb4Direction,
    magiOrb5HP,
    magiOrb5MaxHP,
    magiOrb8Position,
    magiOrb8HP,
    pulseShieldActive,
    pulseShieldTimer,
  } = useMagicOrb();

  // ── Existing magi-orb refs ─────────────────────────────────────────────────
  const barrierRef    = useRef<THREE.Group>(null);
  const cubeGroupRef  = useRef<THREE.Group>(null);
  const alliedOrbRef  = useRef<THREE.Group>(null);

  const hasMagiOrb2 = equippedMagiOrb === "magi_orb_2";
  const hasMagiOrb4 = equippedMagiOrb === "magi_orb_4";
  const hasMagiOrb5 = equippedMagiOrb === "magi_orb_5";
  const hasMagiOrb8 = equippedMagiOrb === "magi_orb_8";

  // ── Magi-Orb 2 VFX state ──────────────────────────────────────────────────
  const m2Timer      = useRef(-1);
  const m2PrevActive = useRef(false);
  const m2Captured   = useRef<[number, number, number][]>([]);
  const m2PartsA     = useRef<SiphonP[]>(Array.from({ length: N_SA },   makeSP));
  const m2PartsB     = useRef<SiphonP[]>(Array.from({ length: N_SB },   makeSP));
  const m2Dust       = useRef<DustP[]>(  Array.from({ length: N_DUST }, makeDP));
  const m2DustSpawned = useRef(false);

  // Materials (useState → created once, mutated imperatively each frame)
  const [m2MatA] = useState(() => new THREE.MeshBasicMaterial({
    color: "#FF00FF", transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const [m2MatB] = useState(() => new THREE.MeshBasicMaterial({
    color: "#AA00FF", transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const [m2DustMat] = useState(() => new THREE.MeshBasicMaterial({
    color: "#DD99FF", transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const [m2ShockMat] = useState(() => new THREE.MeshBasicMaterial({
    color: "#FF88FF", transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  const [m2AbsorbMat] = useState(() => new THREE.MeshBasicMaterial({
    color: "#ffffff", transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const [m2FlashMat] = useState(() => new THREE.MeshBasicMaterial({
    color: "#FF00FF", transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  const [m2BossMat1] = useState(() => new THREE.MeshBasicMaterial({
    color: "#FFD700", transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  const [m2BossMat2] = useState(() => new THREE.MeshBasicMaterial({
    color: "#AA00FF", transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  const [m2BossMat3] = useState(() => new THREE.MeshBasicMaterial({
    color: "#FFD700", transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));

  // Mesh refs
  const m2RefA        = useRef<THREE.InstancedMesh>(null);
  const m2RefB        = useRef<THREE.InstancedMesh>(null);
  const m2DustRef     = useRef<THREE.InstancedMesh>(null);
  const m2ShockRef    = useRef<THREE.Mesh>(null);
  const m2AbsorbRef   = useRef<THREE.Mesh>(null);
  const m2FlashRef    = useRef<THREE.Mesh>(null);
  const m2BossGroup   = useRef<THREE.Group>(null);

  // ── Barrier arc points (Magi-Orb 4) ───────────────────────────────────────
  const barrierArcPoints: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI / 2;
    barrierArcPoints.push([Math.cos(a) * 3.5, Math.sin(a) * 3.5]);
  }

  const cubeParticles = Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * Math.PI * 2,
    size:  0.08 + (i % 3) * 0.02,
  }));

  const alliedOrbParticles = Array.from({ length: 6 }, (_, i) => ({
    angle: (i / 6) * Math.PI * 2,
  }));

  // ── useFrame ───────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // ── Magi-Orb 4: barrier ────────────────────────────────────────────────
    if (barrierRef.current && magiOrb4Active) {
      barrierRef.current.rotation.z = magiOrb4Direction;
      barrierRef.current.position.set(playerPosition[0], playerPosition[1], 0.1);
    }

    // ── Magi-Orb 5: cube ───────────────────────────────────────────────────
    if (cubeGroupRef.current && hasMagiOrb5 && magiOrb5HP > 0) {
      cubeGroupRef.current.rotation.z = time * 0.3;
      cubeGroupRef.current.position.set(playerPosition[0], playerPosition[1], 0);
      const hr = magiOrb5HP / magiOrb5MaxHP;
      cubeGroupRef.current.scale.setScalar(0.9 + hr * 0.3);
    }

    // ── Magi-Orb 8: allied orb ─────────────────────────────────────────────
    if (alliedOrbRef.current && magiOrb8Position && magiOrb8HP > 0) {
      alliedOrbRef.current.position.set(magiOrb8Position[0], magiOrb8Position[1], 0);
    }

    // ── Magi-Orb 2: Arcane Annihilator VFX ───────────────────────────────
    if (!hasMagiOrb2) return;

    const wasActive = m2PrevActive.current;
    m2PrevActive.current = magiOrb2Active;

    // Activation edge: spawn siphon particles
    if (magiOrb2Active && !wasActive) {
      m2Timer.current  = 0;
      m2DustSpawned.current = false;
      m2Captured.current = magiOrb2TargetPositions.length > 0
        ? magiOrb2TargetPositions.map(p => [p[0], p[1], p[2]] as [number, number, number])
        : [];

      const positions = m2Captured.current;
      const nOrbs = positions.length;

      // Spawn pool A (magenta)
      for (let i = 0; i < N_SA; i++) {
        const p = m2PartsA.current[i];
        if (nOrbs === 0) { p.active = false; continue; }
        const src = positions[i % nOrbs];
        const ang  = Math.random() * Math.PI * 2;
        const spd  = 0.3 + Math.random() * 0.5;
        p.x   = src[0] + (Math.random() - 0.5) * 0.2;
        p.y   = src[1] + (Math.random() - 0.5) * 0.2;
        p.vx  = Math.cos(ang) * spd;
        p.vy  = Math.sin(ang) * spd;
        p.life    = p.maxLife;
        p.active  = true;
      }

      // Spawn pool B (violet)
      for (let i = 0; i < N_SB; i++) {
        const p = m2PartsB.current[i];
        if (nOrbs === 0) { p.active = false; continue; }
        const src = positions[i % nOrbs];
        const ang  = Math.random() * Math.PI * 2;
        const spd  = 0.2 + Math.random() * 0.6;
        p.x   = src[0] + (Math.random() - 0.5) * 0.25;
        p.y   = src[1] + (Math.random() - 0.5) * 0.25;
        p.vx  = Math.cos(ang) * spd;
        p.vy  = Math.sin(ang) * spd;
        p.life    = p.maxLife;
        p.active  = true;
      }
    }

    const pt = m2Timer.current;
    if (pt < 0) {
      // VFX inactive — hide everything
      if (m2RefA.current)     m2RefA.current.count     = 0;
      if (m2RefB.current)     m2RefB.current.count     = 0;
      if (m2DustRef.current)  m2DustRef.current.count  = 0;
      m2ShockMat.opacity  = 0;
      m2AbsorbMat.opacity = 0;
      m2FlashMat.opacity  = 0;
      m2BossMat1.opacity  = 0;
      m2BossMat2.opacity  = 0;
      m2BossMat3.opacity  = 0;
      return;
    }

    m2Timer.current += delta;

    // ── Player flash ring (Phase 1) ───────────────────────────────────────
    if (m2FlashRef.current) {
      m2FlashRef.current.position.set(playerPosition[0], playerPosition[1], 0.15);
      if (pt < P1_END) {
        const prog = pt / P1_END;
        const flicker = 0.5 + Math.sin(time * 40) * 0.5;
        m2FlashMat.opacity = (1 - prog * 0.3) * flicker * 0.85;
        const sc = 1.0 + prog * 0.8 + Math.sin(time * 30) * 0.15;
        m2FlashRef.current.scale.setScalar(sc);
      } else if (pt < P2_END) {
        const fade = 1 - (pt - P1_END) / (P2_END - P1_END);
        m2FlashMat.opacity = fade * 0.4;
        m2FlashRef.current.scale.setScalar(1.8 + (1 - fade) * 0.5);
      } else {
        m2FlashMat.opacity = 0;
      }
    }

    // ── Shockwave ring (Phase 2) ──────────────────────────────────────────
    if (m2ShockRef.current) {
      m2ShockRef.current.position.set(playerPosition[0], playerPosition[1], 0.05);
      if (pt >= P2_START && pt < P2_END) {
        const prog = (pt - P2_START) / (P2_END - P2_START);
        m2ShockRef.current.scale.setScalar(0.5 + prog * 11);
        m2ShockMat.opacity = (1 - prog) * 0.9;
      } else {
        m2ShockMat.opacity = 0;
      }
    }

    // ── Absorption flash (Phase 3) ────────────────────────────────────────
    if (m2AbsorbRef.current) {
      m2AbsorbRef.current.position.set(playerPosition[0], playerPosition[1], 0.2);
      if (pt >= P3_START && pt < P3_END) {
        const prog = (pt - P3_START) / (P3_END - P3_START);
        m2AbsorbRef.current.scale.setScalar((1 - prog) * 3.5 + 0.2);
        m2AbsorbMat.opacity = (1 - prog) * 0.95;
      } else {
        m2AbsorbMat.opacity = 0;
      }
    }

    // ── Boss shield shimmer (Phase 1-2, if boss present) ──────────────────
    if (m2BossGroup.current) {
      const bossActive = boss && pt >= 0 && pt < P2_END;
      if (bossActive && boss) {
        m2BossGroup.current.visible = true;
        m2BossGroup.current.position.set(boss.position[0], boss.position[1], 0.08);
        const flicker  = 0.4 + Math.sin(time * 28) * 0.4;
        const altFlick = 0.4 + Math.sin(time * 28 + Math.PI) * 0.4;
        m2BossMat1.opacity = flicker  * 0.75;
        m2BossMat2.opacity = altFlick * 0.65;
        m2BossMat3.opacity = flicker  * 0.55;
      } else {
        m2BossGroup.current.visible = false;
        m2BossMat1.opacity = 0;
        m2BossMat2.opacity = 0;
        m2BossMat3.opacity = 0;
      }
    }

    // ── Siphon particle physics ───────────────────────────────────────────
    const px = playerPosition[0];
    const py = playerPosition[1];

    // Pull ramp: 0 during Phase 1, ramps to 14 by end of Phase 2
    const pullRamp = pt < P2_START
      ? 0
      : Math.min(1, (pt - P2_START) / (P2_END - P2_START));
    const pullStr  = pullRamp * 14;
    const swirlStr = 3.5;

    const updateParticles = (pool: SiphonP[], mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      let count = 0;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active || p.life <= 0) continue;

        p.life -= delta;

        // Physics toward player
        const dx   = px - p.x;
        const dy   = py - p.y;
        const dist = Math.max(0.05, Math.sqrt(dx * dx + dy * dy));
        const nx   = dx / dist;
        const ny   = dy / dist;
        // Swirl perpendicular to pull
        const sx   = -ny;
        const sy   =  nx;

        p.vx += (nx * pullStr + sx * swirlStr) * delta;
        p.vy += (ny * pullStr + sy * swirlStr) * delta;
        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x  += p.vx * delta;
        p.y  += p.vy * delta;

        // Absorbed by player
        if (dist < 0.35) { p.active = false; continue; }

        const lifeFrac = Math.max(0, p.life / p.maxLife);
        // Fade in 0-0.15s, full, fade out last 0.25s
        const fadeIn  = Math.min(1, p.life > p.maxLife - 0.15 ? (p.maxLife - p.life) / 0.15 : 1);
        const fadeOut = Math.min(1, p.life / 0.25);
        const sc      = Math.max(0.02, fadeIn * fadeOut * (0.5 + lifeFrac * 0.6));

        _m2Dummy.position.set(p.x, p.y, 0.1);
        _m2Dummy.scale.setScalar(sc);
        _m2Dummy.updateMatrix();
        mesh.setMatrixAt(count++, _m2Dummy.matrix);
      }
      mesh.count = count;
      if (count > 0) mesh.instanceMatrix.needsUpdate = true;
    };

    updateParticles(m2PartsA.current, m2RefA.current);
    updateParticles(m2PartsB.current, m2RefB.current);

    // ── Lingering arcane dust (Phase 3+) ──────────────────────────────────
    if (pt >= P3_START && !m2DustSpawned.current) {
      m2DustSpawned.current = true;
      for (let i = 0; i < N_DUST; i++) {
        const d     = m2Dust.current[i];
        const ang   = Math.random() * Math.PI * 2;
        const spd   = 0.3 + Math.random() * 1.2;
        d.x         = px;
        d.y         = py;
        d.vx        = Math.cos(ang) * spd;
        d.vy        = Math.sin(ang) * spd;
        d.life      = d.maxLife;
      }
    }

    if (m2DustRef.current) {
      let dCount = 0;
      for (let i = 0; i < N_DUST; i++) {
        const d = m2Dust.current[i];
        if (d.life <= 0) continue;
        d.life -= delta;
        d.vx   *= 0.95;
        d.vy   *= 0.95;
        d.x    += d.vx * delta;
        d.y    += d.vy * delta;
        const lifeFrac = Math.max(0, d.life / d.maxLife);
        _m2Dummy.position.set(d.x, d.y, 0.08);
        _m2Dummy.scale.setScalar(Math.max(0.01, lifeFrac * 0.9));
        _m2Dummy.updateMatrix();
        m2DustRef.current.setMatrixAt(dCount++, _m2Dummy.matrix);
      }
      m2DustRef.current.count = dCount;
      if (dCount > 0) m2DustRef.current.instanceMatrix.needsUpdate = true;
    }

    // Reset VFX after sequence finishes
    if (pt > VFX_END) {
      m2Timer.current = -1;
    }
  });

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Magi-Orb 4: HD Barrier Shield ─────────────────────────────────── */}
      {hasMagiOrb4 && magiOrb4Active && (
        <group ref={barrierRef} position={[playerPosition[0], playerPosition[1], 0.1]}>
          {[0, 1, 2].map((layer) => (
            <mesh key={`barrier-layer-${layer}`} position={[0, 0, layer * 0.01]}>
              <shapeGeometry args={[(() => {
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                barrierArcPoints.forEach((p, i) => {
                  const radius = 3.5 - layer * 0.3;
                  const scale  = radius / 3.5;
                  if (i === 0) shape.lineTo(p[0] * scale, p[1] * scale);
                  else         shape.lineTo(p[0] * scale, p[1] * scale);
                });
                shape.lineTo(0, 0);
                return shape;
              })()]} />
              <meshBasicMaterial
                color={layer === 0 ? "#ff6600" : layer === 1 ? "#ff8800" : "#ffaa00"}
                transparent opacity={0.5 - layer * 0.12}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {barrierArcPoints.map((point, i) => {
            if (i % 4 !== 0) return null;
            return (
              <mesh key={`arc-glow-${i}`} position={[point[0], point[1], 0.02]} scale={0.12}>
                <circleGeometry args={[1, 12]} />
                <meshBasicMaterial color="#ffcc00" transparent opacity={0.7} />
              </mesh>
            );
          })}
          {barrierArcPoints.filter((_, i) => i % 6 === 0).map((point, i) => (
            <mesh key={`arc-particle-${i}`} position={[point[0] * 0.95, point[1] * 0.95, 0.03]} scale={0.06}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
            </mesh>
          ))}
          {barrierArcPoints.map((point, i) => {
            if (i % 2 !== 0) return null;
            return (
              <mesh key={`inner-line-${i}`} position={[point[0] * 0.85, point[1] * 0.85, 0.01]} scale={0.04}>
                <circleGeometry args={[1, 6]} />
                <meshBasicMaterial color="#ffff88" transparent opacity={0.6} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* ── Magi-Orb 5: HD Protective Cube ────────────────────────────────── */}
      {hasMagiOrb5 && magiOrb5HP > 0 && (
        <group ref={cubeGroupRef} position={[playerPosition[0], playerPosition[1], 0]}>
          {[0, 1, 2].map((layer) => {
            const healthRatio = magiOrb5HP / magiOrb5MaxHP;
            return (
              <mesh key={`cube-layer-${layer}`} rotation={[0, 0, layer * Math.PI / 6]} scale={1.8 - layer * 0.25}>
                <ringGeometry args={[0.85, 1, 6]} />
                <meshBasicMaterial
                  color={layer === 0 ? "#00ffff" : layer === 1 ? "#00ccff" : "#0088ff"}
                  transparent opacity={(0.5 + healthRatio * 0.3) * (1 - layer * 0.2)}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
          <mesh scale={0.6}>
            <circleGeometry args={[1, 6]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.4} />
          </mesh>
          <mesh scale={0.4}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#88ffff" transparent opacity={0.6} />
          </mesh>
          {cubeParticles.map((particle, i) => (
            <mesh
              key={`cube-particle-${i}`}
              position={[Math.cos(particle.angle) * 1.6, Math.sin(particle.angle) * 1.6, 0.01]}
              scale={particle.size}
            >
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
          ))}
          {Array.from({ length: magiOrb5MaxHP }).map((_, i) => {
            const segmentAngle = (i / magiOrb5MaxHP) * Math.PI * 2 - Math.PI / 2;
            const isActive = i < magiOrb5HP;
            return (
              <mesh
                key={`hp-${i}`}
                position={[Math.cos(segmentAngle) * 2.1, Math.sin(segmentAngle) * 2.1, 0.02]}
                scale={0.15}
              >
                <circleGeometry args={[1, 8]} />
                <meshBasicMaterial color={isActive ? "#00ff88" : "#333333"} transparent opacity={isActive ? 0.9 : 0.4} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* ── Magi-Orb 8: HD Allied Orb ─────────────────────────────────────── */}
      {hasMagiOrb8 && magiOrb8Position && magiOrb8HP > 0 && (
        <group ref={alliedOrbRef} position={[magiOrb8Position[0], magiOrb8Position[1], 0]}>
          <mesh scale={0.7}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.15} />
          </mesh>
          <mesh scale={0.55}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#44ff44" transparent opacity={0.25} />
          </mesh>
          <mesh scale={0.42} position={[0, 0, 0.01]}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh scale={0.35} position={[0, 0, 0.02]}>
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#88ff88" />
          </mesh>
          <mesh scale={0.2} position={[0, 0, 0.03]}>
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color="#aaffaa" transparent opacity={0.9} />
          </mesh>
          <mesh scale={0.1} position={[-0.08, 0.08, 0.04]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
          {alliedOrbParticles.map((particle, i) => (
            <mesh
              key={`ally-particle-${i}`}
              position={[Math.cos(particle.angle) * 0.5, Math.sin(particle.angle) * 0.5, 0.02]}
              scale={0.04}
            >
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color="#ccffcc" transparent opacity={0.8} />
            </mesh>
          ))}
          {Array.from({ length: 3 }).map((_, i) => {
            const angle    = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const isActive = i < magiOrb8HP;
            return (
              <mesh
                key={`ally-hp-${i}`}
                position={[Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0.03]}
                scale={0.06}
              >
                <circleGeometry args={[1, 8]} />
                <meshBasicMaterial color={isActive ? "#00ff88" : "#444444"} transparent opacity={isActive ? 0.9 : 0.5} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* ── Magi-Orb 2: Arcane Annihilator VFX ───────────────────────────── */}
      {hasMagiOrb2 && (
        <>
          {/* Siphon particle pool A — magenta */}
          <instancedMesh ref={m2RefA} args={[_m2PartGeo, m2MatA, N_SA]} frustumCulled={false} />

          {/* Siphon particle pool B — violet */}
          <instancedMesh ref={m2RefB} args={[_m2PartGeo, m2MatB, N_SB]} frustumCulled={false} />

          {/* Lingering arcane dust */}
          <instancedMesh ref={m2DustRef} args={[_m2DustGeo, m2DustMat, N_DUST]} frustumCulled={false} />

          {/* Expanding shockwave ring (Phase 2) */}
          <mesh ref={m2ShockRef} position={[playerPosition[0], playerPosition[1], 0.05]}>
            <primitive object={_m2ShockGeo} attach="geometry" />
            <primitive object={m2ShockMat}  attach="material" />
          </mesh>

          {/* Absorption flash burst (Phase 3) */}
          <mesh ref={m2AbsorbRef} position={[playerPosition[0], playerPosition[1], 0.2]}>
            <circleGeometry args={[1, 32]} />
            <primitive object={m2AbsorbMat} attach="material" />
          </mesh>

          {/* Player flash ring (Phase 1) */}
          <mesh ref={m2FlashRef} position={[playerPosition[0], playerPosition[1], 0.15]}>
            <ringGeometry args={[0.7, 1, 32]} />
            <primitive object={m2FlashMat} attach="material" />
          </mesh>

          {/* Boss immune-shield shimmer (Phase 1-2, positioned imperatively) */}
          <group ref={m2BossGroup} visible={false}>
            {/* Outer hex ring — gold */}
            <mesh scale={2.5}>
              <primitive object={_m2HexGeo} attach="geometry" />
              <primitive object={m2BossMat1} attach="material" />
            </mesh>
            {/* Mid hex ring — violet, rotated 30° */}
            <mesh scale={2.0} rotation={[0, 0, Math.PI / 6]}>
              <primitive object={_m2HexGeo} attach="geometry" />
              <primitive object={m2BossMat2} attach="material" />
            </mesh>
            {/* Inner hex ring — gold */}
            <mesh scale={1.5}>
              <primitive object={_m2HexGeo} attach="geometry" />
              <primitive object={m2BossMat3} attach="material" />
            </mesh>
          </group>
        </>
      )}

      {/* ── Pulse Shield VFX ──────────────────────────────────────────────── */}
      {pulseShieldActive && (
        <group position={[playerPosition[0], playerPosition[1], 0.2]}>
          {[0, 1, 2].map((i) => {
            const progress = 1 - pulseShieldTimer / 0.5;
            const scale    = 7 * (0.3 + progress * 0.7) - i * 0.5;
            const opacity  = (1 - progress) * (0.8 - i * 0.2);
            return (
              <mesh key={`pulse-ring-${i}`} scale={scale} position={[0, 0, -i * 0.01]}>
                <ringGeometry args={[0.9, 1, 32]} />
                <meshBasicMaterial
                  color={i === 0 ? "#00ffff" : i === 1 ? "#0088ff" : "#ffffff"}
                  transparent opacity={opacity}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
          <mesh scale={7 * (1 - pulseShieldTimer / 0.5) * 0.3}>
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={(pulseShieldTimer / 0.5) * 0.4} />
          </mesh>
          <mesh scale={7 * 1.1}>
            <ringGeometry args={[0.95, 1.05, 32]} />
            <meshBasicMaterial color="#00ccff" transparent opacity={(pulseShieldTimer / 0.5) * 0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </>
  );
}
