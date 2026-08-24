/**
 * fireAura.ts — GPU-accelerated fire particle aura
 * ─────────────────────────────────────────────────
 * Framework-agnostic: works with plain Three.js or inside React-Three-Fiber.
 *
 * Quick-start
 * ───────────
 *   const aura = attachFireAura(bossMesh, { radius: 2.2 });
 *   // every frame (e.g. inside R3F useFrame or your own rAF loop):
 *   aura.update(clock.getElapsedTime());
 *   // on teardown:
 *   aura.dispose();
 *
 * Key customisation knobs (all in FireAuraOptions):
 * ┌──────────────┬───────────────────────────────────────────────────────────┐
 * │ radius       │ AURA_RADIUS — spawn shell size; match your boss mesh radius│
 * │ flameHeight  │ FLAME_HEIGHT — how tall flames reach above the boss (units) │
 * │ maxParticles │ Hard GPU budget (≤3 000 for mobile safety)                 │
 * │ spawnRate    │ Particles/second — controls density/weight of the aura      │
 * └──────────────┴───────────────────────────────────────────────────────────┘
 */

import * as THREE from "three";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  radius: 2.2,       // ← AURA_RADIUS  (world units, ~= boss mesh radius)
  flameHeight: 3.8,  // ← FLAME_HEIGHT (world units above spawn ring)
  maxParticles: 3000, // hard mobile cap — do not exceed without profiling
  spawnRate: 950,    // particles / second  (raise for denser fire)
};

// ── Vertex shader ─────────────────────────────────────────────────────────────
// All per-particle physics runs here — zero CPU position math each frame.
// CPU only writes spawn attributes when a particle is (re-)born.

const VERTEX_SHADER = /* glsl */ `
  // ── Per-particle birth attributes (written once at spawn) ──────────────────
  attribute vec3  aSpawnPos;   // spawn point on/near the aura sphere surface
  attribute vec3  aVelocity;   // initial velocity vector at birth
  attribute float aBirthTime;  // clock value (uTime) at the moment of spawn
  attribute float aMaxLife;    // lifetime in seconds [0.55 – 1.2]
  attribute float aSize;       // base point diameter in px at unit camera distance

  // ── Frame uniforms ─────────────────────────────────────────────────────────
  uniform float uTime;         // elapsed seconds from THREE.Clock

  // ── Varyings → fragment ────────────────────────────────────────────────────
  varying float vAge;          // normalised age: 0 = newborn, 1 = dead
  varying float vAlive;        // 1.0 while living, 0.0 once expired (discard signal)

  void main() {
    float age = uTime - aBirthTime;     // seconds alive

    vAge   = clamp(age / aMaxLife, 0.0, 1.0);
    vAlive = step(age, aMaxLife);       // 1 if alive, 0 if past its lifetime

    // ── GPU physics ──────────────────────────────────────────────────────────
    // Euler-integrate in the vertex shader — no CPU involvement.

    vec3 pos = aSpawnPos + aVelocity * age;

    // Hot gas buoyancy: upward acceleration (mimics convection)
    pos.y += 0.55 * age * age;

    // Two-axis turbulence from cheap sine noise seeded by birth time
    // (each particle gets a unique phase via aBirthTime * prime-ish constants)
    pos.x += sin(aBirthTime * 6.73 + age * 4.17) * 0.20 * age;
    pos.z += cos(aBirthTime * 5.31 + age * 3.89) * 0.20 * age;

    // ── Point size with perspective + life envelope ──────────────────────────
    // fadeIn  : prevents hard pop-in at birth
    // fadeOut : shrinks particle as it approaches death
    float fadeIn  = smoothstep(0.00, 0.10, vAge);
    float fadeOut = 1.0 - smoothstep(0.60, 1.00, vAge);
    float envelope = fadeIn * fadeOut * vAlive;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);

    // 300.0 is a perspective calibration constant — increase to make all
    // particles larger at a given camera distance, decrease to shrink them.
    gl_PointSize = aSize * envelope * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
// Color ramp transitions through four stops as the particle ages.
// THREE.AdditiveBlending is set on the material — this shader does NOT need
// to premultiply alpha; the blending equation handles accumulation.
//
// UnrealBloomPass compatibility: the pass reads the raw HDR luminance of each
// fragment. Bright white-yellow cores (age < 0.2) output near-white at full
// alpha → they automatically contribute to the bloom halo with no extra work.

const FRAGMENT_SHADER = /* glsl */ `
  varying float vAge;
  varying float vAlive;

  void main() {
    if (vAlive < 0.5) discard;  // expired particle — GPU skips early

    // ── Soft circular sprite ─────────────────────────────────────────────────
    vec2  uv = gl_PointCoord - 0.5;
    float d  = length(uv);
    if (d > 0.5) discard;       // clip to circle

    // Opaque core, feathered edge, overall fade as particle ages
    float alpha = (1.0 - smoothstep(0.22, 0.50, d)) * (1.0 - vAge * 0.45);

    // ── Four-stop color ramp ─────────────────────────────────────────────────
    //  0.0 – 0.2  white-yellow  core   (white-hot at birth, near boss surface)
    //  0.2 – 0.5  vivid orange-red     (active flame mid-life)
    //  0.5 – 0.8  cooling deep red     (flame cools as it rises)
    //  0.8 – 1.0  dark ember / smoke   (final extinction)
    vec3 whiteYellow = vec3(1.00, 0.97, 0.78);  // bright incandescent core
    vec3 orangeRed   = vec3(1.00, 0.43, 0.04);  // vivid flame
    vec3 deepRed     = vec3(0.62, 0.05, 0.01);  // cooling ember
    vec3 ember       = vec3(0.18, 0.02, 0.01);  // near-extinguished

    vec3 col;
    if      (vAge < 0.20) col = whiteYellow;
    else if (vAge < 0.50) col = mix(whiteYellow, orangeRed, (vAge - 0.20) / 0.30);
    else if (vAge < 0.80) col = mix(orangeRed,   deepRed,   (vAge - 0.50) / 0.30);
    else                  col = mix(deepRed,      ember,     (vAge - 0.80) / 0.20);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Public API ────────────────────────────────────────────────────────────────

export interface FireAuraOptions {
  /** AURA_RADIUS — spawn shell radius; should equal your boss mesh radius. Default 2.2. */
  radius?: number;
  /**
   * FLAME_HEIGHT — controls how high the upward velocity component is scaled.
   * Larger values produce taller plumes. Default 3.8.
   */
  flameHeight?: number;
  /** Hard particle cap. Do not exceed 3 000 on mobile. Default 3 000. */
  maxParticles?: number;
  /** New particles spawned per second. Raise for a heavier, denser aura. Default 950. */
  spawnRate?: number;
}

export interface FireAuraHandle {
  /** The THREE.Points object — already added as a child of bossMesh. */
  readonly points: THREE.Points;
  /**
   * Call every frame with the current clock elapsed time (seconds).
   * In R3F: `useFrame((s) => aura.update(s.clock.getElapsedTime()))`.
   * In vanilla: `aura.update(clock.getElapsedTime())` inside requestAnimationFrame.
   */
  update(elapsedTime: number): void;
  /** Removes Points from the boss, disposes GPU resources. Call on unmount. */
  dispose(): void;
}

/**
 * attachFireAura — attach a GPU-driven fire particle aura to any Three.js object.
 *
 * The returned `points` object is added as a **child** of `bossMesh`, so it
 * follows the boss automatically through any parent transform changes.
 *
 * @param bossMesh  Any THREE.Object3D (mesh, group, etc.) to parent the aura to.
 * @param options   See FireAuraOptions for customisation knobs.
 */
export function attachFireAura(
  bossMesh: THREE.Object3D,
  options: FireAuraOptions = {}
): FireAuraHandle {
  const {
    radius       = DEFAULTS.radius,
    flameHeight  = DEFAULTS.flameHeight,
    maxParticles: rawMax = DEFAULTS.maxParticles,
    spawnRate    = DEFAULTS.spawnRate,
  } = options;

  // Hard-enforce the mobile-safe particle cap and guard against degenerate values
  const maxParticles = Math.max(1, Math.min(3000, Math.floor(rawMax)));
  const safeSpawnRate = Math.max(0, spawnRate);

  // ── Per-particle data arrays (CPU-side) ────────────────────────────────────
  // Written once at particle birth; the vertex shader reads them every frame.
  const aSpawnPos  = new Float32Array(maxParticles * 3); // xyz spawn position
  const aVelocity  = new Float32Array(maxParticles * 3); // xyz initial velocity
  const aBirthTime = new Float32Array(maxParticles);     // clock time at birth
  const aMaxLife   = new Float32Array(maxParticles);     // lifetime seconds
  const aSize      = new Float32Array(maxParticles);     // point px size

  // Pre-expire all particles so they are invisible until the first update
  for (let i = 0; i < maxParticles; i++) {
    aBirthTime[i] = -9999; // age will be huge → expired → gl_PointSize = 0
    aMaxLife[i]   = 0.001;
  }

  // ── BufferGeometry setup ───────────────────────────────────────────────────
  const geometry = new THREE.BufferGeometry();

  const attrSpawn = new THREE.BufferAttribute(aSpawnPos,  3);
  const attrVel   = new THREE.BufferAttribute(aVelocity,  3);
  const attrBirth = new THREE.BufferAttribute(aBirthTime, 1);
  const attrLife  = new THREE.BufferAttribute(aMaxLife,   1);
  const attrSize  = new THREE.BufferAttribute(aSize,      1);

  // DynamicDrawUsage signals the GPU driver that these buffers change often.
  // aVelocity is also dynamic — it is written fresh for every new particle.
  attrSpawn.setUsage(THREE.DynamicDrawUsage);
  attrVel.setUsage(THREE.DynamicDrawUsage);
  attrBirth.setUsage(THREE.DynamicDrawUsage);
  attrLife.setUsage(THREE.DynamicDrawUsage);
  attrSize.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute("aSpawnPos",  attrSpawn);
  geometry.setAttribute("aVelocity",  attrVel);
  geometry.setAttribute("aBirthTime", attrBirth);
  geometry.setAttribute("aMaxLife",   attrLife);
  geometry.setAttribute("aSize",      attrSize);

  // ── ShaderMaterial — AdditiveBlending + UnrealBloomPass compatible ─────────
  //
  // Why ShaderMaterial works with UnrealBloomPass:
  //   UnrealBloomPass operates as a post-process over the final rendered scene.
  //   It extracts bright pixels via a luminance threshold pass, then blurs and
  //   composites them. THREE.ShaderMaterial outputs to gl_FragColor like any
  //   other material — the bloom pass reads that output transparently.
  //   The white-yellow core (age < 0.2) emits near-white at full alpha, giving
  //   bloom pass high-luminance input → strong halo bleed around the core.
  //
  // Why AdditiveBlending:
  //   Particles accumulate brightness where they overlap (the dense core region).
  //   On the dark game background this creates the white-hot appearance without
  //   requiring actual HDR tonemapping — the additive math does it for free.
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader:   VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending:       THREE.AdditiveBlending,
    depthWrite:     false,  // additive particles must NOT occlude each other
    transparent:    true,
    vertexColors:   false,
  });

  // ── Points object ──────────────────────────────────────────────────────────
  const points = new THREE.Points(geometry, material);

  // Particles drift outside the local bounding box — disable frustum culling
  // or the entire system disappears when the computed bbox leaves the frustum.
  points.frustumCulled = false;

  // Parent to boss → inherits its world transform automatically
  bossMesh.add(points);

  // ── Spawn helpers ──────────────────────────────────────────────────────────
  let spawnAccum = 0;
  let cursor     = 0; // round-robin write head through the particle pool

  function spawnParticle(t: number): void {
    const i = cursor;
    cursor   = (cursor + 1) % maxParticles;

    // Uniform random point on a sphere shell at ~radius distance
    // This ensures fire wraps around the entire boss, not just the top
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1); // uniform solid angle
    // Slight radial jitter so the spawn shell has visible thickness
    const r     = radius * (0.85 + Math.random() * 0.30);

    const sx = Math.sin(phi) * Math.cos(theta) * r;
    const sy = Math.sin(phi) * Math.sin(theta) * r;
    const sz = Math.cos(phi) * r;

    // Velocity: upward bias + small outward push so fire blooms away from boss
    const outward = 0.40;
    const normX   = sx / r;
    const normZ   = sz / r;

    const vx = normX * outward + (Math.random() - 0.5) * 0.30;
    // flameHeight directly scales the vertical launch speed — the primary height knob
    const vy = 0.55 + Math.random() * flameHeight * 0.50;
    const vz = normZ * outward + (Math.random() - 0.5) * 0.30;

    const b = i * 3;
    aSpawnPos[b]     = sx; aSpawnPos[b + 1]  = sy; aSpawnPos[b + 2]  = sz;
    aVelocity[b]     = vx; aVelocity[b + 1]  = vy; aVelocity[b + 2]  = vz;
    aBirthTime[i]    = t;
    aMaxLife[i]      = 0.55 + Math.random() * 0.65; // 0.55–1.20 s
    aSize[i]         = 16 + Math.random() * 30;      // px at unit distance
  }

  // ── Per-frame update ───────────────────────────────────────────────────────
  let lastTime = -1;

  function update(elapsedTime: number): void {
    material.uniforms.uTime.value = elapsedTime;

    // Skip the very first call (no valid delta yet) and any large hitches
    const dt = elapsedTime - lastTime;
    lastTime = elapsedTime;
    if (dt <= 0 || dt > 0.25) return;

    // Spawn the appropriate number of new particles for this frame
    spawnAccum += safeSpawnRate * dt;
    const toSpawn = Math.floor(spawnAccum);
    spawnAccum   -= toSpawn;

    for (let n = 0; n < toSpawn; n++) {
      spawnParticle(elapsedTime);
    }

    if (toSpawn > 0) {
      // needsUpdate = true causes Three.js to re-upload to the GPU next render.
      // All five attributes are written at spawn — all must be marked dirty.
      // attrVel in particular carries the upward/outward velocity the vertex
      // shader uses for physics; skipping it leaves particles stationary.
      attrSpawn.needsUpdate = true;
      attrVel.needsUpdate   = true;
      attrBirth.needsUpdate = true;
      attrLife.needsUpdate  = true;
      attrSize.needsUpdate  = true;
    }
  }

  // ── Dispose ────────────────────────────────────────────────────────────────
  function dispose(): void {
    bossMesh.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}
