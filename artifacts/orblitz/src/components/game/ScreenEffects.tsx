import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";

// ── ScreenEffects ─────────────────────────────────────────────────────────────
// 3D screen-space overlays rendered slightly in front of the scene:
//   • Impact flash — full-screen white/red flash on heavy hits (the most impactful
//     visual addition; gives instant feedback on player damage and boss kills)
//   • Bloom overlays — additive color tinting for neon ambience
//   • Damage vignette — red ring that pulses at low health
//   • Scanlines — classic CRT scanline effect moving up the screen
//
// The post-processing Vignette and ChromaticAberration in GameScene.tsx handle
// edge-darkening and aberration; this file focuses on dynamic on-hit feedback.
// ─────────────────────────────────────────────────────────────────────────────

export function ScreenEffects() {
  // ── Flash mesh — full-screen white flash on heavy events ─────────────────
  const flashRef          = useRef<THREE.Mesh>(null);
  const flashTimerRef     = useRef(0);
  const flashDurRef       = useRef(0.14);   // seconds
  const flashColorRef     = useRef<[number, number, number]>([1, 1, 1]);
  const prevDamagedRef    = useRef(false);
  const prevBossRef       = useRef<string | null>(null);

  // ── Dynamic bloom / color-grade overlays ─────────────────────────────────
  const bloomOverlay1Ref  = useRef<THREE.Mesh>(null);
  const bloomOverlay2Ref  = useRef<THREE.Mesh>(null);
  const colorGradeRef     = useRef<THREE.Mesh>(null);

  // ── Damage vignette ring ─────────────────────────────────────────────────
  const vignetteRef       = useRef<THREE.Mesh>(null);

  // ── Multiple scanlines — individual refs (hooks must not be in array literals)
  const scanRef0          = useRef<THREE.Mesh>(null);
  const scanRef1          = useRef<THREE.Mesh>(null);
  const scanRef2          = useRef<THREE.Mesh>(null);
  // Collect after all hooks so the array is stable across renders
  const scanRefs          = [scanRef0, scanRef1, scanRef2];

  const {
    phase, isDamaged, isLastHitPoint, boss, backgroundPulse, arcadeLevel, gameMode,
    health, maxHealth,
  } = useMagicOrb();

  const healthRatio  = maxHealth > 0 ? health / maxHealth : 1;
  const isBossLevel  = gameMode === "arcade" && Math.round((arcadeLevel % 1) * 10) === 9;
  const inBossFight  = boss !== null || isBossLevel;

  // ── Detect events and trigger flashes ───────────────────────────────────
  useEffect(() => {
    if (isDamaged && !prevDamagedRef.current) {
      // Player took damage — harsh red/white flash
      flashColorRef.current  = [1, 0.08, 0.08];
      flashTimerRef.current  = 0.18;
      flashDurRef.current    = 0.18;
    }
    prevDamagedRef.current = isDamaged;
  }, [isDamaged]);

  useEffect(() => {
    // Boss just died (ref was set, now null) — white victory flash
    if (prevBossRef.current !== null && boss === null) {
      flashColorRef.current = [1, 1, 1];
      flashTimerRef.current = 0.25;
      flashDurRef.current   = 0.25;
    }
    prevBossRef.current = boss?.id ?? null;
  }, [boss]);

  // ── Frame update ─────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // ── Impact flash ─────────────────────────────────────────────────────
    if (flashRef.current) {
      const mat = flashRef.current.material as THREE.MeshBasicMaterial;
      if (flashTimerRef.current > 0) {
        flashTimerRef.current -= delta;
        const progress = Math.max(0, flashTimerRef.current / flashDurRef.current);
        // Quadratic curve: hits hard then fades fast
        const opacity  = Math.pow(progress, 0.4) * 0.65;
        mat.opacity    = opacity;
        const [r, g, b] = flashColorRef.current;
        mat.color.setRGB(r, g, b);
        flashRef.current.visible = true;
      } else {
        flashRef.current.visible = false;
      }
    }

    // ── Bloom overlay 1 — slowly cycling hue ─────────────────────────────
    if (bloomOverlay1Ref.current) {
      const mat = bloomOverlay1Ref.current.material as THREE.MeshBasicMaterial;
      const hue = (time * 0.018) % 1;
      mat.color.setHSL(hue, 0.75, 0.7);
      mat.opacity = 0.018 + backgroundPulse * 0.028 + (inBossFight ? 0.016 : 0);
    }

    // ── Bloom overlay 2 — complementary hue ──────────────────────────────
    if (bloomOverlay2Ref.current) {
      const mat = bloomOverlay2Ref.current.material as THREE.MeshBasicMaterial;
      const hue = ((time * 0.018) + 0.5) % 1;
      mat.color.setHSL(hue, 0.6, 0.8);
      mat.opacity = 0.012 + backgroundPulse * 0.02 + Math.sin(time * 2.8) * 0.006;
    }

    // ── Color grade overlay — subtle warm/cool shift ──────────────────────
    if (colorGradeRef.current) {
      const mat = colorGradeRef.current.material as THREE.MeshBasicMaterial;
      const hue = inBossFight
        ? 0.04 + Math.sin(time * 0.4) * 0.03   // orange-ish during boss
        : 0.78 + Math.sin(time * 0.5) * 0.04;  // purple in normal play
      mat.color.setHSL(hue, 0.35, 0.5);
      mat.opacity = 0.025 + (inBossFight ? 0.022 : 0) + backgroundPulse * 0.01;
    }

    // ── Damage vignette ring ─────────────────────────────────────────────
    if (vignetteRef.current) {
      const mat = vignetteRef.current.material as THREE.MeshBasicMaterial;
      // Low health: red pulsing ring; normal: very faint purple ring
      const lowHealthRatio = Math.max(0, 0.5 - healthRatio) * 2; // 0→1 as health drops to 0
      const lowPulse   = lowHealthRatio * (0.2 + Math.sin(time * 4) * 0.08);
      const damagePulse = (isDamaged || isLastHitPoint) ? 0.3 : 0;
      const baseOpacity = 0.08;
      mat.opacity  = baseOpacity + damagePulse + lowPulse;
      if (isDamaged || isLastHitPoint || lowHealthRatio > 0.2) {
        mat.color.setHSL(0, 0.9, 0.12); // red
      } else {
        mat.color.setHSL(0.82, 0.6, 0.1); // purple
      }
    }

    // ── Moving scanlines at different speeds ─────────────────────────────
    const scanSpeeds = [0.35, 0.58, 0.82];
    const scanOffsets = [0, 7, 14]; // vertical stagger
    scanRefs.forEach((ref, i) => {
      if (!ref.current) return;
      ref.current.position.y = ((time * scanSpeeds[i] + scanOffsets[i]) % 22) - 11;
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.018 + (i === 0 ? 0.008 : 0);
    });
  });

  if (phase !== "playing") return null;

  return (
    <group position={[0, 0, 8]}>

      {/* ── Bloom overlays ── */}
      <mesh ref={bloomOverlay1Ref}>
        <planeGeometry args={[32, 24]} />
        <meshBasicMaterial
          color="#ff00ff"
          transparent
          opacity={0.018}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={bloomOverlay2Ref} position={[0, 0, 0.01]}>
        <planeGeometry args={[32, 24]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.012}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      {/* ── Colour grading overlay ── */}
      <mesh ref={colorGradeRef} position={[0, 0, 0.02]}>
        <planeGeometry args={[32, 24]} />
        <meshBasicMaterial
          color="#9900ff"
          transparent
          opacity={0.025}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      {/* ── Damage vignette ring ── */}
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

      {/* ── Dark corner gradients (4-corner vignette accent) ── */}
      {([[-13, 10], [13, 10], [-13, -10], [13, -10]] as [number, number][]).map(([cx, cy], i) => (
        <mesh key={`corner-${i}`} position={[cx, cy, 0.035]}>
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

      {/* ── Moving scanlines ── */}
      {scanRefs.map((ref, i) => (
        <mesh key={`scan-${i}`} ref={ref} position={[0, i * 7 - 7, 0.04]}>
          <planeGeometry args={[32, i === 0 ? 0.03 : 0.016]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.018}
            blending={THREE.AdditiveBlending}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Impact flash — full-screen, rendered last (highest Z) ── */}
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
