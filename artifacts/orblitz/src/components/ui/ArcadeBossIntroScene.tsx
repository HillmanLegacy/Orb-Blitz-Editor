import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BossVisual } from "@/components/game/BossVisual";
import { MiniFireOrb } from "@/components/game/MiniFireOrb";
import { BOSS_DEFEAT_PALETTES, MAIN_BOSS_TYPES, type MainBossType } from "@/components/game/BossDefeatPalette";

export type IntroBossPhase = "idle" | "flying" | "converge" | "flash" | "backdrop" | "background" | "title" | "waiting" | "menu";
export type IntroBossPresentation = "menu" | "worlds" | "levels";

export interface ArcadeBossIntroDef {
  type: MainBossType;
  startX: number;
  startY: number;
  convergeX: number;
  convergeY: number;
  swayX: number;
  swayY: number;
  rotation: number;
  delay: number;
}

/**
 * Positions are normalized to the current camera viewport. This keeps the
 * roster legible on both wide desktop previews and short landscape phones.
 */
export const ARCADE_BOSS_INTRO_DEFS: readonly ArcadeBossIntroDef[] = [
  { type: "circle",    startX: -0.43, startY: -0.27, convergeX: -0.08, convergeY: -0.05, swayX:  0.05, swayY: -0.03, rotation: -18, delay: 0.00 },
  { type: "star",      startX:  0.42, startY: -0.30, convergeX:  0.07, convergeY: -0.07, swayX: -0.04, swayY:  0.04, rotation:  24, delay: 0.07 },
  { type: "triangle",  startX: -0.46, startY:  0.12, convergeX: -0.09, convergeY:  0.04, swayX:  0.04, swayY:  0.05, rotation:  12, delay: 0.14 },
  { type: "trapezoid", startX:  0.45, startY:  0.13, convergeX:  0.09, convergeY:  0.03, swayX: -0.05, swayY: -0.04, rotation: -14, delay: 0.21 },
  { type: "cube",      startX: -0.28, startY:  0.34, convergeX: -0.04, convergeY:  0.08, swayX:  0.06, swayY:  0.03, rotation:  32, delay: 0.28 },
  { type: "cloud",     startX:  0.25, startY:  0.35, convergeX:  0.05, convergeY:  0.08, swayX: -0.06, swayY: -0.03, rotation: -28, delay: 0.35 },
  { type: "arrow",     startX: -0.10, startY: -0.39, convergeX: -0.02, convergeY: -0.10, swayX:  0.05, swayY:  0.04, rotation: -42, delay: 0.42 },
  { type: "tentacle",  startX:  0.10, startY:  0.40, convergeX:  0.02, convergeY:  0.10, swayX: -0.04, swayY: -0.04, rotation:  38, delay: 0.49 },
  { type: "monster",   startX:  0.00, startY:  0.03, convergeX:  0.00, convergeY:  0.00, swayX:  0.07, swayY: -0.05, rotation:   8, delay: 0.56 },
];

export const ARCADE_BOSS_INTRO_TYPES = MAIN_BOSS_TYPES;

export const MENU_BOSS_LAYOUT: Record<MainBossType, {
  x: number;
  y: number;
  scale: number;
  driftX: number;
  driftY: number;
  phase: number;
}> = {
  circle:    { x: -0.43, y: -0.32, scale: 0.54, driftX: 0.012, driftY: 0.018, phase: 0.2 },
  star:      { x:  0.43, y: -0.32, scale: 0.5,  driftX: 0.015, driftY: 0.014, phase: 1.1 },
  triangle:  { x: -0.46, y:  0.01, scale: 0.48, driftX: 0.011, driftY: 0.02,  phase: 2.0 },
  trapezoid: { x:  0.46, y:  0.03, scale: 0.5,  driftX: 0.012, driftY: 0.018, phase: 2.8 },
  cube:      { x: -0.37, y:  0.38, scale: 0.46, driftX: 0.017, driftY: 0.012, phase: 3.7 },
  cloud:     { x:  0.37, y:  0.38, scale: 0.5,  driftX: 0.014, driftY: 0.016, phase: 4.5 },
  arrow:     { x: -0.1,  y: -0.45, scale: 0.43, driftX: 0.018, driftY: 0.01,  phase: 5.3 },
  tentacle:  { x:  0.12, y:  0.44, scale: 0.43, driftX: 0.016, driftY: 0.012, phase: 6.1 },
  monster:   { x:  0.02, y:  0.16, scale: 0.38, driftX: 0.01,  driftY: 0.014, phase: 6.8 },
};

export interface MenuBossSwarmPosition {
  x: number;
  y: number;
  z: number;
  depth: number;
  scale: number;
}

/** Normalized motion shared by the WebGL bosses and the title refraction pass. */
export function getMenuBossSwarmPosition(
  type: MainBossType,
  elapsed: number,
  width: number,
  height: number,
): MenuBossSwarmPosition {
  const layout = MENU_BOSS_LAYOUT[type];
  const t = elapsed * (0.27 + (layout.phase % 3) * 0.012) + layout.phase;
  const swarmX = Math.sin(t) * (0.2 + Math.abs(layout.x) * 0.1);
  const braidX = Math.sin(t * 1.93 + layout.phase * 0.7) * 0.06;
  const swarmY = Math.cos(t * (0.82 + Math.abs(layout.y) * 0.12)) * (0.1 + Math.abs(layout.y) * 0.045);
  const braidY = Math.sin(t * 1.47 + layout.phase) * 0.055;
  const depth = Math.sin(t * 0.71 + layout.phase * 1.3);

  return {
    x: (swarmX + braidX + layout.x * 0.08 + Math.sin(t * 1.61) * layout.driftX) * width,
    y: (swarmY + braidY + layout.y * 0.05 + Math.cos(t * 1.28) * layout.driftY) * height,
    // The title plane is conceptually at z=0. Keep the bosses in front of it,
    // close enough to show depth, without pushing them into the camera clip.
    z: 4.8 + depth * 0.95,
    depth,
    scale: layout.scale * (0.62 + depth * 0.06 + Math.sin(t * 0.67) * 0.025),
  };
}

const FLYING_DURATION = 2.42;
const CONVERGE_DURATION = 1.05;
const RING_START_ANGLE = -Math.PI / 2;
const RING_SPIN_SPEED = Math.PI * 0.92;
const CONVERGE_SPIN_SPEED = Math.PI * 1.42;
const FULL_SCREEN_RING_SCALE = 0.43;
// The flash phase is the shared detonation window: bosses hold at the center
// while the white screen curtain takes over the transition.
const FLASH_DURATION = 1.85;
const FLASH_BOSS_HOLD = 0.62;
const MENU_BACKGROUND_REVEAL_DURATION = 1.15;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

function easeInOut(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function getWorldCardAnchor(world: number): { x: number; y: number } | null {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const card = document.querySelector<HTMLElement>(`[data-testid="button-world-${world}"]`);
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function renderArcadeBoss(type: MainBossType) {
  return <BossVisual type={type} radius={1.05} healthPercent={1} />;
}

/** A fixed World 1.1 enemy showcase for the root menu Play target. */
function World1MenuEnemy() {
  const groupRef = useRef<THREE.Group>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const { camera, size } = useThree();
  const modelZ = 7.25;

  useFrame(() => {
    const group = groupRef.current;
    if (!group || typeof document === "undefined" || size.width <= 0 || size.height <= 0) return;

    const playButton = document.querySelector<HTMLElement>('[data-testid="button-menu-play"]');
    if (!playButton) return;
    const bounds = playButton.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    // Project the live DOM button center onto the fixed depth plane so the
    // model follows responsive tray placement without drifting around it.
    ndc.set(
      (bounds.left + bounds.width / 2) / size.width * 2 - 1,
      1 - (bounds.top + bounds.height / 2) / size.height * 2,
    );
    raycaster.setFromCamera(ndc, camera);
    const directionZ = raycaster.ray.direction.z;
    if (Math.abs(directionZ) < 0.0001) return;
    const distance = (modelZ - raycaster.ray.origin.z) / directionZ;
    group.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, distance);
    group.position.z = modelZ;
  });

  return (
    <group ref={groupRef} position={[0, -0.1, modelZ]} scale={0.38} renderOrder={25}>
      <MiniFireOrb radius={1} particleCount={28} showParticles showLight />
    </group>
  );
}

export function getArcadeBossIntroGlow(type: MainBossType): {
  lightIntensity: number;
  haloOpacity: number;
} {
  // ToxicBoss displays its authored texture directly. Keep the shared arcade
  // halo restrained so it does not wash out the multicolor texture.
  if (type === "trapezoid") {
    return { lightIntensity: 0.6, haloOpacity: 0.04 };
  }
  return { lightIntensity: 3.2, haloOpacity: 0.18 };
}

function ArcadeBossActor({
  definition,
  phase,
  presentation,
  selectedWorld,
}: {
  definition: ArcadeBossIntroDef;
  phase: IntroBossPhase;
  presentation: IntroBossPresentation;
  selectedWorld: number;
}) {
  type IntroMaterialState = {
    material: THREE.Material;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
  };
  const groupRef = useRef<THREE.Group>(null);
  const { viewport, camera } = useThree();
  const phaseStartedAt = useRef(typeof performance === "undefined" ? 0 : performance.now());
  const previousPhase = useRef<IntroBossPhase | null>(null);
  const menuRevealStartedAt = useRef<number | null>(null);
  const previousPresentation = useRef<IntroBossPresentation | null>(null);
  const introMaterialStates = useRef<IntroMaterialState[]>([]);
  const materialFadeInitialized = useRef(false);

  useEffect(() => {
    const now = typeof performance === "undefined" ? 0 : performance.now();
    if (phase === "menu" && presentation === "worlds" && previousPresentation.current !== "worlds") {
      menuRevealStartedAt.current = now;
    } else if (phase === "menu" && presentation === "menu" && previousPhase.current !== "menu") {
      menuRevealStartedAt.current = now;
    } else if (phase !== "menu") {
      menuRevealStartedAt.current = null;
    }
    const menuMotionPhases: IntroBossPhase[] = ["backdrop", "background", "title", "waiting", "menu"];
    const preserveMenuMotionClock =
      menuMotionPhases.includes(phase) &&
      previousPhase.current !== null &&
      menuMotionPhases.includes(previousPhase.current);
    if (!preserveMenuMotionClock) phaseStartedAt.current = now;
    previousPhase.current = phase;
    previousPresentation.current = presentation;
  }, [phase, presentation]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const now = typeof performance === "undefined" ? 0 : performance.now();
    const elapsed = Math.max(0, (now - phaseStartedAt.current) / 1000);
    const width = viewport.width;
    const height = viewport.height;
    const offscreenX = definition.startX * 1.28 * width;
    const offscreenY = definition.startY * 1.22 * height;
    // Every boss must hit the same screen-space origin so the detonation and
    // title reveal share one exact anchor.
    const convergeX = 0;
    const convergeY = 0;

    if (phase !== "menu" && materialFadeInitialized.current) {
      introMaterialStates.current.forEach(({ material, opacity, transparent, depthWrite }) => {
        material.opacity = opacity;
        material.transparent = transparent;
        material.depthWrite = depthWrite;
        material.needsUpdate = true;
      });
      introMaterialStates.current = [];
      materialFadeInitialized.current = false;
    }

    if (phase === "idle") {
      group.position.set(offscreenX, offscreenY, 0);
      group.scale.setScalar(0.03);
      group.rotation.z = THREE.MathUtils.degToRad(definition.rotation - 20);
      return;
    }

    if (phase === "flying") {
      const progress = easeOutCubic((elapsed - definition.delay) / FLYING_DURATION);
      const ringIndex = ARCADE_BOSS_INTRO_DEFS.findIndex((entry) => entry.type === definition.type);
      const ringAngle = RING_START_ANGLE + ringIndex * (Math.PI * 2 / ARCADE_BOSS_INTRO_DEFS.length)
        + Math.min(elapsed, FLYING_DURATION) * RING_SPIN_SPEED;
      // Use the larger viewport dimension so the formation reads as one
      // full-screen circle instead of a small central halo.
      const ringRadius = Math.max(width, height) * FULL_SCREEN_RING_SCALE;
      const ringX = Math.cos(ringAngle) * ringRadius;
      const ringY = Math.sin(ringAngle) * ringRadius;
      const entryProgress = easeOutCubic(elapsed / (FLYING_DURATION * 0.82));
      group.position.set(
        lerp(offscreenX, ringX, entryProgress) + definition.swayX * width * (1 - entryProgress) * 0.16,
        lerp(offscreenY, ringY, entryProgress) + definition.swayY * height * (1 - entryProgress) * 0.16,
        0,
      );
      group.scale.setScalar(lerp(0.16, 0.82, progress));
      group.rotation.z = THREE.MathUtils.degToRad(definition.rotation - 20)
        + (ringAngle - RING_START_ANGLE) * 0.42;
      return;
    }

    if (phase === "converge") {
      const progress = easeInOut(elapsed / CONVERGE_DURATION);
      const ringIndex = ARCADE_BOSS_INTRO_DEFS.findIndex((entry) => entry.type === definition.type);
      // Every actor shares the same shrinking radius and turn clock. The
      // index offset is the only per-boss difference, so the ring stays evenly
      // spaced until all nine paths meet at the drain.
      const spiral = RING_START_ANGLE
        + ringIndex * (Math.PI * 2 / ARCADE_BOSS_INTRO_DEFS.length)
        + FLYING_DURATION * RING_SPIN_SPEED
        + elapsed * CONVERGE_SPIN_SPEED;
      const radius = (1 - progress) * Math.max(width, height) * FULL_SCREEN_RING_SCALE;
      group.position.set(
        convergeX + Math.cos(spiral) * radius,
        convergeY + Math.sin(spiral) * radius,
        0,
      );
      group.scale.setScalar(lerp(0.82, 1.04, progress));
      group.rotation.z = THREE.MathUtils.degToRad(
        definition.rotation * 0.35 + spiral * 18,
      );
      return;
    }

    if (phase === "menu" && presentation === "worlds") {
      const rosterIndex = ARCADE_BOSS_INTRO_DEFS.findIndex((entry) => entry.type === definition.type);
      const rosterProgress = easeOutCubic(
        (now - (menuRevealStartedAt.current ?? now)) / 950,
      );
       // Keep the live models aligned with the actual DOM card centers. Reading
       // the transformed button bounds makes the shared WebGL layer stay locked
       // to the carousel through responsive layout and Framer Motion transitions.
      const selectedIndex = Math.max(0, Math.min(8, selectedWorld - 1));
      const relativeIndex = ((rosterIndex - selectedIndex + 9 + 4) % 9) - 4;
      const isSelected = relativeIndex === 0;
      const rosterTime = elapsed * 0.72 + definition.delay * 2.2;
       const world = ((selectedWorld - 1 + relativeIndex + 9) % 9) + 1;
       const actorZ = (isSelected ? 5.05 : 4.55) + Math.sin(rosterTime * 0.61) * 0.18;
       const perspectiveScale = (camera.position.z - actorZ) / camera.position.z;
       const cardAnchor = getWorldCardAnchor(world);
       const fallbackX = relativeIndex * width * 0.27 * perspectiveScale;
       const fallbackY = 0;
       const anchorX = cardAnchor
         ? (cardAnchor.x - window.innerWidth / 2) / window.innerWidth * width * perspectiveScale
         : fallbackX;
       const anchorY = cardAnchor
         ? (window.innerHeight / 2 - cardAnchor.y) / window.innerHeight * height * perspectiveScale
         : fallbackY;

      group.position.set(
         anchorX + Math.sin(rosterTime) * width * (isSelected ? 0.004 : 0.003),
         anchorY + Math.cos(rosterTime * 0.83) * height * (isSelected ? 0.005 : 0.004),
         actorZ,
      );
      group.scale.setScalar(Math.max(0.001, (isSelected ? 0.92 : 0.54) * rosterProgress));
      group.renderOrder = isSelected ? 8 : 7;
      group.rotation.z = THREE.MathUtils.degToRad(
        definition.rotation * 0.28 + Math.sin(rosterTime * 0.62) * 5,
      );
      group.rotation.x = Math.sin(rosterTime * 0.4) * 0.08;
      group.rotation.y = Math.cos(rosterTime * 0.36) * 0.08;

      if (!materialFadeInitialized.current) {
        group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          const materials = mesh.material
            ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            : [];
          materials.forEach((material) => {
            introMaterialStates.current.push({
              material,
              opacity: material.opacity,
              transparent: material.transparent,
              depthWrite: material.depthWrite,
            });
            material.transparent = true;
            material.depthWrite = false;
            material.needsUpdate = true;
          });
        });
        materialFadeInitialized.current = true;
      }
      introMaterialStates.current.forEach(({ material, opacity }) => {
        material.opacity = opacity * rosterProgress;
      });
      return;
    }

    if (phase === "backdrop" || phase === "background" || phase === "title" || phase === "waiting" || phase === "menu") {
      const layout = MENU_BOSS_LAYOUT[definition.type];
      const menuRevealProgress = 1;
      const motion = getMenuBossSwarmPosition(definition.type, elapsed + definition.delay * 0.8, width, height);
      group.position.set(
        motion.x,
        motion.y,
        motion.z,
      );
      group.scale.setScalar(Math.max(0.001, motion.scale * menuRevealProgress));
      const t = elapsed * 0.27 + definition.delay * 0.8 + layout.phase;
      group.rotation.z = THREE.MathUtils.degToRad(definition.rotation * 0.35 + Math.sin(t * 0.58) * 7);
      group.rotation.x = Math.sin(t * 0.45) * 0.14;
      group.rotation.y = Math.cos(t * 0.38) * 0.14;

      if (phase === "menu") {
        if (!materialFadeInitialized.current) {
          group.traverse((object) => {
            const mesh = object as THREE.Mesh;
            const materials = mesh.material
              ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              : [];
            materials.forEach((material) => {
              introMaterialStates.current.push({
                material,
                opacity: material.opacity,
                transparent: material.transparent,
                depthWrite: material.depthWrite,
              });
              material.transparent = true;
              material.depthWrite = false;
              material.needsUpdate = true;
            });
          });
          materialFadeInitialized.current = true;
        }
        introMaterialStates.current.forEach(({ material, opacity }) => {
          material.opacity = opacity * menuRevealProgress;
        });
      }
      return;
    }

    // Hold every boss on the exact collision point while the white curtain
    // rises. Only after the screen is covered do the models disappear.
    const removalProgress = easeOutCubic((elapsed - FLASH_BOSS_HOLD) / (FLASH_DURATION - FLASH_BOSS_HOLD));
    group.position.set(convergeX, convergeY, 0);
    group.scale.setScalar(Math.max(0.001, lerp(1.04, 0.001, removalProgress)));
    group.rotation.z = THREE.MathUtils.degToRad(definition.rotation);
  });

  const palette = BOSS_DEFEAT_PALETTES[definition.type];
  const introGlow = getArcadeBossIntroGlow(definition.type);
  return (
    <group ref={groupRef}>
      {renderArcadeBoss(definition.type)}
      <group>
        <pointLight color={palette.glow} intensity={introGlow.lightIntensity} distance={7.5} decay={2} />
        <mesh scale={0.72}>
          <sphereGeometry args={[1, 24, 18]} />
          <meshBasicMaterial
            color={palette.glow}
            transparent
            opacity={introGlow.haloOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function IntroExplosionLight({ phase }: { phase: IntroBossPhase }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const chargeStartedAt = useRef(0);

  useEffect(() => {
    if (phase === "converge") {
      chargeStartedAt.current = typeof performance === "undefined" ? 0 : performance.now();
    }
    if (phase !== "converge" && phase !== "flash" && phase !== "title" && lightRef.current) {
      lightRef.current.intensity = 0;
    }
  }, [phase]);

  useFrame(() => {
    const light = lightRef.current;
    if (!light || (phase !== "converge" && phase !== "flash" && phase !== "title")) return;

    const now = typeof performance === "undefined" ? 0 : performance.now();
    const elapsed = Math.max(0, (now - chargeStartedAt.current) / 1000);
    light.position.set(0, 0, 3.2);

    if (phase === "converge") {
      const charge = easeInOut(elapsed / CONVERGE_DURATION);
      light.distance = 5 + charge * 13;
      light.intensity = 1.5 + charge * 14;
      return;
    }

    const flashElapsed = Math.max(0, elapsed - CONVERGE_DURATION);
    const flashProgress = clamp01(flashElapsed / FLASH_DURATION);
    const flare = 1 - easeOutCubic(flashProgress);
    light.distance = 18 + flare * 10;
    light.intensity = 16 + flare * 12;
  });

  return (
    <pointLight
      ref={lightRef}
      color="#c8fbff"
      intensity={0}
      distance={7}
      decay={1.6}
    />
  );
}

function ArcadeBossScene({
  phase,
  presentation,
  selectedWorld,
}: {
  phase: IntroBossPhase;
  presentation: IntroBossPresentation;
  selectedWorld: number;
}) {
  const worldDefinitions = presentation === "worlds"
    ? [-1, 0, 1].map((offset) => {
        const index = ((selectedWorld - 1 + offset + 9) % 9 + 9) % 9;
        return ARCADE_BOSS_INTRO_DEFS[index];
      })
    : ARCADE_BOSS_INTRO_DEFS;
  return (
    <>
      <IntroExplosionLight phase={phase} />
      <ambientLight intensity={1.35} />
      {phase === "menu" && presentation === "menu" && <World1MenuEnemy />}
      <Suspense fallback={null}>
        {worldDefinitions.map((definition) => (
          <ArcadeBossActor
            key={definition.type}
            definition={definition}
            phase={phase}
            presentation={presentation}
            selectedWorld={selectedWorld}
          />
        ))}
      </Suspense>
    </>
  );
}

export function ArcadeBossIntroScene({
  phase,
  presentation = "menu",
  selectedWorld = 1,
}: {
  phase: IntroBossPhase;
  presentation?: IntroBossPresentation;
  selectedWorld?: number;
}) {
  return (
    <ArcadeBossScene
      phase={phase}
      presentation={presentation}
      selectedWorld={selectedWorld}
    />
  );
}