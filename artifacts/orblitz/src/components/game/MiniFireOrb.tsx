/**
 * MiniFireOrb — scaled-down Fire Boss visual.
 *
 * Deliberately inherits the FireBoss look exactly:
 *  • Same vertex + fragment shaders (identical GLSL)
 *  • Same FireCorona ember system (radius-scaled)
 *  • Same slow axial rotation
 *  • No 2D overlays (eyes, glow rings, etc.)
 *
 * Radius is 1 in local units; the parent group's scale drives world size.
 *
 * Used by:
 *  - World 1 regular enemies (World1EnemyMesh in DarkOrbs.tsx)
 *  - Level 1.9 boss projectile orbs (BossOrbMesh circle branch)
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Shaders — exact copy from FireBoss.tsx ────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHealth;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p  = p * 2.17 + vec2(3.7 * float(i), 1.9 * float(i));
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 q = vUv * 3.5;
    q.y -= uTime * 0.6;
    float warp = fbm(q + fbm(q + fbm(q)));
    float n    = fbm(q + warp * 1.8 + vec2(uTime * 0.12, 0.0));

    float limb = max(0.0, 1.0 - length(vNormal.xy) * 0.65);
    n = clamp(n * limb + n * 0.25, 0.0, 1.0);

    float anger = step(uHealth, 0.3) * (sin(uTime * 18.0) * 0.5 + 0.5);
    n = clamp(n + anger * 0.25, 0.0, 1.0);

    vec3 crimson    = vec3(0.55, 0.02, 0.01);
    vec3 deepOrange = vec3(0.88, 0.18, 0.0);
    vec3 orange     = vec3(1.0,  0.44, 0.0);
    vec3 yellow     = vec3(1.0,  0.93, 0.08);
    vec3 white      = vec3(1.0,  1.0,  0.92);

    vec3 col;
    float t = n;
    if      (t < 0.25) col = mix(crimson,    deepOrange, t / 0.25);
    else if (t < 0.50) col = mix(deepOrange, orange,     (t - 0.25) / 0.25);
    else if (t < 0.75) col = mix(orange,     yellow,     (t - 0.50) / 0.25);
    else               col = mix(yellow,     white,      (t - 0.75) / 0.25);

    col = mix(col, vec3(1.0, 0.04, 0.0), anger * 0.55);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Fire corona — same logic as FireBoss, scaled to radius ───────────────────

const CORONA_COUNT = 40; // half of boss count — right density for a mini orb

function MiniFireCorona({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  interface Ember {
    angle: number; elevation: number; dist: number;
    speed: number; life: number; maxLife: number;
    size: number;
  }

  const embers = useRef<Ember[]>(
    Array.from({ length: CORONA_COUNT }, (_, i) => ({
      angle:     (i / CORONA_COUNT) * Math.PI * 2,
      elevation: (Math.random() - 0.5) * Math.PI * 0.6,
      dist:      radius * (1.05 + Math.random() * 0.35),
      speed:     0.4 + Math.random() * 0.8,
      life:      Math.random(),
      maxLife:   0.6 + Math.random() * 0.8,
      size:      0.04 + Math.random() * 0.08, // scaled down vs boss (0.06–0.18)
    }))
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const col = new THREE.Color();
    embers.current.forEach((e, i) => {
      e.life -= delta;
      if (e.life <= 0) {
        e.angle     = Math.random() * Math.PI * 2;
        e.elevation = (Math.random() - 0.5) * Math.PI * 0.5;
        e.dist      = radius * (1.05 + Math.random() * 0.3);
        e.life      = e.maxLife;
      }
      e.angle     += delta * e.speed * 0.7;
      e.elevation += delta * 0.25;
      e.dist      += delta * 0.15;

      const r = e.dist;
      const x = Math.cos(e.angle) * Math.cos(e.elevation) * r;
      const y = Math.sin(e.elevation) * r;
      const z = Math.sin(e.angle) * Math.cos(e.elevation) * r;

      const lifeRatio = e.life / e.maxLife;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(e.size * lifeRatio);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      col.setHSL(0.07 - lifeRatio * 0.05, 1.0, 0.5 + lifeRatio * 0.3);
      meshRef.current!.setColorAt(i, col);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CORONA_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface MiniFireOrbProps {
  /** Local-space sphere radius. Parent group scale handles world size. Default 1. */
  radius?: number;
  /** 0–1 health fraction — triggers anger flash below 0.3. Default 1. */
  healthPercent?: number;
}

export function MiniFireOrb({
  radius        = 1,
  healthPercent = 1,
}: MiniFireOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(
    () => ({
      uTime:   { value: 0 },
      uHealth: { value: 1 },
    }),
    []
  );

  useFrame((state, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value   = state.clock.getElapsedTime();
      matRef.current.uniforms.uHealth.value = healthPercent;
    }
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.18;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Fire shader sphere — identical shader to FireBoss */}
      <mesh>
        <sphereGeometry args={[radius, 40, 32]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>

      {/* Ember corona — same system as FireBoss, radius-scaled */}
      <MiniFireCorona radius={radius} />
    </group>
  );
}
