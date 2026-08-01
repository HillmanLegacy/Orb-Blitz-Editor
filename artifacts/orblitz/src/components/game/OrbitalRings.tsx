/**
 * OrbitalRings — 10 distinct modular ring sets for the player orb.
 * Each ring is a self-contained R3F component animated entirely in useFrame.
 * Shared module-level geometries and materials are reused across frames.
 */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RingStyle } from "@/lib/stores/useShop";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

interface RingProps { scale: number }

// ── Shared pooled helpers ─────────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _col   = new THREE.Color();

// ── ElectrifiedAura shader strings ───────────────────────────────────────────
const _auraVert = /* glsl */`
  uniform float u_time;
  uniform float u_intensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float nx = sin(position.x * 12.0 + u_time * 5.0) * cos(position.y *  9.0 + u_time * 4.0);
    float ny = cos(position.y * 10.0 + u_time * 5.5) * sin(position.z *  8.0 + u_time * 3.5);
    float nz = sin(position.z * 11.0 + u_time * 4.5) * cos(position.x *  7.0 + u_time * 6.0);
    vec3 displaced = position + normal * (nx + ny + nz) * 0.05 * u_intensity;
    vec4 worldPos  = modelViewMatrix * vec4(displaced, 1.0);
    vNormal  = normalize(normalMatrix * normal);
    vViewDir = normalize(-worldPos.xyz);
    gl_Position = projectionMatrix * worldPos;
  }
`;
const _auraFrag = /* glsl */`
  uniform float u_time;
  uniform float u_intensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float NdotV  = max(dot(vNormal, vViewDir), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.5);
    float f1  = sin(vNormal.x * 8.0 + u_time * 6.0) * 0.5 + 0.5;
    float f2  = cos(vNormal.y * 6.0 + u_time * 4.5) * 0.5 + 0.5;
    float flow = f1 * f2;
    vec3 col  = mix(vec3(0.0, 1.0, 1.0), vec3(1.0), fresnel * 0.8);
    col = mix(col, vec3(0.1, 0.0, 1.0), flow * 0.35);
    col += vec3(1.0) * flow * 0.2 * u_intensity;
    float alpha = (fresnel * 0.75 + flow * 0.18) * u_intensity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── ElectrifiedAura arc constants ─────────────────────────────────────────────
const _N_SPARKS   = 200;
const _N_ARCS     = 16;
const _N_BRANCHES = 24;
const _ARC_PTS    = 14;
const _BRANCH_PTS = 7;

// Shared geometries (never disposed — module-level singletons)
const _geo_xs   = new THREE.SphereGeometry(0.018, 4, 3);
const _geo_sm   = new THREE.SphereGeometry(0.032, 5, 3);
const _geo_tri  = new THREE.CircleGeometry(0.055, 3);
const _geo_cone = new THREE.ConeGeometry(0.042, 0.17, 4);

// Shared materials for instanced meshes with vertexColors
const _mat_vc = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, vertexColors: true });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Electrified Aura — High-Voltage Electrical Field
//    Fresnel plasma shell + 16 main arc lines + 24 branch tendrils + 200 ionic sparks.
//    Impact burst fires when the player takes damage (reads isDamaged from game state).
// ─────────────────────────────────────────────────────────────────────────────
function ElectrifiedAura({ scale }: RingProps) {
  const isDamaged    = useMagicOrb(s => s.isDamaged);
  const isDamagedRef = useRef(isDamaged);
  isDamagedRef.current = isDamaged;

  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);

  // Plasma-shell uniforms (shared ref → shader sees latest values without re-creating material)
  const uniforms = useRef({ u_time: { value: 0 }, u_intensity: { value: 1.0 } });

  const auraMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   _auraVert,
    fragmentShader: _auraFrag,
    uniforms:        uniforms.current,
    transparent:     true,
    blending:        THREE.AdditiveBlending,
    side:            THREE.DoubleSide,
    depthWrite:      false,
  }), []);
  useEffect(() => () => { auraMat.dispose(); }, [auraMat]);

  // Spark instanced mesh material — additive blending + per-instance colors
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => { sparkMat.dispose(); }, [sparkMat]);

  // Spark pool — zero-alloc Float32Array state, pooled by slot index
  const _ss = useRef({
    pos:     new Float32Array(_N_SPARKS * 3),
    vel:     new Float32Array(_N_SPARKS * 3),
    life:    new Float32Array(_N_SPARKS),
    maxLife: new Float32Array(_N_SPARKS),
    slot:    0,
  });
  const _prevDamaged = useRef(false);

  // Arc network — 16 main arcs + 24 branch tendrils (THREE.Line, added imperatively)
  const arcData = useMemo(() => {
    const matW = new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.90, depthWrite: false, blending: THREE.AdditiveBlending });
    const matC = new THREE.LineBasicMaterial({ color: "#00FFFF", transparent: true, opacity: 0.70, depthWrite: false, blending: THREE.AdditiveBlending });
    const matV = new THREE.LineBasicMaterial({ color: "#4400FF", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    const mats = [matW, matC, matV];

    // Golden-angle distribution — evenly spread anchor points on unit sphere
    const anchors: [number, number, number][] = Array.from({ length: _N_ARCS * 2 }, (_, i) => {
      const phi   = Math.acos(1 - 2 * ((i * 0.618034) % 1));
      const theta = i * 2.399963;
      return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
    });

    const mains = Array.from({ length: _N_ARCS }, (_, i) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(_ARC_PTS * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return {
        line: new THREE.Line(geo, mats[i % 3]), geo, pos,
        a0: anchors[i], a1: anchors[i + _N_ARCS],
        phase: Math.sin(i * 7.3) * Math.PI * 2,
      };
    });

    const branches = Array.from({ length: _N_BRANCHES }, (_, i) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(_BRANCH_PTS * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return {
        line: new THREE.Line(geo, matC), geo, pos,
        parentIdx: i % _N_ARCS,
        branchT: 0.25 + (i % 3) * 0.2,  // branch point along parent arc
        phase: Math.cos(i * 3.7) * Math.PI * 2,
      };
    });

    return { mains, branches, mats };
  }, []);

  // Mount/unmount arc lines imperatively into the group
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    arcData.mains.forEach(({ line }) => g.add(line));
    arcData.branches.forEach(({ line }) => g.add(line));
    return () => {
      arcData.mains.forEach(({ line, geo }) => { g.remove(line); geo.dispose(); });
      arcData.branches.forEach(({ line, geo }) => { g.remove(line); geo.dispose(); });
      arcData.mats.forEach(m => m.dispose());
    };
  }, [arcData]);

  useFrame(({ clock }, delta) => {
    const t   = clock.getElapsedTime();
    const r   = scale * 0.88;           // arc/spark radius ≈ orb surface
    const dt  = Math.min(delta, 0.05);
    const uni = uniforms.current;

    // Plasma shell time + intensity decay after burst flash
    uni.u_time.value = t;
    if (uni.u_intensity.value > 1.0) {
      uni.u_intensity.value = Math.max(1.0, uni.u_intensity.value - dt * 3.5);
    }

    // Flicker point light: compound sin at inharmonic frequencies for organic stutter
    if (lightRef.current) {
      lightRef.current.intensity = 2.0 + Math.sin(t * 47) * 0.9 + Math.sin(t * 73.1) * 1.1;
    }

    // ── Main arc network ──────────────────────────────────────────────────────
    for (let ai = 0; ai < _N_ARCS; ai++) {
      const { geo, pos, a0, a1, phase } = arcData.mains[ai];
      const sx = a0[0]*r, sy = a0[1]*r, sz = a0[2]*r;
      const ex = a1[0]*r, ey = a1[1]*r, ez = a1[2]*r;
      const dx = ex-sx, dy = ey-sy, dz = ez-sz;
      const arcL = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

      // Build two perpendicular axes to the arc direction (for 3D jitter)
      const ux = Math.abs(dx/arcL) < 0.9 ? 1 : 0, uy = ux ? 0 : 1;
      const p1x = (dy*0 - dz*uy)/arcL, p1y = (dz*ux - dx*0)/arcL, p1z = (dx*uy - dy*ux)/arcL;
      const p2x = dy*p1z - dz*p1y, p2y = dz*p1x - dx*p1z, p2z = dx*p1y - dy*p1x;
      const p2L = Math.sqrt(p2x*p2x + p2y*p2y + p2z*p2z) || 1;

      pos[0] = sx; pos[1] = sy; pos[2] = sz;
      for (let s = 1; s < _ARC_PTS - 1; s++) {
        const f     = s / (_ARC_PTS - 1);
        const taper = Math.sin(f * Math.PI);   // taper: 0 at endpoints, 1 at midpoint
        const j1    = Math.sin(t * 28 + phase + ai * 2.71 + s * 3.14) * taper * r * 0.55;
        const j2    = Math.cos(t * 19 + phase + ai * 1.83 + s * 2.41) * taper * r * 0.40;
        pos[s*3]   = sx + dx*f + p1x*j1 + (p2x/p2L)*j2;
        pos[s*3+1] = sy + dy*f + p1y*j1 + (p2y/p2L)*j2;
        pos[s*3+2] = sz + dz*f + p1z*j1 + (p2z/p2L)*j2;
      }
      pos[(_ARC_PTS-1)*3]   = ex;
      pos[(_ARC_PTS-1)*3+1] = ey;
      pos[(_ARC_PTS-1)*3+2] = ez;
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (arcData.mains[ai].line.material as THREE.LineBasicMaterial).opacity =
        (0.58 + Math.sin(t * 45 + phase) * 0.38) * Math.min(uni.u_intensity.value, 1.8);
    }

    // ── Branch tendrils ───────────────────────────────────────────────────────
    for (let bi = 0; bi < _N_BRANCHES; bi++) {
      const { geo, pos, parentIdx, branchT, phase } = arcData.branches[bi];
      const pPos = arcData.mains[parentIdx].pos;
      const pPt  = Math.min(Math.floor(branchT * (_ARC_PTS - 1)), _ARC_PTS - 2);
      const bx = pPos[pPt*3], by = pPos[pPt*3+1], bz = pPos[pPt*3+2];
      const endX = bx + Math.cos(phase + t * 0.07) * r * 0.45;
      const endY = by + Math.sin(phase * 1.3 + t * 0.09) * r * 0.45;
      const endZ = bz + Math.sin(phase * 0.8 + t * 0.06) * r * 0.32;
      pos[0] = bx; pos[1] = by; pos[2] = bz;
      for (let s = 1; s < _BRANCH_PTS; s++) {
        const f      = s / (_BRANCH_PTS - 1);
        const taper  = Math.sin(f * Math.PI);
        const jitter = Math.sin(t * 38 + phase + bi * 5.1 + s * 2.7) * taper * r * 0.18;
        pos[s*3]   = bx + (endX-bx)*f + jitter;
        pos[s*3+1] = by + (endY-by)*f + jitter * 0.8;
        pos[s*3+2] = bz + (endZ-bz)*f + jitter * 0.6;
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (arcData.branches[bi].line.material as THREE.LineBasicMaterial).opacity =
        0.32 + Math.sin(t * 60 + phase) * 0.28;
    }

    // ── Impact burst (isDamaged rising edge) ──────────────────────────────────
    const ss = _ss.current;
    if (isDamagedRef.current && !_prevDamaged.current) {
      for (let i = 0; i < _N_SPARKS; i++) {
        const phi = Math.acos(1 - 2 * Math.random()), theta = Math.random() * Math.PI * 2;
        const nx = Math.sin(phi)*Math.cos(theta), ny = Math.sin(phi)*Math.sin(theta), nz = Math.cos(phi);
        const i3 = i * 3;
        ss.pos[i3]   = nx*r; ss.pos[i3+1] = ny*r; ss.pos[i3+2] = nz*r;
        const sp = (6 + Math.random()*6) * r;
        ss.vel[i3]   = nx*sp + (Math.random()-0.5)*2*r;
        ss.vel[i3+1] = ny*sp + (Math.random()-0.5)*2*r;
        ss.vel[i3+2] = nz*sp + (Math.random()-0.5)*2*r;
        const life = 0.28 + Math.random()*0.32;
        ss.life[i] = life; ss.maxLife[i] = life;
      }
      uni.u_intensity.value = 2.8;   // flash the plasma shell
    }
    _prevDamaged.current = isDamagedRef.current;

    // ── Continuous spark spawn (~3 per frame at idle) ─────────────────────────
    for (let sp = 0; sp < 3; sp++) {
      const slot = ss.slot;
      if (ss.life[slot] <= 0) {
        const phi = Math.acos(1 - 2 * Math.random()), theta = Math.random() * Math.PI * 2;
        const nx = Math.sin(phi)*Math.cos(theta), ny = Math.sin(phi)*Math.sin(theta), nz = Math.cos(phi);
        const i3 = slot * 3;
        ss.pos[i3]   = nx*r; ss.pos[i3+1] = ny*r; ss.pos[i3+2] = nz*r;
        const spd = (1.5 + Math.random()*2.5) * r;
        ss.vel[i3]   = nx*spd + (Math.random()-0.5)*spd*0.5;
        ss.vel[i3+1] = ny*spd + (Math.random()-0.5)*spd*0.5;
        ss.vel[i3+2] = nz*spd + (Math.random()-0.5)*spd*0.5;
        const life = 0.15 + Math.random()*0.28;
        ss.life[slot] = life; ss.maxLife[slot] = life;
      }
      ss.slot = (slot + 1) % _N_SPARKS;
    }

    // ── Update spark simulation ───────────────────────────────────────────────
    const im = sparkRef.current;
    if (!im) return;
    for (let i = 0; i < _N_SPARKS; i++) {
      if (ss.life[i] <= 0) {
        _dummy.position.set(9999, 0, 0); _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix(); im.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      const i3 = i * 3;
      ss.vel[i3]   *= 0.87; ss.vel[i3+1] *= 0.87; ss.vel[i3+2] *= 0.87;  // drag
      ss.pos[i3]   += ss.vel[i3]   * dt;
      ss.pos[i3+1] += ss.vel[i3+1] * dt;
      ss.pos[i3+2] += ss.vel[i3+2] * dt;
      ss.life[i]   -= dt;

      const lr = Math.max(ss.life[i] / ss.maxLife[i], 0);
      _dummy.position.set(ss.pos[i3], ss.pos[i3+1], ss.pos[i3+2]);
      _dummy.scale.setScalar(lr * 0.65);
      _dummy.updateMatrix(); im.setMatrixAt(i, _dummy.matrix);
      // Colour decay: white → cyan → violet-blue
      _col.setHex(lr > 0.65 ? 0xFFFFFF : lr > 0.3 ? 0x00FFFF : 0x1A00FF);
      im.setColorAt(i, _col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/* Dynamic flicker light — intensity randomised in useFrame */}
      <pointLight ref={lightRef} color="#00E1FF" intensity={2.0} distance={5} decay={2} />
      {/* Fresnel plasma shell at 1.12× orb scale */}
      <mesh scale={scale * 1.12} material={auraMat}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      {/* Ionic spark particle pool */}
      <instancedMesh ref={sparkRef} args={[_geo_sm, sparkMat, _N_SPARKS]} frustumCulled={false} />
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
// 3. Fiery Aura — GLSL displacement shell + 380-particle GPU combustion system
//    Rising convective plumes, ember sparks, heat-haze sphere, flickering light.
// ─────────────────────────────────────────────────────────────────────────────

// ── GLSL: FBM vertex-displacement flame shell ─────────────────────────────────
const _fireShellVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying float vFlame;

float hashF(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hashF(i),             hashF(i + vec3(1,0,0)), f.x),
        mix(hashF(i + vec3(0,1,0)), hashF(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hashF(i + vec3(0,0,1)), hashF(i + vec3(1,0,1)), f.x),
        mix(hashF(i + vec3(0,1,1)), hashF(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p  = p * 2.1 + vec3(1.7, 9.2, 0.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 scrolled = position + vec3(0.0, -uTime * 1.6, uTime * 0.28);
  float n       = fbm(scrolled * 3.0) * uIntensity;
  float yBias   = position.y * 0.5 + 0.5;            // 0 bottom → 1 top
  float disp    = n * 0.30 * (0.5 + yBias * 1.0);
  vFlame        = n;
  gl_Position   = projectionMatrix * modelViewMatrix * vec4(position + normal * disp, 1.0);
}`;

const _fireShellFrag = /* glsl */`
varying float vFlame;

void main() {
  float t     = clamp(vFlame * 2.4, 0.0, 1.0);
  float alpha = clamp(vFlame * 2.8 - 0.18, 0.0, 0.88);
  vec3 cW = vec3(1.00, 1.00, 0.85);  // white-yellow core
  vec3 cO = vec3(1.00, 0.27, 0.00);  // intense orange
  vec3 cC = vec3(0.80, 0.02, 0.01);  // crimson
  vec3 cS = vec3(0.08, 0.01, 0.00);  // dark smoke
  vec3 col;
  if      (t < 0.33) col = mix(cW, cO, t * 3.030);
  else if (t < 0.66) col = mix(cO, cC, (t - 0.33) * 3.030);
  else               col = mix(cC, cS, (t - 0.66) * 3.030);
  gl_FragColor = vec4(col, alpha);
}`;

// ── GLSL: heat-haze distortion sphere ────────────────────────────────────────
const _hazeVert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const _hazeFrag = /* glsl */`
uniform float uTime;
varying vec2 vUv;

float h2(vec2 p) { p = fract(p * vec2(234.34, 435.35)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(h2(i), h2(i + vec2(1,0)), f.x),
             mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y);
}

void main() {
  vec2 uv = vUv + vec2(0.0, -uTime * 0.42);
  float n = n2(uv * 7.0) * 0.55 + n2(uv * 14.0 + vec2(1.7, 0.3)) * 0.28;
  gl_FragColor = vec4(mix(vec3(0.0), vec3(0.55, 0.22, 0.0), n), n * 0.13);
}`;

// ── Shared geometries (module-level, safe to reuse) ───────────────────────────
const _fireShellGeo = new THREE.SphereGeometry(1.0, 52, 26);
const _hazeGeoF     = new THREE.SphereGeometry(1.0, 20, 14);
const _fPartGeo     = new THREE.SphereGeometry(1.0,  4,  3);
const _emberGeoF    = new THREE.SphereGeometry(1.0,  3,  2);

// ── Module-level intensity state + public API ─────────────────────────────────
const _fieryState = { intensity: 1.0, burstTimer: 0.0 };
export function setFieryIntensity(factor: number) {
  _fieryState.intensity = Math.max(0.2, Math.min(2.0, factor));
}
export function triggerFieryInfernoBurst() { _fieryState.burstTimer = 0.55; }

// ── Particle pool sizes ───────────────────────────────────────────────────────
const _NC = 150;  // core flame slots
const _NO = 120;  // outer/upper flame slots
const _NE = 110;  // ember spark slots

function _spawnFlame(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  orbR: number, outer: boolean, burst: boolean,
) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const sR    = orbR * (outer ? 1.12 : 1.0) * (burst ? 1.15 : 1.0);
  // Standard spherical → Three.js axes (Y = up)
  px[i] = sR * Math.sin(phi) * Math.cos(theta);
  py[i] = sR * Math.cos(phi);
  pz[i] = sR * Math.sin(phi) * Math.sin(theta);
  const nx = px[i] / sR, ny = py[i] / sR, nz = pz[i] / sR;
  const spd = outer ? (0.5 + Math.random() * 0.7) : (0.7 + Math.random() * 1.0);
  vx[i] = nx * spd * 0.28;
  vy[i] = ny * spd * 0.28 + 0.85 + Math.random() * 1.0; // dominant thermal rise
  vz[i] = nz * spd * 0.28;
  life[i]    = -(Math.random() * (outer ? 0.45 : 0.65)); // staggered birth
  maxLife[i] = 0.55 + Math.random() * (outer ? 0.95 : 1.15);
  phase[i]   = theta;
}

function _spawnEmber(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  orbR: number, burst: boolean,
) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const sR    = orbR * (burst ? 1.22 : 1.0);
  px[i] = sR * Math.sin(phi) * Math.cos(theta);
  py[i] = sR * Math.cos(phi);
  pz[i] = sR * Math.sin(phi) * Math.sin(theta);
  const nx = px[i] / sR, ny = py[i] / sR, nz = pz[i] / sR;
  const spd = (burst ? 2.8 : 1.8) + Math.random() * 2.2;
  vx[i] = nx * spd; vy[i] = ny * spd + 0.45 + Math.random() * 0.7; vz[i] = nz * spd;
  life[i]    = -(Math.random() * 0.85);
  maxLife[i] = 0.35 + Math.random() * 0.80;
  phase[i]   = Math.random() * Math.PI * 2;
}

function FieryAura({ scale }: RingProps) {
  const orbR   = scale * 0.56;
  const shellR = scale * 0.64;

  // ── Materials in useMemo (avoids vertexColors module-level pitfall) ──────────
  const shellMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _fireShellVert, fragmentShader: _fireShellFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }), []);
  const hazeMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _hazeVert, fragmentShader: _hazeFrag,
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  }), []);
  const coreMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ff7700", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  const outerMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#cc1100", transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  const emberMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: "#ffaa00", transparent: true, opacity: 0.90, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  useEffect(() => () => {
    shellMat.dispose(); hazeMat.dispose();
    coreMat.dispose(); outerMat.dispose(); emberMat.dispose();
  }, [shellMat, hazeMat, coreMat, outerMat, emberMat]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const lightRef  = useRef<THREE.PointLight>(null);
  const coreIM    = useRef<THREE.InstancedMesh>(null);
  const outerIM   = useRef<THREE.InstancedMesh>(null);
  const emberIM   = useRef<THREE.InstancedMesh>(null);

  // ── Particle pools ──────────────────────────────────────────────────────────
  const cp = useRef({
    px: new Float32Array(_NC), py: new Float32Array(_NC), pz: new Float32Array(_NC),
    vx: new Float32Array(_NC), vy: new Float32Array(_NC), vz: new Float32Array(_NC),
    life: new Float32Array(_NC), maxLife: new Float32Array(_NC), phase: new Float32Array(_NC), born: false,
  });
  const op = useRef({
    px: new Float32Array(_NO), py: new Float32Array(_NO), pz: new Float32Array(_NO),
    vx: new Float32Array(_NO), vy: new Float32Array(_NO), vz: new Float32Array(_NO),
    life: new Float32Array(_NO), maxLife: new Float32Array(_NO), phase: new Float32Array(_NO), born: false,
  });
  const ep = useRef({
    px: new Float32Array(_NE), py: new Float32Array(_NE), pz: new Float32Array(_NE),
    vx: new Float32Array(_NE), vy: new Float32Array(_NE), vz: new Float32Array(_NE),
    life: new Float32Array(_NE), maxLife: new Float32Array(_NE), phase: new Float32Array(_NE), born: false,
  });

  useFrame(({ clock }, delta) => {
    const t   = clock.getElapsedTime();
    const dt  = Math.min(delta, 0.05);
    const inten = _fieryState.intensity;
    const burst = _fieryState.burstTimer > 0;
    if (burst) _fieryState.burstTimer -= dt;
    const bMul = burst ? 1.65 : 1.0;

    // ── Shell uniforms ─────────────────────────────────────────────────────────
    shellMat.uniforms.uTime.value      = t;
    shellMat.uniforms.uIntensity.value = inten * bMul;
    hazeMat.uniforms.uTime.value       = t;

    // ── Flickering warm light ──────────────────────────────────────────────────
    if (lightRef.current) {
      const fl = 0.72
        + Math.sin(t * 23.1) * 0.14
        + Math.sin(t * 37.7) * 0.09
        + Math.sin(t * 11.3) * 0.05;
      lightRef.current.intensity  = 3.4 * fl * inten * bMul;
      lightRef.current.position.x = Math.sin(t * 11.0) * 0.055;
      lightRef.current.position.y = Math.sin(t *  7.3) * 0.044;
    }

    // ── Core flames ────────────────────────────────────────────────────────────
    const c = cp.current;
    if (!c.born) { for (let i = 0; i < _NC; i++) _spawnFlame(i, c.px,c.py,c.pz,c.vx,c.vy,c.vz,c.life,c.maxLife,c.phase,orbR,false,false); c.born = true; }
    const cMesh = coreIM.current;
    if (cMesh) {
      for (let i = 0; i < _NC; i++) {
        c.life[i] += dt * inten;
        if (c.life[i] >= c.maxLife[i]) { _spawnFlame(i, c.px,c.py,c.pz,c.vx,c.vy,c.vz,c.life,c.maxLife,c.phase,orbR,false,burst); continue; }
        if (c.life[i] < 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); cMesh.setMatrixAt(i, _dummy.matrix); continue; }
        const lf = c.life[i] / c.maxLife[i];
        const cx = Math.sin(t * 3.2 + c.phase[i]) * 0.20 * lf;
        const cz = Math.cos(t * 2.8 + c.phase[i]) * 0.20 * lf;
        c.px[i] += (c.vx[i] + cx) * dt;
        c.py[i] += c.vy[i] * dt * (1 + lf * 0.5);
        c.pz[i] += (c.vz[i] + cz) * dt;
        c.vx[i] *= 0.993; c.vy[i] *= 0.996; c.vz[i] *= 0.993;
        const sc = (lf < 0.4 ? lf / 0.4 : 1 - (lf - 0.4) / 0.6 * 0.4);
        const sz = Math.max(0.001, (0.055 + lf * 0.065) * sc * scale * bMul);
        _dummy.position.set(c.px[i], c.py[i], c.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix();
        cMesh.setMatrixAt(i, _dummy.matrix);
      }
      cMesh.instanceMatrix.needsUpdate = true;
      coreMat.opacity = 0.82 * inten;
    }

    // ── Outer flames ───────────────────────────────────────────────────────────
    const o = op.current;
    if (!o.born) { for (let i = 0; i < _NO; i++) _spawnFlame(i, o.px,o.py,o.pz,o.vx,o.vy,o.vz,o.life,o.maxLife,o.phase,orbR,true,false); o.born = true; }
    const oMesh = outerIM.current;
    if (oMesh) {
      for (let i = 0; i < _NO; i++) {
        o.life[i] += dt * inten;
        if (o.life[i] >= o.maxLife[i]) { _spawnFlame(i, o.px,o.py,o.pz,o.vx,o.vy,o.vz,o.life,o.maxLife,o.phase,orbR,true,burst); continue; }
        if (o.life[i] < 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); oMesh.setMatrixAt(i, _dummy.matrix); continue; }
        const lf = o.life[i] / o.maxLife[i];
        const cx = Math.sin(t * 2.7 + o.phase[i] + 1.5) * 0.26 * lf;
        const cz = Math.cos(t * 2.1 + o.phase[i] + 1.5) * 0.26 * lf;
        o.px[i] += (o.vx[i] + cx) * dt;
        o.py[i] += o.vy[i] * dt * (1 + lf * 0.6);
        o.pz[i] += (o.vz[i] + cz) * dt;
        o.vx[i] *= 0.989; o.vy[i] *= 0.993; o.vz[i] *= 0.989;
        const sz = Math.max(0.001, (0.045 + lf * 0.055) * (1 - lf * 0.45) * scale * bMul);
        _dummy.position.set(o.px[i], o.py[i], o.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix();
        oMesh.setMatrixAt(i, _dummy.matrix);
      }
      oMesh.instanceMatrix.needsUpdate = true;
      outerMat.opacity = 0.60 * inten;
    }

    // ── Ember sparks ───────────────────────────────────────────────────────────
    const e = ep.current;
    if (!e.born) { for (let i = 0; i < _NE; i++) _spawnEmber(i, e.px,e.py,e.pz,e.vx,e.vy,e.vz,e.life,e.maxLife,e.phase,orbR,false); e.born = true; }
    const eMesh = emberIM.current;
    if (eMesh) {
      for (let i = 0; i < _NE; i++) {
        e.life[i] += dt * inten;
        if (e.life[i] >= e.maxLife[i]) { _spawnEmber(i, e.px,e.py,e.pz,e.vx,e.vy,e.vz,e.life,e.maxLife,e.phase,orbR,burst); continue; }
        if (e.life[i] < 0) { _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix(); eMesh.setMatrixAt(i, _dummy.matrix); continue; }
        const lf = e.life[i] / e.maxLife[i];
        // Radial deceleration + steady upward drift
        e.vx[i] *= 0.934; e.vz[i] *= 0.934; e.vy[i] *= 0.958;
        e.px[i] += e.vx[i] * dt;
        e.py[i] += (e.vy[i] + 0.38) * dt;
        e.pz[i] += e.vz[i] * dt;
        // Flickering size
        const fl = 0.68 + Math.sin(t * 28 + e.phase[i]) * 0.32;
        const sz = Math.max(0.001, (0.020 + (1 - lf) * 0.032) * fl * scale);
        _dummy.position.set(e.px[i], e.py[i], e.pz[i]); _dummy.scale.setScalar(sz); _dummy.updateMatrix();
        eMesh.setMatrixAt(i, _dummy.matrix);
      }
      eMesh.instanceMatrix.needsUpdate = true;
      emberMat.opacity = (0.52 + Math.sin(t * 19.3) * 0.28) * inten;
    }
  });

  return (
    <group>
      {/* Flickering amber fire light */}
      <pointLight ref={lightRef} color="#ff6600" intensity={3.4} distance={5.5} decay={2} />
      {/* FBM displacement flame shell */}
      <mesh scale={shellR} material={shellMat} geometry={_fireShellGeo} />
      {/* Rising heat-haze distortion sphere */}
      <mesh scale={shellR * 1.6} material={hazeMat} geometry={_hazeGeoF} />
      {/* Core orange-hot flame particles */}
      <instancedMesh ref={coreIM}  args={[_fPartGeo, coreMat,  _NC]} frustumCulled={false} />
      {/* Outer crimson flame particles */}
      <instancedMesh ref={outerIM} args={[_fPartGeo, outerMat, _NO]} frustumCulled={false} />
      {/* Tiny ember sparks */}
      <instancedMesh ref={emberIM} args={[_emberGeoF, emberMat, _NE]} frustumCulled={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Crystalline Aura — Prismatic Crystal Shell & Chromatic Dispersion VFX
//    Dual-layer refractive GLSL shells, dual-Voronoi caustic rays, 200-particle
//    camera-glint crystal dust, 12 orbiting shards, flickering jewel light.
// ─────────────────────────────────────────────────────────────────────────────

// ── GLSL: inner crystal shell (Fresnel facets + chromatic IOR split) ──────────
const _crystInnerVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec4 wp   = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vViewDir  = normalize(cameraPosition - wp.xyz);
  float b   = sin(uTime * 1.9 + position.y * 3.2) * 0.013 * uIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + b), 1.0);
}`;

const _crystInnerFrag = /* glsl */`
#extension GL_OES_standard_derivatives : enable
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec3 flatN  = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float nv    = max(0.0, dot(flatN, vViewDir));
  float fr    = pow(1.0 - nv, 4.0);
  float frR   = pow(1.0 - max(0.0, dot(flatN + vec3(0.04,0.0,0.0), vViewDir)), 4.0);
  float frB   = pow(1.0 - max(0.0, dot(flatN - vec3(0.04,0.0,0.0), vViewDir)), 4.0);
  float cy    = fract(uTime * 0.15);
  vec3 cS = vec3(0.00, 0.20, 1.00);
  vec3 cA = vec3(0.54, 0.17, 0.89);
  vec3 cQ = vec3(0.00, 1.00, 0.80);
  vec3 base;
  if      (cy < 0.33) base = mix(cS, cA, cy * 3.030);
  else if (cy < 0.66) base = mix(cA, cQ, (cy - 0.33) * 3.030);
  else                base = mix(cQ, cS, (cy - 0.66) * 3.030);
  vec3 col  = mix(base, vec3(1.0), pow(fr, 2.0) * 0.85);
  col.r     = min(1.0, col.r + frR * 0.55);
  col.b     = min(1.0, col.b + frB * 0.55);
  float alpha = (0.12 + fr * 0.60) * uIntensity;
  gl_FragColor = vec4(col * (1.0 + fr * 0.9), alpha);
}`;

// ── GLSL: outer crystal shell (dual-Voronoi caustics + stronger dispersion) ───
const _crystOuterVert = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vec4 wp   = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vViewDir  = normalize(cameraPosition - wp.xyz);
  float b   = sin(uTime * 1.3 + position.y * 2.5) * 0.018 * uIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + b), 1.0);
}`;

const _crystOuterFrag = /* glsl */`
#extension GL_OES_standard_derivatives : enable
uniform float uTime;
uniform float uIntensity;
varying vec3 vWorldPos;
varying vec3 vViewDir;
float h2(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 73.2); return fract(p.x * p.y); }
float voronoi(vec2 p, float spd) {
  vec2 i = floor(p); vec2 f = fract(p); float md = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 nb = vec2(float(x), float(y));
    vec2 pt = nb + 0.5 + 0.45 * sin(uTime * spd + 6.2832 * vec2(h2(i+nb), h2(i+nb+vec2(34.2,11.5))));
    vec2 r = pt - f; md = min(md, dot(r, r));
  }
  return sqrt(md);
}
void main() {
  vec3 flatN  = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float nv    = max(0.0, dot(flatN, vViewDir));
  float fr    = pow(1.0 - nv, 3.0);
  float frR   = pow(1.0 - max(0.0, dot(flatN + vec3(0.06,0.0,0.0), vViewDir)), 3.0);
  float frB   = pow(1.0 - max(0.0, dot(flatN - vec3(0.06,0.0,0.0), vViewDir)), 3.0);
  float v1    = voronoi(vWorldPos.xy * 2.2,  1.1);
  float v2    = voronoi(vWorldPos.yz * 2.0, -0.85);
  float caust = pow(1.0 - (v1 + v2) * 0.5, 2.5);
  float cy    = fract(uTime * 0.15 + 0.17);
  vec3 cS = vec3(0.00, 0.20, 1.00);
  vec3 cA = vec3(0.54, 0.17, 0.89);
  vec3 cQ = vec3(0.00, 1.00, 0.80);
  vec3 base;
  if      (cy < 0.33) base = mix(cS, cA, cy * 3.030);
  else if (cy < 0.66) base = mix(cA, cQ, (cy - 0.33) * 3.030);
  else                base = mix(cQ, cS, (cy - 0.66) * 3.030);
  vec3 col  = mix(base, vec3(1.0), pow(fr, 1.5) * 0.75);
  col      += caust * vec3(0.25, 0.55, 1.0) * 0.55;
  col.r     = min(1.0, col.r + frR * 0.65);
  col.b     = min(1.0, col.b + frB * 0.65);
  float alpha = (0.08 + fr * 0.50 + caust * 0.20) * uIntensity;
  gl_FragColor = vec4(col * (1.0 + fr * 0.8 + caust * 0.5), alpha);
}`;

// ── GLSL: caustic ray cones (dual-Voronoi scrolled in opposite directions) ────
const _crystRayVert = /* glsl */`
varying vec2 vUv2;
void main() { vUv2 = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const _crystRayFrag = /* glsl */`
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv2;
float h2r(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 73.2); return fract(p.x * p.y); }
float voronoiR(vec2 p, float spd) {
  vec2 i = floor(p); vec2 f = fract(p); float md = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 nb = vec2(float(x), float(y));
    vec2 pt = nb + 0.5 + 0.45 * sin(uTime * spd + 6.2832 * vec2(h2r(i+nb), h2r(i+nb+vec2(34.2,11.5))));
    vec2 r = pt - f; md = min(md, dot(r, r));
  }
  return sqrt(md);
}
void main() {
  // vUv2.y: 0 = tip (near crystal), 1 = base (far end); fade bright→transparent
  float fade = 1.0 - vUv2.y;
  float v1   = voronoiR(vUv2 * 3.5 + vec2(uTime * 0.28, 0.0),  1.2);
  float v2   = voronoiR(vUv2 * 3.0 - vec2(uTime * 0.22, 0.0), -0.9);
  float caust = pow(1.0 - (v1 + v2) * 0.5, 2.2);
  float cy   = fract(uTime * 0.18);
  vec3 cS = vec3(0.00, 0.20, 1.00);
  vec3 cA = vec3(0.54, 0.17, 0.89);
  vec3 cQ = vec3(0.00, 1.00, 0.80);
  vec3 col;
  if      (cy < 0.33) col = mix(cS, cA, cy * 3.030);
  else if (cy < 0.66) col = mix(cA, cQ, (cy - 0.33) * 3.030);
  else                col = mix(cQ, cS, (cy - 0.66) * 3.030);
  col += caust * 0.38;
  float pulse = 0.55 + 0.45 * sin(uTime * 2.5 + vUv2.y * 4.5);
  float alpha = caust * fade * pulse * 0.60 * uIntensity;
  gl_FragColor = vec4(col, alpha);
}`;

// ── Shared module-level geometries ────────────────────────────────────────────
const _crystInnerGeo = new THREE.IcosahedronGeometry(1.0, 2);
const _crystOuterGeo = new THREE.IcosahedronGeometry(1.0, 1);
const _crystDustGeo  = new THREE.SphereGeometry(1.0, 3, 2);
const _crystShardGeo = new THREE.OctahedronGeometry(1.0, 0);

// ── Zero-GC temp vectors ──────────────────────────────────────────────────────
const _v3cam = new THREE.Vector3();
const _v3p   = new THREE.Vector3();

// ── Module-level crystalline state + public API ───────────────────────────────
const _crystState = { intensity: 1.0, burstTimer: 0.0 };
export function setCrystallineIntensity(f: number) {
  _crystState.intensity = Math.max(0.2, Math.min(2.0, f));
}
export function shatterBurst() { _crystState.burstTimer = 0.60; }

// ── Dust particle pool ────────────────────────────────────────────────────────
const _N_CDUST = 200;

function _spawnDust(
  i: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  life: Float32Array, maxLife: Float32Array, phase: Float32Array,
  driftR: number,
) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = driftR * (0.45 + Math.random() * 0.55);
  px[i] = r * Math.sin(phi) * Math.cos(theta);
  py[i] = r * Math.cos(phi);
  pz[i] = r * Math.sin(phi) * Math.sin(theta);
  vx[i] = (Math.random() - 0.5) * 0.14;
  vy[i] = (Math.random() - 0.5) * 0.14;
  vz[i] = (Math.random() - 0.5) * 0.14;
  life[i]    = -(Math.random() * 1.6);
  maxLife[i] = 1.6 + Math.random() * 2.0;
  phase[i]   = Math.random() * Math.PI * 2;
}

function CrystallineAura({ scale }: RingProps) {
  const innerR   = scale * 0.70;
  const outerR   = scale * 0.90;
  const rayLen   = scale * 1.55;
  const rayBase  = rayLen * 0.17;
  const driftR   = scale * 1.45;
  const shardOR  = scale * 1.10;

  // ── Materials (in useMemo — avoids vertexColors module-level pitfall) ────────
  const innerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _crystInnerVert, fragmentShader: _crystInnerFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, extensions: { derivatives: true },
  }), []);
  const outerMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _crystOuterVert, fragmentShader: _crystOuterFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, extensions: { derivatives: true },
  }), []);
  const rayMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: _crystRayVert, fragmentShader: _crystRayFrag,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);
  // Scale-dependent ray cone geometry
  const rayGeo = useMemo(() => new THREE.ConeGeometry(rayBase, rayLen, 6, 4), [rayBase, rayLen]);
  const dustMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: "#99ccff", transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  // Three shard colors: sapphire / amethyst / aquamarine
  const matS = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0044ff", transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const matA = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8822ee", transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const matQ = useMemo(() => new THREE.MeshBasicMaterial({ color: "#00ffcc", transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  useEffect(() => () => {
    innerMat.dispose(); outerMat.dispose(); rayMat.dispose(); rayGeo.dispose();
    dustMat.dispose(); matS.dispose(); matA.dispose(); matQ.dispose();
  }, [innerMat, outerMat, rayMat, rayGeo, dustMat, matS, matA, matQ]);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const lightRef  = useRef<THREE.PointLight>(null);
  const raysRef   = useRef<THREE.Group>(null);
  const dustIM    = useRef<THREE.InstancedMesh>(null);
  const shardImS  = useRef<THREE.InstancedMesh>(null);
  const shardImA  = useRef<THREE.InstancedMesh>(null);
  const shardImQ  = useRef<THREE.InstancedMesh>(null);

  // ── Dust particle pool ───────────────────────────────────────────────────────
  const dp = useRef({
    px: new Float32Array(_N_CDUST), py: new Float32Array(_N_CDUST), pz: new Float32Array(_N_CDUST),
    vx: new Float32Array(_N_CDUST), vy: new Float32Array(_N_CDUST), vz: new Float32Array(_N_CDUST),
    life: new Float32Array(_N_CDUST), maxLife: new Float32Array(_N_CDUST), phase: new Float32Array(_N_CDUST),
    born: false,
  });

  useFrame(({ clock, camera }, delta) => {
    const t   = clock.getElapsedTime();
    const dt  = Math.min(delta, 0.05);
    const inten = _crystState.intensity;
    const burst = _crystState.burstTimer > 0;
    if (burst) _crystState.burstTimer -= dt;
    const bMul = burst ? 1.70 : 1.0;

    // ── Shell + ray uniforms ────────────────────────────────────────────────────
    innerMat.uniforms.uTime.value      = t;
    innerMat.uniforms.uIntensity.value = inten * bMul;
    outerMat.uniforms.uTime.value      = t;
    outerMat.uniforms.uIntensity.value = inten * bMul;
    rayMat.uniforms.uTime.value        = t;
    rayMat.uniforms.uIntensity.value   = inten * (0.55 + Math.sin(t * 2.5) * 0.45) * bMul;

    // ── Slow-rotate caustic ray group ───────────────────────────────────────────
    if (raysRef.current) raysRef.current.rotation.z = t * 0.30;

    // ── Jewel light flicker ─────────────────────────────────────────────────────
    if (lightRef.current) {
      const fl = 0.78 + Math.sin(t * 13.7) * 0.13 + Math.sin(t * 8.3) * 0.09;
      lightRef.current.intensity = 2.8 * fl * inten * bMul;
    }

    // ── 12 orbiting crystal shards (4 per color group) ──────────────────────────
    const orbitR = shardOR * (burst ? 1.38 : 1.0);
    const inclinations = [0, Math.PI / 5, Math.PI / 3, Math.PI * 2 / 5];
    ([
      { im: shardImS.current, mat: matS, offset: 0 },
      { im: shardImA.current, mat: matA, offset: 1 },
      { im: shardImQ.current, mat: matQ, offset: 2 },
    ] as const).forEach(({ im, mat, offset }) => {
      if (!im) return;
      for (let k = 0; k < 4; k++) {
        const gi    = offset * 4 + k;
        const incl  = inclinations[k];
        const spd   = burst ? 4.0 : (0.65 + offset * 0.20 + k * 0.13);
        const a     = (gi / 12) * Math.PI * 2 + t * spd;
        const x     = orbitR * Math.cos(a);
        const y     = orbitR * Math.sin(a) * Math.cos(incl);
        const z     = orbitR * Math.sin(a) * Math.sin(incl);
        const glint = 0.85 + Math.sin(t * 4.8 + gi * 1.2) * 0.45;
        const sc    = scale * 0.078 * glint * (burst ? 1.45 : 1.0);
        _dummy.position.set(x, y, z);
        _dummy.rotation.x = t * 1.3 + gi;
        _dummy.rotation.y = t * 0.8 + gi * 0.6;
        _dummy.scale.setScalar(Math.max(0.001, sc));
        _dummy.updateMatrix();
        im.setMatrixAt(k, _dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      mat.opacity = 0.70 + Math.sin(t * 3.3 + offset) * 0.22;
    });

    // ── Crystal dust — 200-particle zero-gravity glint field ────────────────────
    const d = dp.current;
    if (!d.born) {
      for (let i = 0; i < _N_CDUST; i++) _spawnDust(i, d.px,d.py,d.pz,d.vx,d.vy,d.vz,d.life,d.maxLife,d.phase,driftR);
      d.born = true;
    }
    const dMesh = dustIM.current;
    if (dMesh) {
      _v3cam.copy(camera.position).normalize(); // camera view direction (zero-alloc)
      for (let i = 0; i < _N_CDUST; i++) {
        d.life[i] += dt * inten;
        if (d.life[i] >= d.maxLife[i]) {
          _spawnDust(i, d.px,d.py,d.pz,d.vx,d.vy,d.vz,d.life,d.maxLife,d.phase, driftR * (burst ? 1.55 : 1.0));
          continue;
        }
        if (d.life[i] < 0) {
          _dummy.position.set(999,0,0); _dummy.scale.setScalar(0.001); _dummy.updateMatrix();
          dMesh.setMatrixAt(i, _dummy.matrix); continue;
        }
        const lf = d.life[i] / d.maxLife[i];
        // Zero-gravity drift + gentle curl
        d.px[i] += (d.vx[i] + Math.sin(t * 0.8 + d.phase[i]) * 0.038) * dt;
        d.py[i] += d.vy[i] * dt;
        d.pz[i] += (d.vz[i] + Math.cos(t * 0.7 + d.phase[i]) * 0.038) * dt;
        // Camera-dot glint: particles aligned with camera → starburst scale
        _v3p.set(d.px[i], d.py[i], d.pz[i]).normalize();
        const camDot   = Math.max(0, _v3p.dot(_v3cam));
        const starburst = Math.pow(camDot, 6) * 3.8 + 1.0;
        // Opacity envelope
        const fadeLf = lf < 0.1 ? lf * 10 : (lf > 0.85 ? (1 - lf) / 0.15 : 1.0);
        const sparkle = 0.68 + Math.sin(t * 22 + d.phase[i]) * 0.32;
        const sz = Math.max(0.001, scale * 0.021 * starburst * sparkle * fadeLf);
        _dummy.position.set(d.px[i], d.py[i], d.pz[i]);
        _dummy.scale.setScalar(sz);
        _dummy.updateMatrix();
        dMesh.setMatrixAt(i, _dummy.matrix);
      }
      dMesh.instanceMatrix.needsUpdate = true;
      dustMat.opacity = (0.78 + Math.sin(t * 11.3) * 0.18) * inten;
    }
  });

  // Pre-compute 8 ray cone transforms (tip near crystal, base fans outward)
  // Cone +Y = tip; rotating [0,0, π/2 + a] makes tip point toward center.
  const rayTransforms = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a    = (i / 8) * Math.PI * 2;
    const dist = innerR + rayLen / 2;
    return {
      position: [Math.cos(a) * dist, Math.sin(a) * dist, 0] as [number, number, number],
      rotZ: Math.PI / 2 + a,
    };
  }), [innerR, rayLen]);

  return (
    <group>
      {/* Flickering jewel point light */}
      <pointLight ref={lightRef} color="#6633ff" intensity={2.8} distance={6} decay={2} />

      {/* Inner faceted crystal shell — Fresnel + chromatic IOR split */}
      <mesh scale={innerR} material={innerMat} geometry={_crystInnerGeo} />

      {/* Outer faceted crystal shell — Voronoi caustics + stronger dispersion */}
      <mesh scale={outerR} material={outerMat} geometry={_crystOuterGeo} />

      {/* 8 caustic ray cones — rotate as a group, dual-Voronoi shader */}
      <group ref={raysRef}>
        {rayTransforms.map((rt, i) => (
          <mesh key={i} position={rt.position} rotation={[0, 0, rt.rotZ]}
                material={rayMat} geometry={rayGeo} />
        ))}
      </group>

      {/* 200-particle zero-gravity crystal dust — camera-glint starburst */}
      <instancedMesh ref={dustIM} args={[_crystDustGeo, dustMat, _N_CDUST]} frustumCulled={false} />

      {/* 12 orbiting shards: 4 sapphire + 4 amethyst + 4 aquamarine */}
      <instancedMesh ref={shardImS} args={[_crystShardGeo, matS, 4]} frustumCulled={false} />
      <instancedMesh ref={shardImA} args={[_crystShardGeo, matA, 4]} frustumCulled={false} />
      <instancedMesh ref={shardImQ} args={[_crystShardGeo, matQ, 4]} frustumCulled={false} />
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
const _ZT_ARCS = 12;
const _ZT_SEGS = 10; // points per arc

function ZeroTesla({ scale }: RingProps) {
  const r        = scale * 2.0;
  const groupRef = useRef<THREE.Group>(null);

  // Create arc lines imperatively (geometry updated every frame)
  const arcData = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.85, depthWrite: false });
    const arcs = Array.from({ length: _ZT_ARCS }, () => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(_ZT_SEGS * 3);
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
      const startA = (i / _ZT_ARCS) * Math.PI * 2;
      const span   = Math.PI * 2 * (0.14 + (i % 3) * 0.06);
      const endA   = startA + span;
      const sx = Math.cos(startA) * r * 0.9, sy = Math.sin(startA) * r * 0.9;
      const ex = Math.cos(endA)   * r * 0.9, ey = Math.sin(endA)   * r * 0.9;
      pos[0] = sx; pos[1] = sy; pos[2] = 0.05;
      for (let s = 1; s < _ZT_SEGS - 1; s++) {
        const frac   = s / (_ZT_SEGS - 1);
        const spread = 0.38 * (1 - Math.abs(frac - 0.5) * 2);
        const nx = Math.sin(t * 22 + i * 3.7 + s * 1.9) * spread * r * 0.50;
        const ny = Math.cos(t * 18 + i * 2.3 + s * 2.5) * spread * r * 0.50;
        pos[s * 3]     = sx + (ex - sx) * frac + nx;
        pos[s * 3 + 1] = sy + (ey - sy) * frac + ny;
        pos[s * 3 + 2] = 0.05;
      }
      pos[(_ZT_SEGS - 1) * 3]     = ex;
      pos[(_ZT_SEGS - 1) * 3 + 1] = ey;
      pos[(_ZT_SEGS - 1) * 3 + 2] = 0.05;
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
    case "eclipse_horizon":   return <ElectrifiedAura  scale={scale} />;
    case "singularity_event": return <SingularityEvent scale={scale} />;
    case "celestial_aegis":   return <FieryAura         scale={scale} />;
    case "chronos_clockwork": return <CrystallineAura  scale={scale} />;
    case "void_tendril":      return <VoidTendril      scale={scale} />;
    case "hyper_collider":    return <HyperCollider    scale={scale} />;
    case "solar_corona":      return <SolarCorona      scale={scale} />;
    case "prismatic_lattice": return <PrismaticLattice scale={scale} />;
    case "zero_tesla":        return <ZeroTesla        scale={scale} />;
    case "astral_nebula":     return <AstralNebula     scale={scale} />;
    default:                  return null;
  }
}
