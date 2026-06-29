/**
 * MiniFireOrb — miniature version of the Fire Boss visual.
 *
 * Designed to be mounted inside a positioned group; renders at local origin,
 * radius 1 (parent group controls world-size via scale).
 *
 * Used by:
 *  - World 1 regular enemies (UnifiedDarkOrbMesh world-1 path)
 *  - Level 1.9 boss projectile orbs (BossOrbMesh circle path)
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── shared GLSL (same quality as FireBoss) ────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv          = uv;
    vNormal      = normalMatrix * normal;
    vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
    vViewDir     = normalize(-mvPos.xyz);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAnger;   // 0-1, ramps up when orb is under "threat" (boss-orb) or parent signals it
  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<6;i++){
      v+=a*noise(p);
      p=p*2.17+vec2(3.7*float(i),1.9*float(i));
      a*=0.5;
    }
    return v;
  }

  void main() {
    // Upward-flowing fire distortion (runs faster than boss for snappy mini look)
    vec2 q  = vUv * 4.0;
    q.y    -= uTime * 0.85;
    float w = fbm(q + fbm(q + fbm(q)));
    float n = fbm(q + w*1.6 + vec2(uTime*0.14, 0.0));

    // Limb darkening
    float limb = max(0.0, 1.0-length(vNormal.xy)*0.6);
    n = clamp(n*limb + n*0.28, 0.0, 1.0);

    // Anger: ramp toward blood-red
    n = clamp(n + uAnger*0.22, 0.0, 1.0);

    // Fire palette
    vec3 crimson    = vec3(0.55,0.02,0.01);
    vec3 deepOrange = vec3(0.88,0.18,0.0);
    vec3 orange     = vec3(1.0, 0.44,0.0);
    vec3 yellow     = vec3(1.0, 0.93,0.08);
    vec3 white      = vec3(1.0, 1.0, 0.92);
    vec3 col;
    float t = n;
    if      (t<0.25) col = mix(crimson,    deepOrange, t/0.25);
    else if (t<0.50) col = mix(deepOrange, orange,     (t-0.25)/0.25);
    else if (t<0.75) col = mix(orange,     yellow,     (t-0.50)/0.25);
    else             col = mix(yellow,     white,      (t-0.75)/0.25);

    col = mix(col, vec3(1.0,0.03,0.0), uAnger*0.5);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Evil eyes ────────────────────────────────────────────────────────────────

interface EyesProps {
  playerPosition: [number, number, number];
  orbPosition:    [number, number, number];
  time: number;
}

function MiniEvilEyes({ playerPosition, orbPosition, time }: EyesProps) {
  const dx = playerPosition[0] - orbPosition[0];
  const dy = playerPosition[1] - orbPosition[1];
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / d;
  const ny = dy / d;

  const zFront = 0.82;
  const eyeR   = 0.155;          // sclera radius in local units
  const irisR  = eyeR * 0.60;
  const pupilR = eyeR * 0.30;
  const travel = irisR - pupilR * 0.6;
  const lookX  = nx * travel;
  const lookY  = ny * travel;

  const blinkT = Math.sin(time * 2.7) > 0.88 ? 1.0 : 0.0;

  const positions: [number, number][] = [[-0.30, 0.12], [0.30, 0.12]];

  return (
    <group>
      {positions.map(([ex, ey], i) => (
        <group key={i} position={[ex, ey, zFront]}>
          {/* Fire glow */}
          <mesh>
            <circleGeometry args={[eyeR * 1.5, 16]} />
            <meshBasicMaterial color="#ff4400" transparent opacity={0.16}
              blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Black outline */}
          <mesh position={[0, 0, 0.004]}>
            <circleGeometry args={[eyeR * 1.1, 18]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          {/* White sclera */}
          <mesh position={[0, 0, 0.008]}>
            <circleGeometry args={[eyeR, 18]} />
            <meshBasicMaterial color="#f8f4e8" />
          </mesh>
          {/* Amber iris — shifts slightly with pupil */}
          <mesh position={[lookX * 0.35, lookY * 0.35, 0.012]}>
            <circleGeometry args={[irisR, 16]} />
            <meshBasicMaterial color="#e87a00" />
          </mesh>
          {/* Round black pupil — full travel */}
          <mesh position={[lookX, lookY, 0.016]}>
            <circleGeometry args={[pupilR, 14]} />
            <meshBasicMaterial color="#080000" />
          </mesh>
          {/* Specular highlight */}
          <mesh position={[lookX - pupilR * 0.45, lookY + pupilR * 0.45, 0.02]}>
            <circleGeometry args={[pupilR * 0.35, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
          </mesh>
          {/* Secondary mini-shine */}
          <mesh position={[lookX + pupilR * 0.3, lookY - pupilR * 0.3, 0.021]}>
            <circleGeometry args={[pupilR * 0.16, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
          </mesh>
          {/* Eyelid on blink */}
          {blinkT > 0 && (
            <mesh position={[0, eyeR * 0.48, 0.024]}
              scale={[eyeR * 2.3, eyeR * 1.15, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#080000" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MiniFireOrbProps {
  /** world-space position of this orb (for eye direction) */
  orbPosition:    [number, number, number];
  /** world-space position of the player */
  playerPosition: [number, number, number];
  /** 0-1 anger level: flashes red at high values */
  anger?: number;
  /** base time for shader sync (pass clock.getElapsedTime()) */
  time?: number;
}

export function MiniFireOrb({
  orbPosition,
  playerPosition,
  anger = 0,
  time  = 0,
}: MiniFireOrbProps) {
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(time);

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uAnger: { value: 0 },
  }), []);

  useFrame((state) => {
    timeRef.current = state.clock.getElapsedTime();
    if (matRef.current) {
      matRef.current.uniforms.uTime.value  = timeRef.current;
      matRef.current.uniforms.uAnger.value = anger;
    }
  });

  return (
    <group>
      {/* Fire shader sphere */}
      <mesh>
        <sphereGeometry args={[1, 40, 32]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>

      {/* Outer additive glow */}
      <mesh>
        <sphereGeometry args={[1.22, 14, 10]} />
        <meshBasicMaterial
          color="#ff3300" transparent opacity={0.13}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </mesh>

      {/* Evil eyes */}
      <MiniEvilEyes
        playerPosition={playerPosition}
        orbPosition={orbPosition}
        time={timeRef.current}
      />
    </group>
  );
}
