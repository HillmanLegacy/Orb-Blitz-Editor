/**
 * MechaBoss — Level 8.9 boss.
 * GLB model with mecha texture + robotic visual layer:
 *   • Counter-rotating gear rings (outer clockwise, inner CCW)
 *   • Sweeping radar/scan beam
 *   • Circuit pulse lines radiating from core
 *   • Targeting reticle that tracks the player
 *   • Steel-blue oscillating fill light + rage red on low health
 */

import { useRef, useEffect } from "react";
import { useFrame }          from "@react-three/fiber";
import { useGLTF }           from "@react-three/drei";
import * as THREE            from "three";

// ── Helper ────────────────────────────────────────────────────────────────────
const fract = (x: number) => x - Math.floor(x);

// ── Outer & inner gear rings ──────────────────────────────────────────────────
function GearRings({ radius, healthPercent }: { radius: number; healthPercent: number }) {
  const outerRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const speed = healthPercent < 0.3 ? 2.5 : 1.1;
    if (outerRef.current) outerRef.current.rotation.z -= delta * speed * 0.7;
    if (innerRef.current) innerRef.current.rotation.z += delta * speed * 1.2;
  });

  const outerR = radius * 1.42;
  const innerR = radius * 1.08;
  const outerSegments = 10;
  const innerSegments = 7;
  const color = "#44aacc";

  return (
    <>
      {/* Outer gear ring */}
      <group ref={outerRef}>
        {/* Continuous ring track */}
        <mesh>
          <ringGeometry args={[outerR - 0.04, outerR + 0.01, 64]} />
          <meshBasicMaterial color="#224455" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: outerSegments }).map((_, i) => {
          const angle = (i / outerSegments) * Math.PI * 2;
          const x = Math.cos(angle) * outerR;
          const y = Math.sin(angle) * outerR;
          return (
            <group key={i} position={[x, y, 0]} rotation={[0, 0, angle + Math.PI / 2]}>
              {/* Tooth plate */}
              <mesh>
                <planeGeometry args={[0.09, 0.16]} />
                <meshBasicMaterial color={color} transparent opacity={0.9} />
              </mesh>
              {/* Tooth bevel highlight */}
              <mesh position={[0, 0, 0.005]}>
                <planeGeometry args={[0.04, 0.06]} />
                <meshBasicMaterial color="#aaeeff" transparent opacity={0.6} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Inner gear ring */}
      <group ref={innerRef}>
        <mesh>
          <ringGeometry args={[innerR - 0.03, innerR + 0.01, 48]} />
          <meshBasicMaterial color="#335566" transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: innerSegments }).map((_, i) => {
          const angle = (i / innerSegments) * Math.PI * 2;
          const x = Math.cos(angle) * innerR;
          const y = Math.sin(angle) * innerR;
          return (
            <group key={i} position={[x, y, 0]} rotation={[0, 0, angle + Math.PI / 2]}>
              <mesh>
                <planeGeometry args={[0.07, 0.13]} />
                <meshBasicMaterial color="#33bbdd" transparent opacity={0.75} />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
}

// ── Rotating radar / scan beam ────────────────────────────────────────────────
function ScanBeam({ radius }: { radius: number }) {
  const beamRef  = useRef<THREE.Group>(null);
  const sweepRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (beamRef.current) beamRef.current.rotation.z = t * 1.4;
    if (sweepRef.current) {
      const mat = sweepRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(t * 3) * 0.06;
    }
  });

  const len = radius * 1.35;

  return (
    <group ref={beamRef}>
      {/* Main beam line */}
      <mesh position={[len / 2, 0, 0.06]}>
        <planeGeometry args={[len, 0.025]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Wide soft sweep fan */}
      <mesh ref={sweepRef} position={[len * 0.35, 0, 0.05]} rotation={[0, 0, 0.18]}>
        <planeGeometry args={[len * 0.7, len * 0.22]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Tip dot */}
      <mesh position={[len, 0, 0.07]}>
        <circleGeometry args={[0.05, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Circuit pulse lines ───────────────────────────────────────────────────────
function CircuitLines({ radius }: { radius: number }) {
  const refs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    refs.forEach((r, i) => {
      if (!r.current) return;
      const pulse = 0.5 + Math.abs(Math.sin(t * 2.5 + i * 1.2)) * 0.5;
      (r.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.65;
    });
  });

  const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const len = radius * 0.9;

  return (
    <>
      {angles.map((angle, i) => (
        <mesh
          key={i}
          ref={refs[i]}
          position={[Math.cos(angle) * len * 0.5, Math.sin(angle) * len * 0.5, 0.04]}
          rotation={[0, 0, angle]}
        >
          <planeGeometry args={[len, 0.018]} />
          <meshBasicMaterial color="#00ddff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {/* Corner junction dots */}
      {angles.map((angle, i) => (
        <mesh key={`dot-${i}`} position={[Math.cos(angle) * len * 0.88, Math.sin(angle) * len * 0.88, 0.045]}>
          <circleGeometry args={[0.04, 6]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// ── Targeting reticle ─────────────────────────────────────────────────────────
function TargetReticle({ radius }: { radius: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!ref.current) return;
    const blink = Math.sin(t * 6) > 0.4 ? 1 : 0.3;
    ref.current.children.forEach((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = blink * 0.7;
    });
  });

  const r = radius * 0.42;
  return (
    <group ref={ref} position={[0, 0, 0.07]}>
      {/* Four corner brackets */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        return (
          <group key={i} position={[x, y, 0]} rotation={[0, 0, angle - Math.PI / 4]}>
            <mesh position={[0.05, 0, 0]}>
              <planeGeometry args={[0.1, 0.018]} />
              <meshBasicMaterial color="#ff3300" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
              <planeGeometry args={[0.1, 0.018]} />
              <meshBasicMaterial color="#ff3300" transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
      {/* Center crosshair */}
      <mesh>
        <ringGeometry args={[r * 0.18, r * 0.22, 16]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Hurt / rage overlay ───────────────────────────────────────────────────────
function HurtOverlay({ radius, healthPercent }: { radius: number; healthPercent: number }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const hurtRef  = useRef(0);
  const prevRef  = useRef(healthPercent);

  useFrame((state, delta) => {
    if (healthPercent < prevRef.current) hurtRef.current = 0.18;
    prevRef.current = healthPercent;
    hurtRef.current = Math.max(0, hurtRef.current - delta);
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const t   = state.clock.getElapsedTime();
    const frac = hurtRef.current / 0.18;
    if (frac > 0) {
      mat.color.setRGB(1, 0.05, 0.05);
      mat.opacity = frac * Math.abs(Math.sin(t * 55)) * 0.65;
    } else if (healthPercent < 0.3) {
      const anger = Math.abs(Math.sin(t * 13));
      mat.color.setRGB(1, 0.1, 0.15 + anger * 0.15);
      mat.opacity = 0.15 + anger * 0.25;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <mesh ref={meshRef} scale={radius * 1.02}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ff1133" opacity={0} />
    </mesh>
  );
}

// ── Pulsing boss light ────────────────────────────────────────────────────────
function MechaLight({ healthPercent }: { healthPercent: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    if (healthPercent < 0.3) {
      const rage = Math.abs(Math.sin(t * 16));
      ref.current.intensity = 14 + rage * 10;
      ref.current.color.setRGB(1, 0.2 + rage * 0.1, 0.15);
    } else {
      ref.current.intensity = 10 + Math.sin(t * 2.2) * 2.5;
      ref.current.color.setRGB(0.25, 0.72, 1.0);
    }
  });
  return <pointLight ref={ref} color="#44bbff" intensity={10} distance={24} decay={2} />;
}

// ── Main component ────────────────────────────────────────────────────────────
export interface MechaBossProps {
  radius?:        number;
  healthPercent?: number;
}

export function MechaBoss({ radius = 1.44, healthPercent = 1 }: MechaBossProps) {
  const groupRef     = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const hurtTimerRef  = useRef(0);
  const prevHealthRef = useRef(healthPercent);

  const { scene: modelScene } = useGLTF("/models/boss_orb_8_mecha_texture.glb");

  useEffect(() => {
    if (!groupRef.current) return;

    // Extract baked texture from the GLB (same pattern as DiamondBoss / PlasmaBoss)
    let orbTexture: THREE.Texture | null = null;
    modelScene.traverse((child) => {
      if (orbTexture) return;
      if ((child as THREE.Mesh).isMesh) {
        const m    = (child as THREE.Mesh).material;
        const mats = Array.isArray(m) ? m : [m];
        for (const mat of mats) {
          const tex = (mat as any).map;
          if (tex) { orbTexture = tex; orbTexture!.needsUpdate = true; break; }
        }
      }
    });

    const cloned = modelScene.clone(true);
    materialsRef.current = [];

    // Fit to radius
    const box     = new THREE.Box3().setFromObject(cloned);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim    = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const normScale = maxDim > 0 ? (radius * 2) / maxDim : 1;
    cloned.scale.setScalar(normScale);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center.multiplyScalar(normScale));

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (orbTexture) orbTexture.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({
          map:   orbTexture ?? undefined,
          color: new THREE.Color("#ffffff"),
        });
        mesh.material = mat;
        materialsRef.current.push(mat);
      }
    });

    while (groupRef.current.children.length > 0)
      groupRef.current.remove(groupRef.current.children[0]);
    groupRef.current.add(cloned);

    return () => {
      materialsRef.current.forEach((m) => m.dispose());
      materialsRef.current = [];
    };
  }, [modelScene, radius]);

  useFrame((state, delta) => {
    if (healthPercent < prevHealthRef.current) hurtTimerRef.current = 0.15;
    prevHealthRef.current = healthPercent;
    hurtTimerRef.current  = Math.max(0, hurtTimerRef.current - delta);

    // Slow mechanical rotation — like a turret tracking
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.55;

    const t    = state.clock.getElapsedTime();
    const frac = hurtTimerRef.current / 0.15;
    const osc  = Math.abs(Math.sin(t * 50));

    materialsRef.current.forEach((m) => {
      if (frac > 0) {
        // Red hurt flash
        const flash = frac * osc;
        m.color.setRGB(1, 1 - flash * 0.9, 1 - flash * 0.9);
      } else if (healthPercent < 0.3) {
        // Orange-red rage pulse
        const anger = Math.abs(Math.sin(t * 14));
        m.color.setRGB(1, 0.55 - anger * 0.35, 0.5 - anger * 0.4);
      } else {
        m.color.setRGB(1, 1, 1);
      }
    });
  });

  return (
    <group>
      <MechaLight healthPercent={healthPercent} />

      {/* GLB model body */}
      <group ref={groupRef} />

      {/* Robotic overlay effects */}
      <GearRings  radius={radius} healthPercent={healthPercent} />
      <ScanBeam   radius={radius} />
      <CircuitLines radius={radius} />
      <TargetReticle radius={radius} />

      {/* Hurt / rage overlay */}
      <HurtOverlay radius={radius} healthPercent={healthPercent} />
    </group>
  );
}

useGLTF.preload("/models/boss_orb_8_mecha_texture.glb");
