import { useRef, useMemo, memo, Suspense, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb, Projectile, Particle, ImpactEffect } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";
import { useShop, TrailEffect } from "@/lib/stores/useShop";
import { getSkinColors, PlayerGlow } from "./PlayerOrb";
import { PlayerModel } from "./PlayerModel";
import { PlayerParticles } from "./PlayerParticles";
import { EnergyDissipationVFX } from "./EnergyDissipationVFX";

const TRAIL_CONFIGS: Record<TrailEffect, { colors: string[]; particleCount: number; spread: number; glow: boolean }> = {
  none:           { colors: [],                                                                             particleCount: 0,  spread: 0.00, glow: false },
  sparkle:        { colors: ["#ffffff", "#ffff88", "#ffffcc", "#88ffff"],                                  particleCount: 8,  spread: 0.15, glow: true  },
  fire:           { colors: ["#ff4400", "#ff6600", "#ff8800", "#ffcc00", "#ffff00"],                       particleCount: 10, spread: 0.20, glow: true  },
  ice:            { colors: ["#88ddff", "#aaeeff", "#ccffff", "#ffffff", "#66ccff"],                       particleCount: 8,  spread: 0.12, glow: true  },
  cosmic:         { colors: ["#ff00ff", "#8800ff", "#4400ff", "#0088ff", "#00ffff"],                       particleCount: 12, spread: 0.18, glow: true  },
  lightning:      { colors: ["#ffff00", "#ffffff", "#88ffff", "#ffffaa"],                                  particleCount: 10, spread: 0.25, glow: true  },
  rainbow:        { colors: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#00ffff", "#0088ff", "#ff00ff"], particleCount: 14, spread: 0.20, glow: true  },
  plasma:         { colors: ["#ff00ff", "#ff44ff", "#ff88ff", "#ffffff", "#88ffff"],                       particleCount: 10, spread: 0.22, glow: true  },
  shadow:         { colors: ["#330033", "#440044", "#550055", "#220022", "#110011"],                       particleCount: 8,  spread: 0.18, glow: false },
  stardust:       { colors: ["#ffffff", "#ffccff", "#ccffff", "#ffffcc", "#ffddee"],                       particleCount: 16, spread: 0.20, glow: true  },
  meteor:         { colors: ["#ff4400", "#ff2200", "#ff6600", "#ff0000", "#ffaa00"],                       particleCount: 12, spread: 0.25, glow: true  },
  spirit:         { colors: ["#88ffff", "#aaddff", "#ccffff", "#ffffff", "#66ddff"],                       particleCount: 10, spread: 0.15, glow: true  },
  neon:           { colors: ["#00ff88", "#ff00ff", "#00ffff", "#ffff00", "#88ff00"],                       particleCount: 10, spread: 0.18, glow: true  },
  sakura:         { colors: ["#ffaacc", "#ff88aa", "#ffccdd", "#ffffff", "#ffbbdd"],                       particleCount: 12, spread: 0.22, glow: true  },
  galaxy:         { colors: ["#0000ff", "#4400ff", "#8800ff", "#ff00ff", "#00ffff", "#ffffff"],            particleCount: 14, spread: 0.20, glow: true  },
  particle_swarm: { colors: [],                                                                             particleCount: 0,  spread: 0.00, glow: false },
};

interface TrailParticleData {
  offset: number;
  angle: number;
  size: number;
  colorIndex: number;
  wobble: number;
}

function HDTrailEffect({ 
  trailType, 
  time, 
  direction, 
  baseScale,
  projectileColor 
}: { 
  trailType: TrailEffect; 
  time: number; 
  direction: [number, number, number]; 
  baseScale: number;
  projectileColor: string;
}) {
  const config = TRAIL_CONFIGS[trailType];
  if (!config || config.particleCount === 0) return null;

  const particles = useMemo<TrailParticleData[]>(() => {
    const result: TrailParticleData[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      result.push({
        offset: i * 0.15,
        angle: (Math.random() - 0.5) * config.spread * 2,
        size: 0.5 + Math.random() * 0.65,
        colorIndex: i % config.colors.length,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    return result;
  }, [config.particleCount, config.colors.length, config.spread]);

  return (
    <group>
      {particles.map((p, i) => {
        const trailDist = p.offset * 1.6;
        const wobbleX   = Math.sin(time * 3.2 + p.wobble) * config.spread * baseScale;
        const wobbleY   = Math.cos(time * 2.7 + p.wobble) * config.spread * baseScale;
        const wobbleZ   = Math.sin(time * 4.1 + p.wobble * 1.7) * config.spread * baseScale * 0.6;
        const sizeM     = Math.max(0.05, 1 - i / config.particleCount);
        const scale     = baseScale * 0.44 * p.size * sizeM;
        const color     = config.colors[p.colorIndex] ?? projectileColor;
        const fadeOut   = Math.max(0, 1 - trailDist * 1.8);

        return (
          <mesh
            key={i}
            position={[
              -direction[0] * trailDist + wobbleX,
              -direction[1] * trailDist + wobbleY,
              wobbleZ,
            ]}
            scale={scale}
          >
            <sphereGeometry args={[1, 5, 4]} />
            <meshBasicMaterial color={color} transparent opacity={fadeOut * 0.88} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

const MemoizedHDTrailEffect = memo(HDTrailEffect);

// ─── Projectile charge aura — electric sparks only ───────────────────────────
// Rendered inside the projectile group so positions are already world-correct.

// Electric spark instanced mesh for the projectile aura
const PAURA_SPARK_COUNT = 24;
const _pauraDummy       = new THREE.Object3D();
const _pauraColor       = new THREE.Color();
const _pauraPalette     = [
  new THREE.Color("#ffff00"),
  new THREE.Color("#ffffff"),
  new THREE.Color("#aaffff"),
];

interface _PAuraSpark {
  baseRadius: number;
  orbitSpeed: number;
  phase:      number;
  perp1:      THREE.Vector3;
  perp2:      THREE.Vector3;
  baseSize:   number;
  pulseFreq:  number;
  pulsePhase: number;
  zapFreq:    number;
  zapPhase:   number;
  colorT:     number;
}

// Sparks are built once at module level with a fixed scale seed; projScale is
// applied as a multiplier each frame so the aura stays proportional.
const _pauraSparkDefs = (() => {
  const list: _PAuraSpark[] = [];
  for (let i = 0; i < PAURA_SPARK_COUNT; i++) {
    const axis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    let ref = new THREE.Vector3(0, 1, 0);
    if (Math.abs(axis.dot(ref)) > 0.85) ref.set(1, 0, 0);
    const perp1 = new THREE.Vector3().crossVectors(axis, ref).normalize();
    const perp2 = new THREE.Vector3().crossVectors(axis, perp1).normalize();
    list.push({
      baseRadius: 1.0 + Math.random() * 2.2, // multiplied by projScale in frame
      orbitSpeed: (2.5 + Math.random() * 5.0) * (Math.random() < 0.5 ? 1 : -1),
      phase:      Math.random() * Math.PI * 2,
      perp1, perp2,
      baseSize:   0.028 + Math.random() * 0.030,
      pulseFreq:  9 + Math.random() * 20,
      pulsePhase: Math.random() * Math.PI * 2,
      zapFreq:    3.0 + Math.random() * 5.0,
      zapPhase:   Math.random() * Math.PI * 2,
      colorT:     Math.random(),
    });
  }
  return list;
})();

const _pauraSparkGeo = new THREE.SphereGeometry(1, 3, 2);
const _pauraSparkMat = new THREE.MeshBasicMaterial({
  color: "#ffff00",
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function ProjectileChargeSparks({ projScale }: { projScale: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < PAURA_SPARK_COUNT; i++) {
      const sp    = _pauraSparkDefs[i];
      const theta = t * sp.orbitSpeed + sp.phase;
      const cosT  = Math.cos(theta);
      const sinT  = Math.sin(theta);

      const pulse  = Math.abs(Math.sin(t * sp.pulseFreq + sp.pulsePhase));
      const pulseR = sp.baseRadius * projScale * (0.25 + 0.75 * pulse);
      const zapRaw = Math.sin(t * sp.zapFreq + sp.zapPhase);
      const zapAmt = zapRaw > 0 ? zapRaw ** 6 : 0;
      const r      = pulseR + projScale * 1.8 * zapAmt;

      _pauraDummy.position.set(
        (sp.perp1.x * cosT + sp.perp2.x * sinT) * r,
        (sp.perp1.y * cosT + sp.perp2.y * sinT) * r,
        (sp.perp1.z * cosT + sp.perp2.z * sinT) * r,
      );
      _pauraDummy.scale.setScalar(sp.baseSize * projScale * (0.4 + pulse * 0.6 + zapAmt * 3.0));
      _pauraDummy.updateMatrix();
      mesh.setMatrixAt(i, _pauraDummy.matrix);

      const ct = ((sp.colorT + t * 0.18) % 1.0 + 1.0) % 1.0;
      if (ct < 0.5) {
        _pauraColor.lerpColors(_pauraPalette[0], _pauraPalette[1], ct * 2);
      } else {
        _pauraColor.lerpColors(_pauraPalette[1], _pauraPalette[2], (ct - 0.5) * 2);
      }
      mesh.setColorAt(i, _pauraColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[_pauraSparkGeo, _pauraSparkMat, PAURA_SPARK_COUNT]}
    />
  );
}

function ProjectileChargeAura({ projScale }: { projScale: number }) {
  return <ProjectileChargeSparks projScale={projScale} />;
}

// ── Spiral Braid — 3 intertwined helical strands ─────────────────────────────

const BRAID_COLORS = ["#ffaa00", "#44ddff", "#ff44cc"] as const;
const BRAID_RADIUS = 0.22;

function SpiralBraidMesh({ projectile, time }: { projectile: Projectile; time: number }) {
  const strandCount = Math.max(1, Math.min(3, projectile.hitCount ?? 3));
  const [dx, dy] = projectile.direction;

  // Perpendicular basis — perp1 in XY, perp2 = Z axis
  const fwdLen = Math.sqrt(dx * dx + dy * dy);
  const p1x = fwdLen > 1e-4 ? -dy / fwdLen : 0;
  const p1y = fwdLen > 1e-4 ?  dx / fwdLen : 1;

  const rotPhase = time * 7.5;
  const lightColor = strandCount === 3 ? "#ffaa44" : strandCount === 2 ? "#55ccff" : "#ff66cc";

  return (
    <group position={projectile.position}>
      <pointLight color={lightColor} intensity={2 + strandCount * 1.2} distance={5} decay={2} />
      {Array.from({ length: strandCount }, (_, s) => {
        const phase = rotPhase + (s / 3) * Math.PI * 2;
        const ox = Math.cos(phase) * BRAID_RADIUS * p1x;
        const oy = Math.cos(phase) * BRAID_RADIUS * p1y;
        const oz = Math.sin(phase) * BRAID_RADIUS;
        return (
          <mesh key={s} position={[ox, oy, oz]} scale={0.10}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial
              color={BRAID_COLORS[s]}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ProjectileMesh({ projectile, time, trailType, skinColor, skinColors }: {
  projectile: Projectile;
  time: number;
  trailType: TrailEffect;
  skinColor: string;
  skinColors: { core: string; glow: string; emissive: string; accent: string; particles: string[] };
  equippedSkin: string;
}) {
  // Spiral braid — rendered entirely separately
  if (projectile.type === "spiral") {
    return <SpiralBraidMesh projectile={projectile} time={time} />;
  }

  const spawnTime     = useRef(time);
  const spawnProgress = Math.min(1, (time - spawnTime.current) * 6);
  const isCharged     = projectile.isCharged;
  const isRainbow     = (skinColors as any).isRainbow === true;

  // 1/5th of the player orb base scale (now 0.72)
  const projScale  = isCharged ? 0.216 : 0.144;
  const groupScale = 0.2 + spawnProgress * 0.8;

  return (
    <group position={projectile.position}>
      {/* Point light matching player skin colour */}
      <pointLight
        color={skinColors.glow}
        intensity={isCharged ? 4 : 2.5}
        distance={isCharged ? 6 : 4}
        decay={2}
      />
      {/* Trail */}
      {trailType !== "none" && trailType !== "particle_swarm" && spawnProgress >= 0.4 && (
        <MemoizedHDTrailEffect
          trailType={trailType}
          time={time}
          direction={projectile.direction}
          baseScale={projScale * groupScale}
          projectileColor={skinColor}
        />
      )}

      {/* Charge beam aura — mini orbiting swarm + lightning, outside the scale group
          so it stays at full size regardless of spawn-in progress */}
      {isCharged && <ProjectileChargeAura projScale={projScale * groupScale} />}

      {/* Mini player orb at 1/5th scale — FBX model + glow + particles, all skin-matched */}
      <group scale={groupScale}>
        <Suspense fallback={null}>
          <PlayerModel
            scale={projScale}
            rotationSpeedX={1.6}
            rotationSpeedY={2.4}
          />
        </Suspense>
        <PlayerGlow
          scale={projScale}
          coreColor={skinColors.core}
          glowColor={skinColors.glow}
          isRainbow={isRainbow}
        />
        {/* Particle Swarm — unlockable trail cosmetic: orbiting 3D particles */}
        {trailType === "particle_swarm" && (
          <PlayerParticles
            scale={projScale}
            particleColors={[skinColors.core]}
            isRainbow={isRainbow}
          />
        )}

      </group>
    </group>
  );
}

// ── EaseOutQuad for projectile spawn grow-in ──────────────────────────────────
function easeOutQuad(t: number): number { return 1 - (1 - t) * (1 - t); }

// ── Expanding energy shockwave ring spawned at overcharged fire point ─────────
const _swRingGeo = new THREE.TorusGeometry(1, 0.09, 6, 48);

function OcShockwaveRing({ position }: { position: [number, number, number] }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const timerRef = useRef(0);
  const DUR      = 0.55;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timerRef.current = Math.min(timerRef.current + delta, DUR);
    const t = timerRef.current / DUR;
    meshRef.current.scale.setScalar(t * 5.0);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
  });

  return (
    <mesh ref={meshRef} geometry={_swRingGeo} position={position}>
      <meshBasicMaterial
        color="#55aaff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Overcharged Blaster visual ────────────────────────────────────────────────
const _ocCoreGeo  = new THREE.SphereGeometry(1, 20, 14);
const _ocRingGeo  = new THREE.TorusGeometry(1, 0.055, 7, 48);
const _ocCoreMat  = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
const _ocRingMat  = new THREE.MeshBasicMaterial({ color: "#33aaff", transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
const _ocRing2Mat = new THREE.MeshBasicMaterial({ color: "#aaccff", transparent: true, opacity: 0.50, depthWrite: false, blending: THREE.AdditiveBlending });

const _RIBBON_N  = 16;
const _RIBBON_HW = 0.22; // half-width at head

function OverchargedProjectileMesh({
  projectile, time, spawnScale,
}: {
  projectile: Projectile; time: number; spawnScale: number;
}) {
  const pulse     = 0.5 + 0.5 * Math.sin(time * 4.5);
  const coreScale = 1.247 + pulse * 0.1505;
  const r1 = time * 2.1;
  const r2 = time * 1.6 + 1.05;

  // ── Trailing ribbon geometry ─────────────────────────────────────────────────
  const ribbonGeo = useMemo(() => {
    const geo   = new THREE.BufferGeometry();
    const N     = _RIBBON_N;
    const pArr  = new Float32Array(N * 2 * 3);
    const cArr  = new Float32Array(N * 2 * 4);
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const b = i * 2;
      idx.push(b, b+2, b+1, b+1, b+2, b+3);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(cArr, 4));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => { ribbonGeo.dispose(); ribbonMat.dispose(); }, [ribbonGeo, ribbonMat]);

  const posHistRef = useRef(new Float32Array(_RIBBON_N * 3));
  const histLenRef = useRef(0);

  // Capture latest prop values in refs so the useFrame closure is never stale
  const projRef      = useRef(projectile);
  const spawnScaleRef = useRef(spawnScale);
  projRef.current      = projectile;
  spawnScaleRef.current = spawnScale;

  useFrame(() => {
    const proj = projRef.current;
    const ss   = spawnScaleRef.current;
    const [wx, wy, wz] = proj.position;

    // Push position into history (most-recent at index 0)
    const N   = _RIBBON_N;
    const len = Math.min(histLenRef.current + 1, N);
    histLenRef.current = len;
    const hist = posHistRef.current;
    for (let i = len - 1; i > 0; i--) {
      hist[i*3] = hist[(i-1)*3]; hist[i*3+1] = hist[(i-1)*3+1]; hist[i*3+2] = hist[(i-1)*3+2];
    }
    hist[0] = wx; hist[1] = wy; hist[2] = wz;
    if (len < 2) return;

    // Perpendicular to fire direction (for ribbon width)
    const [fdx, fdy] = proj.direction;
    const fl = Math.sqrt(fdx*fdx + fdy*fdy) || 1;
    const px_ = -fdy / fl, py_ = fdx / fl;

    const pAttr = ribbonGeo.getAttribute("position") as THREE.BufferAttribute;
    const cAttr = ribbonGeo.getAttribute("color")    as THREE.BufferAttribute;
    const pA    = pAttr.array as Float32Array;
    const cA    = cAttr.array as Float32Array;

    for (let i = 0; i < len; i++) {
      const t  = i / (len - 1);
      const hw = _RIBBON_HW * (1 - t) * ss;
      const rx = hist[i*3] - wx, ry = hist[i*3+1] - wy, rz = hist[i*3+2] - wz;
      const vi = i * 6;
      pA[vi]   = rx + px_*hw; pA[vi+1] = ry + py_*hw; pA[vi+2] = rz;
      pA[vi+3] = rx - px_*hw; pA[vi+4] = ry - py_*hw; pA[vi+5] = rz;
      const alpha = (1 - t) * 0.65 * Math.min(ss * 2, 1);
      const ci = i * 8;
      cA[ci]   = 0.2; cA[ci+1] = 0.55; cA[ci+2] = 1.0; cA[ci+3] = alpha;
      cA[ci+4] = 0.2; cA[ci+5] = 0.55; cA[ci+6] = 1.0; cA[ci+7] = alpha;
    }
    pAttr.needsUpdate = true;
    cAttr.needsUpdate = true;
    ribbonGeo.setDrawRange(0, (len - 1) * 6);
    ribbonGeo.computeBoundingSphere();
  });

  return (
    <group position={projectile.position}>
      {/* Trailing ribbon rendered behind the spawn-scale group */}
      <mesh geometry={ribbonGeo} material={ribbonMat} />
      {/* Scale-in group: everything below grows from 0.05 → 1.0 on spawn */}
      <group scale={spawnScale}>
        <pointLight color="#55aaff" intensity={10 + pulse * 6} distance={9} decay={2} />
        <pointLight color="#ffffff" intensity={4}              distance={3} decay={2} />
        <mesh geometry={_ocCoreGeo} material={_ocCoreMat} scale={coreScale} />
        <group rotation={[r1, 0, r2 * 0.6]}>
          <mesh geometry={_ocRingGeo} material={_ocRingMat}  scale={1.72} />
        </group>
        <group rotation={[r2 * 0.5, r1 * 0.8, 0]}>
          <mesh geometry={_ocRingGeo} material={_ocRing2Mat} scale={1.55} />
        </group>
      </group>
    </group>
  );
}

// Colours for each strand slot (cyan, magenta, gold)
const STRAND_COLORS = ["#00ffff", "#ff00ff", "#ffdd00"] as const;
const STRAND_GLOW   = ["#004488", "#440044", "#443300"] as const;

// Geometry shared across all instances
const _strandGeo = new THREE.SphereGeometry(0.09, 8, 6);
const _strandMats = STRAND_COLORS.map((c) =>
  new THREE.MeshBasicMaterial({
    color: c,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);

function SpiralBundleMesh({ projectile, time }: { projectile: Projectile; time: number }) {
  const strandCount = Math.max(1, Math.min(3, projectile.hitCount ?? 3));
  const [dx, dy] = projectile.direction;

  // Orbit radius pulses slightly for a living feel
  const orbitR    = 0.22 + Math.sin(time * 6.0) * 0.03;
  const rotSpeed  = 5.5; // rad/s

  // Two axes perpendicular to the travel direction
  // perp1: rotate 90° in XY plane; perp2: Z axis
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux  = -dy / len;
  const uy  =  dx / len;

  const strands: Array<[number, number, number]> = [];
  for (let i = 0; i < strandCount; i++) {
    const phase = (i / strandCount) * Math.PI * 2;
    const a     = time * rotSpeed + phase;
    const cosA  = Math.cos(a);
    const sinA  = Math.sin(a);
    strands.push([
      ux * cosA * orbitR,
      uy * cosA * orbitR,
      sinA * orbitR,
    ]);
  }

  return (
    <group position={projectile.position}>
      {/* Shared point light — colour shifts cyan→magenta as strands are lost */}
      <pointLight
        color={strandCount === 3 ? "#00ffff" : strandCount === 2 ? "#cc44ff" : "#ffdd00"}
        intensity={3.5 + Math.sin(time * 8) * 0.5}
        distance={5}
        decay={2}
      />
      {strands.map((offset, i) => (
        <group key={i} position={offset}>
          <mesh geometry={_strandGeo} material={_strandMats[i]} />
          {/* Inner glow — slightly larger, dimmer sphere */}
          <mesh scale={2.2}>
            <sphereGeometry args={[0.09, 6, 4]} />
            <meshBasicMaterial
              color={STRAND_GLOW[i]}
              transparent
              opacity={0.25}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ImpactEffectMesh({ effect, skinColors }: {
  effect: ImpactEffect;
  time: number;
  skinColors: { particles: string[]; glow: string; core: string; emissive: string };
}) {
  const progress = 1 - effect.timer / effect.maxTimer;

  if (effect.isBossHit) {
    // Boss hit: point-light flash + particles only — no white crush geometry.
    // Light fades from peak brightness to zero over the effect lifetime.
    const fade = Math.max(0, 1 - progress);
    const lightIntensity = fade * fade * 24;
    return (
      <group position={effect.position}>
        {/* Warm fire-orange burst light — replaces the white circle */}
        <pointLight
          color="#ff7722"
          intensity={lightIntensity}
          distance={6}
          decay={2}
        />
        {/* Particle scatter rendered on top of the boss (depthTest off) */}
        <EnergyDissipationVFX
          progress={progress}
          color={skinColors.core}
          glowColor={skinColors.glow}
          scale={0.38}
          seed={Math.round(effect.seed * 9999)}
          depthTest={false}
          hideCrush={true}
        />
      </group>
    );
  }

  return (
    <group position={effect.position}>
      <EnergyDissipationVFX
        progress={progress}
        color={skinColors.core}
        glowColor={skinColors.glow}
        scale={0.38}
        seed={Math.round(effect.seed * 9999)}
        depthTest={false}
      />
    </group>
  );
}

let impactIdCounter = 0;

export function Projectiles() {
  const { 
    projectiles, 
    updateProjectiles, 
    darkOrbs, 
    markOrbDestroying,
    powerUps,
    markPowerUpCollected,
    removePowerUp,
    activateShield,
    activateChargeBeam,
    heal,
    activateDoubleCoins,
    activateRapidFire,
    addScore, 
    addParticles,
    impactEffects,
    updateImpactEffects,
    addImpactEffect,
    phase,
    boss,
    damageBoss,
    incrementOrbsDestroyed,
    gameMode,
    registerMissedShot,
    incrementGauntletOrbs,
  } = useMagicOrb();
  
  const { playHit, playSuccess, playSparkleExplosion } = useAudio();
  const { addCoins, equippedTrail, equippedSkin } = useShop();
  const clockRef = useRef(0);
  const projectileSpeed = 16.5;
  const hitRadius = 1.2;
  const hitOrbsThisFrame = useRef<Set<string>>(new Set());
  const hitPowerUpsThisFrame = useRef<Set<string>>(new Set());
  // Tracks which spiral projectiles have already pierced through the boss this
  // pass so they don't register multiple hits while inside the hit radius.
  const spiralBossHit = useRef<Set<string>>(new Set());
  const projectileOrbHits = useRef<Map<string, Set<string>>>(new Map());
  const volleyHits = useRef<Set<string>>(new Set());
  const volleyProjectileCounts = useRef<Map<string, number>>(new Map());
  const volleyRemainingCounts = useRef<Map<string, number>>(new Map());

  // ── Overcharged shockwave rings ───────────────────────────────────────────
  const knownOcIds   = useRef<Set<string>>(new Set());
  const [shockwaves, setShockwaves] = useState<Array<{ id: string; pos: [number,number,number] }>>([]);
  const swTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  const skinColors = useMemo(() => getSkinColors(equippedSkin, 3), [equippedSkin]);
  const projectileColor = skinColors.projectile;
  
  useFrame((state, delta) => {
    clockRef.current = state.clock.getElapsedTime();
    
    const {
      projectiles,
      darkOrbs,
      powerUps,
      impactEffects,
      phase,
      boss,
      gameMode,
      updateProjectiles,
      markOrbDestroying,
      markPowerUpCollected,
      removePowerUp,
      activateShield,
      activateChargeBeam,
      heal,
      activateDoubleCoins,
      activateRapidFire,
      addScore,
      addParticles,
      updateImpactEffects,
      addImpactEffect,
      damageBoss,
      incrementOrbsDestroyed,
      registerMissedShot,
      incrementGauntletOrbs,
    } = useMagicOrb.getState();
    
    if (phase !== "playing") return;

    // Detect newly spawned overcharged projectiles → shockwave ring
    for (const proj of projectiles) {
      if (proj.type === "overcharged" && !knownOcIds.current.has(proj.id)) {
        knownOcIds.current.add(proj.id);
        const swId  = `sw-${proj.id}`;
        const swPos = [...proj.position] as [number, number, number];
        setShockwaves(prev => [...prev, { id: swId, pos: swPos }]);
        swTimeoutsRef.current.set(swId, setTimeout(() => {
          setShockwaves(prev => prev.filter(s => s.id !== swId));
          swTimeoutsRef.current.delete(swId);
        }, 680));
      }
    }

    if (impactEffects.length > 0) {
      // Single-pass loop avoids the two intermediate array allocations that
      // map+filter creates every frame when impact effects are active.
      const updatedEffects: typeof impactEffects = [];
      for (const e of impactEffects) {
        const newTimer = e.timer - delta;
        if (newTimer > 0) updatedEffects.push({ ...e, timer: newTimer });
      }
      updateImpactEffects(updatedEffects);
    }
    
    if (projectiles.length === 0) return;
    
    const updatedProjectiles: Projectile[] = [];
    hitOrbsThisFrame.current.clear();
    hitPowerUpsThisFrame.current.clear();
    spiralBossHit.current.clear();
    
    for (const orb of darkOrbs) {
      if (orb.destroying) {
        Array.from(projectileOrbHits.current.entries()).forEach(([projId, orbSet]) => {
          orbSet.delete(orb.id);
        });
      }
    }
    
    for (const proj of projectiles) {
      if (proj.volleyId && !volleyProjectileCounts.current.has(proj.volleyId)) {
        const volleySize = projectiles.filter(p => p.volleyId === proj.volleyId).length;
        volleyProjectileCounts.current.set(proj.volleyId, volleySize);
        volleyRemainingCounts.current.set(proj.volleyId, volleySize);
      }
      
      let [px, py, pz] = proj.position;
      let [dx, dy, dz] = proj.direction;
      
      if (proj.homing) {
        const homingBoundary = 12;
        // Inline the filter into the closest-orb search (single pass, no allocation).
        let closestTarget: { position: [number, number, number] } | null = null;
        let closestDist = Infinity;
        
        for (const orb of darkOrbs) {
          if (orb.destroying || Math.abs(orb.position[0]) > homingBoundary || Math.abs(orb.position[1]) > homingBoundary) continue;
          const d = Math.sqrt((orb.position[0] - px) ** 2 + (orb.position[1] - py) ** 2);
          if (d < closestDist) {
            closestDist = d;
            closestTarget = orb;
          }
        }
        
        if (boss && !boss.destroying && !boss.shieldActive) {
          const bossDist = Math.sqrt((boss.position[0] - px) ** 2 + (boss.position[1] - py) ** 2);
          if (bossDist < closestDist) {
            closestDist = bossDist;
            closestTarget = boss;
          }
        }
        
        if (closestTarget) {
          const targetDirX = closestTarget.position[0] - px;
          const targetDirY = closestTarget.position[1] - py;
          const len = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY);
          if (len > 0.1) {
            const homingStrength = 0.15;
            dx = dx * (1 - homingStrength) + (targetDirX / len) * homingStrength;
            dy = dy * (1 - homingStrength) + (targetDirY / len) * homingStrength;
            const newLen = Math.sqrt(dx * dx + dy * dy);
            if (newLen > 0.01) {
              dx /= newLen;
              dy /= newLen;
            }
          }
        }
      }
      
      let newSpiralAngle = proj.spiralAngle;
      // Old-style spiralAngle steers direction only for non-braid projectiles.
      if (newSpiralAngle !== undefined && proj.type !== "spiral") {
        const spiralSpeed = 3;
        newSpiralAngle = newSpiralAngle + delta * spiralSpeed;
        dx = Math.cos(newSpiralAngle);
        dy = Math.sin(newSpiralAngle);
      }
      
      const effSpeed = proj.speed ?? projectileSpeed;
      px += dx * effSpeed * delta;
      py += dy * effSpeed * delta;
      pz += dz * effSpeed * delta;

      // Grow-in scale for overcharged (EaseOutQuad over 0.15 s)
      let newSpawnScale    = proj.spawnScale;
      let newSpawnScaleTimer = proj.spawnScaleTimer;
      if (proj.type === "overcharged" && newSpawnScaleTimer !== undefined && newSpawnScaleTimer < 0.15) {
        newSpawnScaleTimer = newSpawnScaleTimer + delta;
        const eoqT  = Math.min(1, newSpawnScaleTimer / 0.15);
        newSpawnScale = 0.05 + 0.95 * easeOutQuad(eoqT);
      }
      
      const screenBoundary = 13;
      if (Math.abs(px) > screenBoundary || Math.abs(py) > screenBoundary) {
        const projHasHit = projectileOrbHits.current.has(proj.id) && projectileOrbHits.current.get(proj.id)!.size > 0;
        
        if (proj.volleyId) {
          if (projHasHit) {
            volleyHits.current.add(proj.volleyId);
          }
          const remaining = (volleyRemainingCounts.current.get(proj.volleyId) || 1) - 1;
          volleyRemainingCounts.current.set(proj.volleyId, remaining);
          
          if (remaining <= 0) {
            if (!volleyHits.current.has(proj.volleyId) && !proj.noMissTracking) {
              registerMissedShot();
            }
            volleyHits.current.delete(proj.volleyId);
            volleyRemainingCounts.current.delete(proj.volleyId);
            volleyProjectileCounts.current.delete(proj.volleyId);
          }
        } else {
          const isPrimaryShot = proj.type === "normal" || proj.type === "homing" || proj.type === undefined;
          if (isPrimaryShot && !projHasHit && !proj.noMissTracking) {
            registerMissedShot();
          }
        }
        
        projectileOrbHits.current.delete(proj.id);
        continue;
      }
      
      let hitSomething = false;
      
      if (boss && !boss.destroying && !boss.shieldActive) {
        const [bx, by, bz] = boss.position;
        const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2 + ((bz || 0) - pz) ** 2);
        const bossHitRadius = 1.65;
        
        if (dist < bossHitRadius && !spiralBossHit.current.has(proj.id) &&
            (proj.type !== "overcharged" || (proj.spawnScale ?? 1) >= 0.8)) {
          const isOvercharged = proj.type === "overcharged";
          const isSpiralPiercing = proj.type === "spiral" && proj.hitCount !== undefined && proj.hitCount > 1;

          if (isOvercharged) {
            // Overcharged passes through the boss — track so it only hits once per pass
            spiralBossHit.current.add(proj.id);
          } else if (!isSpiralPiercing) {
            hitSomething = true;
          } else {
            // Spiral braid loses one strand, keeps flying
            proj.hitCount!--;
            spiralBossHit.current.add(proj.id);
          }

          const projHits = projectileOrbHits.current.get(proj.id) || new Set();
          projHits.add("boss");
          projectileOrbHits.current.set(proj.id, projHits);
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          const bossKilled = damageBoss(isOvercharged ? 5 : undefined);
          addScore(25);
          playHit();
          
          if (bossKilled) {
            playSparkleExplosion();
          }
          
          // Place impact at the sphere surface point the projectile entered.
          {
            const bzSafe = bz || 0;
            let dx = px - bx, dy = py - by, dz = pz - bzSafe;
            let len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len < 1e-6) {
              [dx, dy, dz] = proj.direction;
              len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            }
            const surfaceR = 1.44;
            addImpactEffect({
              id: `impact-${impactIdCounter++}`,
              position: [
                bx + (dx / len) * surfaceR,
                by + (dy / len) * surfaceR,
                bzSafe + (dz / len) * surfaceR,
              ],
              timer: 0.5,
              maxTimer: 0.5,
              seed: Math.random(),
              isBossHit: true,
            });
          }
        }
      } else if (boss && boss.shieldActive && proj.type !== "overcharged") {
        const [bx, by, bz] = boss.position;
        const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2 + ((bz || 0) - pz) ** 2);
        const shieldRadius = 3.5;
        
        if (dist < shieldRadius) {
          hitSomething = true;
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [px, py, pz],
            timer: 0.3,
            maxTimer: 0.3,
            seed: Math.random(),
          });
        }
      }
      
      for (const orb of darkOrbs) {
        if (hitOrbsThisFrame.current.has(orb.id) || orb.destroying) continue;
        
        const [ox, oy, oz] = orb.position;
        const orbScreenBoundary = 12;
        if (Math.abs(ox) > orbScreenBoundary || Math.abs(oy) > orbScreenBoundary) continue;
        
        const projHits = projectileOrbHits.current.get(proj.id) || new Set();
        if (proj.piercing && projHits.has(orb.id)) continue;
        const dist = Math.sqrt((px - ox) ** 2 + (py - oy) ** 2 + (pz - oz) ** 2);
        const bossOrbHitBonus = orb.isBossOrb ? 0.6 : 0;
        const effectiveRadius = proj.type === "overcharged"
          ? hitRadius * (proj.size ?? 1) * 2.8
          : (proj.isCharged ? hitRadius * 1.8 : hitRadius) + bossOrbHitBonus;
        
        if (dist < effectiveRadius &&
            (proj.type !== "overcharged" || (proj.spawnScale ?? 1) >= 0.8)) {
          hitOrbsThisFrame.current.add(orb.id);
          markOrbDestroying(orb.id);
          addScore(10);
          incrementGauntletOrbs();
          addCoins(5);
          playHit();
          
          if (gameMode === "arcade") {
            incrementOrbsDestroyed();
          }
          
          addImpactEffect({
            id: `impact-${impactIdCounter++}`,
            position: [ox, oy, oz],
            timer: 0.4,
            maxTimer: 0.4,
            seed: Math.random(),
          });
          
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          
          if (proj.type === "overcharged") {
            // Unlimited pierce — destroy orb, keep flying
            const projHits = projectileOrbHits.current.get(proj.id) || new Set();
            projHits.add(orb.id);
            projectileOrbHits.current.set(proj.id, projHits);
          } else if (proj.piercing && proj.hitCount && proj.hitCount > 1) {
            proj.hitCount--;
            const projHits = projectileOrbHits.current.get(proj.id) || new Set();
            projHits.add(orb.id);
            projectileOrbHits.current.set(proj.id, projHits);
          } else {
            projectileOrbHits.current.delete(proj.id);
            hitSomething = true;
            break;
          }
        }
      }
      
      for (const powerUp of powerUps) {
        if (hitPowerUpsThisFrame.current.has(powerUp.id) || powerUp.collected) continue;
        
        const [pux, puy, puz] = powerUp.position;
        const dx2 = (px - pux) ** 2;
        const dy2 = (py - puy) ** 2;
        const dist = Math.sqrt(dx2 + dy2);
        
        if (dist < 1.5) {
          hitPowerUpsThisFrame.current.add(powerUp.id);
          removePowerUp(powerUp.id);
          hitSomething = true;
          if (proj.volleyId) {
            volleyHits.current.add(proj.volleyId);
          }
          playSuccess();
          
          if (powerUp.type === "shield") {
            activateShield();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#00ffff", "#00ff00"]));
          } else if (powerUp.type === "chargeBeam") {
            activateChargeBeam();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#ffff00", "#ff6600"]));
          } else if (powerUp.type === "healing") {
            heal();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#00ff88", "#ffffff"]));
          } else if (powerUp.type === "doubleCoins") {
            activateDoubleCoins();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#ffd700", "#ffaa00"]));
          } else if (powerUp.type === "rapidFire") {
            activateRapidFire();
            addParticles(createPowerUpParticles([pux, puy, puz], ["#ff4400", "#ff0000"]));
          }
          
          addScore(25);
          break;
        }
      }
      
      if (!hitSomething) {
        updatedProjectiles.push({ 
          ...proj, 
          position: [px, py, pz], 
          direction: [dx, dy, dz],
          hitCount: proj.hitCount,
          spiralAngle: newSpiralAngle,
          spawnScale: newSpawnScale,
          spawnScaleTimer: newSpawnScaleTimer,
        });
      } else {
        projectileOrbHits.current.delete(proj.id);
      }
    }
    
    // Iterate the Map directly — avoids Array.from() allocation; safe to delete
    // the current key during Map iteration per the ECMAScript spec.
    for (const projId of projectileOrbHits.current.keys()) {
      if (!updatedProjectiles.find(p => p.id === projId)) {
        projectileOrbHits.current.delete(projId);
      }
    }
    
    updateProjectiles(updatedProjectiles);
  });
  
  return (
    <>
      {projectiles.map((proj) =>
        proj.type === "overcharged" ? (
          <OverchargedProjectileMesh
            key={proj.id}
            projectile={proj}
            time={clockRef.current}
            spawnScale={proj.spawnScale ?? 1}
          />
        ) : proj.type === "spiral" ? (
          <SpiralBundleMesh
            key={proj.id}
            projectile={proj}
            time={clockRef.current}
          />
        ) : (
          <ProjectileMesh
            key={proj.id}
            projectile={proj}
            time={clockRef.current}
            trailType={equippedTrail}
            skinColor={projectileColor}
            skinColors={skinColors}
            equippedSkin={equippedSkin}
          />
        )
      )}
      {shockwaves.map(sw => (
        <OcShockwaveRing key={sw.id} position={sw.pos} />
      ))}
      {impactEffects.map((effect) => (
        <ImpactEffectMesh key={effect.id} effect={effect} time={clockRef.current} skinColors={skinColors} />
      ))}
    </>
  );
}

function createExplosionParticles(position: [number, number, number], customColors?: string[]): Particle[] {
  const particles: Particle[] = [];
  const colors = customColors || ["#ff00ff", "#00ffff", "#ffff00", "#ff6600", "#ffffff", "#ff3388"];
  
  for (let i = 0; i < 20; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 2.5 + Math.random() * 4;
    
    particles.push({
      id: `exp-${Date.now()}-${i}`,
      position: [...position],
      velocity: [
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ],
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
    });
  }
  
  return particles;
}

function createPowerUpParticles(position: [number, number, number], colors: string[]): Particle[] {
  const particles: Particle[] = [];
  
  for (let i = 0; i < 25; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 3.5 + Math.random() * 4.5;
    
    particles.push({
      id: `pup-${Date.now()}-${i}`,
      position: [...position],
      velocity: [
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ],
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.6 + Math.random() * 0.35,
      maxLife: 0.95,
    });
  }
  
  return particles;
}
