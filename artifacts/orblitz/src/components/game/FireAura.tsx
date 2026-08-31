/**
 * FireAura — radial player aura using the same additive ember language as
 * FlameAura, but with particles burning outward in every direction around the
 * player instead of flowing along one axis.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FIRE_AURA_COUNT = 72;
const FIRE_BOSS_CORE = new THREE.Color("#ff4400");
const FIRE_BOSS_GLOW = new THREE.Color("#ff8800");
const FIRE_BOSS_EMISSIVE = new THREE.Color("#ffcc00");
const FIRE_BOSS_ACCENT = new THREE.Color("#ffaa44");
const FIRE_BOSS_HOT = new THREE.Color("#ff0000");
const FIRE_BOSS_PALETTE = [
  FIRE_BOSS_CORE,
  FIRE_BOSS_GLOW,
  FIRE_BOSS_EMISSIVE,
  FIRE_BOSS_ACCENT,
  FIRE_BOSS_HOT,
] as const;
const FIRE_RIBBON_CONFIG = [
  { radius: 1.02, tube: 0.048, rotation: [0.18, 0.22, 0.08] as [number, number, number], speed: 0.72, phase: 0.0 },
  { radius: 0.86, tube: 0.036, rotation: [Math.PI / 2 - 0.24, 0.22, 0.35] as [number, number, number], speed: -0.94, phase: 2.1 },
  { radius: 0.71, tube: 0.028, rotation: [0.9, Math.PI / 2 + 0.15, -0.42] as [number, number, number], speed: 1.28, phase: 4.2 },
] as const;

const fireRibbonVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uWarp;
  varying float vHeat;

  void main() {
    vec3 p = position;
    float angle = atan(p.z, p.x);
    float broadWave = sin(angle * 5.0 + uTime * 2.4 + uPhase) * 0.075;
    float lickWave = sin(angle * 13.0 - uTime * 4.8 + uPhase * 1.7) * 0.032;
    float twistWave = sin((p.y + angle) * 18.0 + uTime * 3.2) * 0.018;
    float displacement = (broadWave + lickWave + twistWave) * uWarp;

    p += normal * displacement;
    vHeat = 0.5 + 0.5 * sin(angle * 7.0 + uTime * 3.6 + uPhase);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fireRibbonFragmentShader = /* glsl */ `
  uniform float uTime;
  varying float vHeat;

  void main() {
    vec3 ember = mix(vec3(1.0, 0.267, 0.0), vec3(1.0, 0.8, 0.0), vHeat);
    float shimmer = 0.72 + 0.28 * sin(uTime * 8.0 + vHeat * 9.0);
    gl_FragColor = vec4(ember * (1.15 + vHeat * 0.7), 0.52 * shimmer);
  }
`;

interface FireEmber {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  seed: number;
  size: number;
}

function randomFireEmber(scale: number): FireEmber {
  const outward = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5,
  ).normalize();
  const tangent = new THREE.Vector3().crossVectors(
    outward,
    Math.abs(outward.y) < 0.8 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0),
  ).normalize();
  const bitangent = new THREE.Vector3().crossVectors(outward, tangent).normalize();
  const radius = scale * (0.38 + Math.random() * 0.16);
  const speed = 0.85 + Math.random() * 1.1;

  return {
    pos: outward.multiplyScalar(radius),
    vel: outward.multiplyScalar(speed).add(
      tangent.multiplyScalar((Math.random() - 0.5) * 0.28),
    ).add(bitangent.multiplyScalar((Math.random() - 0.5) * 0.18)),
    life: Math.random(),
    maxLife: 0.7 + Math.random() * 0.6,
    seed: Math.random() * Math.PI * 2,
    size: 0.055 + Math.random() * 0.085,
  };
}

function FireAuraRibbon({
  scale,
  radius,
  tube,
  rotation,
  speed,
  phase,
}: {
  scale: number;
  radius: number;
  tube: number;
  rotation: [number, number, number];
  speed: number;
  phase: number;
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phase },
      uWarp: { value: 1 },
    },
    vertexShader: fireRibbonVertexShader,
    fragmentShader: fireRibbonFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), [phase]);

  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    material.uniforms.uTime.value = clock.getElapsedTime();
    mesh.rotation.z += speed * 0.006;
    mesh.rotation.y += speed * 0.003;
  });

  return (
    <mesh ref={meshRef} rotation={rotation} material={material}>
      <torusGeometry args={[scale * radius, scale * tube, 10, 96]} />
    </mesh>
  );
}

export function FireAura({ scale = 0.75 }: { scale?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const embers = useRef<FireEmber[]>(
    Array.from({ length: FIRE_AURA_COUNT }, () => {
      const ember = randomFireEmber(scale);
      ember.life = Math.random() * ember.maxLife;
      return ember;
    }),
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    embers.current.forEach((ember, index) => {
      ember.life -= delta;

      if (ember.life <= 0) {
        const fresh = randomFireEmber(scale);
        Object.assign(ember, fresh);
        ember.life = ember.maxLife;
      } else {
        ember.pos.addScaledVector(ember.vel, delta);
        const radius = Math.hypot(ember.pos.x, ember.pos.y) || 1;
        const tangentX = -ember.pos.y / radius;
        const tangentY = ember.pos.x / radius;
        const turbulence = Math.sin(time * 4.2 + ember.seed) * 0.24 * delta;
        ember.vel.x += tangentX * turbulence;
        ember.vel.y += tangentY * turbulence;
        ember.vel.z += Math.cos(time * 3.5 + ember.seed) * 0.18 * delta;
      }

      const lifeRatio = Math.max(0, ember.life / ember.maxLife);
      const particleScale = ember.size * scale * lifeRatio;

      dummy.position.copy(ember.pos);
      dummy.scale.setScalar(particleScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);

      // Match the Fire Boss orb texture palette: core → glow → emissive →
      // accent → hot red as each ember burns out.
      const paletteT = (1 - lifeRatio) * (FIRE_BOSS_PALETTE.length - 1);
      const paletteIndex = Math.min(
        FIRE_BOSS_PALETTE.length - 2,
        Math.floor(paletteT),
      );
      color.lerpColors(
        FIRE_BOSS_PALETTE[paletteIndex],
        FIRE_BOSS_PALETTE[paletteIndex + 1],
        paletteT - paletteIndex,
      );
      meshRef.current!.setColorAt(index, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff6600" intensity={1.6} distance={4.5} decay={2} />
      <mesh scale={scale * 0.84}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color="#ff4400"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {FIRE_RIBBON_CONFIG.map((ribbon) => (
        <FireAuraRibbon key={ribbon.phase} scale={scale} {...ribbon} />
      ))}
      <instancedMesh ref={meshRef} args={[undefined, undefined, FIRE_AURA_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
