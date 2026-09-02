import { Suspense, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CrystalBoss } from "@/components/game/CrystalBoss";
import { DiamondBoss } from "@/components/game/DiamondBoss";
import { FireBoss } from "@/components/game/FireBoss";
import { MechaBoss } from "@/components/game/MechaBoss";
import { MonsterBoss } from "@/components/game/MonsterBoss";
import { PlasmaBoss } from "@/components/game/PlasmaBoss";
import { RainbowBoss } from "@/components/game/RainbowBoss";
import { StarBoss } from "@/components/game/StarBoss";
import { ToxicBoss } from "@/components/game/ToxicBoss";
import { BOSS_DEFEAT_PALETTES, MAIN_BOSS_TYPES, type MainBossType } from "@/components/game/BossDefeatPalette";

export type IntroBossPhase = "idle" | "flying" | "converge" | "flash" | "title" | "waiting" | "menu";

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
const CONVERGE_DURATION = 0.65;
// The flash phase is the shared detonation window: bosses leave the center
// while the screen-space orb explosion takes over the transition.
const FLASH_DURATION = 1.85;

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

function renderArcadeBoss(type: MainBossType) {
  const radius = 1.05;
  switch (type) {
    case "circle":
      return <FireBoss radius={radius} healthPercent={1} />;
    case "star":
      return <StarBoss radius={radius} healthPercent={1} />;
    case "triangle":
      return <CrystalBoss radius={radius} healthPercent={1} />;
    case "trapezoid":
      return <ToxicBoss radius={radius} healthPercent={1} />;
    case "cube":
      return <PlasmaBoss radius={radius} healthPercent={1} />;
    case "cloud":
      return <DiamondBoss radius={radius} healthPercent={1} />;
    case "arrow":
      return <RainbowBoss radius={radius} healthPercent={1} />;
    case "tentacle":
      return <MechaBoss radius={radius} healthPercent={1} />;
    case "monster":
      return <MonsterBoss radius={radius} healthPercent={1} />;
  }
}

function ArcadeBossActor({
  definition,
  phase,
}: {
  definition: ArcadeBossIntroDef;
  phase: IntroBossPhase;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const phaseStartedAt = useRef(typeof performance === "undefined" ? 0 : performance.now());
  const previousPhase = useRef<IntroBossPhase>(phase);
  const phaseOrigin = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useEffect(() => {
    const group = groupRef.current;
    if (group) phaseOrigin.current.copy(group.position);
    const now = typeof performance === "undefined" ? 0 : performance.now();
    const preserveTitleClock =
      (phase === "waiting" || phase === "menu") &&
      (previousPhase.current === "title" || previousPhase.current === "waiting" || previousPhase.current === "menu");
    if (!preserveTitleClock) phaseStartedAt.current = now;
    previousPhase.current = phase;
  }, [phase]);

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

    if (phase === "idle") {
      group.position.set(offscreenX, offscreenY, 0);
      group.scale.setScalar(0.03);
      group.rotation.z = THREE.MathUtils.degToRad(definition.rotation - 20);
      initialized.current = true;
      return;
    }

    if (phase === "flying") {
      const progress = easeOutCubic((elapsed - definition.delay) / FLYING_DURATION);
      const startRadius = Math.hypot(offscreenX, offscreenY);
      const orbitRadius = lerp(startRadius, Math.min(width, height) * 0.16, easeOutCubic(progress));
      const startAngle = Math.atan2(offscreenY, offscreenX) + definition.delay * 1.8;
      const orbitAngle = startAngle + progress * Math.PI * 2.15;
      group.position.set(
        Math.cos(orbitAngle) * orbitRadius + definition.swayX * width * (1 - progress) * 0.32,
        Math.sin(orbitAngle) * orbitRadius + definition.swayY * height * (1 - progress) * 0.32,
        0,
      );
      group.scale.setScalar(lerp(0.16, 0.82, progress));
      group.rotation.z = THREE.MathUtils.degToRad(lerp(definition.rotation - 20, definition.rotation, progress));
      initialized.current = true;
      return;
    }

    if (phase === "converge") {
      const progress = easeInOut(elapsed / CONVERGE_DURATION);
      const origin = initialized.current ? phaseOrigin.current : new THREE.Vector3(convergeX, convergeY, 0);
      const spiral = (1 - progress) * (0.5 + Math.abs(definition.startX) + Math.abs(definition.startY)) * Math.PI * 1.7;
      const radius = (1 - progress) * Math.min(width, height) * 0.09;
      group.position.set(
        lerp(origin.x, convergeX, progress) + Math.cos(spiral + definition.delay * 8) * radius,
        lerp(origin.y, convergeY, progress) + Math.sin(spiral + definition.delay * 8) * radius,
        0,
      );
      group.scale.setScalar(lerp(0.82, 1.04, progress));
      group.rotation.z = THREE.MathUtils.degToRad(
        lerp(definition.rotation, definition.rotation * 0.35, progress) + spiral * 18,
      );
      return;
    }

    if (phase === "title" || phase === "waiting" || phase === "menu") {
      const layout = MENU_BOSS_LAYOUT[definition.type];
      const titleRamp = phase === "title" ? easeOutCubic(elapsed / 0.9) : 1;
      const motion = getMenuBossSwarmPosition(definition.type, elapsed + definition.delay * 0.8, width, height);
      group.position.set(
        motion.x,
        motion.y,
        motion.z,
      );
      group.scale.setScalar(Math.max(0.001, motion.scale * titleRamp));
      const t = elapsed * 0.27 + definition.delay * 0.8 + layout.phase;
      group.rotation.z = THREE.MathUtils.degToRad(definition.rotation * 0.35 + Math.sin(t * 0.58) * 7);
      group.rotation.x = Math.sin(t * 0.45) * 0.14;
      group.rotation.y = Math.cos(t * 0.38) * 0.14;
      return;
    }

    const progress = easeOutCubic(elapsed / FLASH_DURATION);
    const origin = initialized.current ? phaseOrigin.current : new THREE.Vector3(convergeX, convergeY, 0);
    const direction = new THREE.Vector3(origin.x, origin.y, 0);
    if (direction.lengthSq() < 0.001) direction.set(Math.cos(definition.rotation), Math.sin(definition.rotation), 0);
    direction.normalize();
    group.position.set(
      lerp(origin.x, origin.x + direction.x * width * 0.22, progress),
      lerp(origin.y, origin.y + direction.y * height * 0.22, progress),
      0,
    );
    group.scale.setScalar(Math.max(0.01, lerp(1.04, 0.01, progress)));
    group.rotation.z = THREE.MathUtils.degToRad(definition.rotation + 70 * progress);
  });

  const palette = BOSS_DEFEAT_PALETTES[definition.type];
  return (
    <group ref={groupRef}>
      {renderArcadeBoss(definition.type)}
      <group>
        <pointLight color={palette.glow} intensity={3.2} distance={7.5} decay={2} />
        <mesh scale={0.72}>
          <sphereGeometry args={[1, 24, 18]} />
          <meshBasicMaterial
            color={palette.glow}
            transparent
            opacity={0.18}
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
  const explosionStartedAt = useRef(0);

  useEffect(() => {
    if (phase === "flash") {
      explosionStartedAt.current = typeof performance === "undefined" ? 0 : performance.now();
    }
    if (phase !== "flash" && phase !== "title" && lightRef.current) {
      lightRef.current.intensity = 0;
    }
  }, [phase]);

  useFrame(() => {
    const light = lightRef.current;
    if (!light || (phase !== "flash" && phase !== "title")) return;

    const now = typeof performance === "undefined" ? 0 : performance.now();
    const elapsed = Math.max(0, (now - explosionStartedAt.current) / 1000);
    const progress = clamp01(elapsed / FLASH_DURATION);
    const attack = easeOutCubic(progress / 0.18);
    const decay = 1 - easeOutCubic((progress - 0.18) / 0.82);
    const pulse = progress < 0.18 ? attack : Math.max(0, decay);

    light.position.set(0, 0, 3.2);
    light.distance = 7 + progress * 12;
    light.intensity = pulse * 9;
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
}: {
  phase: IntroBossPhase;
}) {
  return (
    <>
      <IntroExplosionLight phase={phase} />
      <ambientLight intensity={1.35} />
      <Suspense fallback={null}>
        {ARCADE_BOSS_INTRO_DEFS.map((definition) => (
          <ArcadeBossActor key={definition.type} definition={definition} phase={phase} />
        ))}
      </Suspense>
    </>
  );
}

export function ArcadeBossIntroScene({ phase }: { phase: IntroBossPhase }) {
  return (
    <ArcadeBossScene phase={phase} />
  );
}