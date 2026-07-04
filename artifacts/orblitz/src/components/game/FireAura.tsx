/**
 * FireAura.tsx — React-Three-Fiber wrapper around the imperative fireAura utility.
 *
 * Drop this inside any R3F group/mesh that represents the boss and it will
 * automatically parent the particle system to that host object.
 *
 * Usage inside FireBoss (or any R3F component):
 *
 *   import { FireAura } from "./FireAura";
 *
 *   // Inside your JSX return:
 *   <FireAura
 *     radius={2.2}          // ← AURA_RADIUS: match your boss sphere radius
 *     flameHeight={3.8}     // ← FLAME_HEIGHT: how tall flames climb above boss
 *     maxParticles={3000}   // hard mobile cap
 *     spawnRate={950}       // particles/second — density knob
 *   />
 *
 * The component attaches itself to the nearest parent <group> or <mesh> via
 * a ref on an invisible marker object, then walks up to parent that object
 * to the R3F host — matching how FireCorona works in FireBoss.tsx.
 */

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { attachFireAura, FireAuraOptions } from "@/lib/fireAura";

type FireAuraProps = FireAuraOptions;

export function FireAura({
  radius      = 2.2,
  flameHeight = 3.8,
  maxParticles = 3000,
  spawnRate   = 950,
}: FireAuraProps) {
  // A zero-size marker group — we use its .parent to attach the system
  const markerRef = useRef<THREE.Group>(null);
  const handleRef = useRef<ReturnType<typeof attachFireAura> | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    // Walk up one level to the host object (the group/mesh this lives inside)
    const host = marker.parent ?? marker;

    const aura = attachFireAura(host, {
      radius,
      flameHeight,
      maxParticles,
      spawnRate,
    });
    handleRef.current = aura;

    return () => {
      aura.dispose();
      handleRef.current = null;
    };
    // Re-create only when structural options change (not every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, flameHeight, maxParticles, spawnRate]);

  useFrame((state) => {
    handleRef.current?.update(state.clock.getElapsedTime());
  });

  // Invisible marker — zero visible geometry, just gives us a ref into the scene
  return <group ref={markerRef} />;
}
