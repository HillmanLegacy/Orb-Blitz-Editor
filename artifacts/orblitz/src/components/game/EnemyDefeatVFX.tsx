import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameRuntime } from "@/game-runtime/GameRuntime";
import { useMagicOrb, type BossType } from "@/lib/stores/useMagicOrb";
import { getGraphicsPreset, useGraphicsPreset, type GraphicsPreset } from "@/game-runtime/PerformanceToggles";
import {
  getBossDefeatPalette,
  MAIN_BOSS_TYPES,
  type BossDefeatPalette,
} from "./BossDefeatPalette";
import {
  ENEMY_DEFEAT_DURATION,
  ENEMY_DEFEAT_PROFILES,
  getEnemyDefeatProgress,
  resolveEnemyDefeatBossType,
} from "./EnemyDefeatConfig";

const MAX_SLOTS = ENEMY_DEFEAT_PROFILES.high.maxActive;
const MAX_MAIN = ENEMY_DEFEAT_PROFILES.high.main;
const MAX_EMBERS = ENEMY_DEFEAT_PROFILES.high.embers;
const MAX_FRAGMENTS = ENEMY_DEFEAT_PROFILES.high.fragments;
const MAX_CORONA = ENEMY_DEFEAT_PROFILES.high.corona;

type ParticleDatum = Readonly<{
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  delay: number;
  gravity: number;
  tone: number;
}>;

type CoronaDatum = Readonly<{
  angle: number;
  elevation: number;
  speed: number;
  size: number;
  delay: number;
  tone: number;
}>;

type FragmentDatum = ParticleDatum & Readonly<{ spinRate: number }>;

type PaletteColors = Readonly<{
  primary: THREE.Color;
  secondary: THREE.Color;
  glow: THREE.Color;
  highlight: THREE.Color;
  shadow: THREE.Color;
  rainbow: boolean;
}>;

type EffectSlot = {
  active: boolean;
  id: string;
  bossType: BossType;
  x: number;
  y: number;
  z: number;
  sourceScale: number;
  scale: number;
  angle: number;
  seenFrame: number;
  lastPreset: GraphicsPreset | "";
};

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

function seeded(seed: number, index: number): number {
  const x = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeParticleData(count: number, seed: number, kind: "main" | "ember"): ParticleDatum[] {
  const data: ParticleDatum[] = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i + seeded(seed, i) * 2;
    data.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
      speed: kind === "main" ? 0.8 + seeded(seed, i * 4) * 2.2 : 0.3 + seeded(seed, i * 4) * 0.6,
      size: kind === "main" ? 0.03 + seeded(seed, i * 4 + 1) * 0.07 : 0.02 + seeded(seed, i * 4 + 1) * 0.04,
      delay: kind === "main" ? seeded(seed, i * 4 + 2) * 0.12 : 0.45 + seeded(seed, i * 4 + 2) * 0.15,
      gravity: kind === "main" ? 0.6 + seeded(seed, i * 4 + 3) * 0.8 : 1.5 + seeded(seed, i * 4 + 3),
      tone: seeded(seed, i * 4 + 3),
    });
  }
  return data;
}

function makeFragmentData(count: number): FragmentDatum[] {
  const data: FragmentDatum[] = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i + seeded(42, i) * 1.5;
    data.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
      speed: 0.4 + seeded(42, i * 5 + 1) * 0.7,
      size: 0.25 + seeded(42, i * 5 + 2) * 0.17,
      delay: seeded(42, i * 5 + 3) * 0.08,
      gravity: 0.35,
      tone: seeded(42, i * 5 + 4),
      spinRate: (0.8 + seeded(42, i * 5) * 1.6) * (seeded(42, i + 77) > 0.5 ? 1 : -1),
    });
  }
  return data;
}

function makeCoronaData(count: number): CoronaDatum[] {
  const data: CoronaDatum[] = [];
  for (let i = 0; i < count; i++) {
    data.push({
      angle: (i / count) * Math.PI * 2 + seeded(17, i) * 0.6,
      elevation: (seeded(17, i * 3 + 1) - 0.5) * Math.PI * 0.55,
      speed: 0.5 + seeded(17, i * 3 + 2) * 0.9,
      size: 0.04 + seeded(17, i * 3) * 0.08,
      delay: seeded(17, i * 3 + 1) * 0.1,
      tone: seeded(17, i * 3 + 2),
    });
  }
  return data;
}

const MAIN_DATA = makeParticleData(MAX_MAIN, 7, "main");
const EMBER_DATA = makeParticleData(MAX_EMBERS, 99, "ember");
const FRAGMENT_DATA = makeFragmentData(MAX_FRAGMENTS);
const CORONA_DATA = makeCoronaData(MAX_CORONA);

const paletteCache = new Map<BossType, PaletteColors>();

for (const bossType of MAIN_BOSS_TYPES) {
  const source = getBossDefeatPalette(bossType);
  paletteCache.set(bossType, {
    primary: new THREE.Color(source.primary),
    secondary: new THREE.Color(source.secondary),
    glow: new THREE.Color(source.glow),
    highlight: new THREE.Color(source.highlight),
    shadow: new THREE.Color(source.shadow),
    rainbow: source.rainbow === true,
  });
}

function getPaletteColors(bossType: BossType): PaletteColors {
  const cached = paletteCache.get(bossType);
  if (cached) return cached;
  const source: BossDefeatPalette = getBossDefeatPalette(bossType);
  const colors: PaletteColors = {
    primary: new THREE.Color(source.primary),
    secondary: new THREE.Color(source.secondary),
    glow: new THREE.Color(source.glow),
    highlight: new THREE.Color(source.highlight),
    shadow: new THREE.Color(source.shadow),
    rainbow: source.rainbow === true,
  };
  paletteCache.set(bossType, colors);
  return colors;
}

function writePaletteColor(
  palette: PaletteColors,
  tone: number,
  time: number,
  instance: number,
  brightness: number,
): void {
  if (palette.rainbow) {
    _color.setHSL((time * 0.18 + tone * 0.25 + instance * 0.003) % 1, 1, brightness);
    return;
  }
  if (tone < 0.5) {
    _color.lerpColors(palette.primary, palette.secondary, tone * 2);
  } else {
    _color.lerpColors(palette.secondary, palette.highlight, (tone - 0.5) * 2);
  }
  _color.multiplyScalar(brightness);
}

function hideRange(mesh: THREE.InstancedMesh | null, start: number, count: number): void {
  if (!mesh) return;
  for (let i = 0; i < count; i++) mesh.setMatrixAt(start + i, _hiddenMatrix);
}

function profileForPreset(preset: GraphicsPreset) {
  return ENEMY_DEFEAT_PROFILES[preset];
}

function findFreeSlot(slots: EffectSlot[], maxActive: number): number {
  for (let i = 0; i < maxActive; i++) {
    if (!slots[i].active) return i;
  }
  return -1;
}

export function EnemyDefeatVFX() {
  const preset = useGraphicsPreset();
  const presetRef = useRef(preset);
  presetRef.current = preset;

  const mainRef = useRef<THREE.InstancedMesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const fragmentRef = useRef<THREE.InstancedMesh>(null);
  const coronaRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const initializedRef = useRef(false);
  const frameRef = useRef(0);
  const idToSlotRef = useRef(new Map<string, number>());
  const slotsRef = useRef<EffectSlot[]>(
    Array.from({ length: MAX_SLOTS }, () => ({
      active: false,
      id: "",
      bossType: "circle",
      x: 0,
      y: 0,
      z: 0,
      sourceScale: 1,
      scale: 1,
      angle: 0,
      seenFrame: -1,
      lastPreset: "",
    })),
  );

  const capacities = useMemo(() => ({
    main: MAX_SLOTS * MAX_MAIN,
    embers: MAX_SLOTS * MAX_EMBERS,
    fragments: MAX_SLOTS * MAX_FRAGMENTS,
    corona: MAX_SLOTS * MAX_CORONA,
    flashes: MAX_SLOTS,
  }), []);

  const clearSlot = (slotIndex: number) => {
    hideRange(mainRef.current, slotIndex * MAX_MAIN, MAX_MAIN);
    hideRange(emberRef.current, slotIndex * MAX_EMBERS, MAX_EMBERS);
    hideRange(fragmentRef.current, slotIndex * MAX_FRAGMENTS, MAX_FRAGMENTS);
    hideRange(coronaRef.current, slotIndex * MAX_CORONA, MAX_CORONA);
    hideRange(flashRef.current, slotIndex, 1);
  };

  useEffect(() => {
    return () => {
      idToSlotRef.current.clear();
      for (const ref of [mainRef, emberRef, fragmentRef, coronaRef, flashRef]) {
        const mesh = ref.current;
        if (!mesh) continue;
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    };
  }, []);

  useFrame((state) => {
    const mainMesh = mainRef.current;
    const emberMesh = emberRef.current;
    const fragmentMesh = fragmentRef.current;
    const coronaMesh = coronaRef.current;
    const flashMesh = flashRef.current;
    if (!mainMesh || !emberMesh || !fragmentMesh || !coronaMesh || !flashMesh) return;

    if (!initializedRef.current) {
      for (let i = 0; i < MAX_SLOTS; i++) clearSlot(i);
      mainMesh.instanceMatrix.needsUpdate = true;
      emberMesh.instanceMatrix.needsUpdate = true;
      fragmentMesh.instanceMatrix.needsUpdate = true;
      coronaMesh.instanceMatrix.needsUpdate = true;
      flashMesh.instanceMatrix.needsUpdate = true;
      initializedRef.current = true;
    }

    const currentFrame = ++frameRef.current;
    const { darkOrbs, gameMode, arcadeLevel } = useMagicOrb.getState();
    const profile = profileForPreset(presetRef.current || getGraphicsPreset());

    for (let i = profile.maxActive; i < MAX_SLOTS; i++) {
      const slot = slotsRef.current[i];
      if (!slot.active) continue;
      idToSlotRef.current.delete(slot.id);
      slot.active = false;
      slot.id = "";
      slot.lastPreset = "";
      clearSlot(i);
    }

    for (const orb of darkOrbs) {
      if (!orb.destroying) continue;
      const bossType = resolveEnemyDefeatBossType(orb, gameMode, arcadeLevel);
      if (!bossType) continue;

      let slotIndex = idToSlotRef.current.get(orb.id);
      if (slotIndex === undefined) {
        slotIndex = findFreeSlot(slotsRef.current, profile.maxActive);
        if (slotIndex < 0) continue;

        const slot = slotsRef.current[slotIndex];
        const physics = gameRuntime.enemies.byId.get(orb.id);
        const position = physics?.position ?? orb.position;
        slot.active = true;
        slot.id = orb.id;
        slot.bossType = bossType;
        slot.x = position[0];
        slot.y = position[1];
        slot.z = position[2];
        slot.sourceScale = orb.size;
        slot.scale = Math.max(0.36, Math.min(2.8, slot.sourceScale * profile.sizeMultiplier));
        slot.angle = seeded(orb.seed * 1000 + 31, slotIndex) * Math.PI * 2;
        slot.lastPreset = "";
        idToSlotRef.current.set(orb.id, slotIndex);
      }

      const slot = slotsRef.current[slotIndex];
      slot.seenFrame = currentFrame;
      slot.bossType = bossType;
      slot.scale = Math.max(0.36, Math.min(2.8, slot.sourceScale * profile.sizeMultiplier));
      if (slot.lastPreset !== presetRef.current) {
        clearSlot(slotIndex);
        slot.lastPreset = presetRef.current;
      }

      const progress = getEnemyDefeatProgress(orb.destroyTimer);
      const time = state.clock.elapsedTime;
      const palette = getPaletteColors(slot.bossType);
      const cosA = Math.cos(slot.angle);
      const sinA = Math.sin(slot.angle);

      for (let i = 0; i < profile.main; i++) {
        const datum = MAIN_DATA[i];
        const localP = Math.max(0, (progress - datum.delay) / (1 - datum.delay));
        const index = slotIndex * MAX_MAIN + i;
        if (localP <= 0) {
          mainRef.current!.setMatrixAt(index, _hiddenMatrix);
          continue;
        }
        const rotatedX = datum.x * cosA - datum.z * sinA;
        const rotatedZ = datum.x * sinA + datum.z * cosA;
        const distance = datum.speed * slot.scale * (localP - localP * localP * 0.5);
        const gravity = -datum.gravity * slot.scale * localP * localP * 0.5;
        _dummy.position.set(slot.x + rotatedX * distance, slot.y + datum.y * distance + gravity, slot.z + rotatedZ * distance);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(datum.size * slot.scale * Math.max(0, 1 - localP * 1.2));
        _dummy.updateMatrix();
        mainRef.current!.setMatrixAt(index, _dummy.matrix);
        writePaletteColor(palette, datum.tone, time, index, 0.78 + (1 - localP) * 0.22);
        mainRef.current!.setColorAt(index, _color);
      }

      for (let i = 0; i < profile.corona; i++) {
        const datum = CORONA_DATA[i];
        const localP = Math.max(0, (progress - datum.delay) / Math.max(0.001, 0.55 - datum.delay));
        const index = slotIndex * MAX_CORONA + i;
        if (progress >= 0.55 || localP <= 0) {
          coronaRef.current!.setMatrixAt(index, _hiddenMatrix);
          continue;
        }
        const angle = datum.angle + slot.angle;
        const distance = datum.speed * slot.scale * localP * 0.55;
        _dummy.position.set(
          slot.x + Math.cos(angle) * Math.cos(datum.elevation) * distance,
          slot.y + Math.sin(datum.elevation) * distance + localP * localP * 0.4 * slot.scale,
          slot.z + Math.sin(angle) * Math.cos(datum.elevation) * distance,
        );
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(datum.size * slot.scale * Math.max(0, 1 - localP * 1.6));
        _dummy.updateMatrix();
        coronaRef.current!.setMatrixAt(index, _dummy.matrix);
        writePaletteColor(palette, datum.tone, time, index, 0.78 + localP * 0.22);
        coronaRef.current!.setColorAt(index, _color);
      }

      for (let i = 0; i < profile.fragments; i++) {
        const datum = FRAGMENT_DATA[i];
        const localP = Math.max(0, (progress - datum.delay) / (0.85 - datum.delay));
        const index = slotIndex * MAX_FRAGMENTS + i;
        if (progress > 0.85 || localP <= 0) {
          fragmentRef.current!.setMatrixAt(index, _hiddenMatrix);
          continue;
        }
        const rotatedX = datum.x * cosA - datum.z * sinA;
        const rotatedZ = datum.x * sinA + datum.z * cosA;
        const eased = localP * (2 - localP);
        const distance = datum.speed * slot.scale * eased * 0.65;
        _dummy.position.set(
          slot.x + rotatedX * distance,
          slot.y + datum.y * distance - 0.35 * localP * localP * slot.scale,
          slot.z + rotatedZ * distance,
        );
        _dummy.rotation.set(0, time * datum.spinRate, time * datum.spinRate * 0.4);
        const fade = Math.max(0, 1 - Math.max(0, localP - 0.7) / 0.3);
        _dummy.scale.setScalar(Math.max(0.001, datum.size * slot.scale * fade));
        _dummy.updateMatrix();
        fragmentRef.current!.setMatrixAt(index, _dummy.matrix);
        writePaletteColor(palette, datum.tone, time, index, 0.72 + (1 - localP) * 0.28);
        fragmentRef.current!.setColorAt(index, _color);
      }

      for (let i = 0; i < profile.embers; i++) {
        const datum = EMBER_DATA[i];
        const localP = Math.max(0, (progress - datum.delay) / (1 - datum.delay));
        const index = slotIndex * MAX_EMBERS + i;
        if (progress < 0.45 || localP <= 0) {
          emberRef.current!.setMatrixAt(index, _hiddenMatrix);
          continue;
        }
        const rotatedX = datum.x * cosA - datum.z * sinA;
        const rotatedZ = datum.x * sinA + datum.z * cosA;
        const distance = datum.speed * slot.scale * localP * 0.7;
        _dummy.position.set(
          slot.x + rotatedX * distance,
          slot.y + datum.y * distance - datum.gravity * slot.scale * localP * localP * 0.4,
          slot.z + rotatedZ * distance,
        );
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(datum.size * slot.scale * Math.max(0, 1 - localP * 1.4));
        _dummy.updateMatrix();
        emberRef.current!.setMatrixAt(index, _dummy.matrix);
        if (palette.rainbow) {
          _color.setHSL((time * 0.18 + datum.tone * 0.25 + index * 0.003) % 1, 1, 0.6);
        } else {
          _color.lerpColors(palette.shadow, palette.glow, datum.tone).multiplyScalar(0.72);
        }
        emberRef.current!.setColorAt(index, _color);
      }

      const flashLocal = progress < 0.1
        ? progress / 0.1
        : Math.max(0, 1 - (progress - 0.1) / 0.55);
      _dummy.position.set(slot.x, slot.y, slot.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(slot.scale * 0.9 * flashLocal);
      _dummy.updateMatrix();
      flashRef.current!.setMatrixAt(slotIndex, _dummy.matrix);
      if (palette.rainbow) _color.setHSL((time * 0.18 + slotIndex * 0.07) % 1, 0.8, 0.78);
      else _color.copy(palette.highlight);
      flashRef.current!.setColorAt(slotIndex, _color);
    }

    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = slotsRef.current[i];
      if (!slot.active || slot.seenFrame === currentFrame) continue;
      idToSlotRef.current.delete(slot.id);
      slot.active = false;
      slot.id = "";
      slot.lastPreset = "";
      clearSlot(i);
    }

    mainMesh.instanceMatrix.needsUpdate = true;
    emberMesh.instanceMatrix.needsUpdate = true;
    fragmentMesh.instanceMatrix.needsUpdate = true;
    coronaMesh.instanceMatrix.needsUpdate = true;
    flashMesh.instanceMatrix.needsUpdate = true;
    if (mainMesh.instanceColor) mainMesh.instanceColor.needsUpdate = true;
    if (emberMesh.instanceColor) emberMesh.instanceColor.needsUpdate = true;
    if (fragmentMesh.instanceColor) fragmentMesh.instanceColor.needsUpdate = true;
    if (coronaMesh.instanceColor) coronaMesh.instanceColor.needsUpdate = true;
    if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={coronaRef} args={[undefined, undefined, capacities.corona]} frustumCulled={false}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={mainRef} args={[undefined, undefined, capacities.main]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={fragmentRef} args={[undefined, undefined, capacities.fragments]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={emberRef} args={[undefined, undefined, capacities.embers]} frustumCulled={false}>
        <sphereGeometry args={[1, 4, 3]} />
        <meshBasicMaterial transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={flashRef} args={[undefined, undefined, capacities.flashes]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

export { ENEMY_DEFEAT_DURATION };