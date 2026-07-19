/**
 * MiniToxicOrb — projectile fired by the Toxic Boss (level 4.9).
 * Reuses the exact drip shader + falling-droplet system from ToxicBoss,
 * scaled to radius=1 so the parent group controls the final size.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Drip surface shader (identical to ToxicBoss) ────────────────────────────

const dripVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vDripAmt;

  void main() {
    vUv    = uv;
    vec3 pos = position;

    float bottomness = clamp(-pos.y, 0.0, 1.0);
    float angle = atan(pos.z, pos.x);

    float drip = 0.0;
    for (int i = 0; i < 6; i++) {
      float dripAngle  = float(i) * 1.0472;
      float angDiff    = abs(mod(angle - dripAngle + 3.14159, 6.28318) - 3.14159);
      float dripWidth  = smoothstep(0.38, 0.0, angDiff);
      float phase      = uTime * 1.1 + float(i) * 1.3;
      float dripLen    = (sin(phase) * 0.5 + 0.5) * (0.5 + 0.5 * sin(phase * 0.7));
      drip += dripWidth * dripLen * bottomness * bottomness;
    }

    float bulge = drip * 0.45;
    pos += normal * bulge * 0.3;
    pos.y -= bulge * 0.8;

    vDripAmt  = clamp(drip, 0.0, 1.0);
    vNormal   = normalMatrix * normal;
    vec4 mvp  = modelViewMatrix * vec4(pos, 1.0);
    vViewPos  = mvp.xyz;
    gl_Position = projectionMatrix * mvp;
  }
`;

const dripFrag = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying float vDripAmt;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);

    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 2.5);

    vec2 q  = vUv * 2.5 + vec2(-uTime * 0.08, 0.0);
    float n1 = noise(q);
    float n2 = noise(q * 2.1 + vec2(1.7, 2.3));
    float blob = n1 * 0.6 + n2 * 0.4;

    vec3 toxicDeep   = vec3(0.02, 0.16, 0.01);
    vec3 toxicMid    = vec3(0.08, 0.52, 0.04);
    vec3 toxicBright = vec3(0.25, 0.90, 0.08);
    vec3 toxicGlow   = vec3(0.55, 1.00, 0.20);

    float t = blob;
    vec3 col;
    if      (t < 0.35) col = mix(toxicDeep,   toxicMid,    t / 0.35);
    else if (t < 0.65) col = mix(toxicMid,    toxicBright, (t-0.35)/0.30);
    else               col = mix(toxicBright, toxicGlow,   (t-0.65)/0.35);

    col = mix(col, toxicGlow * 1.3, vDripAmt * 0.5);

    vec3 r   = reflect(-v, n);
    float sp = pow(max(0.0, r.z), 40.0);
    col     += vec3(0.7, 1.0, 0.5) * sp * 0.65;

    col += toxicGlow * fresnel * 0.55;

    float baseAlpha = 0.55 + fresnel * 0.30 + vDripAmt * 0.35;
    gl_FragColor = vec4(col, clamp(baseAlpha, 0.0, 1.0));
  }
`;

// ── Falling droplets (scaled-down version of ToxicDroplets) ─────────────────

const DRIP_COUNT = 10;

interface Drop {
  sx: number; sz: number;
  surfaceY: number;
  posY: number;
  velY: number;
  size: number;
  life: number;
  maxLife: number;
}

function makeDrop(radius: number): Drop {
  const angle     = Math.random() * Math.PI * 2;
  const elevation = -(0.1 + Math.random() * 0.55) * Math.PI;
  return {
    sx:       Math.cos(angle) * Math.cos(elevation) * radius,
    sz:       Math.sin(angle) * Math.cos(elevation) * radius,
    surfaceY: Math.sin(elevation) * radius,
    posY:     Math.sin(elevation) * radius,
    velY:     -(0.8 + Math.random() * 2.0),
    size:     0.025 + Math.random() * 0.045,
    life:     Math.random(),
    maxLife:  0.5 + Math.random() * 0.6,
  };
}

function MiniToxicDroplets({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const colRef  = useRef(new THREE.Color());
  const drops   = useRef<Drop[]>(
    Array.from({ length: DRIP_COUNT }, () => makeDrop(radius))
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const col = colRef.current;

    drops.current.forEach((d, i) => {
      d.life -= delta;
      if (d.life <= 0) {
        drops.current[i] = makeDrop(radius);
        return;
      }
      d.velY -= 3.5 * delta;
      d.posY += d.velY * delta;

      const lifeRatio = d.life / d.maxLife;
      const fadeOut   = lifeRatio < 0.2 ? lifeRatio / 0.2 : 1;
      const stretch   = 1 + Math.abs(d.velY) * 0.22;
      const sz        = d.size * fadeOut;

      dummy.position.set(d.sx, d.posY, d.sz);
      dummy.scale.set(sz / stretch, sz * stretch, sz / stretch);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      col.setHSL(0.27 + lifeRatio * 0.04, 1.0, 0.35 + lifeRatio * 0.18);
      meshRef.current!.setColorAt(i, col);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DRIP_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.NormalBlending} />
    </instancedMesh>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface MiniToxicOrbProps {
  radius?: number;
}

export function MiniToxicOrb({ radius = 1 }: MiniToxicOrbProps) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    // Slow rotation like the boss
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={groupRef}>
      {/* Green fill lights matching the boss */}
      <pointLight color="#44ff22" intensity={3}   distance={6} decay={2} position={[0, 0,  2]} />
      <pointLight color="#44ff22" intensity={2.5} distance={6} decay={2} position={[0, 0, -2]} />
      {/* Drip surface — same shader as the boss body */}
      <mesh scale={radius * 1.04}>
        <sphereGeometry args={[1, 36, 36]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={dripVert}
          fragmentShader={dripFrag}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Opaque core sphere so the orb reads as solid */}
      <mesh scale={radius * 0.92}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          color="#0a2a02"
          emissive="#22aa08"
          emissiveIntensity={0.4}
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>
      {/* Falling toxic droplets */}
      <MiniToxicDroplets radius={radius} />
    </group>
  );
}
