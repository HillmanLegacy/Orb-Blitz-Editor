/**
 * OrbitalRings — 10 distinct modular ring sets for the player orb.
 * Each ring is a self-contained R3F component animated entirely in useFrame.
 * Shared module-level geometries and materials are reused across frames.
 */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RingStyle } from "@/lib/stores/useShop";

interface RingProps { scale: number }

// ── Shared pooled helpers ─────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _col   = new THREE.Color();

// Shared geometries (never disposed — module-level singletons)
const _geo_xs   = new THREE.SphereGeometry(0.018, 4, 3);
const _geo_sm   = new THREE.SphereGeometry(0.032, 5, 3);
const _geo_tri  = new THREE.CircleGeometry(0.055, 3);
const _geo_cone = new THREE.ConeGeometry(0.042, 0.17, 4);

// Shared materials for instanced meshes with vertexColors
const _mat_vc = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Eclipse Horizon — Dual-Axis Gyroscope (cyan / cobalt)
//    Primary plasma disk + two 45° metallic hoops + 8 orbiting shard markers.
// ─────────────────────────────────────────────────────────────────────────────
function EclipseHorizon({ scale }: RingProps) {
  const r         = scale * 2.0;
  const equatorRef = useRef<THREE.Mesh>(null);
  const hoop1Ref   = useRef<THREE.Mesh>(null);
  const hoop2Ref   = useRef<THREE.Mesh>(null);
  const shardMat   = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true }), []);
  const shardRef   = useRef<THREE.InstancedMesh>(null);
  useEffect(() => () => { shardMat.dispose(); }, [shardMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (equatorRef.current) equatorRef.current.rotation.z = t * 1.2;
    if (hoop1Ref.current)   hoop1Ref.current.rotation.z  = -t * 1.8;
    if (hoop2Ref.current)   hoop2Ref.current.rotation.z  =  t * 1.5;
    const im = shardRef.current;
    if (!im) return;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t;
      _dummy.position.set(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, 0.06);
      _dummy.rotation.z = a + Math.PI / 4;
      _dummy.scale.setScalar(0.9 + Math.sin(t * 3 + i) * 0.2);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(i % 2 === 0 ? "#00FFFF" : "#0044FF");
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#0088ff" intensity={1.2} distance={4} decay={2} />
      <mesh ref={equatorRef}>
        <ringGeometry args={[r * 0.82, r, 64]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.60} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[r * 0.74, r * 0.83, 64]} />
        <meshBasicMaterial color="#0033FF" transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={hoop1Ref} rotation={[Math.PI / 4, 0, 0]}>
        <ringGeometry args={[r * 0.68, r * 0.74, 48]} />
        <meshBasicMaterial color="#55CCFF" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={hoop2Ref} rotation={[-Math.PI / 4, 0, 0]}>
        <ringGeometry args={[r * 0.68, r * 0.74, 48]} />
        <meshBasicMaterial color="#0077FF" transparent opacity={0.50} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={shardRef} args={[_geo_tri, shardMat, 8]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Singularity Event — Gravitational Accretion Disk (orange / violet)
//    Black event horizon + violent accretion disk + 60 swirling particle eddies.
// ─────────────────────────────────────────────────────────────────────────────
const _N_ACCR = 60;
const _mat_accr = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function SingularityEvent({ scale }: RingProps) {
  const r       = scale * 2.0;
  const diskRef = useRef<THREE.Mesh>(null);
  const partRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (diskRef.current) diskRef.current.rotation.z = t * 3.5;
    const im = partRef.current;
    if (!im) return;
    for (let i = 0; i < _N_ACCR; i++) {
      const base  = (i / _N_ACCR) * Math.PI * 2;
      const curl  = Math.sin(t * 1.5 + i * 0.3) * 0.5;
      const a     = base + t * 2.8 + curl;
      const rad   = r * (0.58 + (i % 4) * 0.12 + Math.sin(t * 3 + i * 0.7) * 0.08);
      _dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad, (Math.random() - 0.5) * 0.06);
      _dummy.scale.setScalar(0.45 + Math.sin(t * 8 + i) * 0.3);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(i % 2 === 0 ? "#FF4500" : "#8A2BE2");
      _col.multiplyScalar(0.75 + Math.sin(t * 5 + i) * 0.25);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff5500" intensity={1.5} distance={4} decay={2} />
      {/* Event horizon — pitch black */}
      <mesh>
        <ringGeometry args={[r * 0.28, r * 0.54, 64]} />
        <meshBasicMaterial color="#0a0005" transparent opacity={0.97} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Outer accretion disk */}
      <mesh ref={diskRef}>
        <ringGeometry args={[r * 0.54, r, 64]} />
        <meshBasicMaterial color="#FF4500" transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Violet outer rim */}
      <mesh>
        <ringGeometry args={[r * 0.97, r * 1.06, 48]} />
        <meshBasicMaterial color="#8A2BE2" transparent opacity={0.40} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={partRef} args={[_geo_sm, _mat_accr, _N_ACCR]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Celestial Aegis — Paladin Hard-Light Runes (gold / white)
//    Three hexagonal rings with clockwork step-rotation every 0.8s.
// ─────────────────────────────────────────────────────────────────────────────
const _runeMat = new THREE.MeshBasicMaterial({ color: "#FFD700", transparent: true, opacity: 0.85, depthWrite: false });

function CelestialAegis({ scale }: RingProps) {
  const r      = scale * 2.0;
  const r1Ref  = useRef<THREE.Mesh>(null);
  const r2Ref  = useRef<THREE.Mesh>(null);
  const r3Ref  = useRef<THREE.Mesh>(null);
  const runeRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Step snap: advance 30° every 0.8s with a brief ease at the end of each interval
    const stepIdx = Math.floor(t / 0.8);
    const frac    = (t % 0.8) / 0.8;
    const ease    = frac > 0.88 ? THREE.MathUtils.mapLinear(frac, 0.88, 1, 0, 1) : 0;
    const curRot  = (stepIdx + ease) * (Math.PI / 6);

    if (r1Ref.current)  r1Ref.current.rotation.z  =  curRot;
    if (r2Ref.current)  r2Ref.current.rotation.z  = -curRot * 0.67;
    if (r3Ref.current)  r3Ref.current.rotation.z  =  curRot * 1.33;

    const im = runeRef.current;
    if (!im) return;
    for (let i = 0; i < 12; i++) {
      const a   = (i / 12) * Math.PI * 2 + curRot;
      const rad = r * (0.58 + (i % 3) * 0.19);
      _dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad, 0.04);
      _dummy.rotation.z = a;
      _dummy.scale.setScalar(0.65 + Math.sin(t * 2 + i) * 0.2);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#FFD700" intensity={1.2} distance={4} decay={2} />
      <mesh ref={r1Ref}>
        <ringGeometry args={[r * 0.60, r * 0.68, 6]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={r2Ref}>
        <ringGeometry args={[r * 0.74, r * 0.81, 6]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={r3Ref}>
        <ringGeometry args={[r * 0.87, r * 0.94, 6]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.60} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[r * 0.95, r, 48]} />
        <meshBasicMaterial color="#FFEEAA" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={runeRef} args={[_geo_tri, _runeMat, 12]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Chronos Clockwork — Temporal Gear Matrix (brass / cyan)
//    Four rings at precise gear ratios + cyan timeline overlay.
// ─────────────────────────────────────────────────────────────────────────────
function ChronosClockwork({ scale }: RingProps) {
  const r    = scale * 2.0;
  const g1   = useRef<THREE.Mesh>(null);
  const g2   = useRef<THREE.Mesh>(null);
  const g3   = useRef<THREE.Mesh>(null);
  const g4   = useRef<THREE.Mesh>(null);
  const tl   = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (g1.current)  g1.current.rotation.z  =  t * 0.60;          // outer slow CW
    if (g2.current)  g2.current.rotation.z  = -t * 0.60 * 1.500;  // gear ratio 1.5
    if (g3.current)  g3.current.rotation.z  =  t * 0.60 * 2.200;  // gear ratio 2.2
    if (g4.current)  g4.current.rotation.z  = -t * 0.60 * 3.100;  // gear ratio 3.1
    if (tl.current)  tl.current.rotation.z  =  t * 2.0;
  });

  return (
    <group>
      <pointLight color="#B8860B" intensity={1.2} distance={4} decay={2} />
      {/* Outer brass gear */}
      <mesh ref={g1}>
        <ringGeometry args={[r * 0.88, r, 12]} />
        <meshBasicMaterial color="#B8860B" transparent opacity={0.70} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={g2}>
        <ringGeometry args={[r * 0.72, r * 0.82, 10]} />
        <meshBasicMaterial color="#CD853F" transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={g3}>
        <ringGeometry args={[r * 0.56, r * 0.65, 8]} />
        <meshBasicMaterial color="#DAA520" transparent opacity={0.60} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={g4}>
        <ringGeometry args={[r * 0.40, r * 0.48, 6]} />
        <meshBasicMaterial color="#B8860B" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Cyan timeline */}
      <mesh ref={tl}>
        <ringGeometry args={[r * 0.76, r * 0.80, 64]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.50} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Void Tendril Vortex — Dark Matter Fluid (indigo / magenta)
//    Pure particle system — no solid geometry. Curl-noise-like swirl.
// ─────────────────────────────────────────────────────────────────────────────
const _N_VOID = 80;
const _mat_void = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function VoidTendril({ scale }: RingProps) {
  const r   = scale * 2.0;
  const ref = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = ref.current;
    if (!im) return;
    for (let i = 0; i < _N_VOID; i++) {
      const base  = (i / _N_VOID) * Math.PI * 2;
      const curl1 = Math.sin(base * 3 + t * 1.2) * 0.5;
      const curl2 = Math.cos(base * 2 + t * 0.9) * 0.4;
      const a     = base + t * 0.7 + curl1;
      const rad   = r * (0.42 + Math.abs(Math.sin(base * 2 + t * 0.6)) * 0.60 + curl2 * 0.25);
      _dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad, Math.sin(t * 2 + i * 0.4) * 0.15);
      _dummy.scale.setScalar(0.55 + Math.sin(t * 5 + i * 0.8) * 0.42);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      const frac = i / _N_VOID;
      _col.setHex(frac < 0.4 ? 0x1A002C : frac < 0.7 ? 0x660044 : 0xFF0055);
      _col.multiplyScalar(0.65 + Math.sin(t * 6 + i) * 0.35);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#aa0066" intensity={1.2} distance={4} decay={2} />
      <instancedMesh ref={ref} args={[_geo_sm, _mat_void, _N_VOID]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Hyper-Tech Collider — Particle Accelerator (carbon + white plasma beams)
//    Twin beams orbit at extreme speed in opposite directions inside housing ring.
// ─────────────────────────────────────────────────────────────────────────────
const _N_BEAM = 80;
const _mat_beam = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function HyperCollider({ scale }: RingProps) {
  const r      = scale * 2.0;
  const beamRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = beamRef.current;
    if (!im) return;
    const half = _N_BEAM / 2;
    for (let i = 0; i < _N_BEAM; i++) {
      const dir  = i < half ? 1 : -1;
      const idx  = i < half ? i : i - half;
      const a    = (idx / half) * Math.PI * 2 + t * dir * 8.0;
      const beamR = r * 0.85;
      _dummy.position.set(Math.cos(a) * beamR, Math.sin(a) * beamR, 0.04);
      _dummy.scale.setScalar(0.38 + Math.sin(t * 22 + i) * 0.25);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(dir > 0 ? "#FFFFFF" : "#AADDFF");
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#aaddff" intensity={1.6} distance={4} decay={2} />
      {/* Carbon-fiber housing */}
      <mesh>
        <ringGeometry args={[r * 0.79, r, 64]} />
        <meshBasicMaterial color="#16161e" transparent opacity={0.92} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Glowing glass track */}
      <mesh>
        <ringGeometry args={[r * 0.82, r * 0.88, 64]} />
        <meshBasicMaterial color="#4488FF" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={beamRef} args={[_geo_xs, _mat_beam, _N_BEAM]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Solar Flare Corona — Sunspot Plasma Waves (white-gold GLSL torus + embers)
//    Custom ShaderMaterial drives vertex displacement solar prominences.
// ─────────────────────────────────────────────────────────────────────────────
const _solarVert = /* glsl */`
  uniform float u_time;
  varying float vDisp;
  void main() {
    vec3 p = position;
    float d = sin(p.x * 14.0 + u_time * 3.0) * cos(p.z * 9.0 + u_time * 2.2) * 0.18;
    d += cos(p.y * 11.0 + u_time * 4.0) * sin(p.x * 6.0 + u_time * 1.5) * 0.10;
    vDisp = d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + normal * d, 1.0);
  }
`;
const _solarFrag = /* glsl */`
  uniform float u_time;
  varying float vDisp;
  void main() {
    float heat = clamp(vDisp * 5.0 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.45, 0.0), vec3(1.0, 1.0, 0.92), heat);
    gl_FragColor = vec4(col, 0.82 - abs(heat - 0.5) * 0.5);
  }
`;
const _N_EMBERS = 36;
const _mat_embers = new THREE.MeshBasicMaterial({ color: "#FFA500", transparent: true, depthWrite: false });

function SolarCorona({ scale }: RingProps) {
  const r        = scale * 2.0;
  const torusRef = useRef<THREE.Mesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const uTime    = useRef({ value: 0 });
  const solarMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   _solarVert,
    fragmentShader: _solarFrag,
    uniforms: { u_time: uTime.current },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);
  useEffect(() => () => { solarMat.dispose(); }, [solarMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uTime.current.value = t;
    if (torusRef.current) {
      torusRef.current.rotation.z = t * 0.35;
      torusRef.current.rotation.x = Math.sin(t * 0.4) * 0.14;
    }
    const im = emberRef.current;
    if (!im) return;
    for (let i = 0; i < _N_EMBERS; i++) {
      const baseA = (i / _N_EMBERS) * Math.PI * 2;
      const drift = t * (0.38 + (i % 5) * 0.08) + Math.sin(t * 1.5 + i) * 0.4;
      const a     = baseA + drift;
      const rr    = r * (1.04 + Math.sin(t * 2 + i * 0.8) * 0.2);
      _dummy.position.set(Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(t * 3 + i) * 0.1);
      _dummy.scale.setScalar(0.45 + Math.sin(t * 8 + i * 1.2) * 0.38);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#FF8800" intensity={1.5} distance={5} decay={2} />
      <mesh ref={torusRef} material={solarMat}>
        <torusGeometry args={[r * 0.88, r * 0.11, 24, 64]} />
      </mesh>
      <instancedMesh ref={emberRef} args={[_geo_xs, _mat_embers, _N_EMBERS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Prismatic Lattice — Crystalline Light Refraction (rainbow crystal shards)
//    12 crystal cone shards bob individually on sine waves + rainbow color cycle.
// ─────────────────────────────────────────────────────────────────────────────
const _mat_crystal = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });
const _N_CRYSTALS  = 12;

function PrismaticLattice({ scale }: RingProps) {
  const r        = scale * 2.0;
  const shardRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = shardRef.current;
    if (!im) return;
    for (let i = 0; i < _N_CRYSTALS; i++) {
      const baseA = (i / _N_CRYSTALS) * Math.PI * 2;
      const drift = t * 0.5 * (i % 2 === 0 ? 1 : -1);
      const a     = baseA + drift;
      const bob   = Math.sin(t * 1.8 + i * 0.7) * 0.22 * scale;
      _dummy.position.set(
        Math.cos(a) * r * 0.90,
        Math.sin(a) * r * 0.90 + bob,
        Math.sin(t * 2.5 + i * 0.5) * 0.10
      );
      _dummy.rotation.z = a + t * (i % 2 === 0 ? 0.8 : -0.6);
      _dummy.scale.setScalar(0.78 + Math.sin(t * 3 + i * 1.3) * 0.28);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setHSL((t * 0.08 + i / _N_CRYSTALS) % 1, 1.0, 0.65);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ffffff" intensity={1.2} distance={4} decay={2} />
      <mesh>
        <ringGeometry args={[r * 0.85, r, 64]} />
        <meshBasicMaterial color="#88FFFF" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={shardRef} args={[_geo_cone, _mat_crystal, _N_CRYSTALS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Zero-Point Tesla — High-Voltage Energy Grid (copper rings + arc lightning)
//    12 procedural lightning arcs updated every frame; copper conductor rings.
// ─────────────────────────────────────────────────────────────────────────────
const _N_ARCS  = 12;
const _N_SEGS  = 10; // points per arc

function ZeroTesla({ scale }: RingProps) {
  const r        = scale * 2.0;
  const groupRef = useRef<THREE.Group>(null);

  // Create arc lines imperatively (geometry updated every frame)
  const arcData = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.85, depthWrite: false });
    const arcs = Array.from({ length: _N_ARCS }, () => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(_N_SEGS * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return { line: new THREE.Line(geo, mat), geo, pos };
    });
    return { arcs, mat };
  }, []);

  // Add lines to group after first render; dispose on unmount
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    arcData.arcs.forEach(({ line }) => g.add(line));
    return () => {
      arcData.arcs.forEach(({ line, geo }) => { g.remove(line); geo.dispose(); });
      arcData.mat.dispose();
    };
  }, [arcData]);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    arcData.arcs.forEach(({ line, geo, pos }, i) => {
      const startA = (i / _N_ARCS) * Math.PI * 2;
      const span   = Math.PI * 2 * (0.14 + (i % 3) * 0.06);
      const endA   = startA + span;
      const sx = Math.cos(startA) * r * 0.9, sy = Math.sin(startA) * r * 0.9;
      const ex = Math.cos(endA)   * r * 0.9, ey = Math.sin(endA)   * r * 0.9;
      pos[0] = sx; pos[1] = sy; pos[2] = 0.05;
      for (let s = 1; s < _N_SEGS - 1; s++) {
        const frac   = s / (_N_SEGS - 1);
        const spread = 0.38 * (1 - Math.abs(frac - 0.5) * 2);
        const nx = Math.sin(t * 22 + i * 3.7 + s * 1.9) * spread * r * 0.50;
        const ny = Math.cos(t * 18 + i * 2.3 + s * 2.5) * spread * r * 0.50;
        pos[s * 3]     = sx + (ex - sx) * frac + nx;
        pos[s * 3 + 1] = sy + (ey - sy) * frac + ny;
        pos[s * 3 + 2] = 0.05;
      }
      pos[(_N_SEGS - 1) * 3]     = ex;
      pos[(_N_SEGS - 1) * 3 + 1] = ey;
      pos[(_N_SEGS - 1) * 3 + 2] = 0.05;
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (line.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(t * 30 + i * 4.1) * 0.38;
    });
  });

  return (
    <group ref={groupRef}>
      <pointLight color="#ffffff" intensity={2.0} distance={4} decay={2} />
      {/* Copper conductor ring 1 */}
      <mesh>
        <ringGeometry args={[r * 0.84, r * 0.93, 48]} />
        <meshBasicMaterial color="#B87333" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Copper conductor ring 2 — tilted */}
      <mesh rotation={[Math.PI / 6, 0, 0]}>
        <ringGeometry args={[r * 0.84, r * 0.93, 48]} />
        <meshBasicMaterial color="#CD7F32" transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Astral Nebula Ring — Stardust Cosmic Halo (magenta / teal / gold)
//     200 twinkling star instances orbiting in a gentle miniature galaxy swirl.
// ─────────────────────────────────────────────────────────────────────────────
const _N_STARS   = 200;
const _STAR_COLS = ["#FF00AA", "#00F0FF", "#FFD700", "#FF88CC", "#88FFFF", "#FFEE88"] as const;
const _mat_stars = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

function AstralNebula({ scale }: RingProps) {
  const r       = scale * 2.0;
  const starRef = useRef<THREE.InstancedMesh>(null);

  const starData = useMemo(() => Array.from({ length: _N_STARS }, (_, i) => ({
    baseAngle: (i / _N_STARS) * Math.PI * 2 + (Math.sin(i * 7.3) * 0.3),
    radius:    r * (0.48 + (Math.sin(i * 3.1) * 0.5 + 0.5) * 0.57),
    speed:     0.12 + (Math.sin(i * 11.7) * 0.5 + 0.5) * 0.24,
    phase:     Math.sin(i * 5.9) * Math.PI * 2,
    size:      0.28 + (Math.sin(i * 8.3) * 0.5 + 0.5) * 0.72,
    colorIdx:  i % _STAR_COLS.length,
    zOff:      Math.sin(i * 4.1) * 0.12,
  })), [r]);

  useFrame(({ clock }) => {
    const t  = clock.getElapsedTime();
    const im = starRef.current;
    if (!im) return;
    for (let i = 0; i < _N_STARS; i++) {
      const s = starData[i];
      const a = s.baseAngle + t * s.speed;
      _dummy.position.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius, s.zOff);
      _dummy.scale.setScalar(s.size * (0.48 + Math.sin(t * 4 + s.phase) * 0.46));
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _col.setStyle(_STAR_COLS[s.colorIdx]);
      _col.multiplyScalar(0.55 + Math.sin(t * 3 + s.phase) * 0.45);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff44aa" intensity={1.2} distance={5} decay={2} />
      {/* Soft nebula haze */}
      <mesh>
        <ringGeometry args={[r * 0.43, r * 1.08, 64]} />
        <meshBasicMaterial color="#440022" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={starRef} args={[_geo_xs, _mat_stars, _N_STARS]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — mounts the active ring set based on equipped style
// ─────────────────────────────────────────────────────────────────────────────
export function OrbitalRings({ style, scale }: { style: RingStyle; scale: number }) {
  switch (style) {
    case "eclipse_horizon":   return <EclipseHorizon   scale={scale} />;
    case "singularity_event": return <SingularityEvent scale={scale} />;
    case "celestial_aegis":   return <CelestialAegis   scale={scale} />;
    case "chronos_clockwork": return <ChronosClockwork scale={scale} />;
    case "void_tendril":      return <VoidTendril      scale={scale} />;
    case "hyper_collider":    return <HyperCollider    scale={scale} />;
    case "solar_corona":      return <SolarCorona      scale={scale} />;
    case "prismatic_lattice": return <PrismaticLattice scale={scale} />;
    case "zero_tesla":        return <ZeroTesla        scale={scale} />;
    case "astral_nebula":     return <AstralNebula     scale={scale} />;
    default:                  return null;
  }
}
