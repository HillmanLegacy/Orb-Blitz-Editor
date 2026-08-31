/**
 * FireAura — a detailed 3D particle plume that starts at the player surface
 * and flows outward in every direction.
 *
 * The colors intentionally match the Fire Boss orb texture palette already
 * used by the player skin: core orange, glow orange, emissive gold, accent
 * amber, and hot red.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FIRE_AURA_PARTICLE_COUNT = 360;

const FIRE_BOSS_GLOW = new THREE.Color("#ff8800");

const UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_AXIS = new THREE.Vector3(1, 0, 0);

interface FireParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  direction: THREE.Vector3;
  tangent: THREE.Vector3;
  bitangent: THREE.Vector3;
  life: number;
  maxLife: number;
  seed: number;
  size: number;
  stretch: number;
  spark: boolean;
}

function makeOutwardBasis() {
  const direction = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5,
  ).normalize();
  const reference = Math.abs(direction.y) < 0.8 ? UP : FALLBACK_AXIS;
  const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize();
  const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize();
  return { direction, tangent, bitangent };
}

function spawnFireParticle(scale: number, spark: boolean): FireParticle {
  const { direction, tangent, bitangent } = makeOutwardBasis();
  // `scale` is the player's visible radius. Start on the surface or just
  // outside it so the aura cannot be fully occluded by the player model.
  const shellRadius = scale * (0.97 + Math.random() * 0.14);
  const speed = (spark ? 1.7 : 1.0) + Math.random() * (spark ? 2.4 : 1.45);
  const swirl = (Math.random() - 0.5) * (spark ? 0.38 : 0.25);

  return {
    position: direction.clone().multiplyScalar(shellRadius),
    velocity: direction.clone().multiplyScalar(speed)
      .add(tangent.clone().multiplyScalar(swirl))
      .add(bitangent.clone().multiplyScalar((Math.random() - 0.5) * 0.2)),
    direction,
    tangent,
    bitangent,
    life: Math.random() * (spark ? 0.55 : 0.72),
    maxLife: (spark ? 0.38 : 0.58) + Math.random() * (spark ? 0.42 : 0.58),
    seed: Math.random() * Math.PI * 2,
    size: spark
      ? 0.010 + Math.random() * 0.018
      : 0.016 + Math.random() * 0.032,
    stretch: spark
      ? 1.8 + Math.random() * 2.6
      : 1.1 + Math.random() * 2.1,
    spark,
  };
}

function updateFireParticle(
  particle: FireParticle,
  scale: number,
  delta: number,
  time: number,
  spark: boolean,
) {
  particle.life += delta;
  if (particle.life >= particle.maxLife) {
    Object.assign(particle, spawnFireParticle(scale, spark));
    particle.life = 0;
    return;
  }

  const lifeRatio = particle.life / particle.maxLife;
  const radial = particle.position.clone().normalize();
  const curl = Math.sin(time * (spark ? 5.8 : 3.6) + particle.seed) * (spark ? 0.42 : 0.28);
  const lift = Math.cos(time * (spark ? 4.1 : 2.7) + particle.seed * 1.7) * 0.18;

  // Bend the velocity around the radial direction so the plume feels alive
  // instead of looking like straight radial spokes.
  particle.velocity.addScaledVector(particle.tangent, curl * delta);
  particle.velocity.addScaledVector(particle.bitangent, lift * delta);
  particle.velocity.lerp(radial.multiplyScalar(particle.velocity.length()), delta * 0.7);
  particle.position.addScaledVector(particle.velocity, delta);

  // A small upward bias gives the hot embers a natural rising finish while
  // preserving the outward flow from the player.
  particle.position.y += delta * (0.05 + lifeRatio * 0.12);
}

function writeParticleMatrix(
  dummy: THREE.Object3D,
  particle: FireParticle,
  spark: boolean,
) {
  const lifeRatio = Math.min(1, Math.max(0, particle.life / particle.maxLife));
  const fade = Math.sin(Math.PI * lifeRatio);
  const width = Math.max(0.001, particle.size * (0.35 + fade * 0.68));
  const length = width * (1 + particle.stretch * (0.55 + fade * 0.45));

  dummy.position.copy(particle.position);
  dummy.quaternion.setFromUnitVectors(UP, particle.velocity.clone().normalize());
  dummy.scale.set(width, length, width * 0.72);
  dummy.updateMatrix();
}

export function FireAura({ scale = 0.75 }: { scale?: number }) {
  const particleRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Keep the particle pool on the same reliable path as the working auras:
  // one stable material, no vertexColors shader dependency, and brightness
  // expressed through each particle's scale.
  const particleGeometry = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const [particleMaterial] = useState(() => new THREE.MeshBasicMaterial({
    color: FIRE_BOSS_GLOW,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const particles = useMemo(
    () => Array.from(
      { length: FIRE_AURA_PARTICLE_COUNT },
      (_, index) => spawnFireParticle(scale, index % 4 === 0),
    ),
    [scale],
  );

  useEffect(() => () => {
    particleGeometry.dispose();
    particleMaterial.dispose();
  }, [particleGeometry, particleMaterial]);

  // Seed the instance buffers before the first demand-driven render. Without
  // this, every instance starts at the origin until the first scheduled frame.
  useLayoutEffect(() => {
    const mesh = particleRef.current;
    if (!mesh) return;

    particles.forEach((particle, index) => {
      writeParticleMatrix(dummy, particle, particle.spark);
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [particles, dummy]);

  useFrame(({ clock }, delta) => {
    const mesh = particleRef.current;
    if (!mesh) return;

    const time = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    particles.forEach((particle, index) => {
      updateFireParticle(particle, scale, dt, time, particle.spark);
      writeParticleMatrix(dummy, particle, particle.spark);
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff6600" intensity={1.2} distance={4.8} decay={2} />
      <instancedMesh
        ref={particleRef}
        args={[particleGeometry, particleMaterial, FIRE_AURA_PARTICLE_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}