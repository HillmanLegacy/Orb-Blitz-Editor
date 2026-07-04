import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ─── ORBLITZ brand palette (4 keyframe colours) ───────────────────────────────
const PALETTE = [
  new THREE.Color("#00ffff"), // 0 – cyan
  new THREE.Color("#aa00ff"), // 1 – violet
  new THREE.Color("#ff00ff"), // 2 – magenta
  new THREE.Color("#ffff00"), // 3 – yellow
] as const;

/** Smoothly interpolate through the ORBLITZ 4-colour palette. */
function setPalCol(dst: THREE.Color, phase: number, bright = 1): void {
  const p   = ((phase % 1) + 1) % 1;
  const pos = p * 4;
  const i   = Math.floor(pos) % 4;
  const f   = pos - Math.floor(pos);
  dst.lerpColors(PALETTE[i], PALETTE[(i + 1) % 4], f);
  if (bright !== 1) dst.multiplyScalar(bright);
}

// ─── Static grid geometries (built once, shared) ──────────────────────────────
function buildHGrid(y: number, xSpan: number, xStep: number, zNear: number, zFar: number, zStep: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  // Longitudinal lines (X = const, Z varies)
  for (let xi = -xSpan; xi <= xSpan; xi++) {
    pos.push(xi * xStep, y, zNear,  xi * xStep, y, zFar);
  }
  // Lateral lines (Z = const, X varies)
  let z = zNear;
  while (z >= zFar) {
    pos.push(-xSpan * xStep, y, z,  xSpan * xStep, y, z);
    z -= zStep;
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

function buildVGrid(x: number, ySpan: number, yStep: number, zNear: number, zFar: number, zStep: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  // Vertical lines (Y = const, Z varies)
  for (let yi = -ySpan; yi <= ySpan; yi++) {
    pos.push(x, yi * yStep, zNear,  x, yi * yStep, zFar);
  }
  // Depth lines (Z = const, Y varies)
  let z = zNear;
  while (z >= zFar) {
    pos.push(x, -ySpan * yStep, z,  x, ySpan * yStep, z);
    z -= zStep;
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

const FLOOR_GEO  = buildHGrid(-14,  10, 3.4, -4,  -54, 1.7);
const CEIL_GEO   = buildHGrid( 14,  10, 3.4, -4,  -54, 1.7);
const SIDE_GEO_L = buildVGrid(-33,   7, 2.4, -4,  -54, 1.7);
const SIDE_GEO_R = buildVGrid( 33,   7, 2.4, -4,  -54, 1.7);

// ─── Background component ─────────────────────────────────────────────────────
export function Background() {
  const {
    backgroundPulse, backgroundShake, updateBackgroundEffects,
    distortActive, gameTime, phase, playerPosition, gameMode,
  } = useMagicOrb();

  // ── refs ─────────────────────────────────────────────────────────────────
  const floorRef        = useRef<THREE.LineSegments>(null);
  const ceilRef         = useRef<THREE.LineSegments>(null);
  const sideRefL        = useRef<THREE.LineSegments>(null);
  const sideRefR        = useRef<THREE.LineSegments>(null);
  const nexusRef        = useRef<THREE.Group>(null);
  const portalRefs      = useRef<THREE.Mesh[]>([]);
  const starRefs        = useRef<THREE.Mesh[]>([]);
  const nebulaRefs      = useRef<THREE.Mesh[]>([]);
  const shardGroupRefs  = useRef<THREE.Group[]>([]);
  const orbRefs         = useRef<THREE.Group[]>([]);
  const spiralRefs      = useRef<THREE.Mesh[]>([]);
  const meteorRefs      = useRef<THREE.Mesh[]>([]);
  const pulseRefs       = useRef<THREE.Group[]>([]);

  const frameSkip = useRef(0);
  const chaosRef  = useRef(0);

  // ── static data ───────────────────────────────────────────────────────────
  const stars = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    pos:    [(Math.random() - 0.5) * 88, (Math.random() - 0.5) * 62, -33 - Math.random() * 16] as [number, number, number],
    scale:  0.022 + Math.random() * 0.05,
    twink:  2.8 + Math.random() * 8,
    phase:  Math.random() * Math.PI * 2,
    palOff: Math.random(),
  })), []);

  const nebulae = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    pos:     [(Math.random() - 0.5) * 68, (Math.random() - 0.5) * 48, -30 - Math.random() * 16] as [number, number, number],
    scale:   14 + Math.random() * 20,
    freq:    0.18 + Math.random() * 0.5,
    phase:   Math.random() * Math.PI * 2,
    palOff:  i / 8,
  })), []);

  // 4 portal arches – one ORBLITZ colour each, receding into the distance
  const portals = useMemo(() => [
    { z: -12, palOff: 0.00, radius: 16, tilt: [0,   0,   0.06] as [number,number,number] },
    { z: -22, palOff: 0.25, radius: 18, tilt: [0.04,0,   0   ] as [number,number,number] },
    { z: -32, palOff: 0.50, radius: 20, tilt: [0,   0.05,0.03] as [number,number,number] },
    { z: -42, palOff: 0.75, radius: 22, tilt: [0.03,0,   0.05] as [number,number,number] },
  ], []);

  // Crystal shards – dual solid + wireframe
  const shards = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    pos:      [(Math.random() - 0.5) * 64, (Math.random() - 0.5) * 46, -9 - Math.random() * 18] as [number, number, number],
    scale:    0.4 + Math.random() * 1.6,
    rx: 0.25 + Math.random() * 0.6,
    ry: 0.18 + Math.random() * 0.5,
    rz: 0.12 + Math.random() * 0.4,
    floatA:  0.4 + Math.random() * 1.2,
    floatF:  0.28 + Math.random() * 0.45,
    phase:   Math.random() * Math.PI * 2,
    palOff:  i / 28,
    type:    i % 4 as 0 | 1 | 2 | 3,
    baseX:   (Math.random() - 0.5) * 64,
    baseY:   (Math.random() - 0.5) * 46,
  })), []);

  // Energy orbs – sphere core + 2 torus halos
  const energyOrbs = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2;
    return {
      base:    [Math.cos(a) * 20, Math.sin(a) * 14, -20] as [number, number, number],
      size:    1.2 + Math.random() * 0.8,
      pFreq:   1.1 + Math.random(),
      oSpd:    0.06 + Math.random() * 0.07,
      palOff:  i / 7,
      phase:   Math.random() * Math.PI * 2,
    };
  }), []);

  // Spiral ring of orbs orbiting the nexus
  const spiralOrbs = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    angle:   (i / 24) * Math.PI * 2,
    radius:  28 + Math.random() * 7,
    z:       -26 - Math.random() * 7,
    size:    0.12 + Math.random() * 0.22,
    speed:   0.035 + Math.random() * 0.055,
    palOff:  i / 24,
    phase:   Math.random() * Math.PI * 2,
  })), []);

  // Meteors
  const meteors = useMemo(() => Array.from({ length: 10 }, () => ({
    startX:   -38 + Math.random() * 76,
    startY:   26  + Math.random() * 10,
    speedX:   28  + Math.random() * 28,
    speedY:   -42 - Math.random() * 22,
    len:      0.5 + Math.random() * 1.0,
    w:        0.04 + Math.random() * 0.07,
    delay:    Math.random() * 12,
    dur:      0.9 + Math.random() * 0.7,
    palOff:   Math.random(),
  })), []);

  // Pulse rings
  const pulseRings = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    delay:  i * 1.3,
    maxR:   20 + i * 5,
    palOff: i / 5,
  })), []);

  // ── per-frame animation ──────────────────────────────────────────────────
  useFrame((state, delta) => {
    if (phase !== "playing") return;
    const t = state.clock.getElapsedTime();

    updateBackgroundEffects(delta);

    frameSkip.current++;
    if (frameSkip.current % 4 === 0) {
      chaosRef.current = Math.pow(Math.min(1, gameTime / 90), 1.5);
    }
    const chaos     = chaosRef.current;
    const spd       = gameMode === "chill" ? 0.038 : 0.075 + chaos * 0.22;
    const animSpd   = gameMode === "chill" ? 0.38  : 1.0   + chaos * 2.0;
    const pX        = playerPosition[0];
    const pY        = playerPosition[1];
    const shake     = backgroundShake > 0 ? (Math.random() - 0.5) * backgroundShake * 0.28 : 0;

    // ── Neon tunnel grids ─────────────────────────────────────────────────
    const gridScroll = (t * (0.75 + chaos) * 1.7) % 1.7;
    const gridOp     = 0.13 + Math.sin(t * 1.3) * 0.04 + backgroundPulse * 0.14;

    if (floorRef.current) {
      const mat = floorRef.current.material as THREE.LineBasicMaterial;
      setPalCol(mat.color, t * spd, 1);
      mat.opacity = gridOp;
      floorRef.current.position.set(pX * 0.11 + shake, 0, gridScroll);
    }
    if (ceilRef.current) {
      const mat = ceilRef.current.material as THREE.LineBasicMaterial;
      setPalCol(mat.color, t * spd + 0.5, 1);
      mat.opacity = gridOp * 0.8;
      ceilRef.current.position.set(pX * 0.11 + shake, 0, gridScroll);
    }
    if (sideRefL.current) {
      const mat = sideRefL.current.material as THREE.LineBasicMaterial;
      setPalCol(mat.color, t * spd + 0.25, 1);
      mat.opacity = gridOp * 0.7;
      sideRefL.current.position.set(0, pY * 0.09, gridScroll);
    }
    if (sideRefR.current) {
      const mat = sideRefR.current.material as THREE.LineBasicMaterial;
      setPalCol(mat.color, t * spd + 0.75, 1);
      mat.opacity = gridOp * 0.7;
      sideRefR.current.position.set(0, pY * 0.09, gridScroll);
    }

    // ── Portal arches ─────────────────────────────────────────────────────
    portalRefs.current.forEach((mesh, i) => {
      if (!mesh || !portals[i]) return;
      const pr   = portals[i];
      const mat  = mesh.material as THREE.MeshBasicMaterial;
      // Each portal slowly drifts in rotation
      mesh.rotation.x = pr.tilt[0] + Math.sin(t * 0.07 + i) * 0.04;
      mesh.rotation.y = pr.tilt[1] + Math.cos(t * 0.06 + i) * 0.04;
      mesh.rotation.z = pr.tilt[2] + t * 0.025 * animSpd;
      // Palette locks each portal to its quarter of the gradient, with slow drift
      setPalCol(mat.color, pr.palOff + t * spd * 0.4, 1);
      mat.opacity = 0.22 + Math.sin(t * 0.8 + i * 1.2) * 0.06 + backgroundPulse * 0.14;
    });

    // ── Nexus core (gyroscope) ────────────────────────────────────────────
    if (nexusRef.current) {
      nexusRef.current.position.set(pX * 0.06, pY * 0.06, -44);
      const pulseScale = 1 + backgroundPulse * 0.35 + Math.sin(t * 2.0) * 0.06;
      nexusRef.current.scale.setScalar(pulseScale);
      nexusRef.current.children.forEach((child: THREE.Object3D, j: number) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material as THREE.MeshBasicMaterial;
        if (j === 0) {
          // Outer icosahedron cage
          child.rotation.y = t * 0.08 * animSpd;
          child.rotation.z = t * 0.05 * animSpd;
          setPalCol(mat.color, t * spd * 0.5, 1);
          mat.opacity = 0.055 + backgroundPulse * 0.04;
        } else if (j === 1) {
          // Mid icosahedron cage
          child.rotation.x = t * 0.11 * animSpd;
          child.rotation.y = -t * 0.07 * animSpd;
          setPalCol(mat.color, t * spd * 0.5 + 0.25, 1);
          mat.opacity = 0.075 + backgroundPulse * 0.05;
        } else if (j === 2) {
          // Inner icosahedron cage
          child.rotation.x = -t * 0.09 * animSpd;
          child.rotation.z = t * 0.12 * animSpd;
          setPalCol(mat.color, t * spd * 0.5 + 0.5, 1);
          mat.opacity = 0.10 + backgroundPulse * 0.06;
        } else if (j === 3) {
          // Torus ring – XY plane (equatorial)
          child.rotation.z = t * 0.18 * animSpd;
          setPalCol(mat.color, t * spd + 0.0, 1);
          mat.opacity = 0.28 + backgroundPulse * 0.12;
        } else if (j === 4) {
          // Torus ring – XZ plane (polar)
          child.rotation.y = t * 0.14 * animSpd;
          setPalCol(mat.color, t * spd + 0.33, 1);
          mat.opacity = 0.22 + backgroundPulse * 0.10;
        } else if (j === 5) {
          // Torus ring – YZ plane (side)
          child.rotation.x = t * 0.22 * animSpd;
          setPalCol(mat.color, t * spd + 0.66, 1);
          mat.opacity = 0.22 + backgroundPulse * 0.10;
        } else {
          // Core glow sphere
          setPalCol(mat.color, t * spd * 2, 1);
          mat.opacity = 0.55 + Math.sin(t * 2.4) * 0.12 + backgroundPulse * 0.22;
        }
      });
    }

    // ── Stars ─────────────────────────────────────────────────────────────
    starRefs.current.forEach((mesh, i) => {
      if (!mesh || !stars[i]) return;
      const s      = stars[i];
      const twink  = Math.sin(t * s.twink * animSpd + s.phase) * 0.5 + 0.5;
      mesh.scale.setScalar(s.scale * (0.38 + twink * 0.62));
      const mat = mesh.material as THREE.MeshBasicMaterial;
      // Stars are mostly white with a faint palette tint
      mat.color.set(1, 1, 1);
      mat.opacity = 0.35 + twink * 0.6;
    });

    // ── Nebulae ───────────────────────────────────────────────────────────
    nebulaRefs.current.forEach((mesh, i) => {
      if (!mesh || !nebulae[i]) return;
      const nb  = nebulae[i];
      const pls = Math.sin(t * nb.freq * animSpd + nb.phase) * 0.1 + 1;
      mesh.scale.setScalar(nb.scale * pls);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      setPalCol(mat.color, t * spd * 0.22 + nb.palOff, 1);
      mat.opacity = 0.018 + Math.sin(t * 0.35 + nb.phase) * 0.008;
    });

    // ── Crystal shards ────────────────────────────────────────────────────
    shardGroupRefs.current.forEach((grp, i) => {
      if (!grp || !shards[i]) return;
      const sh = shards[i];
      grp.rotation.x += sh.rx * 0.007 * animSpd;
      grp.rotation.y += sh.ry * 0.005 * animSpd;
      grp.rotation.z += sh.rz * 0.004 * animSpd;
      grp.position.x = sh.baseX + Math.sin(t * sh.floatF * animSpd + sh.phase) * sh.floatA;
      grp.position.y = sh.baseY + Math.cos(t * sh.floatF * 0.7 * animSpd + sh.phase) * sh.floatA * 0.65;
      // child 0 = solid fill, child 1 = wireframe overlay
      grp.children.forEach((child: THREE.Object3D, j: number) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material as THREE.MeshBasicMaterial;
        setPalCol(mat.color, t * spd + sh.palOff, 1);
        if (j === 0) {
          mat.opacity = 0.04 + Math.sin(t * 1.4 + sh.phase) * 0.02 + backgroundPulse * 0.05;
        } else {
          mat.opacity = 0.14 + Math.sin(t * 1.6 + sh.phase) * 0.06 + backgroundPulse * 0.08;
        }
      });
    });

    // ── Energy orbs ───────────────────────────────────────────────────────
    orbRefs.current.forEach((grp, i) => {
      if (!grp || !energyOrbs[i]) return;
      const orb = energyOrbs[i];
      grp.position.x = orb.base[0] + Math.sin(t * orb.oSpd * animSpd + orb.phase) * 5;
      grp.position.y = orb.base[1] + Math.cos(t * orb.oSpd * 0.65 * animSpd + orb.phase) * 3.2;
      const pulse = 1 + Math.sin(t * orb.pFreq) * 0.25 + backgroundPulse * 0.18;
      grp.scale.setScalar(pulse);
      grp.rotation.z = t * 0.38 * animSpd;
      grp.rotation.x = t * 0.21 * animSpd;
      grp.children.forEach((child: THREE.Object3D, j: number) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material as THREE.MeshBasicMaterial;
        setPalCol(mat.color, t * spd + orb.palOff + j * 0.08, 1);
        mat.opacity = j === 0 ? 0.5 : (j === 1 ? 0.18 : 0.10);
      });
    });

    // ── Spiral ring ───────────────────────────────────────────────────────
    spiralRefs.current.forEach((mesh, i) => {
      if (!mesh || !spiralOrbs[i]) return;
      const so    = spiralOrbs[i];
      const angle = so.angle + t * so.speed * animSpd;
      mesh.position.x = Math.cos(angle) * so.radius;
      mesh.position.y = Math.sin(angle) * so.radius * 0.52;
      mesh.position.z = so.z + Math.sin(t * 0.55 + so.phase) * 2;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      setPalCol(mat.color, t * spd + so.palOff, 1);
      const twink = Math.sin(t * 2.8 + so.phase) * 0.5 + 0.5;
      mat.opacity = 0.28 + twink * 0.42 + backgroundPulse * 0.18;
    });

    // ── Meteors ───────────────────────────────────────────────────────────
    meteorRefs.current.forEach((mesh, i) => {
      if (!mesh || !meteors[i]) return;
      const m     = meteors[i];
      const cycle = (t + m.delay) % (m.dur + 6);
      if (cycle < m.dur) {
        const p  = cycle / m.dur;
        mesh.position.x = m.startX + p * m.speedX * m.dur;
        mesh.position.y = m.startY + p * m.speedY * m.dur;
        mesh.visible    = true;
        mesh.rotation.z = Math.atan2(m.speedY, m.speedX);
        const mat   = mesh.material as THREE.MeshBasicMaterial;
        const fade  = Math.min(1, p * 5) * Math.max(0, 1 - (p - 0.65) * 3);
        mat.opacity = fade * 0.9;
        setPalCol(mat.color, t * spd + m.palOff, 1);
      } else {
        mesh.visible = false;
      }
    });

    // ── Pulse rings ───────────────────────────────────────────────────────
    pulseRefs.current.forEach((grp, i) => {
      if (!grp || !pulseRings[i]) return;
      const pr    = pulseRings[i];
      const cycle = (t + pr.delay) % 5.2;
      const p     = cycle / 5.2;
      grp.scale.setScalar((p * pr.maxR) / 10);
      grp.children.forEach((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mat = child.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, (1 - p) * (1 - p)) * 0.24;
        setPalCol(mat.color, t * spd + pr.palOff, 1);
      });
    });
  });

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Pure black void background */}
      <color attach="background" args={[0, 0, 0]} />

      {/* Lighting – one per ORBLITZ palette colour + fill ambient */}
      <ambientLight intensity={0.08} color="#ffffff" />
      <pointLight position={[  0,   0,  8]} intensity={1.2 + backgroundPulse * 0.5} color="#00ffff" distance={55} decay={1.5} />
      <pointLight position={[-16,  12,  2]} intensity={0.6}  color="#aa00ff" distance={42} decay={1.5} />
      <pointLight position={[ 16, -12,  2]} intensity={0.6}  color="#ff00ff" distance={42} decay={1.5} />
      <pointLight position={[  0,   0,-20]} intensity={0.4}  color="#ffff00" distance={50} decay={1.5} />

      {/* ── Neon corridor grids ────────────────────────────────────────── */}
      {/* Floor */}
      <lineSegments ref={floorRef} geometry={FLOOR_GEO}>
        <lineBasicMaterial color="#00ffff" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* Ceiling */}
      <lineSegments ref={ceilRef} geometry={CEIL_GEO}>
        <lineBasicMaterial color="#ff00ff" transparent opacity={0.11} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* Left wall */}
      <lineSegments ref={sideRefL} geometry={SIDE_GEO_L}>
        <lineBasicMaterial color="#aa00ff" transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* Right wall */}
      <lineSegments ref={sideRefR} geometry={SIDE_GEO_R}>
        <lineBasicMaterial color="#ffff00" transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* ── Portal arches – one per ORBLITZ colour ─────────────────────── */}
      {portals.map((pr, i) => (
        <mesh
          key={`portal-${i}`}
          ref={(el) => { if (el) portalRefs.current[i] = el; }}
          position={[0, 0, pr.z]}
          rotation={pr.tilt}
        >
          <torusGeometry args={[pr.radius, 0.12, 8, 96]} />
          <meshBasicMaterial
            color={PALETTE[i]}
            transparent opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Nexus core — gyroscope structure at the far end ────────────── */}
      <group ref={nexusRef} position={[0, 0, -44]}>
        {/* Outer icosahedron cage */}
        <mesh>
          <icosahedronGeometry args={[13, 1]} />
          <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.055} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Mid icosahedron cage */}
        <mesh>
          <icosahedronGeometry args={[9, 1]} />
          <meshBasicMaterial color="#aa00ff" wireframe transparent opacity={0.075} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Inner icosahedron cage */}
        <mesh>
          <icosahedronGeometry args={[5.5, 0]} />
          <meshBasicMaterial color="#ff00ff" wireframe transparent opacity={0.10} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Torus ring – equatorial (XY plane) */}
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[7.5, 0.09, 6, 72]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Torus ring – polar (XZ plane) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[7.5, 0.09, 6, 72]} />
          <meshBasicMaterial color="#aa00ff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Torus ring – side (YZ plane) */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[7.5, 0.09, 6, 72]} />
          <meshBasicMaterial color="#ff00ff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Core glow sphere */}
        <mesh>
          <sphereGeometry args={[2.8, 14, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* ── Stars – twinkling octahedra deep back ───────────────────────── */}
      {stars.map((s, i) => (
        <mesh
          key={`star-${i}`}
          ref={(el) => { if (el) starRefs.current[i] = el; }}
          position={s.pos}
          scale={s.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Nebulae – large soft volumes ────────────────────────────────── */}
      {nebulae.map((nb, i) => (
        <mesh
          key={`neb-${i}`}
          ref={(el) => { if (el) nebulaRefs.current[i] = el; }}
          position={nb.pos}
          scale={nb.scale}
        >
          <sphereGeometry args={[1, 7, 5]} />
          <meshBasicMaterial color={PALETTE[i % 4]} transparent opacity={0.018} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Crystal shards – dual solid + wireframe ─────────────────────── */}
      {shards.map((sh, i) => (
        <group
          key={`shard-${i}`}
          ref={(el) => { if (el) shardGroupRefs.current[i] = el; }}
          position={sh.pos}
          scale={sh.scale}
        >
          {/* Solid fill – very low opacity for dark-glass feel */}
          <mesh>
            {sh.type === 0 && <icosahedronGeometry args={[1, 0]} />}
            {sh.type === 1 && <octahedronGeometry args={[1, 0]} />}
            {sh.type === 2 && <tetrahedronGeometry args={[1, 0]} />}
            {sh.type === 3 && <dodecahedronGeometry args={[1, 0]} />}
            <meshBasicMaterial color={PALETTE[i % 4]} transparent opacity={0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Wireframe overlay – neon edges */}
          <mesh>
            {sh.type === 0 && <icosahedronGeometry args={[1, 0]} />}
            {sh.type === 1 && <octahedronGeometry args={[1, 0]} />}
            {sh.type === 2 && <tetrahedronGeometry args={[1, 0]} />}
            {sh.type === 3 && <dodecahedronGeometry args={[1, 0]} />}
            <meshBasicMaterial color={PALETTE[i % 4]} wireframe transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* ── Energy orbs – sphere core + 2 torus halos ───────────────────── */}
      {energyOrbs.map((orb, i) => (
        <group
          key={`orb-${i}`}
          ref={(el) => { if (el) orbRefs.current[i] = el; }}
          position={orb.base}
        >
          <mesh>
            <sphereGeometry args={[orb.size, 12, 10]} />
            <meshBasicMaterial color={PALETTE[i % 4]} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[orb.size * 1.9, orb.size * 0.065, 6, 24]} />
            <meshBasicMaterial color={PALETTE[(i + 1) % 4]} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <torusGeometry args={[orb.size * 2.6, orb.size * 0.042, 6, 24]} />
            <meshBasicMaterial color={PALETTE[(i + 2) % 4]} transparent opacity={0.10} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* ── Spiral ring of orbs ─────────────────────────────────────────── */}
      {spiralOrbs.map((so, i) => (
        <mesh
          key={`spiral-${i}`}
          ref={(el) => { if (el) spiralRefs.current[i] = el; }}
          position={[Math.cos(so.angle) * so.radius, Math.sin(so.angle) * so.radius * 0.52, so.z]}
          scale={so.size}
        >
          <sphereGeometry args={[1, 5, 4]} />
          <meshBasicMaterial color={PALETTE[i % 4]} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Meteors ─────────────────────────────────────────────────────── */}
      {meteors.map((m, i) => (
        <mesh
          key={`meteor-${i}`}
          ref={(el) => { if (el) meteorRefs.current[i] = el; }}
          position={[m.startX, m.startY, -16]}
          visible={false}
        >
          <boxGeometry args={[m.w, m.len * 3, m.w * 0.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* ── Expanding pulse rings ────────────────────────────────────────── */}
      {pulseRings.map((pr, i) => (
        <group
          key={`pulse-${i}`}
          ref={(el) => { if (el) pulseRefs.current[i] = el; }}
          position={[0, 0, -24]}
        >
          <mesh>
            <torusGeometry args={[10, 0.22, 6, 52]} />
            <meshBasicMaterial color={PALETTE[i % 4]} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* ── Distort active: gyroscope rings around player ───────────────── */}
      {distortActive && (
        <group position={[playerPosition[0], playerPosition[1], -6]}>
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[4.5, 0.18, 8, 48]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <torusGeometry args={[6.0, 0.12, 8, 48]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[7.5, 0.08, 6, 48]} />
            <meshBasicMaterial color="#ffff00" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      )}
    </>
  );
}
