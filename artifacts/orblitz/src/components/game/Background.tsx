/**
 * Background.tsx — singleton; module-level state is intentional.
 * ShootingOrbs writes orb positions at useFrame priority -1.
 * ParticleSystem reads them at priority 0 in the same frame.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Orb palette ────────────────────────────────────────────────────────────────
const SHOOT_COLORS = [
  "#00ffff", "#ff00ff", "#ffff00", "#aa00ff",
  "#00ff88", "#ff8800", "#ffffff", "#00aaff",
];
const SHOOT_COUNT = 120;
const BX = 52;
const BY = 36;

// ── Explosion impulse ring buffer (written by DarkOrbs, read by ParticleSystem)
const MAX_IMP    = 32;
const _impX      = new Float32Array(MAX_IMP);
const _impY      = new Float32Array(MAX_IMP);
const _impStr    = new Float32Array(MAX_IMP);
let   _impHead   = 0; // next write position
let   _impTail   = 0; // start of readable range
let   _impSize   = 0; // valid items (≤ MAX_IMP)

export function addExplosionImpulse(x: number, y: number, strength: number): void {
  _impX[_impHead]   = x;
  _impY[_impHead]   = y;
  _impStr[_impHead] = strength;
  _impHead = (_impHead + 1) % MAX_IMP;
  if (_impSize < MAX_IMP) { _impSize++; }
  else { _impTail = (_impTail + 1) % MAX_IMP; } // overwrite oldest
}

// ── Orb → Particle shared buffers (written at priority -1, read at 0) ──────────
const _orbPosX = new Float32Array(SHOOT_COUNT);
const _orbPosY = new Float32Array(SHOOT_COUNT);
const _orbVelX = new Float32Array(SHOOT_COUNT);
const _orbVelY = new Float32Array(SHOOT_COUNT);

// ── Spatial grid ───────────────────────────────────────────────────────────────
const CELL    = 5;
const GX_MIN  = -62;
const GY_MIN  = -46;
const GW      = 25;
const GH      = 19;
const _gridCells: number[][] = Array.from({ length: GW * GH }, () => []);

function _buildGrid(): void {
  for (let c = 0; c < _gridCells.length; c++) _gridCells[c].length = 0;
  for (let j = 0; j < SHOOT_COUNT; j++) {
    const cx = Math.floor((_orbPosX[j] - GX_MIN) / CELL);
    const cy = Math.floor((_orbPosY[j] - GY_MIN) / CELL);
    if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) _gridCells[cy * GW + cx].push(j);
  }
}

// ── Interaction radii (squared) ────────────────────────────────────────────────
const ORB_R2     = 20.25; // 4.5²
const EXP_R2     = 625.0; // 25²
const EXP_R2_SP  = 900.0; // 30² — sparks react further

// ── TYPE 1: Nebula Dust ────────────────────────────────────────────────────────
const DUST_N  = 4000;
const DUST_BX = 56;
const DUST_BY = 40;
const _dBX = new Float32Array(DUST_N), _dBY = new Float32Array(DUST_N);
const _dX  = new Float32Array(DUST_N), _dY  = new Float32Array(DUST_N);
const _dVX = new Float32Array(DUST_N), _dVY = new Float32Array(DUST_N);
const _dZ  = new Float32Array(DUST_N), _dSz = new Float32Array(DUST_N);
const _dPh = new Float32Array(DUST_N), _dTw = new Float32Array(DUST_N);

// ── TYPE 2: Ionic Streams ──────────────────────────────────────────────────────
const N_STREAMS  = 8;
const SPP        = 187; // particles per stream
const STREAM_N   = N_STREAMS * SPP; // 1496
const STREAM_COLORS = ["#00ffff","#ff44ff","#4488ff","#00ffaa","#aa44ff","#ff8844","#44ccff","#ff44aa"];
const STREAM_CY   = new Float32Array(N_STREAMS);
const STREAM_AMP  = new Float32Array(N_STREAMS);
const STREAM_FREQ = new Float32Array(N_STREAMS);
const STREAM_PH   = new Float32Array(N_STREAMS);
const STREAM_FLOW = new Float32Array(N_STREAMS);
const _sBX = new Float32Array(STREAM_N), _sBY = new Float32Array(STREAM_N);
const _sX  = new Float32Array(STREAM_N), _sY  = new Float32Array(STREAM_N);
const _sVX = new Float32Array(STREAM_N), _sVY = new Float32Array(STREAM_N);
const _sT  = new Float32Array(STREAM_N); // 0-1 position along stream
const _sZ  = new Float32Array(STREAM_N), _sSz = new Float32Array(STREAM_N);
const _sPh = new Float32Array(STREAM_N), _sTw = new Float32Array(STREAM_N);

// ── TYPE 3: Cosmic Sparks ──────────────────────────────────────────────────────
const SPARK_N  = 400;
const _kX  = new Float32Array(SPARK_N), _kY  = new Float32Array(SPARK_N);
const _kVX = new Float32Array(SPARK_N), _kVY = new Float32Array(SPARK_N);
const _kZ  = new Float32Array(SPARK_N), _kSz = new Float32Array(SPARK_N);
const _kPh = new Float32Array(SPARK_N), _kTw = new Float32Array(SPARK_N);

// ── One-time initialisation ────────────────────────────────────────────────────
;(() => {
  for (let i = 0; i < DUST_N; i++) {
    const bx = (Math.random() - 0.5) * DUST_BX * 2;
    const by = (Math.random() - 0.5) * DUST_BY * 2;
    _dBX[i] = bx; _dBY[i] = by; _dX[i] = bx; _dY[i] = by;
    _dZ[i]  = -10 - Math.random() * 14;
    _dSz[i] = 0.007 + Math.random() * 0.024;
    _dPh[i] = Math.random() * Math.PI * 2;
    _dTw[i] = 0.5 + Math.random() * 3.0;
  }
  for (let s = 0; s < N_STREAMS; s++) {
    STREAM_CY[s]   = (s - (N_STREAMS - 1) / 2) * 9.0;
    STREAM_AMP[s]  = 3.5 + Math.random() * 5.0;
    STREAM_FREQ[s] = 0.032 + Math.random() * 0.04;
    STREAM_PH[s]   = Math.random() * Math.PI * 2;
    STREAM_FLOW[s] = (s % 2 === 0 ? 1 : -1) * (1.8 + Math.random() * 3.0);
  }
  for (let i = 0; i < STREAM_N; i++) {
    const s  = Math.floor(i / SPP);
    const t  = (i % SPP) / SPP;
    _sT[i]   = t;
    const bx = -DUST_BX + t * 2 * DUST_BX;
    const by = STREAM_CY[s] + STREAM_AMP[s] * Math.sin(bx * STREAM_FREQ[s] + STREAM_PH[s]);
    _sBX[i] = bx; _sBY[i] = by; _sX[i] = bx; _sY[i] = by;
    _sZ[i]  = -11 - Math.random() * 12;
    _sSz[i] = 0.018 + Math.random() * 0.034;
    _sPh[i] = Math.random() * Math.PI * 2;
    _sTw[i] = 0.8 + Math.random() * 4.5;
  }
  for (let i = 0; i < SPARK_N; i++) {
    _kX[i]  = (Math.random() - 0.5) * DUST_BX * 2;
    _kY[i]  = (Math.random() - 0.5) * DUST_BY * 2;
    _kZ[i]  = -9 - Math.random() * 8;
    _kSz[i] = 0.04 + Math.random() * 0.10;
    _kPh[i] = Math.random() * Math.PI * 2;
    _kTw[i] = 3.0 + Math.random() * 9.0;
  }
})();

const _dummy = new THREE.Object3D();

// ── HD Orb shaders ─────────────────────────────────────────────────────────────
// Three.js injects "attribute mat4 instanceMatrix" and (when setColorAt is used)
// "attribute vec3 instanceColor" into ShaderMaterial prefix — do NOT re-declare.
const ORB_VERT = /* glsl */`
  varying vec3  vColor;
  varying float vFresnel;
  varying float vCore;
  varying float vShimmer;

  uniform float uTime;

  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5); }
  float n3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h3(i),             h3(i+vec3(1,0,0)), f.x),
          mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x),
          mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    vColor = instanceColor;

    vec4 worldPos = instanceMatrix * vec4(position, 1.0);
    vec4 mvPos    = modelViewMatrix * worldPos;

    // View-space normal (safe for uniform-scale spheres)
    vec3 objNorm  = normalize(mat3(instanceMatrix) * normal);
    vec3 viewNorm = normalize(mat3(viewMatrix) * mat3(modelMatrix) * objNorm);
    vec3 viewDir  = normalize(-mvPos.xyz);

    float ndv = max(0.0, dot(viewNorm, viewDir));
    vFresnel  = pow(1.0 - ndv, 2.5);
    vCore     = pow(ndv, 0.75);

    // Animated surface shimmer via 2-octave noise on object-space normal
    float tt = uTime * 0.55;
    float s1 = n3(objNorm * 3.5 + vec3( tt, -tt * 0.7,  tt * 0.4));
    float s2 = n3(objNorm * 6.0 + vec3(-tt * 0.8, tt * 0.5, -tt));
    vShimmer  = 0.55 + 0.45 * (s1 * 0.6 + s2 * 0.4);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const ORB_FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vFresnel;
  varying float vCore;
  varying float vShimmer;
  uniform float uTime;

  void main() {
    float pulse  = sin(uTime * 2.6) * 0.10 + 0.90;
    vec3 coreCol = mix(vColor * 1.6, vec3(1.0, 1.0, 0.92), 0.48) * vCore;
    vec3 rimCol  = mix(vColor, vec3(1.0), 0.42) * vFresnel * 2.8;
    // Chromatic hint: slight hue rotation at rim
    vec3 chroma  = vec3(vColor.b, vColor.r, vColor.g) * vFresnel * 0.4;
    vec3 col     = (coreCol + rimCol + chroma) * vShimmer * pulse;
    float alpha  = clamp(vCore * 0.84 + vFresnel * 1.0, 0.0, 1.0) * pulse;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Corona: larger outer sphere — bright only at rim (Fresnel), transparent center
// FrontSide (default): outer surface renders, ndv≈0 at sphere edge → max rim glow
const CORONA_VERT = /* glsl */`
  varying vec3  vColor;
  varying float vRim;

  void main() {
    vColor = instanceColor;
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);
    vec4 mvPos    = modelViewMatrix * worldPos;
    vec3 objNorm  = normalize(mat3(instanceMatrix) * normal);
    vec3 viewNorm = normalize(mat3(viewMatrix) * mat3(modelMatrix) * objNorm);
    vec3 viewDir  = normalize(-mvPos.xyz);
    float ndv     = max(0.0, dot(viewNorm, viewDir));
    vRim          = pow(1.0 - ndv, 1.8);
    gl_Position   = projectionMatrix * mvPos;
  }
`;

const CORONA_FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vRim;

  void main() {
    float a = vRim * vRim * 0.55;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.3) * 1.8, a);
  }
`;

// ── Star field ─────────────────────────────────────────────────────────────────
function StarField() {
  const refs  = useRef<(THREE.Mesh | null)[]>([]);
  const stars = useMemo(() => Array.from({ length: 150 }, () => ({
    pos:   [(Math.random() - 0.5) * 96, (Math.random() - 0.5) * 70, -28 - Math.random() * 22] as [number, number, number],
    scale: 0.016 + Math.random() * 0.052,
    tw:    1.2 + Math.random() * 4.5,
    ph:    Math.random() * Math.PI * 2,
  })), []);

  useFrame(state => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const s  = stars[i];
      const tw = Math.sin(t * s.tw + s.ph) * 0.5 + 0.5;
      m.scale.setScalar(s.scale * (0.28 + tw * 0.72));
      (m.material as THREE.MeshBasicMaterial).opacity = 0.2 + tw * 0.78;
    });
  });

  return (<>
    {stars.map((s, i) => (
      <mesh key={i} ref={el => { refs.current[i] = el; }} position={s.pos}>
        <octahedronGeometry args={[s.scale, 0]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    ))}
  </>);
}

// ── HD Shooting Orbs (InstancedMesh, priority -1) ──────────────────────────────
interface ShootOrb { x:number;y:number;z:number;vx:number;vy:number;size:number;phase:number;twink:number; }

function ShootingOrbs() {
  const orbRef    = useRef<THREE.InstancedMesh>(null);
  const coronaRef = useRef<THREE.InstancedMesh>(null);

  const orbs = useMemo<ShootOrb[]>(() => Array.from({ length: SHOOT_COUNT }, () => {
    const dir   = Math.random() < 0.5 ? 1 : -1;
    const speed = 9 + Math.random() * 16;
    const va    = (Math.random() - 0.5) * 0.35;
    return {
      x: (Math.random() - 0.5) * BX * 2,
      y: (Math.random() - 0.5) * BY * 2,
      z: -14 - Math.random() * 9,
      vx: Math.cos(va) * speed * dir,
      vy: Math.sin(va) * speed,
      size:  0.05 + Math.random() * 0.15,
      phase: Math.random() * Math.PI * 2,
      twink: 1.8 + Math.random() * 4.5,
    };
  }), []);

  const pos = useRef(orbs.map(o => ({ x: o.x, y: o.y })));

  const orbMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms:       { uTime: { value: 0 } },
    vertexShader:   ORB_VERT,
    fragmentShader: ORB_FRAG,
    transparent:    true,
    blending:       THREE.AdditiveBlending,
    depthWrite:     false,
  }), []);

  // Corona has no time-based animation — no uTime uniform needed
  const coronaMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms:       {},
    vertexShader:   CORONA_VERT,
    fragmentShader: CORONA_FRAG,
    transparent:    true,
    blending:       THREE.AdditiveBlending,
    depthWrite:     false,
  }), []);

  // Set per-instance colors in useEffect; runs before first Three.js rAF frame
  useEffect(() => {
    const col = new THREE.Color();
    for (let i = 0; i < SHOOT_COUNT; i++) {
      col.set(SHOOT_COLORS[i % SHOOT_COLORS.length]);
      orbRef.current?.setColorAt(i, col);
      coronaRef.current?.setColorAt(i, col);
    }
    if (orbRef.current?.instanceColor)    orbRef.current.instanceColor.needsUpdate    = true;
    if (coronaRef.current?.instanceColor) coronaRef.current.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    orbMat.uniforms.uTime.value = t;
    // coronaMat has no time-based uniforms

    for (let i = 0; i < SHOOT_COUNT; i++) {
      const p = pos.current[i];
      const o = orbs[i];
      p.x += o.vx * delta; p.y += o.vy * delta;
      if (p.x >  BX) p.x = -BX;
      if (p.x < -BX) p.x =  BX;
      if (p.y >  BY) p.y = -BY;
      if (p.y < -BY) p.y =  BY;

      _orbPosX[i] = p.x; _orbPosY[i] = p.y;
      _orbVelX[i] = o.vx; _orbVelY[i] = o.vy;

      const tw = Math.sin(t * o.twink + o.phase) * 0.5 + 0.5;
      const sc = o.size * (0.72 + tw * 0.28);

      _dummy.position.set(p.x, p.y, o.z);
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      orbRef.current?.setMatrixAt(i, _dummy.matrix);

      _dummy.scale.setScalar(sc * 1.72);
      _dummy.updateMatrix();
      coronaRef.current?.setMatrixAt(i, _dummy.matrix);
    }
    if (orbRef.current)    orbRef.current.instanceMatrix.needsUpdate    = true;
    if (coronaRef.current) coronaRef.current.instanceMatrix.needsUpdate = true;
  }, -1); // priority -1 → writes orb positions before ParticleSystem reads them

  return (<>
    <instancedMesh ref={orbRef}    args={[undefined, undefined, SHOOT_COUNT]}>
      <sphereGeometry args={[1, 20, 14]} />
      <primitive object={orbMat} attach="material" />
    </instancedMesh>
    <instancedMesh ref={coronaRef} args={[undefined, undefined, SHOOT_COUNT]}>
      <sphereGeometry args={[1, 10, 7]} />
      <primitive object={coronaMat} attach="material" />
    </instancedMesh>
  </>);
}

// ── Particle system (all 3 types, single useFrame at priority 0) ───────────────
function ParticleSystem() {
  const dustRef   = useRef<THREE.InstancedMesh>(null);
  const streamRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef  = useRef<THREE.InstancedMesh>(null);

  const dustMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.62, 0.80, 1.0),
    transparent: true, opacity: 0.68,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);

  // White base × instanceColor = pure instanceColor result
  const streamMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(1, 1, 1),
    transparent: true, opacity: 0.80,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);

  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(1, 1, 1),
    transparent: true, opacity: 0.90,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => {
    const col = new THREE.Color();
    if (streamRef.current) {
      for (let i = 0; i < STREAM_N; i++) {
        col.set(STREAM_COLORS[Math.floor(i / SPP) % STREAM_COLORS.length]);
        streamRef.current.setColorAt(i, col);
      }
      if (streamRef.current.instanceColor) streamRef.current.instanceColor.needsUpdate = true;
    }
    if (sparkRef.current) {
      for (let i = 0; i < SPARK_N; i++) {
        col.set(SHOOT_COLORS[i % SHOOT_COLORS.length]);
        sparkRef.current.setColorAt(i, col);
      }
      if (sparkRef.current.instanceColor) sparkRef.current.instanceColor.needsUpdate = true;
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t  = state.clock.getElapsedTime();

    _buildGrid();

    // Snapshot impulse ring for this frame — no allocation, just primitives
    const IC    = _impSize;
    const iTail = _impTail;

    const dustMesh   = dustRef.current;
    const streamMesh = streamRef.current;
    const sparkMesh  = sparkRef.current;

    // ── TYPE 1: Nebula Dust ───────────────────────────────────────────────────
    if (dustMesh) {
      for (let i = 0; i < DUST_N; i++) {
        const px = _dX[i], py = _dY[i];
        let ax = (_dBX[i] - px) * 2.0;
        let ay = (_dBY[i] - py) * 2.0;

        // Orb forces via spatial grid (zero allocation — primitives only)
        const pcx = Math.floor((px - GX_MIN) / CELL);
        const pcy = Math.floor((py - GY_MIN) / CELL);
        for (let dcx = -1; dcx <= 1; dcx++) {
          const nx = pcx + dcx; if (nx < 0 || nx >= GW) continue;
          for (let dcy = -1; dcy <= 1; dcy++) {
            const ny = pcy + dcy; if (ny < 0 || ny >= GH) continue;
            const cell = _gridCells[ny * GW + nx];
            for (let ci = 0; ci < cell.length; ci++) {
              const j = cell[ci];
              const dx = px - _orbPosX[j], dy = py - _orbPosY[j];
              const d2 = dx * dx + dy * dy;
              if (d2 < ORB_R2 && d2 > 0.0001) {
                const inv = 1.0 / Math.sqrt(d2);
                const str = (1.0 - d2 / ORB_R2) * 5.5;
                ax += dx * inv * str + _orbVelX[j] * str * 0.05;
                ay += dy * inv * str + _orbVelY[j] * str * 0.05;
              }
            }
          }
        }

        // Explosion forces
        for (let e = 0; e < IC; e++) {
          const idx = (iTail + e) % MAX_IMP;
          const dx = px - _impX[idx], dy = py - _impY[idx];
          const d2 = dx * dx + dy * dy;
          if (d2 < EXP_R2 && d2 > 0.0001) {
            const d   = Math.sqrt(d2);
            const str = (1.0 - d2 / EXP_R2) * _impStr[idx] * 1.4;
            ax += (dx / d) * str; ay += (dy / d) * str;
          }
        }

        _dVX[i] += ax * dt; _dVY[i] += ay * dt;
        const damp = Math.max(0, 1 - 7.0 * dt);
        _dVX[i] *= damp; _dVY[i] *= damp;
        _dX[i] += _dVX[i] * dt; _dY[i] += _dVY[i] * dt;

        const tw = 0.3 + 0.7 * (Math.sin(t * _dTw[i] + _dPh[i]) * 0.5 + 0.5);
        _dummy.position.set(_dX[i], _dY[i], _dZ[i]);
        _dummy.scale.setScalar(_dSz[i] * tw);
        _dummy.updateMatrix();
        dustMesh.setMatrixAt(i, _dummy.matrix);
      }
      dustMesh.instanceMatrix.needsUpdate = true;
    }

    // ── TYPE 2: Ionic Streams ─────────────────────────────────────────────────
    if (streamMesh) {
      for (let i = 0; i < STREAM_N; i++) {
        const s = Math.floor(i / SPP);

        // Advance along stream (flow)
        _sT[i] += STREAM_FLOW[s] * dt / (2 * DUST_BX);
        if (_sT[i] > 1) _sT[i] -= 1;
        if (_sT[i] < 0) _sT[i] += 1;
        const nbx = -DUST_BX + _sT[i] * 2 * DUST_BX;
        const nby = STREAM_CY[s] + STREAM_AMP[s] * Math.sin(nbx * STREAM_FREQ[s] + STREAM_PH[s]);
        _sBX[i] = nbx; _sBY[i] = nby;

        const px = _sX[i], py = _sY[i];
        let ax = (_sBX[i] - px) * 2.8;
        let ay = (_sBY[i] - py) * 2.8;

        // Orb forces
        const pcx = Math.floor((px - GX_MIN) / CELL);
        const pcy = Math.floor((py - GY_MIN) / CELL);
        for (let dcx = -1; dcx <= 1; dcx++) {
          const nx = pcx + dcx; if (nx < 0 || nx >= GW) continue;
          for (let dcy = -1; dcy <= 1; dcy++) {
            const ny = pcy + dcy; if (ny < 0 || ny >= GH) continue;
            const cell = _gridCells[ny * GW + nx];
            for (let ci = 0; ci < cell.length; ci++) {
              const j = cell[ci];
              const dx = px - _orbPosX[j], dy = py - _orbPosY[j];
              const d2 = dx * dx + dy * dy;
              if (d2 < ORB_R2 && d2 > 0.0001) {
                const inv = 1.0 / Math.sqrt(d2);
                const str = (1.0 - d2 / ORB_R2) * 7.0;
                ax += dx * inv * str + _orbVelX[j] * str * 0.05;
                ay += dy * inv * str + _orbVelY[j] * str * 0.05;
              }
            }
          }
        }

        // Explosion forces
        for (let e = 0; e < IC; e++) {
          const idx = (iTail + e) % MAX_IMP;
          const dx = px - _impX[idx], dy = py - _impY[idx];
          const d2 = dx * dx + dy * dy;
          if (d2 < EXP_R2 && d2 > 0.0001) {
            const d   = Math.sqrt(d2);
            const str = (1.0 - d2 / EXP_R2) * _impStr[idx] * 2.2;
            ax += (dx / d) * str; ay += (dy / d) * str;
          }
        }

        _sVX[i] += ax * dt; _sVY[i] += ay * dt;
        const damp = Math.max(0, 1 - 8.0 * dt);
        _sVX[i] *= damp; _sVY[i] *= damp;
        _sX[i] += _sVX[i] * dt; _sY[i] += _sVY[i] * dt;

        const tw = 0.4 + 0.6 * (Math.sin(t * _sTw[i] + _sPh[i]) * 0.5 + 0.5);
        _dummy.position.set(_sX[i], _sY[i], _sZ[i]);
        _dummy.scale.setScalar(_sSz[i] * tw);
        _dummy.updateMatrix();
        streamMesh.setMatrixAt(i, _dummy.matrix);
      }
      streamMesh.instanceMatrix.needsUpdate = true;
    }

    // ── TYPE 3: Cosmic Sparks ─────────────────────────────────────────────────
    if (sparkMesh) {
      for (let i = 0; i < SPARK_N; i++) {
        const px = _kX[i], py = _kY[i];
        let ax = 0, ay = 0;

        // Orb forces (lighter — sparks react less to passing orbs)
        const pcx = Math.floor((px - GX_MIN) / CELL);
        const pcy = Math.floor((py - GY_MIN) / CELL);
        for (let dcx = -1; dcx <= 1; dcx++) {
          const nx = pcx + dcx; if (nx < 0 || nx >= GW) continue;
          for (let dcy = -1; dcy <= 1; dcy++) {
            const ny = pcy + dcy; if (ny < 0 || ny >= GH) continue;
            const cell = _gridCells[ny * GW + nx];
            for (let ci = 0; ci < cell.length; ci++) {
              const j = cell[ci];
              const dx = px - _orbPosX[j], dy = py - _orbPosY[j];
              const d2 = dx * dx + dy * dy;
              if (d2 < ORB_R2 && d2 > 0.0001) {
                const inv = 1.0 / Math.sqrt(d2);
                const str = (1.0 - d2 / ORB_R2) * 3.0;
                ax += dx * inv * str; ay += dy * inv * str;
              }
            }
          }
        }

        // Explosion forces (sparks blast far and wide)
        for (let e = 0; e < IC; e++) {
          const idx = (iTail + e) % MAX_IMP;
          const dx = px - _impX[idx], dy = py - _impY[idx];
          const d2 = dx * dx + dy * dy;
          if (d2 < EXP_R2_SP && d2 > 0.0001) {
            const d   = Math.sqrt(d2);
            const str = (1.0 - d2 / EXP_R2_SP) * _impStr[idx] * 4.5;
            ax += (dx / d) * str; ay += (dy / d) * str;
          }
        }

        _kVX[i] += ax * dt; _kVY[i] += ay * dt;
        // Heavy drag — sparks drift to a stop between explosions
        const damp = Math.max(0, 1 - 3.2 * dt);
        _kVX[i] *= damp; _kVY[i] *= damp;
        _kX[i] += _kVX[i] * dt; _kY[i] += _kVY[i] * dt;

        // Soft boundary wrap
        if (_kX[i] >  DUST_BX) _kX[i] -= 2 * DUST_BX;
        if (_kX[i] < -DUST_BX) _kX[i] += 2 * DUST_BX;
        if (_kY[i] >  DUST_BY) _kY[i] -= 2 * DUST_BY;
        if (_kY[i] < -DUST_BY) _kY[i] += 2 * DUST_BY;

        // Dramatic fast twinkle
        const tw = Math.pow(Math.abs(Math.sin(t * _kTw[i] + _kPh[i])), 0.4);
        _dummy.position.set(_kX[i], _kY[i], _kZ[i]);
        _dummy.scale.setScalar(_kSz[i] * (0.2 + tw * 0.8));
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, _dummy.matrix);
      }
      sparkMesh.instanceMatrix.needsUpdate = true;
    }

    // All three types have consumed this frame's impulses — clear the ring
    _impSize = 0;
    _impTail = _impHead;
  }); // priority 0 (default)

  const dustGeo   = useMemo(() => new THREE.SphereGeometry(1, 3, 2), []);
  const streamGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 3), []);
  const sparkGeo  = useMemo(() => new THREE.SphereGeometry(1, 7, 5), []);

  return (<>
    <instancedMesh ref={dustRef}   args={[dustGeo,   dustMat,   DUST_N]}   />
    <instancedMesh ref={streamRef} args={[streamGeo, streamMat, STREAM_N]} />
    <instancedMesh ref={sparkRef}  args={[sparkGeo,  sparkMat,  SPARK_N]}  />
  </>);
}

// ── Scene root ─────────────────────────────────────────────────────────────────
export function Background() {
  return (<>
    <color attach="background" args={[0, 0, 0]} />
    <StarField />
    <ParticleSystem />
    <ShootingOrbs />
  </>);
}
