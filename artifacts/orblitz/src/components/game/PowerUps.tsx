import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, PowerUp, PowerUpType } from "@/lib/stores/useMagicOrb";
import { balanceTelemetry } from "@/game-runtime/BalanceTelemetry";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import {
  POWER_UP_DESTROY_DURATION,
  POWER_UP_HURT_DURATION,
} from "@/game-runtime/PowerUpRuntime";

// ── Constants ─────────────────────────────────────────────────────────────────
const HURT_DUR    = POWER_UP_HURT_DURATION;
const DESTROY_DUR = POWER_UP_DESTROY_DURATION;

// ── Teleport-out VFX ─────────────────────────────────────────────────────────
// 28 color-matched particles burst outward then arc toward the player at [0,0,0]
const _PUTVFX_N    = 28;
const _putvfxDummy = new THREE.Object3D();
const _putvfxColor = new THREE.Color();
const _putvfxGeo   = new THREE.SphereGeometry(1, 5, 4);
const _putvfxWhite = new THREE.Color("#ffffff");

interface _PUTParticle {
  angle: number; burstSpd: number;
  size: number; colorT: number; delay: number;
}

function PowerUpTeleportVFX({
  startPos, primaryColor, accentColor,
}: {
  startPos: [number, number, number];
  primaryColor: string;
  accentColor: string;
}) {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const bornRef  = useRef<number | null>(null);
  const primC    = useMemo(() => new THREE.Color(primaryColor), [primaryColor]);
  const accentC  = useMemo(() => new THREE.Color(accentColor),  [accentColor]);

  const particles = useMemo<_PUTParticle[]>(() =>
    Array.from({ length: _PUTVFX_N }, (_, i) => ({
      angle:    (i / _PUTVFX_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      burstSpd: 1.8 + Math.random() * 2.8,
      size:     0.055 + Math.random() * 0.09,
      colorT:   Math.random(),
      delay:    Math.random() * 0.12,
    }))
  , []);

  const [mat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();
    const age = clock.getElapsedTime() - bornRef.current;
    const im  = meshRef.current;
    if (!im) return;

    const [sx, sy, sz] = startPos;
    const BURST_END = 0.28;

    for (let i = 0; i < _PUTVFX_N; i++) {
      const p  = particles[i];
      const pt = Math.max(0, Math.min((age - p.delay) / (DESTROY_DUR - p.delay), 1));

      if (pt <= 0) {
        _putvfxDummy.scale.setScalar(0);
        _putvfxDummy.updateMatrix();
        im.setMatrixAt(i, _putvfxDummy.matrix);
        continue;
      }

      let px: number, py: number, pz: number;

      if (pt < BURST_END) {
        // Phase 1 — burst outward
        const easeOut  = 1 - (1 - pt / BURST_END) ** 2;
        const burstDst = p.burstSpd * easeOut * 0.55;
        px = sx + Math.cos(p.angle) * burstDst;
        py = sy + Math.sin(p.angle) * burstDst;
        pz = sz;
      } else {
        // Phase 2 — streak toward player at [0,0,0]
        const st      = (pt - BURST_END) / (1 - BURST_END);
        const easeIn  = st ** 1.6;
        const burstDst = p.burstSpd * 0.55;
        const bx = sx + Math.cos(p.angle) * burstDst;
        const by = sy + Math.sin(p.angle) * burstDst;
        px = bx * (1 - easeIn);
        py = by * (1 - easeIn);
        pz = sz  * (1 - easeIn);
      }

      const fadeOut   = pt > 0.75 ? 1 - (pt - 0.75) / 0.25 : 1.0;
      const sizeScale = p.size * (0.4 + 0.6 * (1 - pt * 0.6)) * fadeOut;

      _putvfxDummy.position.set(px, py, pz);
      _putvfxDummy.scale.setScalar(Math.max(0, sizeScale));
      _putvfxDummy.updateMatrix();
      im.setMatrixAt(i, _putvfxDummy.matrix);

      // White flash → primary → accent as progress increases
      const cP = Math.min(pt * 3.5, 1);
      if (p.colorT < 0.5) {
        _putvfxColor.lerpColors(_putvfxWhite, primC,   Math.min(cP * 2, 1));
      } else {
        _putvfxColor.lerpColors(_putvfxWhite, accentC, Math.min(cP * 2, 1));
      }
      im.setColorAt(i, _putvfxColor);
    }

    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[_putvfxGeo, mat, _PUTVFX_N]} frustumCulled={false} />
  );
}

// ── Shield formation VFX — 80 tiny cyan particles converge to shield surface ──
const _SFX_N    = 80;
const _sfxDummy = new THREE.Object3D();
const _sfxColor = new THREE.Color();
const _sfxPal   = [
  new THREE.Color("#00ddff"), // cyan  — matches shield icon primary
  new THREE.Color("#0099ff"), // ice-blue
  new THREE.Color("#ffffff"), // white flash
];
const _sfxGeo   = new THREE.SphereGeometry(1, 4, 3);

interface _SFXParticle {
  burstAngle: number; burstSpd: number;
  size: number; colorT: number; delay: number;
  tx: number; ty: number; tz: number; // target on shield sphere surface
}

function ShieldFormVFX({ startPos }: { startPos: [number, number, number] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bornRef = useRef<number | null>(null);

  const particles = useMemo<_SFXParticle[]>(() => {
    // Compute shield radius from current player health
    const { health, maxHealth } = useMagicOrb.getState();
    const hR     = Math.max(0, health) / Math.max(1, maxHealth);
    const pScale = 0.432 + (0.72 - 0.432) * hR;
    const r      = pScale * 2.5;

    return Array.from({ length: _SFX_N }, (_, i) => {
      // Uniform random point on unit sphere → target position on shield surface
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      return {
        burstAngle: (i / _SFX_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.7,
        burstSpd:   1.1 + Math.random() * 1.6,
        size:       0.011 + Math.random() * 0.014, // tiny
        colorT:     Math.random(),
        delay:      Math.random() * 0.06,
        tx: Math.sin(phi) * Math.cos(theta) * r,
        ty: Math.cos(phi) * r,
        tz: Math.sin(phi) * Math.sin(theta) * r,
      };
    });
  }, []);

  const [mat] = useState(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    if (bornRef.current === null) bornRef.current = clock.getElapsedTime();
    const age = clock.getElapsedTime() - bornRef.current;
    const im  = meshRef.current;
    if (!im) return;

    const [sx, sy, sz] = startPos;
    const BURST_END     = 0.26;

    // Stay fully opaque until the very last 8% — particles are AT the shield surface
    const gProgress = Math.min(1, age / DESTROY_DUR);
    mat.opacity      = gProgress > 0.97 ? Math.max(0, 1 - (gProgress - 0.97) / 0.03) : 0.95;

    for (let i = 0; i < _SFX_N; i++) {
      const p  = particles[i];
      const pt = Math.max(0, Math.min((age - p.delay) / (DESTROY_DUR - p.delay), 1));

      if (pt <= 0) {
        _sfxDummy.scale.setScalar(0); _sfxDummy.updateMatrix();
        im.setMatrixAt(i, _sfxDummy.matrix); continue;
      }

      const maxBurst = p.burstSpd * 0.44;
      const bx = sx + Math.cos(p.burstAngle) * maxBurst;
      const by = sy + Math.sin(p.burstAngle) * maxBurst;
      let px: number, py: number, pz: number;

      if (pt < BURST_END) {
        // Phase 1 — burst outward from power-up position
        const eOut = 1 - Math.pow(1 - pt / BURST_END, 2);
        px = sx + (bx - sx) * eOut;
        py = sy + (by - sy) * eOut;
        pz = sz;
      } else {
        // Phase 2 — stream toward assigned point on the shield sphere surface
        const st  = (pt - BURST_END) / (1 - BURST_END);
        const eIn = Math.pow(st, 1.9);
        px = bx + (p.tx - bx) * eIn;
        py = by + (p.ty - by) * eIn;
        pz = sz + (p.tz - sz) * eIn;
      }

      _sfxDummy.position.set(px, py, pz);
      _sfxDummy.scale.setScalar(p.size);
      _sfxDummy.updateMatrix();
      im.setMatrixAt(i, _sfxDummy.matrix);

      const ct = Math.min(pt * 2.2, 1);
      if (p.colorT < 0.5) _sfxColor.lerpColors(_sfxPal[0], _sfxPal[1], ct);
      else                  _sfxColor.lerpColors(_sfxPal[1], _sfxPal[2], ct);
      im.setColorAt(i, _sfxColor);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[_sfxGeo, mat, _SFX_N]} frustumCulled={false} />
  );
}

// ── Per-power-up mesh ─────────────────────────────────────────────────────────
function PowerUpMesh({ powerUp }: { powerUp: PowerUp }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const runtime = gameRuntime.powerUps.get(powerUp.id);
    const group = groupRef.current;
    if (!runtime || !group) return;
    const time = clock.getElapsedTime();
    const collectProgress = runtime.collected ? 1 - Math.max(0, runtime.collectTimer) / 0.4 : 0;
    const bobY = Math.sin(time * 4) * 0.15;
    const floatRotation = Math.sin(time * 2) * 0.1;
    const pulseScale = 1 + Math.sin(time * 6) * 0.1;
    const hurtFlash = runtime.hurtTimer > 0 ? runtime.hurtTimer / HURT_DUR : 0;
    group.position.set(
      runtime.position[0],
      runtime.position[1] + bobY,
      runtime.position[2],
    );
    group.rotation.z = floatRotation;
    group.scale.setScalar(
      runtime.collected
        ? 1 + collectProgress * 2
        : (hurtFlash > 0.5 ? 1.15 : pulseScale),
    );
  });

  const runtime = gameRuntime.powerUps.get(powerUp.id);
  const renderedPosition = runtime?.position ?? powerUp.position;
  const collectProgress = runtime?.collected ? 1 - Math.max(0, runtime.collectTimer) / 0.4 : 0;
  const opacity = runtime?.collected ? 1 - collectProgress : 1;
  const hurtFlash = runtime?.hurtTimer ? runtime.hurtTimer / HURT_DUR : 0;

  const getColors = (type: PowerUpType) => {
    switch (type) {
      case "chargeBeam":
        return { primary: "#ffdd00", secondary: "#ffffff", glow: "#ffaa00", bg: "#ff8800" };
      case "shield":
        return { primary: "#00ddff", secondary: "#ffffff", glow: "#0099ff", bg: "#0066cc" };
      case "healing":
        return { primary: "#00ff77", secondary: "#ffffff", glow: "#00cc55", bg: "#008833" };
      case "doubleCoins":
        return { primary: "#ffd700", secondary: "#ffee88", glow: "#ffcc00", bg: "#cc9900" };
      case "rapidFire":
        return { primary: "#ff4422", secondary: "#ffaa88", glow: "#ff6600", bg: "#cc2200" };
      default:
        return { primary: "#ffffff", secondary: "#dddddd", glow: "#aaaaaa", bg: "#666666" };
    }
  };

  const colors = getColors(powerUp.type);

  // While destroying → show teleport VFX at world root so particle world-space
  // coordinates (startPos → player at [0,0,0]) are computed correctly.
  if (powerUp.destroying) {
    if (powerUp.type === "shield") {
      return (
        <>
          <pointLight position={renderedPosition} color={colors.glow} intensity={4} distance={7} decay={2} />
          <ShieldFormVFX startPos={renderedPosition} />
        </>
      );
    }
    return (
      <>
        <pointLight
          position={renderedPosition}
          color={colors.glow}
          intensity={4}
          distance={7}
          decay={2}
        />
        <PowerUpTeleportVFX
          startPos={renderedPosition}
          primaryColor={colors.primary}
          accentColor={colors.glow}
        />
      </>
    );
  }

  const renderIcon = () => {
    const scale = 1.8;
    const op = hurtFlash > 0.5 ? 1 : opacity; // keep visible during hurt

    switch (powerUp.type) {
      case "chargeBeam":
        return (
          <group scale={scale}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.5, 0.12]} />
              <meshBasicMaterial color={hurtFlash > 0.5 ? "#ffffff" : colors.primary} transparent opacity={op} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0, 0.01]}>
              <planeGeometry args={[0.4, 0.06]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op} />
            </mesh>
            <mesh position={[0.15, 0.15, 0.02]} scale={0.08}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op} />
            </mesh>
            <mesh position={[0.22, 0.08, 0.02]} scale={0.05}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={op * 0.8} />
            </mesh>
            <mesh position={[-0.1, -0.1, 0.02]} scale={0.04}>
              <circleGeometry args={[1, 6]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op * 0.6} />
            </mesh>
          </group>
        );

      case "shield":
        return (
          <group scale={scale}>
            <mesh>
              <ringGeometry args={[0.18, 0.28, 16]} />
              <meshBasicMaterial color={hurtFlash > 0.5 ? "#ffffff" : colors.primary} transparent opacity={op} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.21, 0.25, 16]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op * 0.8} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.02]} scale={0.12}>
              <circleGeometry args={[1, 8]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op} />
            </mesh>
          </group>
        );

      case "healing":
        return (
          <group scale={scale}>
            <mesh>
              <planeGeometry args={[0.4, 0.14]} />
              <meshBasicMaterial color={hurtFlash > 0.5 ? "#ffffff" : colors.primary} transparent opacity={op} />
            </mesh>
            <mesh>
              <planeGeometry args={[0.14, 0.4]} />
              <meshBasicMaterial color={hurtFlash > 0.5 ? "#ffffff" : colors.primary} transparent opacity={op} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.32, 0.08]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op * 0.9} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.08, 0.32]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op * 0.9} />
            </mesh>
          </group>
        );

      case "doubleCoins":
        return (
          <group scale={scale}>
            <mesh>
              <circleGeometry args={[0.22, 16]} />
              <meshBasicMaterial color={hurtFlash > 0.5 ? "#ffffff" : colors.primary} transparent opacity={op} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <circleGeometry args={[0.17, 16]} />
              <meshBasicMaterial color={colors.bg} transparent opacity={op} />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <circleGeometry args={[0.13, 16]} />
              <meshBasicMaterial color={colors.secondary} transparent opacity={op} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[0.04, 0.16]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={op} />
            </mesh>
            <mesh position={[0, 0.05, 0.03]}>
              <planeGeometry args={[0.1, 0.04]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={op} />
            </mesh>
            <mesh position={[0, -0.05, 0.03]}>
              <planeGeometry args={[0.1, 0.04]} />
              <meshBasicMaterial color={colors.primary} transparent opacity={op} />
            </mesh>
          </group>
        );

      case "rapidFire":
        return (
          <group scale={scale}>
            {[-1, 0, 1].map((i) => (
              <group key={i} position={[i * 0.1, 0, 0]}>
                <mesh position={[0, 0.05, 0]}>
                  <planeGeometry args={[0.08, 0.3]} />
                  <meshBasicMaterial color={hurtFlash > 0.5 ? "#ffffff" : colors.primary} transparent opacity={op} />
                </mesh>
                <mesh position={[0, 0.05, 0.01]}>
                  <planeGeometry args={[0.04, 0.24]} />
                  <meshBasicMaterial color={colors.secondary} transparent opacity={op * 0.8} />
                </mesh>
                <mesh position={[0, 0.22, 0.02]} scale={0.04}>
                  <circleGeometry args={[1, 4]} />
                  <meshBasicMaterial color={colors.secondary} transparent opacity={op} />
                </mesh>
              </group>
            ))}
          </group>
        );

      default:
        return null;
    }
  };

  return (
    <group
      ref={groupRef}
      position={renderedPosition}
    >
      {!powerUp.collected && (
        <pointLight
          color={hurtFlash > 0.5 ? "#ffffff" : colors.glow}
          intensity={hurtFlash > 0.5 ? 6 : 2.5}
          distance={5}
          decay={2}
        />
      )}

      <mesh scale={1.2} position={[0, 0, -0.05]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial
          color={hurtFlash > 0.5 ? "#ffffff" : colors.glow}
          transparent opacity={0.3 * opacity}
        />
      </mesh>

      <mesh scale={1.0} position={[0, 0, -0.04]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial
          color={hurtFlash > 0.5 ? "#ffffff" : colors.glow}
          transparent opacity={0.5 * opacity}
        />
      </mesh>

      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#111122" transparent opacity={0.9 * opacity} />
      </mesh>

      <mesh position={[0, 0, -0.01]}>
        <ringGeometry args={[0.4, 0.48, 24]} />
        <meshBasicMaterial
          color={hurtFlash > 0.5 ? "#ffffff" : colors.primary}
          transparent opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {renderIcon()}

      {powerUp.collected && (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = collectProgress * 1.5;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * dist, Math.sin(angle) * dist, 0.1]}
                scale={0.1 * (1 - collectProgress)}
              >
                <circleGeometry args={[1, 6]} />
                <meshBasicMaterial
                  color={i % 2 === 0 ? colors.primary : colors.secondary}
                  transparent opacity={1 - collectProgress}
                />
              </mesh>
            );
          })}
        </>
      )}
    </group>
  );
}

// ── Helper: activate a power-up by type ──────────────────────────────────────
function activatePowerUp(type: PowerUpType) {
  const s = useMagicOrb.getState();
  switch (type) {
    case "chargeBeam":   s.activateChargeBeam();  break;
    case "shield":       s.activateShield();       break;
    case "healing":      s.heal();                 break;
    case "doubleCoins":  s.activateDoubleCoins();  break;
    case "rapidFire":    s.activateRapidFire();    break;
    case "distort":      s.activateDistort();      break;
  }
}

// ── Main PowerUps component ───────────────────────────────────────────────────
export function PowerUps() {
  const powerUps       = useMagicOrb((s) => s.powerUps);
  const phase          = useMagicOrb((s) => s.phase);

  useFrame((_, delta) => {
    if (phase !== "playing") return;
    gameRuntime.pipeline.enter("powerUps");

    const current = useMagicOrb.getState().powerUps;
    if (current.length === 0) return;
    gameRuntime.powerUps.sync(current);
    const changes = gameRuntime.powerUps.tick(delta);
    const state = useMagicOrb.getState();
    for (const { id, patch } of changes.stateChanges) state.updatePowerUpState(id, patch);
    for (const { id, type } of changes.activations) {
      activatePowerUp(type);
      balanceTelemetry.recordPowerUp(type);
      state.removePowerUp(id);
    }
    for (const id of changes.removedIds) state.removePowerUp(id);
  });

  return (
    <>
      {powerUps.map((powerUp) => (
        <PowerUpMesh key={powerUp.id} powerUp={powerUp} />
      ))}
    </>
  );
}
