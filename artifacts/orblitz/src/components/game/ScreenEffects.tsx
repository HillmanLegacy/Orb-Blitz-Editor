import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── ScreenEffects ─────────────────────────────────────────────────────────────
// 3D screen-space overlays rendered slightly in front of the scene:
//   • Impact flash — full-screen white/red flash on heavy hits
//   • Damage vignette — red ring that pulses at low health
// ─────────────────────────────────────────────────────────────────────────────

export function ScreenEffects() {
  // ── Flash mesh ────────────────────────────────────────────────────────────
  const flashRef       = useRef<THREE.Mesh>(null);
  const flashTimerRef  = useRef(0);
  const flashDurRef    = useRef(0.14);
  const flashColorRef  = useRef<[number, number, number]>([1, 1, 1]);
  const prevDamagedRef = useRef(false);
  const prevBossRef    = useRef<string | null>(null);

  // ── Damage vignette ring ──────────────────────────────────────────────────
  const vignetteRef = useRef<THREE.Mesh>(null);

  const { phase, isDamaged, boss, health, maxHealth } = useMagicOrb();
  const healthRatio = maxHealth > 0 ? health / maxHealth : 1;

  // ── Trigger flashes on events ─────────────────────────────────────────────
  useEffect(() => {
    if (isDamaged && !prevDamagedRef.current) {
      flashColorRef.current = [1, 0.08, 0.08];
      flashTimerRef.current = 0.18;
      flashDurRef.current   = 0.18;
    }
    prevDamagedRef.current = isDamaged;
  }, [isDamaged]);

  useEffect(() => {
    if (prevBossRef.current !== null && boss === null) {
      flashColorRef.current = [1, 1, 1];
      flashTimerRef.current = 0.25;
      flashDurRef.current   = 0.25;
    }
    prevBossRef.current = boss?.id ?? null;
  }, [boss]);

  // ── Frame update ──────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Impact flash
    if (flashRef.current) {
      const mat = flashRef.current.material as THREE.MeshBasicMaterial;
      if (flashTimerRef.current > 0) {
        flashTimerRef.current -= delta;
        const progress = Math.max(0, flashTimerRef.current / flashDurRef.current);
        mat.opacity = Math.pow(progress, 0.4) * 0.65;
        const [r, g, b] = flashColorRef.current;
        mat.color.setRGB(r, g, b);
        flashRef.current.visible = true;
      } else {
        flashRef.current.visible = false;
      }
    }

    // Damage vignette
    if (vignetteRef.current) {
      const mat = vignetteRef.current.material as THREE.MeshBasicMaterial;
      const lowHealthRatio = Math.max(0, 0.5 - healthRatio) * 2;
      const lowPulse    = lowHealthRatio * (0.2 + Math.sin(time * 4) * 0.08);
      const atLastHP    = health === 1 && phase === "playing";
      const damagePulse = (isDamaged || atLastHP) ? 0.3 : 0;
      mat.opacity = 0.08 + damagePulse + lowPulse;
      if (isDamaged || atLastHP || lowHealthRatio > 0.2) {
        mat.color.setHSL(0, 0.9, 0.12);
      } else {
        mat.color.setHSL(0.82, 0.6, 0.1);
      }
    }
  });

  if (phase !== "playing") return null;

  return (
    <group position={[0, 0, 8]}>

      {/* Damage vignette ring */}
      <mesh ref={vignetteRef} position={[0, 0, 0.03]}>
        <ringGeometry args={[7, 20, 64]} />
        <meshBasicMaterial
          color="#220000"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      {/* Dark corner accents */}
      {([[-13, 10], [13, 10], [-13, -10], [13, -10]] as [number, number][]).map(([cx, cy], i) => (
        <mesh key={i} position={[cx, cy, 0.035]}>
          <circleGeometry args={[7, 16]} />
          <meshBasicMaterial
            color="#000011"
            transparent
            opacity={0.22}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Impact flash — highest Z, rendered last */}
      <mesh ref={flashRef} position={[0, 0, 0.5]} visible={false}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

    </group>
  );
}
