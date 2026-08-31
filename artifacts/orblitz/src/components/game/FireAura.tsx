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

const FIRE_AURA_EMBER_COUNT = 112;
const FIRE_AURA_SPARK_COUNT = 168;

const FIRE_BOSS_CORE = new THREE.Color("#ff4400");
const FIRE_BOSS_GLOW = new THREE.Color("#ff8800");
const FIRE_BOSS_EMISSIVE = new THREE.Color("#ffcc00");

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
  const shellRadius = scale * (0.96 + Math.random() * 0.18);
  const speed = (spark ? 1.35 : 0.78) + Math.random() * (spark ? 1.9 : 1.15);
  const swirl = (Math.random() - 0.5) * (spark ? 0.38 : 0.25);

  return {
    position: direction.clone().multiplyScalar(shellRadius),
    velocity: direction.clone().multiplyScalar(speed)
      .add(tangent.clone().multiplyScalar(swirl))
      .add(bitangent.clone().multiplyScalar((Math.random() - 0.5) * 0.2)),
    direction,
    tangent,
    bitangent,
    life: Math.random() * (0.85 + Math.random() * 0.35),
    maxLife: (spark ? 0.5 : 0.75) + Math.random() * (spark ? 0.55 : 0.75),
    seed: Math.random() * Math.PI * 2,
    size: spark
      ? 0.018 + Math.random() * 0.035
      : 0.038 + Math.random() * 0.075,
    stretch: spark
      ? 1.2 + Math.random() * 1.7
      : 1.4 + Math.random() * 2.8,
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
  const fade = Math.sin(Math.PI * Math.min(1, lifeRatio));
  const width = Math.max(0.001, particle.size * (0.42 + fade * 0.82));
  const length = width * (1 + particle.stretch * (0.5 + fade * 0.5));

  dummy.position.copy(particle.position);
  dummy.quaternion.setFromUnitVectors(UP, particle.velocity.clone().normalize());
  dummy.scale.set(width, length, width * (spark ? 0.8 : 1.0));
  dummy.updateMatrix();
}

export function FireAura({ scale = 0.75 }: { scale?: number }) {
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const emberGeometry = useMemo(() => new THREE.SphereGeometry(1, 6, 5), []);
  const sparkGeometry = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  // Keep these materials free of vertexColors. R3F/Three can compile an
  // instanced shader before instanceColor exists, which makes the entire
  // particle pool disappear silently. Lifetime brightness is expressed by
  // particle scale instead, matching the working aura implementations.
  const [emberMaterial] = useState(() => new THREE.MeshBasicMaterial({
    color: FIRE_BOSS_GLOW,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const [sparkMaterial] = useState(() => new THREE.MeshBasicMaterial({
    color: FIRE_BOSS_EMISSIVE,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const embers = useMemo(
    () => Array.from({ length: FIRE_AURA_EMBER_COUNT }, () => spawnFireParticle(scale, false)),
    [scale],
  );
  const sparks = useMemo(
    () => Array.from({ length: FIRE_AURA_SPARK_COUNT }, () => spawnFireParticle(scale, true)),
    [scale],
  );

  useEffect(() => () => {
    emberGeometry.dispose();
    sparkGeometry.dispose();
    emberMaterial.dispose();
    sparkMaterial.dispose();
  }, [emberGeometry, sparkGeometry, emberMaterial, sparkMaterial]);

  // Seed the instance buffers before the first demand-driven render. Without
  // this, every instance starts at the origin until the first scheduled frame.
  useLayoutEffect(() => {
    const emberMesh = emberRef.current;
    const sparkMesh = sparkRef.current;
    if (!emberMesh || !sparkMesh) return;

    embers.forEach((particle, index) => {
      writeParticleMatrix(dummy, particle, false);
      emberMesh.setMatrixAt(index, dummy.matrix);
    });
    sparks.forEach((particle, index) => {
      writeParticleMatrix(dummy, particle, true);
      sparkMesh.setMatrixAt(index, dummy.matrix);
    });
    emberMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceMatrix.needsUpdate = true;
  }, [embers, sparks, dummy]);

  useFrame(({ clock }, delta) => {
    const emberMesh = emberRef.current;
    const sparkMesh = sparkRef.current;
    if (!emberMesh || !sparkMesh) return;

    const time = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    embers.forEach((particle, index) => {
      updateFireParticle(particle, scale, dt, time, false);
      writeParticleMatrix(dummy, particle, false);
      emberMesh.setMatrixAt(index, dummy.matrix);
    });

    sparks.forEach((particle, index) => {
      updateFireParticle(particle, scale, dt, time, true);
      writeParticleMatrix(dummy, particle, true);
      sparkMesh.setMatrixAt(index, dummy.matrix);
    });

    emberMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <pointLight color="#ff6600" intensity={1.7} distance={4.8} decay={2} />
      <instancedMesh
        ref={emberRef}
        args={[emberGeometry, emberMaterial, FIRE_AURA_EMBER_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sparkRef}
        args={[sparkGeometry, sparkMaterial, FIRE_AURA_SPARK_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}