/**
 * World1FireBackground.tsx — AAA HD fire-themed backdrop for World 1.
 *
 * Architecture:
 *   MagmaPlane    — large curved plane, GLSL fBm vertex displacement + heat palette
 *   FireEmbers    — 500 GPU-instanced billboard embers, curl-noise buoyancy physics
 *   SurgeRing     — 300 shockwave sparks triggered by magmaSurge()
 *   VolcanicLights — 3 flickering orange point lights
 *
 * All particle physics, magma noise, and lighting run 100% in GLSL shaders.
 * Zero per-frame CPU allocations.
 *
 * Public API (module-level, call from anywhere):
 *   setWorldFireIntensity(factor: 0.1..2.0)  — smolder → eruption scalar
 *   magmaSurge()                              — 150ms white-hot flash + shockwave ring
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ─── Module-level fire state (never triggers React re-renders) ─────────────────
let _intensity      = 1.0;
let _surgeRequested = false;
let _surgeStartT    = -1.0;   // clock.elapsedTime when last surge fired; -1 = none

/** Scale overall fire intensity. 0.1 = smoldering embers, 2.0 = volcanic eruption. */
export function setWorldFireIntensity(factor: number): void {
  _intensity = Math.max(0.1, Math.min(2.0, factor));
}

/**
 * Instant volcanic shockwave: 150ms white-hot flash across the magma plane +
 * 300 radial high-speed sparks bursting across the background.
 */
export function magmaSurge(): void {
  _surgeRequested = true;
}

// ─── Pre-allocated particle seed buffers (initialized once at module load) ──────
const EMBER_N = 500;
const SURGE_N = 300;

// Ember birth positions (world-space, spread across background area)
const _eOrigin = new Float32Array(EMBER_N * 3);
// Ember randomisation: (s0=x-drift, s1=z-drift, s2=speed, s3=lifetime 1–3s)
const _eSeed   = new Float32Array(EMBER_N * 4);
// Surge spark seeds: (s0=size, s1=angle 0..2π, s2=speed, s3=z-variation)
const _sSeed   = new Float32Array(SURGE_N * 4);

;(() => {
  for (let i = 0; i < EMBER_N; i++) {
    _eOrigin[i * 3 + 0] = (Math.random() - 0.5) * 58;
    _eOrigin[i * 3 + 1] = (Math.random() - 0.5) * 22 - 8;  // born below center
    _eOrigin[i * 3 + 2] = -14 - Math.random() * 9;
    _eSeed[i * 4 + 0]   = Math.random();
    _eSeed[i * 4 + 1]   = Math.random();
    _eSeed[i * 4 + 2]   = Math.random();
    _eSeed[i * 4 + 3]   = 1.0 + Math.random() * 2.0;       // 1–3s lifespan
  }
  for (let i = 0; i < SURGE_N; i++) {
    _sSeed[i * 4 + 0] = Math.random();
    _sSeed[i * 4 + 1] = (i / SURGE_N) * Math.PI * 2.0;     // evenly-spread angles
    _sSeed[i * 4 + 2] = Math.random();
    _sSeed[i * 4 + 3] = Math.random();
  }
})();

// ─── GLSL: Magma Backdrop Plane ────────────────────────────────────────────────
//
// Computes 5-octave fBm noise in vertex shader to:
//   1. Displace vertices along +Z (lava ridges swell toward camera)
//   2. Reconstruct displaced surface normal via finite differences
//   3. Pass N·V and noise value to fragment shader for palette mapping
//
const MAGMA_VERT = /* glsl */`
  uniform float uTime;
  uniform float uIntensity;

  out vec2  vUv;
  out float vNoise;
  out float vNdV;
  out float vEdge;

  // ── Value noise + fBm helpers ─────────────────────────────────────────────
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h2(i),          b = h2(i + vec2(1.0, 0.0));
    float c = h2(i + vec2(0.0, 1.0)), d = h2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // 5-octave fBm with domain rotation to break axis-aligned artifacts
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 R = mat2(1.7, 1.2, -1.2, 1.7);  // 35° rotation + slight scale
    for (int i = 0; i < 5; i++) { v += a * vn(p); p = R * p; a *= 0.5; }
    return v;
  }

  void main() {
    vUv = uv;

    // Two-layer scrolled noise: primary slow roll + secondary faster churn
    vec2 scroll = vec2(uTime * 0.055 * uIntensity, uTime * 0.038 * uIntensity);
    vec2 sc     = uv * 2.8 + scroll;
    float h     = fbm(sc);
    vNoise      = h;

    // Vertex displacement — ridges swell toward camera along +Z
    float disp  = 3.2 * uIntensity;
    vec3  pos   = position;
    pos.z      += h * disp;

    // Edge alpha fade so the plane blends with surrounding space background
    float ex = min(uv.x, 1.0 - uv.x) * 2.0;
    float ey = min(uv.y, 1.0 - uv.y) * 2.0;
    vEdge    = clamp(min(ex, ey) * 4.0, 0.0, 1.0);

    // Displaced surface normal via finite-difference fBm gradient
    float eps = 0.015;
    float hx  = fbm(sc + vec2(eps, 0.0));
    float hy  = fbm(sc + vec2(0.0, eps));
    vec3  T1  = normalize(vec3(1.0, 0.0, (hx - h) * disp / eps));
    vec3  T2  = normalize(vec3(0.0, 1.0, (hy - h) * disp / eps));
    vec3  dN  = normalize(cross(T1, T2));

    // N·V: displaced normal vs view direction (identifies hot ridge crests)
    vec4 mv      = modelViewMatrix * vec4(pos, 1.0);
    vec3 viewDir = normalize(-mv.xyz);
    vec3 vN      = normalize(mat3(normalMatrix) * dN);
    vNdV         = clamp(dot(vN, viewDir), 0.0, 1.0);

    gl_Position  = projectionMatrix * mv;
  }
`;

const MAGMA_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSurge;      // 0–1: surge flash intensity

  in vec2  vUv;
  in float vNoise;
  in float vNdV;
  in float vEdge;
  out vec4 fragColor;

  void main() {
    // ── Level 1.9 Boss five-stop palette ─────────────────────────────────────
    vec3 c0 = vec3(0.071, 0.012, 0.000);  // #120300 — Obsidian Charcoal
    vec3 c1 = vec3(0.545, 0.000, 0.000);  // #8B0000 — Deep Molten Red
    vec3 c2 = vec3(1.000, 0.133, 0.000);  // #FF2200 — Magma Orange-Red
    vec3 c3 = vec3(1.000, 0.533, 0.000);  // #FF8800 — Incandescent Solar Flame
    vec3 c4 = vec3(1.000, 0.961, 0.800);  // #FFF5CC — Plasma White-Yellow

    // Heat = noise (lava flow topology) + N·V (ridge-crest brightness)
    float heat = clamp(vNoise * 0.62 + vNdV * 0.58, 0.0, 1.0);

    vec3 col;
    if      (heat < 0.20) col = mix(c0, c1, heat / 0.20);
    else if (heat < 0.50) col = mix(c1, c2, (heat - 0.20) / 0.30);
    else if (heat < 0.75) col = mix(c2, c3, (heat - 0.50) / 0.25);
    else if (heat < 0.90) col = mix(c3, c4, (heat - 0.75) / 0.15);
    else                  col = c4;

    // Animated lava crackle veins — thin bright seams pulsing on ridge crests
    float crackle    = pow(clamp(vNdV * 1.6 - 0.70, 0.0, 1.0), 6.0);
    float crackPulse = 0.5 + 0.5 * sin(uTime * 3.5 + vUv.x * 32.0 + vUv.y * 18.0);
    col += c3 * crackle * crackPulse * 0.72 * uIntensity;

    // Surge: instant white-hot flash (linear fade over 150ms driven by CPU)
    col = mix(col, c4 * 2.2, uSurge);

    // Global emissive scale
    col *= 0.74 + 0.56 * uIntensity;

    // Galaxy-patch alpha: fire only shows in concentrated hot spots, fading to
    // fully transparent in cooler areas so the space background dominates.
    // Below heat=0.38 → invisible; above → power-curve up to ~28% max opacity.
    float patch    = max(0.0, heat - 0.38) / 0.62;
    float heatAlpha = pow(patch, 1.6) * 0.28;
    fragColor = vec4(col, vEdge * heatAlpha);
  }
`;

// ─── GLSL: Ember Particle Billboards ──────────────────────────────────────────
//
// All per-particle physics computed in vertex shader from seed attributes + uTime.
// CPU never touches particle data after geometry initialization — zero allocations.
//
// Lifecycle: each particle has a lifetime (1–3s). Age = mod(time+phase, lifetime)
// loops continuously. Position is buoyancy rise + curl-noise drift.
//
const EMBER_VERT = /* glsl */`
  attribute vec3 aOrigin;   // world-space spawn position
  attribute vec4 aSeed;     // xyz=random seeds, w=lifetime (1–3s)

  uniform float uTime;
  uniform float uIntensity;

  out vec2  vQuadUv;
  out float vLife;
  out float vFlicker;
  out vec3  vColor;

  void main() {
    vQuadUv = uv;

    float lifetime = aSeed.w;
    float speed    = 0.30 + aSeed.z * 0.20;
    float phase    = aSeed.z * lifetime;                  // stagger birth across time
    float age      = mod(uTime * speed + phase, lifetime);
    vLife          = age / lifetime;                      // 0=birth, 1=death

    // ── Buoyancy + curl-noise drift ─────────────────────────────────────────
    float rise  = age * (2.0 + aSeed.x * 1.6) * uIntensity;
    float driftX = sin(age * 2.2 + aSeed.x * 6.283) * (0.5 + aSeed.y * 0.9) * uIntensity;
    float driftZ = cos(age * 1.8 + aSeed.y * 6.283) * 0.7;
    vec3 pos = aOrigin + vec3(driftX, rise, driftZ);

    // ── Billboard sizing — shrinks to zero at death ─────────────────────────
    float alive = step(vLife, 0.97);   // kill last 3% of lifetime
    float sz    = (1.0 - vLife) * (0.10 + aSeed.x * 0.09) * uIntensity * alive;

    // Billboard: expand quad against camera X/Y axes (view-aligned)
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 wPos  = pos + right * (position.x * sz) + up * (position.y * sz);

    // ── Ember color gradient: yellow-orange → vivid red → cooling ash ───────
    vec3 youngCol = vec3(1.00, 0.75, 0.00);   // fresh spark
    vec3 midCol   = vec3(1.00, 0.18, 0.00);   // active ember
    vec3 ashCol   = vec3(0.40, 0.04, 0.00);   // spent ash
    if (vLife < 0.4) vColor = mix(youngCol, midCol, vLife / 0.4);
    else             vColor = mix(midCol, ashCol, (vLife - 0.4) / 0.6);

    // Flicker per spec: I = sin(t * 20.0 + seed)
    vFlicker = 0.55 + 0.45 * sin(uTime * 20.0 + aSeed.x * 12.566);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(wPos, 1.0);
  }
`;

const EMBER_FRAG = /* glsl */`
  in vec2  vQuadUv;
  in float vLife;
  in float vFlicker;
  in vec3  vColor;
  out vec4 fragColor;

  void main() {
    // Soft circular glow — smooth falloff from billboard center
    vec2  c    = vQuadUv - 0.5;
    float dist = length(c) * 2.0;        // 0=center, 1=edge
    float glow = max(0.0, 1.0 - dist * dist);

    // Fade in quickly (5× birth rate), then gradual fade with lifetime
    float alpha = min(vLife * 5.0, 1.0) * (1.0 - vLife) * glow * vFlicker;

    fragColor = vec4(vColor * (0.9 + vFlicker * 0.1), alpha);
  }
`;

// ─── GLSL: Surge Shockwave Ring ────────────────────────────────────────────────
//
// 300 radial sparks emanating from scene center when magmaSurge() is called.
// Active for 0.6s after trigger; particles beyond the duration are culled
// by projecting to a point far outside clip space.
//
const SURGE_VERT = /* glsl */`
  attribute vec4 aSeed;   // x=size, y=angle 0..2π, z=speed, w=z-variation

  uniform float uTime;
  uniform float uSurgeTime;  // clock.elapsedTime when surge fired; <0 = inactive

  out float vLife;
  out float vAlive;

  void main() {
    float duration = 0.60;
    float age      = (uSurgeTime < 0.0) ? duration + 1.0 : (uTime - uSurgeTime);

    vAlive = step(age, duration);
    vLife  = clamp(age / duration, 0.0, 1.0);

    if (age > duration) {
      // Cull dead sparks — push far outside clip volume
      gl_Position = vec4(0.0, 0.0, 99999.0, 1.0);
      return;
    }

    float speed = 18.0 + aSeed.z * 14.0;   // 18–32 units/second
    float r     = age * speed;
    vec3  pos   = vec3(cos(aSeed.y) * r, sin(aSeed.y) * r, -17.0 + aSeed.w * 5.0);

    float sz    = (1.0 - vLife) * (0.08 + aSeed.x * 0.10);
    vec3 right  = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up     = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 wPos   = pos + right * (position.x * sz) + up * (position.y * sz);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(wPos, 1.0);
  }
`;

const SURGE_FRAG = /* glsl */`
  in float vLife;
  in float vAlive;
  out vec4 fragColor;

  void main() {
    if (vAlive < 0.5) discard;

    // White-hot at birth (#FFF5CC), cools to magma orange-red
    vec3 hot  = vec3(1.00, 0.961, 0.80);  // #FFF5CC
    vec3 cool = vec3(1.00, 0.27,  0.00);  // #FF4500
    vec3 col  = mix(hot, cool, vLife);

    float alpha = (1.0 - vLife) * (1.0 - vLife);  // quadratic fade
    fragColor = vec4(col, alpha);
  }
`;

// ─── Geometry builder helper ────────────────────────────────────────────────────
function buildInstancedQuadGeo(
  seeds: Record<string, THREE.InstancedBufferAttribute>,
  count: number,
): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo  = new THREE.InstancedBufferGeometry();
  geo.index  = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv",       base.getAttribute("uv"));
  geo.setAttribute("normal",   base.getAttribute("normal"));
  for (const [name, attr] of Object.entries(seeds)) {
    geo.setAttribute(name, attr);
  }
  geo.instanceCount = count;
  base.dispose();
  return geo;
}

// ─── World1FireScene: all hooks, materials, and one useFrame ───────────────────
function World1FireScene() {

  // ── Magma plane uniforms + material ────────────────────────────────────────
  const magmaUniforms = useMemo(() => ({
    uTime:      { value: 0.0 },
    uIntensity: { value: 1.0 },
    uSurge:     { value: 0.0 },
  }), []);

  const magmaGeo = useMemo(() =>
    new THREE.PlaneGeometry(160, 105, 100, 70), []);

  const magmaMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   MAGMA_VERT,
    fragmentShader: MAGMA_FRAG,
    uniforms:       magmaUniforms,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.FrontSide,
    glslVersion:    THREE.GLSL3,
  }), [magmaUniforms]);

  // ── Ember instanced geometry + material ────────────────────────────────────
  const emberUniforms = useMemo(() => ({
    uTime:      { value: 0.0 },
    uIntensity: { value: 1.0 },
  }), []);

  const emberGeo = useMemo(() => buildInstancedQuadGeo({
    aOrigin: new THREE.InstancedBufferAttribute(_eOrigin, 3),
    aSeed:   new THREE.InstancedBufferAttribute(_eSeed,   4),
  }, EMBER_N), []);

  const emberMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    uniforms:       emberUniforms,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
    side:           THREE.DoubleSide,
    glslVersion:    THREE.GLSL3,
  }), [emberUniforms]);

  // ── Surge ring instanced geometry + material ───────────────────────────────
  const surgeUniforms = useMemo(() => ({
    uTime:      { value: 0.0 },
    uSurgeTime: { value: -1.0 },
  }), []);

  const surgeGeo = useMemo(() => buildInstancedQuadGeo({
    aSeed: new THREE.InstancedBufferAttribute(_sSeed, 4),
  }, SURGE_N), []);

  const surgeMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   SURGE_VERT,
    fragmentShader: SURGE_FRAG,
    uniforms:       surgeUniforms,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
    side:           THREE.DoubleSide,
    glslVersion:    THREE.GLSL3,
  }), [surgeUniforms]);

  // ── Volcanic point lights ──────────────────────────────────────────────────
  const centerLightRef = useRef<THREE.PointLight>(null);
  const leftLightRef   = useRef<THREE.PointLight>(null);
  const rightLightRef  = useRef<THREE.PointLight>(null);

  // ── Dispose all WebGL resources on unmount ─────────────────────────────────
  useEffect(() => () => {
    magmaGeo.dispose(); magmaMat.dispose();
    emberGeo.dispose(); emberMat.dispose();
    surgeGeo.dispose(); surgeMat.dispose();
    // Reset module state so surge doesn't fire on re-mount
    _surgeStartT    = -1.0;
    _surgeRequested = false;
  }, [magmaGeo, magmaMat, emberGeo, emberMat, surgeGeo, surgeMat]);

  // ── Single useFrame: update all uniforms + lights (zero allocations) ───────
  useFrame(({ clock }) => {
    const t     = clock.getElapsedTime();
    const inten = _intensity;

    // Handle pending surge: record clock time so shaders can compute elapsed age
    if (_surgeRequested) {
      _surgeRequested = false;
      _surgeStartT    = t;
    }

    // Surge flash: 150ms linear 1→0 decay (drives magma white-hot flash)
    const FLASH_DUR  = 0.15;
    const surgeAge   = _surgeStartT >= 0 ? t - _surgeStartT : 999.0;
    const surgeFlash = surgeAge < FLASH_DUR ? 1.0 - surgeAge / FLASH_DUR : 0.0;

    // Surge ring active for 0.6s; pass -1 after expiry so GLSL culls all sparks
    const surgeTime  = (surgeAge <= 0.6 && _surgeStartT >= 0) ? _surgeStartT : -1.0;

    // ── Magma plane ──────────────────────────────────────────────────────────
    magmaUniforms.uTime.value      = t;
    magmaUniforms.uIntensity.value = inten;
    magmaUniforms.uSurge.value     = surgeFlash;

    // ── Embers: temporarily double intensity during surge ────────────────────
    emberUniforms.uTime.value      = t;
    emberUniforms.uIntensity.value = inten + surgeFlash * inten;

    // ── Surge ring ───────────────────────────────────────────────────────────
    surgeUniforms.uTime.value      = t;
    surgeUniforms.uSurgeTime.value = surgeTime;

    // ── Volcanic lights: stacked-sine flicker, intensity range 1.0–3.5 ──────
    if (centerLightRef.current) {
      centerLightRef.current.intensity =
        (1.8 + 1.7 * (0.5 + 0.5 * Math.sin(t * 7.3))) * inten;
    }
    if (leftLightRef.current) {
      leftLightRef.current.intensity =
        (0.9 + 1.3 * (0.5 + 0.5 * Math.sin(t * 5.1 + 2.1))) * inten;
    }
    if (rightLightRef.current) {
      rightLightRef.current.intensity =
        (0.9 + 1.3 * (0.5 + 0.5 * Math.sin(t * 6.2 + 4.3))) * inten;
    }
  });

  return (
    <>
      {/* Magma backdrop plane — positioned at z=-26, behind all space particles
          (dust: z -10..-24, streams: z -11..-23, sparks: z -9..-17).
          Embers at z -14..-23 interleave with space particles in front of it. */}
      <mesh
        geometry={magmaGeo}
        material={magmaMat}
        position={[0, 0, -26]}
        frustumCulled={false}
      />

      {/* 500 GPU-instanced ember billboards */}
      <mesh
        geometry={emberGeo}
        material={emberMat}
        frustumCulled={false}
      />

      {/* 300 radial shockwave sparks — only visible after magmaSurge() */}
      <mesh
        geometry={surgeGeo}
        material={surgeMat}
        frustumCulled={false}
      />

      {/* Volcanic point lights: center orange-red, two flanking amber */}
      <pointLight
        ref={centerLightRef}
        color="#FF4400"
        intensity={2.5}
        distance={30}
        decay={2}
        position={[0, 0, -2]}
      />
      <pointLight
        ref={leftLightRef}
        color="#FF8800"
        intensity={1.5}
        distance={24}
        decay={2}
        position={[-20, -6, -13]}
      />
      <pointLight
        ref={rightLightRef}
        color="#FF8800"
        intensity={1.5}
        distance={24}
        decay={2}
        position={[20, -6, -13]}
      />
    </>
  );
}

// ─── Public root component ─────────────────────────────────────────────────────
//
// Subscribes to gameMode + arcadeLevel only (selector never changes reference
// unless the world number actually changes). When World 1 is active in arcade
// mode, mounts World1FireScene; otherwise renders nothing.
//
export function World1FireBackground() {
  const isActive = useMagicOrb(s =>
    s.gameMode === "arcade" && Math.floor(s.arcadeLevel) === 1
  );

  if (!isActive) return null;
  return <World1FireScene />;
}
