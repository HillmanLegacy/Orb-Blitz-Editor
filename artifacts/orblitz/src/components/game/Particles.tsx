import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import {
  getGraphicsPresetProfile,
  useGraphicsPreset,
} from "@/game-runtime/PerformanceToggles";

const CONFETTI_SHAPES = ["circle", "square", "triangle", "star", "diamond"] as const;
const SHIMMER_COLORS = ["#ffffff", "#ffccff", "#ccffff", "#ffffcc", "#ffddee"];

// Mutable particle data — lives in a Map ref, never touches Zustand every frame
interface LiveParticle {
  id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  alive: boolean;
}

interface DerivedProps {
  color: string;
  shapeType: typeof CONFETTI_SHAPES[number];
  rotation: number;
  spinSpeed: number;
  spinDirection: number;
  hasShimmer: boolean;
  shimmerSpeed: number;
  shimmerColor: string;
  sizeVariation: number;
}

function deriveProps(id: string, color: string): DerivedProps {
  const h1 = id.charCodeAt(id.length - 1) || 0;
  const h2 = id.charCodeAt(id.length - 2) || 0;
  const h3 = id.charCodeAt(0) || 0;
  const h4 = id.charCodeAt(1) || 0;
  const h5 = id.charCodeAt(2) || 0;
  return {
    color,
    shapeType: CONFETTI_SHAPES[h1 % CONFETTI_SHAPES.length],
    rotation: h2 * 0.1,
    spinSpeed: 3 + (h3 % 7),
    spinDirection: h4 % 2 === 0 ? 1 : -1,
    hasShimmer: h3 % 3 === 0,
    shimmerSpeed: 6 + (h4 % 8),
    shimmerColor: SHIMMER_COLORS[h5 % SHIMMER_COLORS.length],
    sizeVariation: 0.8 + (h3 % 5) * 0.1,
  };
}

// Reads mutable LiveParticle data from the shared Map ref; updates mesh imperatively
function ParticleMesh({
  id,
  dp,
  dataRef,
  renderShadow,
  renderShimmer,
}: {
  id: string;
  dp: DerivedProps;
  dataRef: React.MutableRefObject<Map<string, LiveParticle>>;
  renderShadow: boolean;
  renderShimmer: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const shimmerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const p = dataRef.current.get(id);
    if (!p || !p.alive || !groupRef.current) return;

    const lifeRatio = p.life / p.maxLife;
    const scale = 0.2 * lifeRatio * dp.sizeVariation;
    const opacity = Math.pow(lifeRatio, 0.4);
    const time = state.clock.elapsedTime;

    groupRef.current.position.x = p.x;
    groupRef.current.position.y = p.y;
    groupRef.current.position.z = p.z;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(scale);
      meshRef.current.rotation.z = time * dp.spinSpeed * dp.spinDirection + dp.rotation;
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      const shadow = meshRef.current.children[0] as THREE.Mesh | undefined;
      if (shadow) {
        (shadow.material as THREE.MeshBasicMaterial).opacity = opacity * 0.6;
      }
    }

    if (shimmerRef.current && dp.hasShimmer && renderShimmer) {
      const shimmerPulse = Math.sin(time * dp.shimmerSpeed) * 0.5 + 0.5;
      shimmerRef.current.scale.setScalar(scale * 0.6 * (1.2 + shimmerPulse * 0.4));
      (shimmerRef.current.material as THREE.MeshBasicMaterial).opacity =
        opacity * shimmerPulse * 0.7;
    }
  });

  const { shapeType } = dp;

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        {renderShadow && (
          <mesh scale={1.2}>
            {shapeType === "circle" && <circleGeometry args={[1, 8]} />}
            {shapeType === "square" && <planeGeometry args={[1.6, 1.6]} />}
            {shapeType === "triangle" && <circleGeometry args={[1, 3]} />}
            {shapeType === "star" && <circleGeometry args={[1, 4]} />}
            {shapeType === "diamond" && <circleGeometry args={[1, 4]} />}
            <meshBasicMaterial color="#000000" transparent />
          </mesh>
        )}

        {/* Main coloured shape */}
        {shapeType === "circle" && <circleGeometry args={[1, 8]} />}
        {shapeType === "square" && <planeGeometry args={[1.4, 1.4]} />}
        {shapeType === "triangle" && <circleGeometry args={[0.9, 3]} />}
        {shapeType === "star" && <circleGeometry args={[0.9, 4]} />}
        {shapeType === "diamond" && <circleGeometry args={[0.9, 4]} />}
        <meshBasicMaterial color={dp.color} transparent />
      </mesh>

      {dp.hasShimmer && renderShimmer && (
        <mesh ref={shimmerRef} position={[0, 0, 0.01]}>
          <circleGeometry args={[1, 6]} />
          <meshBasicMaterial
            color={dp.shimmerColor}
            transparent
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

export function Particles() {
  const profile = getGraphicsPresetProfile(useGraphicsPreset());
  // Mutable particle data — never stored in React/Zustand state during simulation
  const dataRef = useRef<Map<string, LiveParticle>>(new Map());
  // React state only changes when particles are added or removed (not every frame)
  const [activeIds, setActiveIds] = useState<Array<{ id: string; dp: DerivedProps }>>([]);

  // Track whether we were the ones who cleared the store (avoid spurious phase-resets)
  const drainedRef = useRef(false);
  // Throttle cleanup React state updates
  const pendingCleanupRef = useRef(false);
  const cleanupTimerRef = useRef(0);
  const maxParticlesRef = useRef(profile.maxImpactParticles);
  maxParticlesRef.current = profile.maxImpactParticles;

  useEffect(() => {
    setActiveIds((prev) => {
      if (prev.length <= profile.maxImpactParticles) return prev;
      const removed = prev.slice(profile.maxImpactParticles);
      for (const { id } of removed) dataRef.current.delete(id);
      return prev.slice(0, profile.maxImpactParticles);
    });
  }, [profile.maxImpactParticles]);

  // Subscribe to new particles added by the store
  useEffect(() => {
    return useMagicOrb.subscribe(
      (state) => state.particles,
      (particles) => {
        if (particles.length === 0) {
          if (!drainedRef.current) {
            // External clear (phase change, new game, etc.) — clear our local state
            dataRef.current.clear();
            setActiveIds([]);
          }
          drainedRef.current = false;
          return;
        }

        const newEntries: Array<{ id: string; dp: DerivedProps }> = [];
        for (const p of particles) {
          if (dataRef.current.size >= maxParticlesRef.current) break;
          if (!dataRef.current.has(p.id)) {
            dataRef.current.set(p.id, {
              id: p.id,
              x: p.position[0],
              y: p.position[1],
              z: p.position[2],
              vx: p.velocity[0],
              vy: p.velocity[1],
              vz: p.velocity[2],
              life: p.life,
              maxLife: p.maxLife,
              alive: true,
            });
            newEntries.push({ id: p.id, dp: deriveProps(p.id, p.color) });
          }
        }

        if (newEntries.length > 0) {
          setActiveIds((prev) => [...prev, ...newEntries]);
        }

        // Drain the store so it doesn't grow unbounded
        drainedRef.current = true;
        useMagicOrb.setState({ particles: [] });
      },
    );
  }, []);

  // Simulate particles entirely in refs — zero Zustand writes per frame
  useFrame((_, delta) => {
    const map = dataRef.current;
    if (map.size === 0) return;

    let hasDeaths = false;
    const now = performance.now();

    for (const p of map.values()) {
      if (!p.alive) continue;

      const newLife = p.life - delta;
      if (newLife <= 0) {
        p.alive = false;
        hasDeaths = true;
        continue;
      }

      const damping = 0.94;
      p.vx = p.vx * damping;
      p.vy = (p.vy - 3 * delta) * damping;
      p.vz = p.vz * damping;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.life = newLife;
    }

    // Throttled cleanup: remove dead particles from React tree at most every 150 ms
    if (hasDeaths && !pendingCleanupRef.current) {
      pendingCleanupRef.current = true;
      cleanupTimerRef.current = now;
    }
    if (pendingCleanupRef.current && now - cleanupTimerRef.current > 150) {
      pendingCleanupRef.current = false;
      setActiveIds((prev) => {
        const next = prev.filter(({ id }) => {
          const p = map.get(id);
          if (!p || !p.alive) {
            map.delete(id);
            return false;
          }
          return true;
        });
        return next.length !== prev.length ? next : prev;
      });
    }
  });

  return (
    <>
      {activeIds.map(({ id, dp }) => (
        <ParticleMesh
          key={id}
          id={id}
          dp={dp}
          dataRef={dataRef}
          renderShadow={profile.impactShadows}
          renderShimmer={profile.impactShimmer}
        />
      ))}
    </>
  );
}
