/**
 * MiniPlasmaOrb — projectile fired by the Plasma Boss (level 5.9).
 * Same electric arc shader + tendrils as PlasmaBoss, scaled to radius=1.
 * Parent group controls the final rendered size.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Arc shader (identical palette to PlasmaBoss) ───────────────────────────────

const electricVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vUv      = uv;
    vNormal  = normalMatrix * normal;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const electricFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float hash1(float p) { return fract(sin(p) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  float arcLine(float x, float sharpness) {
    return pow(1.0 - abs(sin(x)), sharpness);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 1.8);

    vec2 q  = vUv * 3.5 + vec2(uTime * 0.04, uTime * 0.025);
    float warpX = noise(q) * 2.0 - 1.0;
    float warpY = noise(q + vec2(3.7, 1.9)) * 2.0 - 1.0;
    vec2 warped = vUv + vec2(warpX, warpY) * 0.18;

    float a1 = arcLine(warped.x * 12.0 + uTime * 1.8,  18.0)
             * arcLine(warped.y * 8.0  - uTime * 1.3,  14.0);
    float a2 = arcLine(warped.x * 20.0 - uTime * 2.7 + 1.1, 22.0)
             * arcLine(warped.y * 14.0 + uTime * 2.1 + 0.7, 18.0);
    vec2 diag = vec2(warped.x + warped.y, warped.x - warped.y) * 0.707;
    float a3 = arcLine(diag.x * 16.0 + uTime * 3.1 + 2.0, 20.0)
             * arcLine(diag.y * 11.0 - uTime * 1.9 + 0.5, 16.0);

    float arcs = a1 + a2 * 0.75 + a3 * 0.55;

    float sparkSlot = floor(uTime * 12.0);
    float sparkRand  = hash1(sparkSlot + floor(warped.x * 7.0) + floor(warped.y * 5.0) * 13.0);
    arcs += sparkRand > 0.82 ? a2 * 3.0 : 0.0;

    vec3 deep   = vec3(0.01, 0.00, 0.18);
    vec3 mid    = vec3(0.05, 0.12, 0.82);
    vec3 bright = vec3(0.30, 0.55, 1.00);
    vec3 arcCol = vec3(0.80, 0.88, 1.00);

    float nBase   = noise(vUv * 4.0 + vec2(-uTime*0.06, uTime*0.04));
    float nDetail = noise(vUv * 8.0 + vec2( uTime*0.10,-uTime*0.07));
    float t = nBase * 0.65 + nDetail * 0.35;

    vec3 col;
    if      (t < 0.35) col = mix(deep,   mid,    t / 0.35);
    else if (t < 0.65) col = mix(mid,    bright, (t-0.35)/0.30);
    else               col = mix(bright, arcCol, (t-0.65)/0.35);

    col += arcCol * clamp(arcs, 0.0, 2.0) * 1.8;
    col += vec3(0.55, 0.25, 1.00) * fresnel * 1.4;

    float alpha = 0.40 + fresnel * 0.35 + clamp(arcs, 0.0, 1.0) * 0.30;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Mini tendrils (fewer, shorter) ────────────────────────────────────────────

const TENDRIL_COUNT = 10;

interface Tendril {
  dir: THREE.Vector3;
  phase: number;
  speed: number;
  maxLen: number;
  hue: number;
}

function MiniElectricTendrils({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const up      = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const colRef  = useRef(new THREE.Color());

  const tendrils = useMemo<Tendril[]>(() =>
    Array.from({ length: TENDRIL_COUNT }, (_, i) => {
      const theta = (i / TENDRIL_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const phi   = Math.acos(2 * Math.random() - 1);
      return {
        dir: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).normalize(),
        phase:  Math.random() * Math.PI * 2,
        speed:  3.0 + Math.random() * 4.5,
        maxLen: 0.15 + Math.random() * 0.30,
        hue:    0.60 + Math.random() * 0.10,
      };
    }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    tendrils.forEach((td, i) => {
      const raw    = Math.sin(t * td.speed + td.phase);
      const active = raw > 0.0 ? raw * raw : 0;
      const len    = active * td.maxLen;

      if (len < 0.005) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        return;
      }

      const mid = td.dir.clone().multiplyScalar(radius + len * 0.5);
      dummy.position.copy(mid);
      dummy.quaternion.setFromUnitVectors(up, td.dir);
      dummy.scale.set(0.015 + active * 0.010, len, 0.015 + active * 0.010);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      colRef.current.setHSL(td.hue, 1.0, 0.45 + active * 0.45);
      meshRef.current!.setColorAt(i, colRef.current);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TENDRIL_COUNT]}>
      <cylinderGeometry args={[1, 0.2, 1, 4]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface MiniPlasmaOrbProps {
  radius?: number;
}

export function MiniPlasmaOrb({ radius = 1 }: MiniPlasmaOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.4;
  });

  return (
    <group ref={groupRef}>
      {/* Electric-blue & violet fill lights */}
      <pointLight color="#4488ff" intensity={3}   distance={6} decay={2} position={[0, 0,  2]} />
      <pointLight color="#aa44ff" intensity={2.5} distance={6} decay={2} position={[0, 0, -2]} />
      {/* Electric arc shell */}
      <mesh scale={radius * 1.06}>
        <sphereGeometry args={[1, 36, 36]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={electricVert}
          fragmentShader={electricFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Opaque core so the orb reads as solid */}
      <mesh scale={radius * 0.90}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          color="#050020"
          emissive="#2244cc"
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      {/* Lightning tendrils */}
      <MiniElectricTendrils radius={radius} />
    </group>
  );
}
