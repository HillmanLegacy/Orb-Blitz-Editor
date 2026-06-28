/**
 * FireBoss — Boss 1 "Fire Orb"
 * • Procedural GLSL fire texture (FBM noise, crimson → orange → bright yellow)
 * • Neon-yellow evil eyes tracking the player
 * • Ambient fire particle corona (additive InstancedMesh)
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── GLSL ──────────────────────────────────────────────────────────────────────

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
      mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),
      mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x),
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
    // Upward-flowing fire distortion
    vec2 q = vUv * 3.5;
    q.y -= uTime * 0.6;
    float warp = fbm(q + fbm(q + fbm(q)));
    float n    = fbm(q + warp * 1.8 + vec2(uTime * 0.12, 0.0));

    // Limb darkening — gives sphere depth
    float limb = max(0.0, 1.0 - length(vNormal.xy) * 0.65);
    n = clamp(n * limb + n * 0.25, 0.0, 1.0);

    // Anger flash when health < 30 %
    float anger = step(uHealth, 0.3) * (sin(uTime * 18.0) * 0.5 + 0.5);
    n = clamp(n + anger * 0.25, 0.0, 1.0);

    // Fire palette: deep crimson → orange → golden yellow → white-hot
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

    // Anger tint
    col = mix(col, vec3(1.0, 0.04, 0.0), anger * 0.55);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Fire corona particles ─────────────────────────────────────────────────────

const CORONA_COUNT = 80;

function FireCorona({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  interface Ember {
    angle: number; elevation: number; dist: number;
    speed: number; life: number; maxLife: number;
    size: number; seed: number;
  }

  const embers = useRef<Ember[]>(
    Array.from({ length: CORONA_COUNT }, (_, i) => ({
      angle:     (i / CORONA_COUNT) * Math.PI * 2,
      elevation: (Math.random() - 0.5) * Math.PI * 0.6,
      dist:      radius * (1.05 + Math.random() * 0.35),
      speed:     0.4 + Math.random() * 0.8,
      life:      Math.random(),
      maxLife:   0.6 + Math.random() * 0.8,
      size:      0.06 + Math.random() * 0.12,
      seed:      Math.random() * Math.PI * 2,
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
      const s = e.size * lifeRatio;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // orange → yellow → fading white
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

// ── Evil Eyes ─────────────────────────────────────────────────────────────────

interface EyeProps {
  radius: number;
  playerPosition: [number, number, number];
  bossPosition: [number, number, number];
  time: number;
}

function EvilEyes({ radius, playerPosition, bossPosition, time }: EyeProps) {
  // Direction toward player
  const dx = playerPosition[0] - bossPosition[0];
  const dy = playerPosition[1] - bossPosition[1];
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / d;
  const ny = dy / d;

  // Eye positions on sphere face (offset slightly forward in Z)
  const eyeOffset = radius * 0.55;
  const eyeR      = radius * 0.28;
  const pupilMax  = eyeR * 0.22;
  const lookX     = nx * pupilMax;
  const lookY     = ny * pupilMax;
  const zFront    = radius * 0.82;

  // Angry blink when time flickers
  const blink = Math.sin(time * 2.3) > 0.88 ? 0.06 : 0.22;

  const eyePositions: [number, number][] = [
    [-eyeOffset * 0.65, eyeOffset * 0.2],
    [ eyeOffset * 0.65, eyeOffset * 0.2],
  ];

  return (
    <group>
      {eyePositions.map(([ex, ey], i) => (
        <group key={i} position={[ex, ey, zFront]}>
          {/* Outer glow */}
          <mesh>
            <circleGeometry args={[eyeR * 1.55, 16]} />
            <meshBasicMaterial
              color="#ff6600"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* White sclera */}
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[eyeR, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
          </mesh>
          {/* Iris — neon yellow */}
          <mesh position={[lookX, lookY, 0.02]}>
            <circleGeometry args={[eyeR * 0.6, 12]} />
            <meshBasicMaterial
              color="#ffe800"
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* Pupil slit */}
          <mesh position={[lookX, lookY, 0.03]} scale={[eyeR * 0.18, eyeR * blink, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#110000" transparent opacity={0.98} />
          </mesh>
          {/* Pupil glow */}
          <mesh position={[lookX, lookY, 0.04]}>
            <circleGeometry args={[eyeR * 0.22, 8]} />
            <meshBasicMaterial
              color="#ff8800"
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FireBossProps {
  radius?: number;
  healthPercent?: number;
  playerPosition?: [number, number, number];
  bossPosition?: [number, number, number];
}

export function FireBoss({
  radius = 2.2,
  healthPercent = 1,
  playerPosition = [0, 0, 0],
  bossPosition   = [0, 0, 0],
}: FireBossProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const timeRef  = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime:   { value: 0 },
      uHealth: { value: 1 },
    }),
    []
  );

  useFrame((state, delta) => {
    timeRef.current = state.clock.getElapsedTime();
    if (matRef.current) {
      matRef.current.uniforms.uTime.value   = timeRef.current;
      matRef.current.uniforms.uHealth.value = healthPercent;
    }
    // Slow axial rotation around Z for visual richness
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.18;
    }
  });

  const angerScale = healthPercent < 0.3 ? 1 + Math.sin(Date.now() * 0.012) * 0.06 : 1;

  return (
    <group ref={groupRef} scale={angerScale}>
      {/* Fire shader sphere */}
      <mesh>
        <sphereGeometry args={[radius, 64, 48]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>

      {/* Soft outer glow corona (back-face sphere) */}
      <mesh>
        <sphereGeometry args={[radius * 1.18, 20, 16]} />
        <meshBasicMaterial
          color="#ff3300"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.38, 14, 10]} />
        <meshBasicMaterial
          color="#ff1100"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ember corona */}
      <FireCorona radius={radius} />

      {/* Evil eyes (rendered outside groupRef rotation so they always face camera) */}
      <EvilEyes
        radius={radius}
        playerPosition={playerPosition}
        bossPosition={bossPosition}
        time={timeRef.current}
      />
    </group>
  );
}
