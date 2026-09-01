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
import { MAIN_BOSS_TYPES, type MainBossType } from "@/components/game/BossDefeatPalette";

export type IntroBossPhase = "idle" | "flying" | "converge" | "flash";

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

const FLYING_DURATION = 2.42;
const CONVERGE_DURATION = 0.65;
const FLASH_DURATION = 0.55;

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
  const phaseOrigin = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useEffect(() => {
    const group = groupRef.current;
    if (group) phaseOrigin.current.copy(group.position);
    phaseStartedAt.current = typeof performance === "undefined" ? 0 : performance.now();
  }, [phase]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const now = typeof performance === "undefined" ? 0 : performance.now();
    const elapsed = Math.max(0, (now - phaseStartedAt.current) / 1000);
    const width = viewport.width;
    const height = viewport.height;
    const startX = definition.startX * width;
    const startY = definition.startY * height;
    const offscreenX = definition.startX * 1.28 * width;
    const offscreenY = definition.startY * 1.22 * height;
    const convergeX = definition.convergeX * width;
    const convergeY = definition.convergeY * height;

    if (phase === "idle") {
      group.position.set(offscreenX, offscreenY, 0);
      group.scale.setScalar(0.03);
      group.rotation.z = THREE.MathUtils.degToRad(definition.rotation - 20);
      initialized.current = true;
      return;
    }

    if (phase === "flying") {
      const progress = easeOutCubic((elapsed - definition.delay) / FLYING_DURATION);
      const sway = Math.sin(progress * Math.PI * 3 + definition.delay * 7) * (1 - progress * 0.65);
      group.position.set(
        lerp(offscreenX, startX, progress) + definition.swayX * width * sway,
        lerp(offscreenY, startY, progress) + definition.swayY * height * sway,
        0,
      );
      group.scale.setScalar(lerp(0.16, 0.82, progress));
      group.rotation.z = THREE.MathUtils.degToRad(lerp(definition.rotation - 20, definition.rotation, progress));
      initialized.current = true;
      return;
    }

    if (phase === "converge") {
      const progress = easeInOut(elapsed / CONVERGE_DURATION);
      const origin = initialized.current ? phaseOrigin.current : new THREE.Vector3(startX, startY, 0);
      group.position.set(
        lerp(origin.x, convergeX, progress),
        lerp(origin.y, convergeY, progress),
        0,
      );
      group.scale.setScalar(lerp(0.82, 1.04, progress));
      group.rotation.z = THREE.MathUtils.degToRad(lerp(definition.rotation, definition.rotation * 0.35, progress));
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

  return <group ref={groupRef}>{renderArcadeBoss(definition.type)}</group>;
}

function ArcadeBossScene({
  phase,
}: {
  phase: IntroBossPhase;
}) {
  return (
    <>
      <ambientLight intensity={1.7} />
      <pointLight position={[0, 0, 7]} intensity={4} distance={30} color="#d9ffff" />
      <pointLight position={[-7, 4, 2]} intensity={2.5} distance={20} color="#00ccff" />
      <pointLight position={[7, -4, 2]} intensity={2.5} distance={20} color="#ff00dd" />
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