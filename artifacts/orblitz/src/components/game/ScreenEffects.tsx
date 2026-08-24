import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── ScreenEffects ─────────────────────────────────────────────────────────────
// 3D screen-space overlays rendered slightly in front of the scene:
//   • Impact flash — full-screen white/red flash on heavy hits
// ─────────────────────────────────────────────────────────────────────────────

export function ScreenEffects() {
  // ── Flash mesh ────────────────────────────────────────────────────────────
  const flashRef       = useRef<THREE.Mesh>(null);
  const flashTimerRef  = useRef(0);
  const flashDurRef    = useRef(0.14);
  const flashColorRef  = useRef<[number, number, number]>([1, 1, 1]);
  const prevDamagedRef = useRef(false);
  const prevBossRef    = useRef<string | null>(null);

  const phase = useMagicOrb(s => s.phase);
  const isDamaged = useMagicOrb(s => s.isDamaged);
  const boss = useMagicOrb(s => s.boss);

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
  useFrame((_state, delta) => {
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

  });

  if (phase !== "playing") return null;

  return (
    <group position={[0, 0, 8]}>

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
